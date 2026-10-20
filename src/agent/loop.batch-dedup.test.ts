// B12 regression: parallel write/edit/delete batching dedups same-file targets
// by RAW path string. './src/a.ts', 'src/a.ts', and an absolute path for the
// same file all evade the dedup (Set<string> of the raw path), so two writes to
// the SAME file run CONCURRENTLY — last writer wins, the other edit silently
// lost. The dedup must compare RESOLVED absolute paths.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
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
let config: MochiConfig;

beforeAll(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-batch-dedup-'));
  config = {
    model: { provider: 'openai', baseUrl: 'http://unused', model: 'fake-model' },
    safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 5, maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 4000 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: false },
    telemetry: false, projectDir: '.mochi', configDir: resolve(dir, '.config/mochi'), quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
});

afterAll(async () => {
  await fake?.close();
  rmSync(dir, { recursive: true, force: true });
});

function writeCall(id: string, path: string, content: string) {
  return { id, type: 'function' as const, function: { name: 'write', arguments: JSON.stringify({ path, content }) } };
}

describe('write batch dedup by resolved path (B12)', () => {
  it('two writes to the same file via different path spellings run SERIALLY (last call wins)', async () => {
    // The raw-path dedup missed './target.txt' vs 'target.txt': both entered
    // the parallel group and the second write clobbered the first. With the
    // dedup fixed, both calls share one resolved-path key, so only the first
    // runs this turn and the second is deferred — its result lands after the
    // first, so the file deterministically holds the LAST call's payload.
    fake = await startFakeOpenAI([
      { content: 'Writing.', toolCalls: [writeCall('1', './target.txt', 'first\n'), writeCall('2', 'target.txt', 'second\n')], finishReason: 'tool_calls' },
      { content: 'Deferred second write.', toolCalls: [writeCall('3', 'target.txt', 'second\n')], finishReason: 'tool_calls' },
      { content: 'Done.', finishReason: 'stop' },
    ]);
    const workspace = new Workspace(dir, '.mochi');
    workspace.ensure();
    const context = new ContextEngine(config, dir);
    const task = createTask('write twice', 'Write target.txt twice.');
    const agent = new Agent({ id: 'dedup-agent', role: 'coder', config: { ...config, model: { ...config.model, baseUrl: fake.url } }, workspace, events: new EventBus(), cwd: dir, context });
    await agent.run(task);

    const p = resolve(dir, 'target.txt');
    expect(existsSync(p)).toBe(true);
    const final = readFileSync(p, 'utf8');
    // The file must contain exactly ONE of the two payloads, intact — not an
    // interleaved/truncated hybrid of two concurrent writes.
    expect(final === 'first\n' || final === 'second\n').toBe(true);
    // Serialized by the resolved-path dedup: the deferred second call ran
    // after the first, so the last payload wins deterministically.
    expect(final).toBe('second\n');
  });

  it('writes to genuinely different files still run in the same batch', async () => {
    fake = await startFakeOpenAI([
      { content: 'Writing.', toolCalls: [writeCall('1', 'a_dedup.txt', 'aaa\n'), writeCall('2', 'b_dedup.txt', 'bbb\n')], finishReason: 'tool_calls' },
      { content: 'Done.', finishReason: 'stop' },
    ]);
    const workspace = new Workspace(dir, '.mochi');
    workspace.ensure();
    const context = new ContextEngine(config, dir);
    const task = createTask('write pair', 'Write two files.');
    const agent = new Agent({ id: 'dedup-agent2', role: 'coder', config: { ...config, model: { ...config.model, baseUrl: fake.url } }, workspace, events: new EventBus(), cwd: dir, context });
    await agent.run(task);
    expect(readFileSync(resolve(dir, 'a_dedup.txt'), 'utf8')).toBe('aaa\n');
    expect(readFileSync(resolve(dir, 'b_dedup.txt'), 'utf8')).toBe('bbb\n');
  });
});
