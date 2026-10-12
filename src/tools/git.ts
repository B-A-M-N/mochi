import type { Tool } from './types.js';
import { runArgv } from '../exec.js';
import { clipToolOutput } from './output-budget.js';

// Bounded kill for a hung git subprocess — a git awaiting a lock, network
// fetch, or a huge repo must never block the loop forever (same freeze class
// as the search-tool hang, 38c18d8). Delegated to the central exec sandbox
// (runArgv), which owns SIGTERM->SIGKILL escalation, output caps, and audit.
const GIT_TIMEOUT_MS = Number(process.env.MOCHI_GIT_TIMEOUT_MS) || 30_000;
const GIT_KILL_GRACE_MS = 3_000;

function runGit(cwd: string, args: string[]): Promise<string> {
  return runArgv('git', args, {
    cwd,
    timeoutMs: GIT_TIMEOUT_MS,
    killGraceMs: GIT_KILL_GRACE_MS,
    maxOutput: 2_000_000,
  }).then((res) => {
    if (res.timedOut) {
      return `git ${args[0]} did not complete within ${GIT_TIMEOUT_MS / 1000}s (timed out) — it was killed. Narrow the command or raise MOCHI_GIT_TIMEOUT_MS.`;
    }
    if (res.code !== 0 && res.stdout.trim().length === 0) {
      throw new Error(res.stderr.trim() || `git ${args[0]} failed`);
    }
    return clipToolOutput(res.stdout.trim());
  });
}

export const gitTool: Tool = {
  def: {
    name: 'git',
    description: 'Run git commands: status, diff, log, branch, commit, stash, restore. Destructive commands require gitDestructive permission.',
    parameters: [
      { name: 'subcommand', type: 'string', description: 'Git subcommand', required: true },
      { name: 'args', type: 'array', description: 'Additional arguments', required: false },
      { name: 'message', type: 'string', description: 'Commit message when subcommand=commit', required: false },
    ],
    permission: 'read',
  },
  async execute(args, ctx) {
    const sub = String(args.subcommand ?? '');
    const extra = Array.isArray(args.args) ? args.args.map(String) : [];
    const cwd = ctx.cwd;
    const destructive = ['commit', 'stash', 'restore', 'reset', 'checkout', 'clean', 'revert'];
    const isUncensored = ctx.config.safety?.mode === 'uncensored';
    if (destructive.includes(sub) && !ctx.config.permissions.gitDestructive && !isUncensored) {
      throw new Error(`Git ${sub} requires gitDestructive permission`);
    }
    if (!ctx.config.permissions.read && !isUncensored) {
      throw new Error('Read permission denied');
    }
    switch (sub) {
      case 'status':
        return runGit(cwd, ['status', '--short']);
      case 'diff':
        return runGit(cwd, ['diff', ...extra]);
      case 'log':
        return runGit(cwd, ['log', '--oneline', '-20']);
      case 'branch':
        return runGit(cwd, ['branch', '-v']);
      case 'commit': {
        const msg = args.message ? String(args.message) : 'mochi checkpoint';
        await runGit(cwd, ['add', '-A']);
        return runGit(cwd, ['commit', '-m', msg, ...extra]);
      }
      case 'stash': {
        if (extra[0] === 'pop') return runGit(cwd, ['stash', 'pop', ...extra.slice(1)]);
        return runGit(cwd, ['stash', 'push', '-u', '-m', extra[0] ?? 'mochi']);
      }
      case 'restore':
        return runGit(cwd, ['restore', ...extra]);
      case 'add':
        return runGit(cwd, ['add', ...extra]);
      default:
        return runGit(cwd, [sub, ...extra]);
    }
  },
};
