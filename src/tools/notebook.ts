// notebook — Jupyter .ipynb cell read/edit without opening Jupyter.
// The one file type the read/write/edit tools mangle: hand-editing notebook
// JSON by line ranges corrupts cell boundaries and drops outputs. This tool
// operates on CELLS (index = position in the cells array): read renders an
// overview, edit/insert/delete rewrite structure, clear_outputs drops bulky
// base64 output blobs. Serialization matches nbformat convention
// (JSON.stringify with 1-space indent + trailing newline), the same bytes
// `jupyter nbconvert`/Jupyter itself writes, so diffs stay minimal.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { atomicWriteFileSync } from '../core/atomic-fs.js';
import type { Tool } from './types.js';

interface NbCell {
  cell_type?: unknown;
  source?: unknown;
  outputs?: unknown;
  execution_count?: unknown;
  metadata?: unknown;
  [k: string]: unknown;
}

interface Notebook {
  nbformat?: unknown;
  nbformat_minor?: unknown;
  cells?: unknown;
  metadata?: unknown;
  [k: string]: unknown;
}

function resolveNb(cwd: string, rawPath: string): string {
  if (rawPath === '~') return homedir();
  if (rawPath.startsWith('~/')) return resolve(homedir(), rawPath.slice(2));
  return resolve(cwd, rawPath);
}

function toSourceLines(source: unknown): string[] | null {
  if (typeof source === 'string') return source.split('\n');
  if (Array.isArray(source) && source.every((l) => typeof l === 'string')) {
    // nbformat multiline strings keep their \n suffixes; re-split cleanly.
    return (source as string[]).join('').split('\n');
  }
  return null;
}

function fromSourceLines(lines: string[]): string[] {
  // nbformat multiline convention: every line but the last keeps '\n'.
  return lines.map((l, i) => (i < lines.length - 1 ? `${l}\n` : l));
}

function loadNotebook(fullPath: string, rawPath: string): { nb: Notebook; cells: NbCell[] } {
  if (!existsSync(fullPath)) throw new Error(`File not found: ${rawPath}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(fullPath, 'utf8'));
  } catch {
    throw new Error(`Not valid JSON, refusing to touch it: ${rawPath}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Not a notebook object: ${rawPath}`);
  }
  const nb = parsed as Notebook;
  if (nb.nbformat !== 4 || !Array.isArray(nb.cells)) {
    throw new Error(`Unsupported notebook (need nbformat 4 with a cells array): ${rawPath}`);
  }
  const cells = (nb.cells as unknown[]).filter((c): c is NbCell => !!c && typeof c === 'object' && !Array.isArray(c));
  if (cells.length !== (nb.cells as unknown[]).length) {
    throw new Error(`Notebook has malformed (non-object) cells, refusing to rewrite: ${rawPath}`);
  }
  return { nb, cells };
}

function saveNotebook(fullPath: string, nb: Notebook): void {
  atomicWriteFileSync(fullPath, JSON.stringify(nb, null, 1) + '\n');
}

function checkIndex(cells: NbCell[], index: unknown): number {
  const i = typeof index === 'number' ? index : Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= cells.length) {
    throw new Error(`Cell index ${String(index)} out of range (notebook has ${cells.length} cells, 0-based).`);
  }
  return i;
}

function trimOutputText(text: string, max = 400): string {
  const t = text.trim();
  return t.length > max ? t.slice(0, max) + `… [${t.length - max} chars hidden]` : t;
}

/** One-line summary of a cell output (never pastes base64 blobs). */
function summarizeOutputs(cell: NbCell): string {
  if (cell.cell_type !== 'code' || !Array.isArray(cell.outputs)) return '';
  const parts: string[] = [];
  for (const o of cell.outputs as Array<Record<string, unknown>>) {
    if (!o || typeof o !== 'object') continue;
    const type = String(o.output_type ?? 'unknown');
    if (type === 'stream') {
      parts.push(`stream:${String(o.name ?? '')} ${trimOutputText(String(o.text ?? ''), 120)}`);
    } else if (type === 'error') {
      parts.push(`error:${String(o.ename ?? '')}: ${trimOutputText(String(o.evalue ?? ''), 160)}`);
    } else if (o.data && typeof o.data === 'object') {
      const data = o.data as Record<string, unknown>;
      if (typeof data['text/plain'] === 'string') {
        parts.push(`out: ${trimOutputText(String(data['text/plain']), 160)}`);
      } else {
        const keys = Object.keys(data).join(',');
        parts.push(`out:[${keys || 'empty'}]`);
      }
    } else {
      parts.push(`${type}`);
    }
  }
  return parts.length ? ` | ${parts.slice(0, 4).join(' ; ')}${parts.length > 4 ? ` (+${parts.length - 4} more)` : ''}` : '';
}

export const notebookTool: Tool = {
  def: {
    name: 'notebook',
    description:
      'Read and edit Jupyter .ipynb notebooks by cell (never hand-edit notebook JSON by line ranges — that corrupts cell boundaries). Actions: read (cell overview), edit (replace one cell source), insert (new cell at index), delete (remove a cell), clear_outputs. Cell indices are 0-based positions in the cells array.',
    parameters: [
      { name: 'action', type: 'string', description: "'read' | 'edit' | 'insert' | 'delete' | 'clear_outputs'", required: true },
      { name: 'path', type: 'string', description: 'Notebook path (.ipynb), relative to cwd or absolute', required: true },
      { name: 'index', type: 'number', description: '0-based cell index (edit/delete; insert position for insert)', required: false },
      { name: 'source', type: 'string', description: 'New cell source text (edit/insert)', required: false },
      { name: 'cell_type', type: 'string', description: "For insert: 'code' (default) or 'markdown'", required: false },
    ],
    permission: 'write',
  },
  async execute(args, ctx) {
    const action = String(args.action ?? 'read').toLowerCase();
    const rawPath = String(args.path ?? '');
    if (!rawPath) return 'notebook needs a path to a .ipynb file.';
    const fullPath = resolveNb(ctx.cwd, rawPath);
    if (action === 'read') {
      const { cells } = loadNotebook(fullPath, rawPath);
      if (!cells.length) return `${rawPath}: 0 cells.`;
      const lines = cells.map((c, i) => {
        const kind = c.cell_type === 'markdown' ? 'markdown' : 'code';
        const src = toSourceLines(c.source) ?? [];
        const head = src.slice(0, 6).join('\n');
        const more = src.length > 6 ? `\n… (+${src.length - 6} more lines)` : '';
        const exec = kind === 'code' && c.execution_count !== null && c.execution_count !== undefined
          ? ` [${String(c.execution_count)}]` : '';
        return `# cell [${i}] (${kind})${exec}\n${head}${more}${summarizeOutputs(c)}`;
      });
      const shown = lines.slice(0, 40).join('\n\n');
      return `${rawPath}: ${cells.length} cells\n\n${shown}${cells.length > 40 ? `\n\n… (+${cells.length - 40} more cells)` : ''}`;
    }
    if (action === 'clear_outputs') {
      const { nb, cells } = loadNotebook(fullPath, rawPath);
      let cleared = 0;
      for (const c of cells) {
        if (c.cell_type === 'code' && Array.isArray(c.outputs) && c.outputs.length > 0) {
          c.outputs = [];
          c.execution_count = null;
          cleared++;
        }
      }
      saveNotebook(fullPath, nb);
      return `Cleared outputs in ${cleared} cell(s) of ${rawPath}.`;
    }
    if (action === 'delete') {
      const { nb, cells } = loadNotebook(fullPath, rawPath);
      const i = checkIndex(cells, args.index);
      (nb.cells as unknown[]).splice(i, 1);
      saveNotebook(fullPath, nb);
      return `Deleted cell [${i}] from ${rawPath} (${cells.length - 1} cells remain).`;
    }
    if (action === 'edit' || action === 'insert') {
      if (typeof args.source !== 'string') return `${action} needs a source string for the cell content.`;
      const { nb, cells } = loadNotebook(fullPath, rawPath);
      if (action === 'edit') {
        const i = checkIndex(cells, args.index);
        cells[i].source = fromSourceLines(args.source.split('\n'));
        saveNotebook(fullPath, nb);
        return `Edited cell [${i}] (${String(cells[i].cell_type ?? 'code')}) in ${rawPath}.`;
      }
      const kind = String(args.cell_type ?? 'code').toLowerCase() === 'markdown' ? 'markdown' : 'code';
      const atRaw = args.index === undefined ? cells.length : Number(args.index);
      if (!Number.isInteger(atRaw) || atRaw < 0 || atRaw > cells.length) {
        return `Insert index ${String(args.index)} out of range (0..${cells.length} for ${cells.length} cells).`;
      }
      const cell: NbCell = kind === 'markdown'
        ? { cell_type: 'markdown', metadata: {}, source: fromSourceLines(args.source.split('\n')) }
        : { cell_type: 'code', metadata: {}, source: fromSourceLines(args.source.split('\n')), outputs: [], execution_count: null };
      (nb.cells as unknown[]).splice(atRaw, 0, cell);
      saveNotebook(fullPath, nb);
      return `Inserted ${kind} cell at [${atRaw}] in ${rawPath} (${cells.length + 1} cells total).`;
    }
    return `Unknown notebook action "${action}". Use read|edit|insert|delete|clear_outputs.`;
  },
};
