// Telegram gateway hardening: parsing against real-shaped API fixtures.
import { describe, expect, it } from 'vitest';
import { runTelegramGateway, type TelegramUpdate } from './telegram.js';

describe('Telegram gateway hardening — real-shaped fixtures', () => {
  const cfg: any = { token: 'tok', allowAllUsers: true, prefix: '/ask' };

  it('parses a real getUpdates fixture (groups, negative chat, utf8, reply markup-less)', async () => {
    const fixture: TelegramUpdate[] = [
      { update_id: 100,
        message: { message_id: 1, chat: { id: -1001234567890, type: 'supergroup' }, from: { id: 42, is_bot: false, username: 'alice' }, text: '/ask describe this payload привет' } },
      { update_id: 101,
        message: { message_id: 2, chat: { id: -1001234567890, type: 'supergroup' }, from: { id: 42, is_bot: false }, text: 'unprefixed chatter' } },
      { update_id: 102,
        edited_message: { message_id: 3, chat: { id: 99 }, from: { id: 7 }, text: '/ask updated goal' } },
      { update_id: 103,
        channel_post: { message_id: 4, chat: { id: -100999 }, text: '/ask channel only' } },
    ];
    let poll = 0;
    const replies: { chat: string; body: string }[] = [];
    const runtime: any = { goal: async (q: string) => `r:${q}`, config: { model: { model: 'm' } }, usage: { total: () => ({ tokensIn: 0, tokensOut: 0, costUsd: 0 }) } };
    const summary = await runTelegramGateway(cfg, runtime, {
      fetchJson: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, result: poll++ === 0 ? fixture : [] }) } as any),
      send: async (chat: string, text: string) => { replies.push({ chat, body: text }); return true; },
      sleepMs: async () => {},
      maxIterations: 2,
    });
    // Expect routed goals: update 100, 102, 103 (101 is unprefixed chatter).
    expect(summary.updates).toBe(4);
    expect(replies.length).toBe(3);
    expect(replies.some((r) => r.body.includes('привет'))).toBe(true);
    expect(replies.some((r) => r.body.includes('updated goal'))).toBe(true);
    expect(replies.some((r) => r.body.includes('channel only'))).toBe(true);
  });

  it('does not crash on malformed/off-spec update entries', async () => {
    const garbage = [
      null,
      { update_id: 'str' },
      { update_id: 200, message: null },
      { update_id: 201, message: { chat: { id: 1 } } }, // no text
      { update_id: 202, message: { chat: { id: 2 }, from: { id: 3, is_bot: true }, text: '/ask bot' } },
    ] as any;
    const runtime: any = { goal: async (q: string) => q, config: { model: { model: 'm' } }, usage: { total: () => ({}) } };
    const summary = await runTelegramGateway(cfg, runtime, {
      fetchJson: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, result: garbage }) } as any),
      send: async () => true,
      sleepMs: async () => {},
      maxIterations: 1,
    });
    expect(summary.updates).toBe(4);
    // Only valid prefixed human update(s) routed; here none -> 0 messages.
    expect(summary.messages).toBe(0);
  });
});
