import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export type HookName =
  | 'before_goal'
  | 'after_goal'
  | 'before_task'
  | 'after_task'
  | 'before_agent'
  | 'after_agent'
  | 'before_tool'
  | 'after_tool'
  | 'before_edit'
  | 'after_edit'
  | 'before_shell'
  | 'after_shell'
  | 'before_verify'
  | 'after_verify'
  | 'on_error'
  | 'on_checkpoint'
  | 'on_rollback';

export interface HookConfig {
  [hook: string]: string | string[];
}

export interface HookResult {
  allowed: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** The hook could not execute (spawn failure) — an infrastructure fault, not
   *  a deliberate veto. Surfaces the crash cause so a broken hook is diagnosable
   *  instead of silently blocking the run. */
  crashed?: boolean;
  /** The hook exceeded its time budget and was killed. */
  timedOut?: boolean;
}

/** Reserved hooks.json key: the hook commands that belong to a `sandbox: true`
 *  plugin. Those run under OS sandboxing + a secrets-scrubbed environment. */
export const SANDBOX_KEY = '__sandbox__';

/** Set MOCHI_HOOKS_FAIL_OPEN=1 to skip (rather than block on) hooks that crash
 *  or time out. Deliberate non-zero exits still veto. Default: fail-closed. */
function hookFailOpen(): boolean {
  const v = process.env.MOCHI_HOOKS_FAIL_OPEN;
  return v === '1' || v === 'true';
}

const SECRET_ENV = /(API_KEY|_TOKEN|^TOKEN$|SECRET|PASSWORD|PASSWD|CREDENTIAL)/i;

/** Return value of a programmatic hook handler. `false` (or a HookResult with
 *  allowed:false) vetoes a `before_*` hook; anything else allows. */
export type HookHandlerResult = boolean | void | HookResult;
export type HookHandler = (context: Record<string, string>) => HookHandlerResult | Promise<HookHandlerResult>;

// Process-wide registry for in-process (JS) hooks — the SDK/host equivalent of
// the shell-command hooks in hooks.json. Module-global so a handler registered
// by the host is seen by every HookManager instance (Runtime's checkpoint hooks
// and each agent loop's tool hooks are separate instances).
const JS_HOOKS = new Map<HookName, Set<HookHandler>>();

/** Register a JS hook handler. Returns an unsubscribe fn. */
export function registerHook(name: HookName, handler: HookHandler): () => void {
  let set = JS_HOOKS.get(name);
  if (!set) { set = new Set(); JS_HOOKS.set(name, set); }
  set.add(handler);
  return () => {
    const s = JS_HOOKS.get(name);
    if (!s) return;
    s.delete(handler);
    if (s.size === 0) JS_HOOKS.delete(name);
  };
}

/** Snapshot of the JS handlers for a hook (stable copy while running). */
export function hookHandlersFor(name: HookName): HookHandler[] {
  return [...(JS_HOOKS.get(name) ?? [])];
}

const OK: HookResult = { allowed: true, exitCode: 0, stdout: '', stderr: '' };

export class HookManager {
  private config: HookConfig = {};
  /** Commands owned by a `sandbox: true` plugin (from the reserved
   *  SANDBOX_KEY). Cached after the constructor's file reads. */
  private sandboxed: Set<string> | null = null;

  constructor(workspaceDir: string) {
    // MCH-37: hooks.json is read from BOTH the workspace (.mochi/) and the
    // project root — project-root wins (more specific). Same convention as
    // Claude Code's hooks (settings.json > project settings).
    const candidates = [
      resolve(workspaceDir, 'hooks.json'),
      resolve(process.cwd(), 'hooks.json'),
      resolve(process.cwd(), '.mochi', 'hooks.json'),
    ];
    for (const path of candidates) {
      if (!existsSync(path)) continue;
      try {
        const parsed = JSON.parse(readFileSync(path, 'utf8'));
        if (parsed && typeof parsed === 'object') this.config = { ...this.config, ...(parsed as HookConfig) };
      } catch {
        // malformed hook file: skip, never break the run
      }
    }
  }

  list(): HookName[] {
    return (Object.keys(this.config) as HookName[]).filter((h) => h !== (SANDBOX_KEY as string));
  }

  /** Commands that must run sandboxed (declared by sandbox:true plugins). */
  private sandboxCommands(): Set<string> {
    if (this.sandboxed) return this.sandboxed;
    const raw = (this.config as Record<string, unknown>)[SANDBOX_KEY];
    this.sandboxed = new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
    return this.sandboxed;
  }

  enabled(name: HookName): boolean {
    return this.commandsFor(name).length > 0 || hookHandlersFor(name).length > 0;
  }

  private commandsFor(name: HookName): string[] {
    const value = this.config[name];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
  }

  /** Run one in-process handler, mapping its return value to a HookResult.
   *  A throw is treated as a veto (fail-closed) with the error captured — a
   *  broken gate must never silently authorize the action it guards. */
  private async runHandler(handler: HookHandler, context: Record<string, string>): Promise<HookResult> {
    try {
      const r = await handler(context);
      if (r === false) return { allowed: false, exitCode: 1, stdout: '', stderr: 'vetoed by hook handler' };
      if (r && typeof r === 'object') return r;
      return OK;
    } catch (err) {
      return { allowed: false, exitCode: 1, stdout: '', stderr: err instanceof Error ? err.message : String(err), crashed: true };
    }
  }

  async runBefore(name: HookName, context: Record<string, string> = {}): Promise<HookResult> {
    const failOpen = hookFailOpen();
    // Lazily sequenced so a deliberate veto short-circuits, while a crashed /
    // timed-out hook is isolated: the run continues, the fault is surfaced.
    const steps: Array<() => Promise<HookResult>> = [
      ...hookHandlersFor(name).map((h) => () => this.runHandler(h, context)),
      ...this.commandsFor(name).map((c) => () => this.run(c, context)),
    ];
    let last: HookResult = OK;
    for (const step of steps) {
      const r = await step();
      if (r.allowed) { last = r; continue; }
      // Infrastructure fault (crash/timeout) is not a security decision: never
      // fail the whole run on it — but only skip it when explicitly opted in.
      if (failOpen && (r.crashed || r.timedOut)) continue;
      return r;
    }
    return last;
  }

  async runAfter(name: HookName, context: Record<string, string> = {}): Promise<HookResult[]> {
    const results: HookResult[] = [];
    for (const handler of hookHandlersFor(name)) {
      results.push(await this.runHandler(handler, context));
    }
    for (const command of this.commandsFor(name)) {
      results.push(await this.run(command, context));
    }
    return results;
  }

  private async run(command: string, context: Record<string, string>): Promise<HookResult> {
    const sandboxed = this.sandboxCommands().has(command);
    let env: NodeJS.ProcessEnv = { ...process.env, MOCHI_HOOK: '1' };
    if (sandboxed) {
      // A sandbox:true plugin opted out of secrets: run its hooks without
      // API keys/tokens in the environment.
      env = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (!SECRET_ENV.test(k)) env[k] = v;
      }
      env.MOCHI_HOOK = '1';
      env.MOCHI_SANDBOX = '1';
    }
    for (const [k, v] of Object.entries(context)) env[`MOCHI_${k.toUpperCase()}`] = v;
    // Central exec policy (timeout → SIGTERM → SIGKILL, output cap) instead
    // of a bare execFile: a hanging hook can no longer stall a run forever.
    // Platform shell (cmd.exe on Windows, $SHELL/bash elsewhere) — a
    // hardcoded 'sh -c' makes EVERY hook fail on win32 (sh is not a
    // Windows binary), silently breaking the whole hook system there.
    const { runShellString } = await import('./exec.js');
    try {
      const r = await runShellString(command, {
        env,
        timeoutMs: 5000,
        maxOutput: 1024 * 1024,
        // Sandboxed plugin hooks get OS-level isolation (network off) where
        // bubblewrap is available; elsewhere the env scrub still applies.
        ...(sandboxed ? { sandbox: { mode: 'auto' as const, network: false } } : {}),
      });
      if (r.timedOut) {
        return { allowed: false, exitCode: 124, stdout: r.stdout, stderr: r.stderr || 'hook timed out', timedOut: true };
      }
      const exitCode = r.code ?? 1;
      return { allowed: exitCode === 0, exitCode, stdout: r.stdout, stderr: r.stderr };
    } catch (err) {
      // Spawn/exec failure — an infrastructure fault, not a deliberate veto.
      return { allowed: false, exitCode: 1, stdout: '', stderr: err instanceof Error ? err.message : String(err), crashed: true };
    }
  }
}
