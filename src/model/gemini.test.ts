import { describe, it, expect, vi, afterEach } from 'vitest';
import { createGeminiProvider } from './gemini.js';
import { ProviderError } from '../utils/http-error.js';
import type { ChatMessage, StreamChunk } from '../types.js';

function stubFetch(captured: { body?: unknown }) {
  return vi.stubGlobal('fetch', (async (_url: string, opts: { body: string }) => {
    captured.body = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'hello' }] } }], usageMetadata: {} }),
    };
  }) as unknown as typeof fetch);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gemini provider mapping', () => {
  it('sends data-URI images as inlineData parts', async () => {
    const captured: { body?: unknown } = {};
    stubFetch(captured);
    const p = createGeminiProvider({ baseUrl: 'https://x', model: 'gemini-2.0-flash', apiKey: 'k' });
    const png = 'iVBORw0KGgo=';
    const msgs: ChatMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'see this' }, { type: 'image_url', image_url: { url: `data:image/png;base64,${png}` } }] },
    ];
    await p.chat(msgs, []);
    const body = captured.body as { contents: Array<{ parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }> };
    const parts = body.contents[0].parts;
    expect(parts[0]).toEqual({ text: 'see this' });
    expect(parts[1]).toEqual({ inlineData: { mimeType: 'image/png', data: png } });
  });

  it('keeps remote image URLs as text (never [object Object])', async () => {
    const captured: { body?: unknown } = {};
    stubFetch(captured);
    const p = createGeminiProvider({ baseUrl: 'https://x', model: 'gemini-2.0-flash', apiKey: 'k' });
    await p.chat([{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'https://example.com/a.png' } }] }], []);
    const body = captured.body as { contents: Array<{ parts: Array<{ text?: string }> }> };
    expect(body.contents[0].parts[0].text).toContain('https://example.com/a.png');
  });

  it('plain text still maps to a single text part', async () => {
    const captured: { body?: unknown } = {};
    stubFetch(captured);
    const p = createGeminiProvider({ baseUrl: 'https://x', model: 'gemini-2.0-flash', apiKey: 'k' });
    await p.chat([{ role: 'user', content: 'hi' }], []);
    const body = captured.body as { contents: Array<{ parts: Array<{ text?: string }> }> };
    expect(body.contents[0].parts).toEqual([{ text: 'hi' }]);
  });
});

/** Build a real Gemini SSE body: `data:` JSON frames, blank-line separated. */
function sseBody(frames: unknown[]): string {
  return frames.map((obj) => `data: ${JSON.stringify(obj)}\n\n`).join('');
}

function stubSSE(captured: { url?: string; body?: unknown }, frames: unknown[], contentType = 'text/event-stream') {
  return vi.stubGlobal('fetch', (async (url: string, opts: { body: string }) => {
    captured.url = String(url);
    captured.body = JSON.parse(opts.body);
    return new Response(sseBody(frames), { status: 200, headers: { 'content-type': contentType } });
  }) as unknown as typeof fetch);
}

async function collect(gen: AsyncGenerator<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const c of gen) chunks.push(c);
  return chunks;
}

describe('gemini SSE streaming', () => {
  it('parses streamGenerateContent alt=sse frames incrementally with usage', async () => {
    const captured: { url?: string } = {};
    stubSSE(captured, [
      { candidates: [{ content: { parts: [{ text: 'Hel' }] } }] },
      { candidates: [{ content: { parts: [{ text: 'lo' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 5, totalTokenCount: 13 } },
    ]);
    const p = createGeminiProvider({ baseUrl: 'https://x', model: 'gemini-2.0-flash', apiKey: 'k' });
    const chunks = await collect(p.streamChat([{ role: 'user', content: 'hi' }], [], {}));
    expect(captured.url).toContain(':streamGenerateContent?alt=sse');
    expect(chunks.map((c) => c.content ?? '').join('')).toBe('Hello');
    // One yield per SSE frame — the old fake stream emitted a single blob.
    expect(chunks.filter((c) => c.content).length).toBeGreaterThanOrEqual(2);
    const last = chunks[chunks.length - 1];
    expect(last.finishReason).toBe('stop');
    expect(last.usage).toEqual({ promptTokens: 8, completionTokens: 5, totalTokens: 13 });
  });

  it('emits thought parts as reasoningContent and functionCalls stitchable by index', async () => {
    const captured: { url?: string } = {};
    stubSSE(captured, [
      { candidates: [{ content: { parts: [{ text: 'hmm', thought: true }] } }] },
      { candidates: [{ content: { parts: [{ functionCall: { name: 'lookup', args: { q: 'x' } } }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3, totalTokenCount: 5, cachedContentTokenCount: 1 } },
    ]);
    const p = createGeminiProvider({ baseUrl: 'https://x', model: 'gemini-2.0-flash', apiKey: 'k' });
    const chunks = await collect(p.streamChat([{ role: 'user', content: 'hi' }], [], {}));
    expect(chunks.map((c) => c.reasoningContent ?? '').join('')).toBe('hmm');
    const call = chunks.flatMap((c) => c.toolCalls ?? [])[0];
    expect(call).toBeDefined();
    expect(call.index).toBe(0);
    expect(call.function.name).toBe('lookup');
    expect(call.function.arguments).toBe('{"q":"x"}');
    expect(chunks[chunks.length - 1].usage).toEqual({ promptTokens: 2, completionTokens: 3, totalTokens: 5, cachedTokens: 1 });
  });

  it('falls back to a single chunk when the response is plain JSON (non-SSE)', async () => {
    vi.stubGlobal('fetch', (async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'one-shot' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 } }),
    })) as unknown as typeof fetch);
    const p = createGeminiProvider({ baseUrl: 'https://x', model: 'gemini-2.0-flash', apiKey: 'k' });
    const chunks = await collect(p.streamChat([{ role: 'user', content: 'hi' }], [], {}));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('one-shot');
    expect(chunks[0].finishReason).toBe('STOP');
    expect(chunks[0].usage).toEqual({ promptTokens: 1, completionTokens: 2, totalTokens: 3, cachedTokens: 0 });
  });

  it('merges a non-SSE JSON-array reply into one chunk (no alt=sse gateways)', async () => {
    vi.stubGlobal('fetch', (async () => ({
      ok: true,
      json: async () => ([
        { candidates: [{ content: { parts: [{ text: 'Hel' }] } }] },
        { candidates: [{ content: { parts: [{ text: 'lo' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2, totalTokenCount: 6 } },
      ]),
    })) as unknown as typeof fetch);
    const p = createGeminiProvider({ baseUrl: 'https://x', model: 'gemini-2.0-flash', apiKey: 'k' });
    const chunks = await collect(p.streamChat([{ role: 'user', content: 'hi' }], [], {}));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('Hello');
    expect(chunks[0].usage).toEqual({ promptTokens: 4, completionTokens: 2, totalTokens: 6, cachedTokens: 0 });
  });

  it('surfaces non-2xx API errors instead of hanging', async () => {
    vi.stubGlobal('fetch', (async () => new Response(
      JSON.stringify({ error: { message: 'API key not valid' } }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )) as unknown as typeof fetch);
    const p = createGeminiProvider({ baseUrl: 'https://x', model: 'gemini-2.0-flash', apiKey: 'k' });
    const run = collect(p.streamChat([{ role: 'user', content: 'hi' }], [], {}));
    await expect(run).rejects.toThrow(/API key not valid/);
    await run.catch((err: unknown) => {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).status).toBe(400);
    });
  });
});
