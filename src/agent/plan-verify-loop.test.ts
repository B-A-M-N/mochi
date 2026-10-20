// B9 restructure, end-to-end: plan mode no longer vetoes `verify` outright.
// A non-destructive verify call runs (research intent restored) and any
// tracked-file modification it makes is ROLLED BACK before the loop continues
// (containment invariant held). RED on main: the verify call is vetoed (tool
// result "Blocked: plan mode..."), the command never runs, and the plan-mode
// research flow cannot use the project's own checks.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Agent } from './loop.js';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { createTask } from '../goals/task.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig } from '../types.js';

const SCRATCH = resolve(import.meta.dirname ?? '.', '..', '..', '.revtmp');
const GITENV = { ...process.env, GIT_CONFIG_GLOBAL: '/home/bamn/testing/.tmp-gitconfig-noguard' };

function makeConfig(dir: string, url: string): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl: url, model: 'fake-model' },
    safety: {
      mode: 'auto',
      commandTimeoutSeconds: 10,
      maxIterations: 10,
      maxRuntimeMinutes: 5,
      maxConcurrentAgents: 1,
      contextBudgetTokens: 4000,
    },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
    telemetry: false,
    projectDir: '.mochi',
    configDir: resolve(dir, '.config/mochi'),
    quiet: true,
    verbose: false,
    debug: false,
  } as unknown as MochiConfig;
}

function planModeRepo(): { dir: string; tracked: string } {
  const dir = mkdtempSync(join(SCRATCH, 'b9pv-loop-'));
  const g = (args: string[]) => execFileSync('git', ['-C', dir, ...args], { env: GITENV, stdio: 'pipe' });
  g(['init', '-q']);
  g(['config', 'user.email', 't@t']);
  g(['config', 'user.name', 't']);
  const tracked = join(dir, 'tracked.txt');
  writeFileSync(tracked, 'clean\n');
  writeFileSync(join(dir, '.gitignore'), '.mochi/\n.revtmp/\n');
  mkdirSync(join(dir, '.mochi'), { recursive: true });
  g(['add', '.']);
  g(['commit', '-q', '-m', 'init']);
  return { dir, tracked };
}

describe('plan-mode verify-with-rollback (B9 restructure)', () => {
  it('executes a non-destructive verify in plan mode and rolls back its tracked-file writes', async () => {
    const { dir, tracked } = planModeRepo();
    let fake: Awaited<ReturnType<typeof startFakeOpenAI>> | undefined;
    try {
      // verify's verbatim command overwrites the tracked file.
      fake = await startFakeOpenAI([
        {
          content: 'Checking the tree.',
          toolCalls: [{
            id: 'v1',
            type: 'function',
            function: { name: 'verify', arguments: JSON.stringify({ command: 'echo tampered > tracked.txt' }) },
          }],
          finishReason: 'tool_calls',
        },
        { content: 'PLAN:\n1. nothing to change — check passed', finishReason: 'stop' },
      ]);
      const config = makeConfig(dir, fake.url);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      context.setGoal('plan a change');
      const task = createTask('Plan only', 'Produce a plan. No changes.');

      const logs: string[] = [];
      const events = new EventBus();
      events.onAll((e) => {
        if (e.type === 'agent:log') logs.push(e.message);
      });
      const agent = new Agent({
        id: 'b9-plan-verify',
        role: 'coder',
        config,
        workspace,
        events,
        cwd: dir,
        context,
        planMode: true,
      });

      const result = await agent.run(task);
      // INTENT: the verify command RAN (the tool response is not a veto).
      const verifyMsg = context.getMessages().find((m) => m.role === 'tool' && (m as { name?: string }).name === 'verify');
      expect(verifyMsg).toBeDefined();
      expect(String(verifyMsg?.content)).not.toContain('Blocked: plan mode');
      expect(String(verifyMsg?.content)).toContain('[PASS]');
      // INVARIANT: the tracked-file write did NOT survive — restored to the
      // pre-verify content, and the tree is clean (the write is gone).
      expect(readFileSync(tracked, 'utf8')).toBe('clean\n');
      const status = execFileSync('git', ['-C', dir, 'status', '--porcelain'], { env: GITENV, stdio: 'pipe' }).toString();
      expect(status.trim()).toBe('');
      // The rollback is announced in-loop.
      expect(logs.some((l) => l.includes('[plan-mode] verify modified'))).toBe(true);
      // And the run still finishes as a plan (no veto-escalation forced stop).
      expect(result.summary).toContain('PLAN');
      expect(result.success).toBe(true);
    } finally {
      try { await fake?.close(); } catch { /* best-effort */ }
    }
  });
});
