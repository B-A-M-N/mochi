import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAnthropicProvider } from './anthropic.js';
import type { ChatMessage } from '../types.js';

const msgs: ChatMessage[] = [
  { role: 'system', content: 'You are Mochi.' },
  { role: 'user', content: 'hi' },
];

function stubFetch(captured: { url?: string; body?: unknown }) {
  return vi.stubGlobal('fetch', (async (url: string, opts: { body: string }) => {
    captured.url = url;
    captured.body = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'hello' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 2 } }),
    };
  }) as unknown as typeof fetch);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('anthropic prompt-cache breakpoints', () => {
  it('sends system as one cacheable block', async () => {
    const captured: { body?: unknown } = {};
    stubFetch(captured);
    const p = createAnthropicProvider({ baseUrl: 'https://api.anthropic.com', model: 'm', apiKey: 'k' });
    await p.chat(msgs, []);
    const body = captured.body as { system?: Array<{ type: string; text: string; cache_control?: { type: string } }> };
    expect(Array.isArray(body.system)).toBe(true);
    expect(body.system?.[0].text).toBe('You are Mochi.');
    expect(body.system?.[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('omits system when empty (wire shape unchanged)', async () => {
    const captured: { body?: unknown } = {};
    stubFetch(captured);
    const p = createAnthropicProvider({ baseUrl: 'https://api.anthropic.com', model: 'm', apiKey: 'k' });
    await p.chat([{ role: 'user', content: 'hi' }], []);
    expect((captured.body as { system?: unknown }).system).toBeUndefined();
  });

  it('flattens multimodal content to text (no [object Object])', async () => {
    const captured: { body?: unknown } = {};
    stubFetch(captured);
    const p = createAnthropicProvider({ baseUrl: 'https://api.anthropic.com', model: 'm', apiKey: 'k' });
    await p.chat([{ role: 'user', content: [{ type: 'text', text: 'look' }, { type: 'image_url', image_url: { url: 'data:x' } }] }], []);
    const body = captured.body as { messages: Array<{ content: unknown }> };
    expect(JSON.stringify(body.messages)).not.toContain('[object Object]');
    expect(JSON.stringify(body.messages)).toContain('look');
  });
});
