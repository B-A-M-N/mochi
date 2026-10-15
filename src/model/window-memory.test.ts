import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  learnedWindowBudget,
  recordContextRejection,
  windowModelKey,
  windowLimitsPath,
} from './window-memory.js';

let dir: string;
let file: string;
const prev = process.env.MOCHI_WINDOW_LIMITS_PATH;

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-window-'));
  file = resolve(dir, 'window-limits.json');
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  if (prev === undefined) delete process.env.MOCHI_WINDOW_LIMITS_PATH;
  else process.env.MOCHI_WINDOW_LIMITS_PATH = prev;
});

describe('window-memory (adaptive context window)', () => {
  it('returns undefined until a model has actually been rejected', () => {
    expect(learnedWindowBudget('deepseek-v4', 'opencode-zen', file)).toBeUndefined();
  });

  it('learns a working budget safely BELOW the rejected prompt size', () => {
    recordContextRejection('deepseek-v4', 'opencode-zen', 131_072, file);
    const b = learnedWindowBudget('deepseek-v4', 'opencode-zen', file);
    expect(b).toBeDefined();
    expect(b!).toBeLessThan(131_072);
    expect(b!).toBeGreaterThan(100_000);
  });

  it('only ever tightens (keeps the smallest rejection)', () => {
    recordContextRejection('m', 'p', 200_000, file);
    expect(learnedWindowBudget('m', 'p', file)).toBe(Math.floor(200_000 * 0.85));
    recordContextRejection('m', 'p', 120_000, file);
    expect(learnedWindowBudget('m', 'p', file)).toBe(Math.floor(120_000 * 0.85));
    // A larger later rejection must NOT loosen the bound.
    recordContextRejection('m', 'p', 500_000, file);
    expect(learnedWindowBudget('m', 'p', file)).toBe(Math.floor(120_000 * 0.85));
  });

  it('keys per provider+model so one model cannot poison another', () => {
    recordContextRejection('a', 'p1', 100_000, file);
    expect(learnedWindowBudget('b', 'p1', file)).toBeUndefined();
    expect(learnedWindowBudget('a', 'p2', file)).toBeUndefined();
    expect(windowModelKey('A', 'P1')).toBe('p1/a');
  });

  it('ignores sub-token noise and survives a corrupt store file', () => {
    recordContextRejection('m', 'p', 5, file); // below floor
    expect(learnedWindowBudget('m', 'p', file)).toBeUndefined();
    writeFileSync(file, '{ not json');
    expect(learnedWindowBudget('m', 'p', file)).toBeUndefined();
    expect(() => recordContextRejection('m', 'p', 90_000, file)).not.toThrow();
    expect(learnedWindowBudget('m', 'p', file)).toBe(Math.floor(90_000 * 0.85));
    expect(JSON.parse(readFileSync(file, 'utf8'))['p/m']).toBeTruthy();
  });

  it('honors MOCHI_WINDOW_LIMITS_PATH for the default path', () => {
    process.env.MOCHI_WINDOW_LIMITS_PATH = file;
    expect(windowLimitsPath()).toBe(file);
  });
});
