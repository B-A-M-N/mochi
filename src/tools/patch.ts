import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Tool } from './types.js';
import { markMutation } from './fs-signal.js';
import { fuzzyFindUniqueNative as fuzzyFindUnique } from './native-match.js';
import { validateFileSyntax } from '../core/ast-guard.js';
import { atomicWriteFileSync } from '../core/atomic-fs.js';

// Codex-style patch application. The model emits a compact, token-efficient
// patch format instead of full-file rewrites or fragile exact-match blocks:
//
//   *** Begin Patch
//   *** Add File: path/new.ts
//   +export const x = 1;
//   *** Update File: src/app.ts
//   @@ optional class def anchor
//    context line
//   -removed line
//   +added line
//   *** Delete File: old.ts
//   *** End Patch
//
// Update hunks apply via context matching: each hunk's surrounding context
// lines locate the region (exact first, then whitespace-normalized fuzzy),
// then the -/+ lines are applied relative to that location. This is the same
// reliability story as git apply with a lenient matcher: small whitespace
// drift in remembered context does not fail the patch.

interface HunkLine {
  kind: 'ctx' | 'del' | 'add';
  text: string;
}

interface FilePatch {
  op: 'add' | 'update' | 'delete';
  path: string;
  anchor?: string; // text after the LAST @@ (informational + search hint)
  lines: HunkLine[]; // flat view of every hunk's lines (unchanged contract)
  hunks?: HunkLine[][]; // per-@@ groups; >1 means a multi-hunk update
}

export function parsePatch(patch: string): FilePatch[] {
  const raw = patch.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  // Skip leading lines before Begin Patch (prose like "Here is the patch:").
  const hasBegin = raw.some((l) => l.trim() === '*** Begin Patch');
  if (hasBegin) {
    while (i < raw.length && raw[i].trim() !== '*** Begin Patch') i++;
    i++;
  } else {
    while (i < raw.length && !raw[i].startsWith('*** ')) i++;
    if (i === raw.length) throw new Error('Patch is missing "*** Begin Patch" or valid patch directives');
  }

  const patches: FilePatch[] = [];
  let cur: FilePatch | null = null;
  // Each `@@` starts a NEW hunk group. A single `*** Update File:` section with
  // several `@@` markers is a multi-hunk update (very common); treating all lines
  // as one contiguous search block made every such patch fail to locate.
  let curHunk: HunkLine[] | null = null;
  const flushHunk = () => {
    if (cur && curHunk && curHunk.length) (cur.hunks ??= []).push(curHunk);
    curHunk = null;
  };
  for (; i < raw.length; i++) {
    const line = raw[i];
    if (line.startsWith('*** End Patch')) break;
    if (line.startsWith('*** Add File: ')) {
      flushHunk();
      cur = { op: 'add', path: line.slice('*** Add File: '.length).trim(), lines: [] };
      patches.push(cur);
    } else if (line.startsWith('*** Update File: ')) {
      flushHunk();
      cur = { op: 'update', path: line.slice('*** Update File: '.length).trim(), lines: [] };
      patches.push(cur);
    } else if (line.startsWith('*** Delete File: ')) {
      flushHunk();
      cur = { op: 'delete', path: line.slice('*** Delete File: '.length).trim(), lines: [] };
      patches.push(cur);
    } else if (line.startsWith('*** ')) {
      throw new Error(`Unknown patch directive: ${line}`);
    } else if (line.startsWith('@@') && cur && cur.op === 'update') {
      flushHunk();
      cur.anchor = line.slice(2).trim();
    } else if (cur) {
      let h: HunkLine;
      if (line.startsWith('+')) h = { kind: 'add', text: line.slice(1) };
      else if (line.startsWith('-')) h = { kind: 'del', text: line.slice(1) };
      else if (line.startsWith(' ')) h = { kind: 'ctx', text: line.slice(1) };
      else if (line.trim() === '') h = { kind: 'ctx', text: '' };
      else throw new Error(`Malformed patch line (expected +, -, space, or ***): ${line}`);
      cur.lines.push(h);
      (curHunk ??= []).push(h);
    }
    // Lines before any file directive are ignored.
  }
  flushHunk();

  if (patches.length === 0) throw new Error('Patch contains no file sections');
  return patches;
}

/** Apply one update hunk to file lines. Returns the new full line array. */
function applyHunk(fileLines: string[], hunk: HunkLine[]): string[] {
  // Build the search block from the hunk's context + deleted lines.
  const searchLines = hunk.filter((l) => l.kind !== 'add').map((l) => l.text);
  if (searchLines.length === 0) {
    // Pure insertion with no context: append at end.
    return [...fileLines, ...hunk.filter((l) => l.kind === 'add').map((l) => l.text)];
  }
  const search = searchLines.join('\n');
  const text = fileLines.join('\n');
  const exact = text.includes(search) ? { start: text.indexOf(search), end: text.indexOf(search) + search.length } : fuzzyFindUnique(text, search);
  if (!exact) throw new Error(`Could not locate patch context in file. Context: ${search.slice(0, 120)}`);
  const startLine = text.slice(0, exact.start).split('\n').length - 1;
  const endLine = text.slice(0, exact.end).split('\n').length - 1;

  const out: string[] = [];
  for (let i = 0; i < startLine; i++) out.push(fileLines[i]);
  // Re-emit context + added lines; drop only the removed lines. Previously this
  // pushed ONLY `add` lines, so every `ctx` line inside the located region was
  // silently deleted — a one-line change to a function body also wiped the
  // function header (and any other context lines), corrupting the file.
  for (const l of hunk) {
    if (l.kind === 'del') continue;
    out.push(l.text);
  }
  for (let i = endLine + 1; i < fileLines.length; i++) out.push(fileLines[i]);
  return out;
}

export function applyFilePatch(source: string, fp: FilePatch): string {
  let result = source.split('\n');
  // Multi-hunk update: locate and apply each `@@` group independently. Each
  // hunk re-locates by its own context, so earlier hunks shifting later line
  // numbers is fine. A failure on any hunk throws before anything is written.
  if (fp.hunks && fp.hunks.length > 1) {
    for (const hunk of fp.hunks) {
      const hasCtxOrDel = hunk.some((l) => l.kind !== 'add');
      if (hasCtxOrDel) {
        result = applyHunk(result, hunk);
      } else {
        const adds = hunk.map((l) => l.text);
        if (result.length && result[result.length - 1] === '') result.splice(result.length - 1, 0, ...adds);
        else result = [...result, ...adds];
      }
    }
    return result.join('\n');
  }
  // Single hunk (or pure-add section): unchanged behavior.
  const hasCtxOrDel = fp.lines.some((l) => l.kind !== 'add');
  if (hasCtxOrDel) {
    result = applyHunk(result, fp.lines);
  } else {
    // Pure additions: insert before the final empty line (EOF newline) if present.
    const adds = fp.lines.map((l) => l.text);
    if (result.length && result[result.length - 1] === '') result.splice(result.length - 1, 0, ...adds);
    else result = [...result, ...adds];
  }
  return result.join('\n');
}

export const patchTool: Tool = {
  def: {
    name: 'patch',
    description:
      'Apply a Codex-style patch to multiple files in one call. Format: "*** Begin Patch", then sections "*** Add File: <path>" (lines prefixed +), "*** Update File: <path>" (context lines start with a space, removals with -, additions with +, optional @@ anchor), "*** Delete File: <path>", ending with "*** End Patch". Updates match context exactly first, then tolerantly (whitespace-insensitive), so minor indentation drift still applies.',
    parameters: [
      { name: 'patch', type: 'string', description: 'The full patch text between *** Begin Patch and *** End Patch', required: true },
    ],
    permission: 'write',
  },
  async execute(args, ctx) {
    const patchText = String(args.patch ?? '');
    const patches = parsePatch(patchText);

    // Phase 1 — PLAN every file operation as a pure transformation. Any
    // parse/locate/conflict error throws HERE, before a single byte is written,
    // so a 5-file patch whose 4th file has drifted context does not leave the
    // first three half-applied (which the model then can't retry cleanly).
    type Plan =
      | { op: 'add'; path: string; fullPath: string; content: string }
      | { op: 'delete'; path: string; fullPath: string }
      | { op: 'update'; path: string; fullPath: string; content: string; before: string };
    const plans: Plan[] = [];
    // B13: a patch may contain MULTIPLE *** Update File: sections for the same
    // path (the model emits one per logical edit). Each section used to be
    // planned from the SAME on-disk content, and phase 2 wrote the last plan
    // over the earlier ones — earlier edits silently lost while the output
    // claimed every section was applied. Compose same-file update plans
    // sequentially instead: section N+1 applies to section N's result.
    const updateIndexByPath = new Map<string, number>();
    for (const fp of patches) {
      const fullPath = resolve(ctx.cwd, fp.path);
      if (fp.op === 'add') {
        if (existsSync(fullPath)) throw new Error(`*** Add File: ${fp.path} already exists`);
        const content = fp.lines.filter((l) => l.kind === 'add').map((l) => l.text).join('\n');
        plans.push({ op: 'add', path: fp.path, fullPath, content: content.endsWith('\n') || content === '' ? content : content + '\n' });
      } else if (fp.op === 'delete') {
        if (!existsSync(fullPath)) throw new Error(`*** Delete File: ${fp.path} not found`);
        plans.push({ op: 'delete', path: fp.path, fullPath });
      } else {
        const prior = updateIndexByPath.get(fp.path);
        if (prior !== undefined) {
          const prev = plans[prior];
          if (prev.op !== 'update') throw new Error(`Conflicting patch sections for ${fp.path}: cannot update after ${prev.op}`);
          const after = applyFilePatch(prev.content, fp);
          if (after === prev.content) throw new Error(`Patch produced no change to ${fp.path}`);
          // Update in place: one plan per file, content = cumulative result.
          plans[prior] = { ...prev, content: after };
          continue;
        }
        if (!existsSync(fullPath)) throw new Error(`*** Update File: ${fp.path} not found`);
        const before = readFileSync(fullPath, 'utf8');
        const after = applyFilePatch(before, fp);
        if (after === before) throw new Error(`Patch produced no change to ${fp.path}`);
        updateIndexByPath.set(fp.path, plans.length);
        plans.push({ op: 'update', path: fp.path, fullPath, content: after, before });
      }
    }

    // Phase 2 — EXECUTE. Every plan already validated, so this is just I/O.
    const results: string[] = [];
    for (const p of plans) {
      if (p.op === 'add') {
        mkdirSync(dirname(p.fullPath), { recursive: true });
        atomicWriteFileSync(p.fullPath, p.content);
        ctx.events.emit({ type: 'file:changed', path: p.fullPath, operation: 'write', agentId: ctx.agentId });
        const diag = validateFileSyntax(p.fullPath, p.content);
        const note = !diag.valid && diag.summary ? ` ⚠️ [AST Syntax Alert]: ${diag.summary}` : '';
        results.push(`added ${p.path} (${p.content.split('\n').length - 1} lines)${note}`);
      } else if (p.op === 'delete') {
        rmSync(p.fullPath);
        ctx.events.emit({ type: 'file:changed', path: p.fullPath, operation: 'delete', agentId: ctx.agentId });
        results.push(`deleted ${p.path}`);
      } else {
        atomicWriteFileSync(p.fullPath, p.content);
        ctx.events.emit({ type: 'file:changed', path: p.fullPath, operation: 'edit', agentId: ctx.agentId });
        const diag = validateFileSyntax(p.fullPath, p.content);
        const note = !diag.valid && diag.summary ? ` ⚠️ [AST Syntax Alert]: ${diag.summary}` : '';
        results.push(`updated ${p.path}${note}`);
      }
      markMutation();
    }

    return `Applied patch to ${patches.length} file(s):\n` + results.map((r) => `- ${r}`).join('\n');
  },
};
