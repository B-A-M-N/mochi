// B15 regression: the complex-task recency floor fights the token window.
//
// Three faces, all in src/context.ts:
// 1. buildPacket(): `overBudget` required recent.length >= MIN_RECENT, so the
//    first 24 (complex) messages were added UNCONDITIONALLY — the implicit
//    fall-through below the floor never consulted the budget. When the
//    clamped window couldn't hold 24 dense messages, the packet went out
//    over budget → provider 400.
// 2. compact()/planCutIndex() refuse to shrink below the SAME 24-message
//    floor (keep = 24), so once messages.length <= 24, compaction is a
//    no-op and cannot repair the overshoot it is asked to fix.
// 3. shrinkOldToolOutputs() exempted the newest 40 (complex) messages from
//    in-place shrinking — wider than the 24-message floor — so the
//    cheapest lever was also locked out.
// Result: provider 400s, compaction can't fix it, retries burn out.
//
// Contract pinned here: the recency floor is a TARGET, not an override —
// the packet builder stops adding at the budget line (keeping at least the
// newest turn), compaction accepts an explicit smaller floor, and the floor
// region is not exempt from in-place shrinking.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContextEngine, approxTokens } from './context.js';
import type { MochiConfig, ChatMessage } from './types.js';

let skillsDir: string;
beforeAll(() => { skillsDir = mkdtempSync(join(tmpdir(), 'mochi-b15-')); });
afterAll(() => { rmSync(skillsDir, { recursive: true, force: true }); });

function cfg(budget: number): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl: 'http://127.0.0.1:1/v1', model: 'fake-model' },
    safety: { contextBudgetTokens: budget, maxIterations: 50, maxRuntimeMinutes: 10, mode: 'safe' as const },
  } as MochiConfig;
}

// A read result of ~1000 estimated tokens (4000 chars).
const DENSE = 'x'.repeat(4000);

function pushTurns(c: ContextEngine, n: number): void {
  for (let k = 0; k < n; k++) {
    c.addMessage({ role: 'assistant', content: `step ${k}` } as ChatMessage);
    c.addMessage({ role: 'tool', tool_call_id: `c${k}`, name: 'read', content: DENSE } as ChatMessage);
  }
}

describe('recency floor must not override the token window (B15)', () => {
  it('buildPacket stays within budget when the window cannot hold the floor', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mochi-b15-1-'));
    try {
      const c = new ContextEngine(cfg(4000), dir, skillsDir);
      c.setTaskComplexity('complex');
      pushTurns(c, 30); // 60 messages x ~1000 tokens >> 4000 budget
      const packet = c.buildPacket([], undefined, undefined);
      // The packet is what gets sent to the provider. It must fit the
      // working budget (approx 4000 tokens); with the bug the 24-message
      // floor alone carries ~12K+ tokens of dense tool results.
      // REVIEW-STRENGTHENED: usedTokens = budget - remaining, and remaining
      // is inflated by the rescue add-back (context.ts:933), so it can read
      // NEGATIVE on a grossly over-budget packet. Pin the real wire size.
      const real = packet.messages.reduce(
        (a, m) => a + approxTokens(JSON.stringify(m)), 0);
      expect(real).toBeLessThanOrEqual(4000);
      expect(packet.usedTokens).toBeLessThanOrEqual(4000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('compact() can shrink below the 24-message floor when the budget demands it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mochi-b15-2-'));
    try {
      const c = new ContextEngine(cfg(4000), dir, skillsDir);
      c.setTaskComplexity('complex');
      pushTurns(c, 30); // 60 messages > 24 floor
      await c.compact();
      // First compaction keeps the 24-message floor by design. The invariant
      // under test: a caller that must go deeper (context-limit recovery
      // with a tightened budget) can request an explicit smaller floor.
      // With the bug, compact() hard-codes 24 and short-circuits to a no-op.
      await c.compact(undefined, 12);
      expect(c.messageCount).toBeLessThanOrEqual(12);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('shrinkOldToolOutputs can shrink the oversized floor on complex tasks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mochi-b15-3-'));
    try {
      const c = new ContextEngine(cfg(4000), dir, skillsDir);
      c.setTaskComplexity('complex');
      // REVIEW-STRENGTHENED: 18 turns = 36 messages — ALL inside main's
      // 40-message complex window (so main's shrink is a no-op: saved 0),
      // but 12 of them sit outside the fixed 24-message window (so the fix
      // reaches them).
      pushTurns(c, 18);
      const saved = c.shrinkOldToolOutputs();
      expect(saved).toBeGreaterThan(0);
      // A later pass still finds new mass as messages age past the window.
      pushTurns(c, 25);
      expect(c.shrinkOldToolOutputs()).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
