//! Multi-model token pricing, USD cost estimation, and budget tracker in Rust.

use std::collections::HashMap;
use std::os::raw::c_int;

#[derive(Debug, Clone)]
pub struct ModelPricing {
    pub prompt_per_million: f64,
    pub completion_per_million: f64,
    pub cache_read_per_million: f64,
}

pub struct BudgetTracker {
    pub default_pricing: ModelPricing,
    pub custom_pricing: HashMap<String, ModelPricing>,
    pub total_prompt_tokens: u64,
    pub total_completion_tokens: u64,
    pub total_cache_read_tokens: u64,
    pub total_cost_usd: f64,
}

impl Default for BudgetTracker {
    fn default() -> Self {
        let mut custom = HashMap::new();
        // DeepSeek V4 Flash
        custom.insert(
            "deepseek-v4-flash".to_string(),
            ModelPricing {
                prompt_per_million: 0.14,
                completion_per_million: 0.28,
                cache_read_per_million: 0.014,
            },
        );
        // Claude 3.5 Sonnet
        custom.insert(
            "claude-3-5-sonnet".to_string(),
            ModelPricing {
                prompt_per_million: 3.0,
                completion_per_million: 15.0,
                cache_read_per_million: 0.30,
            },
        );
        // GPT-4o
        custom.insert(
            "gpt-4o".to_string(),
            ModelPricing {
                prompt_per_million: 2.50,
                completion_per_million: 10.0,
                cache_read_per_million: 1.25,
            },
        );

        Self {
            default_pricing: ModelPricing {
                prompt_per_million: 0.50,
                completion_per_million: 1.50,
                cache_read_per_million: 0.10,
            },
            custom_pricing: custom,
            total_prompt_tokens: 0,
            total_completion_tokens: 0,
            total_cache_read_tokens: 0,
            total_cost_usd: 0.0,
        }
    }
}

impl BudgetTracker {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get_pricing(&self, model: &str) -> &ModelPricing {
        let m_lower = model.to_ascii_lowercase();
        for (k, v) in &self.custom_pricing {
            if m_lower.contains(k) {
                return v;
            }
        }
        &self.default_pricing
    }

    pub fn estimate_cost(
        &self,
        model: &str,
        prompt_tokens: u64,
        completion_tokens: u64,
        cache_read_tokens: u64,
    ) -> f64 {
        let pricing = self.get_pricing(model);
        let prompt_cost = (prompt_tokens as f64 / 1_000_000.0) * pricing.prompt_per_million;
        let completion_cost = (completion_tokens as f64 / 1_000_000.0) * pricing.completion_per_million;
        let cache_cost = (cache_read_tokens as f64 / 1_000_000.0) * pricing.cache_read_per_million;
        prompt_cost + completion_cost + cache_cost
    }

    pub fn record_usage(
        &mut self,
        model: &str,
        prompt_tokens: u64,
        completion_tokens: u64,
        cache_read_tokens: u64,
    ) -> f64 {
        let cost = self.estimate_cost(model, prompt_tokens, completion_tokens, cache_read_tokens);
        self.total_prompt_tokens += prompt_tokens;
        self.total_completion_tokens += completion_tokens;
        self.total_cache_read_tokens += cache_read_tokens;
        self.total_cost_usd += cost;
        cost
    }
}

// ============================================================================
// Pure snapshot / decision functions (slice 3).
//
// These are stateless from Rust's perspective: the TS BudgetEngine owns the
// running state and calls into native every turn with the current counters.
// Mirrors the TS logic in `src/budget.ts` `BudgetEngine.ratio()` and
// `BudgetEngine.phase()` byte-for-byte so the parity test can prove it.
// ============================================================================

/// Limits encoded for the FFI call. `f64::INFINITY` is the TS convention for
/// "no cap on this dimension"; `NaN` is invalid input.
#[derive(Debug, Clone, Copy)]
pub struct BudgetLimitsInput {
    pub max_tokens: f64,
    pub max_cost_usd: f64,
    pub max_duration_ms: f64,
    pub max_tool_calls: f64,
    pub max_model_calls: f64,
}

#[derive(Debug, Clone, Copy)]
pub struct BudgetUsedInput {
    pub used_tokens: f64,
    pub used_cost_usd: f64,
    pub used_duration_ms: f64,
    pub used_tool_calls: f64,
    pub used_model_calls: f64,
}

/// Mirrors `BudgetEngine.ratio()` in TS. Returns a value in [0, 1] where 1.0
/// means "no cap is anywhere near exhaustion" and 0.0 means "at least one
/// dimension is fully spent". The TS engine uses `Math.min(...ratios)` so the
/// most-constrained dimension wins.
pub fn budget_ratio(limits: &BudgetLimitsInput, used: &BudgetUsedInput) -> f64 {
    let mut min_ratio = 1.0_f64;
    // tokens
    if limits.max_tokens.is_finite() && limits.max_tokens > 0.0 {
        let rem = (limits.max_tokens - used.used_tokens).max(0.0);
        min_ratio = min_ratio.min(rem / limits.max_tokens);
    }
    // cost
    if limits.max_cost_usd.is_finite() && limits.max_cost_usd > 0.0 {
        let rem = (limits.max_cost_usd - used.used_cost_usd).max(0.0);
        min_ratio = min_ratio.min(rem / limits.max_cost_usd);
    }
    // duration is always bounded
    if limits.max_duration_ms > 0.0 {
        let rem = (limits.max_duration_ms - used.used_duration_ms).max(0.0);
        min_ratio = min_ratio.min(rem / limits.max_duration_ms);
    }
    // tool calls
    if limits.max_tool_calls.is_finite() && limits.max_tool_calls > 0.0 {
        let rem = (limits.max_tool_calls - used.used_tool_calls).max(0.0);
        min_ratio = min_ratio.min(rem / limits.max_tool_calls);
    }
    // model calls
    if limits.max_model_calls.is_finite() && limits.max_model_calls > 0.0 {
        let rem = (limits.max_model_calls - used.used_model_calls).max(0.0);
        min_ratio = min_ratio.min(rem / limits.max_model_calls);
    }
    min_ratio.clamp(0.0, 1.0)
}

/// Mirrors `BudgetEngine.phase()`. Returns a small int so the FFI can pack
/// it into a `c_int` without allocating a string:
///   0 = exhausted, 1 = verify, 2 = cheap, 3 = reduced, 4 = full.
pub fn budget_phase_code(ratio: f64) -> c_int {
    if ratio <= 0.0 {
        0 // exhausted
    } else if ratio <= 0.05 {
        1 // verify
    } else if ratio <= 0.25 {
        2 // cheap
    } else if ratio <= 0.5 {
        3 // reduced
    } else {
        4 // full
    }
}

#[cfg(test)]
mod snapshot_tests {
    use super::*;

    fn lim() -> BudgetLimitsInput {
        BudgetLimitsInput {
            max_tokens: 1000.0,
            max_cost_usd: 1.0,
            max_duration_ms: 60_000.0,
            max_tool_calls: 20.0,
            max_model_calls: 10.0,
        }
    }

    #[test]
    fn ratio_full_when_nothing_used() {
        let used = BudgetUsedInput {
            used_tokens: 0.0,
            used_cost_usd: 0.0,
            used_duration_ms: 0.0,
            used_tool_calls: 0.0,
            used_model_calls: 0.0,
        };
        assert!((budget_ratio(&lim(), &used) - 1.0).abs() < 1e-9);
        assert_eq!(budget_phase_code(budget_ratio(&lim(), &used)), 4);
    }

    #[test]
    fn ratio_uses_min_of_all_dimensions() {
        // tokens 50% remaining, cost 50%, duration 10% — min should be 10%.
        let used = BudgetUsedInput {
            used_tokens: 500.0,
            used_cost_usd: 0.5,
            used_duration_ms: 54_000.0,
            used_tool_calls: 0.0,
            used_model_calls: 0.0,
        };
        let r = budget_ratio(&lim(), &used);
        assert!((r - 0.1).abs() < 1e-9, "expected 0.1 got {r}");
        assert_eq!(budget_phase_code(r), 2); // cheap (<= 0.25)
    }

    #[test]
    fn ratio_exhausted_when_overspent() {
        let used = BudgetUsedInput {
            used_tokens: 2000.0, // over the 1000 cap
            used_cost_usd: 0.0,
            used_duration_ms: 0.0,
            used_tool_calls: 0.0,
            used_model_calls: 0.0,
        };
        let r = budget_ratio(&lim(), &used);
        assert_eq!(r, 0.0);
        assert_eq!(budget_phase_code(r), 0); // exhausted
    }

    #[test]
    fn infinite_caps_ignored() {
        // No token / cost / tool-call / model-call caps → only duration matters.
        let l = BudgetLimitsInput {
            max_tokens: f64::INFINITY,
            max_cost_usd: f64::INFINITY,
            max_duration_ms: 60_000.0,
            max_tool_calls: f64::INFINITY,
            max_model_calls: f64::INFINITY,
        };
        let used = BudgetUsedInput {
            used_tokens: 999_999.0,
            used_cost_usd: 999.0,
            used_duration_ms: 30_000.0,
            used_tool_calls: 999.0,
            used_model_calls: 999.0,
        };
        let r = budget_ratio(&l, &used);
        assert!((r - 0.5).abs() < 1e-9);
    }

    #[test]
    fn phase_thresholds_match_ts() {
        // Mirrors TS `if (r <= 0) exhausted; if (r <= 0.05) verify;
        // if (r <= 0.25) cheap; if (r <= 0.5) reduced; else full`.
        assert_eq!(budget_phase_code(0.0), 0);
        assert_eq!(budget_phase_code(0.04), 1);
        assert_eq!(budget_phase_code(0.05), 1); // <= 0.05 → verify
        assert_eq!(budget_phase_code(0.06), 2); // just over → cheap
        assert_eq!(budget_phase_code(0.10), 2);
        assert_eq!(budget_phase_code(0.25), 2);
        assert_eq!(budget_phase_code(0.26), 3);
        assert_eq!(budget_phase_code(0.5), 3);
        assert_eq!(budget_phase_code(0.51), 4);
        assert_eq!(budget_phase_code(1.0), 4);
    }

    #[test]
    fn zero_caps_do_not_panic() {
        let l = BudgetLimitsInput {
            max_tokens: 0.0,
            max_cost_usd: 0.0,
            max_duration_ms: 0.0,
            max_tool_calls: 0.0,
            max_model_calls: 0.0,
        };
        let used = BudgetUsedInput {
            used_tokens: 0.0,
            used_cost_usd: 0.0,
            used_duration_ms: 0.0,
            used_tool_calls: 0.0,
            used_model_calls: 0.0,
        };
        // All caps are zero — the engine treats this as "no constraint
        // applied" (matches TS: `Number.isFinite(...) && > 0.0` check).
        // Ratio should stay at 1.0 (no cap fires).
        let r = budget_ratio(&l, &used);
        assert!((r - 1.0).abs() < 1e-9);
    }

    #[test]
    fn duration_caps_always_apply() {
        // duration has no `is_finite` gate in TS — it always participates.
        let l = BudgetLimitsInput {
            max_tokens: f64::INFINITY,
            max_cost_usd: f64::INFINITY,
            max_duration_ms: 1000.0,
            max_tool_calls: f64::INFINITY,
            max_model_calls: f64::INFINITY,
        };
        let used = BudgetUsedInput {
            used_tokens: 0.0,
            used_cost_usd: 0.0,
            used_duration_ms: 500.0,
            used_tool_calls: 0.0,
            used_model_calls: 0.0,
        };
        let r = budget_ratio(&l, &used);
        assert!((r - 0.5).abs() < 1e-9);
    }
}
