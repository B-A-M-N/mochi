// runAuthCommand with scripted deps: status matrix, probe mapping, logout,
// unknown-command handling. Disk/network arrive injected — no real config or
// fetch is touched.
import { describe, it, expect, vi } from 'vitest';
import { runAuthCommand, type AuthCommandDeps } from './cli-auth.js';

class Exit extends Error {
  code: number;
  constructor(code: number) { super(`exit:${code}`); this.code = code; }
}

function deps(over: Partial<AuthCommandDeps> = {}): AuthCommandDeps & { logs: string[]; errors: string[]; exits: number[] } {
  const logs: string[] = [];
  const errors: string[] = [];
  const exits: number[] = [];
  return {
    positional: ['auth'],
    flags: {},
    runtime: { config: { model: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' } } } as never,
    log: (s: string) => { logs.push(s); },
    error: (s: string) => { errors.push(s); },
    exit: (code: number): never => { exits.push(code); throw new Exit(code); },
    logs, errors, exits,
    ...over,
  };
}

describe('runAuthCommand status', () => {
  it('lists every provider with sources, marks active, prints no keys', async () => {
    const d = deps();
    await runAuthCommand(d);
    const text = d.logs.join('\n');
    expect(text).toContain('*openai');
    expect(text).toContain('ollama');
    expect(text).toContain('keyless local');
    expect(text).toContain('missing');
    expect(text).toContain('mochi login <provider>');
    expect(text).not.toContain('sk-');
  });

  it('--probe annotates configured keys via injected verifier', async () => {
    const verify = vi.fn(async () => ({ ok: true as const }));
    const d = deps({
      flags: { probe: true },
      runtime: { config: { model: { provider: 'openai', baseUrl: 'u', model: 'm', apiKey: 'sk-real-key-1' } } } as never,
      verify: verify as never,
    });
    // Stub env: only OPENAI_API_KEY set (6+ chars, non-placeholder).
    const saved = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-env-key-1';
    try {
      await runAuthCommand(d);
    } finally {
      if (saved === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = saved;
    }
    const text = d.logs.join('\n');
    expect(text).toContain('verified');
    expect(verify).toHaveBeenCalled();
    expect(text).not.toContain('sk-env-key-1');
    expect(text).not.toContain('sk-real-key-1');
  });
});

describe('runAuthCommand logout', () => {
  it('unknown provider exits 1', async () => {
    const d = deps({ positional: ['auth', 'logout', 'nope'] });
    await expect(runAuthCommand(d)).rejects.toThrow('exit:1');
    expect(d.exits).toEqual([1]);
  });

  it('no stored key reports honestly without touching disk', async () => {
    const d = deps({ positional: ['auth', 'logout'] });
    await runAuthCommand(d);
    expect(d.logs.join('\n')).toContain('No stored key');
  });

  it('reset is an explicit alias for logout (same honest paths)', async () => {
    const unknown = deps({ positional: ['auth', 'reset', 'nope'] });
    await expect(runAuthCommand(unknown)).rejects.toThrow('exit:1');
    const empty = deps({ positional: ['auth', 'reset'] });
    await runAuthCommand(empty);
    expect(empty.logs.join('\n')).toContain('No stored key');
  });

  it('unknown subcommand errors and exits 1', async () => {
    const d = deps({ positional: ['auth', 'frobnicate'] });
    await expect(runAuthCommand(d)).rejects.toThrow('exit:1');
    expect(d.errors.join('\n')).toContain('Unknown auth command');
  });
});
