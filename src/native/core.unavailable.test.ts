// Covers the "native core unavailable" contract: with neither the N-API
// addon nor Bun FFI present, every export returns null (or '' for the
// empty-input guards) instead of throwing — callers rely on this to fall
// back to the TS implementations. The addon probe is disabled by stubbing
// existsSync for mochi_core paths; this worker has no globalThis.Bun, so
// initNativeCore leaves ffiAvailable=false.
import { describe, it, expect, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: (p: Parameters<typeof actual.existsSync>[0]) =>
      String(p).includes('mochi_core') ? false : actual.existsSync(p),
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

const limits = { maxTokens: 100, maxCostUsd: 1, maxDurationMs: 1000, maxToolCalls: 10, maxModelCalls: 10 };
const used = { usedTokens: 1, usedCostUsd: 0, usedDurationMs: 0, usedToolCalls: 0, usedModelCalls: 0 };

describe('native core with no addon and no Bun FFI', () => {
  it('probes once and reports unavailable', () => {
    expect(isNativeCoreAvailable()).toBe(false);
    // Idempotent: the probe does not re-run.
    expect(isNativeCoreAvailable()).toBe(false);
  });

  it('every dispatch returns null without throwing', () => {
    expect(nativeFuzzyMatch('abc', 'b')).toBeNull();
    expect(nativeGitBranch('/tmp')).toBeNull();
    expect(nativeSearchDir('/tmp', 'q')).toBeNull();
    expect(nativeStripThinkTags('think')).toBeNull();
    expect(nativeHashPrompt('x')).toBeNull();
    expect(nativeEstimateCostUsd('m', 1, 1)).toBeNull();
    expect(nativeDiffNumstat('a\tb')).toBeNull();
    expect(nativeClassifyPrompt('fix the bug')).toBeNull();
    expect(nativeCountTokens('x')).toBeNull();
    expect(nativeTruncateToTokens('x', 1)).toBeNull();
    expect(nativeUnifiedDiff('a', 'b')).toBeNull();
    expect(nativeSkeletonizeSource('const a = 1;')).toBeNull();
    expect(nativeBudgetDecide(limits, used)).toBeNull();
    expect(nativeClassifyCommand('ls')).toBeNull();
    expect(nativeFoldOutput('x', 10, 100)).toBeNull();
    expect(nativeCommandAvailable('ls', '/tmp', 'PATH')).toBeNull();
    expect(nativeStripAnsi('\x1b[31mred\x1b[0m')).toBeNull();
    expect(nativeRedactSecrets('sk-123456')).toBeNull();
  });

  it('empty-input string guards short-circuit to "" (no probe dispatch)', () => {
    expect(nativeRedactSecrets('')).toBe('');
    expect(nativeStripAnsi('')).toBe('');
  });
});
