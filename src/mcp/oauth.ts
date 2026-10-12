// MCP OAuth for pre-registered clients (Crush-style): servers that need a
// bearer token Mint it via OAuth2 client_credentials (or refresh_token)
// against the server's token endpoint, cache it on disk (0600), and refresh
// before expiry. Secrets accept ${ENV_VAR} expansion so .mcp.json never holds
// raw credentials. Full browser-redirect (authorization-code + PKCE) flows are
// intentionally OUT of scope — register an OAuth app once, then configure:
//
//   { "url": "https://api.example.com/mcp",
//     "oauth": { "tokenUrl": "https://auth.example.com/token",
//                "clientId": "${MY_CLIENT_ID}", "clientSecret": "${MY_CLIENT_SECRET}",
//                "scope": "mcp" } }
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface McpOAuthConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  scope?: string;
  /** Refresh this many seconds before expiry. Default 60. */
  refreshThresholdSec?: number;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
  refreshToken?: string;
}

const warnedEmptyVars = new Set<string>();

function expandEnv(s: string): string {
  return s.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_m, name: string) => {
    const v = process.env[name] ?? '';
    // Warn once per missing variable: a typo'd ${MY_SECRET} silently became
    // an empty client_secret/scope and failed at the token endpoint with a
    // generic HTTP error that hid the misconfiguration.
    if (!v && !warnedEmptyVars.has(name) && !process.env.VITEST) {
      warnedEmptyVars.add(name);
      console.error(`[mochi oauth] warning: environment variable ${name} is not set (used as \${${name}}); expanding to empty string.`);
    }
    return v;
  });
}

function storePath(storeDir?: string): string {
  // storeDir override exists for tests (production always uses the real
  // home —never a tmpdir that would strand credentials or pollute runs).
  return join(storeDir ?? join(homedir(), '.mochi'), 'mcp-oauth.json');
}

function loadStore(storeDir?: string): Record<string, CachedToken> {
  try {
    if (!existsSync(storePath(storeDir))) return {};
    return JSON.parse(readFileSync(storePath(storeDir), 'utf8')) as Record<string, CachedToken>;
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, CachedToken>, storeDir?: string): void {
  try {
    mkdirSync(join(storeDir ?? join(homedir(), '.mochi')), { recursive: true });
    writeFileSync(storePath(storeDir), JSON.stringify(store, null, 2), { mode: 0o600 });
    try { chmodSync(storePath(storeDir), 0o600); } catch { /* best effort */ }
  } catch { /* token caching is best-effort; the call still works uncached */ }
}

async function exchangeToken(cfg: McpOAuthConfig, params: Record<string, string>): Promise<{ access_token?: string; expires_in?: number; refresh_token?: string; error?: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(expandEnv(cfg.tokenUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
      signal: ctl.signal,
    });
    if (!res.ok) return { error: `token endpoint HTTP ${res.status}` };
    return (await res.json()) as { access_token?: string; expires_in?: number; refresh_token?: string; error?: string };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** Valid bearer token for a server, using cache → refresh → client-credentials
 *  in that order. Throws with a human-readable message when issuance fails. */
export async function getOAuthToken(serverId: string, cfg: McpOAuthConfig, storeDir?: string): Promise<string> {
  const thresholdMs = (cfg.refreshThresholdSec ?? 60) * 1000;
  const store = loadStore(storeDir);
  const cached = store[serverId];
  if (cached?.accessToken && cached.expiresAt - Date.now() > thresholdMs) {
    return cached.accessToken;
  }
  const clientId = expandEnv(cfg.clientId);
  const clientSecret = cfg.clientSecret ? expandEnv(cfg.clientSecret) : '';
  // 1. Refresh grant (preserves the grant without re-authenticating).
  if (cached?.refreshToken) {
    const r = await exchangeToken(cfg, {
      grant_type: 'refresh_token',
      refresh_token: cached.refreshToken,
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    });
    if (r.access_token) {
      const next: CachedToken = {
        accessToken: r.access_token,
        expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000,
        refreshToken: r.refresh_token ?? cached.refreshToken,
      };
      store[serverId] = next;
      saveStore(store, storeDir);
      return next.accessToken;
    }
    // Refresh failed (revoked/expired): fall through to client credentials.
    delete store[serverId];
  }
  // 2. Client-credentials grant.
  const scope = cfg.scope ? expandEnv(cfg.scope) : '';
  const r = await exchangeToken(cfg, {
    grant_type: 'client_credentials',
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
    ...(scope ? { scope } : {}),
  });
  if (!r.access_token) {
    throw new Error(`MCP OAuth failed for "${serverId}": ${r.error ?? 'no access_token issued'}`);
  }
  store[serverId] = {
    accessToken: r.access_token,
    expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000,
    refreshToken: r.refresh_token,
  };
  saveStore(store, storeDir);
  return r.access_token;
}

/** Authorization headers for a server (empty when no oauth configured). */
export async function oauthHeaders(serverId: string, cfg?: McpOAuthConfig, storeDir?: string): Promise<Record<string, string>> {
  if (!cfg?.tokenUrl || !cfg?.clientId) return {};
  const token = await getOAuthToken(serverId, cfg, storeDir);
  return { authorization: `Bearer ${token}` };
}
