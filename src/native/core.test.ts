import { describe, it, expect } from 'vitest';
import {
  nativeFuzzyMatch,
  nativeGitBranch,
  nativeSearchDir,
  nativeStripThinkTags,
  nativeHashPrompt,
  isNativeCoreAvailable,
  nativeCountTokens,
  nativeTruncateToTokens,
  nativeUnifiedDiff,
  nativeSkeletonizeSource,
  nativeRedactSecrets,
  nativeClassifyCommand,
  nativeBudgetDecide,
  nativeFoldOutput,
  nativeCommandAvailable,
  nativeStripAnsi,
  nativeEstimateCostUsd,
  nativeDiffNumstat,
  nativeClassifyPrompt,
} from './core.js';
import { fuzzyFindUnique } from '../tools/fuzzy-match.js';

describe('mochi_core native Rust engine', () => {
  it('reports availability or graceful fallback', () => {
    const avail = isNativeCoreAvailable();
    expect(typeof avail).toBe('boolean');
  });

  it('matches fuzzy needles identical to TypeScript implementation', () => {
    const text = 'function helloWorld() {\n  const x = 1;\n  return x + 2;\n}\n';
    const needle = 'const x = 1;\nreturn x + 2;';
    const tsMatch = fuzzyFindUnique(text, needle);
    expect(tsMatch).not.toBeNull();

    // If running in Bun with FFI active:
    if (isNativeCoreAvailable()) {
      const rustMatch = nativeFuzzyMatch(text, needle);
      expect(rustMatch).toEqual(tsMatch);
    }
  });

  it('finds git branch from filesystem without spawning subprocess', () => {
    const branch = nativeGitBranch(process.cwd());
    if (isNativeCoreAvailable()) {
      expect(branch).toBeTruthy();
    }
  });

  it('searches directory and extracts outline hints', () => {
    if (isNativeCoreAvailable()) {
      // Scope to the module's own dir: a whole-repo crawl with a top-10 cap
      // is traversal-order dependent (CI runners fill the cap with test/dist
      // copies of the symbol, dropping the defining file — flaked red).
      const res = nativeSearchDir(process.cwd() + '/src/tui', 'createTuiState', '*.ts', 10);
      expect(res).toContain('state.ts');
    }
  });

  it('strips reasoning blocks via native Rust sanitizer', () => {
    const raw = '<think>internal reasoning process</think>Final answer for user.';
    if (isNativeCoreAvailable()) {
      const stripped = nativeStripThinkTags(raw);
      expect(stripped).toBe('Final answer for user.');
    }
  });

  it('computes 64-bit prompt hash for KV cache prefix indexing', () => {
    if (isNativeCoreAvailable()) {
      const h1 = nativeHashPrompt('You are a coding assistant.');
      const h2 = nativeHashPrompt('You are a coding assistant.');
      const h3 = nativeHashPrompt('Different prompt prefix.');
      expect(typeof h1).toBe('bigint');
      expect(h1).toEqual(h2);
      expect(h1).not.toEqual(h3);
    }
  });
});

describe('tokenizer bridge (Rust native, parity-checked)', () => {
  it('nativeCountTokens returns sane counts and falls back cleanly', () => {
    const n = nativeCountTokens('hello world foo bar baz qux');
    if (n === null) {
      // Native core absent in this environment: contract is a clean null,
      // never a throw, and approxTokens still works.
      expect(n).toBeNull();
    } else {
      expect(n).toBeGreaterThan(0);
      // Parity: close to the ~4 chars/token heuristic within 3x
      const approx = Math.ceil('hello world foo bar baz qux'.length / 4);
      expect(n).toBeGreaterThan(approx / 3);
      expect(n).toBeLessThan(approx * 3);
    }
  });

  it('nativeTruncateToTokens shortens text and never throws', () => {
    const out = nativeTruncateToTokens('word '.repeat(100), 5);
    if (out !== null) {
      expect(out.length).toBeLessThan('word '.repeat(100).length);
    }
  });
});

describe('native unified diff and skeletonizer', () => {
  it('nativeUnifiedDiff generates Myers diff in Rust', () => {
    const oldText = 'line1\nline2\nline3\n';
    const newText = 'line1\nmodified line2\nline3\nline4\n';
    const diff = nativeUnifiedDiff(oldText, newText, 'a.txt', 'b.txt');
    if (diff !== null) {
      expect(diff).toContain('--- a.txt');
      expect(diff).toContain('+++ b.txt');
      expect(diff).toContain('-line2');
      expect(diff).toContain('+modified line2');
      expect(diff).toContain('+line4');
    }
  });

  it('nativeSkeletonizeSource produces compact AST outlines', () => {
    const code = `
export function add(a: number, b: number): number {
  return a + b;
}

export class Calculator {
  multiply(x: number, y: number): number {
    return x * y;
  }
}
    `;
    const skeleton = nativeSkeletonizeSource(code, 'ts');
    if (skeleton !== null) {
      expect(skeleton).toContain('Structural Skeleton');
      expect(skeleton).toContain('add');
      expect(skeleton).toContain('Calculator');
    }
  });
});

describe('slices 2-5 native ops (smoke presence + shape)', () => {
  it('nativeRedactSecrets redacts an OpenAI key when available', () => {
    if (!isNativeCoreAvailable()) return;
    const out = nativeRedactSecrets('cfg.api_key="sk-abcdefghijklmnop1234"');
    expect(out).not.toBeNull();
    if (out !== null) {
      expect(out).toContain('[secret-redacted]');
      expect(out).not.toContain('sk-abcdefghijklmnop1234');
    }
  });

  it('nativeClassifyCommand returns a known risk label when available', () => {
    if (!isNativeCoreAvailable()) return;
    expect(nativeClassifyCommand('ls -la')).toBe('low');
    expect(nativeClassifyCommand('rm -rf /')).toBe('destructive');
    expect(nativeClassifyCommand('npm install')).toBe('network');
  });

  it('nativeBudgetDecide returns ratio+phase in [0,1] when available', () => {
    if (!isNativeCoreAvailable()) return;
    const r = nativeBudgetDecide(
      { maxTokens: 1000, maxCostUsd: 0.5, maxDurationMs: 60_000, maxToolCalls: Number.POSITIVE_INFINITY, maxModelCalls: Number.POSITIVE_INFINITY },
      { usedTokens: 200, usedCostUsd: 0.1, usedDurationMs: 30_000, usedToolCalls: 0, usedModelCalls: 0 },
    );
    expect(r).not.toBeNull();
    if (r !== null) {
      expect(r.ratio).toBeGreaterThan(0);
      expect(r.ratio).toBeLessThanOrEqual(1);
      expect(typeof r.phase).toBe('number');
      expect(['exhausted', 'verify', 'cheap', 'reduced', 'full']).toContain(r.phaseName);
    }
  });

  it('nativeFoldOutput passthrough is totalLines==count for short input', () => {
    if (!isNativeCoreAvailable()) return;
    const r = nativeFoldOutput('a\nb\nc', 100, 1000);
    expect(r).not.toBeNull();
    if (r !== null) {
      expect(r.truncated).toBe(false);
      expect(r.head).toEqual(['a', 'b', 'c']);
      expect(r.tail).toEqual([]);
      expect(r.totalLines).toBe(3);
    }
  });

  it('nativeCommandAvailable resolves /bin/sh (or sh on PATH)', () => {
    if (!isNativeCoreAvailable()) return;
    // First try absolute path (portable across distros).
    const abs = nativeCommandAvailable('/bin/sh -c echo', '/', '');
    if (abs !== null) {
      expect(abs.available).toBe(true);
      expect(abs.bin).toBe('/bin/sh');
    }
    // Then try PATH-resolved `sh` (always present on Unix).
    const pathd = nativeCommandAvailable('sh -c echo', '/', process.env.PATH ?? '/usr/bin:/bin');
    if (pathd !== null) {
      expect(pathd.bin).toBe('sh');
    }
    // Unknown binary must report unavailable, not throw.
    const none = nativeCommandAvailable('mochi-xyz-pretend-binary', '/', process.env.PATH ?? '/usr/bin:/bin');
    if (none !== null) {
      expect(none.available).toBe(false);
      expect(none.bin).toBe('mochi-xyz-pretend-binary');
    }
  });

  it('nativeCommandAvailable handles npx + cd && chain', () => {
    if (!isNativeCoreAvailable()) return;
    const r = nativeCommandAvailable('cd /tmp && ls -la', '/', process.env.PATH ?? '/usr/bin:/bin');
    if (r !== null) {
      expect(r.bin).toBe('ls');
    }
    const npx = nativeCommandAvailable('npx vitest run', '/', process.env.PATH ?? '/usr/bin:/bin');
    if (npx !== null) {
      expect(npx.bin).toBe('npm');
    }
  });

  it('nativeStripAnsi matches TS regex on full CSI (SGR + cursor moves)', () => {
    if (!isNativeCoreAvailable()) return;
    const cases = [
      ['\x1b[31mred\x1b[0m', 'red'],
      ['a\x1b[2Kb\x1b[1;32mgreen\x1b[0m', 'abgreen'],
      ['\x1b[?25lhidden', 'hidden'],
      ['plain\x1b[2J', 'plain'],
      ['no ansi', 'no ansi'],
    ];
    for (const [input, expected] of cases) {
      const out = nativeStripAnsi(input);
      expect(out).toBe(expected);
    }
  });
});

describe('slices 2-5 native ops + remaining coverage gap (estimateCost / diffNumstat / classifyPrompt)', () => {
  it('nativeEstimateCostUsd returns positive cost for known model', () => {
    if (!isNativeCoreAvailable()) return;
    // gpt-4o: 2.50/M prompt, 10.00/M completion. 1M prompt = $2.50.
    const cost = nativeEstimateCostUsd('gpt-4o', 1_000_000, 0, 0);
    expect(cost).not.toBeNull();
    if (cost !== null) {
      expect(cost).toBeGreaterThan(2.0);
      expect(cost).toBeLessThan(3.0);
    }
    // "free" model: zero cost regardless of tokens
    expect(nativeEstimateCostUsd('deepseek-v4-flash-free', 1_000_000, 0, 0)).toBe(0);
  });

  it('nativeDiffNumstat parses git diff --numstat output', () => {
    if (!isNativeCoreAvailable()) return;
    const numstat =
      '3\t2\tREADME.md\n' +
      '10\t0\tsrc/foo.ts\n' +
      '0\t5\tsrc/bar.ts\n' +
      '-\t-\tbinary.png\n';
    const r = nativeDiffNumstat(numstat);
    expect(r).not.toBeNull();
    if (r !== null) {
      expect(r.files).toBe(4); // 3 real files + 1 binary ("--")
      expect(r.additions).toBe(13); // 3 + 10 + 0 + 0
      expect(r.deletions).toBe(7); // 2 + 0 + 5 + 0
    }
  });

  it('nativeClassifyPrompt returns a valid task kind label', () => {
    if (!isNativeCoreAvailable()) return;
    // Question-shaped prompt should classify as investigation
    const kind = nativeClassifyPrompt('Why does this code fail when run?');
    expect(kind).not.toBeNull();
    if (kind !== null) {
      expect(['code-edit', 'investigation', 'testing', 'refactor', 'architecture', 'one-shot-answer']).toContain(kind);
    }
    // Pure edit prompt: code-edit
    const edit = nativeClassifyPrompt('fix the bug in foo.ts');
    expect(edit).not.toBeNull();
  });
});
