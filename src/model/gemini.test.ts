import { describe, it, expect, vi, afterEach } from 'vitest';
import { createGeminiProvider } from './gemini.js';
import type { ChatMessage } from '../types.js';

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
