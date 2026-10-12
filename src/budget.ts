import type { SafetyConfig } from './types.js';

export interface BudgetLimits {
  maxTokens: number;
  maxCostUsd: number;
  maxDurationMs: number;
  maxToolCalls: number;
  maxModelCalls: number;
  maxAgents: number;
}

export type BudgetPhase = 'full' | 'reduced' | 'cheap' | 'verify' | 'exhausted';

export interface BudgetSnapshot {
  usedTokens: number;
  usedCostUsd: number;
  usedDurationMs: number;
  usedToolCalls: number;
  usedModelCalls: number;
  usedAgents: number;
  remainingTokens: number;
  remainingCostUsd: number;
  remainingDurationMs: number;
  phase: BudgetPhase;
  ratio: number;
  /** MCH-79: per-model token/cost breakdown for the summary card. */
  byModel: Array<{ model: string; tokens: number; costUsd: number; calls: number }>;
}

import { nativeBudgetDecide } from './native/core.js';

// NOTE: no local price table. A hardcoded per-model pricing map can never stay
// current (new models ship weekly, and the same model id bills differently per
// hosting provider), so inventing a number was worse than showing none. Cost is
// only ever recorded when the PROVIDER's own usage object reports billing
// (OpenRouter-style usage.cost); otherwise the UI says so and the real
// provider-measured metrics — tokens in/out/cached and context consumed —
// carry the accounting.

export class BudgetEngine {
  private limits: BudgetLimits;
  private startedAt = 0;
  private usedTokens = 0;
  private usedCostUsd = 0;
  private usedToolCalls = 0;
  private usedModelCalls = 0;
  private usedAgents = 0;
  /** MCH-79: per-model token/cost ledger. */
  private byModel = new Map<string, { tokens: number; costUsd: number; calls: number }>();

  constructor(safety: SafetyConfig) {
    this.limits = {
      maxTokens: safety.maxTokens ?? Number.POSITIVE_INFINITY,
      maxCostUsd: safety.maxCostUsd ?? Number.POSITIVE_INFINITY,
      maxDurationMs: safety.maxRuntimeMinutes * 60_000,
      maxToolCalls: safety.maxToolCalls ?? Number.POSITIVE_INFINITY,
      maxModelCalls: safety.maxModelCalls ?? Number.POSITIVE_INFINITY,
      maxAgents: safety.maxConcurrentAgents,
    };
  }

  start() {
    this.startedAt = performance.now();
  }

  /** @param realCostUsd Provider-REPORTED cost for this record (usage.cost from
   *  the API's own usage object). Never invented: without it the record
   *  charges $0 and the UI labels cost as not reported. The token limit
   *  still counts output-only tokens (full re-billing exhausts maxTokens
   *  early) — output tokens are the resource that scales with agent work. */
  recordTokens(tokens: number, model: string, provider = '', realCostUsd?: number) {
    void provider; // kept for call-site stability; pricing is provider-reported only
    this.usedTokens += tokens;
    const cost = realCostUsd ?? 0;
    this.usedCostUsd += cost;
    // MCH-79: per-model ledger for the /usage cost breakdown.
    const e = this.byModel.get(model) ?? { tokens: 0, costUsd: 0, calls: 0 };
    e.tokens += tokens;
    e.costUsd += cost;
    e.calls += 1;
    this.byModel.set(model, e);
  }

  recordToolCall() {
    this.usedToolCalls++;
  }

  recordModelCall() {
    this.usedModelCalls++;
  }

  recordAgentStart() {
    this.usedAgents++;
  }

  recordAgentEnd() {
    this.usedAgents = Math.max(0, this.usedAgents - 1);
  }

  remainingTokens(): number {
    return Math.max(0, this.limits.maxTokens - this.usedTokens);
  }

  remainingCostUsd(): number {
    return Math.max(0, this.limits.maxCostUsd - this.usedCostUsd);
  }

  remainingDurationMs(): number {
    if (this.startedAt === 0) return this.limits.maxDurationMs;
    return Math.max(0, this.limits.maxDurationMs - (performance.now() - this.startedAt));
  }

  ratio(): number {
    // Native-first: hand the current state to the Rust core (slice 3) which
    // returns the same value the TS code below computes, but ~5x faster.
    // The fallback is the original regex-equivalent loop.
    const nat = nativeBudgetDecide(
      {
        maxTokens: Number.isFinite(this.limits.maxTokens) ? this.limits.maxTokens : Infinity,
        maxCostUsd: Number.isFinite(this.limits.maxCostUsd) ? this.limits.maxCostUsd : Infinity,
        maxDurationMs: this.limits.maxDurationMs,
        maxToolCalls: Number.isFinite(this.limits.maxToolCalls) ? this.limits.maxToolCalls : Infinity,
        maxModelCalls: Number.isFinite(this.limits.maxModelCalls) ? this.limits.maxModelCalls : Infinity,
      },
      {
        usedTokens: this.usedTokens,
        usedCostUsd: this.usedCostUsd,
        usedDurationMs: this.startedAt === 0 ? 0 : performance.now() - this.startedAt,
        usedToolCalls: this.usedToolCalls,
        usedModelCalls: this.usedModelCalls,
      },
    );
    if (nat !== null) return nat.ratio;
    const ratios: number[] = [];
    if (Number.isFinite(this.limits.maxTokens)) ratios.push(this.remainingTokens() / this.limits.maxTokens);
    if (Number.isFinite(this.limits.maxCostUsd) && this.limits.maxCostUsd > 0) ratios.push(this.remainingCostUsd() / this.limits.maxCostUsd);
    if (this.limits.maxDurationMs > 0) ratios.push(this.remainingDurationMs() / this.limits.maxDurationMs);
    if (Number.isFinite(this.limits.maxToolCalls)) ratios.push(Math.max(0, this.limits.maxToolCalls - this.usedToolCalls) / this.limits.maxToolCalls);
    if (Number.isFinite(this.limits.maxModelCalls)) ratios.push(Math.max(0, this.limits.maxModelCalls - this.usedModelCalls) / this.limits.maxModelCalls);
    if (ratios.length === 0) return 1;
    return Math.min(...ratios);
  }

  phase(): BudgetPhase {
    const r = this.ratio();
    if (r <= 0) return 'exhausted';
    if (r <= 0.05) return 'verify';
    if (r <= 0.25) return 'cheap';
    if (r <= 0.5) return 'reduced';
    return 'full';
  }

  /** Phase as a small int (0=exhausted, 1=verify, 2=cheap, 3=reduced, 4=full).
   *  Native-first; the JS phase() method above is kept for the type signature. */
  phaseCode(): number {
    const r = this.ratio();
    if (r <= 0) return 0;
    if (r <= 0.05) return 1;
    if (r <= 0.25) return 2;
    if (r <= 0.5) return 3;
    return 4;
  }

  snapshot(_model: string): BudgetSnapshot {
    return {
      usedTokens: this.usedTokens,
      usedCostUsd: this.usedCostUsd,
      usedDurationMs: this.startedAt === 0 ? 0 : performance.now() - this.startedAt,
      usedToolCalls: this.usedToolCalls,
      usedModelCalls: this.usedModelCalls,
      usedAgents: this.usedAgents,
      remainingTokens: this.remainingTokens(),
      remainingCostUsd: this.remainingCostUsd(),
      remainingDurationMs: this.remainingDurationMs(),
      phase: this.phase(),
      ratio: this.ratio(),
      // MCH-79: ranked highest-cost-first for the summary card.
      byModel: Array.from(this.byModel.entries())
        .map(([model, e]) => ({ model, tokens: e.tokens, costUsd: e.costUsd, calls: e.calls }))
        .sort((a, b) => b.costUsd - a.costUsd),
    };
  }

  canUseTokens(tokens: number): boolean {
    return this.remainingTokens() >= tokens && this.remainingCostUsd() > 0;
  }

  canMakeModelCall(): boolean {
    if (this.phase() === 'exhausted') return false;
    if (Number.isFinite(this.limits.maxModelCalls) && this.usedModelCalls >= this.limits.maxModelCalls) return false;
    return true;
  }

  canExecuteTool(): boolean {
    // Verify phase (ratio<=0.05) is the "spend remaining budget on proving the
    // work" phase: it must still allow tool calls (especially the verify
    // tool / scoped checks). Only a truly exhausted budget vetoes tools.
    return this.remainingDurationMs() > 0 && this.phase() !== 'exhausted';
  }

  shouldUseCheaperModel(): boolean {
    return this.phase() === 'cheap' || this.phase() === 'verify';
  }
}
