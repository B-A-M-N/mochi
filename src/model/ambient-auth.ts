// Ambient OAuth ingestion: reuse the user's REAL logins from other CLIs
// (Codex, Gemini CLI, Claude Code, gcloud ADC) instead of asking for API keys.
// Nothing here fakes a client_id or invents a flow — we read the token caches
// those tools maintain on disk, check expiry, and (for Codex, whose public
// client_id is documented open source) refresh via the real token endpoint.
//
// All disk/network effects are injectable so tests run hermetically.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

export interface AmbientToken {
  token: string;
  source: string;
  expiresAtMs?: number;
}

export interface AmbientDeps {
  fetchJson?: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  execFile?: (cmd: string, args: string[], opts: { timeout?: number }) => Promise<string>;
  now?: () => number;
  readFileSync?: (p: string) => string;
  writeFileSync?: (p: string, data: string) => void;
  existsSync?: (p: string) => boolean;
  /** Override the user home dir (tests). Defaults to os.homedir(). */
  homeDir?: string;
}

const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'; // public, from open-source codex-rs
const CODEX_TOKEN_URL = 'https://auth.openai.com/oauth/token';

function home(sub: string, homeDir?: string): string {
  return resolve(homeDir ?? homedir(), sub);
}

function readJson(path: string, read: (p: string) => string): Record<string, unknown> | null {
  try {
    const raw = read(path);
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function isFresh(expiresAtMs: number | undefined, now: number, skewMs = 60_000): boolean {
  if (!expiresAtMs) return true; // no expiry info: assume fresh (caller may still probe)
  return expiresAtMs > now + skewMs;
}

/** Codex CLI ChatGPT OAuth: ~/.codex/auth.json (tokens.access_token). */
export async function codexAmbientToken(deps: AmbientDeps = {}): Promise<AmbientToken | undefined> {
  const read = deps.readFileSync ?? ((p: string) => readFileSync(p, 'utf8'));
  const exists = deps.existsSync ?? existsSync;
  const now = deps.now ?? Date.now;
  const path = home('.codex/auth.json', deps.homeDir);
  if (!exists(path)) return undefined;
  const data = readJson(path, read);
  if (!data) return undefined;
  const tokens = data.tokens as Record<string, unknown> | undefined;
  const access = typeof tokens?.access_token === 'string' ? tokens.access_token : '';
  const refresh = typeof tokens?.refresh_token === 'string' ? tokens.refresh_token : '';
  if (!access) return undefined;
  const lastRefresh = typeof data.last_refresh === 'string' ? Date.parse(data.last_refresh) : NaN;
  const ageMs = Number.isFinite(lastRefresh) ? now() - lastRefresh : Number.POSITIVE_INFINITY;
  // Codex access tokens are short-lived; refresh proactively when the cached
  // token is older than 50 minutes (or when we cannot tell).
  if (refresh && (ageMs > 50 * 60_000 || !Number.isFinite(lastRefresh))) {
    const refreshed = await refreshCodexToken(refresh, deps);
    if (refreshed) {
      try {
        const write = deps.writeFileSync ?? ((p: string, d: string) => writeFileSync(p, d));
        const updated = { ...data, tokens: { ...tokens, access_token: refreshed.access, refresh_token: refreshed.refresh ?? refresh }, last_refresh: new Date(now()).toISOString() };
        write(path, JSON.stringify(updated, null, 2));
      } catch { /* best-effort persistence */ }
      return { token: refreshed.access, source: 'codex-oauth', expiresAtMs: refreshed.expiresAtMs };
    }
    return undefined; // refresh failed — do not hand back a stale token
  }
  return { token: access, source: 'codex-oauth' };
}

async function refreshCodexToken(refreshToken: string, deps: AmbientDeps): Promise<{ access: string; refresh?: string; expiresAtMs?: number } | undefined> {
  if (!refreshToken) return undefined;
  const fetchJson = deps.fetchJson ?? (fetch as never);
  try {
    const res = await fetchJson(CODEX_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CODEX_CLIENT_ID,
        refresh_token: refreshToken,
      }).toString(),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!body.access_token) return undefined;
    return {
      access: body.access_token,
      refresh: body.refresh_token,
      expiresAtMs: typeof body.expires_in === 'number' ? Date.now() + body.expires_in * 1000 : undefined,
    };
  } catch {
    return undefined;
  }
}

/** Gemini CLI Google OAuth: ~/.gemini/oauth_creds.json (access_token + expiry_date epoch seconds). */
export function geminiAmbientToken(deps: AmbientDeps = {}): AmbientToken | undefined {
  const read = deps.readFileSync ?? ((p: string) => readFileSync(p, 'utf8'));
  const exists = deps.existsSync ?? existsSync;
  const now = deps.now ?? Date.now;
  const path = home('.gemini/oauth_creds.json', deps.homeDir);
  if (!exists(path)) return undefined;
  const data = readJson(path, read);
  if (!data) return undefined;
  const access = typeof data.access_token === 'string' ? data.access_token : '';
  if (!access) return undefined;
  const expiry = typeof data.expiry_date === 'number' ? data.expiry_date * 1000 : undefined;
  if (!isFresh(expiry, now())) return undefined; // expired — user must re-auth in the gemini CLI
  return { token: access, source: 'gemini-cli-oauth', expiresAtMs: expiry };
}

/** Claude Code OAuth: ~/.claude/.credentials.json (claudeAiOauth.accessToken). */
export function claudeAmbientToken(deps: AmbientDeps = {}): AmbientToken | undefined {
  const read = deps.readFileSync ?? ((p: string) => readFileSync(p, 'utf8'));
  const exists = deps.existsSync ?? existsSync;
  const now = deps.now ?? Date.now;
  const path = home('.claude/.credentials.json', deps.homeDir);
  if (!exists(path)) return undefined;
  const data = readJson(path, read);
  if (!data) return undefined;
  const oauth = data.claudeAiOauth as Record<string, unknown> | undefined;
  const access = typeof oauth?.accessToken === 'string' ? oauth.accessToken : '';
  if (!access) return undefined;
  const expiresAt = typeof oauth?.expiresAt === 'number' ? oauth.expiresAt : undefined;
  if (!isFresh(expiresAt, now())) return undefined;
  return { token: access, source: 'claude-code-oauth', expiresAtMs: expiresAt };
}

/** Google ADC (gcloud auth application-default login): token file or `gcloud auth print-access-token`. */
export async function gcloudAmbientToken(deps: AmbientDeps = {}): Promise<AmbientToken | undefined> {
  const read = deps.readFileSync ?? ((p: string) => readFileSync(p, 'utf8'));
  const exists = deps.existsSync ?? existsSync;
  const now = deps.now ?? Date.now;
  const path = home('.config/gcloud/application_default_credentials.json', deps.homeDir);
  if (exists(path)) {
    const data = readJson(path, read);
    const access = typeof data?.access_token === 'string' ? data.access_token : '';
    const expiry = typeof data?.token_expiry === 'string' ? Date.parse(data.token_expiry) : NaN;
    if (access && (Number.isNaN(expiry) || isFresh(expiry, now()))) {
      return { token: access, source: 'gcloud-adc', expiresAtMs: Number.isNaN(expiry) ? undefined : expiry };
    }
  }
  const execFile = deps.execFile ?? (async (cmd: string, args: string[]) => {
    const { execFile: ef } = await import('node:child_process');
    return await new Promise<string>((res, rej) => ef(cmd, args, { timeout: 8000 }, (e, out) => (e ? rej(e) : res(String(out ?? '').trim()))));
  });
  try {
    const out = await execFile('gcloud', ['auth', 'print-access-token'], { timeout: 8000 });
    const token = out.trim();
    if (token) return { token, source: 'gcloud-adc' };
  } catch { /* gcloud not installed / not authed */ }
  return undefined;
}

/** Try every known ambient source; first hit wins. */
export async function anyAmbientToken(deps: AmbientDeps = {}): Promise<AmbientToken | undefined> {
  return (await codexAmbientToken(deps))
    ?? geminiAmbientToken(deps)
    ?? claudeAmbientToken(deps)
    ?? (await gcloudAmbientToken(deps));
}
