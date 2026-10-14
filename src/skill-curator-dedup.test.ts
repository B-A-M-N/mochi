// Skill curator consolidation (dedup) tests — pins the real merge behavior:
// near-duplicate agent-created skills merge into the older skill (which keeps
// its usage history), the newer body is absorbed under a heading, and the
// newer SKILL.md is archived. The `consolidate` flag was previously vaporware
// (declared in CuratorConfig, never consumed).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { skillSimilarity, consolidateSkills, defaultCuratorConfig, scanSkills, runCurator, promoteLessons } from './skills/skill-curator.js';
import { saveLessons } from './lessons.js';
import { loadUsage, saveUsage } from './skills/skill-manager.js';

let dir: string;

const BODY = (name: string, extra = '') => `---
name: ${name}
description: deploy the worker
---

# ${name}

Deploy the worker with wrangler, run the smoke check, then verify tail logs.
${extra}
`;

/** Register skills as agent-created in the usage registry — the curator only
 *  ever touches agent-created skills (bundled skills are untouchable). */
function markAgentCreated(...names: string[]): void {
  const now = Date.now();
  const byName: Record<string, unknown> = {};
  for (const n of names) byName[n] = { name: n, agentCreated: true, patches: 0, createdAt: now, lastUsedAt: now };
  saveUsage(dir, { byName } as any);
}

function mkSkill(name: string, body: string, mtimeMs?: number): string {
  const p = resolve(dir, '.mochi', 'skills', name);
  mkdirSync(p, { recursive: true });
  writeFileSync(resolve(p, 'SKILL.md'), body, 'utf8');
  return p;
}

describe('skill dedup / consolidation', () => {
  beforeEach(() => { dir = mkdtempSync(resolve(tmpdir(), 'mochi-curator-dedup-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('skillSimilarity scores identical bodies 1 and unrelated bodies low', () => {
    const a = BODY('deploy-worker');
    const b = BODY('deploy-worker-two');
    const c = '# cooking\n\nBoil pasta, salt the water, drain, add sauce.';
    expect(skillSimilarity(a, b)).toBeGreaterThan(0.7);
    expect(skillSimilarity(a, c)).toBeLessThan(0.2);
  });

  it('consolidateSkills merges a near-duplicate into the older skill and archives the newer', () => {
    mkSkill('deploy-worker', BODY('deploy-worker'));
    mkSkill('worker-deploy-guide', BODY('worker-deploy-guide'));
    const cfg = { ...defaultCuratorConfig(), consolidate: true };
    const { snapshots } = scanSkills(dir, cfg);
    const merged = consolidateSkills(snapshots, cfg);
    expect(merged.length).toBe(1);
    // The kept body now carries the absorbed content.
    const kept = readFileSync(resolve(dir, '.mochi', 'skills', 'deploy-worker', 'SKILL.md'), 'utf8');
    expect(kept).toContain('Absorbed from');
    expect(kept).toContain('worker-deploy-guide');
    // The loser is gone from the live tree.
    expect(existsSync(resolve(dir, '.mochi', 'skills', 'worker-deploy-guide'))).toBe(false);
  });

  it('consolidate: false disables merging; unrelated skills never merge', () => {
    mkSkill('deploy-worker', BODY('deploy-worker'));
    mkSkill('pasta-recipe', '# cooking\n\nBoil pasta, salt the water, drain, add sauce.');
    const cfgOff = { ...defaultCuratorConfig(), consolidate: false };
    const { snapshots: s1 } = scanSkills(dir, cfgOff);
    expect(consolidateSkills(s1, cfgOff)).toEqual([]);

    const cfgOn = { ...defaultCuratorConfig(), consolidate: true };
    const { snapshots: s2 } = scanSkills(dir, cfgOn);
    expect(consolidateSkills(s2, cfgOn)).toEqual([]);
  });

  it('runCurator reports consolidations and archives the merged skill', () => {
    mkSkill('deploy-worker', BODY('deploy-worker'));
    mkSkill('worker-deploy-guide', BODY('worker-deploy-guide'));
    markAgentCreated('deploy-worker', 'worker-deploy-guide');
    const cfg = defaultCuratorConfig();
    const out = runCurator(dir, cfg);
    expect(out.consolidated.length).toBe(1);
    expect(out.consolidated[0].merged).toBe('worker-deploy-guide');
    expect(out.consolidated[0].kept).toBe('deploy-worker');
  });
});

describe('lesson promotion (experience → gated skills)', () => {
  beforeEach(() => { dir = mkdtempSync(resolve(tmpdir(), 'mochi-curator-promote-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  function seedLessons(): void {
    saveLessons(dir, [
      { id: 'l1', signature: 'ECONNREFUSED db', lesson: 'Retry the database connection with exponential backoff (100ms base, 5 attempts) before failing the task.', useCount: 5, successCount: 2, recordedAtMs: 1 },
      { id: 'l2', signature: 'flaky thing', lesson: 'Re-run the flaky step once before investigating further here.', useCount: 1, successCount: 1, recordedAtMs: 1 },
      { id: 'l3', signature: 'never fixed', lesson: 'Some approach that never actually fixed anything at all here.', useCount: 9, successCount: 0, recordedAtMs: 1 },
      { id: 'l4', signature: '', lesson: 'A lesson with no trigger signature attached to it here.', useCount: 9, successCount: 9, recordedAtMs: 1 },
    ]);
  }

  it('promotes only proven lessons (3+ uses, 1+ fixes) into gated skills', () => {
    seedLessons();
    const { promoted, skipped } = promoteLessons(dir);
    expect(promoted).toEqual(['learned-econnrefused-db']);
    expect(skipped.map((s) => s.signature)).toEqual(expect.arrayContaining(['flaky thing', 'never fixed', '(empty)']));
    const body = readFileSync(resolve(dir, '.mochi', 'skills', 'learned', 'learned-econnrefused-db', 'SKILL.md'), 'utf8');
    expect(body).toContain('ECONNREFUSED db');
    expect(body).toContain('exponential backoff');
    expect(body).not.toContain('sk-');
    // Flagged agent-created so later curator passes lifecycle-manage it.
    expect(loadUsage(dir).byName['learned-econnrefused-db']?.agentCreated).toBe(true);
  });

  it('is idempotent (second pass collides instead of duplicating)', () => {
    seedLessons();
    expect(promoteLessons(dir).promoted).toHaveLength(1);
    const second = promoteLessons(dir);
    expect(second.promoted).toEqual([]);
    expect(second.skipped.some((s) => s.reason.includes('already exists'))).toBe(true);
  });

  it('runCurator surfaces promotions in its output and report', () => {
    seedLessons();
    const out = runCurator(dir, defaultCuratorConfig());
    expect(out.promoted).toEqual(['learned-econnrefused-db']);
  });
});
