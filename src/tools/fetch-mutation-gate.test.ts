// B27: fetch POST/PUT/PATCH/DELETE mutate REMOTE state, but fetch sat in three
// read-only classifications — the agent loop's isReadOnly allowlist (plan-mode
// veto, mid-stream spec-exec, parallel grouping), the capability registry's
// READ_ONLY_TOOLS (ToolDispatcher concurrent batch), and PermissionManager's
// readTools auto-allow (approval gate). A model could POST/DELETE from plan
// mode with no approval, and nothing bumped the mutation fence after the
// request. These tests pin the arg-aware gates, the static downgrade, the
// fence bump, and the plan-mode veto end-to-end.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { PermissionManager } from '../security/permission.js';
import { createDefaultCapabilityRegistry } from '../core/capability-registry.js';
import { fetchTool } from './fetch.js';
import { mutationGeneration } from './fs-signal.js';
import { Agent } from '../agent/loop.js';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { createTask } from '../goals/task.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig } from '../types.js';

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

const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

describe('fetch mutating methods are not read-only (B27)', () => {
  it('autoAllow does not auto-approve mutating fetch methods (GET still is)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mochi-b27-perm-'));
    try {
      for (const policy of ['strict', 'workspace-safe'] as const) {
        const mgr = new PermissionManager(policy, dir);
        expect(mgr.autoAllow({ tool: 'fetch', args: { url: 'https://example.com' }, cwd: dir, workspaceDir: dir })).toBe(true);
        for (const method of MUTATING) {
          expect(mgr.autoAllow({ tool: 'fetch', args: { url: 'https://example.com', method }, cwd: dir, workspaceDir: dir })).toBe(false);
        }
      }
      // yolo still allows everything (policy decision, not a read-only claim).
      const yolo = new PermissionManager('yolo', dir);
      expect(yolo.autoAllow({ tool: 'fetch', args: { url: 'https://example.com', method: 'POST' }, cwd: dir, workspaceDir: dir })).toBe(true);
      // Coercion-divergence bypass (reviewer P1): fetch.ts builds the request
      // with String(args.method ?? 'GET'), so ['POST'] coerces to 'POST' on
      // the wire. The predicate must coerce identically — a non-string
      // method that stringifies to a mutating verb is a mutation.
      const strict = new PermissionManager('strict', dir);
      expect(strict.autoAllow({ tool: 'fetch', args: { url: 'https://example.com', method: ['POST'] }, cwd: dir, workspaceDir: dir })).toBe(false);
      // An opaque method token like 123 coerces to '123' on both sides —
      // unknown methods draw a 501 per RFC, so they are not classified as
      // mutations; the point is predicate/wire agreement, not a verdict on
      // custom verbs.
      expect(strict.autoAllow({ tool: 'fetch', args: { url: 'https://example.com', method: 123 }, cwd: dir, workspaceDir: dir })).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the capability registry does not classify fetch as read-only', () => {
    const reg = createDefaultCapabilityRegistry();
    expect(reg.get('fetch')?.isReadOnly).toBe(false);
    // Control: genuinely read-only tools keep the classification.
    expect(reg.get('read')?.isReadOnly).toBe(true);
    expect(reg.get('search')?.isReadOnly).toBe(true);
  });

  it('mutating fetch methods bump the mutation fence; GET does not', async () => {
    const server: Server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    try {
      const base = `http://127.0.0.1:${port}/`;
      const g0 = mutationGeneration();
      await fetchTool.execute({ url: base, method: 'GET', allow_private: true });
      expect(mutationGeneration()).toBe(g0);
      await fetchTool.execute({ url: base, method: 'POST', body: 'x', allow_private: true });
      expect(mutationGeneration()).toBeGreaterThan(g0);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('plan mode vetoes a mutating fetch — the POST never leaves the process', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mochi-b27-plan-'));
    let hits = 0;
    const server: Server = createServer((_req, res) => {
      hits++;
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('destroyed');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    let fake: Awaited<ReturnType<typeof startFakeOpenAI>> | undefined;
    try {
      fake = await startFakeOpenAI([
        {
          content: 'Posting now.',
          toolCalls: [{
            id: '1',
            type: 'function',
            function: { name: 'fetch', arguments: JSON.stringify({ url: `http://127.0.0.1:${port}/drop-table`, method: 'POST', body: 'x', allow_private: true }) },
          }],
          finishReason: 'tool_calls',
        },
        { content: 'PLAN:\n1. do nothing destructive', finishReason: 'stop' },
      ]);
      const config = makeConfig(dir, fake.url);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      context.setGoal('plan a change');
      const task = createTask('Plan only', 'Produce a plan. No changes.');

      const agent = new Agent({
        id: 'b27-plan-agent',
        role: 'coder',
        config,
        workspace,
        events: new EventBus(),
        cwd: dir,
        context,
        planMode: true,
      });

      await agent.run(task);
      // The mutating fetch must be vetoed by plan mode, never executed: zero
      // requests reach the server. (RED on main: plan mode classified fetch
      // read-only, so the POST fired — hits === 1.)
      expect(hits).toBe(0);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
      try { await fake?.close(); } catch { /* best-effort */ }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
