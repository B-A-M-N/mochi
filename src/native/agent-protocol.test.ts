// Parity: the Rust compaction planner (mochi-agent `plan` stdio protocol)
// must agree with the TS ContextEngine's valid-cut-point selection. If the
// binary is absent, the tests assert the fallback contract instead.
import { describe, it, expect, afterAll } from 'vitest';
import { nativePlanCompaction, nativeTokensCount, nativeAssembleStream, rustRuntimeVersion, isRustRuntimeAvailable, closeRustRuntime } from './agent-protocol.js';
import { ContextEngine } from '../context.js';
import type { MochiConfig, ChatMessage } from '../types.js';

async function tsPlanCut(messages: ChatMessage[], keep = 6): Promise<number | null> {
  // Mirror of ContextEngine.previewCompact's cut-point walk, driven through
  // the real class so drift between mirror and engine fails loudly.
  const dir = '/tmp/mochi-parity-probe';
  const config = {
    model: { provider: 'x', baseUrl: 'http://l', model: 'm' },
    safety: { contextBudgetTokens: 8000, mode: 'auto', commandTimeoutSeconds: 5, maxIterations: 5, maxRuntimeMinutes: 1, maxConcurrentAgents: 1 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: false },
  } as unknown as MochiConfig;
  const ctx = new ContextEngine(config, dir);
  for (const m of messages) ctx.addMessage(m as any);
  const preview = await ctx.previewCompact();
  if (preview === null) return null;
  // preview is messages.slice(0, cutIndex): its length IS the cut index.
  return preview.length;
}

const mk = (role: string, content: string, extra: Partial<ChatMessage> = {}): ChatMessage =>
  ({ role, content, ...extra } as ChatMessage);

afterAll(() => closeRustRuntime());

describe('Rust runtime compaction planner (stdio protocol)', () => {
  it('reports availability consistently', async () => {
    const v = await rustRuntimeVersion();
    if (isRustRuntimeAvailable()) {
      expect(v).toBeTruthy();
    } else {
      expect(v).toBeNull();
    }
  });

  it('Rust cut point matches the TS engine (no dangling tool results)', async () => {
    const messages: ChatMessage[] = [
      mk('system', 'sys'),
      mk('user', 'q0'),
      mk('assistant', '', { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read', arguments: '{}' } }] as any }),
      mk('tool', 'r0', { tool_call_id: 'c1' } as any),
      mk('assistant', 'done'),
      mk('user', 'q1'),
      mk('assistant', 'a1'),
      mk('user', 'q2'),
      mk('assistant', 'a2'),
      mk('user', 'q3'),
      mk('assistant', 'a3'),
      mk('user', 'q4'),
      mk('assistant', 'a4'),
    ];
    const req = messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
      tool_calls: m.role === 'assistant' && (m as any).tool_calls ? (m as any).tool_calls.length : 0,
      tool_call_id: (m as any).tool_call_id,
    }));
    const rust = await nativePlanCompaction(req, 12);
    const ts = await tsPlanCut(messages, 12);
    expect(ts).not.toBeNull();
    if (rust !== null) {
      // PARITY: same cut index. Both must drop the c1 pair together.
      expect(rust.cut).toBe(ts);
      if (rust.cut !== null) {
        // The kept suffix must not start with a tool result.
        expect(messages[rust.cut!].role).not.toBe('tool');
      }
    } else {
      // Binary absent: contract is null fallback, not a wrong answer.
      expect(isRustRuntimeAvailable()).toBe(false);
    }
  });

  it('returns null when nothing should drop (short transcript)', async () => {
    const req = [mk('user', 'hi'), mk('assistant', 'yo')].map((m) => ({ role: m.role, content: String(m.content) }));
    const rust = await nativePlanCompaction(req, 12);
    if (rust !== null) {
      expect(rust.cut).toBeNull();
    }
  });

  it('advances past invalid boundaries toward the newest valid one', async () => {
    // The naive target (len-6) lands ON a tool result; the plan must advance
    // forward to the next user message instead.
    const messages: ChatMessage[] = [
      mk('user', 'q0'),
      mk('assistant', '', { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'shell', arguments: '{}' } }] as any }),
      mk('tool', 'r0', { tool_call_id: 'c1' } as any),
      mk('user', 'q1'),
      mk('assistant', 'a1'),
      mk('user', 'q2'),
      mk('assistant', 'a2'),
      mk('user', 'q3'),
      mk('assistant', 'a3'),
      mk('user', 'q4'),
      mk('assistant', 'a4'),
    ];
    const req = messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
      tool_calls: m.role === 'assistant' && (m as any).tool_calls ? (m as any).tool_calls.length : 0,
      tool_call_id: (m as any).tool_call_id,
    }));
    const rust = await nativePlanCompaction(req, 12);
    const ts = await tsPlanCut(messages, 12);
    if (rust !== null && rust.cut !== null) {
      expect(rust.cut).toBe(ts);
      expect(messages[rust.cut].role).toBe('user');
    }
  });
});

function probeEngine(): ContextEngine {
  const config = {
    model: { provider: 'x', baseUrl: 'http://l', model: 'm' },
    safety: { contextBudgetTokens: 8000, mode: 'auto', commandTimeoutSeconds: 5, maxIterations: 5, maxRuntimeMinutes: 1, maxConcurrentAgents: 1 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: false },
  } as unknown as MochiConfig;
  return new ContextEngine(config, '/tmp/mochi-rust-probe');
}

describe('Rust runtime token counting (tokens op)', () => {
  it('counts over message objects and agrees with the sync TS walk', async () => {
    const ctx = probeEngine();
    for (let i = 0; i < 30; i++) {
      ctx.addMessage({ role: i % 2 ? 'assistant' : 'user', content: `message number ${i}: the quick brown fox jumps over the lazy dog` } as ChatMessage);
    }
    const sync = ctx.estimateTokens();
    const native = await ctx.estimateTokensAsync();
    if (isRustRuntimeAvailable()) {
      // Regression guard: the runtime used to receive pre-stringified strings,
      // which json_array_objects() skips -> tokens 0 -> the compaction floor
      // check (ctxTokens > floor) never fired.
      expect(native).toBeGreaterThan(0);
      expect(native).toBeGreaterThanOrEqual(Math.floor(sync / 3));
      expect(native).toBeLessThanOrEqual(sync * 3 + 100);
    } else {
      expect(native).toBe(sync);
    }
  });

  it('stays silent on absurd payloads (>4MB)', async () => {
    expect(await nativeTokensCount([{ role: 'user', content: 'x'.repeat(4_100_000) }])).toBeNull();
    expect(await nativePlanCompaction([{ role: 'user', content: 'x'.repeat(4_100_000) }])).toBeNull();
    expect(await nativeAssembleStream([{ content: 'x'.repeat(4_100_000) }])).toBeNull();
  });
});

describe('Rust runtime stream assembly (accum op)', () => {
  it('folds content, reasoning, stitched tool calls, and usage', async () => {
    const a = await nativeAssembleStream([
      { content: 'hello ' },
      { content: 'world' },
      { reasoningContent: 'think' },
      { toolCalls: [{ index: 0, id: 'a1', function: { name: 'write', arguments: '{"path":' } }] },
      { toolCalls: [{ index: 0, function: { arguments: '"g.txt"}' } }] },
      { finishReason: 'tool_calls' },
      { usage: { promptTokens: 10, completionTokens: 5 } },
    ]);
    if (isRustRuntimeAvailable()) {
      expect(a).not.toBeNull();
      expect(a!.content).toBe('hello world');
      expect(a!.reasoning).toBe('think');
      expect(a!.toolCalls).toEqual([{ id: 'a1', name: 'write', arguments: '{"path":"g.txt"}' }]);
      expect(a!.finishReason).toBe('tool_calls');
      expect(a!.promptTokens).toBe(10);
      expect(a!.completionTokens).toBe(5);
    }
  });

  it('fills defaults for omitted fields', async () => {
    const a = await nativeAssembleStream([{ content: 'x' }]);
    if (isRustRuntimeAvailable()) {
      expect(a).not.toBeNull();
      expect(a!.reasoning).toBe('');
      expect(a!.toolCalls).toEqual([]);
      expect(a!.finishReason).toBeNull();
      expect(a!.promptTokens).toBe(0);
      expect(a!.completionTokens).toBe(0);
    }
  });
});

describe('Rust runtime shutdown fallback', () => {
  it('every op falls back to null after closeRustRuntime()', async () => {
    closeRustRuntime();
    // Deterministic: block respawn so the assertions hold regardless of how
    // fast the exit event lands.
    process.env.MOCHI_NO_NATIVE = '1';
    try {
      expect(await rustRuntimeVersion()).toBeNull();
      expect(await nativePlanCompaction([{ role: 'user', content: 'hi' }])).toBeNull();
      expect(await nativeTokensCount([{ role: 'user', content: 'hi' }])).toBeNull();
      expect(await nativeAssembleStream([{ content: 'x' }])).toBeNull();
      // Let the exit event flip procDead so the dead-proc arm is exercised.
      await new Promise((r) => setTimeout(r, 150));
      expect(await rustRuntimeVersion()).toBeNull();
      closeRustRuntime(); // idempotent
    } finally {
      delete process.env.MOCHI_NO_NATIVE;
    }
  });
});
