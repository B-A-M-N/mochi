import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// feedback.ts resolves ~/.mochi at module load — point HOME at a throwaway
// directory BEFORE the first import so tests never touch the real store.
// USERPROFILE too: os.homedir() on Windows reads USERPROFILE, NOT HOME, so
// setting only HOME silently writes to the real runner home there.
const home = mkdtempSync(resolve(tmpdir(), 'mochi-feedback-home-'));
const priorHome = process.env.HOME;
const priorProfile = process.env.USERPROFILE;
process.env.HOME = home;
process.env.USERPROFILE = home;
const feedbackFile = resolve(home, '.mochi', 'feedback.jsonl');
const fb = await import('./feedback.js');

afterAll(() => {
  process.env.HOME = priorHome;
  if (priorProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = priorProfile;
  rmSync(home, { recursive: true, force: true });
});

function entry(over: Partial<Parameters<typeof fb.recordFeedback>[0]> = {}) {
  return {
    ts: Date.now(),
    session: 's1',
    turn: 0,
    verdict: 'good' as const,
    snippet: 'the answer',
    ...over,
  };
}

describe('feedback store', () => {
  it('starts empty in a fresh home and creates the store lazily', () => {
    expect(fb.loadAllFeedback()).toEqual([]);
    expect(fb.recentFeedback()).toEqual([]);
    expect(fb.recentBad()).toEqual([]);
    expect(fb.feedbackDigest()).toBe('');
    expect(fb.feedbackPulse()).toBe('');
    expect(existsSync(feedbackFile)).toBe(true);
  });

  it('records and reloads entries round-trip', () => {
    fb.recordFeedback(entry({ verdict: 'good', snippet: 'nice fix', turn: 1 }));
    fb.recordFeedback(entry({ verdict: 'bad', snippet: 'broke the build', reason: 'wrong file', turn: 2 }));
    const all = fb.loadAllFeedback();
    expect(all).toHaveLength(2);
    expect(all[0].snippet).toBe('nice fix');
    expect(all[1]).toMatchObject({ verdict: 'bad', reason: 'wrong file' });
  });

  it('skips malformed lines instead of throwing', () => {
    appendFileSync(feedbackFile, 'not json\n');
    expect(() => fb.loadAllFeedback()).not.toThrow();
    expect(fb.loadAllFeedback()).toHaveLength(2);
  });

  it('recentFeedback returns the last N, oldest first', () => {
    fb.recordFeedback(entry({ snippet: 'third' }));
    fb.recordFeedback(entry({ snippet: 'fourth' }));
    const last2 = fb.recentFeedback(2);
    expect(last2.map((e) => e.snippet)).toEqual(['third', 'fourth']);
    // Default keeps only the last 10 even as the file grows.
    expect(fb.recentFeedback(100).length).toBeGreaterThanOrEqual(4);
  });

  it('recentBad filters to bad verdicts, capped', () => {
    const bad = fb.recentBad();
    expect(bad.length).toBeGreaterThanOrEqual(1);
    expect(bad.every((e) => e.verdict === 'bad')).toBe(true);
    // Cap works: asking for at most one returns at most one.
    expect(fb.recentBad(1).length).toBeLessThanOrEqual(1);
  });

  it('digest summarizes good and bad patterns with reasons', () => {
    const digest = fb.feedbackDigest();
    expect(digest).toContain('# FEEDBACK SIGNAL');
    expect(digest).toContain('rated:');
    expect(digest).toContain('Patterns the user marked BAD');
    expect(digest).toContain('broke the build');
    expect(digest).toContain('wrong file');
    expect(digest).toContain('Patterns the user marked GOOD');
    expect(digest).toContain('nice fix');
    expect(digest).toContain('self-correct');
  });

  it('pulse renders 👍-only, 👎-only, and mixed states', async () => {
    // Reset the store: all good.
    writeFresh([entry({ verdict: 'good' }), entry({ verdict: 'good' })]);
    expect(fb.feedbackPulse()).toBe('2 👍');
    writeFresh([entry({ verdict: 'bad' }), entry({ verdict: 'bad' })]);
    expect(fb.feedbackPulse()).toBe('2 👎');
    writeFresh([entry({ verdict: 'good' }), entry({ verdict: 'bad' })]);
    expect(fb.feedbackPulse()).toBe('1👍 1👎');
    writeFresh([]);
    expect(fb.feedbackPulse()).toBe('');
  });
});

function writeFresh(entries: Array<Parameters<typeof fb.recordFeedback>[0]>): void {
  // Rewrite the store wholesale (keep the file present so ensureFile no-ops).
  writeFileSync(feedbackFile, entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : ''));
}
