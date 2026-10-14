// keyring: per-provider owned store (structure, perms, resolution, cleanup).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  keyringPath, loadKeyring, saveKeyring, getKeyringKey,
  setKeyringKey, deleteKeyringKey, storedKeyForProvider, keyringMode,
} from './keyring.js';

let dir: string;
let configPath: string;
let prevOverride: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-keyring-'));
  configPath = resolve(dir, 'config.json');
  prevOverride = process.env.MOCHI_CONFIG_PATH;
  process.env.MOCHI_CONFIG_PATH = configPath;
});

afterEach(() => {
  if (prevOverride === undefined) delete process.env.MOCHI_CONFIG_PATH;
  else process.env.MOCHI_CONFIG_PATH = prevOverride;
  rmSync(dir, { recursive: true, force: true });
});

describe('keyring file', () => {
  it('round-trips entries per provider without touching other ids', () => {
    setKeyringKey('openai', 'sk-a', 'api-key');
    setKeyringKey('github-models', 'ghp-b', 'oauth');
    const ring = loadKeyring();
    expect(getKeyringKey(ring, 'openai')).toBe('sk-a');
    expect(ring['github-models'].type).toBe('oauth');
    expect(getKeyringKey(ring, 'nope')).toBeUndefined();
  });

  it('is created with owner-only permissions', () => {
    if (process.platform === 'win32') return; // ACLs, not posix modes
    setKeyringKey('openai', 'sk-a');
    expect(keyringPath()).toContain('auth.json');
    expect(keyringMode()).toBe(0o600);
  });

  it('corrupt or missing files read as empty (never throws)', () => {
    expect(loadKeyring()).toEqual({});
    writeFileSync(keyringPath(), '{not json');
    expect(loadKeyring()).toEqual({});
    writeFileSync(keyringPath(), JSON.stringify({ openai: { type: 'api-key' } }));
    expect(loadKeyring()).toEqual({}); // entry without key is dropped
    writeFileSync(keyringPath(), '[]');
    expect(loadKeyring()).toEqual({});
  });

  it('delete removes one id and reports whether it existed', () => {
    setKeyringKey('openai', 'sk-a');
    expect(deleteKeyringKey('openai')).toBe(true);
    expect(deleteKeyringKey('openai')).toBe(false);
    expect(loadKeyring()).toEqual({});
  });

  it('stays inside the sandboxed config dir', () => {
    setKeyringKey('openai', 'sk-a');
    expect(keyringPath().startsWith(dir)).toBe(true);
  });

  it('ignores a world-readable pre-existing file by re-locking on save', () => {
    if (process.platform === 'win32') return;
    writeFileSync(keyringPath(), '{}');
    try { chmodSync(keyringPath(), 0o644); } catch { return; }
    setKeyringKey('openai', 'sk-a');
    expect(keyringMode()).toBe(0o600);
  });
});

describe('storedKeyForProvider (keyring + legacy slot)', () => {
  it('prefers the keyring over the legacy active slot', () => {
    const ring = { openai: { type: 'api-key' as const, key: 'sk-ring', updatedAtMs: 1 } };
    expect(storedKeyForProvider(ring, 'openai', 'openai', 'sk-legacy')).toBe('sk-ring');
  });

  it('falls back to the legacy slot for the active provider only', () => {
    expect(storedKeyForProvider({}, 'openai', 'openai', 'sk-legacy')).toBe('sk-legacy');
    expect(storedKeyForProvider({}, 'groq', 'openai', 'sk-legacy')).toBeUndefined();
  });

  it('returns undefined when nothing is stored anywhere', () => {
    expect(storedKeyForProvider({}, 'groq', 'openai', undefined)).toBeUndefined();
  });
});
