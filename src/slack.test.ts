import { describe, expect, it, vi } from 'vitest';
import { loadSlackConfig, handleSlackMessage, runSlackGateway } from './slack.js';

describe('Slack gateway', () => {
  it('loads config from env', () => {
    const orig = process.env.SLACK_BOT_TOKEN;
    const origC = process.env.SLACK_CHANNEL;
    process.env.SLACK_BOT_TOKEN = 'xoxb-123';
    process.env.SLACK_CHANNEL = 'C1';
    const c = loadSlackConfig('/tmp');
    expect(c?.channels).toEqual(['C1']);
    expect(c?.prefix).toBe('/ask');
    if (orig) process.env.SLACK_BOT_TOKEN = orig; else delete process.env.SLACK_BOT_TOKEN;
    if (origC) process.env.SLACK_CHANNEL = origC; else delete process.env.SLACK_CHANNEL;
  });

  it('requires a channel id', () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-123';
    delete process.env.SLACK_CHANNEL;
    delete process.env.SLACK_CHANNELS;
    expect(loadSlackConfig('/tmp')).toBeNull();
  });

  it('handles help/status and goals', async () => {
    const cfg: any = { token: 'xoxb', channels: ['C'], allowedUserIds: [], prefix: '/ask' };
    const runtime: any = { config: { model: { model: 'm' } }, usage: { total: () => ({ tokensIn: 1, tokensOut: 2, costUsd: 0.01 }) }, goal: vi.fn().mockResolvedValue('done') };
    const help = await handleSlackMessage({ authorId: 'u', text: '/ask help', channel: 'C' }, cfg, runtime);
    expect(help).toContain('Mochi (Slack)');
    const status = await handleSlackMessage({ authorId: 'u', text: '/ask status', channel: 'C' }, cfg, runtime);
    expect(status).toContain('m');
    const goal = await handleSlackMessage({ authorId: 'u', text: '/ask make it', channel: 'C' }, cfg, runtime);
    expect(runtime.goal).toHaveBeenCalledWith('make it');
    expect(goal).toContain('done');
  });

  it('stays quiet on unprefixed chat', async () => {
    const cfg: any = { token: 'xoxb', channels: ['C'], allowedUserIds: [], prefix: '/ask' };
    const runtime: any = { goal: vi.fn() };
    const r = await handleSlackMessage({ authorId: 'u', text: 'random chatter', channel: 'C' }, cfg, runtime);
    expect(r).toBe('');
    expect(runtime.goal).not.toHaveBeenCalled();
  });

  it('polls and answers prefixed messages', async () => {
    const cfg: any = { token: 'xoxb', channels: ['C9'], allowedUserIds: [], prefix: '/ask' };
    const runtime: any = { goal: vi.fn().mockResolvedValue('r'), config: { model: { model: 'm' } }, usage: { total: () => ({ tokensIn: 0, tokensOut: 0, costUsd: 0 }) } };
    let polls = 0;
    const t1 = (Date.now() / 1000 + 500).toFixed(6);
    const t2 = (Date.now() / 1000 + 501).toFixed(6);
    const batches: any[] = [ [ { ts: t1, user: 'U1', text: '/ask hi' }, { ts: t2, user: 'U2', text: 'chatter' } ], [] ];
    let call = 0;
    const summary = await runSlackGateway(cfg, runtime, {
      fetchJson: async (url: string) => ({ ok: true, status: 200, json: async () => ({ ok: true, messages: call++ === 0 ? batches[0] : [] }) }),
      send: async () => true,
      sleepMs: async () => {},
      maxIterations: 2,
      pollIntervalMs: 0,
    });
    expect(runtime.goal).toHaveBeenCalledWith('hi');
    expect(summary.messages).toBe(1);
    expect(summary.updates).toBe(2);
  });

  it('stops on rejected token', async () => {
    const cfg: any = { token: 'xoxb', channels: ['C'], allowedUserIds: [], prefix: '/ask' };
    const summary = await runSlackGateway(cfg, {} as any, {
      fetchJson: async () => ({ ok: false, status: 401, json: async () => ({}) }),
      sleepMs: async () => {},
      maxIterations: 1,
    });
    expect(summary.stopped).toBe(false);
  });
});

describe('Slack webhook helpers', () => {
  it('url_verification challenge echoed', async () => {
    const { handleSlackWebhookChallenge, verifySlackSignature, processSlackEvent } = await import('./slack.js');
    expect(handleSlackWebhookChallenge(JSON.stringify({ type: 'url_verification', challenge: 'xyz' }))).toBe('xyz');
    expect(handleSlackWebhookChallenge(JSON.stringify({ type: 'event_callback' }))).toBeNull();

    // process event dispatches and replies
    const cfg: any = { token: 'x', channels: ['C'], allowedUserIds: [], prefix: '/ask', signingSecret: 's' };
    const runtime: any = { goal: async () => 'done', config: { model: { model: 'm' } }, usage: { total: () => ({ tokensIn: 0, tokensOut: 0, costUsd: 0 }) } };
    const send = vi.fn(async () => true);
    const handled = await processSlackEvent(cfg, runtime, { event: { type: 'message', channel: 'C', user: 'U', text: '/ask hi' } }, { send });
    expect(handled).toBe(true);
    expect(send).toHaveBeenCalled();
  });
});

