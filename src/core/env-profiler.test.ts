import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, delimiter } from 'node:path';
import { getHostEnvironmentProfile, formatEnvironmentBlock, resetEnvironmentProfileCache, binaryOnPath } from './env-profiler.js';

describe('Host Environment Profiler', () => {
  it('detects available runtime binaries on the system', () => {
    resetEnvironmentProfileCache();
    const profile = getHostEnvironmentProfile(true);
    expect(profile).toBeDefined();
    expect(profile.availableRuntimes).toContain('node');
    expect(profile.runtimes['node'].available).toBe(true);
    expect(profile.runtimes['node'].version).toBeDefined();
  });

  it('formats a concise markdown block for the context engine', () => {
    const block = formatEnvironmentBlock({
      runtimes: { node: { name: 'node', available: true } },
      buildTools: { npm: { name: 'npm', available: true } },
      linters: { tsc: { name: 'tsc', available: true } },
      availableRuntimes: ['node'],
      availableBuildTools: ['npm'],
      availableLinters: ['tsc'],
      timestamp: Date.now(),
    });

    expect(block).toContain('Host Environment Capabilities');
    expect(block).toContain('- **Runtimes**: node');
    expect(block).toContain('- **Build Systems**: npm');
    expect(block).toContain('- **Linters/Formatters**: tsc');
  });

  it('handles empty environments cleanly', () => {
    const block = formatEnvironmentBlock({
      runtimes: {},
      buildTools: {},
      linters: {},
      availableRuntimes: [],
      availableBuildTools: [],
      availableLinters: [],
      timestamp: Date.now(),
    });
    expect(block).toBe('');
  });

  it('binaryOnPath scans PATH in-process (no shell, delimiter-aware)', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-binpath-'));
    try {
      writeFileSync(resolve(dir, 'mytool'), '#!/bin/sh\necho hi\n');
      chmodSync(resolve(dir, 'mytool'), 0o755);
      const pathEnv = `${dir}${delimiter}/nonexistent-dir-xyz`;
      if (process.platform === 'win32') {
        // PATHEXT-aware: exact name without extension is NOT enough, but
        // name + a PATHEXT extension is (mirrors CreateProcess lookup).
        expect(binaryOnPath('mytool', pathEnv)).toBe(false);
        writeFileSync(resolve(dir, 'mytool.CMD'), '@echo off\r\necho hi\r\n');
        expect(binaryOnPath('mytool', pathEnv)).toBe(true);
      } else {
        expect(binaryOnPath('mytool', pathEnv)).toBe(true);
      }
      expect(binaryOnPath('definitely-not-a-binary-xyz', pathEnv)).toBe(false);
      expect(binaryOnPath('node')).toBe(true); // the test runner itself runs on node
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
