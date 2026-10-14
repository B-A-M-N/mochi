// providersMenu with scripted UI fns (tools-menu pattern).
import { describe, it, expect } from 'vitest';
import { providersMenu, matchProviders, keyStateText } from './providers-menu.js';
import { providerById } from '../model/providers.js';
import type { LineKind } from './state.js';

type Deps = Parameters<typeof providersMenu>[0];

function deps(over: Partial<Deps> = {}): { d: Deps; lines: Array<{ kind: LineKind; text: string }>; persisted: Array<{ id: string; key: string; model: string }>; cleared: { n: number } } {
  const lines: Array<{ kind: LineKind; text: string }> = [];
  const persisted: Array<{ id: string; key: string; model: string }> = [];
  const cleared = { n: 0 };
  return {
    d: {
      openMenu: async () => -1,
      push: (kind: LineKind, text: string) => { lines.push({ kind, text }); },
      scheduleRender: () => {},
      setMenuSelected: () => {},
      ask: async () => '',
      activeProvider: 'openai',
      envLookup: () => undefined,
      storedKey: undefined,
      getAmbientKey: async () => undefined,
      verifyKey: async () => ({ ok: true, message: 'verified' }),
      persistLogin: async (id: string, key: string, model: string) => { persisted.push({ id, key, model }); return `ok ${id}`; },
      switchProvider: async (id: string, model: string) => { persisted.push({ id: `${id}:switched`, model }); return `switched ${id}`; },
      persistCleared: async () => { cleared.n++; },
      ...over,
    },
    lines,
    persisted,
    cleared,
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
  it('exact id shows details then Done leaves without side effects', async () => {
    const calls: string[] = [];
    const { d, lines, persisted, cleared } = deps({
      openMenu: async (t: string) => { calls.push(t); return t.includes('key actions') ? 2 : -1; },
    });
    await providersMenu(d, '/providers upstage');
    expect(lines.some((l) => l.text.includes('Upstage (Solar)'))).toBe(true);
    expect(lines.some((l) => l.text.includes('solar-pro4'))).toBe(true);
    expect(lines.some((l) => l.text.includes('(default)'))).toBe(true);
    expect(lines.some((l) => l.text.includes('console.upstage.ai'))).toBe(true);
    expect(persisted).toEqual([]);
    expect(cleared.n).toBe(0);
  });

  it('shows the gh OAuth path for github-models', async () => {
    const { d, lines } = deps({ openMenu: async (t: string) => (t.includes('key actions') ? 2 : -1) });
    await providersMenu(d, '/providers github-models');
    expect(lines.some((l) => l.text.includes('gh auth login'))).toBe(true);
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
      openMenu: async (_t: string, items: string[]) => { seen.push(items); return seen.length === 1 ? 0 : 2; },
    });
    await providersMenu(d, '/providers');
    expect(seen).toHaveLength(2);
    expect(seen[0].length).toBeGreaterThanOrEqual(36);
    expect(lines.some((l) => l.text.includes('Base URL:'))).toBe(true);
    expect(lines.some((l) => l.text.includes('Models ('))).toBe(true);
  });

  it('Esc closes the menu with no output', async () => {
    const { d, lines } = deps({ openMenu: async () => -1 });
    await providersMenu(d, '/providers');
    expect(lines).toHaveLength(0);
  });

  it('re-authenticate probes before storing and persists the chosen model', async () => {
    const menus: string[] = [];
    const { d, lines, persisted } = deps({
      openMenu: async (t: string) => { menus.push(t); return 0; },
      ask: async () => 'sk-typed-key',
      verifyKey: async () => ({ ok: true, message: 'verified' }),
    });
    await providersMenu(d, '/providers upstage');
    expect(persisted).toEqual([{ id: 'upstage', key: 'sk-typed-key', model: 'solar-pro4' }]);
    expect(lines.some((l) => l.text.includes('Verified key'))).toBe(true);
    expect(lines.join('\n')).not.toContain('sk-typed-key');
  });

  it('re-authenticate with a rejected key stores nothing', async () => {
    const { d, lines, persisted } = deps({
      openMenu: async () => 0,
      ask: async () => 'sk-bad-key',
      verifyKey: async () => ({ ok: false, reason: 'auth', message: 'endpoint rejected the key (HTTP 401)' }),
    });
    await providersMenu(d, '/providers upstage');
    expect(persisted).toEqual([]);
    expect(lines.some((l) => l.kind === 'error' && l.text.includes('Not stored'))).toBe(true);
    expect(lines.join('\n')).not.toContain('sk-bad-key');
  });

  it('clear stored key persists the clear and guides back to re-auth', async () => {
    const { d, lines, cleared } = deps({
      openMenu: async (t: string) => (t.includes('key actions') ? 1 : 0),
      activeProvider: 'openai',
      storedKey: 'sk-stored',
    });
    await providersMenu(d, '/providers openai');
    expect(cleared.n).toBe(1);
    expect(lines.some((l) => l.text.includes('Cleared stored key'))).toBe(true);
    expect(lines.join('\n')).not.toContain('sk-stored');
  });

  it('clear with no stored key reports honestly and touches nothing', async () => {
    const { d, lines, cleared } = deps({
      openMenu: async (t: string) => (t.includes('key actions') ? 1 : 0),
    });
    await providersMenu(d, '/providers openai');
    expect(cleared.n).toBe(0);
    expect(lines.some((l) => l.text.includes('No stored key'))).toBe(true);
  });

  it('typing a new key replaces the stored one (the reported bug)', async () => {
    const { d, persisted } = deps({
      openMenu: async () => 0,
      ask: async () => 'sk-brand-new-key',
      activeProvider: 'openai',
      storedKey: 'sk-stale-key',
      verifyKey: async () => ({ ok: true, message: 'verified' }),
    });
    await providersMenu(d, '/providers openai');
    expect(persisted).toEqual([{ id: 'openai', key: 'sk-brand-new-key', model: 'gpt-4o' }]);
  });

  it('Enter with a stored key keeps it (no retype needed)', async () => {
    const { d, persisted } = deps({
      openMenu: async () => 0,
      ask: async () => '',
      activeProvider: 'openai',
      storedKey: 'sk-kept-key',
      verifyKey: async () => ({ ok: true, message: 'verified' }),
    });
    await providersMenu(d, '/providers openai');
    expect(persisted).toEqual([{ id: 'openai', key: 'sk-kept-key', model: 'gpt-4o' }]);
  });

  it('OAuth token fills in when nothing is configured (github-models via gh)', async () => {
    const { d, lines, persisted } = deps({
      openMenu: async () => 0,
      ask: async () => '',
      getAmbientKey: async (id: string) => (id === 'github-models' ? 'ghp-oauth-token' : undefined),
      verifyKey: async () => ({ ok: true, message: 'verified' }),
    });
    await providersMenu(d, '/providers github-models');
    expect(persisted).toEqual([{ id: 'github-models', key: 'ghp-oauth-token', model: 'openai/gpt-4.1' }]);
    expect(lines.some((l) => l.text.includes('OAuth token from local CLI auth'))).toBe(true);
    expect(lines.join('\n')).not.toContain('ghp-oauth-token');
  });

  it('keyless local providers switch with no key prompt', async () => {
    let asked = 0;
    const { d, lines, persisted } = deps({
      openMenu: async () => 0,
      ask: async () => { asked++; return ''; },
    });
    await providersMenu(d, '/providers ollama');
    expect(asked).toBe(0);
    expect(persisted[0].id).toBe('ollama:switched');
    expect(persisted[0].model).toBe('llama3.1');
    expect(lines.some((l) => l.text.includes('needs no API key'))).toBe(true);
  });
});
