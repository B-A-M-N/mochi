// toolsMenu with scripted UI fns (openMenu/ask/push), mirroring onboard-flow tests.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { toolsMenu, matchTools } from './tools-menu.js';
import { EventBus } from '../events.js';
import type { LineKind } from './state.js';
import type { MochiConfig } from '../types.js';

type Deps = Parameters<typeof toolsMenu>[0];

function deps(over: Partial<Deps> = {}): { d: Deps; lines: Array<{ kind: LineKind; text: string }>; events: string[] } {
  const lines: Array<{ kind: LineKind; text: string }> = [];
  const events: string[] = [];
  const bus = new EventBus();
  bus.onAll((e) => events.push(e.type));
  return {
    d: {
      openMenu: async () => -1,
      ask: async () => '',
      push: (kind: LineKind, text: string) => { lines.push({ kind, text }); },
      scheduleRender: () => {},
      config: { projectDir: '/tmp/x', permissions: { read: true, write: true, shell: true, network: true } } as unknown as MochiConfig,
      workspace: { dir: '/tmp/x' } as never,
      events: bus,
      signal: new AbortController().signal,
      projectRoot: '/tmp/x',
      setMenuSelected: () => {},
      ...over,
    },
    lines,
    events,
  };
}

/** Index of the row whose (ANSI-stripped) name cell equals `name`. */
function rowOf(items: string[], name: string): number {
  return items.findIndex((t) => t.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 22).trim() === name);
}

describe('matchTools', () => {
  it('sorts all on empty query, filters by substring, exact included', () => {
    expect(matchTools(['shell', 'read', 'search'], '')).toEqual(['read', 'search', 'shell']);
    expect(matchTools(['shell', 'read', 'search'], 'sea')).toEqual(['search']);
    expect(matchTools(['shell', 'read'], 'zzz')).toEqual([]);
  });
});

describe('toolsMenu', () => {
  it('/tools <exact> shows details without opening a menu', async () => {
    const { d, lines } = deps({ openMenu: async () => { throw new Error('menu must not open'); } });
    await toolsMenu(d, '/tools read');
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe('system');
    expect(lines[0].text).toContain('tool: read');
  });

  it('/tools <nomatch> errors honestly', async () => {
    const { d, lines } = deps();
    await toolsMenu(d, '/tools zzz-no-such-tool');
    expect(lines.some((l) => l.kind === 'error' && l.text.includes('No tools match'))).toBe(true);
  });

  it('menu pick then details pushes the schema', async () => {
    const titles: string[] = [];
    const { d, lines } = deps({
      openMenu: async (title: string) => { titles.push(title); return 0; },
    });
    await toolsMenu(d, '/tools');
    expect(titles[0]).toMatch(/Agent Tools \(\d+\)/);
    expect(lines.some((l) => l.text.startsWith('tool: '))).toBe(true);
  });

  it('Esc at the menu pushes nothing and emits nothing', async () => {
    const { d, lines, events } = deps({ openMenu: async () => -1 });
    await toolsMenu(d, '/tools');
    expect(lines).toEqual([]);
    expect(events).toEqual([]);
  });

  it('try-it runs the real tool and emits called+completed', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-toolsmenu-'));
    try {
      writeFileSync(resolve(dir, 'note.txt'), 'hello tools menu');
      const { d, lines, events } = deps({
        openMenu: async (title: string, items: string[]) => {
          if (title.startsWith('Agent Tools')) return rowOf(items, 'read');
          return 1; // Try it
        },
        ask: async () => JSON.stringify({ path: resolve(dir, 'note.txt') }),
        projectRoot: dir,
      });
      await toolsMenu(d, '/tools');
      expect(events).toEqual(['tool:called', 'tool:completed']);
      expect(lines).toEqual([]); // outcome travels on the tool card, not chat lines
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('try-it rejects non-JSON args without executing', async () => {
    const { d, lines, events } = deps({
      openMenu: async (title: string, items: string[]) => {
        if (title.startsWith('Agent Tools')) return rowOf(items, 'read');
        return 1; // Try it
      },
      ask: async () => 'not json {{{',
    });
    await toolsMenu(d, '/tools');
    expect(lines.some((l) => l.kind === 'error' && l.text.includes('JSON object'))).toBe(true);
    expect(events.includes('tool:called')).toBe(false);
  });

  it('try-it cancel (empty answer) pushes cancelled, executes nothing', async () => {
    const { d, lines, events } = deps({
      openMenu: async (title: string, items: string[]) => {
        if (title.startsWith('Agent Tools')) return rowOf(items, 'read');
        return 1; // Try it
      },
      ask: async () => '   ',
    });
    await toolsMenu(d, '/tools');
    expect(lines.some((l) => l.text.includes('cancelled'))).toBe(true);
    expect(events).toEqual([]);
  });
});
