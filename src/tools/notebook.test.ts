// notebook tool: cell read/edit/insert/delete/clear_outputs round-trips.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { notebookTool } from './notebook.js';
import { EventBus } from '../events.js';
import type { ToolContext } from './types.js';

let dir: string;
beforeAll(() => { dir = mkdtempSync(resolve(tmpdir(), 'mochi-notebook-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const ctx = (): ToolContext => ({
  cwd: dir, workspace: {} as never, config: {} as never, events: new EventBus() as never, agentId: 't',
});

const NB = {
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {},
  cells: [
    { cell_type: 'markdown', metadata: {}, source: ['# Title\n', 'Some words here.'] },
    {
      cell_type: 'code', metadata: {}, execution_count: 3,
      source: ['x = 1\n', 'print(x)'],
      outputs: [{ output_type: 'stream', name: 'stdout', text: '1\n' }],
    },
  ],
};

const makeNb = (name: string, content: unknown = NB): string => {
  const p = resolve(dir, name);
  writeFileSync(p, JSON.stringify(content, null, 1) + '\n');
  return name;
};

describe('notebook tool', () => {
  it('reads an overview without pasting blobs', async () => {
    const out = await notebookTool.execute({ action: 'read', path: makeNb('a.ipynb') }, ctx());
    expect(out).toContain('2 cells');
    expect(out).toContain('# cell [0] (markdown)');
    expect(out).toContain('# cell [1] (code) [3]');
    expect(out).toContain('stream:stdout 1');
  });

  it('edits one cell source, preserves outputs, stays valid nbformat', async () => {
    const name = makeNb('b.ipynb');
    const out = await notebookTool.execute({ action: 'edit', path: name, index: 1, source: 'x = 2\nprint(x)' }, ctx());
    expect(out).toContain('Edited cell [1]');
    const nb = JSON.parse(readFileSync(resolve(dir, name), 'utf8'));
    expect(nb.cells[1].source).toEqual(['x = 2\n', 'print(x)']);
    expect(nb.cells[1].outputs).toHaveLength(1); // untouched
    expect(nb.nbformat).toBe(4);
  });

  it('inserts and deletes cells by index', async () => {
    const name = makeNb('c.ipynb');
    expect(await notebookTool.execute({ action: 'insert', path: name, index: 1, source: '## Mid', cell_type: 'markdown' }, ctx()))
      .toContain('Inserted markdown cell at [1]');
    let nb = JSON.parse(readFileSync(resolve(dir, name), 'utf8'));
    expect(nb.cells).toHaveLength(3);
    expect(nb.cells[1].cell_type).toBe('markdown');
    expect(await notebookTool.execute({ action: 'delete', path: name, index: 1 }, ctx())).toContain('Deleted cell [1]');
    nb = JSON.parse(readFileSync(resolve(dir, name), 'utf8'));
    expect(nb.cells).toHaveLength(2);
  });

  it('clears outputs and execution counts', async () => {
    const name = makeNb('d.ipynb');
    expect(await notebookTool.execute({ action: 'clear_outputs', path: name }, ctx())).toContain('Cleared outputs in 1 cell');
    const nb = JSON.parse(readFileSync(resolve(dir, name), 'utf8'));
    expect(nb.cells[1].outputs).toEqual([]);
    expect(nb.cells[1].execution_count).toBeNull();
  });

  it('refuses garbage honestly: missing file, bad json, wrong nbformat, bad index', async () => {
    // Like read.ts, failures throw (the loop renders them as tool errors).
    await expect(notebookTool.execute({ action: 'read', path: 'nope.ipynb' }, ctx())).rejects.toThrow('File not found');
    writeFileSync(resolve(dir, 'bad.ipynb'), '{oops');
    await expect(notebookTool.execute({ action: 'read', path: 'bad.ipynb' }, ctx())).rejects.toThrow('Not valid JSON');
    writeFileSync(resolve(dir, 'old.ipynb'), JSON.stringify({ nbformat: 3, cells: [] }));
    await expect(notebookTool.execute({ action: 'read', path: 'old.ipynb' }, ctx())).rejects.toThrow('Unsupported notebook');
    const name = makeNb('e.ipynb');
    await expect(notebookTool.execute({ action: 'edit', path: name, index: 9, source: 'x' }, ctx())).rejects.toThrow('out of range');
    expect(await notebookTool.execute({ action: 'frobnicate', path: name }, ctx())).toContain('Unknown notebook action');
  });
});
