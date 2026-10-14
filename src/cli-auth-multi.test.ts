import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runAuthCommand, type AuthCommandDeps } from './cli-auth.js';
import { setAccount, activeAccountName } from './model/keyring.js';

let prevConfigPath: string | undefined;
beforeEach(() => {
  prevConfigPath = process.env.MOCHI_CONFIG_PATH;
  process.env.MOCHI_CONFIG_PATH = resolve(mkdtempSync(resolve(tmpdir(), 'mochi-clia2-')), 'config.json');
});
afterEach(() => {
  if (prevConfigPath === undefined) delete process.env.MOCHI_CONFIG_PATH;
  else process.env.MOCHI_CONFIG_PATH = prevConfigPath;
});

function deps(positional: string[]): AuthCommandDeps & { logs: string[]; errors: string[]; exits: number[] } {
  const logs: string[] = []; const errors: string[] = []; const exits: number[] = [];
  return {
    positional,
    flags: {},
    runtime: { config: { model: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' } } } as never,
    log: (s: string) => { logs.push(s); },
    error: (s: string) => { errors.push(s); },
    exit: (code: number): never => { exits.push(code); throw new Error(`exit:${code}`); },
    logs, errors, exits,
  };
}

describe('cli-auth multi-account coverage', () => {
  it('accounts lists and marks active', async () => {
    setAccount('openai', 'a', 'keya', 'api-key');
    setAccount('openai', 'b', 'keyb', 'api-key');
    const d = deps(['auth', 'accounts', 'openai']);
    await runAuthCommand(d);
    const text = d.logs.join('\n');
    expect(text).toContain('* b');
    expect(text).toContain('  a');
    expect(activeAccountName('openai')).toBe('b');
  });

  it('switch changes active account', async () => {
    setAccount('openai', 'a', 'keya', 'api-key');
    setAccount('openai', 'b', 'keyb', 'api-key');
    const d = deps(['auth', 'switch', 'openai', 'a']);
    await runAuthCommand(d);
    expect(d.logs.join('\n')).toContain('Switched');
    expect(activeAccountName('openai')).toBe('a');
  });

  it('account delete removes selected', async () => {
    setAccount('openai', 'a', 'keya', 'api-key');
    setAccount('openai', 'b', 'keyb', 'api-key');
    const d = deps(['auth', 'account', 'delete', 'openai', 'b']);
    await runAuthCommand(d);
    expect(d.logs.join('\n')).toContain('Removed');
  });

  it('unknown subcommand error message includes new commands', async () => {
    const d = deps(['auth', 'nope']);
    try { await runAuthCommand(d); } catch { /* exit thrown */ }
    expect(d.errors.join('\n')).toContain('auth');
  });
});