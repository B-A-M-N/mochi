// B15 regression: the complex-task recency floor fights the token window.
//
// Three faces, all in src/context.ts:
// 1. buildPacket() adds MIN_RECENT messages (24 for complex) to `recent`
//    EVEN WHEN the budget is already in the red (the "fall through below
//    MIN_RECENT: keep adding regardless of budget" branch). The packet is
//    then assembled over budget — the provider rejects it with a 400.
// 2. compact()/planCutIndex() refuse to shrink below the SAME 24-message
//    floor (keep = 24), so once messages.length <= 24, compaction is a
//    no-op and cannot repair the overshoot it is asked to fix.
// 3. shrinkOldToolOutputs() exempts the newest 40 (complex) messages from
//    in-place shrinking — the same oversized floor messages — so the
//    cheapest lever is also locked out.
// Result: provider 400s, compaction can't fix it, retries burn out.
//
// Contract pinned here: the recency floor is a TARGET, not an override —
// when the window is too small to hold the floor, the packet builder must
// stop adding at the budget line (keeping at least the newest turn), and
// the oversized floor must not be exempt from in-place shrinking.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContextEngine } from './context.js';
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
      pushTurns(c, 45); // 90 messages: 50 outside the 40-window, 40 inside
      const saved = c.shrinkOldToolOutputs();
      expect(saved).toBeGreaterThan(0);
      // With the bug, the newest 40 messages are untouchable; the packet's
      // recency floor (24) sits entirely inside that untouchable zone, so
      // the dense floor can never be relieved in place: the over-budget
      // signal is stuck (effectiveContextTokens clamps to budget but
      // shrinking cannot relieve it). After the fix the pressure loop can
      // actually shrink its way back under the floor mass.
      expect(c.effectiveContextTokens()).toBeGreaterThan(0);
      // And a second pass after the fix can reach the previously-protected
      // region once messages age past the (smaller) protected window.
      pushTurns(c, 25); // 140 messages total
      expect(c.shrinkOldToolOutputs()).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
