// Covers the TS-only fallback line-scan path of applyToolOutputPolicy plus
// the telemetry formatters. The main tool-output.test.ts runs against the
// built native fold (nativeFoldOutput), so lines 149+ of tool-output.ts —
// the fallback used whenever the native addon is unavailable — can never
// execute there. Mocking the native module to `null` forces this path.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';

vi.mock('../native/core.js', () => ({ nativeFoldOutput: () => null }));

import { applyToolOutputPolicy, formatToolOutputStats, getToolOutputStats, resetToolOutputStats } from './tool-output.js';

beforeEach(() => resetToolOutputStats());

describe('applyToolOutputPolicy (TS fallback path)', () => {
  it('passes small outputs through untouched', () => {
    const r = applyToolOutputPolicy('a\nb\n');
    expect(r.truncated).toBe(false);
    expect(r.truncatedBy).toBeNull();
    expect(r.totalLines).toBe(2);
    expect(r.content).toBe('a\nb\n');
    expect(r.spillPath).toBeUndefined();
  });

  it('treats the empty string as zero work', () => {
    const r = applyToolOutputPolicy('');
    expect(r.truncated).toBe(false);
    expect(r.totalLines).toBe(0);
    expect(r.totalBytes).toBe(0);
  });

  it('truncates by lines with head/tail + spill file', () => {
    const big = Array.from({ length: 300 }, (_, i) => `row-${i}`).join('\n');
    const r = applyToolOutputPolicy(big, { maxLines: 20, toolName: 'fallback-shell' });
    expect(r.truncated).toBe(true);
    expect(r.truncatedBy).toBe('lines');
    expect(r.totalLines).toBe(300);
    expect(r.content).toContain('row-0');
    expect(r.content).toContain('row-299');
    expect(r.content).not.toContain('row-150\n');
    expect(r.content).toContain('[... 280 lines omitted ...]');
    expect(r.spillPath).toBeDefined();
    expect(existsSync(r.spillPath!)).toBe(true);
    expect(readFileSync(r.spillPath!, 'utf8')).toBe(big);
    expect(r.content).toContain(r.spillPath!);
    rmSync(r.spillPath!);
  });

  it('truncates by bytes when few lines are huge', () => {
    const long = Array.from({ length: 8 }, () => 'z'.repeat(4000)).join('\n');
    const r = applyToolOutputPolicy(long, { maxBytes: 3000 });
    expect(r.truncated).toBe(true);
    expect(r.truncatedBy).toBe('bytes');
    expect(r.content.length).toBeLessThan(long.length);
    expect(r.content).toContain('lines omitted');
    rmSync(r.spillPath!);
  });

  it('reports MB-scale sizes in the truncation note', () => {
    const huge = 'm'.repeat(1_100_000);
    const r = applyToolOutputPolicy(huge, { maxBytes: 10_000 });
    expect(r.truncated).toBe(true);
    expect(r.content).toMatch(/1\.0MB total/); // 1,100,000 bytes = 1.05MiB -> "1.0"
    rmSync(r.spillPath!);
  });

  it('never splits a line in the middle', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `L${i}-${'q'.repeat(60)}`);
    const r = applyToolOutputPolicy(lines.join('\n'), { maxLines: 10, maxBytes: 100_000 });
    expect(r.content).toContain(lines[0]);
    expect(r.content).toContain(lines[199]);
    rmSync(r.spillPath!);
  });
});

describe('tool-output telemetry', () => {
  it('reports empty telemetry before any calls', () => {
    expect(formatToolOutputStats()).toBe('tool-output: no calls recorded');
  });

  it('accumulates per-tool counters and formats a sorted summary', () => {
    const small = applyToolOutputPolicy('ok', { toolName: 'read' });
    expect(small.truncated).toBe(false);
    const big = Array.from({ length: 500 }, (_, i) => `b-${i}`).join('\n');
    const t1 = applyToolOutputPolicy(big, { toolName: 'shell', maxLines: 10 });
    const t2 = applyToolOutputPolicy(big, { toolName: 'shell', maxLines: 10 });
    rmSync(t1.spillPath!);
    rmSync(t2.spillPath!);

    const stats = getToolOutputStats();
    expect(stats.get('read')).toMatchObject({ calls: 1, truncated: 0 });
    expect(stats.get('shell')).toMatchObject({ calls: 2, truncated: 2 });
    expect(stats.get('shell')!.bytesKept).toBeLessThan(stats.get('shell')!.bytesTotal);

    const out = formatToolOutputStats();
    expect(out).toContain('tool-output telemetry:');
    expect(out).toContain('shell: 2 calls, 2 truncated');
    expect(out).toContain('read: 1 calls, 0 truncated');
    // Most-truncated tool sorts first.
    expect(out.indexOf('shell:')).toBeLessThan(out.indexOf('read:'));
    expect(out).toMatch(/~\d+% bytes saved/);
  });

  it('counts zero-byte calls without dividing by zero', () => {
    applyToolOutputPolicy('', { toolName: 'empty-tool' });
    const out = formatToolOutputStats();
    expect(out).toContain('empty-tool: 1 calls, 0 truncated, ~0% bytes saved');
  });

  it('reset clears all counters', () => {
    applyToolOutputPolicy('x', { toolName: 'gone' });
    expect(getToolOutputStats().size).toBeGreaterThan(0);
    resetToolOutputStats();
    expect(getToolOutputStats().size).toBe(0);
    expect(formatToolOutputStats()).toBe('tool-output: no calls recorded');
  });
});
