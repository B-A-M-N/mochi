// B17 regression: abort listeners leak on the SHARED run signal.
//
// Site 1 (loop.ts empty-response backoff): each backoff sleep added an
// {once:true} abort listener inside its sleep Promise. {once:true} only
// auto-removes when abort FIRES; a backoff that completes normally (the
// common case — the model recovers) left its listener registered forever,
// accumulating across every struggle cycle of a long run.
//
// Site 2 (loop.ts loadMcpInRun): every MCP load registered a new
// close-on-abort listener; repeated loads (load_tools restore path) stacked
// listeners that capture stale connection arrays.
//
// Contract pinned here: after a run with N empty-response backoffs, the run
// signal's 'abort' listener count must be BOUNDED (only the harness's own
// wirings), not proportional to N. We count listeners via the AbortSignal
// event-target internals available in Node (process-level bookkeeping is not
// exposed, so we wrap addEventListener/removeEventListener on the controller's
// signal before handing it to the agent).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Agent } from './loop.js';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { createTask } from '../goals/task.js';
import { startFakeOpenAI, type FakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig } from '../types.js';

let fake: FakeOpenAI;
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-abort-leak-'));
});

afterAll(async () => {
  await fake?.close();
  rmSync(dir, { recursive: true, force: true });
});

function makeConfig(baseUrl: string): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl, model: 'fake-model' },
    safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 10, maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 4000 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: false },
    telemetry: false, projectDir: '.mochi', configDir: resolve(dir, '.config/mochi'), quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
}

/** Wrap a signal's abort-listener registration with counting bookkeeping. */
function instrument(signal: AbortSignal) {
  const added: Array<() => void> = [];
  const origAdd = signal.addEventListener.bind(signal);
  const origRemove = signal.removeEventListener.bind(signal);
  (signal as any).addEventListener = (type: string, h: any, o?: any) => {
    if (type === 'abort') {
      const entry = () => { const i = added.indexOf(entry); if (i >= 0) added.splice(i, 1); };
      (entry as any).__handler = h;
      added.push(entry);
    }
    return origAdd(type, h, o);
  };
  (signal as any).removeEventListener = (type: string, h: any, o?: any) => {
    if (type === 'abort') {
      const idx = added.findIndex((e) => (e as any).__handler === h);
      if (idx >= 0) added.splice(idx, 1);
    }
    return origRemove(type, h, o);
  };
  return {
    get liveAbortListeners() { return added.length; },
    restore() {
      (signal as any).addEventListener = origAdd;
      (signal as any).removeEventListener = origRemove;
    },
  };
}

describe('abort listener lifecycle on the shared run signal (B17)', () => {
  it('listener count is bounded after a run with empty-response backoffs', async () => {
    // 4 consecutive empty responses drive 3 backoff sleeps; the 4th empty
    // response hits the provider-switch path. The old code left one leaked
    // listener per backoff (3 live listeners after this run); the fixed code
    // removes each listener when its sleep settles (0 live).
    fake = await startFakeOpenAI([
      { content: '', finishReason: 'stop' },
      { content: '', finishReason: 'stop' },
      { content: '', finishReason: 'stop' },
      { content: '', finishReason: 'stop' },
      { content: 'Recovered with content.', finishReason: 'stop' },
      { content: 'Done.', finishReason: 'stop' },
    ]);
    const config = makeConfig(fake.url);
    const workspace = new Workspace(dir, '.mochi');
    workspace.ensure();
    const context = new ContextEngine(config, dir);
    const task = createTask('empty-response stress', 'Respond after recoveries.');

    const controller = new AbortController();
    const inst = instrument(controller.signal);
    const agent = new Agent({ id: 'leak-agent', role: 'coder', config, workspace, events: new EventBus(), cwd: dir, context, abortSignal: controller.signal });
    const result = await agent.run(task);
    inst.restore();

    expect(result.success).toBe(true);
    // The run signal must not accumulate leaked listeners: everything the
    // agent registered during the run must be removed by run end.
    expect(inst.liveAbortListeners).toBe(0);
  }, 60_000);
});
