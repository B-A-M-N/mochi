// Slack gateway for Mochi — zero-dep third-party messaging surface beyond
// the Slack MCP entry (which only lets other agents drive Slack through a
// tool). This one is a native gateway like Discord/Telegram: Web API
// (conversations.history + chat.postMessage) with an injected `fetch` so unit
// tests drive it against scripted responses without touching the network.
// Transport is poll-based (channels history w/ cursor) — Slack's Events API
// needs a public URL and a registered app manifest, while this needs only a
// bot token + at least one channel id, which is a one-click setup.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Runtime } from './runtime.js';

export interface SlackConfig {
  token: string;
  channels: string[];
  allowedUserIds?: string[];
  prefix?: string;
}

interface HttpLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

const SLACK_AUTH_RE = /^xox[bapsr]-[A-Za-z0-9-]+$/;

/** Load Slack bot config from env/.env (same search order as Discord). */
export function loadSlackConfig(cwd: string): SlackConfig | null {
  const envPaths = [
    resolve(cwd, '.env'),
    resolve(cwd, '.mochi', '.env'),
    resolve(homedir(), '.mochi', '.env'),
    resolve(homedir(), '.hermes', '.env'),
  ];
  const envMap = new Map<string, string>();
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) envMap.set(k, v);
  }
  for (const p of envPaths) {
    if (!existsSync(p)) continue;
    try {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [k, ...rest] = trimmed.split('=');
        const v = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
        if (k && v && !envMap.has(k.trim())) envMap.set(k.trim(), v);
      }
    } catch { /* skip unreadable env file */ }
  }
  const token = envMap.get('SLACK_BOT_TOKEN');
  if (!token) return null;
  if (!SLACK_AUTH_RE.test(token)) return null;
  const channels = (envMap.get('SLACK_CHANNEL') || envMap.get('SLACK_CHANNELS') || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (!channels.length) return null;
  const allowedUserIds = (envMap.get('SLACK_ALLOWED_USERS') || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const prefix = envMap.get('SLACK_PREFIX') || '/ask';
  return { token, channels, allowedUserIds, prefix };
}

/** Send a message (Slack recommends splitting long text; we cap ~3900). */
export async function sendSlackMessage(
  token: string,
  channel: string,
  text: string,
  fetchJson: (url: string, init?: RequestInit) => Promise<HttpLike> = fetch as never,
): Promise<boolean> {
  try {
    const res = await fetchJson('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, text: text.slice(0, 3900) }),
    });
    const body = (await res.json()) as { ok?: boolean };
    return Boolean(res.ok && body?.ok);
  } catch {
    return false;
  }
}

export interface SlackMessage {
  ts?: string;
  user?: string;
  text?: string;
  subtype?: string;
  bot_id?: string;
}

/** Compose one reply (help / status / goal), mirroring the Discord/Telegram surface. */
export async function handleSlackMessage(
  msg: { authorId: string; text: string; channel: string },
  cfg: SlackConfig,
  runtime: Runtime,
): Promise<string> {
  if (cfg.allowedUserIds && cfg.allowedUserIds.length > 0 && !cfg.allowedUserIds.includes(msg.authorId)) {
    return 'Unauthorized: your Slack account cannot invoke Mochi here.';
  }
  const prefix = cfg.prefix || '/ask';
  const clean = msg.text.trim();
  const usedPrefix = clean.startsWith(prefix);
  const prompt = usedPrefix ? clean.slice(prefix.length).trim() : clean;
  if (!prompt || prompt === 'help') {
    return [
      '🍡 Mochi (Slack)',
      `${prefix} <goal> — run a coding task`,
      `${prefix} status — model, tokens, cost`,
      `${prefix} help — this message`,
    ].join('\n');
  }
  if (prompt === 'status') {
    const u = runtime.usage?.total?.() ?? { tokensIn: 0, tokensOut: 0, costUsd: 0 };
    return [
      '📊 Mochi status',
      `Model: ${runtime.config.model.model}`,
      `Tokens: ${u.tokensIn ?? 0} in / ${u.tokensOut ?? 0} out`,
      `Cost: $${(u.costUsd ?? 0).toFixed(4)}`,
    ].join('\n');
  }
  if (!usedPrefix) return '';
  try {
    const result = await runtime.goal(prompt);
    return `✅ ${result.slice(0, 3800)}`;
  } catch (err) {
    return `❌ Failed: ${(err instanceof Error ? err.message : String(err)).slice(0, 1800)}`;
  }
}

export interface SlackRunOpts {
  fetchJson: (url: string, init?: RequestInit) => Promise<HttpLike>;
  send?: (channel: string, text: string) => Promise<boolean>;
  onLog?: (line: string) => void;
  signal?: AbortSignal;
  sleepMs?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
  maxIterations?: number;
}

export interface SlackRunSummary { messages: number; updates: number; stopped: boolean }

/** Poll loop over each configured channel. Stops on abort, /stop text, or cap. */
export async function runSlackGateway(
  cfg: SlackConfig,
  runtime: Runtime,
  opts: SlackRunOpts,
): Promise<SlackRunSummary> {
  const fetchJson = opts.fetchJson;
  const send = opts.send ?? ((channel: string, text: string) => sendSlackMessage(cfg.token, channel, text, fetchJson));
  const log = opts.onLog ?? (() => {});
  const sleepMs = opts.sleepMs ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxIterations = opts.maxIterations ?? Number.MAX_SAFE_INTEGER;
  const prefix = cfg.prefix || '/ask';
  const since: Record<string, string> = {};
  for (const ch of cfg.channels) since[ch] = (Date.now() / 1000).toFixed(6);

  let messages = 0;
  let updates = 0;
  for (let i = 0; i < maxIterations; i++) {
    if (opts.signal?.aborted) return { messages, updates, stopped: true };
    for (const channel of cfg.channels) {
      try {
        const url = `https://slack.com/api/conversations.history?channel=${encodeURIComponent(channel)}&oldest=${since[channel]}`;
        const res = await fetchJson(url, {
          method: 'GET',
          headers: { authorization: `Bearer ${cfg.token}` },
        });
        if (!res.ok) { log(`slack: history HTTP ${res.status} (channel ${channel}).`); continue; }
        const body = (await res.json()) as { ok?: boolean; messages?: SlackMessage[]; error?: string };
        if (body.ok === false) { log(`slack: history error ${body.error ?? 'unknown'} — channel ${channel}.`); continue; }
        const msgs = Array.isArray(body.messages) ? body.messages : [];
        for (const m of msgs) {
          if (!m || !m.ts || !m.text) continue;
          if (m.bot_id || m.subtype === 'bot_message') continue;
          if (Number(m.ts) <= Number(since[channel])) continue;
          updates++;
          if (m.text.trim() === '/stop') {
            log('slack: stop requested by operator.');
            return { messages, updates, stopped: true };
          }
          const isPrefix = m.text.trim().startsWith(prefix);
          if (!isPrefix && !m.text.trim().startsWith('/ask')) continue;
          messages++;
          const reply = await handleSlackMessage(
            { authorId: String(m.user ?? ''), text: m.text, channel },
            cfg, runtime,
          );
          if (!reply) continue;
          const ok = await send(channel, reply);
          if (!ok) log(`slack: chat.postMessage failed for channel ${channel}.`);
          since[channel] = m.ts;
        }
        if (msgs.length > 0) {
          const latest = msgs.map((m) => (m.ts ? Number(m.ts) : 0)).reduce((a, b) => Math.max(a, b), 0);
          if (latest > Number(since[channel])) since[channel] = latest.toFixed(6);
        }
      } catch (e) {
        log(`slack: poll error (${e instanceof Error ? e.message : String(e)}).`);
      }
    }
    await sleepMs(opts.pollIntervalMs ?? 5000);
  }
  return { messages, updates, stopped: false };
}
