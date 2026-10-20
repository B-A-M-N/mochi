// B21 regression: MOCHI_CONFIG_DIR was applied AFTER the user config read.
//
// loadConfig() resolved the user config file as
//   resolve(cfg.configDir, 'config.json')
// while cfg.configDir still held the DEFAULT (~/.config/mochi) — the
// MOCHI_CONFIG_DIR assignment sat ~130 lines later, after the merge. The env
// var therefore relocated the REPORTED configDir but the actual user config
// was still (only) read from the default location. An onboarding that wrote
// config.json into MOCHI_CONFIG_DIR was silently ignored.
//
// Contract pinned here: MOCHI_CONFIG_DIR must be in effect BEFORE the user
// config read, and an explicit configDir inside the user config file must
// still lose to the env var (env beats file).
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from './config.js';

// A key no real config file or project file on this machine sets.
const CANARY = { b21Canary: 'from-config-dir' };

describe('MOCHI_CONFIG_DIR read timing (B21)', () => {
  it('reads config.json from MOCHI_CONFIG_DIR, not just reports it', () => {
    const dirA = mkdtempSync(join(tmpdir(), 'mochi-b21-a-'));
    const savedPath = process.env.MOCHI_CONFIG_PATH;
    const savedDir = process.env.MOCHI_CONFIG_DIR;
    try {
      writeFileSync(join(dirA, 'config.json'), JSON.stringify(CANARY));
      delete process.env.MOCHI_CONFIG_PATH; // isolate: no explicit config path
      process.env.MOCHI_CONFIG_DIR = dirA;
      const cfg = loadConfig();
      // Reported dir (passes even with the bug — this is all the old test
      // asserted).
      expect(cfg.configDir).toBe(dirA);
      // The actual read (red with the bug: the canary was never loaded
      // because the read used the default ~/.config/mochi).
      expect((cfg as unknown as Record<string, unknown>).b21Canary).toBe('from-config-dir');
    } finally {
      if (savedPath === undefined) delete process.env.MOCHI_CONFIG_PATH; else process.env.MOCHI_CONFIG_PATH = savedPath;
      if (savedDir === undefined) delete process.env.MOCHI_CONFIG_DIR; else process.env.MOCHI_CONFIG_DIR = savedDir;
      rmSync(dirA, { recursive: true, force: true });
    }
  });

  it('env var still beats a configDir key inside the user config file', () => {
    const dirA = mkdtempSync(join(tmpdir(), 'mochi-b21-b-'));
    const dirB = mkdtempSync(join(tmpdir(), 'mochi-b21-c-'));
    const savedPath = process.env.MOCHI_CONFIG_PATH;
    const savedDir = process.env.MOCHI_CONFIG_DIR;
    try {
      writeFileSync(join(dirA, 'config.json'), JSON.stringify({ ...CANARY, configDir: dirB }));
      delete process.env.MOCHI_CONFIG_PATH;
      process.env.MOCHI_CONFIG_DIR = dirA;
      const cfg = loadConfig();
      expect(cfg.configDir).toBe(dirA); // env wins over the file's configDir
      expect((cfg as unknown as Record<string, unknown>).b21Canary).toBe('from-config-dir');
    } finally {
      if (savedPath === undefined) delete process.env.MOCHI_CONFIG_PATH; else process.env.MOCHI_CONFIG_PATH = savedPath;
      if (savedDir === undefined) delete process.env.MOCHI_CONFIG_DIR; else process.env.MOCHI_CONFIG_DIR = savedDir;
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  });
});
