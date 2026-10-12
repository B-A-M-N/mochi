// Native-terminal launcher (`mochi term`): open Mochi in its OWN terminal
// emulator window instead of inheriting whatever terminal (profile colors,
// fonts, PTY-mangling middleware) happens to host the current shell. The
// spawned window is configured for a known-good setup — black background,
// monospace font, 190x45 cells — so rendering is deterministic no matter how
// exotic the caller's environment is.
//
// Pure arg builders (unit-tested) + one thin spawn edge. Supports the
// emulators people actually have; xterm is the universal fallback and pins
// -bg black explicitly, which guarantees the black canvas anywhere.
import { accessSync, constants } from 'node:fs';
import { resolve, delimiter } from 'node:path';
import { spawn } from 'node:child_process';

export interface TerminalChoice {
  /** Binary name as found on PATH. */
  name: string;
  /** Absolute path resolved from PATH. */
  path: string;
}

/** Detection priority: desktop-native first, universal fallback last. */
export const TERMINAL_PRIORITY = [
  'gnome-terminal',
  'konsole',
  'xfce4-terminal',
  'xfce4_terminal',
  'alacritty',
  'kitty',
  'wezterm',
  'xterm',
] as const;

export type TerminalName = (typeof TERMINAL_PRIORITY)[number];

/** Find the best available emulator using an explicit PATH (testable). */
export function findTerminalEmulator(pathEnv = process.env.PATH ?? ''): TerminalChoice | undefined {
  const dirs = pathEnv.split(delimiter).filter(Boolean);
  for (const name of TERMINAL_PRIORITY) {
    for (const dir of dirs) {
      const full = resolve(dir, name);
      try {
        accessSync(full, constants.X_OK);
        return { name, path: full };
      } catch { /* not here */ }
    }
  }
  return undefined;
}

export interface LaunchGeometry {
  cols: number;
  rows: number;
  title: string;
}

/** Build the exact argv for `emulator` to open a window running mochi.
 *  `mochiCmd` is the resolved self-command, e.g. ['node','dist/cli.js'] or
 *  ['/…/dist/mochi-bin']. Pure — every emulator shape is pinned by tests. */
export function buildLaunchArgs(
  emulator: string,
  mochiCmd: string[],
  geo: LaunchGeometry,
): string[] {
  const geom = `${Math.max(20, geo.cols)}x${Math.max(8, geo.rows)}`;
  switch (emulator as TerminalName) {
    case 'gnome-terminal':
      return ['--title=' + geo.title, `--geometry=${geom}`, '--', ...mochiCmd];
    case 'konsole':
      return ['--title', geo.title, '-e', ...mochiCmd];
    case 'xfce4-terminal':
    case 'xfce4_terminal':
      return [`--title=${geo.title}`, `--geometry=${geom}`, '-x', ...mochiCmd];
    case 'alacritty': {
      const [cols, rows] = geom.split('x').map(Number);
      return ['--title', geo.title, '--dimensions', String(cols), String(rows), '-e', ...mochiCmd];
    }
    case 'kitty':
      return ['--title', geo.title, ...mochiCmd];
    case 'wezterm':
      return ['start', '--cwd', process.cwd(), '--', ...mochiCmd];
    case 'xterm':
      // The guarantee valve: explicit black bg + white fg + monospace font,
      // so the canvas is right even with a hostile terminal profile.
      return ['-T', geo.title, '-bg', 'black', '-fg', 'white',
        '-fa', 'Monospace:size=11', '-geometry', geom, '-e', ...mochiCmd];
    default:
      // Unknown emulator: most accept `-e <cmd>` (xterm convention).
      return ['-e', ...mochiCmd];
  }
}

/** Resolve how to re-invoke THIS mochi (node script vs compiled binary).
 *  Pure function of (execPath, argv) for testability. */
export function resolveSelfCommand(execPath: string, argv: string[]): string[] {
  const script = argv[1] ?? '';
  if (script.endsWith('cli.js')) return [execPath, script];
  return [argv[0]];
}

export interface LaunchResult {
  ok: boolean;
  emulator?: string;
  pid?: number;
  error?: string;
  /** The exact command that would run (always populated — dry-run safe). */
  command?: string[];
}

/** Open the new window (detached). Never throws — returns a result.
 *  `dryRun: true` resolves the emulator + command and returns WITHOUT
 *  spawning — the old code always spawned, then printed `MOCHI-TERM:` after
 *  the window had already opened, so the documented safety valve wasn't one. */
export async function launchInNewTerminal(
  mochiArgs: string[] = [],
  opts: { title?: string; cols?: number; rows?: number; emulator?: string; pathEnv?: string; dryRun?: boolean } = {},
): Promise<LaunchResult> {
  const execPath = process.execPath;
  const self = resolveSelfCommand(execPath, process.argv);
  const geo: LaunchGeometry = {
    title: opts.title ?? 'Mochi',
    cols: opts.cols ?? 190,
    rows: opts.rows ?? 45,
  };
  let choice: TerminalChoice | undefined;
  if (opts.emulator) {
    choice = { name: opts.emulator, path: opts.emulator };
  } else {
    choice = findTerminalEmulator(opts.pathEnv);
  }
  if (!choice) {
    return { ok: false, error: 'No terminal emulator found on PATH (looked for: ' + TERMINAL_PRIORITY.join(', ') + ').' };
  }
  const args = buildLaunchArgs(choice.name, [...self, ...mochiArgs], geo);
  const command = [choice.path, ...args];
  if (opts.dryRun) {
    return { ok: true, emulator: choice.name, command };
  }
  try {
    const child = spawn(choice.path, args, {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return { ok: true, emulator: choice.name, pid: child.pid, command };
  } catch (e) {
    return { ok: false, emulator: choice.name, error: e instanceof Error ? e.message : String(e), command };
  }
}
