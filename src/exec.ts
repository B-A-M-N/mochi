// Central command-execution policy: every child process mochi spawns for
// agent work flows through here (shell tool, verification, cron notify).
// Guarantees on every call: bounded wall-clock (SIGTERM then SIGKILL),
// bounded output (never OOMs the harness on firehose commands), argv-array
// API for shell-free execution, and an audit hook for risk logging.
// Long-lived processes (background tasks, daemons, PTY) keep their own
// lifecycle owners and are intentionally OUT of scope.
import { spawn, execFile } from 'node:child_process';

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
  const child = spawn(cmd, [...args], {
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
  const child = spawn(shellBin, ['-c', command], {
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
