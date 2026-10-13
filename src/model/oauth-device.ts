// RFC 8628 OAuth 2.0 Device Authorization Grant engine (UNWIRED BY DESIGN).
//
// What this is: the complete, tested device-flow state machine — request a
// user code, show it, poll until the user approves in a browser, return the
// token. What it is NOT: a working login for any provider. Wiring it to a
// provider requires a REGISTERED OAuth app (client_id); shipping a login that
// points at someone else's client_id (or a placeholder) would be exactly the
// fake this file exists to prevent. When mochi registers app credentials,
// wiring is one call site per provider plus the client_id.
//
// Covered: authorization_pending polling, slow_down backoff, access_denied /
// expired_token failures, overall expiry, AbortSignal cancellation, and an
// injectable fetch so tests run against a stub, never the network.

export interface DeviceFlowServer {
  /** e.g. https://github.com/login/device/code */
  deviceCodeUrl: string;
  /** e.g. https://github.com/login/oauth/access_token */
  tokenUrl: string;
  /** OAuth app client_id registered for mochi (REQUIRED — no default). */
  clientId: string;
  scope?: string;
}

export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  /** Server-suggested poll interval, seconds. */
  interval: number;
}

export interface DeviceToken {
  access_token: string;
  token_type?: string;
  scope?: string;
  refresh_token?: string;
  expires_in?: number;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

async function postForm(fetchFn: FetchFn, url: string, params: Record<string, string>, timeoutMs: number): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(params).toString(),
      signal: ctl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Step 1: obtain the user code + verification URI to show the user. */
export async function requestDeviceCode(
  server: DeviceFlowServer,
  opts: { fetchFn?: FetchFn; timeoutMs?: number } = {},
): Promise<DeviceCode> {
  if (!server.clientId) throw new Error('device flow needs a registered OAuth client_id — none configured');
  const fetchFn = opts.fetchFn ?? fetch;
  const res = await postForm(fetchFn, server.deviceCodeUrl, {
    client_id: server.clientId,
    ...(server.scope ? { scope: server.scope } : {}),
  }, opts.timeoutMs ?? 15_000);
  if (!res.ok) throw new Error(`device-code request failed (HTTP ${res.status})`);
  const body = (await res.json()) as Record<string, unknown>;
  if (typeof body.device_code !== 'string' || typeof body.user_code !== 'string') {
    throw new Error(`device-code response malformed: ${JSON.stringify(body).slice(0, 160)}`);
  }
  return {
    device_code: body.device_code,
    user_code: body.user_code,
    verification_uri: String(body.verification_uri ?? body.verification_url ?? ''),
    verification_uri_complete: typeof body.verification_uri_complete === 'string' ? body.verification_uri_complete : undefined,
    expires_in: typeof body.expires_in === 'number' ? body.expires_in : 900,
    interval: typeof body.interval === 'number' ? body.interval : 5,
  };
}

export interface PollOpts {
  fetchFn?: FetchFn;
  /** Called with the current wait each round (for spinners/status lines). */
  onWait?: (waitMs: number, elapsedMs: number) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

/** Step 2: poll until approval, denial, expiry, or cancellation. */
export async function pollDeviceToken(
  server: DeviceFlowServer,
  code: DeviceCode,
  opts: PollOpts = {},
): Promise<DeviceToken> {
  if (!server.clientId) throw new Error('device flow needs a registered OAuth client_id — none configured');
  const fetchFn = opts.fetchFn ?? fetch;
  const startedAt = Date.now();
  const deadline = startedAt + Math.min(opts.timeoutMs ?? 10 * 60 * 1000, code.expires_in * 1000);
  let intervalMs = Math.max(1000, code.interval * 1000);
  for (;;) {
    if (opts.signal?.aborted) throw new Error('device authorization cancelled');
    if (Date.now() >= deadline) throw new Error('device code expired before approval');
    opts.onWait?.(intervalMs, Date.now() - startedAt);
    if (opts.sleepFn) {
      await opts.sleepFn(intervalMs);
    } else {
      await new Promise<void>((r, rej) => {
        const t = setTimeout(r, intervalMs);
        opts.signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('device authorization cancelled')); }, { once: true });
      });
    }
    if (opts.signal?.aborted) throw new Error('device authorization cancelled');
    const res = await postForm(fetchFn, server.tokenUrl, {
      client_id: server.clientId,
      device_code: code.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }, 15_000);
    // RFC 8628 errors arrive as HTTP 200 + { error } on most providers.
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.access_token === 'string') {
      return {
        access_token: body.access_token,
        token_type: typeof body.token_type === 'string' ? body.token_type : undefined,
        scope: typeof body.scope === 'string' ? body.scope : undefined,
        refresh_token: typeof body.refresh_token === 'string' ? body.refresh_token : undefined,
        expires_in: typeof body.expires_in === 'number' ? body.expires_in : undefined,
      };
    }
    const err = typeof body.error === 'string' ? body.error : `HTTP ${res.status}`;
    if (err === 'authorization_pending') continue;
    if (err === 'slow_down') { intervalMs += 5000; continue; }
    if (err === 'expired_token') throw new Error('device code expired before approval');
    if (err === 'access_denied') throw new Error('authorization denied by the user');
    throw new Error(`device authorization failed: ${String(err).slice(0, 160)}`);
  }
}
