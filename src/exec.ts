// Central command-execution policy: every child process mochi spawns for
// agent work flows through here (shell tool, verification, cron notify).
// Guarantees on every call: bounded wall-clock (SIGTERM then SIGKILL),
// bounded output (never OOMs the harness on firehose commands), argv-array
// API for shell-free execution, and an audit hook for risk logging.
// Long-lived processes (background tasks, daemons, PTY) keep their own
// lifecycle owners and are intentionally OUT of scope.
import { spawn, execFile } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { resolve, delimiter } from 'node:path';
import { accessSync, constants } from 'node:fs';

export interface SandboxOptions {
  /** 'off' (default) runs directly; 'bubblewrap' forces bwrap (fails if
   *  missing); 'auto' uses bwrap when available, else runs directly. */
  mode: 'off' | 'auto' | 'bubblewrap';
  /** Allow network inside the sandbox. Default true (npm/tests need it). */
  network?: boolean;
  /** Extra read-write paths beyond cwd + tmpdir + devtool caches. */
  writablePaths?: string[];
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Wall-clock budget. Default 120s. */
  timeoutMs?: number;
  /** Per-stream accumulation cap. Default 2MB. */
  maxOutput?: number;
  /** AbortSignal for caller cancellation (Ctrl+C, task abort). */
  signal?: AbortSignal;
  /** Grace period between SIGTERM and SIGKILL. Default 1500ms. */
  killGraceMs?: number;
  /** Called once with the outcome for audit/risk logging. Never throws. */
  onAudit?: (info: { cmd: string; code: number | null; timedOut: boolean; durationMs: number }) => void;
  /** OS-level sandbox (bubblewrap). Default off — opt in per call or via
   *  `safety.sandbox` for the shell tool. */
  sandbox?: SandboxOptions;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
  cancelled: boolean;
  durationMs: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_OUTPUT = 2_000_000;

function finishSpawn(
  child: ReturnType<typeof spawn>,
  cmd: string,
  opts: ExecOptions,
  stdoutRef: { text: string; truncated: boolean },
  stderrRef: { text: string; truncated: boolean },
  startedAt: number,
): Promise<ExecResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const killGraceMs = opts.killGraceMs ?? 1500;
  // MOCHI_EXEC_TRACE=1 logs every spawn and outcome — the ONLY way to see
  // WHICH command a hung run is stuck on (a hang prints start, never done).
  if (process.env.MOCHI_EXEC_TRACE === '1') {
    console.warn(`[exec] start :: ${cmd.slice(0, 160)}${opts.cwd ? ` (cwd=${opts.cwd})` : ''}`);
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let cancelled = false;
    const done = (code: number | null, extra?: { timedOut?: boolean; cancelled?: boolean }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
      child.stdout?.destroy();
      child.stderr?.destroy();
      const durationMs = Date.now() - startedAt;
      // The `close` event usually wins the race after our SIGTERM (the child
      // is already dead), so the closure flags — not just `extra` — carry
      // the timeout/cancel truth.
      const wasTimedOut = extra?.timedOut ?? timedOut;
      const wasCancelled = extra?.cancelled ?? cancelled;
      if (process.env.MOCHI_EXEC_TRACE === '1') {
        console.warn(`[exec] done  :: ${Math.round(durationMs)}ms code=${code}${wasTimedOut ? ' TIMEOUT' : ''}${wasCancelled ? ' CANCELLED' : ''} :: ${cmd.slice(0, 160)}`);
      }
      try {
        opts.onAudit?.({ cmd: cmd.slice(0, 200), code, timedOut: wasTimedOut, durationMs });
      } catch { /* audit must never break execution */ }
      resolve({
        stdout: stdoutRef.text,
        stderr: stderrRef.text,
        code,
        timedOut: wasTimedOut,
        cancelled: wasCancelled,
        durationMs,
      });
    };
    const killTree = (sig: NodeJS.Signals) => { try { child.kill(sig); } catch { /* already dead */ } };
    const timer = setTimeout(() => {
      timedOut = true;
      killTree('SIGTERM');
      child.stdout?.destroy();
      child.stderr?.destroy();
      setTimeout(() => { if (!settled) { killTree('SIGKILL'); done(124, { timedOut: true }); } }, killGraceMs);
    }, timeoutMs);
    // `timer.unref?.()` so a runaway timer never holds the process open.
    (timer as unknown as { unref?: () => void }).unref?.();
    const onAbort = () => {
      cancelled = true;
      killTree('SIGTERM');
      child.stdout?.destroy();
      child.stderr?.destroy();
      setTimeout(() => { if (!settled) { killTree('SIGKILL'); done(130, { cancelled: true }); } }, 800);
    };
    if (opts.signal?.aborted) { onAbort(); return; }
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    void timedOut; void cancelled;
    child.stdout?.on('data', (chunk) => {
      stdoutRef.text += String(chunk);
      if (stdoutRef.text.length > (opts.maxOutput ?? DEFAULT_MAX_OUTPUT)) {
        stdoutRef.text = stdoutRef.text.slice(0, opts.maxOutput ?? DEFAULT_MAX_OUTPUT) + '\n... [truncated]';
        stdoutRef.truncated = true;
        child.stdout?.destroy();
      }
    });
    child.stderr?.on('data', (chunk) => {
      stderrRef.text += String(chunk);
      if (stderrRef.text.length > (opts.maxOutput ?? DEFAULT_MAX_OUTPUT)) {
        stderrRef.text = stderrRef.text.slice(0, opts.maxOutput ?? DEFAULT_MAX_OUTPUT) + '\n... [truncated]';
        stderrRef.truncated = true;
        child.stderr?.destroy();
      }
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
      reject(err);
    });
    child.on('close', (code) => done(code));
  });
}

/** Run a command WITHOUT a shell: argv array only, no interpolation.
 *  Prefer this for every harness-internal invocation (git, probes, notify). */
export function runArgv(cmd: string, args: readonly string[], opts: ExecOptions = {}): Promise<ExecResult> {
  const startedAt = Date.now();
  const wrapped = maybeSandbox(cmd, args, opts);
  const child = spawn(wrapped.cmd, wrapped.args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    stdio: 'pipe',
    windowsHide: true,
  });
  return finishSpawn(child, [cmd, ...args].join(' '), opts, { text: '', truncated: false }, { text: '', truncated: false }, startedAt);
}

/** Run a shell string (`sh -c`-class) under policy. Reserved for the agent's
 *  `shell` tool and user-configured hooks (cron notify) where shell
 *  composition (pipes, redirects) is the feature. Harness internals must
 *  use runArgv instead. */
export function runShellString(command: string, opts: ExecOptions & { shellBin?: string } = {}): Promise<ExecResult> {
  const startedAt = Date.now();
  const shellBin = opts.shellBin ?? (process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : (process.env.SHELL || '/bin/bash'));
  const wrapped = maybeSandbox(shellBin, ['-c', command], opts);
  const child = spawn(wrapped.cmd, wrapped.args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    stdio: 'pipe',
    windowsHide: true,
  });
  return finishSpawn(child, command, opts, { text: '', truncated: false }, { text: '', truncated: false }, startedAt);
}

/** execFile-style convenience for short harness probes with a string result.
 *  Rejects on non-zero exit (like execFile with callback error). */
export function execArgvText(cmd: string, args: readonly string[], opts: { cwd?: string; timeoutMs?: number; maxBuffer?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, [...args], {
      cwd: opts.cwd,
      timeout: opts.timeoutMs ?? 30_000,
      maxBuffer: opts.maxBuffer ?? 1024 * 1024,
    }, (err, stdout) => {
      if (err) reject(err);
      else resolve(String(stdout));
    });
  });
}

/** Default writable locations inside a bubblewrap sandbox: the task cwd, the
 *  OS tmpdir, and the dev-tool caches npm/cargo/pip need to function. The
 *  rest of the filesystem (including $HOME dotfiles and SSH keys) is
 *  read-only; /tmp and /dev+/proc are fresh private mounts. */
function defaultSandboxWritable(cwd?: string): string[] {
  const home = homedir();
  const out = [cwd ?? process.cwd(), tmpdir()];
  for (const d of ['.npm', '.cache', '.cargo']) {
    const p = resolve(home, d);
    try {
      accessSync(p, constants.R_OK);
      out.push(p);
    } catch { /* cache dir absent: skip rather than create it inside the sandbox */ }
  }
  return [...new Set(out)];
}

let cachedBwrap: string | null | undefined;

/** Absolute path to `bwrap`, or null when unavailable. Cached. Testable via
 *  explicit pathEnv (production callers omit it). */
export function detectBubblewrap(pathEnv = process.env.PATH ?? ''): string | null {
  if (cachedBwrap !== undefined && pathEnv === (process.env.PATH ?? '')) return cachedBwrap;
  let found: string | null = null;
  for (const dir of pathEnv.split(delimiter).filter(Boolean)) {
    const full = resolve(dir, 'bwrap');
    try {
      accessSync(full, constants.X_OK);
      found = full;
      break;
    } catch { /* not here */ }
  }
  if (pathEnv === (process.env.PATH ?? '')) cachedBwrap = found;
  return found;
}

/** Pure argv builder: wrap [cmd, ...args] in a bubblewrap invocation.
 *  Exported for tests; runArgv/runShellString call it via maybeSandbox. */
export function buildBubblewrapArgs(
  bwrapBin: string,
  cmd: string,
  args: readonly string[],
  opts: { cwd?: string; network?: boolean; writablePaths?: string[] } = {},
): string[] {
  const cwd = opts.cwd ?? process.cwd();
  const argv: string[] = [
    '--ro-bind', '/', '/',
    '--dev', '/dev',
    '--proc', '/proc',
    '--tmpfs', '/tmp',
  ];
  const writable = [...defaultSandboxWritable(cwd), ...(opts.writablePaths ?? [])];
  for (const p of new Set(writable)) {
    argv.push('--bind', p, p);
  }
  if (opts.network === false) argv.push('--unshare-net');
  argv.push('--chdir', cwd, '--', cmd, ...args);
  return [bwrapBin, ...argv];
}

/** Wrap [cmd, args] per opts.sandbox. Returns the command unchanged when the
 *  sandbox is off, unavailable in auto mode — or throws in `bubblewrap` mode
 *  when bwrap is missing (explicit request, fail loudly, never silently run
 *  unsandboxed). */
export function maybeSandbox(
  cmd: string,
  args: readonly string[],
  opts: ExecOptions,
): { cmd: string; args: string[] } {
  const sb = opts.sandbox;
  if (!sb || sb.mode === 'off' || process.platform === 'win32') return { cmd, args: [...args] };
  const bwrap = detectBubblewrap();
  if (!bwrap) {
    if (sb.mode === 'bubblewrap') {
      throw new Error('Sandbox requested (bubblewrap) but `bwrap` was not found on PATH. Install bubblewrap or use sandbox mode "off".');
    }
    return { cmd, args: [...args] };
  }
  const full = buildBubblewrapArgs(bwrap, cmd, args, {
    cwd: opts.cwd,
    network: sb.network,
    writablePaths: sb.writablePaths,
  });
  return { cmd: full[0], args: full.slice(1) };
}
