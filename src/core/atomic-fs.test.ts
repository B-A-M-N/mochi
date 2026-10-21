import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, symlinkSync, lstatSync, statSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWriteFileSync } from './atomic-fs.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'mochi-atomic-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('atomicWriteFileSync', () => {
  it('creates a file (and parent dirs) with the exact content', () => {
    const p = join(dir, 'nested', 'deep', 'a.txt');
    atomicWriteFileSync(p, 'hello world');
    expect(readFileSync(p, 'utf8')).toBe('hello world');
  });

  it('replaces an existing file atomically', () => {
    const p = join(dir, 'a.txt');
    writeFileSync(p, 'old');
    atomicWriteFileSync(p, 'new');
    expect(readFileSync(p, 'utf8')).toBe('new');
  });

  it.skipIf(process.platform === 'win32')('preserves the existing file permission bits', () => {
    const p = join(dir, 'script.sh');
    writeFileSync(p, '#!/bin/sh\n');
    chmodSync(p, 0o755);
    atomicWriteFileSync(p, '#!/bin/sh\necho hi\n');
    expect(statSync(p).mode & 0o777).toBe(0o755);
  });

  it('writes THROUGH a symlink instead of replacing it', () => {
    const real = join(dir, 'real.txt');
    const link = join(dir, 'link.txt');
    writeFileSync(real, 'orig');
    symlinkSync(real, link);
    atomicWriteFileSync(link, 'updated');
    expect(lstatSync(link).isSymbolicLink()).toBe(true); // link preserved
    expect(readFileSync(real, 'utf8')).toBe('updated');   // target updated
  });

  it('leaves no temp files behind', () => {
    atomicWriteFileSync(join(dir, 'a.txt'), 'x');
    atomicWriteFileSync(join(dir, 'a.txt'), 'y');
    const strays = readdirSync(dir).filter((f) => f.includes('.tmp'));
    expect(strays).toEqual([]);
  });
});
