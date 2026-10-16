// Discord Gateway for Mochi Agent.
// Provides bidirectional communication between Discord channels and Mochi's Runtime engine.
// Supports goal execution, streaming progress updates, status reporting, and mobile notifications.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Runtime } from './runtime.js';
import { PROVIDERS } from './model/providers.js';

export interface DiscordConfig {
  token: string;
  channelId?: string;
  allowAllUsers?: boolean;
  allowedUserIds?: string[];
  prefix?: string;
}

/** Canonical Discord Application Slash Commands */
export const DISCORD_SLASH_COMMANDS = [
  {
    name: 'ask',
    description: 'Execute a coding goal or task with Mochi',
    options: [
      {
        name: 'prompt',
        description: 'The task or question for Mochi',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'model',
    description: 'Show or change the active AI model',
    options: [
      {
        name: 'name',
        description: 'Model name (e.g. gemini-3.8-flash, claude-sonnet-4-6, deepseek-ai/DeepSeek-V4.1-Flash)',
        type: 3, // STRING
        required: false,
      },
    ],
  },
  {
    name: 'reasoning',
    description: 'Show or change reasoning depth',
    options: [
      {
        name: 'effort',
        description: 'Reasoning level (low, medium, high, max)',
        type: 3, // STRING
        required: false,
        choices: [
          { name: 'low', value: 'low' },
          { name: 'medium', value: 'medium' },
          { name: 'high', value: 'high' },
          { name: 'max', value: 'max' },
        ],
      },
    ],
  },
  {
    name: 'status',
    description: 'Show Mochi status, active model, tokens, and cost',
  },
  {
    name: 'doctor',
    description: 'Run workspace configuration and health diagnosis',
  },
  {
    name: 'reset',
    description: 'Reset active conversation and goal state',
  },
  {
    name: 'help',
    description: 'Show available Mochi commands and usage',
  },
];

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

/** Spin up a dedicated Discord thread from a message (parity with OMP bot) */
export async function createDiscordThread(
  token: string,
  channelId: string,
  messageId: string,
  name: string,
  fetchJson?: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>,
): Promise<string | undefined> {
  try {
    const threadName = (name || 'Mochi Session').trim().slice(0, 95);
    const doFetch = fetchJson ?? (async (u: string, init?: RequestInit) => {
      const r = await fetch(u, init);
      return { ok: r.ok, status: r.status, json: () => r.json() as Promise<unknown> };
    });
    const res = await doFetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/threads`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: threadName,
        auto_archive_duration: 1440,
      }),
    });
    if (res.ok) {
      const data = await res.json() as { id?: string };
      return data?.id;
    }
  } catch {}
  return undefined;
}

/** Add a reaction emoji to a message (parity with OMP/Hermes bot) */
export async function addDiscordReaction(
  token: string,
  channelId: string,
  messageId: string,
  emoji: string,
  fetchJson?: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number }>,
): Promise<boolean> {
  try {
    const doFetch = fetchJson ?? (async (u: string, init?: RequestInit) => {
      const r = await fetch(u, init);
      return { ok: r.ok, status: r.status };
    });
    const encoded = encodeURIComponent(emoji);
    const res = await doFetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encoded}/@me`, {
      method: 'PUT',
      headers: { Authorization: `Bot ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Trigger typing indicator in a channel or thread */
export async function triggerDiscordTyping(
  token: string,
  channelId: string,
  fetchJson?: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number }>,
): Promise<boolean> {
  try {
    const doFetch = fetchJson ?? (async (u: string, init?: RequestInit) => {
      const r = await fetch(u, init);
      return { ok: r.ok, status: r.status };
    });
    const res = await doFetch(`https://discord.com/api/v10/channels/${channelId}/typing`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Format active model status and fallbacks for Discord display */
export function handleModelStatus(runtime: Runtime): string {
  const current = runtime.config.model;
  const fallbacks = runtime.getFallbacks();
  const fbText = fallbacks.length > 0
    ? fallbacks.map((f, i) => `  ${i + 1}. \`${f.provider}/${f.model}\``).join('\n')
    : '  (none)';

  return [
    `🍡 **Active Model Configuration**`,
    `- **Provider**: \`${current.provider}\``,
    `- **Model**: \`${current.model}\``,
    `- **Reasoning**: \`${runtime.config.reasoning || 'medium'}\``,
    `- **Context Budget**: \`${runtime.config.safety?.contextBudgetTokens ?? 128000}\` tokens`,
    `\n**Configured Fallbacks**:`,
    fbText,
    `\n*Switch model with \`/model <name>\` (e.g. \`/model claude-sonnet-4-6\` or \`/model gemini-3.8-flash\`)*`,
  ].join('\n');
}

/** Switch active model in runtime */
export async function handleModelSwitch(runtime: Runtime, modelQuery: string): Promise<string> {
  const q = modelQuery.trim();
  if (!q) return handleModelStatus(runtime);

  let targetProvider = '';
  let targetModel = '';

  if (q.includes('/')) {
    const slashIdx = q.indexOf('/');
    targetProvider = q.slice(0, slashIdx);
    targetModel = q.slice(slashIdx + 1);
  } else {
    for (const prov of PROVIDERS) {
      if (prov.id.toLowerCase() === q.toLowerCase()) {
        targetProvider = prov.id;
        targetModel = prov.defaultModel;
        break;
      }
      const match = prov.models.find((m) => m.toLowerCase().includes(q.toLowerCase()));
      if (match) {
        targetProvider = prov.id;
        targetModel = match;
        break;
      }
    }
  }

  if (!targetProvider) {
    targetProvider = runtime.config.model.provider;
    targetModel = q;
  }

  try {
    await runtime.useProvider(targetProvider, targetModel);
    return `🍡 **Model Switched Successfully**\n- **Provider**: \`${runtime.config.model.provider}\`\n- **Model**: \`${runtime.config.model.model}\`\n- **Reasoning**: \`${runtime.config.reasoning || 'medium'}\``;
  } catch (err) {
    return `❌ Failed to switch model: ${err instanceof Error ? err.message : String(err)}`;
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
  let prompt = cleanText.startsWith(prefix) ? cleanText.slice(prefix.length).trim() : cleanText;
  if (prompt.startsWith('/')) prompt = prompt.slice(1).trim();

  if (!prompt || prompt === 'help') {
    return [
      `🍡 **Mochi Discord Gateway** (Parity with Hermes/OMP)`,
      `- \`/ask <goal>\` or \`${prefix} <goal>\` — Execute a coding goal or task.`,
      `- \`/model [name]\` or \`${prefix} model [name]\` — View active model or switch models.`,
      `- \`/reasoning [effort]\` or \`${prefix} reasoning [effort]\` — View or set reasoning depth (low/medium/high/max).`,
      `- \`/status\` or \`${prefix} status\` — Show active model, token usage, and daemon health.`,
      `- \`/doctor\` or \`${prefix} doctor\` — Run workspace configuration diagnosis.`,
      `- \`/reset\` or \`${prefix} reset\` — Reset conversation/goal state.`,
      `\n💡 *Tip: In DMs, you can message Mochi directly without any prefix! In channels, Mochi automatically spins up a thread for your task.*`,
    ].join('\n');
  }

  if (prompt === 'status') {
    const usage = runtime.usage?.total?.();
    return `📊 **Mochi Status**\n- **Model**: \`${runtime.config.model.model}\` (\`${runtime.config.model.provider}\`)\n- **Reasoning**: \`${runtime.config.reasoning || 'medium'}\`\n- **Workspace**: \`${runtime.cwd}\`\n- **Tokens Used**: ${usage?.tokensIn ?? 0} in / ${usage?.tokensOut ?? 0} out\n- **Estimated Cost**: $${(usage?.costUsd ?? 0).toFixed(4)} USD\n`;
  }

  if (prompt === 'model' || prompt.startsWith('model ')) {
    const query = prompt.startsWith('model ') ? prompt.slice(6).trim() : '';
    if (!query) return handleModelStatus(runtime);
    return await handleModelSwitch(runtime, query);
  }

  if (prompt === 'reasoning' || prompt.startsWith('reasoning ')) {
    const effort = prompt.startsWith('reasoning ') ? prompt.slice(10).trim().toLowerCase() : '';
    if (effort) {
      try {
        const res = runtime.setReasoning(effort);
        return `🍡 ${res}`;
      } catch (err) {
        return `❌ ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    return `🍡 Current reasoning depth: \`${runtime.config.reasoning || 'medium'}\`.`;
  }

  if (prompt === 'reset') {
    return '🔄 Session state reset. Ready for a new task!';
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
  createThread?: (channelId: string, messageId: string, name: string) => Promise<string | undefined>;
  addReaction?: (channelId: string, messageId: string, emoji: string) => Promise<boolean>;
  triggerTyping?: (channelId: string) => Promise<boolean>;
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
  const createThread = opts.createThread ?? ((chId: string, msgId: string, name: string) => createDiscordThread(cfg.token, chId, msgId, name, fetchJson));
  const addReaction = opts.addReaction ?? ((chId: string, msgId: string, emoji: string) => addDiscordReaction(cfg.token, chId, msgId, emoji, fetchJson));
  const triggerTyping = opts.triggerTyping ?? ((chId: string) => triggerDiscordTyping(cfg.token, chId, fetchJson));
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
          void (async () => {
            try {
              await fetchJson(`https://discord.com/api/v10/applications/${botId}/commands`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bot ${cfg.token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(DISCORD_SLASH_COMMANDS),
              });
              log('discord: slash commands synchronized.');
            } catch (err) {
              log(`discord: slash commands sync error (${err instanceof Error ? err.message : String(err)})`);
            }
          })();
        } else if (frame.op === 0 && frame.t === 'INTERACTION_CREATE') {
          const d = frame.d ?? {};
          const interactionId = String(d.id ?? '');
          const interactionToken = String(d.token ?? '');
          const commandName = String(d.data?.name ?? '');
          const optionsList = Array.isArray(d.data?.options) ? d.data.options : [];
          const optionsRecord: Record<string, unknown> = Object.fromEntries(
            optionsList.map((o: { name: string; value: unknown }) => [o.name, o.value]),
          );
          const authorId = String(d.member?.user?.id ?? d.user?.id ?? '');
          const channelId = String(d.channel_id ?? '');

          messages++;
          void (async () => {
            try {
              await fetchJson(`https://discord.com/api/v10/interactions/${interactionId}/${interactionToken}/callback`, {
                method: 'POST',
                headers: {
                  Authorization: `Bot ${cfg.token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ type: 5 }),
              });

              let reply = '';
              if (commandName === 'model') {
                const requestedModel = String(optionsRecord.name ?? '').trim();
                reply = requestedModel ? await handleModelSwitch(runtime, requestedModel) : handleModelStatus(runtime);
              } else if (commandName === 'reasoning') {
                const effort = String(optionsRecord.effort ?? '').trim().toLowerCase();
                if (effort) {
                  try {
                    const res = runtime.setReasoning(effort);
                    reply = `🍡 ${res}`;
                  } catch (err) {
                    reply = `❌ ${err instanceof Error ? err.message : String(err)}`;
                  }
                } else {
                  reply = `🍡 Current reasoning depth: \`${runtime.config.reasoning || 'medium'}\`.`;
                }
              } else if (commandName === 'ask') {
                const prompt = String(optionsRecord.prompt ?? '').trim();
                reply = await handleDiscordMessage({ authorId, content: prompt, channelId }, cfg, runtime);
              } else if (commandName === 'status' || commandName === 'doctor' || commandName === 'reset' || commandName === 'help') {
                reply = await handleDiscordMessage({ authorId, content: commandName, channelId }, cfg, runtime);
              } else {
                reply = `Unknown slash command: /${commandName}`;
              }

              const chunks = chunkMessage(reply);
              const appId = botId || cfg.token.split('.')[0];
              await fetchJson(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`, {
                method: 'PATCH',
                headers: {
                  Authorization: `Bot ${cfg.token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: chunks[0] ?? 'Done.' }),
              });

              for (let i = 1; i < chunks.length; i++) {
                await fetchJson(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bot ${cfg.token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ content: chunks[i] }),
                });
              }
            } catch (err) {
              log(`discord: interaction error (${err instanceof Error ? err.message : String(err)})`);
            }
          })();
        } else if (frame.op === 0 && frame.t === 'MESSAGE_CREATE') {
          const d = frame.d ?? {};
          const author = d.author ?? {};
          if (author.bot) return;
          const content = String(d.content ?? '');
          const channelId = String(d.channel_id ?? '');
          const messageId = String(d.id ?? '');
          const guildId = d.guild_id ? String(d.guild_id) : undefined;
          if (!channelId) return;

          const isDm = d.channel_type === 1 || Boolean(d.is_dm) || (!guildId && !channelId.startsWith('c'));
          const mentioned = botId !== '' && (content.includes(`<@${botId}>`) || content.includes(`<@!${botId}>`));
          if (!isDm && !content.startsWith(prefix) && !mentioned) return;
          const prompt = mentioned && !content.startsWith(prefix)
            ? content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim()
            : (content.startsWith(prefix) ? content.slice(prefix.length).trim() : content.trim());

          messages++;
          void (async () => {
            try {
              if (messageId) {
                void addReaction(channelId, messageId, '👀');
              }
              let targetChannelId = channelId;
              const isCommandOnly = prompt === prefix || prompt.startsWith(prefix + ' help') || prompt.startsWith(prefix + ' status') || prompt.startsWith(prefix + ' doctor');
              if (guildId && messageId && !isCommandOnly) {
                const threadTitle = prompt.replace(new RegExp(`^${prefix}\\s*`, 'i'), '').trim().slice(0, 80) || 'Task';
                const threadId = await createThread(channelId, messageId, `🍡 ${threadTitle}`);
                if (threadId) {
                  targetChannelId = threadId;
                }
              }

              let typing = true;
              const typingTimer = setInterval(() => {
                if (typing) void triggerTyping(targetChannelId);
              }, 8000);
              void triggerTyping(targetChannelId);

              let reply = '';
              let success = true;
              try {
                reply = await handleDiscordMessage({ authorId: String(author.id ?? ''), content: prompt, channelId: targetChannelId }, cfg, runtime);
              } catch (err) {
                success = false;
                reply = `❌ **Error**: ${err instanceof Error ? err.message : String(err)}`;
              } finally {
                typing = false;
                clearInterval(typingTimer);
              }

              if (messageId) {
                void addReaction(channelId, messageId, success && !reply.startsWith('❌') ? '✅' : '❌');
              }

              for (const chunk of chunkMessage(reply)) {
                const ok = await send(targetChannelId, chunk);
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
