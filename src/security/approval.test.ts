// Approval gate: policy tiers finally enforced on the execution path.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Agent } from '../agent/loop.js';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { createTask } from '../goals/task.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';
import { describeApproval, normalizePolicy } from './approval.js';
import type { MochiConfig } from '../types.js';

function makeConfig(dir: string, url: string): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl: url, model: 'fake-model' },
    safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 10, maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 4000 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
    telemetry: false,
    projectDir: '.mochi',
    configDir: resolve(dir, '.config/mochi'),
    quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
}

function shellCall(id: string, command: string) {
  return { id, type: 'function', function: { name: 'shell', arguments: JSON.stringify({ command }) } };
}

function auditLines(dir: string): string[] {
  const f = resolve(dir, '.mochi', 'logs', 'audit.jsonl');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').filter(Boolean);
}

describe('describeApproval + normalizePolicy (pure)', () => {
  it('summarizes shell with risk, paths, and truncates', () => {
    expect(describeApproval('shell', { command: 'ls' }).risk).toBe('low');
    expect(describeApproval('shell', { command: 'rm -rf /' }).risk).not.toBe('low');
    expect(describeApproval('write', { path: 'a/b.ts' }).summary).toContain('a/b.ts');
    expect(describeApproval('write', { path: 'x'.repeat(200) }).summary.length).toBeLessThan(140);
    expect(normalizePolicy('yolo')).toBe('yolo');
    expect(normalizePolicy('nonsense')).toBe('strict');
    expect(normalizePolicy(undefined)).toBe('strict');
  });
});

describe('approval gate on the execution path', () => {
  it('deny vetoes the call, audits it, and the run still completes on prose', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-approve-deny-'));
    const fake = await startFakeOpenAI([
      { content: 'Checking status.', toolCalls: [shellCall('s1', 'git status --short')], finishReason: 'tool_calls' },
      { content: 'Status checked without shell.', finishReason: 'stop' },
    ]);
    try {
      const config = makeConfig(dir, fake.url);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      context.setGoal('check git');
      const seen: Array<{ tool: string; summary: string }> = [];
      const agent = new Agent({
        role: 'coder', config, workspace, events: new EventBus(), cwd: dir, context,
        permPolicy: 'strict',
        approvalHandler: async (req) => { seen.push({ tool: req.tool, summary: req.summary }); return 'deny'; },
      });
      const result = await agent.run(createTask('Check the git status and report', 'Run git status and report the result.'));
      expect(seen).toHaveLength(1);
      expect(seen[0].tool).toBe('shell');
      expect(seen[0].summary).toContain('git status');
      expect(result.success).toBe(true);
      expect(result.stopReason).toBe('completed');
      const lines = auditLines(dir);
      expect(lines.some((l) => l.includes('"tool":"shell"') && l.includes('"decision":"deny"'))).toBe(true);
    } finally {
      await fake.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it('allow-always prompts once for repeated identical calls', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-approve-always-'));
    const fake = await startFakeOpenAI([
      { content: 'First.', toolCalls: [shellCall('s1', 'echo one')], finishReason: 'tool_calls' },
      { content: 'Second.', toolCalls: [shellCall('s2', 'echo one')], finishReason: 'tool_calls' },
      { content: 'Both ran.', finishReason: 'stop' },
    ]);
    try {
      const config = makeConfig(dir, fake.url);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      context.setGoal('run echoes');
      let prompts = 0;
      const agent = new Agent({
        role: 'coder', config, workspace, events: new EventBus(), cwd: dir, context,
        permPolicy: 'strict',
        approvalHandler: async () => { prompts++; return 'allow-always'; },
      });
      const result = await agent.run(createTask('Run the echo probe twice and report', 'Run echo one twice via shell and report.'));
      expect(result.success).toBe(true);
      expect(prompts).toBe(1);
    } finally {
      await fake.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it('headless strict without a handler preserves allow behavior and audits', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-approve-headless-'));
    const fake = await startFakeOpenAI([
      { content: 'Writing.', toolCalls: [{ id: 'w1', type: 'function', function: { name: 'write', arguments: JSON.stringify({ path: 'note.txt', content: 'hi' }) } }], finishReason: 'tool_calls' },
      { content: 'Wrote note.txt.', finishReason: 'stop' },
    ]);
    try {
      const config = makeConfig(dir, fake.url);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      context.setGoal('write note');
      // No approvalHandler, strict tier: must NOT hang or veto (pre-gate behavior).
      const agent = new Agent({ role: 'coder', config, workspace, events: new EventBus(), cwd: dir, context, permPolicy: 'strict' });
      const result = await agent.run(createTask('Create the note file', 'Write note.txt containing hi.'));
      expect(existsSync(resolve(dir, 'note.txt'))).toBe(true);
      expect(result.success).toBe(true);
      const lines = auditLines(dir);
      expect(lines.some((l) => l.includes('"tool":"write"') && l.includes('"decision":"allow"'))).toBe(true);
    } finally {
      await fake.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it('read-only tools never prompt even in strict', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-approve-read-'));
    const fake = await startFakeOpenAI([
      { content: 'Reading.', toolCalls: [{ id: 'r1', type: 'function', function: { name: 'read', arguments: JSON.stringify({ path: 'package.json' }) } }], finishReason: 'tool_calls' },
      { content: 'Read it.', finishReason: 'stop' },
    ]);
    try {
      const config = makeConfig(dir, fake.url);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      context.setGoal('read pkg');
      let prompts = 0;
      const agent = new Agent({
        role: 'coder', config, workspace, events: new EventBus(), cwd: dir, context,
        permPolicy: 'strict',
        approvalHandler: async () => { prompts++; return 'deny'; },
      });
      await agent.run(createTask('Inspect the package manifest and report', 'Read package.json and report its name.'));
      expect(prompts).toBe(0);
    } finally {
      await fake.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
