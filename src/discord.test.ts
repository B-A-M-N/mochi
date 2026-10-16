import { describe, expect, it, vi } from 'vitest';
import { handleDiscordMessage, loadDiscordConfig, runDiscordGateway, chunkMessage, GATEWAY_INTENTS, type DiscordConfig, type GatewaySocket } from './discord.js';
import type { Runtime } from './runtime.js';

/** Scripted in-memory socket: the test drives inbound frames, captures outbound. */
function fakeSocketBox() {
  const sent: string[] = [];
  let closed = false;
  const box: { sock: GatewaySocket; sent: string[]; closed: () => boolean; inbound: (obj: unknown) => void; end: () => void } = {
    sent,
    closed: () => closed,
    sock: {
      send: (t: string) => { sent.push(t); },
      close: () => { closed = true; box.sock.onclose?.(); },
      onopen: null, onmessage: null, onclose: null, onerror: null,
    },
    inbound: (obj: unknown) => { box.sock.onmessage?.(JSON.stringify(obj)); },
    end: () => { box.sock.onclose?.(); },
  };
  return box;
}

function fakeFetch(gatewayUrl = 'wss://fake.discord'): (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  return async () => ({ ok: true, status: 200, json: async () => ({ url: gatewayUrl }) });
}

describe('Discord Gateway', () => {
  it('loads Discord configuration from environment', () => {
    const orig = process.env.DISCORD_BOT_TOKEN;
    process.env.DISCORD_BOT_TOKEN = 'test-token-123';
    process.env.DISCORD_ALLOW_ALL_USERS = 'true';

    const cfg = loadDiscordConfig('/tmp');
    expect(cfg).not.toBeNull();
    expect(cfg?.token).toBe('test-token-123');
    expect(cfg?.allowAllUsers).toBe(true);

    if (orig) process.env.DISCORD_BOT_TOKEN = orig;
    else delete process.env.DISCORD_BOT_TOKEN;
  });

  it('rejects unauthorized users when allowAllUsers is false', async () => {
    const cfg: DiscordConfig = {
      token: 'tok',
      allowAllUsers: false,
      allowedUserIds: ['user-1'],
    };
    const runtime = {} as any;

    const res = await handleDiscordMessage(
      { authorId: 'unauthorized-user', content: '!mochi test', channelId: 'c1' },
      cfg,
      runtime
    );
    expect(res).toContain('Unauthorized');
  });

  it('handles help and status commands cleanly', async () => {
    const cfg: DiscordConfig = {
      token: 'tok',
      allowAllUsers: true,
      prefix: '!mochi',
    };
    const runtime: any = {
      config: { model: { model: 'deepseek-v4' } },
      cwd: '/home/user/app',
      usage: {
        total: () => ({ tokensIn: 100, tokensOut: 50, costUsd: 0.002 }),
      },
    };

    const helpRes = await handleDiscordMessage(
      { authorId: 'u1', content: '!mochi help', channelId: 'c1' },
      cfg,
      runtime
    );
    expect(helpRes).toContain('Mochi Discord Gateway');

    const statusRes = await handleDiscordMessage(
      { authorId: 'u1', content: '!mochi status', channelId: 'c1' },
      cfg,
      runtime
    );
    expect(statusRes).toContain('deepseek-v4');
    expect(statusRes).toContain('Tokens Used');
  });

  it('routes user goal to runtime and returns formatted response', async () => {
    const cfg: DiscordConfig = {
      token: 'tok',
      allowAllUsers: true,
      prefix: '!mochi',
    };
    const runtime: any = {
      goal: vi.fn().mockResolvedValue('Created src/index.ts and passed all tests.'),
    };

    const goalRes = await handleDiscordMessage(
      { authorId: 'u1', content: '!mochi write a hello world script', channelId: 'c1' },
      cfg,
      runtime
    );
    expect(goalRes).toContain('Task Completed');
    expect(goalRes).toContain('Created src/index.ts');
  });
});

describe('Discord live gateway (scripted socket, no network)', () => {
  const cfg: DiscordConfig = { token: 'tok', allowAllUsers: true, prefix: '!mochi' };

  it('handshakes (Hello → Identify) and heartbeats on the advertised interval', async () => {
    const box = fakeSocketBox();
    const runtime = { goal: vi.fn() } as any;
    const run = runDiscordGateway(cfg, runtime, {
      createSocket: () => box.sock,
      fetchJson: fakeFetch(),
      send: async () => true,
      sleepMs: async () => {},
      maxReconnects: 0,
      signal: (() => { const c = new AbortController(); return c.signal; })(),
    });
    await new Promise((r) => setTimeout(r, 15)); // let the async connect run
    box.sock.onopen?.();
    box.inbound({ op: 10, d: { heartbeat_interval: 25 } });
    await new Promise((r) => setTimeout(r, 80));
    const ops = box.sent.map((s) => (JSON.parse(s) as { op: number }).op);
    expect(ops[0]).toBe(2); // Identify first
    const identify = JSON.parse(box.sent[0]) as { d: { token: string; intents: number } };
    expect(identify.d.intents).toBe(GATEWAY_INTENTS);
    expect(ops).toContain(1); // heartbeat fired on the 25ms interval
    box.end();
    const summary = await run;
    expect(summary.stopped).toBe(false);
  });

  it('answers prefixed messages and ignores chatter + bot authors', async () => {
    const box = fakeSocketBox();
    const replies: string[] = [];
    const runtime = { goal: vi.fn().mockResolvedValue('done-ok') } as any;
    const run = runDiscordGateway(cfg, runtime, {
      createSocket: () => box.sock,
      fetchJson: fakeFetch(),
      send: async (ch: string, text: string) => { replies.push(`${ch}:${text.slice(0, 20)}`); return true; },
      sleepMs: async () => {},
      maxReconnects: 0,
    });
    await new Promise((r) => setTimeout(r, 15)); // let the async connect run
    box.sock.onopen?.();
    box.inbound({ op: 10, d: { heartbeat_interval: 60_000 } });
    box.inbound({ op: 0, s: 1, t: 'READY', d: { user: { id: 'bot-9', username: 'mochi' } } });
    box.inbound({ op: 0, s: 2, t: 'MESSAGE_CREATE', d: { author: { id: 'bot-9', bot: true }, content: '!mochi hi', channel_id: 'c1' } });
    box.inbound({ op: 0, s: 3, t: 'MESSAGE_CREATE', d: { author: { id: 'u1' }, content: 'just chatting here', channel_id: 'c1' } });
    box.inbound({ op: 0, s: 4, t: 'MESSAGE_CREATE', d: { author: { id: 'u1' }, content: '!mochi build it', channel_id: 'c1' } });
    box.inbound({ op: 0, s: 5, t: 'MESSAGE_CREATE', d: { author: { id: 'u2' }, content: 'hey <@bot-9> help me', channel_id: 'c2' } });
    await new Promise((r) => setTimeout(r, 60));
    expect(runtime.goal).toHaveBeenCalledTimes(2);
    expect(replies.length).toBe(2);
    box.end();
    await run;
  });

  it('reconnects with backoff after a drop, bounded by maxReconnects', async () => {
    let sockets = 0;
    const sleeps: number[] = [];
    const runtime = { goal: vi.fn() } as any;
    const run = runDiscordGateway(cfg, runtime, {
      createSocket: () => {
        sockets++;
        const box = fakeSocketBox();
        queueMicrotask(() => {
          box.sock.onopen?.();
          box.inbound({ op: 10, d: { heartbeat_interval: 60_000 } });
          box.end(); // drop immediately
        });
        return box.sock;
      },
      fetchJson: fakeFetch(),
      send: async () => true,
      sleepMs: async (ms: number) => { sleeps.push(ms); },
      maxReconnects: 2,
    });
    const summary = await run;
    expect(sockets).toBe(3); // initial + 2 reconnects
    expect(summary.reconnects).toBe(2);
    expect(sleeps).toEqual([1000, 2000]);
  });

  it('stops cleanly on abort without reconnecting', async () => {
    const ctl = new AbortController();
    let sockets = 0;
    const runtime = { goal: vi.fn() } as any;
    const run = runDiscordGateway(cfg, runtime, {
      createSocket: () => { sockets++; return fakeSocketBox().sock; },
      fetchJson: fakeFetch(),
      send: async () => true,
      sleepMs: async () => {},
      maxReconnects: 5,
      signal: ctl.signal,
    });
    await new Promise((r) => setTimeout(r, 20));
    ctl.abort();
    const summary = await run;
    expect(summary.stopped).toBe(true);
    expect(sockets).toBe(1);
  });

  it('refuses to start when gateway discovery rejects the token', async () => {
    const runtime = { goal: vi.fn() } as any;
    let sockets = 0;
    const summary = await runDiscordGateway(cfg, runtime, {
      createSocket: () => { sockets++; return fakeSocketBox().sock; },
      fetchJson: async () => ({ ok: false, status: 401, json: async () => ({}) }),
      send: async () => true,
      sleepMs: async () => {},
    });
    expect(sockets).toBe(0);
    expect(summary.messages).toBe(0);
  });

  it('spins up a thread for goals, shows typing, and adds reactions', async () => {
    const box = fakeSocketBox();
    const runtime = { goal: vi.fn().mockResolvedValue('Done building feature') } as unknown as Runtime;
    const sentChunks: Array<{ channelId: string; text: string }> = [];
    const threadsCreated: Array<{ channelId: string; messageId: string; name: string }> = [];
    const reactionsAdded: Array<{ channelId: string; messageId: string; emoji: string }> = [];
    const typingChannels: string[] = [];
    const ctl = new AbortController();
    const { promise: socketCreated, resolve: resolveSocket } = Promise.withResolvers<void>();
    const { promise: replySent, resolve: resolveReply } = Promise.withResolvers<void>();

    const run = runDiscordGateway(cfg, runtime, {
      createSocket: () => {
        resolveSocket();
        return box.sock;
      },
      fetchJson: fakeFetch(),
      send: async (channelId, text) => {
        sentChunks.push({ channelId, text });
        resolveReply();
        return true;
      },
      createThread: async (channelId, messageId, name) => {
        threadsCreated.push({ channelId, messageId, name });
        return 'thread-999';
      },
      addReaction: async (channelId, messageId, emoji) => {
        reactionsAdded.push({ channelId, messageId, emoji });
        return true;
      },
      triggerTyping: async (channelId) => {
        typingChannels.push(channelId);
        return true;
      },
      sleepMs: async () => {},
      signal: ctl.signal,
    });

    await socketCreated;
    box.sock.onopen?.();
    box.inbound({ op: 10, d: { heartbeat_interval: 60000 } });
    box.inbound({ op: 0, t: 'READY', d: { user: { id: 'bot-1', username: 'mochi-bot' } } });

    box.inbound({
      op: 0,
      t: 'MESSAGE_CREATE',
      d: {
        id: 'msg-123',
        channel_id: 'chan-456',
        guild_id: 'guild-789',
        content: '!mochi build a rate limiter',
        author: { id: 'u1', username: 'alice' },
      },
    });

    await replySent;
    ctl.abort();
    await run;

    expect(threadsCreated).toHaveLength(1);
    expect(threadsCreated[0]).toEqual({
      channelId: 'chan-456',
      messageId: 'msg-123',
      name: '🍡 build a rate limiter',
    });
    expect(reactionsAdded).toContainEqual({ channelId: 'chan-456', messageId: 'msg-123', emoji: '👀' });
    expect(reactionsAdded).toContainEqual({ channelId: 'chan-456', messageId: 'msg-123', emoji: '✅' });
    expect(typingChannels).toContain('thread-999');
    expect(sentChunks.some((c) => c.channelId === 'thread-999' && c.text.includes('Done building feature'))).toBe(true);
  });
});

describe('chunkMessage (Discord 2000-char cap)', () => {
  it('passes short replies through untouched', () => {
    expect(chunkMessage('hi')).toEqual(['hi']);
  });

  it('splits long replies on newline boundaries without loss', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line-${i}-pad-to-make-this-longer`);
    const text = lines.join('\n');
    const chunks = chunkMessage(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 2000)).toBe(true);
    expect(chunks.join('\n')).toBe(text);
  });
});
