// Telegram gateway: long-poll loop, prefix/allowlist policy, routing.
// Scripted transport — no network in tests, same pattern as Discord.
import { describe, expect, it, vi } from 'vitest';
import {
  loadTelegramConfig, handleTelegramMessage, runTelegramGateway,
  type TelegramConfig, type TelegramUpdate,
} from './telegram.js';

type Http = { ok: boolean; status: number; json: () => Promise<unknown> };

const ok = (result: unknown): Http => ({ ok: true, status: 200, json: async () => ({ ok: true, result }) });

function update(id: number, text: string, from = 'u1', chat = 'c1'): TelegramUpdate {
  return { update_id: id, message: { message_id: id, chat: { id: chat }, from: { id: from }, text } };
}

describe('Telegram gateway', () => {
  const cfg: TelegramConfig = { token: 'tok', allowAllUsers: true, prefix: '/ask' };

  it('loads config from the environment', () => {
    const orig = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = 'ttt';
    const c = loadTelegramConfig('/tmp');
    expect(c?.token).toBe('ttt');
    expect(c?.prefix).toBe('/ask');
    if (orig) process.env.TELEGRAM_BOT_TOKEN = orig; else delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it('rejects non-allowlisted users', async () => {
    const restricted: TelegramConfig = { token: 't', allowAllUsers: false, allowedUserIds: ['ok'] };
    const r = await handleTelegramMessage({ authorId: 'nope', text: '/ask hi', chatId: 'c' }, restricted, {} as never);
    expect(r).toContain('Unauthorized');
  });

  it('answers help/status and routes goals to runtime', async () => {
    const runtime: any = { config: { model: { model: 'gpt-4o' } }, usage: { total: () => ({ tokensIn: 5, tokensOut: 3, costUsd: 0.001 }) }, goal: vi.fn().mockResolvedValue('done') };
    expect(await handleTelegramMessage({ authorId: 'u', text: '/ask help', chatId: 'c' }, cfg, runtime)).toContain('Mochi (Telegram)');
    const status = await handleTelegramMessage({ authorId: 'u', text: '/ask status', chatId: 'c' }, cfg, runtime);
    expect(status).toContain('gpt-4o');
    const goal = await handleTelegramMessage({ authorId: 'u', text: '/ask build a script', chatId: 'c' }, cfg, runtime);
    expect(runtime.goal).toHaveBeenCalledWith('build a script');
    expect(goal).toContain('done');
  });

  it('stays quiet on unprefixed channel chatter and failed goals', async () => {
    const runtime: any = { goal: vi.fn().mockRejectedValue(new Error('boom')) };
    expect(await handleTelegramMessage({ authorId: 'u', text: 'hey everyone', chatId: 'c' }, cfg, runtime)).toBe('');
    expect(await handleTelegramMessage({ authorId: 'u', text: '/ask fix it', chatId: 'c' }, cfg, runtime)).toContain('boom');
  });

  it('runs getUpdates, acks offsets, answers prefixed messages only', async () => {
    const batches = [
      [update(1, 'chatter ignored'), update(2, '/ask first task')],
      [update(3, '/ask second task'), update(4, '/stop')],
    ];
    let poll = 0;
    const replies: string[] = [];
    const runtime: any = { goal: vi.fn().mockResolvedValue('r') };
    const summary = await runTelegramGateway(cfg, runtime, {
      fetchJson: async (url: string) => {
        expect(url).toContain('getUpdates');
        expect(url).toContain('offset=');
        return ok(batches[poll++] ?? []);
      },
      send: async (_c: string, text: string) => { replies.push(text); return true; },
      sleepMs: async () => {},
    });
    expect(runtime.goal).toHaveBeenCalledTimes(2);
    expect(replies).toHaveLength(2);
    expect(summary.updates).toBe(4);
    expect(summary.messages).toBe(2);
    expect(summary.stopped).toBe(true);
  });

  it('stops on a rejected token (no silent loop)', async () => {
    const summary = await runTelegramGateway(cfg, {} as never, {
      fetchJson: async () => ({ ok: false, status: 401, json: async () => ({}) }),
      sleepMs: async () => {},
    });
    expect(summary.stopped).toBe(false);
    expect(summary.updates).toBe(0);
  });

  it('honors abort without further polls', async () => {
    const ctl = new AbortController();
    ctl.abort();
    let polls = 0;
    const summary = await runTelegramGateway(cfg, {} as never, {
      fetchJson: async () => { polls++; return ok([]); },
      sleepMs: async () => {},
      signal: ctl.signal,
    });
    expect(polls).toBe(0);
    expect(summary.stopped).toBe(true);
  });
});
