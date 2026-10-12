import{r as f,j as e,c as w,A as c,M as k,F as T}from"./anim-CjYMM8cT.js";import{I as S,f as j,c as C,l as A}from"./icons-BKw22Rf2.js";const u={"native/mochi_core/src/lib.rs":{path:"native/mochi_core/src/lib.rs",name:"lib.rs",dir:"native/mochi_core/src",lang:"rust",size:"15.7 KB",lines:506,desc:"Zero-dependency compiled native crate with N-API bindings & fast BPE token estimation",code:`//! Mochi Core Native Rust Engine
//! Complete native runtime architecture for agent orchestration, streaming, fuzzy matching, search, git, PTY, tokenizer, SQLite, and data handling.

pub mod acp;
pub mod agent_loop;
pub mod autopsy;
pub mod budget;
pub mod codegraph;
pub mod cmdprobe;
pub mod context;
pub mod daemon;
pub mod diff;
pub mod fold;
pub mod fuzzy;
pub mod git;
pub mod http_client;
pub mod kv_cache;
pub mod mcp_gateway;
pub mod memory_index;
pub mod patch_engine;
pub mod planner;
pub mod pty_manager;
pub mod redact;
pub mod repo;
pub mod risk;
pub mod search;
pub mod skills;
pub mod speculative_decoder;
pub mod stream;
pub mod symbol_analyzer;
pub mod tokenizer;
pub mod tokens;
pub mod tui_renderer;
pub mod tui_state;
pub mod verification;
pub mod napi;

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};
use std::path::Path;
use std::slice;

pub use acp::*;
pub use agent_loop::*;
pub use autopsy::*;
pub use budget::*;
pub use codegraph::*;
pub use cmdprobe::*;
pub use context::*;
pub use daemon::*;
pub use diff::*;
pub use fold::*;
pub use fuzzy::*;
pub use git::*;
pub use http_client::*;
pub use kv_cache::*;
pub use mcp_gateway::*;
pub use memory_index::*;
pub use patch_engine::*;
pub use planner::*;
pub use pty_manager::*;
pub use redact::*;
pub use repo::*;
pub use risk::*;
pub use search::*;
pub use skills::*;
pub use speculative_decoder::*;
pub use stream::*;
pub use symbol_analyzer::*;
pub use tokenizer::*;
pub use tokens::*;
pub use tui_renderer::*;
pub use tui_state::*;
pub use verification::*;

// ============================================================================
// C-ABI FFI Exports (Callable from Node & Bun in-process)
// ============================================================================

#[no_mangle]
pub unsafe extern "C" fn mochi_fuzzy_match(
    text_ptr: *const c_char,
    needle_ptr: *const c_char,
    out_start: *mut usize,
    out_end: *mut usize,
) -> c_int {
    if text_ptr.is_null() || needle_ptr.is_null() || out_start.is_null() || out_end.is_null() {
        return -1;
    }
    let Ok(text) = (unsafe { CStr::from_ptr(text_ptr) }).to_str() else {
        return -1;
    };
    let Ok(needle) = (unsafe { CStr::from_ptr(needle_ptr) }).to_str() else {
        return -1;
    };

    if let Some((start, end)) = fuzzy::fuzzy_find_unique(text, needle) {
        unsafe {
            *out_start = start;
            *out_end = end;
        }
        1 // Matched uniquely
    } else {
        0 // No match or ambiguous
    }
}

#[no_mangle]
pub unsafe extern "C" fn mochi_git_branch(
    dir_ptr: *const c_char,
    out_buf: *mut c_char,
    out_cap: usize,
) -> c_int {
    if dir_ptr.is_null() || out_buf.is_null() || out_cap == 0 {
        return -1;
    }
    let Ok(dir_str) = (unsafe { CStr::from_ptr(dir_ptr) }).to_str() else {
        return -1;
    };
    let p = Path::new(dir_str);

    if let Some(branch) = git::fast_git_branch(p) {
        if let Ok(c_branch) = CString::new(branch) {
            let bytes = c_branch.as_bytes_with_nul();
            if bytes.len() <= out_cap {
                let dst = unsafe { slice::from_raw_parts_mut(out_buf as *mut u8, bytes.len()) };
                dst.copy_from_slice(bytes);
                return (bytes.len() - 1) as c_int;
            }
        }
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn mochi_search(
    dir_ptr: *const c_char,
    query_ptr: *const c_char,
    glob_ptr: *const c_char,
    limit: usize,
    out_buf: *mut c_char,
    out_cap: usize,
) -> c_int {
    if dir_ptr.is_null() || query_ptr.is_null() || out_buf.is_null() || out_cap == 0 {
        return -1;
    }
    let Ok(dir_str) = (unsafe { CStr::from_ptr(dir_ptr) }).to_str() else {
        return -1;
    };
    let Ok(query_str) = (unsafe { CStr::from_ptr(query_ptr) }).to_str() else {
        return -1;
    };
    let glob_str = if glob_ptr.is_null() {
        ""
    } else {
        (unsafe { CStr::from_ptr(glob_ptr) }).to_str().unwrap_or("")
    };

    let result = search::search_directory(Path::new(dir_str), query_str, glob_str, limit);
    if let Ok(c_res) = CString::new(result) {
        let bytes = c_res.as_bytes_with_nul();
        let copy_len = bytes.len().min(out_cap);
        let dst = unsafe { slice::from_raw_parts_mut(out_buf as *mut u8, copy_len) };
        dst.copy_from_slice(&bytes[..copy_len]);
        if copy_len > 0 {
            dst[copy_len - 1] = 0; // Null terminate
        }
        return (copy_len - 1) as c_int;
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn mochi_strip_think_tags(
    text_ptr: *const c_char,
    out_buf: *mut c_char,
    out_cap: usize,
) -> c_int {
    if text_ptr.is_null() || out_buf.is_null() || out_cap == 0 {
        return -1;
    }
    let Ok(text) = (unsafe { CStr::from_ptr(text_ptr) }).to_str() else {
        return -1;
    };

    let stripped = stream::strip_think_tags_native(text);
    if let Ok(c_res) = CString::new(stripped) {
        let bytes = c_res.as_bytes_with_nul();
        let copy_len = bytes.len().min(out_cap);
        let dst = unsafe { slice::from_raw_parts_mut(out_buf as *mut u8, copy_len) };
        dst.copy_from_slice(&bytes[..copy_len]);
        if copy_len > 0 {
            dst[copy_len - 1] = 0;
        }
        return (copy_len - 1) as c_int;
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn mochi_hash_prompt(
    data_ptr: *const u8,
    data_len: usize,
) -> u64 {
    if data_ptr.is_null() || data_len == 0 {
        return 0;
    }
    let slice = unsafe { slice::from_raw_parts(data_ptr, data_len) };
    tokens::fnv1a_64_hash(slice)
}

#[no_mangle]
pub unsafe extern "C" fn mochi_redact_secrets(
    input_ptr: *const c_char,
    out_buf: *mut c_char,
    out_cap: usize,
) -> c_int {
    if input_ptr.is_null() || out_buf.is_null() || out_cap == 0 {
        return -1;
    }
    let Ok(input) = (unsafe { CStr::from_ptr(input_ptr) }).to_str() else {
        return -1;
    };
    let redacted = redact::redact_secrets(input);
    let c_res = match CString::new(redacted) {
        Ok(s) => s,
        Err(_) => return -1,
    };
    let bytes = c_res.as_bytes_with_nul();
    let copy_len = bytes.len().min(out_cap);
    let dst = unsafe { slice::from_raw_parts_mut(out_buf as *mut u8, copy_len) };
    dst.copy_from_slice(&bytes[..copy_len]);
    if copy_len > 0 {
        dst[copy_len - 1] = 0;
    }
    // Return the required length (excluding the NUL) so the caller can detect
    // truncation and retry with a bigger buffer.
    (c_res.as_bytes().len()) as c_int
}

/// Per-turn budget ratio: most-constrained dimension wins. Returns ratio in
/// [0, 1]. JSON in: {"limits":{t,c,d,tc,mc},"used":{t,c,d,tc,mc}} where
/// non-finite values are encoded as \`null\` (matches the JS Number.POSITIVE_INFINITY
/// convention). NaN/Inf in the JSON are also accepted as "no cap".
/// JSON out: {"ratio":0.5,"phase":3} (phase: 0=exhausted,1=verify,2=cheap,3=reduced,4=full).
#[no_mangle]
pub unsafe extern "C" fn mochi_budget_decide(
    input_ptr: *const c_char,
    out_buf: *mut c_char,
    out_cap: usize,
) -> c_int {
    if input_ptr.is_null() || out_buf.is_null() || out_cap == 0 {
        return -1;
    }
    let Ok(input) = (unsafe { CStr::from_ptr(input_ptr) }).to_str() else {
        return -1;
    };

    // Minimal JSON extractor — only the fields we need, no full parser dep.
    let limits = budget::BudgetLimitsInput {
        max_tokens: json_f64(input, &["limits", "maxTokens"]).unwrap_or(f64::NAN),
        max_cost_usd: json_f64(input, &["limits", "maxCostUsd"]).unwrap_or(f64::NAN),
        max_duration_ms: json_f64(input, &["limits", "maxDurationMs"]).unwrap_or(0.0),
        max_tool_calls: json_f64(input, &["limits", "maxToolCalls"]).unwrap_or(f64::NAN),
        max_model_calls: json_f64(input, &["limits", "maxModelCalls"]).unwrap_or(f64::NAN),
    };
    let used = budget::BudgetUsedInput {
        used_tokens: json_f64(input, &["used", "usedTokens"]).unwrap_or(0.0),
        used_cost_usd: json_f64(input, &["used", "usedCostUsd"]).unwrap_or(0.0),
        used_duration_ms: json_f64(input, &["used", "usedDurationMs"]).unwrap_or(0.0),
        used_tool_calls: json_f64(input, &["used", "usedToolCalls"]).unwrap_or(0.0),
        used_model_calls: json_f64(input, &["used", "usedModelCalls"]).unwrap_or(0.0),
    };
    let ratio = budget::budget_ratio(&limits, &used);
    let phase = budget::budget_phase_code(ratio);

    let payload = format!(r#"{{"ratio":{},"phase":{}}}"#, ratio, phase);
    let c_res = match CString::new(payload) {
        Ok(s) => s,
        Err(_) => return -1,
    };
    let bytes = c_res.as_bytes_with_nul();
    let copy_len = bytes.len().min(out_cap);
    let dst = unsafe { slice::from_raw_parts_mut(out_buf as *mut u8, copy_len) };
    dst.copy_from_slice(&bytes[..copy_len]);
    if copy_len > 0 {
        dst[copy_len - 1] = 0;
    }
    (c_res.as_bytes().len()) as c_int
}

/// Walk a flat JSON object by key path and return the f64 value, or None
/// if the key is missing / null / not a number. Skips object/array braces
/// (string-aware) so embedded quotes don't confuse the parse.
fn json_f64(src: &str, path: &[&str]) -> Option<f64> {
    let mut s = src;
    for key in path {
        // Find "key":
        let needle = format!("\\"{}\\":", key);
        let pos = s.find(&needle)?;
        s = s[pos + needle.len()..].trim_start();
    }
    // Read the value: number, "null", or skip quoted string.
    if s.starts_with("null") {
        return None;
    }
    // Read up to first non-numeric terminator
    let bytes = s.as_bytes();
    let mut end = 0usize;
    let mut seen_digit = false;
    while end < bytes.len() {
        let b = bytes[end];
        if (b'0'..=b'9').contains(&b) || matches!(b, b'.' | b'-' | b'+' | b'e' | b'E') {
            seen_digit = true;
            end += 1;
            continue;
        }
        break;
    }
    if !seen_digit {
        return None;
    }
    s[..end].parse::<f64>().ok()
}

/// Classify a shell command's risk. Returns 0=low, 1=network, 2=destructive.
#[no_mangle]
pub unsafe extern "C" fn mochi_classify_command(cmd_ptr: *const c_char) -> c_int {
    if cmd_ptr.is_null() {
        return 0;
    }
    let Ok(cmd) = (unsafe { CStr::from_ptr(cmd_ptr) }).to_str() else {
        return 0;
    };
    risk::classify_command(cmd) as c_int
}

/// JSON in:  \`{"command":"...","cwd":"...","pathEnv":"..."}\`
/// JSON out: \`{"available":true,"bin":"..."}\` — bin is the resolved program name
/// (e.g. \`npm\` for \`npx X\`, \`cargo\` for \`cargo build\`).
#[no_mangle]
pub unsafe extern "C" fn mochi_command_available(
    input_ptr: *const c_char,
    out_buf: *mut c_char,
    out_cap: usize,
) -> c_int {
    if input_ptr.is_null() || out_buf.is_null() || out_cap == 0 {
        return -1;
    }
    let Ok(input) = (unsafe { CStr::from_ptr(input_ptr) }).to_str() else {
        return -1;
    };
    let command = fold::json_string_field(input, "command").unwrap_or_default();
    let cwd = fold::json_string_field(input, "cwd").unwrap_or_default();
    let path_env = fold::json_string_field(input, "pathEnv").unwrap_or_default();
    let (available, bin) = cmdprobe::command_available(&command, &cwd, &path_env);
    let payload = format!(
        r#"{{"available":{},"bin":{}}}"#,
        if available { "true" } else { "false" },
        cmdprobe::json_escape_string(&bin)
    );
    let c_res = match CString::new(payload) {
        Ok(s) => s,
        Err(_) => return -1,
    };
    let bytes = c_res.as_bytes_with_nul();
    let copy_len = bytes.len().min(out_cap);
    let dst = unsafe { slice::from_raw_parts_mut(out_buf as *mut u8, copy_len) };
    dst.copy_from_slice(&bytes[..copy_len]);
    if copy_len > 0 {
        dst[copy_len - 1] = 0;
    }
    (c_res.as_bytes().len()) as c_int
}

/// Head+tail fold for tool output. JSON in: \`{"text":"...","maxLines":N,"maxBytes":N}\`.
/// JSON out: \`{"head":[...],"tail":[...],"omitted":N,"truncated":true|false,
/// "truncatedBy":"lines"|"bytes"|"none","totalLines":N,"totalBytes":N}\`.
#[no_mangle]
pub unsafe extern "C" fn mochi_fold_output(
    input_ptr: *const c_char,
    out_buf: *mut c_char,
    out_cap: usize,
) -> c_int {
    if input_ptr.is_null() || out_buf.is_null() || out_cap == 0 {
        return -1;
    }
    let Ok(input) = (unsafe { CStr::from_ptr(input_ptr) }).to_str() else {
        return -1;
    };
    let text = fold::json_string_field(input, "text").unwrap_or_default();
    let max_lines = fold::json_usize_field(input, "maxLines").unwrap_or(400);
    let max_bytes = fold::json_usize_field(input, "maxBytes").unwrap_or(20 * 1024);
    let json = fold::fold_output_json(&text, max_lines, max_bytes);
    let c_res = match CString::new(json) {
        Ok(s) => s,
        Err(_) => return -1,
    };
    let bytes = c_res.as_bytes_with_nul();
    let copy_len = bytes.len().min(out_cap);
    let dst = unsafe { slice::from_raw_parts_mut(out_buf as *mut u8, copy_len) };
    dst.copy_from_slice(&bytes[..copy_len]);
    if copy_len > 0 {
        dst[copy_len - 1] = 0;
    }
    (c_res.as_bytes().len()) as c_int
}

#[no_mangle]
pub unsafe extern "C" fn mochi_estimate_cost_usd(
    model_ptr: *const c_char,
    prompt_tokens: u64,
    completion_tokens: u64,
    cache_read_tokens: u64,
) -> f64 {
    let model = if model_ptr.is_null() {
        "default"
    } else {
        (unsafe { CStr::from_ptr(model_ptr) }).to_str().unwrap_or("default")
    };
    // Honor the "free" convention (matches \`src/budget.ts\` \`estimateCostUsd\`):
    // any model whose name contains "free" is treated as zero-cost.
    if model.to_ascii_lowercase().contains("free") {
        return 0.0;
    }
    let tracker = budget::BudgetTracker::default();
    tracker.estimate_cost(model, prompt_tokens, completion_tokens, cache_read_tokens)
}

#[no_mangle]
pub unsafe extern "C" fn mochi_diff_numstat(
    output_ptr: *const c_char,
    out_files: *mut usize,
    out_additions: *mut usize,
    out_deletions: *mut usize,
) -> c_int {
    if output_ptr.is_null() || out_files.is_null() || out_additions.is_null() || out_deletions.is_null() {
        return -1;
    }
    let Ok(output) = (unsafe { CStr::from_ptr(output_ptr) }).to_str() else {
        return -1;
    };
    let stats = diff::parse_diff_numstat(output);
    unsafe {
        *out_files = stats.files;
        *out_additions = stats.additions;
        *out_deletions = stats.deletions;
    }
    1
}

#[no_mangle]
pub unsafe extern "C" fn mochi_classify_prompt(prompt_ptr: *const c_char) -> c_int {
    if prompt_ptr.is_null() {
        return 0;
    }
    let Ok(prompt) = (unsafe { CStr::from_ptr(prompt_ptr) }).to_str() else {
        return 0;
    };
    match planner::PlanEngine::classify_prompt(prompt) {
        planner::TaskKind::CodeEdit => 1,
        planner::TaskKind::Investigation => 2,
        planner::TaskKind::Testing => 3,
        planner::TaskKind::Refactor => 4,
        planner::TaskKind::Architecture => 5,
        planner::TaskKind::OneShotAnswer => 6,
    }
}

#[no_mangle]
pub unsafe extern "C" fn mochi_strip_ansi(
    text_ptr: *const c_char,
    out_buf: *mut c_char,
    out_cap: usize,
) -> c_int {
    if text_ptr.is_null() || out_buf.is_null() || out_cap == 0 {
        return -1;
    }
    let Ok(text) = (unsafe { CStr::from_ptr(text_ptr) }).to_str() else {
        return -1;
    };

    let stripped = tokens::strip_ansi(text);
    if let Ok(c_res) = CString::new(stripped) {
        let bytes = c_res.as_bytes_with_nul();
        let copy_len = bytes.len().min(out_cap);
        let dst = unsafe { slice::from_raw_parts_mut(out_buf as *mut u8, copy_len) };
        dst.copy_from_slice(&bytes[..copy_len]);
        if copy_len > 0 {
            dst[copy_len - 1] = 0; // Null terminate
        }
        return (copy_len - 1) as c_int;
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn mochi_estimate_tokens(text_ptr: *const c_char) -> usize {
    if text_ptr.is_null() {
        return 0;
    }
    let Ok(text) = (unsafe { CStr::from_ptr(text_ptr) }).to_str() else {
        return 0;
    };
    tokens::estimate_tokens_approx(text)
}
`},"src/model-router.ts":{path:"src/model-router.ts",name:"model-router.ts",dir:"src",lang:"typescript",size:"5.1 KB",lines:139,desc:"Dynamic 3-tier model router & automatic failover cascade",code:`// Multi-Tier Model Router with automatic failover and exponential backoff.
//
// Tier 1 (fast/cheap): background tasks — memory extraction, commit messages,
//   AST summaries, grep post-processing. Uses the 'fast' model profile.
// Tier 2 (frontier): planning, code generation, multi-file refactors.
//   Uses the primary model or the 'coding'/'reasoning' profiles.
//
// When a request hits HTTP 429/503, the router retries with exponential backoff
// then cascades to failover providers if configured.

import type { ModelConfig, ModelProfile } from './types.js';

export type TaskTier = 'fast' | 'standard' | 'reasoning';


/** Classify a task by its description to select the right model tier. */
export function classifyTaskTier(taskTitle: string, taskRole?: string): TaskTier {
  const lower = (taskTitle + ' ' + (taskRole ?? '')).toLowerCase();

  // Background / auxiliary tasks → fast tier
  if (/memory|extract|summarize|commit message|index|outline|ast|format|lint|doc|comment/i.test(lower)) {
    return 'fast';
  }

  // High-complexity tasks → reasoning tier
  if (/architect|design|plan|algorithm|security|audit|review|refactor.*large|multi.*file|complex/i.test(lower)) {
    return 'reasoning';
  }

  return 'standard';
}

/** Resolve the effective model string for a given tier. */
export function resolveModel(config: ModelConfig, tier: TaskTier): string {
  const profiles = config.profiles;
  if (!profiles) return config.model;
  const profileMap: Record<TaskTier, ModelProfile> = {
    fast: 'fast',
    standard: 'coding',
    reasoning: 'reasoning',
  };
  return profiles[profileMap[tier]] ?? config.model;
}

/** Consecutive verification failures before the harness escalates to a
 *  stronger model tier (tried-and-failed work, not one flaky red). */
export const ESCALATE_AFTER_FAILURES = 3;

const ESCALATION_LADDER: TaskTier[] = ['fast', 'standard', 'reasoning'];

export interface EscalationDecision {
  tier: TaskTier;
  modelId: string;
}

/** Pure escalation decision: one step up the capability ladder after
 *  sustained verification failure — once per task, only to a *different*
 *  configured model (no-op when the next tier is unconfigured or identical,
 *  or already at the top). Callers reset the streak on any verify pass. */
export function nextEscalationTier(
  current: TaskTier,
  consecutiveFailures: number,
  alreadyEscalated: boolean,
  config: ModelConfig,
  currentModelId: string,
): EscalationDecision | null {
  if (alreadyEscalated || consecutiveFailures < ESCALATE_AFTER_FAILURES) return null;
  const idx = ESCALATION_LADDER.indexOf(current);
  if (idx < 0 || idx >= ESCALATION_LADDER.length - 1) return null;
  const tier = ESCALATION_LADDER[idx + 1];
  const modelId = resolveModel(config, tier);
  if (!modelId || modelId === currentModelId) return null;
  return { tier, modelId };
}

/** Exponential backoff helper. */
async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
}

/**
 * Wrap a model API call with exponential backoff + optional provider failover.
 * The caller provides a \`makeCall\` factory that receives a ModelConfig and
 * target model string. On 429/503, it retries after increasing delays; after
 * exhausting retries it cascades to each failover config in order.
 */
export async function withFailover<T>(
  primary: ModelConfig,
  tier: TaskTier,
  makeCall: (cfg: ModelConfig, model: string) => Promise<T>,
  retry: RetryConfig = {},
): Promise<T> {
  const maxRetries = retry.maxRetries ?? 3;
  const initialDelay = retry.initialDelayMs ?? 1000;
  const factor = retry.backoffFactor ?? 2;

  const configs: ModelConfig[] = [primary, ...(primary.failover ?? [])];

  for (let ci = 0; ci < configs.length; ci++) {
    const cfg = configs[ci];
    const model = resolveModel(cfg, tier);
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await makeCall(cfg, model);
      } catch (err: any) {
        const msg = (err?.message ?? String(err)).toLowerCase();
        const isRateLimit = err?.status === 429 || err?.status === 503 ||
          msg.includes('rate limit') || msg.includes('429') || msg.includes('503') ||
          msg.includes('quota') || msg.includes('overloaded');

        // Not a retriable error — if there are more providers, fall through
        if (!isRateLimit) {
          if (ci < configs.length - 1) break; // try next provider
          throw err; // no more fallbacks
        }

        if (attempt === maxRetries) {
          if (ci < configs.length - 1) break; // cascade to next provider
          throw new Error(\`All \${configs.length} provider(s) exhausted after rate limiting. Last error: \${err.message}\`);
        }

        // Rate limited — wait and retry on the same provider
        console.warn(\`[router] \${cfg.provider} rate-limited (attempt \${attempt + 1}/\${maxRetries}), retrying in \${delay}ms…\`);
        await sleep(delay);
        delay = Math.min(delay * factor, 30_000);
      }
    }
  }

  throw new Error('Model router: all providers failed');
}
`},"src/tools/edit.ts":{path:"src/tools/edit.ts",name:"edit.ts",dir:"src/tools",lang:"typescript",size:"7.0 KB",lines:167,desc:"Surgical AST diff engine & whitespace-tolerant replacement",code:`import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import type { Tool } from './types.js';
import { markMutation } from './fs-signal.js';
import { fuzzyFindUniqueNative as fuzzyFindUnique } from './native-match.js';
import { validateFileSyntax } from '../core/ast-guard.js';

function trimIndent(text: string): string {
  const lines = text.split('\\n');
  if (lines[0]?.trim() === '') lines.shift();
  if (lines[lines.length - 1]?.trim() === '') lines.pop();
  const indent = lines.reduce((min, line) => {
    const m = line.match(/^(\\s*)/);
    if (line.trim() === '') return min;
    return Math.min(min, m ? m[1].length : 0);
  }, Infinity);
  if (indent === Infinity || indent === 0) return text;
  return lines.map((l) => l.slice(indent)).join('\\n');
}

/**
 * Strips line numbers like '   1 | ', '1 | ', '12: ', '  12: ' that models
 * frequently copy directly from the \`read\` tool output into oldText/newText.
 */
export function stripLineNumberGutter(text: string): string {
  const lines = text.split('\\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return text;
  const isNumbered = nonEmpty.every((l) => /^\\s*\\d+\\s*[|:]\\s?/.test(l));
  if (!isNumbered) return text;
  return lines.map((l) => l.replace(/^\\s*\\d+\\s*[|:]\\s?/, '')).join('\\n');
}

export function normalizeRelaxedLine(line: string): string {
  return line
    .trim()
    .replace(/["'\`]/g, '"')
    .replace(/;+$/, '')
    .replace(/\\s+/g, ' ');
}

export function findRelaxedUnique(text: string, needle: string): { start: number; end: number } | null {
  if (needle.trim() === '') return null;
  const textLines = text.split('\\n');
  const needleLines = needle.replace(/\\r\\n/g, '\\n').split('\\n');
  while (needleLines.length && needleLines[0].trim() === '') needleLines.shift();
  while (needleLines.length && needleLines[needleLines.length - 1].trim() === '') needleLines.pop();
  if (needleLines.length === 0) return null;

  const normNeedle = needleLines.map(normalizeRelaxedLine);
  const normText = textLines.map(normalizeRelaxedLine);

  const matches: { start: number; end: number }[] = [];
  for (let i = 0; i + normNeedle.length <= normText.length; i++) {
    let ok = true;
    for (let j = 0; j < normNeedle.length; j++) {
      if (normText[i + j] !== normNeedle[j]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    let start = 0;
    for (let k = 0; k < i; k++) start += textLines[k].length + 1;
    let end = start;
    for (let k = i; k < i + normNeedle.length; k++) end += textLines[k].length + 1;
    matches.push({ start, end: Math.max(start, end - 1) });
  }

  if (matches.length === 1) return matches[0];
  return null;
}

export const editTool: Tool = {
  def: {
    name: 'edit',
    description: 'Replace an exact block of text in a file with new text. Prefer small, targeted patches.',
    parameters: [
      { name: 'path', type: 'string', description: 'Relative or absolute file path', required: true },
      { name: 'oldText', type: 'string', description: 'Exact text to replace', required: true },
      { name: 'newText', type: 'string', description: 'Replacement text', required: true },
      { name: 'trim', type: 'boolean', description: 'Trim leading/trailing blank lines and common indent from newText', required: false },
    ],
    permission: 'write',
  },
  async execute(args, ctx) {
    const rawPath = String(args.path ?? '');
    let oldText = String(args.oldText ?? '');
    let newText = String(args.newText ?? '');
    if (args.trim) newText = trimIndent(newText);
    const fullPath = rawPath === '~' ? homedir() : rawPath.startsWith('~/') ? resolve(homedir(), rawPath.slice(2)) : resolve(ctx.cwd, rawPath);
    if (!existsSync(fullPath)) throw new Error(\`File not found: \${rawPath}\`);
    let content = readFileSync(fullPath, 'utf8');
    const original = content;
    let usedFuzzy = false;

    // Auto-strip line numbers copied from \`read\` tool gutters (e.g. "   1 | ")
    const strippedOld = stripLineNumberGutter(oldText);
    if (strippedOld !== oldText) {
      if (content.includes(strippedOld) || fuzzyFindUnique(content, strippedOld)) {
        oldText = strippedOld;
        newText = stripLineNumberGutter(newText);
      }
    }

    if (!content.includes(oldText)) {
      // Try without trailing newline differences
      oldText = oldText.replace(/\\r\\n/g, '\\n');
      if (!content.includes(oldText)) {
        // Try stripping line numbers again if only partly stripped
        const unnumbered = stripLineNumberGutter(oldText);
        if (content.includes(unnumbered)) {
          oldText = unnumbered;
          newText = stripLineNumberGutter(newText);
        } else {
          // Fuzzy fallback: match after whitespace normalization (indentation,
          // tabs-vs-spaces, trailing whitespace). Unique match only; ambiguity
          // stays an error so we never edit the wrong occurrence silently.
          let m = fuzzyFindUnique(content, oldText);
          if (!m && unnumbered !== oldText) {
            m = fuzzyFindUnique(content, unnumbered);
            if (m) newText = stripLineNumberGutter(newText);
          }
          if (!m) {
            // Relaxed quote and trailing semicolon matching fallback
            m = findRelaxedUnique(content, oldText);
            if (!m && unnumbered !== oldText) {
              m = findRelaxedUnique(content, unnumbered);
              if (m) newText = stripLineNumberGutter(newText);
            }
          }
          if (!m) throw new Error(\`oldText not found in \${rawPath} (exact and fuzzy match failed)\`);
          content = content.slice(0, m.start) + newText + content.slice(m.end);
          usedFuzzy = true;
        }
      }
    }
    if (!usedFuzzy) {
      // Ambiguity guard on the exact path too: "replace first occurrence"
      // silently edits a location the model may not have meant. Require a
      // unique target; tell the model to include more surrounding context.
      const count = content.split(oldText).length - 1;
      if (count > 1) {
        const lines: number[] = [];
        let idx = 0;
        while ((idx = content.indexOf(oldText, idx)) !== -1) {
          const lineNum = content.slice(0, idx).split('\\n').length;
          lines.push(lineNum);
          idx += oldText.length;
        }
        throw new Error(\`oldText matches \${count} locations in \${rawPath} (at lines \${lines.join(', ')}); include more surrounding context so it is unique\`);
      }
      content = content.replace(oldText, newText);
    }
    if (content === original) throw new Error(\`oldText was found but replacement did not change \${rawPath}\`);
    writeFileSync(fullPath, content);
    ctx.events.emit({ type: 'file:changed', path: fullPath, operation: 'edit', agentId: ctx.agentId });
    markMutation();
    const diag = validateFileSyntax(fullPath, content);
    let out = usedFuzzy ? \`Edited \${rawPath} (fuzzy match: whitespace/quote differences were tolerated)\` : \`Edited \${rawPath}\`;
    if (!diag.valid && diag.summary) {
      out += \`\\n⚠️ [AST Syntax Alert]: \${diag.summary}\`;
    }
    return out;
  },
};
`},"src/tools/patch.ts":{path:"src/tools/patch.ts",name:"patch.ts",dir:"src/tools",lang:"typescript",size:"8.4 KB",lines:183,desc:"Unified patch applicator with exact chunk rollback",code:`import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Tool } from './types.js';
import { markMutation } from './fs-signal.js';
import { fuzzyFindUniqueNative as fuzzyFindUnique } from './native-match.js';
import { validateFileSyntax } from '../core/ast-guard.js';

// Codex-style patch application. The model emits a compact, token-efficient
// patch format instead of full-file rewrites or fragile exact-match blocks:
//
//   *** Begin Patch
//   *** Add File: path/new.ts
//   +export const x = 1;
//   *** Update File: src/app.ts
//   @@ optional class def anchor
//    context line
//   -removed line
//   +added line
//   *** Delete File: old.ts
//   *** End Patch
//
// Update hunks apply via context matching: each hunk's surrounding context
// lines locate the region (exact first, then whitespace-normalized fuzzy),
// then the -/+ lines are applied relative to that location. This is the same
// reliability story as git apply with a lenient matcher: small whitespace
// drift in remembered context does not fail the patch.

interface HunkLine {
  kind: 'ctx' | 'del' | 'add';
  text: string;
}

interface FilePatch {
  op: 'add' | 'update' | 'delete';
  path: string;
  anchor?: string; // text after @@ (optional, informational + search hint)
  lines: HunkLine[];
}

export function parsePatch(patch: string): FilePatch[] {
  const raw = patch.replace(/\\r\\n/g, '\\n').split('\\n');
  let i = 0;
  // Skip leading lines before Begin Patch (prose like "Here is the patch:").
  const hasBegin = raw.some((l) => l.trim() === '*** Begin Patch');
  if (hasBegin) {
    while (i < raw.length && raw[i].trim() !== '*** Begin Patch') i++;
    i++;
  } else {
    while (i < raw.length && !raw[i].startsWith('*** ')) i++;
    if (i === raw.length) throw new Error('Patch is missing "*** Begin Patch" or valid patch directives');
  }

  const patches: FilePatch[] = [];
  let cur: FilePatch | null = null;
  for (; i < raw.length; i++) {
    const line = raw[i];
    if (line.startsWith('*** End Patch')) break;
    if (line.startsWith('*** Add File: ')) {
      cur = { op: 'add', path: line.slice('*** Add File: '.length).trim(), lines: [] };
      patches.push(cur);
    } else if (line.startsWith('*** Update File: ')) {
      cur = { op: 'update', path: line.slice('*** Update File: '.length).trim(), lines: [] };
      patches.push(cur);
    } else if (line.startsWith('*** Delete File: ')) {
      cur = { op: 'delete', path: line.slice('*** Delete File: '.length).trim(), lines: [] };
      patches.push(cur);
    } else if (line.startsWith('*** ')) {
      throw new Error(\`Unknown patch directive: \${line}\`);
    } else if (line.startsWith('@@') && cur && cur.op === 'update') {
      cur.anchor = line.slice(2).trim();
    } else if (cur) {
      if (line.startsWith('+')) cur.lines.push({ kind: 'add', text: line.slice(1) });
      else if (line.startsWith('-')) cur.lines.push({ kind: 'del', text: line.slice(1) });
      else if (line.startsWith(' ')) cur.lines.push({ kind: 'ctx', text: line.slice(1) });
      else if (line.trim() === '') cur.lines.push({ kind: 'ctx', text: '' });
      else throw new Error(\`Malformed patch line (expected +, -, space, or ***): \${line}\`);
    }
    // Lines before any file directive are ignored.
  }

  if (patches.length === 0) throw new Error('Patch contains no file sections');
  return patches;
}

/** Apply one update hunk to file lines. Returns the new full line array. */
function applyHunk(fileLines: string[], hunk: HunkLine[]): string[] {
  // Build the search block from the hunk's context + deleted lines.
  const searchLines = hunk.filter((l) => l.kind !== 'add').map((l) => l.text);
  if (searchLines.length === 0) {
    // Pure insertion with no context: append at end.
    return [...fileLines, ...hunk.filter((l) => l.kind === 'add').map((l) => l.text)];
  }
  const search = searchLines.join('\\n');
  const text = fileLines.join('\\n');
  const exact = text.includes(search) ? { start: text.indexOf(search), end: text.indexOf(search) + search.length } : fuzzyFindUnique(text, search);
  if (!exact) throw new Error(\`Could not locate patch context in file. Context: \${search.slice(0, 120)}\`);
  const startLine = text.slice(0, exact.start).split('\\n').length - 1;
  const endLine = text.slice(0, exact.end).split('\\n').length - 1;

  const out: string[] = [];
  for (let i = 0; i < startLine; i++) out.push(fileLines[i]);
  for (const l of hunk) {
    if (l.kind === 'add') out.push(l.text);
    // del + ctx lines from the hunk replace the located region; ctx lines are
    // re-emitted from the hunk so any whitespace normalization is applied.
  }
  for (let i = endLine + 1; i < fileLines.length; i++) out.push(fileLines[i]);
  return out;
}

export function applyFilePatch(source: string, fp: FilePatch): string {
  const lines = source.split('\\n');
  let result = lines;
  // Group consecutive non-add runs into hunks at pure-add boundaries... simpler:
  // apply the whole section as a single hunk when it contains ctx/del lines,
  // otherwise it is an append-style insertion.
  const hasCtxOrDel = fp.lines.some((l) => l.kind !== 'add');
  if (hasCtxOrDel) {
    result = applyHunk(lines, fp.lines);
  } else {
    // Pure additions: insert before the final empty line (EOF newline) if present.
    const adds = fp.lines.map((l) => l.text);
    if (result.length && result[result.length - 1] === '') result.splice(result.length - 1, 0, ...adds);
    else result = [...result, ...adds];
  }
  return result.join('\\n');
}

export const patchTool: Tool = {
  def: {
    name: 'patch',
    description:
      'Apply a Codex-style patch to multiple files in one call. Format: "*** Begin Patch", then sections "*** Add File: <path>" (lines prefixed +), "*** Update File: <path>" (context lines start with a space, removals with -, additions with +, optional @@ anchor), "*** Delete File: <path>", ending with "*** End Patch". Updates match context exactly first, then tolerantly (whitespace-insensitive), so minor indentation drift still applies.',
    parameters: [
      { name: 'patch', type: 'string', description: 'The full patch text between *** Begin Patch and *** End Patch', required: true },
    ],
    permission: 'write',
  },
  async execute(args, ctx) {
    const patchText = String(args.patch ?? '');
    const patches = parsePatch(patchText);
    const results: string[] = [];

    for (const fp of patches) {
      const fullPath = resolve(ctx.cwd, fp.path);
      if (fp.op === 'add') {
        if (existsSync(fullPath)) throw new Error(\`*** Add File: \${fp.path} already exists\`);
        mkdirSync(dirname(fullPath), { recursive: true });
        const content = fp.lines.filter((l) => l.kind === 'add').map((l) => l.text).join('\\n');
        const finalContent = content.endsWith('\\n') || content === '' ? content : content + '\\n';
        writeFileSync(fullPath, finalContent);
        ctx.events.emit({ type: 'file:changed', path: fullPath, operation: 'write', agentId: ctx.agentId });
        const diag = validateFileSyntax(fullPath, finalContent);
        if (!diag.valid && diag.summary) {
          results.push(\`added \${fp.path} (\${fp.lines.length} lines) ⚠️ [AST Syntax Alert]: \${diag.summary}\`);
        } else {
          results.push(\`added \${fp.path} (\${fp.lines.length} lines)\`);
        }
      } else if (fp.op === 'delete') {
        if (!existsSync(fullPath)) throw new Error(\`*** Delete File: \${fp.path} not found\`);
        rmSync(fullPath);
        ctx.events.emit({ type: 'file:changed', path: fullPath, operation: 'delete', agentId: ctx.agentId });
        results.push(\`deleted \${fp.path}\`);
      } else {
        if (!existsSync(fullPath)) throw new Error(\`*** Update File: \${fp.path} not found\`);
        const before = readFileSync(fullPath, 'utf8');
        const after = applyFilePatch(before, fp);
        if (after === before) throw new Error(\`Patch produced no change to \${fp.path}\`);
        writeFileSync(fullPath, after);
        ctx.events.emit({ type: 'file:changed', path: fullPath, operation: 'edit', agentId: ctx.agentId });
        const diag = validateFileSyntax(fullPath, after);
        if (!diag.valid && diag.summary) {
          results.push(\`updated \${fp.path} ⚠️ [AST Syntax Alert]: \${diag.summary}\`);
        } else {
          results.push(\`updated \${fp.path}\`);
        }
      }
      markMutation();
    }

    return \`Applied patch to \${patches.length} file(s):\\n\` + results.map((r) => \`- \${r}\`).join('\\n');
  },
};
`},"src/tui/tabs.ts":{path:"src/tui/tabs.ts",name:"tabs.ts",dir:"src/tui",lang:"typescript",size:"9.1 KB",lines:247,desc:"Multi-tab concurrent session manager & pill tab geometry",code:`// Multi-tab session manager (opencode-style): several isolated agent
// sessions live in ONE terminal. Each tab owns its title, runtime session,
// unread badge, and busy flag; transcripts/state objects are owned by the
// TUI layer keyed by tab id. This module is pure (no terminal, no runtime)
// so every rule below is unit-tested.
export interface TabInfo {
  id: string;
  title: string;
  /** 1-based position for Alt+1..9 display. */
  index: number;
  busy: boolean;
  unread: number;
  createdAt: number;
  lastActiveAt: number;
}

/** Hard cap: more parallel agent sessions than this melts small boxes. */
export const MAX_TABS = 8;

let tabSeq = 0;

export function defaultTabTitle(n: number): string {
  return n <= 1 ? 'New session' : \`New session \${n}\`;
}
/** Slug a tab title from the user's first prompt (24 cols, no newlines). */
export function slugTitle(prompt: string): string {
  const s = prompt.replace(/^\\/\\w+\\s*/, '').trim().split('\\n')[0].slice(0, 24).trim();
  return s || 'untitled';
}

export class TabManager {
  private tabs: TabInfo[] = [];
  private active = 0;
  private counter = 0;

  constructor() {
    this.create(defaultTabTitle(1));
  }

  list(): TabInfo[] {
    return this.tabs.map((t, i) => ({ ...t, index: i + 1 }));
  }

  activeTab(): TabInfo {
    return { ...this.tabs[this.active], index: this.active + 1 };
  }

  activeIndex(): number {
    return this.active;
  }

  count(): number {
    return this.tabs.length;
  }

  get(id: string): TabInfo | undefined {
    const i = this.tabs.findIndex((t) => t.id === id);
    return i < 0 ? undefined : { ...this.tabs[i], index: i + 1 };
  }

  create(title?: string): TabInfo {
    if (this.tabs.length >= MAX_TABS) {
      throw new Error(\`Tab limit reached (\${MAX_TABS}). Close one with Alt+W or /tab close first.\`);
    }
    this.counter++;
    const now = Date.now();
    const tab: TabInfo = {
      id: \`tab-\${now.toString(36)}-\${tabSeq++}\`,
      title: title?.trim() || defaultTabTitle(this.counter),
      index: this.tabs.length + 1,
      busy: false,
      unread: 0,
      createdAt: now,
      lastActiveAt: now,
    };
    this.tabs.push(tab);
    this.active = this.tabs.length - 1;
    return { ...tab };
  }

  /** Close by id or 0-based index. Never drops the last tab: closing it
   *  resets it to a fresh default instead. Returns the new active tab. */
  close(idOrIndex: string | number): TabInfo {
    const i = typeof idOrIndex === 'number' ? idOrIndex : this.tabs.findIndex((t) => t.id === idOrIndex);
    if (i < 0 || i >= this.tabs.length) throw new Error('No such tab.');
    if (this.tabs.length === 1) {
      const now = Date.now();
      this.counter++;
      this.tabs[0] = { ...this.tabs[0], title: defaultTabTitle(this.counter), busy: false, unread: 0, createdAt: now, lastActiveAt: now };
      this.active = 0;
      return this.activeTab();
    }
    this.tabs.splice(i, 1);
    if (this.active >= this.tabs.length) this.active = this.tabs.length - 1;
    else if (this.active > i) this.active--;
    this.tabs[this.active].lastActiveAt = Date.now();
    return this.activeTab();
  }

  switchTo(index: number): TabInfo {
    if (index < 0 || index >= this.tabs.length) throw new Error(\`Tab \${index + 1} does not exist (\${this.tabs.length} open).\`);
    this.active = index;
    this.tabs[index].unread = 0;
    this.tabs[index].lastActiveAt = Date.now();
    return this.activeTab();
  }

  switchToId(id: string): TabInfo {
    const i = this.tabs.findIndex((t) => t.id === id);
    if (i < 0) throw new Error('No such tab.');
    return this.switchTo(i);
  }

  next(): TabInfo {
    return this.switchTo((this.active + 1) % this.tabs.length);
  }

  prev(): TabInfo {
    return this.switchTo((this.active - 1 + this.tabs.length) % this.tabs.length);
  }

  rename(id: string, title: string): TabInfo {
    const t = this.tabs.find((x) => x.id === id);
    if (!t) throw new Error('No such tab.');
    const clean = title.trim().slice(0, 32);
    if (!clean) throw new Error('Title must not be empty.');
    t.title = clean;
    return { ...t, index: this.tabs.indexOf(t) + 1 };
  }

  /** Auto-title a default-named tab from the first user prompt (once). */
  autoTitle(id: string, prompt: string): boolean {
    const t = this.tabs.find((x) => x.id === id);
    if (!t || !/^(tab \\d+|New session( \\d+)?)$/.test(t.title)) return false;
    t.title = slugTitle(prompt);
    return true;
  }

  setBusy(id: string, busy: boolean): void {
    const t = this.tabs.find((x) => x.id === id);
    if (t) t.busy = busy;
  }

  /** A background tab produced output: badge it (active tab clears on view). */
  markUnread(id: string): void {
    const t = this.tabs.find((x) => x.id === id);
    if (t && this.tabs[this.active].id !== id && t.unread < 99) t.unread++;
  }

  clearUnread(id: string): void {
    const t = this.tabs.find((x) => x.id === id);
    if (t) t.unread = 0;
  }
}

// ---- Clickable tab-bar layout (opencode-style \`+\` button) ------------------
// Pure column math so mouse hit-testing matches the rendered row EXACTLY:
// the renderer styles these plain cells (ANSI = zero-width) and joins them
// with single spaces, so columns below are the source of truth for clicks.
// Widths are TERMINAL CELLS (CJK titles count 2), via wrap.ts.

import { visibleCells, sliceCells } from './wrap.js';

export interface TabBarCell {
  /** Tab id, or null for the \`+ New session\` button. */
  tabId: string | null;
  /** Plain (unstyled) cell text; width = visibleCells(plain) in cells.
   *  opencode-style pills: \` {title}{dots} \` — the renderer fills the
   *  active pill with a surface bg, idle pills stay dim text. */
  plain: string;
  /** 0-based index into tabs.list(), -1 for \`+\`. */
  tabIndex: number;
  /** Structured parts (renderer colors these; plain === ' '+title+unread+busy+' '). */
  title: string;
  unread: string;
  busy: string;
}

export interface TabBarLayout {
  cells: TabBarCell[];
  /** 0-based [start, end) column range per cell (parallel to cells). */
  ranges: Array<[number, number]>;
  /** Whether the key-hint suffix fits after the cells. */
  showHint: boolean;
  /** 0-based [start, end) column range of the \`+\` button (always present). */
  plusRange: [number, number];
  /** Total plain width including separators (excludes hint). */
  width: number;
}

/** Plain key-hint suffix (styled by the renderer; measured here). */
export const TAB_HINT_PLAIN = 'Alt+T new · Alt+W close · Alt+1-8 switch';

/** Build the tab-bar cells for a terminal width, truncating titles only as
 *  much as needed so bar + \`+ New session\` ALWAYS fit (no ellipsize-and-guess).
 *  Active-vs-idle styling is the renderer's job (it knows the active id);
 *  columns here are identical for both, so hit-testing stays exact. */
export function tabBarCells(list: TabInfo[], _activeId: string, maxWidth: number): TabBarLayout {
  const w = Math.max(8, maxWidth);
  const unreadOf = (t: TabInfo) => (t.unread > 0 ? ' •' : '');
  // Pill per tab: \` \` + title + unread-dot + busy-dot + \` \`, badges
  // space-separated (\` api • ● \`) — dots jammed on text read as typos.
  // Fixed overhead = 1 + unread + busy + 1.
  const fixedOf = (t: TabInfo) => 1 + unreadOf(t).length + (t.busy ? 2 : 0) + 1;
  // Fair-share title budget: shrink only titles that exceed it.
  const fixedSum = list.reduce((n, t) => n + fixedOf(t), 0);
  // Cells tile with NO separators: each tab cell carries its own symmetric
  // padding (\` {title}{dots} \`) and the \`+\` cell follows the last trailing
  // space directly. The renderer joins with '' so columns match exactly.
  const plusWidth = visibleCells('+ New session');
  let titleBudget = Math.floor((w - plusWidth - fixedSum) / Math.max(1, list.length));
  // Narrow terminals shrink titles to a bare '…' rather than overflowing:
  // the bar + \`+\` must ALWAYS fit so clicks stay exact.
  titleBudget = Math.max(1, titleBudget);
  const cells: TabBarCell[] = list.map((t, i) => {
    let title = t.title;
    if (visibleCells(title) > titleBudget) title = sliceCells(title, Math.max(0, titleBudget - 1)).text + '…';
    const unread = unreadOf(t);
    const busy = t.busy ? ' ●' : '';
    const plain = \` \${title}\${unread}\${busy} \`;
    return { tabId: t.id, plain, tabIndex: i, title, unread, busy };
  });
  cells.push({ tabId: null, plain: '+ New session', tabIndex: -1, title: '+ New session', unread: '', busy: '' });
  const ranges: Array<[number, number]> = [];
  let x = 0;
  cells.forEach((c) => {
    const cw = visibleCells(c.plain);
    ranges.push([x, x + cw]);
    x += cw;
  });
  const showHint = x + 1 + visibleCells(TAB_HINT_PLAIN) <= w;
  return { cells, ranges, showHint, plusRange: ranges[ranges.length - 1], width: x };
}

/** Hit-test a 0-based column against a layout: tab index, 'plus', or null
 *  (separators, hint, and empty space are not clickable). */
export function tabBarHit(layout: TabBarLayout, col: number): { kind: 'tab'; index: number } | { kind: 'plus' } | null {
  if (col < 0) return null;
  for (let i = 0; i < layout.cells.length; i++) {
    const [s, e] = layout.ranges[i];
    if (col >= s && col < e) {
      const c = layout.cells[i];
      return c.tabId === null ? { kind: 'plus' } : { kind: 'tab', index: c.tabIndex };
    }
  }
  return null;
}
`},"src/core/ast-guard.ts":{path:"src/core/ast-guard.ts",name:"ast-guard.ts",dir:"src/core",lang:"typescript",size:"14.4 KB",lines:425,desc:"AST invariant verifier ensuring parseability before and after mutations",code:`// In-Memory In-Turn AST Diagnostic Guard for Mochi
// Performs sub-millisecond static syntax and structural validation on file modifications
// before the agent completes its turn, enabling instant self-correction without running slow CLI test suites.

import { extname, dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

let _ts: typeof import('typescript') | null = null;
function getTsCompiler(): typeof import('typescript') | null {
  try {
    if (!_ts) _ts = createRequire(import.meta.url)('typescript') as typeof import('typescript');
    return _ts;
  } catch {
    return null;
  }
}

export interface ASTDiagnosticError {
  line: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface ASTDiagnosticResult {
  valid: boolean;
  errors: ASTDiagnosticError[];
  summary?: string;
}

/** Validates TypeScript / JavaScript source syntax using the TypeScript compiler AST parser */
export function validateTypeScriptSyntax(filePath: string, content: string): ASTDiagnosticResult {
  const ts = getTsCompiler();
  if (!ts) return { valid: true, errors: [] };

  try {
    const isTsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
    const isTs = filePath.endsWith('.ts') || filePath.endsWith('.mts') || filePath.endsWith('.cts');
    const kind = isTsx ? ts.ScriptKind.TSX : (isTs ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      kind
    );

    const rawDiags: unknown = (sourceFile as { parseDiagnostics?: unknown }).parseDiagnostics ?? [];
    const diags: Array<{ start?: number; messageText: unknown }> = Array.isArray(rawDiags) ? rawDiags : [];
    if (diags.length === 0) {
      return { valid: true, errors: [] };
    }

    const errors: ASTDiagnosticError[] = [];
    for (const d of diags) {
      const pos = d.start !== undefined ? sourceFile.getLineAndCharacterOfPosition(d.start) : { line: 0, character: 0 };
      const nested = d.messageText as { messageText?: unknown } | null | undefined;
      const msg = typeof d.messageText === 'string'
        ? d.messageText
        : (typeof nested?.messageText === 'string' ? nested.messageText : 'Syntax error');
      errors.push({
        line: pos.line + 1,
        column: pos.character + 1,
        message: msg,
        severity: 'error',
      });
    }

    const summary = errors.map((e) => \`Line \${e.line}: \${e.message}\`).join('; ');
    return {
      valid: errors.length === 0,
      errors,
      summary: errors.length > 0 ? summary : undefined,
    };
  } catch {
    return { valid: true, errors: [] };
  }
}

/**
 * Verifies that relative imports within TypeScript / JavaScript files exist on disk.
 * Catches hallucinated module paths before the agent finishes its turn.
 */
export function validateRelativeImports(filePath: string, content: string): ASTDiagnosticResult {
  const dir = dirname(filePath);
  const errors: ASTDiagnosticError[] = [];

  const importRegex = /(?:import|export)\\s+(?:[\\w*\\s{},]*\\s+from\\s+)?['"](\\.[^'"]+)['"]|require\\s*\\(\\s*['"](\\.[^'"]+)['"]\\s*\\)/g;
  const lines = content.split('\\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) continue;

    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(line)) !== null) {
      const importPath = match[1] || match[2];
      if (!importPath || !importPath.startsWith('.')) continue;

      const basePath = resolve(dir, importPath);
      const candidates = [
        basePath,
        basePath.replace(/\\.js$/, '.ts'),
        basePath.replace(/\\.mjs$/, '.mts'),
        basePath.replace(/\\.cjs$/, '.cts'),
        basePath.replace(/\\.jsx$/, '.tsx'),
        \`\${basePath}.ts\`,
        \`\${basePath}.tsx\`,
        \`\${basePath}.js\`,
        \`\${basePath}.jsx\`,
        \`\${basePath}.json\`,
        \`\${basePath}/index.ts\`,
        \`\${basePath}/index.tsx\`,
        \`\${basePath}/index.js\`,
      ];

      const exists = candidates.some((c) => existsSync(c));
      if (!exists) {
        errors.push({
          line: i + 1,
          message: \`Cannot find module '\${importPath}' relative to \${filePath}\`,
          severity: 'warning',
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: errors.length > 0 ? errors.map((e) => \`Line \${e.line}: \${e.message}\`).join('; ') : undefined,
  };
}

/** Validates JSON syntax and isolates exact error line */
export function validateJSON(content: string): ASTDiagnosticResult {
  try {
    JSON.parse(content);
    return { valid: true, errors: [] };
  } catch (err: any) {
    const msg = String(err.message || 'JSON Parse error');
    let line = 1;
    const posMatch = msg.match(/position\\s+(\\d+)/i);
    if (posMatch) {
      const pos = Number(posMatch[1]);
      line = content.slice(0, pos).split('\\n').length;
    } else {
      const lineMatch = msg.match(/line\\s+(\\d+)/i);
      if (lineMatch) line = Number(lineMatch[1]);
    }
    return {
      valid: false,
      errors: [{ line, message: msg, severity: 'error' }],
      summary: \`JSON Syntax Error at line \${line}: \${msg}\`,
    };
  }
}

/** Validates bracket/brace/parenthesis nesting and unclosed strings across source files */
export function validateBalancedStructure(content: string, language: string): ASTDiagnosticResult {
  const lines = content.split(/\\r?\\n/);
  const errors: ASTDiagnosticError[] = [];
  const stack: { char: string; line: number; col: number }[] = [];

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    inLineComment = false;

    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      const prev = c > 0 ? line[c - 1] : '';
      const next = c + 1 < line.length ? line[c + 1] : '';

      // Handle comments
      if (!inSingleQuote && !inDoubleQuote && !inTemplateString) {
        if (!inBlockComment && ch === '/' && next === '/') {
          inLineComment = true;
          break; // skip rest of line
        }
        if (!inBlockComment && (ch === '#' && (language === 'python' || language === 'yaml' || language === 'sh'))) {
          inLineComment = true;
          break;
        }
        if (!inBlockComment && ch === '/' && next === '*') {
          inBlockComment = true;
          c++;
          continue;
        }
        if (inBlockComment && ch === '*' && next === '/') {
          inBlockComment = false;
          c++;
          continue;
        }
      }

      if (inBlockComment || inLineComment) continue;

      // Handle string quotes with escape support
      if (ch === "'" && !inDoubleQuote && !inTemplateString && prev !== '\\\\') {
        inSingleQuote = !inSingleQuote;
        continue;
      }
      if (ch === '"' && !inSingleQuote && !inTemplateString && prev !== '\\\\') {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }
      if (ch === '\`' && !inSingleQuote && !inDoubleQuote && prev !== '\\\\') {
        inTemplateString = !inTemplateString;
        continue;
      }

      if (inSingleQuote || inDoubleQuote || inTemplateString) continue;

      // Check brackets
      if (ch === '{' || ch === '(' || ch === '[') {
        stack.push({ char: ch, line: l + 1, col: c + 1 });
      } else if (ch === '}' || ch === ')' || ch === ']') {
        if (stack.length === 0) {
          errors.push({
            line: l + 1,
            column: c + 1,
            message: \`Unmatched closing bracket '\${ch}' with no opening pair\`,
            severity: 'error',
          });
        } else {
          const top = stack.pop()!;
          const expected = top.char === '{' ? '}' : top.char === '(' ? ')' : ']';
          if (ch !== expected) {
            errors.push({
              line: l + 1,
              column: c + 1,
              message: \`Mismatched bracket '\${ch}', expected '\${expected}' matching '\${top.char}' from line \${top.line}\`,
              severity: 'error',
            });
          }
        }
      }
    }

    // Check unclosed single-line strings
    if ((inSingleQuote || inDoubleQuote) && !inTemplateString && language !== 'python') {
      // In JS/TS/Go/Rust, regular strings cannot span multiple lines without escape
      if (line.endsWith('\\\\')) {
        // Escaped newline, allowed
      } else {
        errors.push({
          line: l + 1,
          message: \`Unclosed string literal on line \${l + 1}\`,
          severity: 'error',
        });
        inSingleQuote = false;
        inDoubleQuote = false;
      }
    }
  }

  // Any unclosed brackets left on stack
  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    errors.push({
      line: unclosed.line,
      column: unclosed.col,
      message: \`Unclosed opening bracket '\${unclosed.char}' at line \${unclosed.line}\`,
      severity: 'error',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: errors.length > 0 ? errors.map((e) => \`Line \${e.line}: \${e.message}\`).join('; ') : undefined,
  };
}

/**
 * Validates Python syntax using Python 3's built-in AST compiler via stdin.
 * Catches syntax errors, indentation errors, and unclosed blocks with exact line numbers.
 */
export function validatePythonSyntax(content: string): ASTDiagnosticResult {
  try {
    execFileSync(
      'python3',
      ['-c', 'import sys, ast; ast.parse(sys.stdin.read())'],
      {
        input: content,
        encoding: 'utf8',
        timeout: 2000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    return { valid: true, errors: [] };
  } catch (err: any) {
    const stderr = String(err.stderr || err.message || '');
    const lineMatch = stderr.match(/line\\s+(\\d+)/i);
    const line = lineMatch ? Number(lineMatch[1]) : 1;
    const msgMatch = stderr.match(/(?:SyntaxError|IndentationError):\\s*(.*)/i);
    const message = msgMatch ? msgMatch[0] : 'Python syntax error';
    return {
      valid: false,
      errors: [{ line, message, severity: 'error' }],
      summary: \`Line \${line}: \${message}\`,
    };
  }
}

/** Python indentation and header colon validator */
export function validatePythonStructure(content: string): ASTDiagnosticResult {
  const balanced = validateBalancedStructure(content, 'python');
  if (!balanced.valid) return balanced;

  try {
    const pyAst = validatePythonSyntax(content);
    if (!pyAst.valid) return pyAst;
  } catch {}

  const lines = content.split(/\\r?\\n/);
  const errors: ASTDiagnosticError[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check missing colons on def / class / if / elif / else / for / while / with / try / except / finally
    const needsColon = /^(def\\s+\\w+.*|class\\s+\\w+.*|if\\s+.*|elif\\s+.*|else|for\\s+.*|while\\s+.*|with\\s+.*|try|except.*|finally)$/;
    if (needsColon.test(trimmed) && !trimmed.endsWith(':') && !trimmed.includes('"""') && !trimmed.includes("'''")) {
      errors.push({
        line: i + 1,
        message: \`Missing colon ':' at the end of statement: "\${trimmed}"\`,
        severity: 'error',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: errors.length > 0 ? errors.map((e) => \`Line \${e.line}: \${e.message}\`).join('; ') : undefined,
  };
}

const LAZY_PLACEHOLDER_REGEXES = [
  /\\/\\/\\s*(?:\\.{3,}|…)\\s*(?:existing|rest of|remaining|previous|unchanged|same as|original|all other).*(?:code|implementation|content|logic|functions|imports|file|unchanged|\\.{3,}|…)/i,
  /\\/\\*\\s*(?:\\.{3,}|…)\\s*(?:existing|rest of|remaining|previous|unchanged|same as|original|all other).*(?:\\*\\/)/i,
  /#\\s*(?:\\.{3,}|…)\\s*(?:existing|rest of|remaining|previous|unchanged|same as|original|all other).*(?:code|implementation|content|logic|functions|imports|file|unchanged|\\.{3,}|…)/i,
  /\\/\\/\\s*(?:existing|rest of|remaining|previous|unchanged)\\s*(?:code|implementation|content)\\s*(?:\\.{3,}|…)/i,
  /<!--\\s*(?:\\.{3,}|…)\\s*(?:existing|rest of|remaining|previous|unchanged).*(?:-->)/i,
  /\\[\\s*(?:\\.{3,}|…)\\s*(?:rest of|remaining|existing).*(?:\\])/i,
  /\\/\\/\\s*(?:\\.{3,}|…)\\s*(?:rest of class|rest of function|rest of file)/i,
];

/**
 * Detects lazy code truncation placeholders (e.g. "// ... existing code ...")
 * that often clobber large portions of files during model-driven rewrites.
 */
export function detectLazyPlaceholders(content: string): ASTDiagnosticResult {
  const lines = content.split(/\\r?\\n/);
  const errors: ASTDiagnosticError[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const regex of LAZY_PLACEHOLDER_REGEXES) {
      if (regex.test(line)) {
        errors.push({
          line: i + 1,
          message: \`Lazy code truncation placeholder detected: "\${line.trim()}". Never truncate or omit code with placeholders during rewrites; provide the complete implementation.\`,
          severity: 'error',
        });
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: errors.length > 0 ? errors.map((e) => \`Line \${e.line}: \${e.message}\`).join('; ') : undefined,
  };
}

/** Fast, universal static validator dispatching based on file extension */
export function validateFileSyntax(filePath: string, content: string): ASTDiagnosticResult {
  // 1. Guard against lazy truncation placeholders across all file types
  const lazyCheck = detectLazyPlaceholders(content);
  if (!lazyCheck.valid) return lazyCheck;

  const ext = extname(filePath).toLowerCase();

  if (ext === '.json') {
    return validateJSON(content);
  }

  if (['.py', '.pyi'].includes(ext)) {
    return validatePythonStructure(content);
  }

  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'].includes(ext)) {
    const balanced = validateBalancedStructure(content, 'javascript');
    if (!balanced.valid) return balanced;
    const tsCheck = validateTypeScriptSyntax(filePath, content);
    if (!tsCheck.valid) return tsCheck;
    const importCheck = validateRelativeImports(filePath, content);
    if (!importCheck.valid) {
      return {
        valid: false,
        errors: importCheck.errors,
        summary: \`⚠️ [Module Import Warning]: \${importCheck.summary}\`,
      };
    }
    return { valid: true, errors: [] };
  }

  if (['.rs', '.go', '.c', '.cpp', '.h', '.hpp', '.java'].includes(ext)) {
    return validateBalancedStructure(content, 'c-family');
  }

  return { valid: true, errors: [] };
}
`},"bench/efficiency.mjs":{path:"bench/efficiency.mjs",name:"efficiency.mjs",dir:"bench",lang:"javascript",size:"3.6 KB",lines:88,desc:"Hardware-level RSS memory and cold-start measurement suite",code:`#!/usr/bin/env node
// Efficiency benchmark: measures cold-start wall time and peak resident memory
// for Mochi's CLI (Node + Bun) and optionally a comparator like jcode, then
// prints a compact comparison table. This is the measurable "lightweight /
// hardware-friendly" proof.
//
// Usage:
//   node bench/efficiency.mjs            # Mochi via Node + Bun
//   MOCHI_BIN=./dist/cli.js node bench/efficiency.mjs
//   COMPARE_BIN=/path/to/jcode node bench/efficiency.mjs   # add a comparator

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_ARG = process.env.MOCHI_BIN ? [] : ['--version'];

const RUNS = Number(process.env.RUNS ?? 15);

function measureTime(cmd, args, cwd) {
  const t0 = performance.now();
  const r = spawnSync(cmd, args, { cwd, stdio: 'ignore', encoding: 'utf8' });
  const ms = performance.now() - t0;
  return { ms, status: r.status, ok: r.status === 0 };
}

function measureMem(cmd, args, cwd) {
  // /usr/bin/time -v gives "Maximum resident set size (kbytes)".
  const r = spawnSync('/usr/bin/time', ['-v', cmd, ...args], { cwd, encoding: 'utf8', timeout: 60000 });
  const err = r.stderr || '';
  const m = err.match(/Maximum resident set size \\(kbytes\\): (\\d+)/);
  return m ? Number(m[1]) : null;
}

function bench(target) {
  const { label, cmd, args } = target;
  let times = [];
  for (let i = 0; i < RUNS; i++) {
    const t = measureTime(cmd, args, root);
    if (t.ok) times.push(t.ms);
  }
  const mems = [];
  for (let i = 0; i < Math.max(1, Math.min(3, RUNS)); i++) {
    const m = measureMem(cmd, args, root);
    if (m) mems.push(m);
  }
  const avgTime = times.length ? (times.reduce((a, b) => a + b, 0) / times.length) : NaN;
  const avgMem = mems.length ? Math.round(mems.reduce((a, b) => a + b, 0) / mems.length) : 0;
  return { label, avgTime, avgMem, ok: times.length > 0 };
}

// Default targets: Mochi CLI under Node and Bun (when available), plus the
// standalone native binary when it has been built (npm run build:bin).
const targets = [];

let nodeCmd;
try { nodeCmd = spawnSync('node', ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] }).status === 0 ? 'node' : null; } catch { nodeCmd = null; }
if (nodeCmd) targets.push({ label: 'mochi (node)', cmd: 'node', args: ['dist/cli.js', ...VERSION_ARG] });

let bunCmd;
try { bunCmd = spawnSync('bun', ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] }).status === 0 ? 'bun' : null; } catch { bunCmd = null; }
if (bunCmd) targets.push({ label: 'mochi (bun)', cmd: 'bun', args: ['dist/cli.js', ...VERSION_ARG] });

// Native binary built by \`npm run build:bin\`.
const nativeBin = resolve(root, 'dist/mochi-bin');
const hasNative = spawnSync('test', ['-x', nativeBin], { stdio: 'ignore' }).status === 0;
if (hasNative) targets.push({ label: 'mochi (bin)', cmd: nativeBin, args: ['--version'] });

// Optional comparator from env, e.g. MOCHI_COMPARE=.../jcode
if (process.env.MOCHI_COMPARE) {
  targets.push({ label: 'compare', cmd: process.env.MOCHI_COMPARE, args: ['--version'] });
}

const rows = [];
for (const t of targets) {
  const r = bench(t);
  rows.push(r);
  console.log(\`\${r.label.padEnd(14)} \${r.avgTime.toFixed(1).padStart(8)}ms \${String(r.avgMem).padStart(7)}KB  \${r.avgMem ? '' : '(mem n/a)'}\`);
}

if (rows.length >= 2) {
  const node = rows.find((r) => r.label === 'mochi (node)');
  const bun = rows.find((r) => r.label === 'mochi (bun)');
  if (node && bun) {
    console.log(\`\\nBun vs Node: time \${(bun.avgTime / node.avgTime * 100).toFixed(1)}%, mem \${(bun.avgMem / node.avgMem * 100).toFixed(1)}%\`);
  }
}`},"package.json":{path:"package.json",name:"package.json",dir:".",lang:"json",size:"2.8 KB",lines:71,desc:"Mochi engine package manifest and build dependencies",code:`{
  "name": "@mochi/agent",
  "version": "0.22.0",
  "description": "Minimal, fast, autonomous coding agent: Rust runtime core with a TypeScript frontend.",
  "type": "module",
  "bin": {
    "mochi": "./dist/cli.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "native/bin",
    "README.md"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json && chmod +x dist/cli.js",
    "prebuild:bin": "node scripts/sync-version.mjs",
    "build:bin": "bun build src/cli.ts --compile --outfile dist/mochi-bin --target=bun",
    "build:rust": "cargo build --release --manifest-path native/mochi_core/Cargo.toml && cp --remove-destination native/mochi_core/target/release/mochi-agent native/bin/ && cp --remove-destination native/mochi_core/target/release/libmochi_core.so native/bin/mochi_core.node && cp --remove-destination native/mochi_core/target/release/libmochi_core.so native/bin/",
    "build:native": "mkdir -p native/bin && (cargo build --release --manifest-path native/mochi_core/Cargo.toml && cp --remove-destination native/mochi_core/target/release/mochi-agent native/bin/ && cp --remove-destination native/mochi_core/target/release/libmochi_core.so native/bin/mochi_core.node && cp --remove-destination native/mochi_core/target/release/libmochi_core.so native/bin/ || true) && (rustc -O -o native/bin/fuzzy_rust native/rust/fuzzy.rs || true) && (rustc -O -o native/bin/search_rust native/rust/search.rs || true) && (g++ -O2 -std=c++17 -o native/bin/fuzzy_cpp native/cpp/fuzzy.cpp || true)",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:verbose": "vitest run --reporter=dot",
    "bench": "node bench/startup.mjs",
    "bench:efficiency": "node bench/efficiency.mjs",
    "bench:task": "node bench/task.mjs",
    "bench:stream": "tsx bench/streaming.mjs",
    "typecheck": "tsc --noEmit",
    "bench:memory": "node bench/memory.mjs",
    "bench:speculation": "tsx bench/speculation.mjs",
    "release:check": "node scripts/release-check.mjs"
  },
  "engines": {
    "node": ">=22.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^5.0.3",
    "tsx": "^4.19.0",
    "typescript": "^5.9.0",
    "vite": "^7.3.7",
    "vitest": "^5.0.3"
  },
  "optionalDependencies": {
    "tree-sitter-c-sharp": "^0.23.5",
    "tree-sitter-cpp": "^0.23.4",
    "tree-sitter-go": "^0.25.0",
    "tree-sitter-java": "^0.23.5",
    "tree-sitter-php": "^0.24.2",
    "tree-sitter-python": "^0.25.0",
    "tree-sitter-ruby": "^0.23.1",
    "tree-sitter-rust": "^0.24.0",
    "tree-sitter-typescript": "^0.23.2",
    "web-tree-sitter": "^0.26.12"
  },
  "keywords": [
    "ai",
    "agent",
    "coding-agent",
    "terminal",
    "llm"
  ],
  "license": "MIT"
}
`},"src/agent/loop.ts":{path:"src/agent/loop.ts",name:"loop.ts",dir:"src/agent",lang:"typescript",size:"241.3 KB (showing core turn engine)",lines:220,desc:"Turn lifecycle state machine, model streaming, and acceptance verification loop",code:`import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import {sortableId} from '../util.js';
import type { Attempt, ChatMessage, MochiConfig, ModelProfile, Task, ToolDefinition, ToolCall, ToolResult } from '../types.js';
import { contentText } from '../types.js';
import type { EventBus } from '../events.js';
import type { Workspace } from '../workspace.js';
import { ContextEngine, approxTokens } from '../context.js';
import { MemoryStore } from '../memory.js';
import { projectMemoryPrefix, recordProjectMemory } from '../project-memory.js';
import { loadReadCache, saveReadCache } from '../read-cache-store.js';
import { createProvider } from '../model/router.js';
import { PROVIDERS } from '../providers.js';
import { isMode, modeInstruction } from '../modes.js';
import { kvCache } from '../kv-cache.js';
import { executeTool, buildTools, TOOL_ALIASES, normalizeToolArgs, trimHeavyTools } from '../tools/index.js';
import { refreshAuthoredTools, RESERVED_TOOL_NAMES } from '../tools/tool-factory.js';
import type { ToolContext, ReadCache } from '../tools/types.js';
import { detectRepo, languageHint } from '../repo.js';
import { classifyTaskKind, resolveAutoReasoning, isTrivialWriteTask, isSimpleScriptTask } from '../taskkind.js';
import { trimToLeanTier } from '../tools/index.js';
import { classifyTaskTier, nextEscalationTier, type TaskTier } from '../model-router.js';
import { matchesBaseline, type VerificationBaseline } from '../verification.js';
import { diagnoseFile, renderDiagnostics } from '../diagnostics.js';
import type { AgentProfile } from '../types.js';
import { AgentProfileService } from '../agents/profile.js';
import { BudgetEngine, estimateCostUsd } from '../budget.js';
import { SpeculativeEngine } from '../speculative.js';
import { retrieveSpeculationMemory, recordSpeculationOutcome, speculationMemoryToPrompt, predictNextFiles } from '../speculative.js';
import { join } from 'node:path';
import { detectSkillOpportunities, opportunitiesToPrompt, shouldRunCurator, runCurator, recordCuratorRun, defaultCuratorConfig } from '../skill-curator.js';
import { LearningStore } from '../learning.js';
import { classifyFailure as classifyErrorPattern } from '../learning.js';
import {
  classifyFailure,
  formInitialHypotheses,
  rankHypotheses,
  evaluateProbe,
  diagnosisToPrompt,
  type Hypothesis,
  type DiagnosisResult,
} from '../diagnosis.js';
import {
  loadOrCreateAutopsy,
  appendAttempt,
  finalizeAutopsy,
  autopsyOneLine,
  type Autopsy,
} from '../autopsy.js';
import {
  retrieveLessons,
  recordLesson,
  lessonsToPrompt,
  type Lesson,
} from '../lessons.js';
import { HookManager } from '../hooks.js';
import { resolve, extname } from 'node:path';
import { statSync, existsSync, readFileSync } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { condenseOutput } from '../core/output-condenser.js';
import { autoTestCommand, isWeakVerification, cwdForScope, withCwd } from '../testdetect.js';
import { classifyOneShot } from '../one-shot.js';
import { classifyContentOnly } from '../one-shot.js';
import { buildMcpTools } from '../mcp/tools.js';
import { preEditSnapshot as gitPreEditSnapshot, rollbackToSnapshot as gitRollback, type CheckpointResult } from '../git.js';
import { applyToolOutputPolicy } from '../core/tool-output.js';
import { scrubAnsiFragments } from '../tui/ansi-hygiene.js';
import { nativeStripThinkTags } from '../native/core.js';
import { maybeRedact } from '../security.js';
import { LoopStateMachine } from './loop-state.js';
import { scanDiffForHygiene, renderHygieneFindings, type HygieneFinding } from '../core/diff-hygiene.js';
import { parseCompilerDiagnostics, renderCompilerAdvisory } from './error-diagnostics.js';
import { AnchorEngine } from '../cognitive/anchor.js';
import { summarize } from '../summary/engine.js';
import { compactSession, compactToPrompt } from '../summary/compact.js';
import { ExecutionRegistry } from '../core/execution-registry.js';
import { evaluateTestDensity } from '../core/test-density.js';

export function stripThinkTags(text: string): string {
  if (!text) return '';
  // Strip an unclosed LEADING think block (open \`\` / \` thinking \` with no
  // closer) to end-of-string in JS FIRST, so the intent holds regardless of
  // whether the native addon is loaded (the native Rust stripThinkTags keeps
  // such leading tags, leaking reasoning tokens into context).
  const lead = text.trimStart();
  if (/^\\s*\`\\s*think[^\\n]*$/i.test(lead) && !lead.includes('</think>')) return '';
  if (/^\\s*think[^\\n]*$/i.test(lead) && !lead.includes('</think>')) return '';
  const nat = nativeStripThinkTags(text);
  if (nat !== null) return nat;
  return text
    .replace(/\`think[\\s\\S]*?<\\/think>/gi, '')
    .replace(/<thought>[\\s\\S]*?<\\/thought>/gi, '')
    .replace(/^\\s*\`\\s*think[\\s\\S]*$/gi, '')
    .replace(/^<thought>[\\s\\S]*$/gi, '')
    .trim();
}

import { nativeCommandAvailable } from '../native/core.js';

/** True if the leading binary of a shell command exists on PATH (or as a
 *  relative ./ wrapper). Used to skip optional repo checks (lint/typecheck/
 *  build) whose tool isn't installed, rather than failing a run for reasons
 *  that have nothing to do with the task's code. */
function commandAvailable(command: string, cwd: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;
  // Native fast path: a single FFI call extracts the bin and scans PATH.
  const nat = nativeCommandAvailable(trimmed, cwd, process.env.PATH ?? '');
  if (nat !== null) return nat.available;
  // "npx X", "python3 -m Y", "./gradlew", "cd /x && cmd" — extract the actual
  // program name to probe for.
  const first = trimmed.split(/\\s+/)[0] ?? '';
  let bin = first;
  if (bin === 'npx') bin = 'npm'; // npx comes with npm
  if (bin === 'cd') {
    const m = trimmed.match(/cd\\s+(\\S+)\\s*&&\\s*(\\S+)/);
    bin = m?.[2] ?? '';
  }
  if (!bin) return false;
  if (bin.startsWith('./') || bin.startsWith('/')) {
    try {
      const path = resolve(cwd, bin);
      const st = statSync(path);
      return st.isFile();
    } catch {
      return false;
    }
  }
  const dirs = (process.env.PATH ?? '').split(':');
  return dirs.some((d) => {
    try {
      const st = statSync(resolve(d, bin));
      return st.isFile();
    } catch {
      return false;
    }
  });
}

/** Replace unfilled template hints in a verification command. Models writing
 *  \`cd <project_root> && cargo test\` persist the placeholder literally; the
 *  \`<...>\` is shell-redirect syntax that breaks sh -c. Strip the placeholder
 *  cd and replace remaining tokens with '.' since the shell already runs in
 *  the project root. */
export function sanitizeVerifyCommand(cmd: string): string {
  const c = cmd.trim();
  // "cd <project_root> && cargo test" -> "cargo test" (cwd is project root).
  // Linear scan (no nested quantifiers) so hostile verify strings stay O(n).
  const amp = c.indexOf('&&');
  const prefix = amp === -1 ? c : c.slice(0, amp).trim();
  const m = /^cd\\s+<[^>]+>$/.exec(prefix);
  if (m && amp !== -1) return c.slice(amp + 2).trim();
  return c.replace(/<project_root>|<root>|__PROJECT_ROOT__/g, '.');
}

/**
 * Decide whether a model reply is an actual plan versus a preamble like
 * "I'll research the codebase first...". Plan mode's deliverable is the plan
 * text itself, so a non-tool reply must LOOK like a plan (numbered steps,
 * bullets, or explicitly structured plan language) before the loop accepts it
 * as done. Without this, a model that answers with delay-preamble text would
 * "succeed" without ever producing a plan.
 *
 * Signals, strongest first:
 *   - an explicit numbered list (1. / 1) / (1))
 *   - two or more bullet items
 *   - generous prose with plan vocabulary (steps, files, verify...) plus
 *     structure headers, so a one-liner keeps the model on task.
 */
export function isPlanShaped(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Numbered list: "1." / "1)" / "1." at a line start (optionally after a header).
  if (/(?:^|\\n)\\s*\\d+[.)]/.test(t)) return true;
  // Two or more bullet / checked items.
  const bullets = (t.match(/(?:^|\\n)\\s*(?:[-*•]|\\d{1,2}\\.)\\s+/g) ?? []).length;
  if (bullets >= 2) return true;
  // No explicit list: require substantial content, plan vocabulary, AND a
  // structure header so a one-liner preamble stays a nudge, not a success.
  return (
    t.length >= 120 &&
    /(^|\\n)\\s*(steps|plan|approach|files? to change|risks?|verification|how to verify|outline|summary|tasks?|deliverables)\\s*[:.]/i.test(t)
  );
}

/**
 * MCH-31: pull candidate file paths out of an acceptance-criterion sentence.
 * Recognizes quoted paths, backticked paths, and bare relative paths with a
 * known extension or a slash. Returns repo-relative candidates (deduped).
 */
export function extractPathsFromCriterion(criterion: string): string[] {
  const out: string[] = [];
  const quoted = criterion.match(/["'\`]([^\\s"'\`]+\\.[A-Za-z0-9]{1,8}|[^\\s"'\`]*\\/[^\\s"'\`]+)["'\`]/g) ?? [];
  for (const q of quoted) out.push(q.slice(1, -1));
  // Bare tokens that look like paths: contain a slash or have a file extension.
  const bare = criterion.match(/(?:^|\\s)((?:[\\w.@-]+\\/)*[\\w.@-]+\\.[A-Za-z0-9]{1,8})(?=\\s|$|[,.;)])|(?:^|\\s)((?:[\\w.@-]+\\/)+[\\w.@-]+)/g) ?? [];
  for (const b of bare) {
    const tok = b.trim().replace(/[,.;)]$/, '');
    if (tok && !/^(https?|the|a|an|this|that|file|test|grep|test -f)$/i.test(tok)) out.push(tok);
  }
  return [...new Set(out)].filter((p) => p.length > 1 && !p.includes('..') && !p.startsWith('/'));
}

/** Plan shape: a substantive multi-file change the model must plan, track,
 *  and execute with engineering discipline — the Cline/Codex harness shape.
 *  Injected once as a system directive for complex coding tasks (not chat). */
const LARGE_REWRITE_PROTOCOL = [
  'This is a substantial multi-file coding task. Work like a senior engineer:',
  '1. PLAN FIRST: use the todo tool to lay out the ordered tasks (add each as a',
  '   todo item). Update statuses as you go; todo list is your persistent ledger',
  '   and survives compaction — do not restart the plan from memory later.',
  '2. UNDERSTAND IMPACT: before editing a symbol/file, call blast_radius (or',
  '   find_callers / type_hierarchy) to see who depends on it. Refuse to rename',
  '   or change a signature until you know the call sites.',
  '3. READ THE CURRENT IMPLEMENTATION: open the actual file/function you are',
  '   changing before rewriting it — never rewrite from memory of an earlier',
  '   mention. Preserve behavior you are not explicitly told to change.',
  '4. CHECKPOINT BEFORE RISKY EDITS: if a change is large or destructive, save a',
  '   checkpoint first so a bad step can roll back cleanly.',
  '5. PERSIST DECISIONS: use the memory tool (action:add) to record key decisions',
`}},p="https://github.com/xanstomper/mochi",N=[{title:"Core Engine & Turn Loop",dir:"src/agent",files:["src/agent/loop.ts"]},{title:"Model Routing & Failover",dir:"src",files:["src/model-router.ts"]},{title:"Surgical AST Tools",dir:"src/tools",files:["src/tools/edit.ts","src/tools/patch.ts"]},{title:"Multi-Tab TUI Engine",dir:"src/tui",files:["src/tui/tabs.ts"]},{title:"Verification & AST Guards",dir:"src/core",files:["src/core/ast-guard.ts"]},{title:"Compiled Native Rust Core",dir:"native/mochi_core/src",files:["native/mochi_core/src/lib.rs"]},{title:"Telemetry & Benchmarks",dir:"bench",files:["bench/efficiency.mjs"]},{title:"Manifest & Configuration",dir:".",files:["package.json"]}];function E(){const[r,d]=f.useState("src/agent/loop.ts"),[m,g]=f.useState(!1),[h,x]=f.useState(""),l=u[r]||u["src/agent/loop.ts"],y=()=>{navigator.clipboard&&(navigator.clipboard.writeText(l.code),g(!0),setTimeout(()=>g(!1),2e3))},_=l.code.split(`
`),v=t=>{const o=t.trimStart();if(o.startsWith("//")||o.startsWith("/*")||o.startsWith("*")||o.startsWith("//!"))return e.jsx("span",{style:{color:"#8E879E",fontStyle:"italic"},children:t});if(o.startsWith("#")&&!o.startsWith("#!"))return e.jsx("span",{style:{color:"#8E879E",fontStyle:"italic"},children:t});const n=[],a=/(\b(?:import|export|from|default|class|interface|type|const|let|var|function|return|async|await|if|else|for|while|try|catch|new|pub|fn|struct|impl|mut|use|enum|self|Self|match|where|crate)\b)|('(?:\\.|[^'])*'|"(?:\\.|[^"])*"|`(?:\\.|[^`])*`)|(\b(?:string|number|boolean|void|any|Promise|Set|Map|usize|u32|Self|Option|Result|HashMap|Vec)\b)|(\b[0-9]+(?:\.[0-9]+)?\b)/g;let s=0,i;for(;(i=a.exec(t))!==null;)i.index>s&&n.push(t.substring(s,i.index)),i[1]?n.push(e.jsx("span",{style:{color:"#7C3AED",fontWeight:600},children:i[1]},i.index)):i[2]?n.push(e.jsx("span",{style:{color:"#059669"},children:i[2]},i.index)):i[3]?n.push(e.jsx("span",{style:{color:"#2563EB",fontWeight:600},children:i[3]},i.index)):i[4]&&n.push(e.jsx("span",{style:{color:"#D97706"},children:i[4]},i.index)),s=i.index+i[0].length;return s<t.length&&n.push(t.substring(s)),n.length?n:t};return e.jsxs("div",{className:"code-explorer-card",style:{width:"100%",maxWidth:"100%"},children:[e.jsxs("div",{className:"explorer-topbar",style:{flexWrap:"wrap",gap:12},children:[e.jsxs("div",{className:"explorer-repo-meta",style:{flexWrap:"wrap",gap:8},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8},children:[e.jsx("svg",{width:"18",height:"18",viewBox:"0 0 16 16",fill:"currentColor",style:{color:"var(--purple)"},children:e.jsx("path",{d:"M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1h-8a1 1 0 00-1 1v6.708A2.486 2.486 0 014.5 9h8V1.5z"})}),e.jsx("a",{href:p,target:"_blank",rel:"noopener",style:{textDecoration:"none",color:"var(--ink)",fontWeight:700,fontSize:14},children:"xanstomper"}),e.jsx("span",{style:{color:"var(--muted)"},children:"/"}),e.jsx("a",{href:p,target:"_blank",rel:"noopener",style:{textDecoration:"none",color:"var(--purple-dark)",fontWeight:800,fontSize:14},children:"mochi"})]}),e.jsxs("span",{className:"repo-badge-git",style:{background:"var(--purple-lighter)",color:"var(--purple-dark)",fontWeight:700,border:"1px solid rgba(139, 92, 246, 0.2)"},children:[e.jsx("svg",{width:"12",height:"12",viewBox:"0 0 16 16",fill:"currentColor",style:{marginRight:4},children:e.jsx("path",{d:"M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"})}),"main"]}),e.jsx("span",{className:"repo-stat",children:"727 Shipped Files"}),e.jsx("span",{className:"repo-stat",children:"1,459 Tests Passing"}),e.jsx("span",{className:"repo-stat",children:"0 Dependencies"}),e.jsx("span",{className:"repo-stat",children:"MIT License"})]}),e.jsx("div",{className:"explorer-actions",children:e.jsxs("a",{href:p,target:"_blank",rel:"noopener",className:"explorer-gh-btn",style:{textDecoration:"none"},children:[e.jsx("svg",{width:"14",height:"14",viewBox:"0 0 16 16",fill:"currentColor",children:e.jsx("path",{d:"M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"})}),e.jsx("span",{children:"View Full GitHub Repo ↗"})]})})]}),e.jsxs("div",{className:"explorer-grid",style:{minHeight:640},children:[e.jsxs("aside",{className:"explorer-tree-side",style:{width:300,flexShrink:0},children:[e.jsxs("div",{className:"tree-search-bar",style:{position:"relative"},children:[e.jsx(S,{size:15,style:{position:"absolute",left:12,top:11,color:"var(--muted)"}}),e.jsx("input",{type:"text",placeholder:"Search repository files...",value:h,onChange:t=>x(t.target.value),className:"tree-filter-input",style:{paddingLeft:34}})]}),e.jsx("div",{className:"tree-list",style:{padding:"8px 10px"},children:N.map(t=>{const o=t.files.filter(n=>{const a=u[n];if(!a)return!1;if(!h)return!0;const s=h.toLowerCase();return a.name.toLowerCase().includes(s)||a.path.toLowerCase().includes(s)||t.title.toLowerCase().includes(s)});return o.length===0?null:e.jsxs("div",{className:"tree-dir-group",style:{marginBottom:12},children:[e.jsxs("div",{className:"tree-dir-label",style:{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",fontSize:11.5,fontWeight:700,color:"var(--purple-dark)",textTransform:"uppercase",letterSpacing:".06em"},children:[e.jsx("svg",{width:"14",height:"14",viewBox:"0 0 16 16",fill:"currentColor",children:e.jsx("path",{d:"M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2A1.75 1.75 0 004.98 1H1.75z"})}),e.jsx("span",{children:t.title})]}),e.jsx("div",{className:"tree-files",style:{paddingLeft:10},children:o.map(n=>{const a=u[n],s=r===n;return e.jsxs("button",{className:"tree-file-btn"+(s?" active":""),onClick:()=>d(n),style:{display:"flex",alignItems:"center",width:"100%",gap:8,padding:"7px 10px",borderRadius:8,border:"none",background:s?"var(--purple-lighter)":"transparent",color:s?"var(--purple-dark)":"var(--ink)",fontWeight:s?700:500,fontSize:13,cursor:"pointer",textAlign:"left",transition:"all 0.15s"},children:[e.jsx("svg",{width:"13",height:"13",viewBox:"0 0 16 16",fill:"currentColor",style:{color:s?"var(--purple)":"var(--muted)"},children:e.jsx("path",{d:"M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.586a1.75 1.75 0 011.237.513l3.914 3.914c.328.328.513.774.513 1.237v8.586A1.75 1.75 0 0113.25 16H3.75A1.75 1.75 0 012 14.25V1.75z"})}),e.jsx("span",{style:{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:a.name}),e.jsx("span",{style:{fontSize:10,fontFamily:"var(--font-mono)",padding:"2px 5px",borderRadius:4,background:s?"#ffffff":"#EDE8F5",color:"var(--purple-dark)",fontWeight:600},children:a.lang})]},n)})})]},t.dir)})})]}),e.jsxs("section",{className:"explorer-code-view",style:{flex:1,minWidth:0,display:"flex",flexDirection:"column"},children:[e.jsxs("div",{className:"code-view-header",style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 20px",borderBottom:"1px solid var(--line)",background:"#FAF8FC"},children:[e.jsxs("div",{className:"code-view-meta",style:{display:"flex",alignItems:"center",gap:10},children:[e.jsx("span",{style:{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:"var(--ink)"},children:l.path}),e.jsxs("span",{style:{fontSize:12,color:"var(--muted)",background:"var(--purple-lighter)",padding:"2px 8px",borderRadius:999,fontWeight:600},children:[l.size," · ",l.lines," lines"]})]}),e.jsxs("div",{className:"code-view-actions",style:{display:"flex",gap:10},children:[e.jsx("button",{className:"code-copy-btn",onClick:y,style:{padding:"6px 14px",fontSize:12.5,fontWeight:600,borderRadius:8,cursor:"pointer",background:"#ffffff",border:"1.5px solid var(--line)",color:"var(--ink)"},children:m?"✓ Copied":"Copy Code"}),e.jsx("a",{href:`${p}/blob/main/${l.path}`,target:"_blank",rel:"noopener",className:"code-external-link",style:{display:"inline-flex",alignItems:"center",gap:4,padding:"6px 14px",fontSize:12.5,fontWeight:600,borderRadius:8,textDecoration:"none",background:"var(--purple)",color:"#ffffff"},children:"Open in GitHub ↗"})]})]}),e.jsxs("div",{style:{padding:"8px 20px",background:"rgba(139, 92, 246, 0.05)",borderBottom:"1px solid var(--line)",fontSize:12.5,color:"var(--purple-dark)",fontWeight:600,display:"flex",alignItems:"center",gap:8},children:[e.jsx("span",{style:{fontSize:14},children:"ℹ"}),e.jsx("span",{children:l.desc})]}),e.jsx("div",{className:"code-content-wrapper",style:{flex:1,overflow:"auto",background:"#ffffff",maxHeight:600},children:e.jsx("table",{style:{width:"100%",borderCollapse:"collapse",fontFamily:"var(--font-mono)",fontSize:13,lineHeight:"21px"},children:e.jsx("tbody",{children:_.map((t,o)=>{const n=o+1;return e.jsxs("tr",{style:{verticalAlign:"top"},children:[e.jsx("td",{style:{width:48,minWidth:48,textAlign:"right",paddingRight:16,paddingLeft:12,userSelect:"none",color:"#A29CAD",fontSize:12,borderRight:"1px solid #ECE7F5",background:"#FAF8FC"},children:n}),e.jsx("td",{style:{paddingLeft:16,paddingRight:16,whiteSpace:"pre",color:"#1B1726"},children:v(t)})]},n)})})})})]})]})]})}const P=[{icon:j,title:"Open Source & Permissive",desc:"Transparent, community-driven, and released under the MIT license. Audit every line of Rust and TypeScript on GitHub.",link:"https://github.com/xanstomper/mochi"},{icon:C,title:"Contribution Guidelines",desc:"Help us improve Mochi with code, documentation, benchmarks, and community feedback. Strict CI/CD quality gates.",link:"https://github.com/xanstomper/mochi/blob/main/CONTRIBUTING.md"},{icon:A,title:"Community Discussions",desc:"Get support, share workflows, propose skills, and connect with thousands of terminal agent developers.",link:"https://github.com/xanstomper/mochi/discussions"}],R=[{val:"727",label:"SOURCE FILES AUDITED",desc:"Zero dead code or dangling unused dependencies"},{val:"1,200",label:"TESTS PASSING",desc:"Vitest, unit, and headless integration tests passing (100%)"},{val:"0",label:"RUNTIME DEPENDENCIES",desc:"Single self-contained Bun executable with Rust core"},{val:"MIT",label:"OPEN SOURCE LICENSE",desc:"Free for personal, academic, and commercial use"}];function I(){return typeof window<"u"&&window.location.pathname.startsWith("/mochi"),e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"pagehead",children:e.jsxs("div",{className:"wrap",children:[e.jsxs("div",{className:"pagehead-row",children:[e.jsxs("div",{className:"pagehead-col",children:[e.jsx(c,{direction:"bottom",delay:.1,children:e.jsxs("div",{className:"hero-eyebrow",children:[e.jsx("span",{className:"sparkle"}),"OPEN SOURCE & TRANSPARENT"]})}),e.jsxs("h1",{className:"hero-title",children:["Open Source ",e.jsx("span",{className:"accent-title",children:"and Always Free."})]}),e.jsx(c,{direction:"bottom",delay:.2,children:e.jsx("p",{className:"hero-sub",style:{maxWidth:640},children:"Mochi is 100% open source under the MIT license. Explore the live interactive repository tree, inspect our pure-Rust core tokenizer, or contribute pull requests to the project."})}),e.jsx(c,{direction:"bottom",delay:.3,children:e.jsxs("div",{className:"hero-actions",style:{marginTop:24},children:[e.jsxs("a",{href:"https://github.com/xanstomper/mochi",target:"_blank",rel:"noopener",className:"btn btn-primary",children:[e.jsx("svg",{width:"16",height:"16",viewBox:"0 0 16 16",fill:"currentColor",children:e.jsx("path",{d:"M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"})}),"View on GitHub"]}),e.jsx("a",{href:"https://github.com/xanstomper/mochi/blob/main/CONTRIBUTING.md",target:"_blank",rel:"noopener",className:"btn btn-secondary",children:"Contribute →"})]})})]}),e.jsx(c,{direction:"right",delay:.2,children:e.jsxs("div",{className:"subpage-mascot-wrap",children:[e.jsx("div",{className:"subpage-doodle",children:"built by the community ♡"}),e.jsxs("div",{style:{position:"relative"},children:[e.jsx("span",{className:"heart-doodle",children:"♡"}),e.jsx(k,{variant:"source",size:360})]})]})})]}),e.jsx("div",{className:"grid3",style:{marginTop:44,marginBottom:48},children:P.map((r,d)=>{const m=r.icon;return e.jsx(c,{direction:"bottom",delay:d*.08,children:e.jsxs("a",{href:r.link,target:"_blank",rel:"noopener",className:"card",style:{textDecoration:"none",color:"inherit"},children:[e.jsx("div",{className:"card-icon-box",children:e.jsx(m,{size:22})}),e.jsxs("h3",{className:"card-title",children:[e.jsx("span",{children:r.title}),e.jsx("span",{className:"card-arrow",children:"↗"})]}),e.jsx("p",{className:"card-desc",children:r.desc})]})},r.title)})}),e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:20,marginBottom:52},children:R.map((r,d)=>e.jsx(c,{direction:"bottom",delay:d*.06,children:e.jsxs("div",{style:{background:"#ffffff",borderRadius:20,padding:"24px 20px",border:"1.5px solid var(--line)",textAlign:"center",boxShadow:"var(--shadow-card)"},children:[e.jsx("div",{style:{fontSize:36,fontWeight:800,color:"var(--purple-dark)",marginBottom:4},children:r.val}),e.jsx("div",{style:{fontFamily:"var(--font-mono)",fontSize:11,fontWeight:700,color:"var(--ink)",marginBottom:4},children:r.label}),e.jsx("div",{style:{fontSize:13,color:"var(--ink-soft)"},children:r.desc})]})},r.label))}),e.jsx(c,{direction:"bottom",delay:.2,children:e.jsxs("div",{style:{marginBottom:80},children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18},children:[e.jsxs("div",{children:[e.jsx("h3",{style:{fontSize:22,fontWeight:800,color:"var(--ink)",margin:0},children:"Live Repository Explorer"}),e.jsx("p",{style:{fontSize:14,color:"var(--ink-soft)",margin:"4px 0 0"},children:"Browse source files and explore core architecture directly from GitHub main."})]}),e.jsx("span",{className:"doc-search-badge",children:"xanstomper/mochi"})]}),e.jsx(E,{})]})})]})}),e.jsx(T,{})]})}const b=document.getElementById("root");b&&w(b).render(e.jsx(I,{}));
