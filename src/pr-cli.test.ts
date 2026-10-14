// pr-cli: `mochi pr review` headless core — arg parsing + exit-code contract.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, delimiter } from 'node:path';
import { execSync } from 'node:child_process';
import { parsePrReviewArgs, runPrReview } from './pr-cli.js';

let dir: string;
let originalPath: string;

beforeAll(() => {
  originalPath = process.env.PATH ?? '';
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-prcli-'));
  if (process.platform !== 'win32') {
    const fakeBin = mkdtempSync(resolve(tmpdir(), 'mochi-prcli-gh-'));
    writeFileSync(resolve(fakeBin, 'gh'), [
      '#!/bin/sh',
      'if [ "$1" = "pr" ] && [ "$2" = "view" ]; then',
      '  echo "{\\"number\\":7,\\"title\\":\\"Wire pr\\",\\"author\\":{\\"login\\":\\"dev\\"},\\"baseRefName\\":\\"main\\",\\"headRefName\\":\\"feat/pr\\",\\"url\\":\\"\\",\\"additions\\":3,\\"deletions\\":1,\\"files\\":[{\\"path\\":\\"src/x.ts\\",\\"additions\\":3,\\"deletions\\":1}]}\"',
      '  exit 0',
      'fi',
      'if [ "$1" = "pr" ] && [ "$2" = "diff" ]; then',
      '  printf \'diff --git a/src/x.ts b/src/x.ts\\n--- a/src/x.ts\\n+++ b/src/x.ts\\n@@ -1,2 +1,3 @@\\n const a = 1;\\n+console.log("debug here");\\n const b = 2;\\n\'',
      '  exit 0',
      'fi',
      'exit 1',
    ].join('\n'));
    execSync(`chmod +x ${resolve(fakeBin, 'gh')}`);
    process.env.PATH = `${fakeBin}${delimiter}${originalPath}`;
  }
});

afterAll(() => {
  process.env.PATH = originalPath;
  rmSync(dir, { recursive: true, force: true });
});

describe('parsePrReviewArgs', () => {
  it('parses the happy path from positional + flags', () => {
    const r = parsePrReviewArgs(['12'], { repo: 'acme/widgets', focus: 'security', post: true, json: true });
    expect(r).toEqual({ pr: 12, repo: 'acme/widgets', post: true, json: true, focus: 'security' });
  });

  it('defaults repo/post/json/focus when absent', () => {
    expect(parsePrReviewArgs(['3'])).toEqual({ pr: 3, repo: undefined, post: false, json: false, focus: 'correctness' });
  });

  it('returns usage for a missing PR number', () => {
    expect(parsePrReviewArgs([], {})).toContain('Usage: mochi pr review');
  });

  it('rejects bad numbers, repos, and focus values', () => {
    expect(parsePrReviewArgs(['0'], {})).toContain('positive integer');
    expect(parsePrReviewArgs(['abc'], {})).toContain('Bad PR number');
    expect(parsePrReviewArgs(['-3'], {})).toContain('Bad PR number');
    expect(parsePrReviewArgs(['1', '2'], {})).toContain('extra argument');
    expect(parsePrReviewArgs(['5'], { repo: 'nope!!' })).toContain('owner/name');
    expect(parsePrReviewArgs(['5'], { focus: 'vibes' })).toContain('--focus');
  });
});

describe('runPrReview exit-code contract', () => {
  it('exit 0 on a successful review (read-only default)', async () => {
    if (process.platform === 'win32') return; // no exe-level gh fake possible
    const logs: string[] = [];
    const orig = console.log;
    console.log = (s: string) => { logs.push(String(s)); };
    try {
      const code = await runPrReview({ pr: 7, post: false, json: false, focus: 'correctness' }, dir);
      expect(code).toBe(0);
      expect(logs.join('\n')).toContain('PR #7: Wire pr');
    } finally {
      console.log = orig;
    }
  });

  it('exit 1 + JSON error payload when gh is missing', async () => {
    const savedPath = process.env.PATH;
    // Point PATH at an empty dir so `gh` cannot resolve (all platforms).
    const empty = mkdtempSync(resolve(tmpdir(), 'mochi-prcli-empty-'));
    process.env.PATH = empty;
    const logs: string[] = [];
    const orig = console.log;
    console.log = (s: string) => { logs.push(String(s)); };
    try {
      const code = await runPrReview({ pr: 7, post: false, json: true, focus: 'correctness' }, dir);
      expect(code).toBe(1);
      const payload = JSON.parse(logs.join('\n'));
      expect(payload.ok).toBe(false);
      expect(payload.pr).toBe(7);
      expect(String(payload.error)).toMatch(/gh CLI not found|Could not fetch|not found/);
    } finally {
      console.log = orig;
      process.env.PATH = savedPath;
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('JSON success payload carries hygiene counts + full report', async () => {
    if (process.platform === 'win32') return;
    const logs: string[] = [];
    const orig = console.log;
    console.log = (s: string) => { logs.push(String(s)); };
    try {
      const code = await runPrReview({ pr: 7, post: false, json: true, focus: 'correctness' }, dir);
      expect(code).toBe(0);
      const payload = JSON.parse(logs.join('\n'));
      expect(payload.ok).toBe(true);
      expect(payload.pr).toBe(7);
      expect(typeof payload.report).toBe('string');
      // The fake diff has one console.log debug line → at least one hygiene hit.
      expect(Object.values(payload.findings as Record<string, number>).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(1);
    } finally {
      console.log = orig;
    }
  });
});
