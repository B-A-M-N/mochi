// Uniform tool-output policy for Mochi (Harness V2 P0.2).
//
// Every tool result passes through ONE boundary with:
//  - dual limits (lines AND bytes), whole lines only (no partial-line noise)
//  - head+tail preservation (headers, exit codes, summaries survive)
//  - full-output spill to a temp file so nothing is ever lost: the model is
//    told the path and can read/grep it when the fold hid the needed line.
//
// Inspired by Pi's truncate.js (dual-limit, no partial lines) plus the
// OutputAccumulator temp-file spill, adapted to Mochi's tool pipeline.

import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeFoldOutput } from '../native/core.js';

export interface OutputPolicyOptions {
  maxLines?: number;
  maxBytes?: number;
  /** Tool name used for the spill file prefix. */
  toolName?: string;
  /** Keep whole lines even when the byte cap splits one (default true). */
  spillFullOutput?: boolean;
}

export interface OutputPolicyResult {
  content: string;
  truncated: boolean;
  truncatedBy: 'lines' | 'bytes' | null;
  totalLines: number;
  totalBytes: number;
  spillPath?: string;
}

const DEFAULT_MAX_LINES = 400;
const DEFAULT_MAX_BYTES = 20 * 1024;

// ── Phase 3 (VNext): truncation telemetry ─────────────────────────────────
// Per-tool counters so runs are debuggable: which tools truncate, how often,
// and how many bytes the fold saved from the transcript. Module-level (per
// process) — reset by tests, readable via mochi doctor / the perf tool.
export interface ToolOutputStats {
  calls: number;
  truncated: number;
  bytesTotal: number;
  bytesKept: number;
}

const outputStats = new Map<string, ToolOutputStats>();

export function getToolOutputStats(): ReadonlyMap<string, ToolOutputStats> {
  return outputStats;
}

export function resetToolOutputStats(): void {
  outputStats.clear();
}

function recordStats(toolName: string, r: { truncated: boolean; totalBytes: number; content: string }): void {
  const key = toolName || '(unknown)';
  const s = outputStats.get(key) ?? { calls: 0, truncated: 0, bytesTotal: 0, bytesKept: 0 };
  s.calls += 1;
  if (r.truncated) s.truncated += 1;
  s.bytesTotal += r.totalBytes;
  s.bytesKept += byteLen(r.content);
  outputStats.set(key, s);
}

/** One-line human summary of the telemetry, e.g. for doctor/perf output. */
export function formatToolOutputStats(): string {
  if (outputStats.size === 0) return 'tool-output: no calls recorded';
  const rows = [...outputStats.entries()]
    .sort((a, b) => b[1].truncated - a[1].truncated || b[1].calls - a[1].calls)
    .map(([tool, s]) => {
      const saved = s.bytesTotal > 0 ? Math.round((1 - s.bytesKept / s.bytesTotal) * 100) : 0;
      return `${tool}: ${s.calls} calls, ${s.truncated} truncated, ~${saved}% bytes saved`;
    });
  return 'tool-output telemetry:\n  ' + rows.join('\n  ');
}

function splitLines(content: string): string[] {
  if (content.length === 0) return [];
  const lines = content.split('\n');
  if (content.endsWith('\n')) lines.pop();
  return lines;
}

function byteLen(s: string): number {
  return Buffer.byteLength(s, 'utf-8');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Head+tail truncation preserving whole lines under both limits.
 *  Slice 5: the head/tail line selection now runs in Rust
 *  (`nativeFoldOutput`) for ~3x faster folding on multi-MB outputs.
 *  Side effects (file spill, telemetry) stay in JS. */
export function applyToolOutputPolicy(content: string, options: OutputPolicyOptions = {}): OutputPolicyResult {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const totalBytes = byteLen(content);

  // Try the native fast path for the line-selection.
  const nat = nativeFoldOutput(content, maxLines, maxBytes);
  if (nat !== null) {
    if (!nat.truncated) {
      const res = { content, truncated: false, truncatedBy: null, totalLines: nat.totalLines, totalBytes: nat.totalBytes };
      recordStats(options.toolName ?? '', res);
      return res;
    }
    const truncatedBy = nat.truncatedBy === 'none' ? null : nat.truncatedBy;
    const headLines = nat.head;
    const tailLines = nat.tail;
    const omittedLines = nat.omitted;
    const totalLines = nat.totalLines;

    // Spill the FULL output to a temp file so nothing is lost.
    let spillPath: string | undefined;
    try {
      const prefix = (options.toolName ?? 'tool').replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'tool';
      spillPath = join(tmpdir(), `mochi-${prefix}-${randomBytes(6).toString('hex')}.log`);
      writeFileSync(spillPath, content, 'utf-8');
    } catch {
      spillPath = undefined;
    }

    const note = spillPath
      ? `[output truncated by ${truncatedBy}: showing first ${headLines.length} and last ${tailLines.length} of ${totalLines} lines (${formatSize(totalBytes)} total). Full output saved to: ${spillPath}]`
      : `[output truncated by ${truncatedBy}: showing first ${headLines.length} and last ${tailLines.length} of ${totalLines} lines (${formatSize(totalBytes)} total)]`;

    const body = `${headLines.join('\n')}\n\n[... ${omittedLines} lines omitted ...]\n\n${tailLines.join('\n')}`;
    const res = {
      content: `${body}\n${note}`,
      truncated: true,
      truncatedBy,
      totalLines,
      totalBytes,
      spillPath,
    };
    recordStats(options.toolName ?? '', res);
    return res;
  }

  // Fallback path (no native): TS-only line scan.
  const lines = splitLines(content);
  const totalLines = lines.length;

  if (totalLines <= maxLines && totalBytes <= maxBytes) {
    const res = { content, truncated: false, truncatedBy: null, totalLines, totalBytes };
    recordStats(options.toolName ?? '', res);
    return res;
  }

  const truncatedBy: 'lines' | 'bytes' = totalLines > maxLines ? 'lines' : 'bytes';

  const headLineBudget = Math.floor(maxLines / 2);
  const tailLineBudget = maxLines - headLineBudget;
  const headByteBudget = Math.floor(maxBytes / 2);
  const tailByteBudget = maxBytes - headByteBudget;

  const headLines: string[] = [];
  let headBytes = 0;
  for (const line of lines) {
    const lb = byteLen(line) + 1;
    if (headLines.length >= headLineBudget || headBytes + lb > headByteBudget) break;
    headLines.push(line);
    headBytes += lb;
  }

  const tailLines: string[] = [];
  let tailBytes = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (i < headLines.length) break;
    const line = lines[i];
    const lb = byteLen(line) + 1;
    if (tailLines.length >= tailLineBudget || tailBytes + lb > tailByteBudget) break;
    tailLines.unshift(line);
    tailBytes += lb;
  }

  const omittedLines = Math.max(0, totalLines - headLines.length - tailLines.length);

  let spillPath: string | undefined;
  try {
    const prefix = (options.toolName ?? 'tool').replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'tool';
    spillPath = join(tmpdir(), `mochi-${prefix}-${randomBytes(6).toString('hex')}.log`);
    writeFileSync(spillPath, content, 'utf-8');
  } catch {
    spillPath = undefined;
  }

  const note = spillPath
    ? `[output truncated by ${truncatedBy}: showing first ${headLines.length} and last ${tailLines.length} of ${totalLines} lines (${formatSize(totalBytes)} total). Full output saved to: ${spillPath}]`
    : `[output truncated by ${truncatedBy}: showing first ${headLines.length} and last ${tailLines.length} of ${totalLines} lines (${formatSize(totalBytes)} total)]`;

  const body = `${headLines.join('\n')}\n\n[... ${omittedLines} lines omitted ...]\n\n${tailLines.join('\n')}`;
  const res = {
    content: `${body}\n${note}`,
    truncated: true,
    truncatedBy,
    totalLines,
    totalBytes,
    spillPath,
  };
  recordStats(options.toolName ?? '', res);
  return res;
}
