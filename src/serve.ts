// `mochi serve` — foreground JSON API server for CI and external tooling.
// Same routes + auth as the daemon (it boots the identical request handler
// via startDaemonInProcess), but foreground: prints the URL + token, runs
// until SIGINT, and exits. Localhost-only by design — expose it remotely
// with an SSH tunnel or reverse proxy, never by binding 0.0.0.0.
//
// Endpoints (all JSON; Bearer token except /api/health):
//   GET  /api/health           no auth — {ok, version, uptimeSec}
//   GET  /api/models           provider + model inventory
//   GET  /api/skills           skill names + descriptions
//   POST /api/status           usage + cwd
//   POST /api/goal             run a goal (SSE when Accept: text/event-stream)
//   POST /api/prompt           one-shot prompt → structured result
//   POST /api/review           {diff?} → review (defaults to git diff HEAD)
//   POST /api/verify           {command?, target?} → run repo checks
//   POST /api/plan|approve|resume|inspect|jobs|cron|rotate  (daemon parity)

import { randomBytes } from 'node:crypto';
import { startDaemonInProcess } from './daemon/daemon.js';

export interface ServeOpts {
  cwd: string;
  /** Port to bind (0 = ephemeral, printed on start). */
  port?: number;
  /** Bind address (default 127.0.0.1; containers pass 0.0.0.0). */
  host?: string;
  /** Bearer token (generated when omitted). */
  token?: string;
  onLog?: (line: string) => void;
  signal?: AbortSignal;
}

export interface ServeSummary { port: number; stopped: boolean }

export const SERVE_ROUTES = [
  'GET /api/health',
  'GET /api/models',
  'GET /api/skills',
  'POST /api/status',
  'POST /api/goal',
  'POST /api/prompt',
  'POST /api/review',
  'POST /api/verify',
  'GET /v1/models',
  'POST /v1/chat/completions',
  'POST /api/plan',
  'POST /api/approve',
  'POST /api/resume',
  'POST /api/inspect',
  'POST /api/jobs',
  'POST /api/cron',
  'POST /api/rotate',
];

/** Boot the API server in the foreground. Resolves on abort (or immediately
 *  when the signal is already aborted); always closes the listener. */
export async function runServe(opts: ServeOpts): Promise<ServeSummary> {
  const log = opts.onLog ?? (() => {});
  const token = opts.token ?? randomBytes(24).toString('hex');
  const h = await startDaemonInProcess({ cwd: opts.cwd, port: opts.port ?? 0, token, host: opts.host });
  const base = `http://${opts.host && opts.host !== '127.0.0.1' ? opts.host : '127.0.0.1'}:${h.info.port}`;
  log(`🍡 Mochi API serving at ${base} (Ctrl+C to stop).`);
  log(`Token: ${token} (also in .mochi/daemon/info.json — keep it secret)`);
  log(`Routes: ${SERVE_ROUTES.join(', ')}`);
  try {
    if (opts.signal?.aborted) return { port: h.info.port, stopped: true };
    if (opts.signal) {
      await new Promise<void>((res) => opts.signal!.addEventListener('abort', () => res(), { once: true }));
    } else {
      // No signal: run until the process dies (SIGINT/SIGTERM kills us).
      await new Promise<void>(() => {});
    }
    return { port: h.info.port, stopped: true };
  } finally {
    try { await h.close(); } catch { /* already closed */ }
  }
}
