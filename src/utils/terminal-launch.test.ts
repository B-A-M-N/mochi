import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, delimiter } from 'node:path';
import {
  findTerminalEmulator, buildLaunchArgs, resolveSelfCommand, launchInNewTerminal,
} from './terminal-launch.js';

const geo = { cols: 190, rows: 45, title: 'Mochi' };

describe('findTerminalEmulator', () => {
  it('returns undefined when nothing is available', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-term-'));
    try {
      expect(findTerminalEmulator(dir)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('picks by priority order, not PATH order', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-term-'));
    try {
      for (const name of ['xterm', 'konsole']) {
        const p = resolve(dir, name);
        writeFileSync(p, '#!/bin/sh\necho hi\n');
        chmodSync(p, 0o755);
      }
      // konsole outranks xterm even though both exist.
      expect(findTerminalEmulator(dir)?.name).toBe('konsole');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('buildLaunchArgs', () => {
  const cmd = ['/home/u/mochi/dist/mochi-bin'];
  it('gnome-terminal gets title + geometry + -- separator', () => {
    expect(buildLaunchArgs('gnome-terminal', cmd, geo)).toEqual([
      '--title=Mochi', '--geometry=190x45', '--', ...cmd,
    ]);
  });
  it('xterm pins black bg + white fg + monospace (the guarantee valve)', () => {
    const args = buildLaunchArgs('xterm', cmd, geo);
    expect(args).toContain('-bg');
    expect(args[args.indexOf('-bg') + 1]).toBe('black');
    expect(args).toContain('-fa');
    expect(args.slice(-cmd.length)).toEqual(cmd);
  });
  it('unknown emulators fall back to -e convention', () => {
    expect(buildLaunchArgs('mystery-term', cmd, geo)).toEqual(['-e', ...cmd]);
  });
  it('clamps absurd geometry', () => {
    const args = buildLaunchArgs('gnome-terminal', cmd, { cols: 5, rows: 2, title: 'M' });
    expect(args).toContain('--geometry=20x8');
  });
});

describe('resolveSelfCommand', () => {
  it('re-invokes node scripts via the interpreter', () => {
    expect(resolveSelfCommand('/usr/bin/node', ['node', '/x/dist/cli.js'])).toEqual(['/usr/bin/node', '/x/dist/cli.js']);
  });
  it('re-invokes compiled binaries directly', () => {
    expect(resolveSelfCommand('/x/mochi-bin', ['/x/mochi-bin'])).toEqual(['/x/mochi-bin']);
  });
});

describe('launchInNewTerminal', () => {
  it('reports a clean error with no emulator', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-term-'));
    try {
      const r = await launchInNewTerminal([], { pathEnv: dir });
      expect(r.ok).toBe(false);
      expect(r.error).toContain('No terminal emulator');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('spawns a stub emulator with the exact argv (integration)', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-term-'));
    const log = resolve(dir, 'argv.log');
    try {
      const stub = resolve(dir, 'gnome-terminal');
      writeFileSync(stub, `#!/bin/sh\nprintf '%s\\n' "$@" > ${log}\n`);
      chmodSync(stub, 0o755);
      const r = await launchInNewTerminal(['goal', 'x'], { pathEnv: dir + delimiter + (process.env.PATH ?? '') });
      // gnome-terminal may or may not exist on the test box; force ours first
      expect(r.ok).toBe(true);
      // Detached spawn races the assertion: poll for the stub's output.
      const { readFileSync, existsSync } = await import('node:fs');
      const deadline = Date.now() + 5000;
      while (!existsSync(log) && Date.now() < deadline) {
        await new Promise((res) => setTimeout(res, 50));
      }
      const logged = readFileSync(log, 'utf8');
      expect(logged).toContain('--geometry=190x45');
      expect(logged).toContain('goal');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
