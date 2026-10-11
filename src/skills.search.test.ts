import { describe, it, expect } from 'vitest';
import { searchSkills, type Skill } from './skills.js';

const mk = (name: string, description: string): Skill => ({ name, description, path: `/s/${name}` });
const CORPUS: Skill[] = [
  mk('fix-flaky-test', 'Quarantine and repair intermittently failing vitest suites with retry bisect'),
  mk('postgres-tuning', 'Analyze slow PostgreSQL queries with EXPLAIN and suggest indexes'),
  mk('release-checklist', 'Verify changelog, version bump, and npm publish steps before release'),
  mk('react-forms', 'Patterns for controlled forms, validation, and error display in React'),
];

describe('searchSkills', () => {
  it('ranks exact and prefix name matches first', () => {
    const hits = searchSkills(CORPUS, 'fix-flaky-test');
    expect(hits[0].skill.name).toBe('fix-flaky-test');
    expect(hits[0].score).toBe(1.0);
    const pre = searchSkills(CORPUS, 'postgres');
    expect(pre[0].skill.name).toBe('postgres-tuning');
    expect(pre[0].score).toBeGreaterThanOrEqual(0.9);
  });

  it('finds description matches with snippets', () => {
    const hits = searchSkills(CORPUS, 'EXPLAIN');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].skill.name).toBe('postgres-tuning');
    expect(hits[0].snippet.length).toBeGreaterThan(0);
  });

  it('matches shared vocabulary (recall over precision)', () => {
    const hits = searchSkills(CORPUS, 'failing tests repair');
    expect(hits.map((h) => h.skill.name)).toContain('fix-flaky-test');
  });

  it('returns [] for empty queries and caps at limit', () => {
    expect(searchSkills(CORPUS, '   ')).toEqual([]);
    expect(searchSkills(CORPUS, 'e', { limit: 2 }).length).toBeLessThanOrEqual(2);
  });

  it('usage boost reorders ties without inventing matches', () => {
    const noBoost = searchSkills(CORPUS, 'patterns release verify');
    const boost = new Map([['release-checklist', 20]]);
    const boosted = searchSkills(CORPUS, 'patterns release verify', { usageBoost: boost });
    expect(boosted.find((h) => h.skill.name === 'release-checklist')!.score)
      .toBeGreaterThan(noBoost.find((h) => h.skill.name === 'release-checklist')?.score ?? 0);
    expect(searchSkills(CORPUS, 'zzz-no-such-thing')).toEqual([]);
  });
});
