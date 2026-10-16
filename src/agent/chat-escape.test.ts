// Chat-lane self-correction escape (arena q1 class of failure).
//
// The chat lane vetoes mutating tools on purpose (a greeting must not spawn
// file writes). But when the classifier MISREADS a real deliverable — "Write
// the answer … into answer.txt" routed to the answer lane — a permanent veto
// strands the model: it fights the block, exits green, and ships nothing.
//
// This test pins the escape: the FIRST mutation veto stands; if the model
// insists with a repeated mutation, the run reclassifies chat → implement and
// the write executes. Same philosophy as complexity escalation and the plan
// escape: a run that proves its classifier wrong must correct course.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Agent } from './loop.js';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { createTask } from '../goals/task.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig } from '../types.js';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-chat-escape-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('chat-lane mutation escape', () => {
  it('vetoes the first chat mutation, honors the retried one, and lands the deliverable', async () => {
    const writeArgs = JSON.stringify({ path: 'answer.txt', content: 'VAR=AUTH_SALT\nFALLBACK=pepper\n' });
    const fake = await startFakeOpenAI([
      // Turn 1: model reaches for the write on a chat-classed task → vetoed.
      { finishReason: 'tool_calls', toolCalls: [{ id: 'c1', function: { name: 'write', arguments: writeArgs } }] },
      // Turn 2: model insists (same call) → classifier overruled, write runs.
      { finishReason: 'tool_calls', toolCalls: [{ id: 'c2', function: { name: 'write', arguments: writeArgs } }] },
      // Turn 3: final prose.
      { content: 'Wrote answer.txt with the requested two lines.', finishReason: 'stop' },
    ]);
    try {
      const config = {
        model: { provider: 'openai', baseUrl: fake.url, model: 'fake-model' },
        safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 10, maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 4000 },
        permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
        telemetry: false,
        projectDir: '.mochi',
        quiet: true, verbose: false, debug: false,
      } as unknown as MochiConfig;

      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      // Pure knowledge phrasing → classifyOneShot answers → chat lane.
      context.setGoal('what is the capital of france');
      const bus = new EventBus();
      const logs: string[] = [];
      const toolResults: string[] = [];
      bus.onAll((e) => {
        if (e.type === 'agent:log') logs.push((e as { message: string }).message);
        if (e.type === 'tool:completed') toolResults.push(String((e as { tool?: string }).tool ?? ''));
      });

      const agent = new Agent({ role: 'coder', config, workspace, events: bus, cwd: dir, context });
      const result = await agent.run(createTask('what is the capital of france', 'what is the capital of france'));

      // The escape fired: chat → implement after the repeated mutation.
      expect(logs.some((m) => m.includes('[chat-escape]'))).toBe(true);
      // The deliverable actually landed (the pre-fix behavior: veto forever,
      // no file, exit green).
      expect(existsSync(resolve(dir, 'answer.txt'))).toBe(true);
      expect(readFileSync(resolve(dir, 'answer.txt'), 'utf8')).toContain('AUTH_SALT');
      expect(toolResults).toContain('write');
      expect(result.success).toBe(true);
    } finally {
      await fake.close();
    }
  }, 60_000);

  it('still vetoes a lone mutation on a true greeting (no second attempt)', async () => {
    const fake = await startFakeOpenAI([
      // A greeting model reaching for a write ONCE, then answering — it must
      // not get the write through: the escape only fires on insistence.
      { finishReason: 'tool_calls', toolCalls: [{ id: 'g1', function: { name: 'write', arguments: JSON.stringify({ path: 'nope.txt', content: 'x' }) } }] },
      { content: 'Hello! How can I help you today?', finishReason: 'stop' },
    ]);
    try {
      const config = {
        model: { provider: 'openai', baseUrl: fake.url, model: 'fake-model' },
        safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 10, maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 4000 },
        permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
        telemetry: false,
        projectDir: '.mochi',
        quiet: true, verbose: false, debug: false,
      } as unknown as MochiConfig;

      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      context.setGoal('hi there');
      const bus = new EventBus();

      const agent = new Agent({ role: 'coder', config, workspace, events: bus, cwd: dir, context });
      await agent.run(createTask('hi there', 'hi there'));

      expect(existsSync(resolve(dir, 'nope.txt'))).toBe(false);
    } finally {
      await fake.close();
    }
  }, 60_000);
});
