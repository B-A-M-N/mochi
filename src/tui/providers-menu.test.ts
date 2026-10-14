// providersMenu with scripted UI fns (tools-menu pattern).
import { describe, it, expect } from 'vitest';
import { providersMenu, matchProviders, keyStateText } from './providers-menu.js';
import { providerById } from '../model/providers.js';
import type { LineKind } from './state.js';

type Deps = Parameters<typeof providersMenu>[0];

function deps(over: Partial<Deps> = {}): { d: Deps; lines: Array<{ kind: LineKind; text: string }> } {
  const lines: Array<{ kind: LineKind; text: string }> = [];
  return {
    d: {
      openMenu: async () => -1,
      push: (kind: LineKind, text: string) => { lines.push({ kind, text }); },
      scheduleRender: () => {},
      setMenuSelected: () => {},
      activeProvider: 'openai',
      envLookup: () => undefined,
      storedKey: undefined,
      ...over,
    },
    lines,
  };
}

describe('matchProviders', () => {
  it('sorts all on empty query, filters by substring', () => {
    expect(matchProviders(['qwen', 'ai21', 'openai'], '')).toEqual(['ai21', 'openai', 'qwen']);
    expect(matchProviders(['qwen', 'ai21', 'upstage'], 'ai')).toEqual(['ai21']);
    expect(matchProviders(['qwen'], 'zzz')).toEqual([]);
  });
});

describe('keyStateText (never prints key material)', () => {
  it('reports env/file/missing without leaking values', () => {
    const p = providerById('openai')!;
    expect(keyStateText(p, 'openai', () => 'sk-real-secret', undefined)).toBe('key: env');
    const text = keyStateText(p, 'openai', () => undefined, 'sk-real-secret');
    expect(text).toBe('key: file');
    expect(text).not.toContain('sk-real-secret');
    expect(keyStateText(p, 'openai', () => undefined, undefined)).toBe('key: missing');
    expect(keyStateText(providerById('ollama')!, 'openai', () => undefined, undefined)).toBe('keyless local');
  });
});

describe('providersMenu', () => {
  it('exact id shows details without opening a menu', async () => {
    const { d, lines } = deps({ openMenu: async () => { throw new Error('menu must not open'); } });
    await providersMenu(d, '/providers upstage');
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toContain('Upstage (Solar)');
    expect(lines[0].text).toContain('solar-pro4');
    expect(lines[0].text).toContain('(default)');
    expect(lines[0].text).toContain('console.upstage.ai');
  });

  it('shows the gh OAuth path for github-models', async () => {
    const { d, lines } = deps({ openMenu: async () => { throw new Error('menu must not open'); } });
    await providersMenu(d, '/providers github-models');
    expect(lines[0].text).toContain('gh auth login');
  });

  it('nomatch errors honestly', async () => {
    const { d, lines } = deps();
    await providersMenu(d, '/providers zzz-nope');
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe('error');
  });

  it('full menu selects a provider and shows details with ACTIVE badge', async () => {
    const seen: string[][] = [];
    const { d, lines } = deps({
      openMenu: async (_t: string, items: string[]) => { seen.push(items); return 0; },
    });
    await providersMenu(d, '/providers');
    expect(seen).toHaveLength(1);
    expect(seen[0].length).toBeGreaterThanOrEqual(36);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toContain('Base URL:');
    expect(lines[0].text).toContain('Models (');
  });

  it('Esc closes the menu with no output', async () => {
    const { d, lines } = deps({ openMenu: async () => -1 });
    await providersMenu(d, '/providers');
    expect(lines).toHaveLength(0);
  });
});
