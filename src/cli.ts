#!/usr/bin/env node
// Sync fs/url/path imports at module top (ESM-safe; no require() in output).
import { readFileSync, statSync, existsSync, readdirSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname, resolve, join as pathJoin } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as nodeModule from 'node:module';
// V8 compile cache: persist compiled module bytecode under ~/.cache/mochi so
// subsequent invocations skip re-parsing (~16% faster cold start, 109ms ->
// 91ms over 20 runs). NODE_COMPILE_CACHE must be set before node boots to
// cover the entry module, so when it isn't set we call enableCompileCache()
// in-process — it activates for all later-loaded modules even if the entry
// module itself is compiled fresh on the very first run.
//
// Namespace import (not `await import`) on purpose: this file must contain NO
// top-level await — `bun build --compile --bytecode` converts the bundle to
// CJS and any TLA in the shipped graph makes the whole standalone binary
// unbuildable. `import * as` degrades safely on pre-22 node (the property is
// simply undefined) instead of hard-failing at link time like a missing named
// export would.
if (!process.env.NODE_COMPILE_CACHE && nodeModule.enableCompileCache) {
  try {
    const cacheDir = resolve(homedir(), '.cache', 'mochi', 'compile');
    mkdirSync(cacheDir, { recursive: true });
    nodeModule.enableCompileCache(cacheDir);
  } catch { /* read-only home or pre-22 node — run without cache */ }
}
// Repo module, lazy: `findProjectRoot` is only needed by specific commands
// (hooks/doctor/sessions) — never by --version/--help or the initial TUI
// frame. Loading it statically cost ~12ms CPU on EVERY invocation.
type RepoModule = typeof import('./repo/repo.js');
let repoModule: RepoModule | null = null;
const loadRepoModule = async (): Promise<RepoModule> => (repoModule ??= await import('./repo/repo.js'));
import type { MochiConfig } from './types.js';

// Resolve the version from package.json when running from source; when Mochi is
// compiled to a standalone binary there is no package.json next to it, so fall
// back to the constant (kept in sync with package.json at build time).
let VERSION = '0.23.0';
try {
  const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '../package.json');
  VERSION = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
} catch {
  /* compiled binary: use the baked-in default */
}

// Global crash safety net (P0 reliability): a stray unhandled rejection must
// never kill a running session mid-task (the classic "mochi froze" experience),
// and a hard crash must leave the user's terminal usable. Details land in
// ~/.mochi/logs/crash.log for post-mortem; `mochi doctor` can surface them.
function logCrash(kind: string, err: unknown): void {
  try {
    const dir = pathJoin(homedir(), '.mochi', 'logs');
    mkdirSync(dir, { recursive: true });
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
    appendFileSync(pathJoin(dir, 'crash.log'), `[${new Date().toISOString()}] ${kind}: ${detail}\n`);
  } catch {
    /* never throw from the crash logger */
  }
}

process.on('unhandledRejection', (reason) => {
  // Log-and-continue: the agent loop, watchdogs, and per-tool timeouts own
  // recovery. Dying here is what turned a recoverable hiccup into a "frozen"
  // session with a broken terminal.
  logCrash('unhandledRejection', reason);
});
// EPIPE on stdout (the terminal pane was closed under us — Tmux kill-pane,
// tab close, SSH drop) must never crash the CLI. crash.log is full of
// "Error: write EPIPE at console.log" → uncaughtException → exit. Drop the
// dead write and keep running; every other stream error stays fatal.
process.stdout?.on?.('error', (err: NodeJS.ErrnoException) => {
  if (err?.code === 'EPIPE' || err?.code === 'EIO') return;
  throw err;
});
process.stderr?.on?.('error', (err: NodeJS.ErrnoException) => {
  if (err?.code === 'EPIPE' || err?.code === 'EIO') return;
  throw err;
});
process.on('uncaughtException', (err: unknown) => {
  const code = (err as NodeJS.ErrnoException)?.code ?? '';
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  if (code === 'EPIPE' || code === 'EIO' || msg.includes('errno: 5')) {
    // Terminal closed, detached, or stream pipe broken: exit cleanly.
    process.exit(0);
  }
  // Synchronous state is undefined after this; log, restore, and bail.
  // The TUI's process.on('exit') listener still runs and restores the tty.
  logCrash('uncaughtException', err);
  try { console.error(`[fatal] ${msg}`); } catch { /* ignore stdout/stderr errors */ }
  try { console.error(`Report it: mochi feedback --crash "what you were doing" (attaches the crash tail, no tracking)`); } catch { /* ignore */ }
  process.exit(1);
});

const BOOLEAN_FLAGS = new Set([
  'p', 'print', 'auto', 'quiet', 'q', 'verbose', 'v', 'debug', 'h', 'help', 'version', 'offline', 'enhance', 'install', 'plan',
  'w', 'worktree',
  'y', 'yolo', 'dangerously-skip-permissions', 'force', 'user',
  'u', 'uncensored', 'admin',
  'strict', 'json', 'diff-only', 'auto-commit', 'repair',
  // Value-less flags that used to swallow their next argument: `skills import
  // --list hermes:` ate the source as the flag value (→ usage error), and
  // `termix --coms "fix the bug"` assigned the task text to flags.coms.
  'list', 'update', 'coms', 'sep',
]);

function parseArgs(argv: string[]): { flags: Record<string, string | boolean>; positional: string[] } {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      if (rest.length > 0) {
        flags[key] = rest.join('=');
      } else if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

/** CLI flag overrides plus the two UI-contract markers the permission layer
 *  reads without config hacks (typed — no loose casts at the boundary). */
export interface FlagOverrides extends Partial<MochiConfig> {
  __yolo?: boolean;
  __uncensored?: boolean;
}

function configFromFlags(flags: Record<string, string | boolean>): FlagOverrides {
  const overrides: FlagOverrides = {};
  const model: Partial<MochiConfig['model']> = {};
  if (flags.provider) model.provider = String(flags.provider);
  if (flags.model) model.model = String(flags.model);
  if (flags['api-key']) model.apiKey = String(flags['api-key']);
  if (flags.baseUrl) model.baseUrl = String(flags.baseUrl);
  if (Object.keys(model).length) overrides.model = model as MochiConfig['model'];
  if (flags.safety) overrides.safety = { ...({} as MochiConfig['safety']), mode: String(flags.safety) as MochiConfig['safety']['mode'] };
  if (flags.auto) overrides.safety = { ...({} as MochiConfig['safety']), mode: 'auto' as const };
  if (flags['max-tokens'] || flags['max-cost'] || flags['max-model-calls'] || flags['max-tool-calls']) {
    overrides.safety = {
      ...(overrides.safety ?? ({} as MochiConfig['safety'])),
      ...(flags['max-tokens'] ? { maxTokens: Number(flags['max-tokens']) } : {}),
      ...(flags['max-cost'] ? { maxCostUsd: Number(flags['max-cost']) } : {}),
      ...(flags['max-model-calls'] ? { maxModelCalls: Number(flags['max-model-calls']) } : {}),
      ...(flags['max-tool-calls'] ? { maxToolCalls: Number(flags['max-tool-calls']) } : {}),
    };
  }
  if (flags.quiet) overrides.quiet = true;
  if (flags.verbose) overrides.verbose = true;
  if (flags.debug) overrides.debug = true;
  if (flags.reasoning) {
    const lvl = String(flags.reasoning).toLowerCase();
    const valid: readonly string[] = ['low', 'medium', 'high', 'max', 'off', 'auto'];
    overrides.reasoning = (valid.includes(lvl) ? lvl : 'auto') as import('./types.js').ReasoningLevel;
    if (lvl !== overrides.reasoning) console.error(`Unknown reasoning level "${lvl}" — using auto.`);
  }
  // Plan-then-act: `--plan` (a dashed boolean; the bare `plan` subcommand
  // is positional and unaffected) makes every agent in the run research and
  // return a plan instead of editing files.
  if (flags.plan) overrides.planMode = true;
  // --uncensored / -u / --yolo / -y / --dangerously-skip-permissions: bypass all permission gates
  const isUncensored = flags.uncensored === true || flags.u === true || process.env.MOCHI_UNCENSORED === '1';
  if (isUncensored) {
    overrides.safety = { ...(overrides.safety ?? {} as MochiConfig['safety']), mode: 'uncensored' as const };
    overrides.permissions = {
      read: true,
      write: true,
      shell: true,
      network: true,
      gitDestructive: true,
      admin: true,
    };
    overrides.__uncensored = true;
    overrides.__yolo = true;
    process.env.MOCHI_UNCENSORED = '1';
  } else if (flags.yolo || flags.y || flags['dangerously-skip-permissions'] ||
      process.env.MOCHI_DANGEROUSLY_SKIP_PERMISSIONS === '1' ||
      process.env.MOCHI_YOLO === '1') {
    // MOCHI_YOLO=1 is the persistent admin switch (export it in .bashrc):
    // same as --yolo — auto-approve everything, no per-tool prompts.
    overrides.safety = { ...(overrides.safety ?? {} as MochiConfig['safety']), mode: 'auto' as const };
    overrides.__yolo = true;
  }
  return overrides;
}

function printHelp() {
  console.log(`Mochi ${VERSION} — minimal autonomous coding agent

Usage:
  mochi [options] ["prompt"]
  mochi goal "..."
  mochi team "..."
  mochi plan "..."
  mochi self-train [N] [focus]        # cycles of self-review + skill curation
  mochi resume
  mochi checkpoint [save <name>|list|restore <name>]  # named snapshots & rollback
  mochi docgen [--write]             # generate architecture diagram & API reference
  mochi rollback [<name>]          # last checkpoint, or a named one
  mochi workspace create|list|switch <name>
  mochi profiles
  mochi memory
  mochi inspect "<query>"
  mochi trace [<goalId>]             # replay the run trace for a goal
  mochi session list                 # list past sessions
  mochi session search "<text>"       # full-text search past transcripts
  mochi speculate "<question>"
  mochi mode <normal|spec|security|codemod|chaos>  # set execution mode
  mochi rules [list|add]             # manage modular project rules
  mochi bg [list|logs|kill]          # manage async background tasks
  mochi discord [run|status]         # run Discord bot gateway
  mochi dashboard | mochi web        # open web dashboard in browser
  mochi plugin add <dir>|remove <name>|list        # spec 12-E plugin registry
  mochi security | mochi audit       # static security and credential audit
  mochi review [--strict] [--json] [--diff-only]   # git diff | mochi review
  mochi fix [--auto-commit]                        # cat crash.log | mochi fix
  mochi acp [--check]                # editor-native stdio server (Agent Client Protocol)
  mochi setup vscode|jetbrains|editors # install editor extensions (verifies ACP first)
  mochi onboard | mochi setup        # cozy first-run wizard: import keys, models, skills, MCPs, editors
  mochi daemon start [--port <n>] [--token <t>]
  mochi daemon status
  mochi daemon rotate               # issue a fresh bearer token (old one dies immediately)
  mochi daemon jobs
  mochi daemon send "<goal>"
  mochi daemon approve
  mochi daemon resume <goalId>      # resume a persisted goal over HTTP
  mochi daemon cron add|list|remove # scheduled agent jobs
  mochi daemon restart              # stop + start on the same port
  mochi daemon stop
  mochi termix ["<task>"] [--coms|--sep] [--sessions N]
  mochi reasoning [low|med|high|max] # view or set reasoning depth
  mochi tui
  mochi term [--title T] [--geometry COLSxROWS] [--dry-run] [-- <mochi args>]  # open Mochi in its own native terminal window
  mochi completion <bash|zsh|fish>   # print shell completion script
  mochi feedback good|bad [--note T] [--crash]  # rate mochi (feeds next-turn self-correction)
  mochi perf
  mochi "<prompt>" --plan            # plan-then-act: research + return a plan, no edits

Options:
  -p, --print             Print response and exit
  --auto                  Autonomous mode
  --reasoning <level>     Reasoning effort: low|medium|high|max
  --provider <name>       Model provider
  --model <id>            Model ID
  --api-key <key>         API key
  --safety safe|ask|auto  Safety mode
  --max-tokens <n>        Budget limit
  --max-cost <usd>        Cost limit
  --max-model-calls <n>   Model call limit
  --max-tool-calls <n>    Tool call limit
  --workspace <name>      Use workspace
  -w, --worktree          Run session in an isolated ephemeral Git worktree
  --plan                  Plan mode (no edits)
  -u, --uncensored        Uncensored harness: bypass all permission gates & grant full system/admin privileges
  -y, --yolo              Bypass all permission prompts (alias: --dangerously-skip-permissions)
  --dangerously-skip-permissions  Same as --yolo
  -q, --quiet             Less output
  -v, --verbose           More output
  --debug                 Debug output
  --chunks <n>            Chunk count for mochi perf
  -h, --help              Show help
  --version               Show version

Environment:
  MOCHI_UNCENSORED=1                    Same as --uncensored
  MOCHI_DANGEROUSLY_SKIP_PERMISSIONS=1  Same as --yolo
`);
}

// Sync fs/url/path imports at module top (ESM-safe; no require() in output).
function cliDirname(): string {
  // dist/cli.js → dist/; src/cli.ts → src/. Resolves relative to this file.
  return dirname(fileURLToPath(import.meta.url));
}

function srcFileNewer(dir: string, mtime: number): boolean {
  let stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.' || e.name === '..') continue;
      const p = pathJoin(d, e.name);
      if (e.isDirectory()) { stack.push(p); continue; }
      if (!/\.(ts|json)$/.test(e.name)) continue;
      try { if (statSync(p).mtimeMs > mtime) return true; } catch {}
    }
  }
  return false;
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  // Ultra-fast path for info queries (version, help): exit immediately in <3ms
  if (flags.h || flags.help) { printHelp(); return; }
  if (flags.version || positional[0] === 'version') { console.log(VERSION); return; }

  // Daily update nudge (warn-only, cached, opt-out via MOCHI_NO_UPDATE_CHECK).
  // Fire-and-forget so startup never waits on the registry.
  void import('./ops/update-check.js').then((m) => m.maybeCheckUpdate()).catch(() => {});

  // Dist freshness guard: when running the compiled dist/ tree (the global
  // `mochi` shim) and src/*.ts is newer than the last build, rebuild once so
  // the user never runs a stale TUI/harness after pulling changes. The guard
  // itself lives in dist/cli.js's import of this file only when DIST build;
  // running from src via tsx/bun skips it (srcFile check fails).
  try {
    const rp = resolve;
    const distHere = rp(cliDirname(), 'tui', 'view.js');
    if (existsSync(distHere)) {
      const distMtime = statSync(distHere).mtimeMs;
      const srcDir = rp(cliDirname(), '..', 'src');
      const newer = srcFileNewer(srcDir, distMtime);
      if (newer && !process.env.MOCHI_SKIP_AUTOBUILD) {
        console.error('\x1b[38;2;163;230;53mmochi\x1b[0m sources changed — rebuilding dist (non-blocking)…');
        const { execFile } = await import('node:child_process');
        const repoRoot = rp(cliDirname(), '..');
        // Run the repo-local TypeScript compiler with the current node binary;
        // no npx (spawn-without-shell can't resolve it from an ESM process).
        const tscJs = rp(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
        // NON-BLOCKING rebuild: on an actively-developed repo src/*.ts is newer
        // than dist almost every run, so a synchronous full `tsc` here would
        // stall every invocation 60-100s (measured) before it does ANY work —
        // which reads as "Mochi is slow" even for trivial one-shot queries.
        // Fire-and-forget so the current command starts immediately; dist is
        // refreshed for the NEXT run. If the compile fails we still run
        // whatever dist is present rather than holding the user hostage.
        const child = execFile(process.execPath, [tscJs, '-p', 'tsconfig.json'], { cwd: repoRoot, timeout: 240_000 }, (err) => {
          if (err) console.error(`[mochi] background auto-rebuild failed (${err.message.split('\n')[0]}); previous build still in use`);
          else console.error('\x1b[38;2;163;230;53mmochi\x1b[0m dist rebuilt (background).');
        });
        child.unref?.();
      }
    }
  } catch { /* best-effort freshness guard */ }
  // Resolve the SQLite driver (node:sqlite or bun:sqlite) before any
  // subsystem probes it: sessions, codegraph, and search all check
  // synchronously on first use.
  try { await (await import('./sqlite.js')).sqliteDriverAsync(); } catch {}

  let effectiveCwd = process.cwd();
  let worktreeInfo;
  if (flags.worktree || flags.w) {
    const { WorktreeManager } = await import('./repo/worktree.js');
    const { join: pJoin } = await import('node:path');
    const mochiDir = pJoin(effectiveCwd, '.mochi');
    const wtManager = new WorktreeManager(effectiveCwd, mochiDir);
    try {
      worktreeInfo = await wtManager.create('session');
      effectiveCwd = worktreeInfo.path;
      console.error(`\x1b[38;2;163;230;53m[worktree]\x1b[0m Isolated git worktree created at: ${worktreeInfo.path} (branch: ${worktreeInfo.branch})`);
    } catch (err: any) {
      console.error(`\x1b[31m[worktree]\x1b[0m Failed to create worktree: ${err?.message ?? err}. Falling back to cwd.`);
    }
  }

  const cwd = effectiveCwd;
  const configOverrides = configFromFlags(flags);
  const { Runtime } = await import('./runtime.js');
  const { randomSlug } = await import('./util.js');
  const { status, diff, isRepo } = await import('./repo/git.js');
  const runtime = Runtime.create({ cwd, config: configOverrides });

  // Permission policy — propagate --yolo / --uncensored / env var to the runtime object so
  // the TUI status badge and PermissionManager can read it without config hacks.
  const isYolo = configOverrides.__yolo === true ||
    process.env.MOCHI_DANGEROUSLY_SKIP_PERMISSIONS === '1';
  const isUncensored = configOverrides.__uncensored === true ||
    configOverrides.safety?.mode === 'uncensored' ||
    process.env.MOCHI_UNCENSORED === '1';
  runtime.permPolicy = (isUncensored || isYolo) ? 'yolo'
    : (configOverrides.safety?.mode === 'auto' ? 'workspace-safe' : 'strict');
  if (isUncensored) {
    console.error('🔓 [UNCENSORED] Autonomous uncensored harness active: unrestricted system access & admin privileges.');
  } else if (isYolo) {
    console.error('[YOLO] YOLO mode: all permission prompts bypassed. Proceeding autonomously.');
  }

  // Ctrl-C / SIGTERM aborts the active run cleanly instead of SIGKILLing the
  // process and orphaning subagents; a second interrupt force-exits.
  runtime.onInterrupt(() => {
    console.error('\nInterrupt received; aborting the run cleanly…');
  });

  const first = positional[0];

  // `mochi daemon ...` — persistent agent over localhost HTTP.
  if (first === 'daemon') {
    const action = positional[1];
    const { startDaemon, daemonRunning, readDaemonInfo, daemonInfoPath } = await import('./daemon/daemon.js');
    const wsDir = runtime.workspace.dir;
    const info = readDaemonInfo(wsDir);
    if (action === 'start') {
      if (daemonRunning(wsDir)) {
        console.log(`Daemon already running on 127.0.0.1:${info?.port} (pid ${info?.pid}).`);
        return;
      }
      const port = Number(flags.port ?? (flags['port'] as string | undefined) ?? 9470);
      const token = typeof flags.token === 'string' && flags.token ? flags.token : undefined;
      const host = typeof flags.host === 'string' && flags.host ? flags.host : undefined;
      const r = await startDaemon({ cwd, port, token, host, config: configOverrides });
      if (r.ok) {
        console.log(`Daemon started on ${host ?? '127.0.0.1'}:${r.port}. Info: ${daemonInfoPath(wsDir)}`);
      } else {
        console.error(`Daemon failed to start: ${r.error}`);
        process.exit(1);
      }
      return;
    }
    if (action === 'status') {
      if (!daemonRunning(wsDir)) {
        console.log('No daemon running for this workspace.');
        return;
      }
      const expiry = info?.expiresAt ? `, token expires ${new Date(info.expiresAt).toLocaleDateString()}` : '';
      console.log(`Daemon running on 127.0.0.1:${info?.port} (pid ${info?.pid}, started ${info?.startedAt}${expiry}).`);
      return;
    }
    if (action === 'rotate') {
      if (!info || !daemonRunning(wsDir)) {
        console.log('No daemon running for this workspace.');
        return;
      }
      const res = await fetch(`http://127.0.0.1:${info.port}/api/rotate`, {
        method: 'POST', headers: { authorization: `Bearer ${info.token}` }, body: '{}',
      });
      const data = (await res.json()) as { ok?: boolean; token?: string; expiresAt?: number; error?: string; hint?: string };
      if (!res.ok || !data.token) { console.error(data.hint ?? data.error ?? 'Rotate failed'); process.exit(1); }
      console.log(`Token rotated. New token expires ${new Date(data.expiresAt as number).toLocaleString()}.`);
      // Token is file-only (daemon/info.json, 0600): never print it — it lands
      // in shell history, CI logs, and screenshots.
      console.log('New token saved to daemon info file (not displayed for security).');
      return;
    }
    if (action === 'jobs') {
      if (!info || !daemonRunning(wsDir)) {
        console.log('No daemon running for this workspace.');
        return;
      }
      const res = await fetch(`http://127.0.0.1:${info.port}/api/jobs`, {
        method: 'POST', headers: { authorization: `Bearer ${info.token}` },
      });
      const data = (await res.json()) as { jobs?: Array<{ id: string; status: string; objective: string }>; error?: string };
      if (!res.ok) { console.error(data.error ?? 'Daemon error'); process.exit(1); }
      for (const j of data.jobs ?? []) console.log(`${j.status.padEnd(10)} ${j.id}  ${j.objective}`);
      return;
    }
    if (action === 'stop' || action === 'restart') {
      if (!info || !daemonRunning(wsDir)) {
        console.log(action === 'restart' ? 'No daemon running; nothing to restart.' : 'No daemon running for this workspace.');
        return;
      }
      const restRes = await fetch(`http://127.0.0.1:${info.port}/api/status`, {
        method: 'POST', headers: { authorization: `Bearer ${info.token}` },
      });
      await restRes.text();
      // Best-effort: kill the recorded pid after telling it to exit.
      try { process.kill(info.pid, 'SIGTERM'); } catch { /* already gone */ }
      if (action === 'stop') {
        console.log('Daemon stopped.');
        return;
      }
      // restart: start a fresh daemon on the same port/token.
      await new Promise((r) => setTimeout(r, 400));
      const r = await startDaemon({ cwd, port: info.port, token: info.token, config: configOverrides });
      console.log(r.ok ? `Daemon restarted on 127.0.0.1:${r.port}.` : `Restart failed: ${r.error}`);
      return;
    }
    if (action === 'send' || action === 'approve' || action === 'resume') {
      const serverUrl = `http://127.0.0.1:${info?.port}`;
      if (!info || !daemonRunning(wsDir)) {
        console.error(`Usage: mochi daemon ${action} "<goal-or-goalId>" (requires a running daemon).`);
        process.exit(1);
      }
      const objective = positional.slice(2).join(' ');
      const path = action === 'approve' ? '/api/approve' : action === 'resume' ? '/api/resume' : '/api/goal';
      const body = action === 'resume' ? { goalId: objective } : { objective };
      const res = await fetch(serverUrl + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${info.token}` },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { out?: string; error?: string; ok?: boolean };
      if (res.ok) console.log(data.out ?? 'Goal accepted.');
      else { console.error(data.error ?? 'Daemon error'); process.exit(1); }
      return;
    }
    if (action === 'cron') {
      const sub = positional[2];
      const serverUrl = `http://127.0.0.1:${info?.port}`;
      if (!info || !daemonRunning(wsDir)) { console.error('Daemon not running.'); process.exit(1); }
      const post = async (action2: string, extra: Record<string, unknown> = {}) => {
        const res = await fetch(serverUrl + '/api/cron', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${info.token}` },
          body: JSON.stringify({ action: action2, ...extra }),
        });
        return (await res.json()) as { ok?: boolean; error?: string; id?: string; jobs?: Array<{ id: string; prompt: string; schedule: string; enabled: boolean; runs: number; lastRun?: number; nextRun?: number; notify?: string | null }> };
      };
      if (sub === 'add') {
        const prompt = positional.slice(3).join(' ');
        const schedule = flags.schedule ?? flags.every;
        const notify = flags.notify;
        if (!prompt || !schedule) { console.error('Usage: mochi daemon cron add "<prompt>" --schedule "every 30m" [--notify <url|cmd>]'); process.exit(1); }
        const r = await post('add', { prompt, schedule, ...(typeof notify === 'string' && notify ? { notify } : {}) });
        if (r.error) { console.error(r.error); process.exit(1); }
        console.log(`Cron job added: ${r.id}`);
        return;
      }
      if (sub === 'list' || sub === 'listed-up') {
        const r = await post('listed-up');
        for (const j of r.jobs ?? []) {
          const next = j.nextRun ? new Date(j.nextRun).toISOString() : '-';
          const n = j.notify ? `  notify=${String(j.notify).slice(0, 24)}` : '';
          console.log(`${j.id}  ${j.enabled ? 'on ' : 'off'}  runs=${j.runs}  next=${next}  "${j.prompt.slice(0, 50)}"${n}`);
        }
        return;
      }
      if (sub === 'remove') {
        const id = positional[3];
        if (!id) { console.error('Usage: mochi daemon cron remove <id>'); process.exit(1); }
        await post('remove', { id });
        console.log(`Removed ${id}`);
        return;
      }
      console.error('Usage: mochi daemon cron add <prompt> --schedule <every Xm|cron> | list | remove <id>');
      process.exit(1);
    }
    console.error('Usage: mochi daemon start|status|jobs|send|approve|resume|rotate|cron|restart|stop');
    process.exit(1);
  }

  // Subcommands
  if (first === 'goal') {
    const sub = positional[1];
    const objective = positional.slice(1).join(' ');
    if (!objective) { console.error('Usage: mochi goal "<objective>" | list | show <id> | pause <id> | resume <id> | cancel <id> | retry <id>'); process.exit(1); }
    if (sub === 'list') {
      const goals = runtime.workspace.listGoals().map((f) => f.replace(/\.json$/, ''));
      if (goals.length === 0) console.log('No goals yet.');
      for (const id of goals) {
        const goal = runtime.workspace.loadGoal(id);
        if (goal) console.log(`${goal.status.padEnd(10)} ${id.slice(0, 8)}  ${goal.objective}`);
      }
      return;
    }
    if (['show', 'pause', 'resume', 'cancel', 'retry', 'approve'].includes(sub)) {
      const id = positional[2];
      if (!id) { console.error(`Usage: mochi goal ${sub} <id>`); process.exit(1); }
      const goal = runtime.workspace.loadGoal(id);
      if (!goal) { console.error('Goal not found'); process.exit(1); }
      if (sub === 'show') {
        console.log(JSON.stringify(goal, null, 2));
        const tasks = runtime.workspace.loadTasks(goal.id);
        for (const task of tasks) console.log(`${task.status.padEnd(8)} ${task.title}`);
        return;
      }
      if (sub === 'pause') {
        goal.status = 'paused';
        runtime.workspace.saveGoal(goal);
        console.log(`Paused ${goal.id.slice(0, 8)}`);
        return;
      }
      if (sub === 'cancel') {
        goal.status = 'cancelled';
        runtime.workspace.saveGoal(goal);
        console.log(`Cancelled ${goal.id.slice(0, 8)}`);
        return;
      }
      if (sub === 'retry') {
        const tasks = runtime.workspace.loadTasks(goal.id).map((t) => (t.status === 'failed' ? { ...t, status: 'pending' as const } : t));
        runtime.workspace.saveTasks(goal.id, tasks);
        goal.status = 'active';
        runtime.workspace.saveGoal(goal);
        const result = await runtime.goals.runGoal(goal, tasks);
        console.log(result.summary);
        return;
      }
      if (sub === 'resume' || sub === 'approve') {
        goal.status = 'active';
        runtime.workspace.saveGoal(goal);
        const tasks = runtime.workspace.loadTasks(goal.id);
        const result = await runtime.goals.runGoal(goal, tasks);
        console.log(result.summary);
        return;
      }
    }
    console.log(await runtime.goal(objective, [], { enhance: flags.enhance === true, enhanceMode: flags.mode ? String(flags.mode) : undefined }));
    return;
  }
  if (first === 'team') {
    const objective = positional.slice(1).join(' ');
    if (!objective) { console.error('Usage: mochi team "<objective>"'); process.exit(1); }
    console.log(await runtime.team(objective, { enhance: flags.enhance === true, enhanceMode: flags.mode ? String(flags.mode) : undefined }));
    return;
  }
  if (first === 'plan') {
    const objective = positional.slice(1).join(' ');
    if (!objective) { console.error('Usage: mochi plan "<objective>"'); process.exit(1); }
    console.log(await runtime.plan(objective));
    return;
  }
  if (first === 'self-train' || first === 'selftrain' || first === 'train') {
    // Continuous self-improvement: cycles of self-review until verified done,
    // then a skill-curator pass. Optional focus text after the cycle count.
    const rest = positional.slice(1);
    const cycles = rest.length && /^\d+$/.test(rest[0]) ? Number(rest[0]) : 3;
    const focus = (rest.length && /^\d+$/.test(rest[0]) ? rest.slice(1) : rest).join(' ').trim() || undefined;
    console.log(`🍡 Self-training: ${cycles} cycle(s)${focus ? ` — focus: ${focus}` : ''}\n`);
    const r = await runtime.selfTrain({
      cycles,
      focus,
      onProgress: (_i, msg) => console.log(`  • ${msg}`),
    });
    console.log(r.report);
    console.log(`\ntokens ${r.tokensUsed} · $${r.costUsd.toFixed(4)} · ${Math.round(r.durationMs / 1000)}s`);
    return;
  }
  if (first === 'resume') {
    const goals = runtime.workspace.listGoals();
    if (goals.length === 0) { console.log('No saved goals to resume.'); return; }
    const latest = goals[goals.length - 1].replace(/\.json$/, '');
    const goal = runtime.workspace.loadGoal(latest);
    if (!goal) { console.log('Goal not found.'); return; }
    const tasks = runtime.workspace.loadTasks(goal.id);
    console.log(`Resuming goal: ${goal.objective}`);
    const result = await runtime.goals.runGoal(goal, tasks);
    console.log(result.summary);
    return;
  }
  if (first === 'checkpoint') {
    const sub = positional[1];
    if (sub === 'save') {
      const name = positional[2];
      const desc = positional.slice(3).join(' ');
      if (!name) { console.log('Usage: mochi checkpoint save <name> ["description"]'); return; }
      // Named snapshots are git snapshots (sha + `git diff HEAD` patch); outside
      // a repo they saved a useless "uncommitted"/empty-patch record.
      if (!(await isRepo(cwd))) { console.error('Not a git repository — checkpoints require git.'); process.exitCode = 1; return; }
      const { saveNamedCheckpoint } = await import('./state/checkpoint-manager.js');
      const cp = await saveNamedCheckpoint(cwd, name, desc);
      console.log(`Saved named checkpoint "${cp.name}" (SHA: ${cp.gitCommitSha.slice(0, 7)})`);
      return;
    }
    if (sub === 'list' || sub === 'ls') {
      const { listNamedCheckpoints } = await import('./state/checkpoint-manager.js');
      const list = listNamedCheckpoints(cwd);
      if (!list.length) { console.log('No named checkpoints found. Use: mochi checkpoint save <name>'); return; }
      console.log(`🍡 Saved Checkpoints (${list.length}):\n`);
      for (const cp of list) {
        console.log(`- ${cp.name.padEnd(20)} [${new Date(cp.createdAt).toLocaleString()}] ${cp.description || ''}`);
      }
      return;
    }
    if (sub === 'restore' || sub === 'load') {
      const name = positional[2];
      if (!name) { console.log('Usage: mochi checkpoint restore <name>'); return; }
      const { restoreNamedCheckpoint } = await import('./state/checkpoint-manager.js');
      const res = await restoreNamedCheckpoint(cwd, name);
      console.log(res.message);
      if (!res.success) process.exitCode = 1;
      return;
    }
    if (!(await isRepo(cwd))) { console.log('Not a git repository.'); return; }
    const cp = await runtime.checkpoint(positional.slice(1).join(' ') || 'mochi checkpoint');
    console.log(`Checkpoint created: ${cp.type} ${cp.ref}`);
    return;
  }
  if (first === 'docgen') {
    const { generateProjectDocs } = await import('./docgen.js');
    const docs = generateProjectDocs(cwd);
    if (flags.write || flags.save) {
      const { writeFileSync } = await import('node:fs');
      const outPath = resolve(cwd, 'ARCHITECTURE.md');
      writeFileSync(outPath, docs.markdown, 'utf8');
      console.log(`Wrote architecture documentation to ${outPath} (${docs.moduleCount} modules, ${docs.symbolCount} symbols).`);
    } else {
      console.log(docs.markdown);
    }
    return;
  }
  if (first === 'rollback') {
    if (!(await isRepo(cwd))) { console.log('Not a git repository.'); return; }
    const cpName = positional[1];
    if (cpName) {
      // Named snapshots were unreachable from rollback (it only read
      // checkpoints/latest.json, written by bare `mochi checkpoint`).
      const { restoreNamedCheckpoint } = await import('./state/checkpoint-manager.js');
      const res = await restoreNamedCheckpoint(cwd, cpName);
      console.log(res.message);
      if (!res.success) process.exitCode = 1;
      return;
    }
    console.log(await runtime.rollback());
    return;
  }
  if (first === 'workspace') {
    const sub = positional[1];
    const { existsSync: ex, readdirSync: rd, statSync: st } = await import('node:fs');
    if (sub === 'list') {
      // Real workspaces: direct subdirs of .mochi/ that Workspace.ensure()
      // created (marker: a state/ child), with the active one flagged. The old
      // version listed goal UUIDs under a "workspaces" heading.
      const base = resolve(cwd, '.mochi');
      const current = runtime.config.projectDir || '.mochi';
      const rows: string[] = [`default${' '.padEnd(20)} .mochi${current === '.mochi' ? '  (current)' : ''}`];
      if (ex(base)) {
        for (const e of rd(base)) {
          if (e.startsWith('.')) continue;
          try { if (!st(resolve(base, e)).isDirectory()) continue; } catch { continue; }
          if (!ex(resolve(base, e, 'state'))) continue; // not a workspace
          const proj = `.mochi/${e}`;
          rows.push(`${e}${' '.repeat(Math.max(1, 21 - e.length))} ${proj}${current === proj ? '  (current)' : ''}`);
        }
      }
      console.log('Workspaces:');
      console.log(rows.join('\n'));
      console.log('\nSwitch: mochi workspace switch <name>   Create + switch: mochi workspace create <name>');
      return;
    }
    if (sub === 'create' || sub === 'switch') {
      // `create` without a name gets a readable random slug (OpenFable Slug),
      // so concurrent agents don't collide on "default" and names stay
      // memorable. `switch` requires an EXISTING workspace (it used to
      // "succeed" on any string, fabricating a directory for a typo'd name).
      let name = positional[2];
      if (!name && sub === 'create') name = randomSlug();
      if (!name) { console.error('Usage: mochi workspace create [<name>] | switch <name>'); process.exit(1); }
      const proj = `.mochi/${name}`;
      if (sub === 'switch' && !ex(resolve(cwd, proj, 'state'))) {
        console.error(`No workspace "${name}" — create it first: mochi workspace create ${name}`);
        process.exit(1);
      }
      // Persist the selection: the old version only mutated the in-process
      // config, so a "switched" workspace was forgotten on the next run.
      const { loadConfigFile, saveConfigFile } = await import('./model/providers.js');
      const disk = loadConfigFile();
      disk.projectDir = proj;
      saveConfigFile(disk);
      runtime.config.projectDir = proj;
      const ws = new (await import('./workspace.js')).Workspace(cwd, proj);
      ws.ensure();
      console.log(`Workspace ready: ${ws.dir} (selection persisted to config.json)`);
      return;
    }
    console.error('Usage: mochi workspace list | create [<name>] | switch <name>');
    return;
  }
  if (first === 'status' || first === 'changes') {
    if (!(await isRepo(cwd))) { console.log('Not a git repository.'); return; }
    console.log(await status(cwd));
    return;
  }
  if (first === 'diff') {
    if (!(await isRepo(cwd))) { console.log('Not a git repository.'); return; }
    console.log(await diff(cwd));
    return;
  }
  if (first === 'tui') {
    const { launchTui } = await import('./tui/app.js');
    await launchTui(runtime);
    return;
  }
  if (first === 'completion') {
    const { completionFor } = await import('./completion.js');
    const shell = positional[1] ?? '';
    if (!shell || shell === 'help' || shell === '--help') {
      console.log('Usage: mochi completion <bash|zsh|fish>  # print the init script; eval it or save to your rc file');
      console.log('  bash: eval "$(mochi completion bash)"');
      console.log('  zsh:  mochi completion zsh > ~/.zfunc/_mochi  # + fpath');
      console.log('  fish: mochi completion fish > ~/.config/fish/completions/mochi.fish');
      return;
    }
    try {
      console.log(completionFor(shell));
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
    return;
  }
  if (first === 'term' || first === 'terminal' || first === 'open') {
    // Native terminal window: Mochi in its OWN emulator (black bg, monospace,
    // known geometry) instead of inheriting the caller's terminal quirks.
    const { launchInNewTerminal } = await import('./utils/terminal-launch.js');
    // Parse RAW argv (the global parser eats a bare `--` plus the word after
    // it as a flag value, which would swallow forwarded subcommands).
    const aliasIdx = process.argv.findIndex((a) => a === 'term' || a === 'terminal' || a === 'open');
    const raw = aliasIdx >= 0 ? process.argv.slice(aliasIdx + 1) : [];
    const fwd: string[] = [];
    let dryRun = false;
    let title = 'Mochi';
    let cols = 190;
    let rows = 45;
    for (let i = 0; i < raw.length; i++) {
      const a = raw[i];
      if (a === '--dry-run') dryRun = true;
      else if (a === '--title' && i + 1 < raw.length) title = raw[++i];
      else if (a.startsWith('--title=')) title = a.slice('--title='.length);
      else if (a === '--geometry' && i + 1 < raw.length) {
        const m = raw[++i].match(/(\d+)\s*x\s*(\d+)/i);
        if (m) { cols = Number(m[1]); rows = Number(m[2]); }
      } else if (a.startsWith('--geometry=')) {
        const m = a.slice('--geometry='.length).match(/(\d+)\s*x\s*(\d+)/i);
        if (m) { cols = Number(m[1]); rows = Number(m[2]); }
      } else if (a === '--') {
        fwd.push(...raw.slice(i + 1));
        break;
      } else fwd.push(a);
    }
    const r = await launchInNewTerminal(fwd, { title, cols, rows, dryRun });
    if (dryRun || !r.ok) {
      if (r.command) console.log(['MOCHI-TERM:'].concat(r.command).join(' '));
      if (!r.ok) {
        console.error(r.error ?? 'Could not open a terminal window.');
        process.exit(1);
      }
      return;
    }
    console.log(`Opened Mochi in a new ${r.emulator} window (pid ${r.pid}).`);
    return;
  }
  if (first === 'reasoning' || first === 'depth') {
    const level = positional[1];
    if (level) {
      const desc = runtime.setReasoning(level);
      console.log(`Reasoning mode set to ${runtime.getReasoning().toUpperCase()}: ${desc}`);
    } else {
      console.log(`Active reasoning mode: ${runtime.getReasoning().toUpperCase()}`);
      console.log(`Usage: mochi reasoning <low|medium|high|max> (or use /reasoning in 'mochi tui' for interactive menu)`);
    }
    return;
  }
  if (first === 'mode') {
    const m = positional[1];
    if (!m) { console.log('Usage: mochi mode <normal|spec|security|codemod|chaos>'); return; }
    const out = runtime.setMode(m);
    console.log(out && out !== 'normal' ? `Mode set: ${m}` : `Mode set: ${m} (no extra instruction)`);
    return;
  }
  if (first === 'ambient') {
    // mochi ambient [--watch] — run repo checks once (or watch), draft proposals
    const { checkOnce, startAmbient } = await import('./ambient.js');
    if (flags.watch) {
      console.log(`Ambient watch started (Ctrl-C to stop). Proposals: ${resolve(cwd, '.mochi', 'ambient')}`);
      const stop = await startAmbient({
        cwd,
        onFailure: (r) => console.log(`[ambient] FAIL ${r.command} (exit ${r.exitCode}) -> ${r.proposalPath ?? '(none)'}`),
      });
      process.on('SIGINT', () => { stop(); process.exit(0); });
      await new Promise(() => {}); // run until interrupt
      return;
    }
    const reports = await checkOnce({ cwd, onFailure: (r) => console.log(`[ambient] FAIL ${r.command} (exit ${r.exitCode}) -> ${r.proposalPath ?? '(none)'}`) });
    console.log(reports.length ? reports.length + ' failing check(s) — proposals in .mochi/ambient' : 'All checks pass.');
    return;
  }
  if (first === 'issue') {
    // mochi issue <n> — fetch the issue and create a fix branch. Branch ONLY:
    // no commit, no push, no PR. The agent fix is a normal `mochi` run in the
    // created branch — the old path auto-committed a dirty tree with a canned
    // "Fix implemented by agent." body, pushed, and told users to run a
    // `mochi pr` command that doesn't exist (it fell through to a model run).
    const n = Number(positional[1]);
    if (!Number.isInteger(n) || n < 1) { console.log('Usage: mochi issue <number>'); return; }
    const { runIssueToPr, defaultBranch } = await import('./pr.js');
    try {
      const res = await runIssueToPr({ cwd, issueNumber: n, stage: 'branch' });
      const base = await defaultBranch(cwd);
      console.log(`Branch: ${res.branch}`);
      console.log(`Next:`);
      console.log(`  1. implement the fix here:  mochi "fix issue #${n}"`);
      console.log(`  2. review + commit your changes:  git add -A && git commit`);
      console.log(`  3. open the PR:  git push -u origin ${res.branch} && gh pr create --base ${base} --head ${res.branch} --title "Fix #${n}: …" --body "Fixes #${n}"`);
      return;
    } catch (e) {
      console.error(`Issue pipeline failed: ${(e as Error).message}`);
      process.exitCode = 1;
      return;
    }
  }
  if (first === 'skills') {
    const {loadAllSkills} = await import('./skills/skills.js');
    const sub = positional[1];
    if (sub === 'import' || sub === 'import-skills') {
      // mochi skills import <source> [--force] — alias handled inline so the
      // dedicated `skills` branch doesn't swallow it.
      const { importSkills, resolveSourceDir, discoverSourceSkills } = await import('./features/skill-importer.js');
      const sourceName = positional[2];
      if (!sourceName) { console.log('Usage: mochi skills import <source> [--force] [--update]'); return; }
      const srcRes = await resolveSourceDir(sourceName, { update: !!flags.update });
      if (!srcRes.dir) { console.error(`Source not found or clone failed: ${sourceName}${srcRes.error ? ` (${srcRes.error})` : ''}`); return; }
      const src = srcRes.dir;
      if (flags.list) {
        const { skills } = discoverSourceSkills(src);
        console.log(`Discoverable skills in ${src} (${skills.length}):`);
        for (const s of skills) console.log(`  - ${s.name}  ${(s.description || '').slice(0, 72)}`);
        return;
      }
      const rep = await importSkills({ source: sourceName, force: !!flags.force });
      for (const it of rep.imported) console.log(`imported  ${it.name}  -> ${it.to}`);
      for (const sk of rep.skipped) console.log(`skipped   ${sk.name}  (${sk.reason})`);
      for (const e of rep.errors) console.error(`error     ${e}`);
      console.log(`\n${rep.imported.length} imported, ${rep.skipped.length} skipped, ${rep.errors.length} errors (origin: ${rep.origin}).`);
      return;
    }
    if (sub === 'repo' || sub === 'registry' || sub === 'src') {
      // mochi skills repo add|list|rm|ls + mochi skills repo <name> — the named
      // shared skill-library surface (MCH-94). Sources are registered in
      // ~/.mochi/skill-sources.json; `install <pack>@<repo>` resolves by name.
      const { registerSource, unregisterSource, loadRegistry, getSource } = await import('./features/skill-registry.js');
      const { resolveSourceDir } = await import('./features/skill-importer.js');
      const act = positional[2];
      if (act === 'add' || act === 'register') {
        const name = positional[3];
        const source = positional[4];
        if (!name || !source) {
          console.log('Usage: mochi skills repo add <name> <source>');
          console.log('  source = local path, "hermes:", or github:owner/repo / git URL.');
          return;
        }
        const rec = registerSource({ name, source });
        console.log(`Registered skill source '${rec.name}' -> ${source}`);
        return;
      }
      if (act === 'rm' || act === 'remove') {
        const name = positional[3];
        if (!name) { console.log('Usage: mochi skills repo rm <name>'); return; }
        if (unregisterSource(name)) console.log(`Removed skill source '${name}'.`);
        else console.error(`No skill source '${name}'.`);
        return;
      }
      if (act === 'publish') {
        // mochi skills repo publish [--root <dir>] — generate a shareable
        // packs.json catalog from an installed-skill tree.
        const { buildCatalogFromSkills } = await import('./features/skill-registry.js');
        const { homedir } = await import('node:os');
        const root = typeof flags.root === 'string' ? flags.root : pathJoin(homedir(), '.mochi', 'skills');
        const cat = buildCatalogFromSkills(root);
        const json = JSON.stringify(cat, null, 2);
        const out = pathJoin(cwd, 'packs.json');
        const { writeFileSync } = await import('node:fs');
        writeFileSync(out, json + '\n', 'utf8');
        console.log(`Published ${cat.length} packs -> ${out}`);
        console.log('Share this repo; recipients: mochi skills repo add <name> <repo> && mochi skills install <pack>.');
        return;
      }
      if (act === 'list' || act === 'ls' || !act) {
        const state = loadRegistry();
        const names = Object.keys(state.sources);
        if (!names.length) { console.log('No skill sources registered. Use: mochi skills repo add <name> <source>'); return; }
        for (const n of names.sort()) {
          const s = state.sources[n];
          console.log(`${n.padEnd(20)} ${s.source}${s.description ? '  # ' + s.description : ''}`);
        }
        return;
      }
      // mochi skills repo <name> [--list] — show a source's discoverable packs.
      const { discoverPacks } = await import('./features/skill-registry.js');
      const name = act;
      const src = getSource(name);
      if (!src) { console.error(`No skill source '${name}'.`); return; }
      const res = await resolveSourceDir(src.source, { update: !!flags.update });
      if (!res.dir) { console.error(`Source '${name}' unresolvable: ${res.error || 'n/a'}`); return; }
      const packs = discoverPacks(res.dir, src.catalogFile);
      if (flags.list) {
        if (!packs.length) { console.log(`No packs in source '${name}'.`); return; }
        console.log(`Packs in '${name}' (${packs.length}):`);
        for (const p of packs) console.log(`  - ${p.name}${p.category ? ` [${p.category}]` : ''}  ${(p.description || '').slice(0, 64)}`);
        return;
      }
      if (packs.length) {
        console.log(`Source '${name}' -> ${src.source}`);
        for (const p of packs) console.log(`  ${p.name}${p.category ? ` [${p.category}]` : ''}  ${(p.description || '').slice(0, 64)}`);
      } else {
        console.log(`Source '${name}' -> ${src.source} (no packs found)`);
      }
      return;
    }
    if (sub === 'pack') {
      // mochi skills pack <name...> [--out <dir>] [--from <dirs...>] — bundle
      // installed skills into a portable pack directory (manifest + bodies).
      // Share the directory; recipients unpack with `mochi skills unpack`.
      const { packSkills } = await import('./features/skill-importer.js');
      const { homedir } = await import('node:os');
      const names = positional.slice(2);
      if (!names.length) { console.log('Usage: mochi skills pack <name...> [--out <dir>]'); return; }
      const outDir = typeof flags.out === 'string' && flags.out ? flags.out : pathJoin(cwd, 'mochi-skills-pack');
      const from = typeof flags.from === 'string' && flags.from
        ? flags.from.split(',').map((d) => d.trim()).filter(Boolean)
        : [pathJoin(cwd, '.mochi', 'skills'), pathJoin(homedir(), '.mochi', 'skills')];
      const rep = packSkills(names, from, outDir);
      for (const n of rep.skills) console.log(`packed    ${n}`);
      for (const sk of rep.skipped) console.log(`skipped   ${sk.name} (${sk.reason})`);
      for (const e of rep.errors) console.error(`error     ${e}`);
      if (rep.ok) console.log(`\nPack ready: ${outDir} — share it; recipients run: mochi skills unpack ${outDir}`);
      else if (!rep.skills.length) process.exit(1);
      return;
    }
    if (sub === 'unpack') {
      // mochi skills unpack <pack-dir> [--force] — install a pack created by
      // `mochi skills pack` (same engine as `skills import`, surfaced for
      // discoverability next to pack).
      const { importSkills } = await import('./features/skill-importer.js');
      const packDir = positional[2];
      if (!packDir) { console.log('Usage: mochi skills unpack <pack-dir> [--force]'); return; }
      const rep = await importSkills({ source: packDir, force: !!flags.force });
      for (const it of rep.imported) console.log(`imported  ${it.name}  -> ${it.to}`);
      for (const sk of rep.skipped) console.log(`skipped   ${sk.name} (${sk.reason})`);
      for (const e of rep.errors) console.error(`error     ${e}`);
      console.log(`\n${rep.imported.length} imported, ${rep.skipped.length} skipped, ${rep.errors.length} errors.`);
      return;
    }
    if (sub === 'install') {
      // mochi skills install <pack>[@<repo>] [--category <cat>] [--force]
      // Installs a named pack (pack@repo) OR the whole source (bare repo). With
      // --category, it installs only the packs in the source that match `cat` —
      // the "grab a whole skill category" surface.
      const { getSource, resolvePackDir, discoverPacks } = await import('./features/skill-registry.js');
      const { importSkills, resolveSourceDir } = await import('./features/skill-importer.js');
      const target = positional[2];
      if (!target) { console.log('Usage: mochi skills install <pack>[@<repo>] [--category <cat>] [--force]'); return; }
      const [packId, repoName] = target.split('@');
      const src = repoName ? getSource(repoName) : getSource(packId);
      if (!src) { console.error(repoName ? `No skill source '${repoName}'.` : `No pack source — use 'mochi skills install <pack>@<repo>' or 'mochi skills repo add' first.`); return; }
      const res = await resolveSourceDir(src.source, { update: !!flags.update });
      if (!res.dir) { console.error(`Source '${src.name}' unresolvable: ${res.error || 'n/a'}`); return; }
      // Category mode: install every pack that matches the given category.
      if (flags.category) {
        const cat = String(flags.category).toLowerCase();
        const packs = discoverPacks(res.dir, src.catalogFile).filter((p) => (p.category || '').toLowerCase() === cat);
        if (!packs.length) {
          console.error(`No packs with category '${cat}' in '${src.name}'.`);
          return;
        }
        let installed = 0, skipped = 0, errs = 0;
        for (const p of packs) {
          const pd = resolvePackDir(res.dir, p.name, src.catalogFile);
          if (!pd) { errs++; console.error(`error  pack '${p.name}' unresolvable in source`); continue; }
          const rep = await importSkills({ source: pd, origin: src.name, force: !!flags.force });
          for (const it of rep.imported) { installed++; console.log(`installed  ${it.name}  -> ${it.to}`); }
          for (const s of rep.skipped) { skipped++; console.log(`skipped    ${s.name}  (${s.reason})`); }
          for (const e of rep.errors) { errs++; console.error(`error      ${e}`); }
        }
        console.log(`\n${installed} installed, ${skipped} skipped, ${errs} errors (source: ${src.name}, category: ${cat}).`);
        return;
      }
      const resolvedPackId = repoName ? packId : null;
      const targetDir = resolvedPackId ? resolvePackDir(res.dir, resolvedPackId, src.catalogFile) : res.dir;
      if (resolvedPackId && !targetDir) {
        const packs = discoverPacks(res.dir, src.catalogFile);
        console.error(`Pack '${resolvedPackId}' not found in '${repoName}'. Available: ${(packs.map((p) => p.name).join(', ')) || 'none'}`);
        return;
      }
      const rep = await importSkills({ source: targetDir ?? res.dir, origin: src.name, force: !!flags.force });
      for (const it of rep.imported) console.log(`installed  ${it.name}  -> ${it.to}`);
      for (const sk of rep.skipped) console.log(`skipped    ${sk.name}  (${sk.reason})`);
      for (const e of rep.errors) console.error(`error      ${e}`);
      console.log(`\n${rep.imported.length} installed, ${rep.skipped.length} skipped, ${rep.errors.length} errors (source: ${src.name}).`);
      return;
    }
    const { skills } = loadAllSkills(cwd);
    if (sub === 'list' || !sub) {
      if (!skills.length) { console.log('No skills available.'); return; }
      for (const sk of skills) {
        console.log(`${sk.name.padEnd(24)} ${sk.description.slice(0, 72)}`);
      }
      return;
    }
    // mochi skills show <name> or mochi skills <name>
    const targetName = (sub === 'show' ? positional[2] : sub) || '';
    const sk = skills.find((x) => x.name === targetName || x.name.toLowerCase() === targetName.toLowerCase());
    if (!sk) { console.log(`No skill "${targetName}". Type "mochi skills" to list all.`); return; }
    const { readFileSync } = await import('node:fs');
    try { console.log(readFileSync(sk.path, 'utf8').slice(0, 4000)); }
    catch (e) { console.error(`Failed to read skill: ${(e as Error).message}`); }
    return;
  }
  if (first === 'import-skills') {
    // mochi import-skills <source> [--force]      (alias: mochi skills import <source>)
    // Import an external skills tree (Hermes ~/.hermes/skills, a git checkout,
    // or any agentskills.io tree) into the global ~/.mochi/skills so the harness
    // gains the mature skill library without re-authoring. Cross-agent memory.
    // NOTE: the `skills import` alias is served by the `skills` branch above;
    // this branch only sees `import-skills <source>`.
    const sourceName = positional[1];
    if (!sourceName) {
      console.log('Usage: mochi import-skills <source> [--force] [--update] [--list]');
      console.log('  source = "hermes:", an absolute/relative skills path, github:owner/repo, or a git URL.');
      console.log('  --force overwrites any dest that already exists. --update refreshes a cached git clone.');
      return;
    }
    const { importSkills, resolveSourceDir, discoverSourceSkills } = await import('./features/skill-importer.js');
    const srcRes = await resolveSourceDir(sourceName, { update: !!flags.update });
    if (!srcRes.dir) { console.error(`Source not found or clone failed: ${sourceName}${srcRes.error ? ` (${srcRes.error})` : ''}`); return; }
    const src = srcRes.dir;
    if (flags.list) {
      const { skills } = discoverSourceSkills(src);
      console.log(`Discoverable skills in ${src} (${skills.length}):`);
      for (const s of skills) console.log(`  - ${s.name}  ${(s.description || '').slice(0, 72)}`);
      return;
    }
    const rep = await importSkills({ source: sourceName, force: !!flags.force });
    for (const it of rep.imported) console.log(`imported  ${it.name}  -> ${it.to}`);
    for (const sk of rep.skipped) console.log(`skipped   ${sk.name}  (${sk.reason})`);
    for (const e of rep.errors) console.error(`error     ${e}`);
    console.log(`\n${rep.imported.length} imported, ${rep.skipped.length} skipped, ${rep.errors.length} errors (origin: ${rep.origin}).`);
    return;
  }
  if (first === 'plugins' || first === 'plugin') {
    // spec 12-E: mochi plugin add|remove|list|info|enable|disable|validate [--user|--force]
    const { PluginRegistry } = await import('./plugins.js');
    const projectPlugins = resolve(cwd, '.mochi', 'plugins');
    const reg = new PluginRegistry(projectPlugins);
    const sub = positional[1];
    if (sub === 'list' || sub === 'ls' || !sub) {
      const records = reg.list();
      if (!records.length) { console.log('No plugins installed. Use: mochi plugin add <dir>'); return; }
      for (const p of records) {
        const state = p.enabled ? '' : ' [disabled]';
        console.log(`${p.name.padEnd(24)} v${p.version.padEnd(8)} ${p.scope === 'user' ? '[user] '.padEnd(8) : '[proj] '.padEnd(8)}${p.description}${p.hooks.length ? ` hooks:${p.hooks.join(',')}` : ''}${state}`);
      }
      return;
    }
    if (sub === 'add' || sub === 'install') {
      const source = positional[2];
      if (!source) { console.log('Usage: mochi plugin add <dir> [--user] [--force]'); return; }
      try {
        const { PluginRegistry: PR } = await import('./plugins.js');
        const problems = PR.validateDir(resolve(source));
        if (problems.length) {
          console.error(`Plugin validation failed:\n  - ${problems.join('\n  - ')}`);
          if (!flags.force) { console.error('Fix the manifest or re-run with --force.'); return; }
        }
        const rec = reg.install(source, { scope: flags.user ? 'user' : 'project', overwrite: !!flags.force });
        const hooksFile = resolve(cwd, '.mochi', 'hooks.json');
        const { existsSync, readFileSync } = await import('node:fs');
        const existing = existsSync(hooksFile) ? JSON.parse(readFileSync(hooksFile, 'utf8')) : {};
        reg.syncToHooksFile(hooksFile, existing);
        console.log(`Installed plugin "${rec.name}" v${rec.version} (${rec.scope} scope).`);
        console.log(`Hooks merged into ${hooksFile}`);
        return;
      } catch (e) {
        console.error(`Install failed: ${(e as Error).message}`);
        return;
      }
    }
    if (sub === 'remove' || sub === 'rm') {
      const name = positional[2];
      if (!name) { console.log('Usage: mochi plugin remove <name>'); return; }
      if (reg.remove(name)) { console.log(`Removed plugin "${name}".`); }
      else { console.error(`No plugin "${name}" installed.`); }
      return;
    }
    if (sub === 'info' || sub === 'show') {
      const name = positional[2];
      if (!name) { console.log('Usage: mochi plugin info <name>'); return; }
      try {
        console.log(reg.info(name));
      } catch (e) {
        console.error((e as Error).message);
      }
      return;
    }
    if (sub === 'enable' || sub === 'disable') {
      const name = positional[2];
      if (!name) { console.log(`Usage: mochi plugin ${sub} <name>`); return; }
      const want = sub === 'enable';
      if (reg.setEnabled(name, want)) {
        const hooksFile = resolve(cwd, '.mochi', 'hooks.json');
        const { existsSync, readFileSync } = await import('node:fs');
        const existing = existsSync(hooksFile) ? JSON.parse(readFileSync(hooksFile, 'utf8')) : {};
        reg.syncToHooksFile(hooksFile, existing);
        console.log(`${want ? 'Enabled' : 'Disabled'} plugin "${name}". Hooks re-synced.`);
      } else {
        console.error(`No plugin "${name}" installed (or already ${want ? 'enabled' : 'disabled'}).`);
      }
      return;
    }
    if (sub === 'validate') {
      const source = positional[2];
      if (!source) { console.log('Usage: mochi plugin validate <dir>'); return; }
      const { PluginRegistry: PR } = await import('./plugins.js');
      const problems = PR.validateDir(resolve(source));
      if (!problems.length) console.log(`Plugin at ${source} looks valid.`);
      else console.log(`Problems:\n  - ${problems.join('\n  - ')}`);
      const warnings = PR.lintSandbox(resolve(source));
      if (warnings.length) console.log(`Sandbox warnings:\n  - ${warnings.join('\n  - ')}`);
      return;
    }
    if (sub === 'search') {
      const q = positional.slice(2).join(' ');
      if (!q) { console.log('Usage: mochi plugin search <keywords>'); return; }
      const hits = reg.search(q);
      if (!hits.length) { console.log(`No plugins match "${q}".`); return; }
      for (const p of hits) {
        console.log(`${p.name.padEnd(24)} v${p.version.padEnd(8)} ${p.enabled ? '' : '[disabled] '}${p.description}`);
      }
      return;
    }
    if (sub === 'pack') {
      const name = positional[2];
      if (!name) { console.log('Usage: mochi plugin pack <name> [--out <dir>]'); return; }
      const outDir = typeof flags.out === 'string' && flags.out ? String(flags.out) : resolve(cwd, 'mochi-plugins-pack');
      try {
        const dest = reg.pack(name, outDir);
        console.log(`Packed "${name}" → ${dest} — share it; recipients run: mochi plugin add ${dest}`);
      } catch (e) {
        console.error((e as Error).message);
      }
      return;
    }
    console.log('Usage: mochi plugin <add <dir>|remove <name>|list|info <name>|enable <name>|disable <name>|validate <dir>|search <q>|pack <name>>');
    return;
  }
  if (first === 'rules' || first === 'rule') {
    const { loadRules, synthesizeRule } = await import('./rules.js');
    const sub = positional[1];
    if (sub === 'list' || !sub) {
      const all = loadRules(cwd);
      if (!all.length) { console.log('No modular rules found in .mochi/rules/. Use: mochi rules add <name> "<title>" "<content>"'); return; }
      console.log(`🍡 Modular Project Rules (${all.length}):\n`);
      for (const r of all) {
        const triggers = [
          r.globs?.length ? `globs:[${r.globs.join(',')}]` : null,
          r.keywords?.length ? `keywords:[${r.keywords.join(',')}]` : null,
        ].filter(Boolean).join(' ');
        console.log(`- ${r.id.padEnd(20)} "${r.title}" ${triggers ? `(${triggers})` : '(universal)'}`);
      }
      return;
    }
    if (sub === 'add') {
      const name = positional[2];
      // Two forms: `add <name> "<title>" "<content…>"` and `add <name> "<content…>"`.
      // The old fallback used the title AS the body when no content followed,
      // silently writing a rule whose content was just its own title.
      const hasContent = positional.length >= 5;
      const title = hasContent ? positional[3] : name;
      const content = hasContent ? positional.slice(4).join(' ') : positional[3] || '';
      if (!name || !content) { console.log('Usage: mochi rules add <name> "<title>" "<content>"'); return; }
      synthesizeRule(cwd, name, title, content);
      console.log(`Added rule "${name}" in .mochi/rules/${name}.md`);
      return;
    }
    console.log('Usage: mochi rules [list | add <name> "<title>" "<content>"]');
    return;
  }
  if (first === 'bg') {
    const { listTasks, getTask, describeTask, killTask, listPersistedTasks, getPersistedTask, killPersistedTask } = await import('./daemon/background-tasks.js');
    const sub = positional[1];
    // Merge in-process truth (if any) with the on-disk ledger — a fresh CLI
    // process used to read only the in-process Map, which is always empty, so
    // `mochi bg` could never list, show, or kill anything.
    const merged = (): ReturnType<typeof listPersistedTasks> => {
      const byId = new Map(listPersistedTasks(cwd).map((t) => [t.id, t]));
      for (const t of listTasks()) byId.set(t.id, t);
      return [...byId.values()].sort((a, b) => b.startedAt - a.startedAt);
    };
    if (sub === 'list' || !sub) {
      const all = merged();
      if (!all.length) { console.log('No background tasks. (They are started by the agent via the shell tool’s background flag.)'); return; }
      for (const t of all) {
        console.log(describeTask(t, 200));
      }
      return;
    }
    if (sub === 'status' || sub === 'logs' || sub === 'show') {
      const id = positional[2];
      if (!id) { console.log('Usage: mochi bg logs <task-id>'); return; }
      const t = getTask(id) ?? getPersistedTask(id, cwd);
      if (!t) { console.log(`No background task "${id}".`); return; }
      const exitLabel = t.exitCode !== undefined && t.exitCode !== null ? String(t.exitCode) : (t.status === 'running' ? 'running' : '?');
      console.log(`[bg:${t.id} status=${t.status} exit=${exitLabel}]\n${t.output || '(no output)'}`);
      return;
    }
    if (sub === 'kill' || sub === 'stop') {
      const id = positional[2];
      if (!id) { console.log('Usage: mochi bg kill <task-id>'); return; }
      const ok = killTask(id) || killPersistedTask(id, cwd);
      console.log(ok ? `Killed background task ${id}.` : `Could not kill task ${id}.`);
      if (!ok) process.exitCode = 1;
      return;
    }
    console.log('Usage: mochi bg [list | logs <id> | kill <id>]');
    return;
  }
  if (first === 'discord') {
    const sub = positional[1];
    const { loadDiscordConfig } = await import('./discord.js');
    const cfg = loadDiscordConfig(cwd);
    if (sub === 'run') {
      // Mochi ships no embedded Discord gateway (no discord.js runtime) —
      // say so plainly instead of pretending to start one. The gateway runs
      // under Hermes (`hermes gateway run`) with DISCORD_BOT_TOKEN set.
      if (!cfg) {
        console.error('No Discord bot configuration found. Set DISCORD_BOT_TOKEN in .env, ~/.mochi/.env, or ~/.hermes/.env.');
        process.exit(1);
      }
      console.log(`Discord gateway config OK (prefix "${cfg.prefix || '!mochi'}"). Mochi has no embedded gateway runner;`);
      console.log('start the gateway with Hermes: `hermes gateway run` (it consumes the same token + handlers).');
      return;
    }
    // `discord` and `discord status`: report gateway readiness, no side effects.
    if (!cfg) {
      console.error('No Discord bot configuration found. Set DISCORD_BOT_TOKEN in .env, ~/.mochi/.env, or ~/.hermes/.env.');
      process.exit(1);
    }
    console.log(`🍡 Mochi Discord Gateway configured with prefix "${cfg.prefix || '!mochi'}".`);
    console.log(`Bot Token: ${cfg.token.slice(0, 10)}... (whitelisting: ${cfg.allowAllUsers ? 'all users' : (cfg.allowedUserIds?.length ?? 0) + ' users'})`);
    return;
  }
  if (first === 'security' || first === 'audit') {
    const { runSecurityAudit, formatSecurityReport } = await import('./tools/security-audit.js');
    const findings = runSecurityAudit(cwd);
    console.log(formatSecurityReport(findings));
    if (flags.strict && findings.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')) {
      process.exit(1);
    }
    return;
  }
  if (first === 'dashboard' || first === 'web') {
    const wsDir = resolve(cwd, '.mochi');
    const { readDaemonInfo, startDaemon, daemonRunning } = await import('./daemon/daemon.js');
    let info = readDaemonInfo(wsDir);
    if (!info || !daemonRunning(wsDir)) {
      const r = await startDaemon({ cwd, config: configOverrides });
      if (!r.ok) { console.error(`Failed to start daemon: ${r.error}`); process.exit(1); }
      info = readDaemonInfo(wsDir);
    }
    const url = `http://127.0.0.1:${info?.port}/dashboard?token=${info?.token}`;
    console.log(`🍡 Mochi Web Dashboard running at:\n${url}\n(contains a local auth token — do not share or paste into logs)\n`);
    return;
  }
  if (first === 'review') {
    // spec Pillar 2: git diff | mochi review [--strict] [--json] [--diff-only]
    const { readStdin, loadDiff, parseFindings, findingsToNdjson, renderFindings, countBySeverity } = await import('./pipeline.js');
    let input: string;
    if (flags['diff-only']) {
      input = loadDiff(positional.slice(1), cwd);
      console.log(input || '(no diff)');
      return;
    }
    const piped = await readStdin();
    input = piped.trim() ? piped : loadDiff(positional.slice(1), cwd);
    if (!input.trim()) { console.log('Nothing to review. Pipe a diff or log: git diff | mochi review'); return; }
    const summary = await runtime.review(input);
    const findings = parseFindings(summary);
    if (flags.json) {
      // JSON summary line first (for CI) then the findings NDJSON.
      const counts = countBySeverity(findings);
      console.log(JSON.stringify({ summary: summary.slice(0, 2000), highs: counts.HIGH, mediums: counts.MEDIUM, lows: counts.LOW, infos: counts.INFO }));
      if (findings.length) console.log(findingsToNdjson(findings));
    } else if (findings.length) {
      console.log(renderFindings(findings));
      const counts = countBySeverity(findings);
      console.log(`\n${counts.HIGH} HIGH, ${counts.MEDIUM} MEDIUM, ${counts.LOW} LOW, ${counts.INFO} INFO.`);
    } else {
      console.log(summary);
    }
    // --strict: exit nonzero when any HIGH/MEDIUM finding is present (CI gate).
    if (flags.strict) {
      const severe = findings.filter((f) => f.severity === 'HIGH' || f.severity === 'MEDIUM').length;
      process.exitCode = severe > 0 ? 1 : 0;
    }
    return;
  }
  if (first === 'fix') {
    // spec Pillar 2: cat crash.log | mochi fix [--auto-commit]
    const { readStdin } = await import('./pipeline.js');
    const piped = await readStdin();
    const explicit = positional.slice(1).join(' ');
    if (!piped.trim() && !explicit) {
      console.log('Usage: cat crash.log | mochi fix [--auto-commit]\n       mochi fix "describe the issue"');
      return;
    }
    const summary = await runtime.fix(piped.trim() ? piped : explicit);
    console.log(summary);
    if (flags['auto-commit'] || flags.commit) {
      const { checkpoint } = await import('./repo/git.js');
      const cp = await checkpoint(cwd, 'mochi fix');
      console.log(`Auto-commit: ${cp.ref} (${cp.type})`);
    }
    return;
  }
  if (first === 'ask') {
    // Interactive clarification (spec 12-B): mochi ask "<title>" --choices "a;b;c" [--default a] [--recommended c]
    const {askUserChoice} = await import('./clarify.js');
    const title = positional.slice(1).join(' ');
    const choicesRaw = String(flags.choices ?? flags.options ?? '');
    if (!title || !choicesRaw) {
      console.log('Usage: mochi ask "<title>" --choices "pick A|pick B|pick C" [--default "<idx-or-id>"]');
      return;
    }
    const opts = choicesRaw.split('|').map((x) => x.trim()).filter(Boolean);
    const choices = opts.map((label, i) => ({ id: String(i + 1), label }));
    const dv = typeof flags['default'] === 'string' && flags['default'] ? flags['default'] : undefined;
    const q = { title, choices: choices.length ? choices : [{ id: '1', label: opts[0] ?? '' }], ...(dv ? { defaultValue: dv } : {}) };
    const out = await askUserChoice(q);
    console.log('→ ' + (out.choice?.label ?? '(none)') + (out.usedDefault ? ' (default)' : ''));
    return;
  }
  if (first === 'docs') {
    const { queryDocs, generateAdr } = await import('./dox.js');
    const sub = positional[1];
    const docsDir = resolve(cwd, 'docs');
    if (sub === 'query') {
      const q = positional.slice(2).join(' ');
      if (!q) { console.log('Usage: mochi docs query "<text>"'); return; }
      const hits = queryDocs(docsDir, q);
      if (!hits.length) { console.log('No doc matches.'); return; }
      for (const h of hits.slice(0, 5)) {
        console.log(`[${h.file}] ${h.title}`);
        console.log('  ' + h.text.slice(0, 180).replace(/\n/g, ' '));
      }
      return;
    }
    if (sub === 'adr') {
      // mochi docs adr "<title>" --context "..." --decision "..." [--tradeoffs "a;b"]
      const title = positional.slice(2).join(' ');
      const context = String(flags.context ?? '');
      const decision = String(flags.decision ?? '');
      if (!title || !context || !decision) {
        console.log('Usage: mochi docs adr "<title>" --context "..." --decision "..." [--tradeoffs "a;b"]');
        return;
      }
      const tradeoffs = typeof flags.tradeoffs === 'string' && flags.tradeoffs ? flags.tradeoffs.split(';').map((x) => x.trim()).filter(Boolean) : undefined;
      const rel = generateAdr(cwd, { title, context, decision, tradeoffs });
      console.log(`ADR written: ${rel}`);
      return;
    }
    console.log('Usage: mochi docs query "<text>" | mochi docs adr "<title>" --context "..." --decision "..."');
    return;
  }
  if (first === 'acp') {
    // Editor-native stdio server (Agent Client Protocol). Runs until the
    // editor closes stdin. Never falls through to the prompt path.
    // `mochi acp --check` verifies the in-process lifecycle without spawning.
    if (flags.check === true || positional[1] === '--check' || positional[1] === 'check') {
      const { acpCheck } = await import('./acp.js');
      const r = await acpCheck(cwd);
      console.log(r.report);
      if (!r.ok) process.exit(1);
      return;
    }
    const { serverLoop } = await import('./acp.js');
    await serverLoop(cwd);
    return;
  }
  if (first === 'setup' && (positional[1] === 'vscode' || positional[1] === 'jetbrains' || positional[1] === 'editors' || positional[1] === 'editor')) {
    // Real-product editor installer: verifies the ACP bridge, then hands off
    // to the marketplace / install-from-disk flow. Never shells out to a
    // package manager without telling the user first (the old flow tried to
    // auto-run `code`/`vsce` and failed opaquely on minimal PATHs).
    const target = positional[1];
    const { acpCheck } = await import('./acp.js');
    const check = await acpCheck(cwd);
    console.log(check.report);
    if (!check.ok) { console.error('Fix ACP first (`mochi doctor --probe`), then re-run setup.'); process.exit(1); }
    const { existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const extRoot = resolve(cliDirname(), '..', 'editors');
    if (target === 'vscode' || target === 'editors' || target === 'editor') {
      const pkg = resolve(extRoot, 'vscode', 'package.json');
      if (!existsSync(pkg)) {
        console.error('editors/vscode not found in this install (npm tarball excludes it). Clone https://github.com/mochi-agent/mochi → editors/vscode/README.md');
      } else {
        console.log('');
        console.log('VS Code:');
        console.log('  1. cd editors/vscode && npm install && npx vsce package');
        console.log('  2. code --install-extension mochi-vscode-<version>.vsix');
        console.log('  3. Open a trusted folder → Mochi icon → "Mochi: New Session".');
        console.log('  Settings: mochi.binaryPath (default "mochi"), mochi.requestTimeoutMs, mochi.maxSessionHistory.');
        try {
          const { execFileSync } = await import('node:child_process');
          const out = execFileSync('code', ['--version'], { timeout: 5000 }).toString().trim().split('\n')[0];
          console.log(`  Detected VS Code CLI: ${out} — step 2 will work.`);
        } catch {
          console.log('  VS Code CLI (`code`) not on PATH — install the .vsix via Extensions → … → Install from VSIX.');
        }
      }
    }
    if (target === 'jetbrains' || target === 'editors' || target === 'editor') {
      console.log('');
      console.log('JetBrains (IntelliJ / PyCharm / WebStorm):');
      console.log('  1. cd editors/jetbrains && ./gradlew buildPlugin');
      console.log('  2. Settings → Plugins → ⚙ → Install Plugin from Disk → build/distributions/*.zip');
      console.log('  3. Tools → Mochi chat (right tool window). Binary defaults to "mochi" on PATH.');
    }
    return;
  }
  if (first === 'onboard' || first === 'setup' || first === 'welcome') {
    // Cozy one-time setup wizard: scan other agents for providers/keys,
    // skills and MCPs, then import non-destructively. `mochi onboard --yes`
    // accepts all defaults (CI-friendly); otherwise interactive prompts.
    const { scanForOnboarding } = await import('./onboarding/detect.js');
    const { importProviderKeys, importSkillSources, importMcpSources, markOnboarded } = await import('./onboarding/import.js');
    const { welcomeFrame, stepFrame, defaultChoices } = await import('./onboarding/wizard.js');
    const scan = scanForOnboarding(cwd);
    const yes = flags.yes === true || flags.y === true || flags.auto === true;
    for (const line of welcomeFrame(VERSION)) console.log(line.replace(/\x1b\[[0-9;]*m/g, ''));
    console.log('');
    for (const step of ['providers', 'models', 'skills', 'mcp', 'editors'] as const) {
      for (const line of stepFrame(step, scan)) console.log(line.replace(/\x1b\[[0-9;]*m/g, ''));
      console.log('');
    }
    const choices = defaultChoices(scan);
    if (flags['skip-skills']) { choices.importSkills = false; choices.skillDirs = []; }
    if (flags['skip-mcp']) { choices.importMcp = false; choices.mcpFiles = []; }
    if (flags['skip-providers']) choices.importProviders = false;
    if (!yes && process.stdin.isTTY) {
      // Interactive confirm (default Y). Single prompt keeps ssh/mobile usable.
      const ask = (q: string): Promise<boolean> => new Promise((res) => {
        process.stdout.write(`${q} [Y/n] `);
        let acc = '';
        const onData = (c: Buffer) => {
          acc += c.toString('utf8');
          if (acc.includes('\n')) {
            process.stdin.off('data', onData);
            process.stdin.pause();
            res(!/^\s*n/i.test(acc.trim()));
          }
        };
        process.stdin.on('data', onData);
        process.stdin.resume();
      });
      const ok = await ask(`Import ${scan.providers.filter((p) => p.hasKey).length} provider key(s), ${scan.totalSkills} skill(s), ${scan.totalMcpServers} MCP server(s)?`);
      if (!ok) {
        console.log('No changes made. Re-run `mochi onboard --yes` anytime.');
        markOnboarded({ providersImported: [], skillsImported: 0, mcpImported: 0 });
        return;
      }
    }
    let skillsImported = 0;
    let mcpImported = 0;
    let providersImported: string[] = [];
    if (choices.importProviders) {
      const r = importProviderKeys({ overwrite: !!flags.force });
      if (r.primary) providersImported.push(r.primary);
      providersImported.push(...r.failover);
      console.log(providersImported.length ? `🔑 providers wired: ${providersImported.join(', ')}` : '🔑 no provider keys found — set one via `mochi login <provider> --key <k>`');
    }
    if (choices.importSkills && choices.skillDirs.length) {
      const r = await importSkillSources(choices.skillDirs, { force: !!flags.force });
      skillsImported = r.imported;
      console.log(`🧠 skills: ${r.imported} imported, ${r.skipped} skipped${r.errors.length ? `, ${r.errors.length} errors` : ''}`);
      for (const e of r.errors.slice(0, 5)) console.error(`   error: ${e}`);
    } else {
      console.log('🧠 skills: skipped (none found or --skip-skills)');
    }
    if (choices.importMcp && choices.mcpFiles.length) {
      const r = importMcpSources(choices.mcpFiles);
      mcpImported = r.imported.length;
      console.log(`🔌 MCP: ${r.imported.length} imported${r.imported.length ? ` (${r.imported.slice(0, 6).join(', ')})` : ''}${r.skipped.length ? `, ${r.skipped.length} already present` : ''}`);
    } else {
      console.log('🔌 MCP: skipped (none found or --skip-mcp)');
    }
    console.log('');
    console.log('Editors: VS Code → editors/vscode/README.md · JetBrains → editors/jetbrains/README.md (both speak `mochi acp`).');
    console.log('');
    for (const line of stepFrame('done', scan)) console.log(line.replace(/\x1b\[[0-9;]*m/g, ''));
    markOnboarded({ providersImported, skillsImported, mcpImported });
    return;
  }
  if (first === 'perf') {
    const { benchmarkStream, formatPerfReport } = await import('./observability/perf.js');
    const count = flags.chunks ? Number(flags.chunks) : 10000;
    console.log(formatPerfReport(benchmarkStream(count)));
    return;
  }
  if (first === 'config') {
    // Redact before printing: the raw config carries provider apiKey values
    // (they route through redact() on the login path — this one didn't).
    const { redactObject } = await import('./security/security.js');
    console.log(JSON.stringify(redactObject(runtime.config, 8), null, 2));
    return;
  }
  if (first === 'hooks') {
    // MCH-37: user-facing hooks management — init a hooks.json template,
    // list discovered hooks, or test-fire one. Claude Code-hooks parity.
    const { HookManager } = await import('./hooks.js');
    const { existsSync, writeFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { findProjectRoot } = await loadRepoModule();
    const wsDir = resolve(findProjectRoot(runtime.cwd), '.mochi');
    const sub = positional[1];
    if (sub === 'init') {
      const tpl = {
        before_shell: 'echo "$MOCHI_ARGS" | grep -q "rm -rf" && { echo "blocked: rm -rf is not allowed"; exit 1; } || exit 0',
        after_edit: 'echo "edit happened: $MOCHI_TOOL"',
      };
      const target = resolve(runtime.cwd, 'hooks.json');
      if (existsSync(target)) { console.log('hooks.json already exists at ' + target); return; }
      writeFileSync(target, JSON.stringify(tpl, null, 2) + '\n');
      console.log('Wrote ' + target + ' with a starter template (before_shell blocks rm -rf). Edit to taste.');
      return;
    }
    const mgr = new HookManager(wsDir);
    const names = mgr.list();
    if (names.length === 0) {
      console.log('No hooks configured. Run `mochi hooks init` to create a starter hooks.json.');
    } else {
      console.log('Hooks configured:');
      for (const n of names) console.log('  ' + n);
      console.log('\nHook env vars: MOCHI_TOOL, MOCHI_ARGS (JSON), MOCHI_AGENT. Exit non-zero in a before_* hook to veto the action.');
    }
    return;
  }
  if (first === 'providers') {
    const { PROVIDERS } = await import('./model/providers.js');
    for (const p of PROVIDERS) console.log(p.id.padEnd(14) + ' ' + p.name);
    return;
  }
  if (first === 'login' || first === 'use') {
    const { providerById, providerByName } = await import('./model/providers.js');
    const provider = positional[1];
    if (!provider) {
      console.log('Usage: mochi login <provider> [--key <apikey>] [model] | mochi login <provider> env:<VAR>');
      const { PROVIDERS } = await import('./model/providers.js');
      for (const p of PROVIDERS) console.log('  ' + p.id.padEnd(14) + p.name);
      return;
    }
    // Accept ids (`openai`), display names (`OpenAI`), any case — the old
    // path matched ids only, so `mochi login OpenAI` errored.
    const p = providerByName(provider) ?? providerById(provider.toLowerCase());
    if (!p) { console.error('Unknown provider: ' + provider); process.exitCode = 1; return; }
    const args = positional.slice(2);
    // A key can come from --key <v>, `env:<VAR>`, a strongly key-shaped
    // positional (sk-…/hf_…/AIza…), or the provider's env var. It must never
    // occupy the model slot — the old code stored `env:sk-…` AS the model id
    // and could not accept a key on the command line at all.
    const envArg = args.find((x) => x.startsWith('env:'))?.slice(4);
    const keyPos = args.find((x) => /^(sk-|pk-|key_|hf_|xai-|AIza)/i.test(x));
    const keyFlag = typeof flags.key === 'string' ? flags.key : undefined;
    const key = keyFlag || keyPos || envArg || process.env[p.envKey] || '';
    const model = args.find((x) => x !== keyPos && !x.startsWith('env:'));
    const info = key
      ? await runtime.loginProvider(p.id, key, model || p.defaultModel)
      : await runtime.useProvider(p.id, model || p.defaultModel);
    const { redact } = await import('./security/security.js');
    console.log(redact(info));
    if (!key && p.envKey) console.log(`No API key found for ${p.name} — set ${p.envKey} or pass --key <apikey>.`);
    return;
  }
  if (first === 'model') {
    // Show/select the model. This branch did not exist, so `mochi model`
    // (offered by shell completion as "Select model") fell through to the
    // one-shot prompt path and fired a model run on the literal word "model".
    const target = positional[1];
    const { describeConfig } = await import('./model/model-manager.js');
    if (!target) {
      console.log(describeConfig(runtime.config));
      const list = runtime.modelList();
      if (list.length) console.log(`\nModels for this provider:\n  ${list.join('\n  ')}`);
      console.log('\nUsage: mochi model <model-id>   (validates against the list, persists)');
      return;
    }
    const list = runtime.modelList();
    if (list.length && !list.includes(target)) {
      console.error(`Note: "${target}" is not in this provider's known model list — setting it anyway.`);
    }
    console.log(await runtime.useProvider(runtime.config.model.provider, target));
    return;
  }
  if (first === 'models') {
    console.log(runtime.modelList().join('\n') || 'No models listed for ' + runtime.config.model.provider);
    return;
  }
  if (first === 'mcp') {
    // mochi mcp [list|search <q>|add <id>] — 1-command MCP discovery +
    // install into .mcp.json (same engine as the /mcp TUI command).
    const { searchMcpServers, addMcpServerConfig, BUILTIN_MCP_SERVERS } = await import('./tools/mcp-manage.js');
    const sub = positional[1] ?? 'list';
    const rest = positional.slice(2).join(' ');
    if (sub === 'list' || !sub) {
      for (const s of BUILTIN_MCP_SERVERS) console.log(`${s.id.padEnd(24)} ${s.description}`);
      return;
    }
    if (sub === 'search') {
      if (!rest) { console.error('Usage: mochi mcp search <keywords>'); process.exit(1); }
      const hits = searchMcpServers(rest);
      if (!hits.length) { console.log(`No MCP servers match "${rest}".`); return; }
      for (const h of hits) console.log(`${h.server.id.padEnd(24)} ${h.snippet.slice(0, 80)}`);
      console.log('\nInstall one with: mochi mcp add <server-id>');
      return;
    }
    if (sub === 'add') {
      if (!rest) { console.error('Usage: mochi mcp add <server-id>'); process.exit(1); }
      const r = addMcpServerConfig(cwd, rest);
      console.log(r.message);
      if (!r.ok) process.exit(1);
      return;
    }
    console.error(`Unknown mcp command "${sub}". Use: mochi mcp [list|search <q>|add <id>]`);
    process.exit(1);
  }
  if (first === 'doctor') {
    const { doctorReport, formatDoctor, repairDoctor } = await import('./doctor.js');
    const { daemonRunning, readDaemonInfo } = await import('./daemon/daemon.js');
    const { findProjectRoot } = await loadRepoModule();
    const wsDir = findProjectRoot(runtime.cwd);
    
    if (flags.repair || flags.fix || positional[1] === 'repair' || positional[1] === 'fix') {
      const repair = await repairDoctor({ cwd: runtime.cwd, workspaceDir: resolve(wsDir, '.mochi') });
      console.log(repair.summary + '\n');
      for (const item of repair.items) {
        const icon = item.status === 'fixed' ? '🔧 [FIXED]' : item.status === 'already_ok' ? '✓ [OK]' : '⚠️ [ACTION]';
        console.log(`  ${icon.padEnd(14)} ${item.name}: ${item.details}`);
      }
      console.log('');
    }

    const info = readDaemonInfo(runtime.workspace.dir);
    const isRunning = daemonRunning(runtime.workspace.dir);
    const report = await doctorReport({
      version: VERSION,
      probeProvider: flags.probe === true || positional[1] === 'probe' || flags.verbose === true,
      provider: runtime.config.model.provider,
      baseUrl: runtime.config.model.baseUrl ?? '',
      model: runtime.config.model.model,
      apiKey: (runtime.config.model as unknown as { apiKey?: string }).apiKey ?? null,
      workspaceDir: wsDir,
      daemon: { running: isRunning, port: info?.port },
    });
    console.log(formatDoctor(report));
    return;
  }
  if (first === 'run' || first === 'shell') {
    const cmd = positional.slice(1).join(' ');
    const { execFile } = await import('node:child_process');
    execFile('sh', ['-c', cmd], { cwd }, (e, o, er) => {
      console.log(String(o ?? ''));
      if (er) { console.error(String(er)); process.exitCode = typeof (e as { code?: unknown } | null)?.code === 'number' ? (e as { code: number }).code : 1; }
    });
    return;
  }
  if (first === 'test') {
    const { detectRepo } = await import('./repo/repo.js');
    const repo = detectRepo(cwd);
    const cmd = repo.testCommand ?? 'no test command detected';
    const { execFile } = await import('node:child_process');
    execFile('sh', ['-c', cmd], { cwd }, (e, _stdout, stderr) => {
      if (stderr) console.error(String(stderr));
      if (e) process.exitCode = typeof (e as { code?: unknown } | null)?.code === 'number' ? (e as { code: number }).code : 1;
    });
    return;
  }
  if (first === 'init') {
    const { existsSync, writeFileSync } = await import('node:fs');
    const p = resolve(cwd, 'MOCHI.md');
    if (existsSync(p)) { console.log('MOCHI.md already exists.'); return; }
    writeFileSync(p, '# MOCHI.md\n\nProject instructions for the Mochi coding agent.\n');
    console.log('Created MOCHI.md');
    return;
  }
  if (first === 'branch') {
    const { execFile } = await import('node:child_process');
    execFile('git', ['branch', '--show-current'], { cwd }, (_e, out) => console.log(String(out ?? '').trim() || 'no branch'));
    return;
  }
  if (first === 'commit') {
    const { checkpoint } = await import('./repo/git.js');
    const cp = await checkpoint(cwd, positional.slice(1).join(' ') || 'mochi commit');
    console.log(`Committed ${cp.type} ${cp.ref}`);
    return;
  }
  if (first === 'usage') { console.log(runtime.usage.summary()); return; }
  if (first === 'feedback') {
    // Human feedback → ~/.mochi/feedback.jsonl (same file the TUI g/b keys
    // write; the next turn reads it as a self-correction directive).
    // `mochi feedback good|bad [--note "..."] [--crash]` — crash attaches the
    // last 20 crash.log lines as the reason. No network, no tracking.
    const verdict = positional[1];
    if (verdict !== 'good' && verdict !== 'bad') {
      console.log('Usage: mochi feedback good|bad [--note "..."] [--crash]');
      return;
    }
    const noteFlag = typeof flags.note === 'string' && flags.note ? flags.note : positional.slice(2).filter((a) => a !== '--crash').join(' ');
    let reason = noteFlag.trim() || undefined;
    if (flags.crash === true || positional.includes('--crash')) {
      try {
        const { readFileSync, existsSync } = await import('node:fs');
        const { join } = await import('node:path');
        const { homedir } = await import('node:os');
        const crashFile = join(homedir(), '.mochi', 'logs', 'crash.log');
        if (existsSync(crashFile)) {
          const tail = readFileSync(crashFile, 'utf8').trim().split('\n').slice(-20).join('\n').slice(0, 2000);
          reason = [`crash report${reason ? `: ${reason}` : ''}`, tail].join('\n');
        }
      } catch { /* crash attach is best-effort */ }
    }
    const { recordFeedback } = await import('./observability/feedback.js');
    recordFeedback({ ts: Date.now(), session: 'cli', turn: 0, verdict, reason, snippet: (reason ?? verdict).slice(0, 200) });
    console.log(`Recorded ${verdict === 'good' ? '👍' : '👎'} feedback. Thank you — the next turn reads it as a correction signal.`);
    return;
  }
  if (first === 'known-good') { console.log(await runtime.recordGood()); return; }
  if (first === 'check') { console.log(await runtime.knownGood()); return; }
  if (first === 'enhance' || first === 'chameleon') {
    // Removed as a standalone command: it printed reasoning guidance to
    // stdout where the agent never saw it (dead-end output; /plan already
    // covers structured pre-work the agent actually executes). The engine
    // itself is still wired where output is consumed — keep this branch so
    // the args don't fall through to the one-shot prompt path below.
    console.error('`mochi chameleon` / `mochi enhance` was removed as a standalone command (its output never reached the agent).');
    console.error('The engine still runs where it counts:');
    console.error('  • automatically: its scaffold is primed every run and injected into implement/fix/refactor/plan context');
    console.error('  • explicitly:    mochi goal "<objective>" --enhance [--mode flash|medium|hard|...] (same for `mochi team`)');
    console.error('  • in-session:    the `chameleon` tool returns guidance straight into the agent\'s context');
    process.exit(1);
  }
  if (first === 'termix') {
    // "Split this session into N split windows." No external app, no extra
    // process, no auto-launch: all panes are in-process agent sessions on the
    // same configured provider. The user chooses how many splits, then whether
    // they communicate over a shared channel or stay separate.
    const { termix } = await import('./tui/termix.js');
    const isTTY = Boolean(process.stdin.isTTY);

    // Helper: read a single line from stdin (only used when a TTY is present).
    const ask = (prompt: string, fallback: string): Promise<string> =>
      new Promise((resolveInput) => {
        if (!isTTY) return resolveInput(fallback);
        process.stdout.write(prompt);
        let acc = '';
        const onData = (c: Buffer) => {
          acc += c.toString('utf8');
          if (acc.includes('\n')) {
            process.stdin.off('data', onData);
            process.stdin.pause();
            resolveInput(acc.trim());
          }
        };
        process.stdin.on('data', onData);
        process.stdin.resume();
      });

    let task = (flags.task ? String(flags.task) : positional.slice(1).join(' ')).trim();
    if (!task) {
      task = (await ask('Split the current task or enter a new one: ', 'Tackle the goal with parallel angles.')).trim();
      if (!task) task = 'Tackle the current goal with parallel angles.';
    }

    const sessions = flags.sessions
      ? Number(flags.sessions)
      : Number((await ask('How many split panes? (default 2): ', '2')).trim() || 2);

    const coms = flags.coms === true || flags.mode === 'communicate';
    const sep = flags.sep === true || flags.mode === 'separate';
    let mode: 'communicate' | 'separate';
    if (coms && !sep) mode = 'communicate';
    else if (sep && !coms) mode = 'separate';
    else if (!coms && !sep) {
      const chosen = (await ask('Let the split panes communicate (c) or stay separate (s)? [c/s]: ', 'c')).toLowerCase();
      mode = chosen.startsWith('s') ? 'separate' : 'communicate';
    } else {
      mode = 'communicate';
    }

    const run = await termix({ mode, sessions, task, config: runtime.config });
    console.log(`\n# Termix: split into ${run.sessions} panes (${mode})\n`);
    for (const s of run.results) {
      const status = s.error ? `error: ${s.error}` : 'ok';
      console.log(`┌─ pane ${s.index + 1} · ${s.role}`);
      console.log(`│ steps=${s.steps} tokens=${s.tokensUsed} $${s.costUsd.toFixed(4)} (${s.durationMs}ms) — ${status}`);
      console.log(`└ ${s.output.replace(/\s+/g, ' ').slice(0, 220)}`);
    }
    console.log(`\nTotal: ${run.tokensUsed} tokens, $${run.costUsd.toFixed(4)} (${run.durationMs}ms)`);
    process.exitCode = run.results.some((s) => s.error) ? 1 : 0;
    return;
  }
  if (first === 'speculate') {
    const question = positional.slice(1).join(' ');
    if (!question) { console.error('Usage: mochi speculate "<question>"'); process.exit(1); }
    const result = await runtime.speculate(question);
    console.log(`Question: ${question}`);
    console.log(`Strategies:\n${result.candidates.map((c, i) => `${i + 1}. ${c.strategy}`).join('\n')}`);
    if (result.best) console.log(`Best: ${result.best.strategy}\n${result.best.response}`);
    else console.log(result.verifierNotes);
    return;
  }
  if (first === 'profiles') {
    for (const profile of runtime.profiles()) {
      console.log(`${profile.name} (${profile.role}) model=${profile.defaultModel ?? 'coding'} verification=${profile.verification ?? 'optional'} tools=${profile.tools?.join(',') ?? 'all'}`);
    }
    return;
  }
  if (first === 'memory') {
    const memory = runtime.memory();
    console.log(memory || 'No project memory yet.');
    return;
  }
  if (first === 'inspect') {
    const query = positional.slice(1).join(' ');
    if (!query) { console.error('Usage: mochi inspect "<query>"'); process.exit(1); }
    const result = await runtime.inspect(query);
    console.log(result.summary);
    return;
  }


  if (first === 'session') {
    const { SessionStore, hasSqlite } = await import('./state/session-store.js');
    if (!hasSqlite()) { console.log('Session store needs a SQLite driver (Node >= 22.5 or the bun binary).'); return; }
    // GoalEngine persists sessions under the PROJECT ROOT (.mochi/sessions.sqlite);
    // workspace.dir is already that root's .mochi subdir. Use the same key the
    // engine does or the CLI reads an empty sibling DB and sessions never list.
    const { findProjectRoot } = await loadRepoModule();
    const store = new SessionStore(findProjectRoot(runtime.cwd));
    try {
      const sub = positional[1];
      if (sub === 'search') {
        const q = positional.slice(2).join(' ');
        if (!q) { console.log('Usage: mochi session search "<text>"'); return; }
        const hits = store.search(q);
        if (!hits.length) { console.log(`No session content matches "${q}".`); return; }
        for (const h of hits.slice(0, 10)) {
          console.log(`[${h.sessionId.slice(0, 8)} ${h.role}] ${h.content.slice(0, 140)}`);
        }
        return;
      }
      if (sub === 'list') {
        const rows = store.list(20);
        if (!rows.length) { console.log('No sessions yet.'); return; }
        for (const r of rows) {
          const obj = r.objective ? r.objective.slice(0, 60) : '(no objective)';
          console.log(`${r.id.slice(0, 8)}  ${r.status.padEnd(9)} ${obj}`);
        }
        return;
      }
      console.log('Usage: mochi session list\n       mochi session search "<text>"');
    } finally {
      store.close();
    }
    return;
  }

  if (first === 'trace') {
    const { readTrace, formatTrace } = await import('./observability/trace.js');
    const id = positional[1] ?? '';
    const ids = id ? [id] : [];
    if (!ids.length) {
      // No id: list recent trace files and replay the newest one.
      const { readdirSync } = await import('node:fs');
      const dir = resolve(runtime.workspace.dir, 'traces');
      const files = (() => { try { return readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort(); } catch { return []; } })();
      if (!files.length) { console.log('No traces yet.'); return; }
      ids.push(files[files.length - 1].replace(/\.jsonl$/, ''));
    }
    for (const gid of ids) {
      const entries = readTrace(runtime.workspace.dir, gid);
      if (!entries.length) { console.log(`No trace for ${gid}.`); continue; }
      console.log(formatTrace(entries));
    }
    return;
  }

  const prompt = positional.join(' ');
  if (prompt) {
    // Full-screen TUI only makes sense on an interactive terminal. When stdin
    // or stdout is piped/redirected (scripts, CI, `mochi "..." | less`), run
    // the prompt and print the result instead of spewing escape codes.
    const isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);
    if (flags.p || flags.print || !isTTY) {
      // MCH-94: one-shot runs have no human watching a TUI — the print-mode
      // caller reads `summary` directly. Skip the ~5s post-run narrative
      // model call entirely; it only beautifies output nobody renders.
      process.env.MOCHI_NARRATIVE_SUMMARY = '0';
      const detailed = await runtime.runPromptDetailed(prompt);
      if (flags.json) {
        // Machine-readable output for scripts/CI: the full structured result.
        console.log(JSON.stringify(detailed, null, 2));
      } else {
        console.log(detailed.summary);
        if (detailed.filesModified && detailed.filesModified.length > 0) {
          console.log('\nFiles modified:');
          for (const f of detailed.filesModified) {
            console.log(`  • ${f}`);
          }
        }
      }
      // Exit code reflects the real outcome (CI can branch on it):
      // 0 = task completed, 1 = task failed/aborted.
      const code = detailed.success ? 0 : 1;
      // Non-interactive one-shot: exit explicitly once stdout has flushed.
      // runPrompt can leave handles alive (event bus, recorder, model keep-alive)
      // that would keep the process running forever even after work is done,
      // so don't rely on the event loop draining on its own.
      process.stdout.write('\n', () => process.exit(code));
    } else {
      await interactive(runtime, prompt);
    }
    return;
  }

  // No prompt: drop into the interactive TUI when attached to a terminal;
  // otherwise print usage since there is nothing to drive interactively.
  if (process.stdin.isTTY && process.stdout.isTTY) {
    await interactive(runtime);
  } else {
    printHelp();
  }
}

async function interactive(runtime: import('./runtime.js').Runtime, initialPrompt?: string) {
  const { launchTui } = await import('./tui/app.js');
  await launchTui(runtime, initialPrompt);
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
