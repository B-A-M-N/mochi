import { describe, it, expect } from 'vitest';
import { loadBlueBubblesConfig, parseBlueBubblesMessages, sendBlueBubblesMessage, handleBlueBubblesMessage } from './bluebubbles.js';

const FAKE_CWD = process.cwd();

describe('bluebubbles config', () => {
  it('loads from env', () => {
    const prevUrl = process.env.BLUEBUBBLES_SERVER_URL;
    const prevPw = process.env.BLUEBUBBLES_PASSWORD;
    process.env.BLUEBUBBLES_SERVER_URL = 'http://127.0.0.1:1234/';
    process.env.BLUEBUBBLES_PASSWORD = 'secret';
    const cfg = loadBlueBubblesConfig(FAKE_CWD);
    expect(cfg?.serverUrl).toBe('http://127.0.0.1:1234');
    expect(cfg?.password).toBe('secret');
    if (prevUrl === undefined) delete process.env.BLUEBUBBLES_SERVER_URL; else process.env.BLUEBUBBLES_SERVER_URL = prevUrl;
    if (prevPw === undefined) delete process.env.BLUEBUBBLES_PASSWORD; else process.env.BLUEBUBBLES_PASSWORD = prevPw;
  });

  it('returns null without url/password', () => {
    const prevUrl = process.env.BLUEBUBBLES_SERVER_URL;
    const prevPw = process.env.BLUEBUBBLES_PASSWORD;
    delete process.env.BLUEBUBBLES_SERVER_URL;
    delete process.env.BLUEBUBBLES_PASSWORD;
    expect(loadBlueBubblesConfig(FAKE_CWD)).toBeNull();
    if (prevUrl !== undefined) process.env.BLUEBUBBLES_SERVER_URL = prevUrl;
    if (prevPw !== undefined) process.env.BLUEBUBBLES_PASSWORD = prevPw;
  });
});

describe('bluebubbles parse', () => {
  it('parses messages', () => {
    const out = parseBlueBubblesMessages({
      data: [
        { rowid: 7, text: 'hi', isFromMe: false, handle: { address: '+1555' }, chats: [{ guid: 'iMessage;-;+1555' }] },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ rowid: 7, text: 'hi', sender: '+1555', chatGuid: 'iMessage;-;+1555', isFromMe: false });
  });

  it('returns empty for malformed body', () => {
    expect(parseBlueBubblesMessages(null)).toEqual([]);
  });
});

describe('bluebubbles send', () => {
  it('posts to message/text and returns ok', async () => {
    let captured: { url?: string; body?: string } = {};
    const fetchJson = async (url: string, init?: RequestInit) => {
      captured.url = url;
      captured.body = String(init?.body ?? '');
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const ok = await sendBlueBubblesMessage({ serverUrl: 'http://x', password: 'pw', prefix: '/ask' }, 'chat-1', 'hello', fetchJson as never);
    expect(ok).toBe(true);
    expect(captured.url).toContain('/api/v1/message/text');
    expect(captured.url).toContain('password=pw');
    expect(captured.body).toContain('"chatGuid":"chat-1"');
  });
});

describe('bluebubbles handle', () => {
  it('returns help for empty prompt', async () => {
    const runtime: any = { config: { model: { model: 'gpt-4o' } }, usage: { total: () => ({ tokensIn: 0, tokensOut: 0, costUsd: 0 }) }, goal: async () => 'done' };
    const reply = await handleBlueBubblesMessage({ authorId: '+1555', text: '/ask help', chatGuid: 'c' }, { serverUrl: 'http://x', password: 'pw', prefix: '/ask', allowAllUsers: true }, runtime);
    expect(reply).toContain('BlueBubbles');
  });
});