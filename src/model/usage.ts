import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { redact } from '../security/security.js';
import { resolve } from 'node:path';

export interface UsageRecord {
  modelCalls: number;
  tokensIn: number;
  tokensOut: number;
  /** Provider-reported cached-input tokens (prompt cache hits). */
  tokensCached?: number;
  /** Context consumed by the LATEST request in this entry (prompt+completion
   *  per the provider) — a gauge, not cumulative; never summed. */
  contextUsed?: number;
  /** Provider-reported billing only. 0 means the provider doesn't report
   *  cost — the summary says so instead of inventing a price. */
  costUsd: number;
  toolCalls: number;
  durationMs: number;
}

export interface UsageEntry {
  model: string;
  goal: string;
  usage: UsageRecord;
  /** Written by the honesty migration for entries recorded BEFORE the in/out
   *  split existed (they logged the total under `out` and `modelCalls: 1`).
   *  Numbers are kept exactly as recorded — the true split was never captured
   *  and must not be invented — but the UI flags them as legacy. */
  legacy?: boolean;
}

export interface UsageStoreData {
  entries: UsageEntry[];
}

export class UsageStore {
  private path: string;
  private data: UsageStoreData;

  constructor(workspaceDir: string) {
    const dir = resolve(workspaceDir, 'state');
    this.path = resolve(dir, 'usage.json');
    if (existsSync(this.path)) {
      try {
        const parsed = JSON.parse(readFileSync(this.path, 'utf8'));
        this.data = { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
      } catch {
        this.data = { entries: [] };
      }
    } else {
      this.data = { entries: [] };
    }
    // Honesty migration: entries written before the in/out split existed have
    // tokensIn 0 with a nonzero `out` (the old code logged the TOTAL under
    // out and hardcoded modelCalls 1). Flag them once and persist — the
    // numbers stay exactly as recorded, but the UI stops presenting them as
    // if a real split had been measured.
    let flagged = false;
    for (const e of this.data.entries) {
      if (!e.legacy && (e.usage.tokensIn ?? 0) === 0 && (e.usage.tokensOut ?? 0) > 0) {
        e.legacy = true;
        flagged = true;
      }
    }
    if (flagged) this.save();
  }

  private save() {
    const dir = resolve(this.path, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.path, redact(JSON.stringify(this.data, null, 2)));
  }

  record(model: string, goal: string, usage: Partial<UsageRecord>): void {
    this.data.entries.push({
      model,
      goal,
      usage: {
        modelCalls: usage.modelCalls ?? 0,
        tokensIn: usage.tokensIn ?? 0,
        tokensOut: usage.tokensOut ?? 0,
        tokensCached: usage.tokensCached ?? 0,
        contextUsed: usage.contextUsed ?? 0,
        // Never priced locally: 0 means the provider didn't report billing.
        costUsd: usage.costUsd ?? 0,
        toolCalls: usage.toolCalls ?? 0,
        durationMs: usage.durationMs ?? 0,
      },
    });
    if (this.data.entries.length > 500) {
      this.data.entries.splice(0, this.data.entries.length - 500);
    }
    this.save();
  }

  total(): UsageRecord {
    const t: UsageRecord = { modelCalls: 0, tokensIn: 0, tokensOut: 0, tokensCached: 0, costUsd: 0, toolCalls: 0, durationMs: 0 };
    for (const e of this.data.entries) {
      t.modelCalls += e.usage.modelCalls;
      t.tokensIn += e.usage.tokensIn;
      t.tokensOut += e.usage.tokensOut;
      t.tokensCached = (t.tokensCached ?? 0) + (e.usage.tokensCached ?? 0);
      t.costUsd += e.usage.costUsd;
      t.toolCalls += e.usage.toolCalls;
      t.durationMs += e.usage.durationMs;
    }
    return t;
  }

  /** Context consumed by the most recent entry's latest request (a gauge). */
  lastContextUsed(): number {
    for (let i = this.data.entries.length - 1; i >= 0; i--) {
      const c = this.data.entries[i].usage.contextUsed ?? 0;
      if (c > 0) return c;
    }
    return 0;
  }

  summary(): string {
    const t = this.total();
    const ctx = this.lastContextUsed();
    const legacyCount = this.data.entries.filter((e) => e.legacy).length;
    const legacyNote = legacyCount > 0
      ? `legacy entries: ${legacyCount} (recorded before the in/out split existed — totals shown as recorded, split unknown)`
      : '';
    return [
      `model calls: ${t.modelCalls}`,
      `tokens in:   ${t.tokensIn.toLocaleString()}`,
      `tokens out:  ${t.tokensOut.toLocaleString()}`,
      `cached in:   ${(t.tokensCached ?? 0).toLocaleString()} (prompt-cache hits, provider-reported)`,
      `context:     ${ctx.toLocaleString()} tokens (latest request)`,
      `cost:        ${t.costUsd > 0 ? `$${t.costUsd.toFixed(4)} (provider-reported)` : 'not reported by provider'}`,
      `tool calls:  ${t.toolCalls}`,
      `time:        ${(t.durationMs / 1000).toFixed(1)}s`,
      ...(legacyNote ? [legacyNote] : []),
    ].join('\n');
  }

  recent(n = 5): string {
    const recent = this.data.entries.slice(-n).reverse();
    if (recent.length === 0) return 'No usage recorded yet.';
    return recent.map((e) => {
      const cached = (e.usage.tokensCached ?? 0) > 0 ? `, ${e.usage.tokensCached} cached` : '';
      const ctx = (e.usage.contextUsed ?? 0) > 0 ? `, ctx ${e.usage.contextUsed}` : '';
      const cost = e.usage.costUsd > 0 ? ` $${e.usage.costUsd.toFixed(4)}` : '';
      return `[${e.model}] ${e.goal}:${cost} / ${e.usage.tokensOut} tokens${cached}${ctx}${e.legacy ? ' (legacy: split not recorded)' : ''}`;
    }).join('\n');
  }
}