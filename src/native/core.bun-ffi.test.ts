// Exercises the entire Bun FFI branch of native/core.ts — normally
// unreachable under node, since Bun.dlopen only exists under the Bun
// runtime. Here the N-API addon is hidden (existsSync stub) and a fake
// `globalThis.Bun` dlopen shim provides in-memory implementations of every
// C symbol, so each dispatch's buffer handling, pointer writes, length
// checks, and JSON parse fallbacks run for real.
import { describe, it, expect, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: (p: Parameters<typeof actual.existsSync>[0]) => {
      const s = String(p);
      if (s.endsWith('.node')) return false; // force the shared-lib path
      if (s.includes('libmochi_core')) return true;
      return actual.existsSync(p);
    },
  };
});

import {
  isNativeCoreAvailable,
  nativeFuzzyMatch,
  nativeGitBranch,
  nativeSearchDir,
  nativeStripThinkTags,
  nativeHashPrompt,
  nativeEstimateCostUsd,
  nativeDiffNumstat,
  nativeClassifyPrompt,
  nativeCountTokens,
  nativeTruncateToTokens,
  nativeUnifiedDiff,
  nativeSkeletonizeSource,
  nativeRedactSecrets,
  nativeBudgetDecide,
  nativeClassifyCommand,
  nativeFoldOutput,
  nativeCommandAvailable,
  nativeStripAnsi,
} from './core.js';

// ── fake Bun runtime ───────────────────────────────────────────────────────
const writeJ = (buf: Buffer, s: string): number => {
  buf.write(s, 'utf8');
  return Buffer.byteLength(s);
};
const asStr = (x: unknown): string => String(x);

const SYMBOLS: Record<string, (...args: any[]) => number | bigint> = {
  mochi_fuzzy_match: (text, _needle, start, end) => {
    if (asStr(text).includes('FORCE_NEG')) return 0;
    start[0] = 3n;
    end[0] = 8n;
    return 1;
  },
  mochi_git_branch: (dir, buf) => {
    if (asStr(dir).includes('FORCE_NOBRANCH')) return 0;
    buf.write('main', 'utf8');
    return 4;
  },
  mochi_search: (_dir, query, _glob, _limit, buf) => {
    if (asStr(query).includes('FORCE_EMPTY')) return 0;
    return writeJ(buf, 'src/a.ts:1:hit');
  },
  mochi_strip_think_tags: (text, buf) => {
    if (asStr(text).includes('FORCE_NEG')) return -1;
    buf.write('cleaned', 'utf8');
    return 7;
  },
  mochi_hash_prompt: () => 123456789,
  mochi_estimate_cost_usd: () => 0.0042,
  mochi_diff_numstat: (out, files, adds, dels) => {
    if (asStr(out).includes('FORCE_NEG')) return 0;
    files[0] = 2n;
    adds[0] = 10n;
    dels[0] = 3n;
    return 1;
  },
  mochi_classify_prompt: (p) => (asStr(p).includes('investigate') ? 2 : 0),
  mochi_redact_secrets: (input, buf) => {
    if (asStr(input).includes('FORCE_NEG')) return -1;
    buf.write('[secret-redacted]', 'utf8');
    return 17;
  },
  mochi_budget_decide: (input, buf) => {
    const s = asStr(input);
    if (s.includes('FORCE_BAD')) return writeJ(buf, 'not-json');
    if (s.includes('FORCE_PHASE9')) return writeJ(buf, '{"ratio":0.9,"phase":9}');
    return writeJ(buf, '{"ratio":0.5,"phase":4}');
  },
  mochi_classify_command: (cmd) => {
    const s = asStr(cmd);
    if (s.includes('FORCE_UNKNOWN')) return 9;
    return /rm\s+-rf/.test(s) ? 2 : /curl|wget/.test(s) ? 1 : 0;
  },
  mochi_fold_output: (input, buf) => {
    if (asStr(input).includes('FORCE_BAD')) return writeJ(buf, 'not-json');
    return writeJ(buf, JSON.stringify({ head: ['a'], tail: ['z'], omitted: 0, truncated: false, truncatedBy: 'none', totalLines: 2, totalBytes: 4 }));
  },
  mochi_command_available: (input, buf) => {
    if (asStr(input).includes('FORCE_BAD')) return writeJ(buf, 'not-json');
    return writeJ(buf, JSON.stringify({ available: true, bin: 'npm' }));
  },
  mochi_strip_ansi: (input, buf) => {
    if (asStr(input).includes('FORCE_NEG')) return -1;
    buf.write('plain', 'utf8');
    return 5;
  },
};

(globalThis as Record<string, unknown>).Bun = {
  dlopen: () => ({ symbols: SYMBOLS }),
  FFIType: { cstring: 'cstring', ptr: 'ptr', usize: 'usize', i32: 'i32', u64: 'u64', f64: 'f64' },
  // Identity "ptr": the shim passes the JS typed array / Buffer straight
  // through, and the fake symbols write results into it directly.
  ptr: (buf: unknown) => buf,
};

const limits = { maxTokens: 100, maxCostUsd: 1, maxDurationMs: 1000, maxToolCalls: 10, maxModelCalls: 10 };
const used = { usedTokens: 1, usedCostUsd: 0, usedDurationMs: 0, usedToolCalls: 0, usedModelCalls: 0 };

describe('native core Bun FFI path', () => {
  it('initializes via fake dlopen and dispatches every symbol', () => {
    expect(isNativeCoreAvailable()).toBe(true);

    expect(nativeFuzzyMatch('hello world', 'world')).toEqual({ start: 3, end: 8 });
    expect(nativeFuzzyMatch('FORCE_NEG', 'x')).toBeNull();

    expect(nativeGitBranch('/repo')).toBe('main');
    expect(nativeGitBranch('/FORCE_NOBRANCH')).toBeNull();

    expect(nativeSearchDir('/r', 'q')).toContain('src/a.ts');
    expect(nativeSearchDir('/r', 'FORCE_EMPTY')).toBeNull();

    expect(nativeStripThinkTags('think')).toBe('cleaned');
    expect(nativeStripThinkTags('FORCE_NEG')).toBeNull();

    expect(nativeHashPrompt('p')).toBe(123456789n);
    expect(nativeEstimateCostUsd('m', 10, 5)).toBeCloseTo(0.0042);

    expect(nativeDiffNumstat('stat')).toEqual({ files: 2, additions: 10, deletions: 3 });
    expect(nativeDiffNumstat('FORCE_NEG')).toBeNull();

    expect(nativeClassifyPrompt('investigate the crash')).toBe('investigation');
    expect(nativeClassifyPrompt('tell me a joke')).toBeNull(); // code 0 -> default null

    expect(nativeRedactSecrets('sk-abc123')).toBe('[secret-redacted]');
    expect(nativeRedactSecrets('FORCE_NEG')).toBeNull();
    expect(nativeRedactSecrets('')).toBe('');

    expect(nativeBudgetDecide(limits, used)).toEqual({ ratio: 0.5, phase: 4, phaseName: 'full' });
    // Out-of-range phase codes fall back to 'full'.
    expect(nativeBudgetDecide({ ...limits, marker: 'FORCE_PHASE9' } as never, used)).toMatchObject({ ratio: 0.9, phase: 9, phaseName: 'full' });
    expect(nativeBudgetDecide({ ...limits, marker: 'FORCE_BAD' } as never, used)).toBeNull();

    expect(nativeClassifyCommand('rm -rf /')).toBe('destructive');
    expect(nativeClassifyCommand('curl http://x')).toBe('network');
    expect(nativeClassifyCommand('ls -la')).toBe('low');
    expect(nativeClassifyCommand('FORCE_UNKNOWN')).toBeNull(); // unmapped code falls through

    const fold = nativeFoldOutput('x', 10, 100);
    expect(fold).toMatchObject({ head: ['a'], tail: ['z'], truncatedBy: 'none', totalLines: 2 });
    expect(nativeFoldOutput('FORCE_BAD', 1, 1)).toBeNull();

    expect(nativeCommandAvailable('npx vitest', '/w', 'PATH')).toEqual({ available: true, bin: 'npm' });
    expect(nativeCommandAvailable('FORCE_BAD', '/w', 'PATH')).toBeNull();

    expect(nativeStripAnsi('\x1b[31mred\x1b[0m')).toBe('plain');
    expect(nativeStripAnsi('FORCE_NEG')).toBeNull();
    expect(nativeStripAnsi('')).toBe('');

    // TS-only helpers have no Bun wiring: ffi is up, but they still return
    // null so callers use the TS implementations.
    expect(nativeCountTokens('x')).toBeNull();
    expect(nativeTruncateToTokens('x', 1)).toBeNull();
    expect(nativeUnifiedDiff('a', 'b')).toBeNull();
    expect(nativeSkeletonizeSource('const a = 1;')).toBeNull();
  });
});
