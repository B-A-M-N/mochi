// Telegram gateway for Mochi — third-party messaging parity with the Discord
// gateway, using Telegram's plain HTTP long-poll API (getUpdates/sendMessage):
// no websocket handshake, no privileged intents. Transport arrives injected
// so tests drive the full loop against scripted responses and never touch
// the network. Only messages that mention/prefix-match the configured command
// get answered; everything else is ignored (same policy as Discord).

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Runtime } from './runtime.js';

export interface TelegramConfig {
  token: string;
  allowAllUsers?: boolean;
  allowedUserIds?: string[];
  prefix?: string;
}

interface HttpLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

/** Load Telegram bot config from env/.env (same search order as Discord). */
export function loadTelegramConfig(cwd: string): TelegramConfig | null {
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
  const token = envMap.get('TELEGRAM_BOT_TOKEN');
  if (!token) return null;
  const allowAllUsers = envMap.get('TELEGRAM_ALLOW_ALL_USERS') === 'true';
  const allowedUserIds = (envMap.get('TELEGRAM_ALLOWED_USERS') || envMap.get('TELEGRAM_ALLOWED_IDS') || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const prefix = envMap.get('TELEGRAM_PREFIX') || '/ask';
  return { token, allowAllUsers, allowedUserIds, prefix };
}

/** Send a message (Telegram caps text at 4096 chars). */
export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  fetchJson: (url: string, init?: RequestInit) => Promise<HttpLike> = fetch as never,
): Promise<boolean> {
  try {
    const res = await fetchJson(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4096), disable_web_page_preview: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface TelegramUpdate {
  update_id: number;
  message?: { message_id: number; chat: { id: number | string; type?: string }; from?: { id: number | string; is_bot?: boolean; username?: string }; text?: string };
  edited_message?: { message_id: number; chat: { id: number | string; type?: string }; from?: { id: number | string; is_bot?: boolean }; text?: string };
  channel_post?: { message_id: number; chat: { id: number | string; type?: string }; from?: { id: number | string; is_bot?: boolean }; text?: string };
  edited_channel_post?: { message_id: number; chat: { id: number | string; type?: string }; from?: { id: number | string; is_bot?: boolean }; text?: string };
}

/** Compose one reply (help / status / goal), mirroring the Discord surface. */
export async function handleTelegramMessage(
  msg: { authorId: string; text: string; chatId: string },
  cfg: TelegramConfig,
  runtime: Runtime,
): Promise<string> {
  if (!cfg.allowAllUsers && cfg.allowedUserIds && cfg.allowedUserIds.length > 0 && !cfg.allowedUserIds.includes(msg.authorId)) {
    return 'Unauthorized: your Telegram account cannot invoke Mochi here.';
  }
  const prefix = cfg.prefix || '/ask';
  const clean = msg.text.trim();
  const usedPrefix = clean.startsWith(prefix);
  const prompt = usedPrefix ? clean.slice(prefix.length).trim() : clean;
  if (!prompt || prompt === 'help' || prompt === '/help' || prompt === 'start') {
    return [
      '🍡 Mochi (Telegram)',
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
  if (!usedPrefix && !/^\/ask\b/.test(clean)) {
    // No prefix and no explicit ask-call: stay quiet (channel noise policy).
    return '';
  }
  try {
    const result = await runtime.goal(prompt);
    return `✅ ${result.slice(0, 3800)}`;
  } catch (err) {
    return `❌ Failed: ${(err instanceof Error ? err.message : String(err)).slice(0, 1800)}`;
  }
}

export interface TelegramRunOpts {
  fetchJson: (url: string, init?: RequestInit) => Promise<HttpLike>;
  send?: (chatId: string, text: string) => Promise<boolean>;
  onLog?: (line: string) => void;
  signal?: AbortSignal;
  sleepMs?: (ms: number) => Promise<void>;
  /** Long-poll timeout in seconds (Telegram's own bound; tests pin it low). */
  pollTimeoutSec?: number;
  maxIterations?: number;
}

export interface TelegramRunSummary { updates: number; messages: number; stopped: boolean }

/** Long-poll loop: getUpdates → dispatch → ack by offset. Stops on abort,
 *  a stop-signal text ("/stop"), or the iteration cap (test harness). */
export async function runTelegramGateway(
  cfg: TelegramConfig,
  runtime: Runtime,
  opts: TelegramRunOpts,
): Promise<TelegramRunSummary> {
  const fetchJson = opts.fetchJson;
  const send = opts.send ?? ((chatId: string, text: string) => sendTelegramMessage(cfg.token, chatId, text, fetchJson));
  const log = opts.onLog ?? (() => {});
  const sleepMs = opts.sleepMs ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxIterations = opts.maxIterations ?? Number.MAX_SAFE_INTEGER;
  const prefix = cfg.prefix || '/ask';

  let offset = 0;
  let updates = 0;
  let messages = 0;
  for (let i = 0; i < maxIterations; i++) {
    if (opts.signal?.aborted) return { updates, messages, stopped: true };
    const url = `https://api.telegram.org/bot${cfg.token}/getUpdates?offset=${offset}&timeout=${opts.pollTimeoutSec ?? 30}`;
    let batch: TelegramUpdate[] = [];
    try {
      const res = await fetchJson(url);
      if (!res.ok) {
        log(`telegram: getUpdates HTTP ${res.status} (token rejected?) — stopping.`);
        return { updates, messages, stopped: false };
      }
      const body = (await res.json()) as { ok?: boolean; result?: unknown };
      if (body.ok === false) {
        log('telegram: getUpdates reported ok:false — stopping.');
        return { updates, messages, stopped: false };
      }
      batch = Array.isArray(body.result) ? (body.result as TelegramUpdate[]) : [];
    } catch (e) {
      log(`telegram: poll error (${e instanceof Error ? e.message : String(e)}).`);
      await sleepMs(2000);
      continue;
    }
    for (const up of batch) {
      if (!up || typeof up !== 'object') continue;
      const uid = Number.isFinite(up.update_id) ? (up.update_id as number) : (Number(offset) || 0);
      offset = uid + 1;
      updates++;
      const m = up.message ?? up.edited_message ?? up.channel_post ?? up.edited_channel_post;
      if (!m || m.from?.is_bot || !m.text) continue;
      if (m.text.trim() === '/stop') {
        log('telegram: stop requested by operator.');
        return { updates, messages, stopped: true };
      }
      const isPrefix = m.text.trim().startsWith(prefix);
      const isMention = m.text.trim().startsWith('/ask');
      if (!isPrefix && !isMention) continue; // channel-noise policy
      messages++;
      const chatId = String(m.chat.id);
      const reply = await handleTelegramMessage({ authorId: String(m.from?.id ?? ''), text: m.text, chatId }, cfg, runtime);
      if (!reply) continue;
      const ok = await send(chatId, reply);
      if (!ok) log(`telegram: sendMessage failed for chat ${chatId}.`);
    }
  }
  return { updates, messages, stopped: false };
}
