import { describe, it, expect, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createOpenAIProvider } from './openai.js';

// chat()'s native (Rust accum) assembly path must report API usage the same
// way the streaming path does: input/output counts come from the stream's
// usage chunk (plus cached/cost fields) — never zeroed counts just because
// the native fold returned zeros (older runtimes), and never missing the
// cached/cost fields the streaming path exposes.

const nativeState = vi.hoisted(() => ({ result: null as unknown }));

vi.mock('../native/agent-protocol.js', () => ({
  nativeAssembleStream: async () => nativeState.result,
  isRustRuntimeAvailable: () => nativeState.result !== null,
  rustRuntimeVersion: async () => null,
  nativePlanCompaction: async () => null,
  nativeTokensCount: async () => null,
  closeRustRuntime: () => {},
}));

describe('openai chat() usage on the native assembly path', () => {
  let server: http.Server | null = null;
  afterEach(async () => {
    nativeState.result = null;
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((r) => server!.close(() => r()));
      server = null;
    }
  });

  function startUsageServer(usage: Record<string, unknown>) {
    return new Promise<{ port: number }>((resolveStart) => {
      server = http.createServer((req, res) => {
        let data = '';
        req.on('data', (c) => (data += c));
        req.on('end', () => {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          res.write(`data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta: { role: 'assistant', content: 'ok' }, finish_reason: null }] })}\n\n`);
          res.write(`data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        });
      });
      server.listen(0, () => resolveStart({ port: (server!.address() as { port: number }).port }));
    });
  }

  it('reports stream usage counts even when the native fold returns zeros', async () => {
    nativeState.result = { content: 'ok', reasoning: '', toolCalls: [], finishReason: 'stop', promptTokens: 0, completionTokens: 0 };
    const { port } = await startUsageServer({ prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 });
    const provider = createOpenAIProvider({ baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'k', model: 'm' });
    const res = await provider.chat([], [], {});
    expect(res.usage).toEqual({ promptTokens: 11, completionTokens: 5, totalTokens: 16 });
  }, 30_000);

  it('keeps cached/cost fields from the usage chunk (streaming parity)', async () => {
    nativeState.result = { content: 'ok', reasoning: '', toolCalls: [], finishReason: 'stop', promptTokens: 11, completionTokens: 5 };
    const { port } = await startUsageServer({ prompt_tokens: 11, completion_tokens: 5, total_tokens: 16, prompt_tokens_details: { cached_tokens: 3 }, cost: 0.00042 });
    const provider = createOpenAIProvider({ baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'k', model: 'm' });
    const res = await provider.chat([], [], {});
    expect(res.usage).toEqual({ promptTokens: 11, completionTokens: 5, totalTokens: 16, cachedTokens: 3, costUsd: 0.00042 });
  }, 30_000);
});
