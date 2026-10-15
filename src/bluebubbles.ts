// BlueBubbles gateway for Mochi — iMessage bridge via a BlueBubbles server
// (https://bluebubbles.app). Reuses the same prefix/noise policy as the
// Discord and Telegram gateways. Transport stays injected so tests never hit
// the network.
//
// BlueBubbles is reverse-proxied through a macOS host; authentication is via
// the server password passed as a query parameter (BlueBubbles convention).

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Runtime } from './runtime.js';

export interface BlueBubblesConfig {
  serverUrl: string;
  password: string;
  /** Restrict to one chat GUID; empty = all chats the user participates in. */
  chatGuid?: string;
  allowAllUsers?: boolean;
  allowedSenders?: string[];
  prefix?: string;
}

interface HttpLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

/** Load BlueBubbles config from env/.env (same search order as Telegram/Discord). */
export function loadBlueBubblesConfig(cwd: string): BlueBubblesConfig | null {
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
  const serverUrl = (envMap.get('BLUEBUBBLES_SERVER_URL') || envMap.get('BLUEBUBBLES_URL') || '').replace(/\/+$/, '');
  const password = envMap.get('BLUEBUBBLES_PASSWORD') || envMap.get('BLUEBUBBLES_TOKEN') || '';
  if (!serverUrl || !password) return null;
  const chatGuid = envMap.get('BLUEBUBBLES_CHAT_GUID') || envMap.get('BLUEBUBBLES_CHAT') || undefined;
  const allowAllUsers = envMap.get('BLUEBUBBLES_ALLOW_ALL_USERS') === 'true';
  const allowedSenders = (envMap.get('BLUEBUBBLES_ALLOWED_SENDERS') || envMap.get('BLUEBUBBLES_ALLOWED_USERS') || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const prefix = envMap.get('BLUEBUBBLES_PREFIX') || '/ask';
  return { serverUrl, password, chatGuid, allowAllUsers, allowedSenders, prefix };
}

function apiUrl(cfg: BlueBubblesConfig, path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${cfg.serverUrl}${path.startsWith('/') ? path : `/${path}`}${sep}password=${encodeURIComponent(cfg.password)}`;
}

/** Send a message through a BlueBubbles server. */
export async function sendBlueBubblesMessage(
  cfg: BlueBubblesConfig,
  chatGuid: string,
  text: string,
  fetchJson: (url: string, init?: RequestInit) => Promise<HttpLike> = fetch as never,
): Promise<boolean> {
  try {
    const res = await fetchJson(apiUrl(cfg, '/api/v1/message/text'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatGuid, message: text.slice(0, 10000), method: 'apple-script' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface BlueBubblesMessage {
  rowid: number;
  text: string;
  chatGuid: string;
  sender: string;
  isFromMe: boolean;
}

/** Best-effort parse of BlueBubbles' recent-messages response. */
export function parseBlueBubblesMessages(body: unknown): BlueBubblesMessage[] {
  const obj = (body && typeof body === 'object') ? (body as Record<string, unknown>) : {};
  const data = Array.isArray(obj.data) ? obj.data : Array.isArray(obj) ? obj : [];
  const out: BlueBubblesMessage[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const rowid = typeof rec.rowid === 'number' ? rec.rowid : typeof rec.id === 'number' ? rec.id : 0;
    const text = typeof rec.text === 'string' ? rec.text : '';
    const isFromMe = rec.isFromMe === true;
    const handle = rec.handle && typeof rec.handle === 'object' ? (rec.handle as Record<string, unknown>) : {};
    const sender = typeof handle.address === 'string' ? handle.address : typeof rec.sender === 'string' ? rec.sender : '';
    const chats = Array.isArray(rec.chats) ? rec.chats : [];
    const chat = chats.length && chats[0] && typeof chats[0] === 'object' ? (chats[0] as Record<string, unknown>) : {};
    const chatGuid = typeof chat.guid === 'string' ? chat.guid : typeof rec.chatGuid === 'string' ? rec.chatGuid : '';
    if (!chatGuid) continue;
    out.push({ rowid, text, chatGuid, sender, isFromMe });
  }
  return out;
}

export async function fetchBlueBubblesMessages(
  cfg: BlueBubblesConfig,
  fetchJson: (url: string, init?: RequestInit) => Promise<HttpLike> = fetch as never,
  limit = 25,
): Promise<BlueBubblesMessage[]> {
  try {
    const url = apiUrl(cfg, `/api/v1/message?limit=${limit}&sort=DESC`);
    const res = await fetchJson(url);
    if (!res.ok) return [];
    const body = await res.json();
    return parseBlueBubblesMessages(body);
  } catch {
    return [];
  }
}

/** Compose one reply, mirroring the Discord/Telegram surface. */
export async function handleBlueBubblesMessage(
  msg: { authorId: string; text: string; chatGuid: string },
  cfg: BlueBubblesConfig,
  runtime: Runtime,
): Promise<string> {
  if (!cfg.allowAllUsers && cfg.allowedSenders && cfg.allowedSenders.length > 0 && !cfg.allowedSenders.includes(msg.authorId)) {
    return 'Unauthorized: your sender cannot invoke Mochi here.';
  }
  const prefix = cfg.prefix || '/ask';
  const clean = msg.text.trim();
  const usedPrefix = clean.startsWith(prefix);
  const prompt = usedPrefix ? clean.slice(prefix.length).trim() : clean;
  if (!prompt || prompt === 'help' || prompt === '/help' || prompt === 'start') {
    return [
      'BlueBubbles (iMessage) — Mochi',
      `${prefix} <goal> — run a coding task`,
      `${prefix} status — model, tokens, cost`,
      `${prefix} help — this message`,
    ].join('\n');
  }
  if (prompt === 'status') {
    const u = runtime.usage?.total?.() ?? { tokensIn: 0, tokensOut: 0, costUsd: 0 };
    return [
      'Mochi status',
      `Model: ${runtime.config.model.model}`,
      `Tokens: ${u.tokensIn ?? 0} in / ${u.tokensOut ?? 0} out`,
      `Cost: $${(u.costUsd ?? 0).toFixed(4)}`,
    ].join('\n');
  }
  if (!usedPrefix && !/^\/ask\b/.test(clean)) {
    return '';
  }
  try {
    const result = await runtime.goal(prompt);
    return `Mochi: ${result.slice(0, 3800)}`;
  } catch (err) {
    return `Mochi failed: ${(err instanceof Error ? err.message : String(err)).slice(0, 1800)}`;
  }
}

export interface BlueBubblesRunOpts {
  fetchJson: (url: string, init?: RequestInit) => Promise<HttpLike>;
  send?: (chatGuid: string, text: string) => Promise<boolean>;
  onLog?: (line: string) => void;
  signal?: AbortSignal;
  sleepMs?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
  maxIterations?: number;
}

export interface BlueBubblesRunSummary { messages: number; replies: number; stopped: boolean }

export async function runBlueBubblesGateway(
  cfg: BlueBubblesConfig,
  runtime: Runtime,
  opts: BlueBubblesRunOpts,
): Promise<BlueBubblesRunSummary> {
  const fetchJson = opts.fetchJson;
  const send = opts.send ?? ((chatGuid: string, text: string) => sendBlueBubblesMessage(cfg, chatGuid, text, fetchJson));
  const log = opts.onLog ?? (() => {});
  const sleepMs = opts.sleepMs ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxIterations = opts.maxIterations ?? Number.MAX_SAFE_INTEGER;
  const pollIntervalMs = opts.pollIntervalMs ?? 4000;

  let lastRowId = 0;
  let messages = 0;
  let replies = 0;
  // Prime the cursor so historical messages don't trigger a flood on startup.
  try {
    const priming = await fetchBlueBubblesMessages(cfg, fetchJson, 1);
    if (priming.length) lastRowId = Math.max(...priming.map((m) => m.rowid));
  } catch { /* best-effort */ }

  for (let i = 0; i < maxIterations; i++) {
    if (opts.signal?.aborted) return { messages, replies, stopped: true };
    let batch: BlueBubblesMessage[] = [];
    try {
      batch = await fetchBlueBubblesMessages(cfg, fetchJson, 50);
    } catch (e) {
      log(`bluebubbles: poll error (${e instanceof Error ? e.message : String(e)}).`);
      await sleepMs(pollIntervalMs);
      continue;
    }
    const newMsgs = batch.filter((m) => m.rowid > lastRowId && !m.isFromMe && (!cfg.chatGuid || m.chatGuid === cfg.chatGuid));
    for (const m of newMsgs) {
      lastRowId = Math.max(lastRowId, m.rowid);
      if (!m.text.trim()) continue;
      messages++;
      const reply = await handleBlueBubblesMessage({ authorId: m.sender, text: m.text, chatGuid: m.chatGuid }, cfg, runtime);
      if (!reply) continue;
      const ok = await send(m.chatGuid, reply);
      if (ok) replies++;
      else log(`bluebubbles: sendMessage failed for chat ${m.chatGuid}.`);
    }
    if (newMsgs.length === 0) {
      // keep cursor moving across high-volume chats
      if (batch.length) lastRowId = Math.max(lastRowId, ...batch.map((m) => m.rowid));
    }
    await sleepMs(pollIntervalMs);
  }
  return { messages, replies, stopped: false };
}