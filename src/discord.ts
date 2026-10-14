// Discord Gateway for Mochi Agent.
// Provides bidirectional communication between Discord channels and Mochi's Runtime engine.
// Supports goal execution, streaming progress updates, status reporting, and mobile notifications.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Runtime } from './runtime.js';

export interface DiscordConfig {
  token: string;
  channelId?: string;
  allowAllUsers?: boolean;
  allowedUserIds?: string[];
  prefix?: string;
}

/** Load Discord bot configuration from environment or .env files */
export function loadDiscordConfig(cwd: string): DiscordConfig | null {
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
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const [k, ...vParts] = trimmed.split('=');
          const v = vParts.join('=').trim().replace(/^['"]|['"]$/g, '');
          if (k && v && !envMap.has(k.trim())) {
            envMap.set(k.trim(), v);
          }
        }
      } catch {}
    }
  }

  const token = envMap.get('DISCORD_BOT_TOKEN') || envMap.get('DISCORD_TOKEN');
  if (!token) return null;

  const channelId = envMap.get('DISCORD_CHANNEL_ID');
  const allowAllUsers = envMap.get('DISCORD_ALLOW_ALL_USERS') === 'true';
  const allowedUserIds = (envMap.get('DISCORD_ALLOWED_USERS') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const prefix = envMap.get('DISCORD_PREFIX') || '!mochi';

  return { token, channelId, allowAllUsers, allowedUserIds, prefix };
}

/** Send a message to a Discord channel via standard Discord REST API */
export async function sendDiscordMessage(
  token: string,
  channelId: string,
  content: string,
  opts: { embed?: Record<string, unknown> } = {}
): Promise<boolean> {
  try {
    const payload: Record<string, unknown> = {
      content: content.slice(0, 2000),
    };
    if (opts.embed) payload.embeds = [opts.embed];

    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/** Process a message event received from Discord webhook or gateway */
export async function handleDiscordMessage(
  msg: { authorId: string; content: string; channelId: string },
  config: DiscordConfig,
  runtime: Runtime
): Promise<string> {
  if (!config.allowAllUsers && config.allowedUserIds && !config.allowedUserIds.includes(msg.authorId)) {
    return 'Unauthorized: You do not have permission to invoke Mochi on this Discord server.';
  }

  const cleanText = msg.content.trim();
  const prefix = config.prefix || '!mochi';
  const prompt = cleanText.startsWith(prefix) ? cleanText.slice(prefix.length).trim() : cleanText;

  if (!prompt || prompt === 'help') {
    return `🍡 **Mochi Discord Gateway**
- \`${prefix} <goal>\` — Execute a coding goal or task.
- \`${prefix} status\` — Show active model, token usage, and daemon health.
- \`${prefix} doctor\` — Run workspace configuration diagnosis.
`;
  }

  if (prompt === 'status') {
    const usage = runtime.usage?.total?.();
    return `📊 **Mochi Status**
- **Model**: \`${runtime.config.model.model}\`
- **Workspace**: \`${runtime.cwd}\`
- **Tokens Used**: ${usage?.tokensIn ?? 0} in / ${usage?.tokensOut ?? 0} out
- **Estimated Cost**: $${(usage?.costUsd ?? 0).toFixed(4)} USD
`;
  }

  if (prompt === 'doctor') {
    const out = typeof runtime.inspect === 'function' ? String(await runtime.inspect('doctor')) : 'Doctor completed.';
    return `🩺 **Mochi Doctor**\n\`\`\`\n${out.slice(0, 1800)}\n\`\`\``;
  }

  // Execute goal through runtime
  try {
    const result = await runtime.goal(prompt);
    return `✅ **Task Completed**\n\n${result.slice(0, 1900)}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `❌ **Task Failed**: ${message.slice(0, 1800)}`;
  }
}

// ─── Live gateway (mochi discord run) ───────────────────────────────────────
// Zero-dependency Discord Gateway v10 client: the transport arrives injected
// (production wraps the global WebSocket), so tests drive the full handshake
// with a scripted socket and never touch the network. Handles Hello Hook +
// Identify + heartbeats, READY/MESSAGE_CREATE dispatch, and bounded
// reconnect with backoff. Only messages that mention the bot or start with
// the prefix get answers (the raw handler below answers anything — the
// gateway must not narrate every channel message).

/** Minimal socket surface the gateway needs (global WebSocket satisfies it). */
export interface GatewaySocket {
  send(text: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((data: string) => void) | null;
  onclose: (() => void) | null;
  onerror: ((err: unknown) => void) | null;
}

export interface GatewayRunOpts {
  /** Build a socket for the gateway URL (production: wrap global WebSocket). */
  createSocket: (url: string) => GatewaySocket;
  /** JSON GET/POST (production: global fetch; tests stub it). */
  fetchJson?: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  /** Send one reply chunk (production: sendDiscordMessage with the token). */
  send?: (channelId: string, text: string) => Promise<boolean>;
  onLog?: (line: string) => void;
  /** Abort reconnection (production: SIGINT hook in cli.ts). */
  signal?: AbortSignal;
  sleepMs?: (ms: number) => Promise<void>;
  /** Reconnect cap (tests bind it; production leaves it unlimited). */
  maxReconnects?: number;
}

export interface GatewayRunSummary {
  reconnects: number;
  messages: number;
  stopped: boolean;
}

/** Intents: guilds + guild messages + DMs + message content (privileged —
 *  enable "Message Content Intent" in the dev portal or bodies arrive empty
 *  and only mentions/prefix matching on empty text applies). */
export const GATEWAY_INTENTS = 1 | 512 | 4096 | 32768;

/** Split a reply into ≤2000-char Discord chunks on newline boundaries. Pure. */
export function chunkMessage(text: string, limit = 2000): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit);
    if (cut <= 0) cut = limit;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  if (rest) chunks.push(rest);
  return chunks;
}

interface GatewayFrame {
  op: number;
  d?: any;
  s?: number | null;
  t?: string | null;
}

export async function runDiscordGateway(
  cfg: DiscordConfig,
  runtime: Runtime,
  opts: GatewayRunOpts,
): Promise<GatewayRunSummary> {
  const fetchJson = opts.fetchJson ?? (async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    return { ok: res.ok, status: res.status, json: () => res.json() as Promise<unknown> };
  });
  const send = opts.send ?? ((channelId: string, text: string) => sendDiscordMessage(cfg.token, channelId, text));
  const log = opts.onLog ?? (() => {});
  const sleepMs = opts.sleepMs ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxReconnects = opts.maxReconnects ?? Number.MAX_SAFE_INTEGER;
  const prefix = cfg.prefix || '!mochi';

  let reconnects = 0;
  let messages = 0;

  for (;;) {
    if (opts.signal?.aborted) return { reconnects, messages, stopped: true };
    // 1. Discover the gateway URL (authenticated).
    let gatewayUrl: string;
    try {
      const res = await fetchJson('https://discord.com/api/v10/gateway/bot', {
        headers: { Authorization: `Bot ${cfg.token}` },
      });
      if (!res.ok) {
        log(`discord: gateway discovery failed (HTTP ${res.status}) — check the bot token.`);
        return { reconnects, messages, stopped: false };
      }
      const body = (await res.json()) as { url?: unknown };
      if (typeof body.url !== 'string') {
        log('discord: gateway discovery response malformed (no url).');
        return { reconnects, messages, stopped: false };
      }
      gatewayUrl = `${body.url}/?v=10&encoding=json`;
    } catch (e) {
      log(`discord: gateway discovery error (${e instanceof Error ? e.message : String(e)}).`);
      return { reconnects, messages, stopped: false };
    }

    // 2. Connect + handshake. Everything below resolves when this connection
    //    closes; the outer loop then reconnects with backoff.
    const closed = await new Promise<boolean>((resolveClosed) => {
      let seq: number | null = null;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let botId = '';
      let settled = false;
      const done = (v: boolean) => { if (!settled) { settled = true; resolveClosed(v); } };
      let socket: GatewaySocket;
      try {
        socket = opts.createSocket(gatewayUrl);
      } catch (e) {
        log(`discord: socket creation failed (${e instanceof Error ? e.message : String(e)}).`);
        done(false);
        return;
      }
      const stopHeartbeat = () => { if (heartbeat !== undefined) { clearInterval(heartbeat); heartbeat = undefined; } };
      const closeSocket = () => { try { socket.close(); } catch { /* already dead */ } };
      if (opts.signal) {
        const onAbort = () => { stopHeartbeat(); closeSocket(); done(true); };
        if (opts.signal.aborted) { done(true); return; }
        opts.signal.addEventListener('abort', onAbort, { once: true });
      }
      socket.onopen = () => { log('discord: socket open, waiting for Hello.'); };
      socket.onerror = (e) => { log(`discord: socket error (${String(e).slice(0, 120)}).`); };
      socket.onclose = () => { stopHeartbeat(); done(false); };
      socket.onmessage = (raw: string) => {
        let frame: GatewayFrame;
        try {
          frame = JSON.parse(raw) as GatewayFrame;
        } catch { return; }
        if (typeof frame.s === 'number') seq = frame.s;
        if (frame.op === 10) {
          // Hello: identify, then heartbeat on the advertised interval.
          const interval = typeof frame.d?.heartbeat_interval === 'number' ? frame.d.heartbeat_interval : 45000;
          try {
            socket.send(JSON.stringify({
              op: 2,
              d: {
                token: cfg.token,
                intents: GATEWAY_INTENTS,
                properties: { os: process.platform, browser: 'mochi', device: 'mochi' },
              },
            }));
          } catch (e) {
            log(`discord: identify failed (${e instanceof Error ? e.message : String(e)}).`);
            stopHeartbeat(); closeSocket(); done(false); return;
          }
          heartbeat = setInterval(() => {
            try {
              socket.send(JSON.stringify({ op: 1, d: seq }));
            } catch { /* a dead socket surfaces via onclose */ }
          }, interval);
          if (typeof (heartbeat as unknown as { unref?: () => void }).unref === 'function') {
            (heartbeat as unknown as { unref: () => void }).unref();
          }
        } else if (frame.op === 11) {
          // Heartbeat ACK — alive; nothing to do.
        } else if (frame.op === 0 && frame.t === 'READY') {
          botId = String(frame.d?.user?.id ?? '');
          log(`discord: ready as ${String(frame.d?.user?.username ?? 'bot')}.`);
        } else if (frame.op === 0 && frame.t === 'MESSAGE_CREATE') {
          const d = frame.d ?? {};
          const author = d.author ?? {};
          if (author.bot) return;
          const content = String(d.content ?? '');
          const channelId = String(d.channel_id ?? '');
          if (!channelId) return;
          const mentioned = botId !== '' && (content.includes(`<@${botId}>`) || content.includes(`<@!${botId}>`));
          if (!content.startsWith(prefix) && !mentioned) return; // stay quiet otherwise
          const prompt = mentioned && !content.startsWith(prefix)
            ? content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim()
            : content;
          messages++;
          void (async () => {
            try {
              const reply = await handleDiscordMessage({ authorId: String(author.id ?? ''), content: prompt, channelId }, cfg, runtime);
              for (const chunk of chunkMessage(reply)) {
                const ok = await send(channelId, chunk);
                if (!ok) { log('discord: reply chunk failed to send.'); break; }
              }
            } catch (e) {
              log(`discord: handler error (${e instanceof Error ? e.message : String(e)}).`);
            }
          })();
        } else if (frame.op === 9) {
          // Invalid session: wait and reconnect fresh (no resume support).
          log('discord: invalid session, reconnecting.');
          stopHeartbeat(); closeSocket(); done(false);
        }
      };
    });

    if (closed) return { reconnects, messages, stopped: true };
    reconnects++;
    if (reconnects > maxReconnects) {
      log(`discord: reconnect cap (${maxReconnects}) reached, stopping.`);
      return { reconnects: reconnects - 1, messages, stopped: false };
    }
    const backoff = Math.min(1000 * 2 ** (reconnects - 1), 30000);
    log(`discord: reconnecting in ${backoff}ms (attempt ${reconnects}).`);
    await sleepMs(backoff);
  }
}
