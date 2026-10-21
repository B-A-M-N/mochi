import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { desktopGuiReason, shellTool } from './shell.js';

// Real, existing cwd: '/tmp' does not exist on Windows and spawn-with-bad-cwd
// surfaces as a confusing `spawn ...cmd.exe ENOENT`.
const CWD = mkdtempSync(join(tmpdir(), 'mochi-shell-'));

describe('desktopGuiReason', () => {
  it('detects common desktop GUI app launches', () => {
    expect(desktopGuiReason('gnome-calculator')).toMatch(/gnome-calculator/i);
    expect(desktopGuiReason('kcalc &')).toMatch(/kcalc/i);
    expect(desktopGuiReason('firefox &')).toMatch(/firefox/i);
    expect(desktopGuiReason('sudo gnome-calculator')).toMatch(/gnome-calculator/i);
  });

  it('allows normal headless commands', () => {
    for (const cmd of [
      'node calculator.js',
      'python3 calculator.py',
      'npm test',
      'grep -r calc src',
      'echo hello',
      'git status',
      'ls',
    ]) {
      expect(desktopGuiReason(cmd), cmd).toBeNull();
    }
  });
});

describe('shellTool GUI guard', () => {
  it('refuses to launch a desktop GUI app with a guiding error', async () => {
    const err = await shellTool
      .execute({ command: 'gnome-calculator' }, { cwd: CWD, config: { safety: { mode: 'safe' } } })
      .then(() => null, (e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/gnome-calculator/i);
    expect((err as Error).message).toMatch(/BUILD\/IMPLEMENT\/CODE/i);
  });
});

describe('shellTool timeout sanitization', () => {
  it('runs the command normally when the model sends a junk timeout (was: NaN → instant kill)', async () => {
    // Old math: Number("30s") = NaN → setTimeout(NaN) fires in ~1ms → SIGTERM
    // before any output, "[command timed out after NaNs]". The sanitized
    // value falls back to the configured default instead.
    const out = await shellTool.execute(
      { command: 'echo hello', timeout: '30s' },
      { cwd: CWD, config: { safety: { mode: 'safe', commandTimeoutSeconds: 120 } as never } as never },
    );
    expect(out).toContain('hello');
    expect(out).not.toContain('timed out');
  }, 20_000);

  it('accepts a numeric timeout and still enforces it', async () => {
    const out = await shellTool.execute(
      { command: 'echo n', timeout: 30 },
      { cwd: CWD, config: { safety: { mode: 'safe', commandTimeoutSeconds: 120 } as never } as never },
    );
    expect(out).toContain('n');
    expect(out).not.toContain('timed out');
  }, 20_000);
});