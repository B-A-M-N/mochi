import type { Tool } from './types.js';
import { classifyCommand } from '../security/security.js';
import { markMutation } from './fs-signal.js';

// Accumulation guard only (memory safety against firehose output). The final
// RESULT the model sees is clipped to the shared tool-result budget by
// clipToolOutput — keeping the accumulation cap higher means the clip's tail
// is the true end of output (test summaries, git hints), not a mid-stream cut,
// and the child never dies of EPIPE on long-but-bounded output.
const MAX_OUTPUT = 2_000_000;

// Desktop GUI applications that must never be launched by a coding agent.
// Opening a window (gnome-calculator, kcalc, browsers, terminals, editors)
// never delivers source code and visibly "spams" when a model loops on it.
const GUI_LAUNCHERS = [
  /\bgnome-calculator\b/i, /\bkcalc\b/i, /\bxcalc\b/i, /\bgnome-calculator-gtk3\b/i,
  /\bgnome-terminal\b/i, /\bkonsole\b/i, /\bgitk\b/i, /\bgedit\b/i,
  /\bgnome-text-editor\b/i, /\bnautilus\b/i, /\bfirefox\b/i, /\bchromium\b/i,
  /\bgoogle-chrome\b/i,
];

/** Returns a human-readable reason when `command` launches a desktop GUI app,
 *  or null if it's a normal headless command the agent may run. */
export function desktopGuiReason(command: string): string | null {
  const c = command.trim();
  if (!c) return null;
  for (const re of GUI_LAUNCHERS) {
    const m = re.exec(c);
    if (m) return m[0].trim();
  }
  return null;
}

import { clipToolOutput } from './output-budget.js';

export const shellTool: Tool = {
  def: {
    name: 'shell',
    description: 'Run a shell command. Returns stdout, stderr, and exit code. Output is truncated if too long.',
    parameters: [
      { name: 'command', type: 'string', description: 'Shell command', required: true },
      { name: 'cwd', type: 'string', description: 'Working directory (defaults to current)', required: false },
      { name: 'timeout', type: 'integer', description: 'Timeout in seconds', required: false },
      { name: 'description', type: 'string', description: 'Short description of what this command does', required: false },
      { name: 'background', type: 'boolean', description: 'Run in the background: returns a task id immediately; check with command "bg status <id>"', required: false },
      { name: 'sandbox', type: 'boolean', description: 'Run inside a bubblewrap sandbox (read-only root, writable cwd/tmp/caches). Default follows safety.sandbox config.', required: false },
    ],
    permission: 'shell',
    dangerous: true,
  },
  async execute(args, ctx) {
    let command = String(args.command ?? '');
    if (!command) throw new Error('No command provided');

    // Background task management surface: `bg status <id>` / `bg list` / `bg kill <id>` / `bg logs <id>`.
    if (command === 'bg list' || command.startsWith('bg status') || command.startsWith('bg kill') || command.startsWith('bg logs')) {
      const { listTasks, getTask, describeTask, killTask } = await import('../daemon/background-tasks.js');
      if (command.startsWith('bg kill')) {
        const id = command.split(/\s+/)[2];
        if (!id) return 'Usage: bg kill <task-id>';
        const ok = killTask(id);
        return ok ? `Killed background task ${id}.` : `Could not kill background task ${id} (not running or not found).`;
      }
      if (command.startsWith('bg logs')) {
        const id = command.split(/\s+/)[2];
        if (!id) return 'Usage: bg logs <task-id>';
        const t = getTask(id);
        if (!t) return `No background task ${id}. Use 'bg list'.`;
        return `[bg:${t.id} logs (${t.status})]:\n${t.output || '(no output yet)'}`;
      }
      const id = command.startsWith('bg status') ? command.split(/\s+/)[2] : undefined;
      if (id) {
        const t = getTask(id);
        return t ? describeTask(t) : `No background task ${id}. Use 'bg list'.`;
      }
      const all = listTasks();
      return all.length === 0 ? 'No background tasks.' : all.map((t) => describeTask(t, 400)).join('\n---\n');
    }

    // Never spawn a desktop GUI app: it opens a window, delivers no source
    // code, and when a model loops on a "make/build X" request it visibly
    // spams the screen. Redirect the agent to write code instead.
    const gui = desktopGuiReason(command);
    if (gui && ctx.config.safety?.mode === 'safe') {
      throw new Error(
        `Refused to launch desktop GUI app "${gui}". You are a coding agent: when asked to BUILD/IMPLEMENT/CODE something, deliver it as source files (write/edit), then verify headlessly (unit test, CLI invocation, or script) and report the result. Do NOT open a GUI window. Current working directory: ${ctx.cwd ?? ''}`
      );
    }

    if (args.background === true) {
      const { startBackgroundTask, describeTask } = await import('../daemon/background-tasks.js');
      const t = startBackgroundTask(command, ctx.cwd, {
        description: typeof args.description === 'string' ? args.description : undefined,
      });
      // Known fence limitation: the background task mutates files LATER,
      // outside this synchronous bump's visibility. The bg-status polling
      // path does not re-check the generation either. Acceptable for now:
      // background tasks are long-lived watchers/servers, not edit bursts.
      return `${describeTask(t)}\nStarted in background. Continue working; check later with: bg status ${t.id}`;
    }

    // Horus-derived command risk gate: in safe mode, destructive or network-
    // touching commands are blocked outright; in auto/ask they run but the
    // classification is visible (agents shouldn't silently rm -rf or push).
    const risk = classifyCommand(command);
    if (ctx.config.safety.mode === 'safe' && risk !== 'low') {
      throw new Error(`Blocked by safety: command classified as ${risk} (safe mode). Command: ${command.slice(0, 200)}`);
    }
    if (risk !== 'low' && ctx.events) {
      ctx.events.emit({ type: 'agent:log', agentId: ctx.agentId, message: `[shell:${risk}] ${command.slice(0, 160)}` });
    }

    let targetCwd = args.cwd ? String(args.cwd) : ctx.cwd;
    if (targetCwd.startsWith('~/')) {
      const { homedir } = await import('node:os');
      targetCwd = targetCwd.replace(/^~\//, homedir() + '/');
    } else if (targetCwd === '~') {
      const { homedir } = await import('node:os');
      targetCwd = homedir();
    }
    const timeoutMs = ((args.timeout ? Number(args.timeout) : ctx.config.safety.commandTimeoutSeconds) ?? 120) * 1000;

    const env: NodeJS.ProcessEnv = { ...process.env };
    env.AI_AGENT = 'mochi';
    env.MOCHI_AGENT = 'true';
    env.MOCHI_CWD = ctx.cwd;
    if (ctx.workspace) {
      env.MOCHI_WORKSPACE = ctx.workspace.dir;
      env.MOCHI_AGENT_ID = ctx.agentId;
    }
    // Ensure administrative system paths (/usr/sbin, /sbin, /usr/local/sbin) are in PATH.
    // POSIX-only: on win32 this would append colon-joined POSIX dirs onto a
    // semicolon-separated PATH, corrupting the final entry (drive-relative
    // lookups then fail). Windows skips this block; ComSpec/System32 are
    // already on PATH by default.
    if (process.platform !== 'win32') {
      const currentPath = env.PATH || '';
      const adminPaths = ['/usr/local/sbin', '/usr/sbin', '/sbin'];
      const missingPaths = adminPaths.filter((p) => !currentPath.includes(p));
      if (missingPaths.length > 0) {
        env.PATH = `${currentPath}:${missingPaths.join(':')}`;
      }
    }

    // Central execution policy (timeout → SIGTERM → SIGKILL, output caps,
    // abort handling) via exec.ts. The exit_code/stdout/stderr envelope below
    // is byte-identical to the old inline spawner.
    const { runShellString } = await import('../exec.js');
    // Sandbox: per-call flag wins, else the safety.sandbox config. `true`
    // means "sandbox if possible" (auto); omitting means config default.
    const cfgSandbox = ctx.config.safety.sandbox ?? 'off';
    const sandboxMode = args.sandbox === true ? 'auto' : args.sandbox === false ? 'off' : cfgSandbox;
    let r: { stdout: string; stderr: string; code: number | null; timedOut: boolean; cancelled: boolean };
    try {
      r = await runShellString(command, {
        cwd: targetCwd,
        env,
        timeoutMs,
        maxOutput: MAX_OUTPUT,
        signal: ctx.abortSignal,
        sandbox: { mode: sandboxMode },
        onAudit: (info) => {
          if (risk !== 'low' && ctx.events) {
            ctx.events.emit({ type: 'agent:log', agentId: ctx.agentId, message: `[shell:${risk}] ${command.slice(0, 160)} (${info.durationMs}ms)` });
          }
        },
      });
    } catch (err) {
      throw err;
    }
    const out = clipToolOutput([
      `exit_code: ${r.code ?? 1}`,
      `stdout:\n${r.stdout || '(empty)'}`,
      `stderr:\n${r.stderr || '(empty)'}`,
    ].join('\n'));
    // Bump the mutation fence unconditionally: a shell command may write,
    // move, or delete arbitrary files outside the tool layer's knowledge.
    // Generation-keyed caches (search/inspect) must not serve stale results
    // after any command execution.
    markMutation();
    if (r.timedOut) return out + `\n[command timed out after ${timeoutMs / 1000}s]`;
    if (r.cancelled) return out + '\n[command was cancelled]';
    return out;
  },
};
