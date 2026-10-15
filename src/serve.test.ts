// `mochi serve` API surface: health, auth gating, inventory routes.
// Exercises the real in-process server (startDaemonInProcess); only routes
// that need no provider are hit — review/goal/prompt stay out of unit tests.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runServe, SERVE_ROUTES } from './serve.js';
import { startDaemonInProcess } from './daemon/daemon.js';

let dir: string;
const closers: Array<() => Promise<void>> = [];

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-serve-'));
});

afterEach(async () => {
  for (const c of closers.splice(0)) { try { await c(); } catch { /* already closed */ } }
  rmSync(dir, { recursive: true, force: true });
});

async function boot(token = 'tok-serve') {
  const h = await startDaemonInProcess({ cwd: dir, port: 0, token });
  closers.push(h.close);
  return { base: `http://127.0.0.1:${h.info.port}`, token };
}

describe('serve API routes', () => {
  it('health answers without auth', async () => {
    const { base } = await boot();
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; version: string; uptimeSec: number };
    expect(data.ok).toBe(true);
    expect(typeof data.version).toBe('string');
    expect(data.version.length).toBeGreaterThan(0);
  });

  it('rejects missing/bad tokens, accepts the bearer', async () => {
    const { base, token } = await boot();
    const anon = await fetch(`${base}/api/models`);
    expect(anon.status).toBe(401);
    const bad = await fetch(`${base}/api/models`, { headers: { authorization: 'Bearer nope' } });
    expect(bad.status).toBe(401);
    const good = await fetch(`${base}/api/models`, { headers: { authorization: `Bearer ${token}` } });
    expect(good.status).toBe(200);
    const data = (await good.json()) as { ok: boolean; models: string[] };
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.models)).toBe(true);
  });

  it('lists skills with names and descriptions', async () => {
    const { base, token } = await boot();
    const res = await fetch(`${base}/api/skills`, { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; count: number; skills: Array<{ name: string; description: string }> };
    expect(data.ok).toBe(true);
    expect(data.count).toBe(data.skills.length);
    expect(data.count).toBeGreaterThan(0);
    expect(data.skills[0].name).toBeTruthy();
  });

  it('review/verify require POST (405 on GET, still authenticated)', async () => {
    const { base, token } = await boot();
    for (const p of ['/api/review', '/api/verify']) {
      const res = await fetch(`${base}${p}`, { headers: { authorization: `Bearer ${token}` } });
      expect(res.status).toBe(405);
    }
  });

  it('runServe boots, logs the URL, and stops on abort', async () => {
    const logs: string[] = [];
    const ctl = new AbortController();
    const done = runServe({ cwd: dir, port: 0, token: 'tok-run', onLog: (l) => logs.push(l), signal: ctl.signal });
    // Let it boot, prove health, then stop it.
    let base = '';
    for (let i = 0; i < 50 && !base; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const m = logs.join('\n').match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (m) base = `http://127.0.0.1:${m[1]}`;
    }
    expect(base).toBeTruthy();
    const h = await fetch(`${base}/api/health`);
    expect(h.status).toBe(200);
    ctl.abort();
    const summary = await done;
    expect(summary.stopped).toBe(true);
    expect(summary.port).toBeGreaterThan(0);
  });

  it('documents every served route', () => {
    for (const r of ['GET /api/health', 'GET /api/models', 'GET /api/skills', 'POST /api/review', 'POST /api/verify', 'POST /api/goal']) {
      expect(SERVE_ROUTES).toContain(r);
    }
  });
});
