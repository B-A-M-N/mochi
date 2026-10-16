import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runRetention } from './retention.js';

let ws: string;
beforeEach(() => { ws = mkdtempSync(resolve(tmpdir(), 'mochi-ret-')); mkdirSync(resolve(ws, 'state'), { recursive: true }); mkdirSync(resolve(ws, 'traces'), { recursive: true }); });
afterEach(() => rmSync(ws, { recursive: true, force: true }));

describe('retention', () => {
  it('prunes state + trace files older than the age threshold', () => {
    const oldFile = resolve(ws, 'state', 'old.json');
    writeFileSync(oldFile, '{}');
    // force mtime to 60 days ago
    const past = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    utimesSync(oldFile, past, past);
    const r = runRetention({ workspaceDir: ws, maxAgeDays: 14 });
    expect(r.state.deletedFiles).toBe(1);
    expect(existsSync(oldFile)).toBe(false);
  });

  it('never prunes recent files', () => {
    const f = resolve(ws, 'state', 'recent.json');
    writeFileSync(f, '{}');
    const r = runRetention({ workspaceDir: ws, maxAgeDays: 14 });
    expect(r.state.remainingFiles).toBe(1);
    expect(existsSync(f)).toBe(true);
  });

  it('skips subdirectories and hidden files', () => {
    mkdirSync(resolve(ws, 'state', 'subdir'));
    writeFileSync(resolve(ws, 'state', '.hidden'), '{}');
    const r = runRetention({ workspaceDir: ws, maxAgeDays: 0 });
    expect(r.state.deletedFiles).toBe(0);
  });

  it('returns a logPath even when nothing was deleted', () => {
    const r = runRetention({ workspaceDir: ws, maxAgeDays: 14 });
    expect(r.logPath).toContain('retention.log');
  });
});
