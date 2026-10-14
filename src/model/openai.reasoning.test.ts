import { describe, it, expect, afterEach } from 'vitest';
import { createOpenAIProvider } from './openai.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';
import type { ChatMessage } from '../types.js';

// Wire mapping for reasoning_effort. The harness-level `max` tier (7-pass
// compiler spec, expanded thinking budgets) is real, but the classic OpenAI
// effort enum (minimal..high) 400s on unknown values — so the DEFAULT wire
// value for max/extreme/deep is 'high', and providers that accept wire 'max'
// (gpt-5.1+, OpenRouter-style) opt in via MOCHI_REASONING_EFFORT_MAX=1.

const msgs: ChatMessage[] = [{ role: 'user', content: 'hi' }];

async function drainStream(model: string, effort: string, url: string): Promise<unknown> {
  const p = createOpenAIProvider({ baseUrl: url, model, apiKey: 'k' });
  for await (const _chunk of p.streamChat(msgs, [], { reasoningEffort: effort })) {
    // drain — we only care about the request body the fake captured
  }
  return undefined;
}

afterEach(() => {
  delete process.env.MOCHI_REASONING_EFFORT_MAX;
});

describe('openai reasoning_effort wire mapping', () => {
  it('defaults max to high on the wire (enum-rejecting endpoints must not 400)', async () => {
    const fake = await startFakeOpenAI([{ content: 'ok', finishReason: 'stop' }]);
    try {
      await drainStream('gpt-5', 'max', fake.url);
      expect(fake.requests[0].body.reasoning_effort).toBe('high');
    } finally {
      await fake.close();
    }
  });

  it('sends wire max when MOCHI_REASONING_EFFORT_MAX=1', async () => {
    const fake = await startFakeOpenAI([{ content: 'ok', finishReason: 'stop' }]);
    process.env.MOCHI_REASONING_EFFORT_MAX = '1';
    try {
      await drainStream('gpt-5', 'max', fake.url);
      expect(fake.requests[0].body.reasoning_effort).toBe('max');
    } finally {
      await fake.close();
    }
  });

  it('keeps explicit high at high regardless of the opt-in', async () => {
    const fake = await startFakeOpenAI([{ content: 'ok', finishReason: 'stop' }]);
    process.env.MOCHI_REASONING_EFFORT_MAX = '1';
    try {
      await drainStream('gpt-5', 'high', fake.url);
      expect(fake.requests[0].body.reasoning_effort).toBe('high');
    } finally {
      await fake.close();
    }
  });

  it('maps medium/low/off/auto unchanged', async () => {
    const fake = await startFakeOpenAI([
      { sticky: true, respondFn: () => ({ content: 'ok', finishReason: 'stop' }) },
    ]);
    try {
      await drainStream('gpt-5', 'medium', fake.url);
      await drainStream('gpt-5', 'low', fake.url);
      await drainStream('gpt-5', 'off', fake.url);
      await drainStream('gpt-5', 'auto', fake.url);
      expect(fake.requests[0].body.reasoning_effort).toBe('medium');
      expect(fake.requests[1].body.reasoning_effort).toBe('low');
      expect(fake.requests[2].body.reasoning_effort).toBe('low'); // off → low + reasoning.enabled:false
      expect(fake.requests[2].body.reasoning).toEqual({ enabled: false });
      expect('reasoning_effort' in fake.requests[3].body).toBe(false); // auto → send nothing
    } finally {
      await fake.close();
    }
  });
});
