/**
 * `mochi apply` — atomic multi-file patch application.
 *
 * Reads a unified diff (git format) from a file or stdin, validates every
 * target against the working tree, then applies ALL files or NONE: originals
 * of every touched path are snapshotted before the first write, and any
 * parse/apply failure mid-way restores every already-written file before
 * returning an error. New files are created; deletions remove the file.
 * Never touches the git index — review with `git diff` afterwards.
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { atomicWriteFileSync } from './core/atomic-fs.js';

export interface ApplyResult {
  applied: string[];   // paths written/updated
  created: string[];   // paths that did not exist before
  deleted: string[];   // paths removed
  skipped: string[];   // hunks that were already applied (no-op)
}

interface FileOp { path: string; op: 'update' | 'create' | 'delete'; hunks: string[]; }

/** Parse a unified diff into per-file operations. Throws on malformed input. */
export function parseUnifiedDiff(diffText: string): FileOp[] {
  const ops: FileOp[] = [];
  const lines = diffText.split('\n');
  let i = 0;
  const stripA = (p: string) => p.replace(/^[ab]\//, '');
  while (i < lines.length) {
    // Standard git diff headers:
    const diffHeader = lines[i].startsWith('diff --git');
    if (!diffHeader) { i++; continue; }
    let oldPath: string | null = null;
    let newPath: string | null = null;
    i++;
    // Collect ---/+++ headers
    while (i < lines.length && !lines[i].startsWith('@@')) {
      if (lines[i].startsWith('--- ')) oldPath = lines[i].slice(4).trim();
      else if (lines[i].startsWith('+++ ')) newPath = lines[i].slice(4).trim();
      i++;
    }
    if (i >= lines.length || !lines[i].startsWith('@@')) {
      // diff header with no hunks (rename-only / mode change) — skip
      continue;
    }
    const hunks: string[] = [];
    while (i < lines.length && (lines[i].startsWith('@@') || /^[ +\-\\]/.test(lines[i]))) {
      if (lines[i].startsWith('\\')) { i++; continue; } // "\ No newline at end"
      if (lines[i].startsWith('@@')) { hunks.push(lines[i]); i++; continue; }
      hunks.push(lines[i]); i++;
    }
    if (!oldPath || !newPath) throw new Error(`Malformed diff near line ${i}: missing ---/+++ headers`);
    let op: FileOp['op'];
    if (oldPath === '/dev/null') op = 'create';
    else if (newPath === '/dev/null') op = 'delete';
    else op = 'update';
    const path = stripA(op === 'create' ? newPath : op === 'delete' ? oldPath : newPath);
    if (!path || path.includes('..')) throw new Error(`Unsafe path in diff: ${path}`);
    ops.push({ path, op, hunks });
  }
  return ops;
}

/** Apply hunks to content. Returns null when a hunk doesn't match (context drift). */
export function applyHunks(content: string, hunks: string[]): string | null {
  const src = content.length ? content.split('\n') : [];
  // Pre-compute hunk ranges: @@ -oldStart,oldCount +newStart,newCount @@
  type H = { oldStart: number; oldLines: string[]; newLines: string[] };
  const parsed: H[] = [];
  let cur: H | null = null;
  for (const l of hunks) {
    const hm = l.match(/^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/);
    if (hm) {
      cur = { oldStart: parseInt(hm[1], 10), oldLines: [], newLines: [] };
      parsed.push(cur);
      continue;
    }
    if (!cur) continue;
    if (l.startsWith('+')) cur.newLines.push(l.slice(1));
    else if (l.startsWith('-')) cur.oldLines.push(l.slice(1));
    else if (l.startsWith(' ')) { cur.oldLines.push(l.slice(1)); cur.newLines.push(l.slice(1)); }
  }
  // Apply bottom-up so earlier offsets stay valid.
  for (const h of parsed.reverse()) {
    const idx = h.oldStart - 1;
    const slice = src.slice(idx, idx + h.oldLines.length);
    const matches = h.oldLines.length === 0
      ? true
      : slice.length === h.oldLines.length && slice.every((s, k) => s === h.oldLines[k]);
    if (!matches) return null;
    src.splice(idx, h.oldLines.length, ...h.newLines);
  }
  return src.join('\n');
}

/**
 * Atomically apply a unified diff to the working tree at `root`.
 * All-or-nothing: on any failure every file already written this run is
 * restored to its pre-apply content (new files are removed).
 */
export function applyDiffAtomically(root: string, diffText: string): ApplyResult {
  const ops = parseUnifiedDiff(diffText);
  if (ops.length === 0) throw new Error('No file operations found in diff.');
  const result: ApplyResult = { applied: [], created: [], deleted: [], skipped: [] };
  const rollback: Array<{ path: string; prev: string | null }> = [];
  const abs = (p: string) => (isAbsolute(p) ? p : resolve(root, p));

  try {
    for (const op of ops) {
      const target = abs(op.path);
      const prev = existsSync(target) ? readFileSync(target, 'utf8') : null;
      if (op.op === 'delete') {
        if (prev === null) { result.skipped.push(op.path); continue; }
        unlinkSync(target);
        rollback.push({ path: target, prev });
        result.deleted.push(op.path);
        result.applied.push(op.path);
        continue;
      }
      let next: string | null;
      if (op.op === 'create') {
        if (prev !== null) { result.skipped.push(op.path); continue; }
        next = applyHunks('', op.hunks) ?? '';
      } else {
        if (prev === null) throw new Error(`Cannot update missing file: ${op.path} (use create or check path)`);
        next = applyHunks(prev, op.hunks);
        if (next === null) throw new Error(`Hunk context mismatch in ${op.path} — file drifts from diff. Aborting (no changes written for this file).`);
        if (next === prev) { result.skipped.push(op.path); continue; }
      }
      mkdirSync(dirname(target), { recursive: true });
      atomicWriteFileSync(target, next);
      rollback.push({ path: target, prev });
      if (prev === null) result.created.push(op.path);
      result.applied.push(op.path);
    }
  } catch (err) {
    // Roll back every write this run made, in reverse order.
    for (const rb of rollback.reverse()) {
      try {
        if (rb.prev === null) unlinkSync(rb.path);
        else writeFileSync(rb.path, rb.prev, 'utf8');
      } catch { /* best-effort restore; primary error is rethrown */ }
    }
    throw err;
  }
  return result;
}
