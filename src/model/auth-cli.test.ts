// auth-cli: pure status/logout core (the cli.ts branch stays a thin adapter
// so the coverage ratchet keeps meaning something).
import { describe, it, expect, vi } from 'vitest';
import { authStatusLines, probeKeyState, decideLogout, keySource } from './auth-cli.js';

const provs = [
  { id: 'openai', envKey: 'OPENAI_API_KEY' },
  { id: 'ollama', envKey: '' },
  { id: 'x', envKey: 'X_KEY' },
];
const usable = (k: string | undefined): boolean => !!k && k.length >= 6 && !k.startsWith('sk-your');

describe('keySource', () => {
  it('ranks env > file(active) > local > missing', () => {
    expect(keySource(provs[0], 'openai', 'sk-real', undefined, usable)).toBe('env');
    expect(keySource(provs[0], 'openai', undefined, 'sk-real', usable)).toBe('file');
    // Stored key for a NON-active provider does not count.
    expect(keySource(provs[0], 'other', undefined, 'sk-real', usable)).toBe('missing');
    expect(keySource(provs[1], 'ollama', undefined, undefined, usable)).toBe('local');
    expect(keySource(provs[2], 'x', 'hi', undefined, usable)).toBe('missing'); // placeholder
  });
});

describe('authStatusLines', () => {
  it('marks active, never prints key material', () => {
    const rows = authStatusLines(provs, 'openai', (k) => (k === 'OPENAI_API_KEY' ? 'sk-real-secret-value' : undefined), undefined, usable);
    const text = rows.join('\n');
    expect(rows[0].startsWith('*')).toBe(true);
    expect(rows[1].startsWith(' ')).toBe(true);
    expect(text).toContain('set (env)');
    expect(text).toContain('keyless local');
    expect(text).toContain('missing');
    expect(text).not.toContain('sk-real-secret-value');
  });
});

describe('probeKeyState', () => {
  it('maps verify outcomes to status words, swallows throws', async () => {
    const ok = async () => ({ ok: true as const });
    const denied = async () => ({ ok: false as const, reason: 'auth' as const, message: 'nope' });
    const down = async () => ({ ok: false as const, reason: 'network' as const, message: 'reset' });
    const boom = async () => { throw new Error('socket hangup'); };
    const base = { provider: 'x', baseUrl: 'http://x', apiKey: 'k' };
    expect(await probeKeyState(ok, base)).toBe('verified');
    expect(await probeKeyState(denied, base)).toBe('REJECTED');
    expect(await probeKeyState(down, base)).toBe('unreachable');
    expect(await probeKeyState(boom, base)).toBe('unreachable');
  });
});

describe('decideLogout', () => {
  it('clears any provider with stored material (keyring era: not just active)', () => {
    expect(decideLogout('nope', false, 'openai', 'k')).toMatchObject({ ok: false, cleared: false });
    expect(decideLogout('groq', true, 'openai', 'k')).toMatchObject({ ok: true, cleared: true });
    expect(decideLogout('openai', true, 'openai', undefined)).toMatchObject({ ok: false, cleared: false });
    const out = decideLogout('openai', true, 'openai', 'k');
    expect(out).toMatchObject({ ok: true, cleared: true });
    expect(out.message).toContain('openai');
    expect(decideLogout('openai', true, 'openai', undefined).message).toContain('No stored key');
  });

  it('isKeyUsable gate is consulted by callers (placeholder never counts)', () => {
    expect(keySource(provs[0], 'openai', 'sk-your-key-here', undefined, usable)).toBe('missing');
  });
});
