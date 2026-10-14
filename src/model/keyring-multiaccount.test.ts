// Multi-account keyring coverage (auth switch, account picker backing).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  keyringPath, loadKeyring, setKeyringKey, setAccount, switchAccount,
  deleteAccount, accountsFor, activeAccountName, storedKeyForProvider,
} from './keyring.js';

let dir: string;
let configPath: string;
let prevOverride: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-kr-ma-'));
  configPath = resolve(dir, 'config.json');
  prevOverride = process.env.MOCHI_CONFIG_PATH;
  process.env.MOCHI_CONFIG_PATH = configPath;
});

afterEach(() => {
  if (prevOverride === undefined) delete process.env.MOCHI_CONFIG_PATH;
  else process.env.MOCHI_CONFIG_PATH = prevOverride;
  rmSync(dir, { recursive: true, force: true });
});

describe('multi-account keyring', () => {
  it('creates named accounts and switches', () => {
    setKeyringKey('openai', 'sk-default', 'api-key');
    setAccount('openai', 'work', 'sk-work', 'api-key');
    expect(accountsFor('openai')).toEqual(expect.arrayContaining(['default', 'work']));
    expect(activeAccountName('openai')).toBe('work');
    expect(switchAccount('openai', 'default')).toBe(true);
    expect(activeAccountName('openai')).toBe('default');
  });

  it('delete account falls back to another and persists its key', () => {
    setAccount('openai', 'a', 'keya', 'api-key');
    setAccount('openai', 'b', 'keyb', 'api-key');
    expect(activeAccountName('openai')).toBe('b');
    expect(deleteAccount('openai', 'b')).toBe(true);
    expect(activeAccountName('openai')).toBe('a');
    expect(storedKeyForProvider(loadKeyring(), 'openai', 'openai', '')).toBe('keya');
  });

  it('delete last account removes the entry', () => {
    setAccount('openai', 'solo', 'x', 'api-key');
    expect(deleteAccount('openai', 'solo')).toBe(true);
    expect(accountsFor('openai')).toEqual([]);
  });

  it('switch unknown returns false', () => {
    setKeyringKey('openai', 'sk', 'api-key');
    expect(switchAccount('openai', 'nope')).toBe(false);
  });

  it('back-compat flat shape still reads', () => {
    const ring = { openai: { type: 'api-key' as const, key: 'sk-flat', updatedAtMs: 1 } };
    expect(storedKeyForProvider(ring as never, 'openai', 'openai', 'legacy')).toBe('sk-flat');
  });
});