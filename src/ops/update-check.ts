// Daily update check (warn-only, offline-safe, opt-out).
// Prints a one-line stderr hint when the npm registry reports a newer
// @mochi/agent than the running build. Never blocks startup: 3s fetch
// budget, 24h cache in ~/.config/mochi/update-check.json, disabled with
// MOCHI_NO_UPDATE_CHECK=1. No telemetry — only a version string is fetched.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function currentVersion(): string {
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    return (JSON.parse(readFileSync(join(root, '..', 'package.json'), 'utf8')) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function cachePath(): string {
  return join(homedir(), '.config', 'mochi', 'update-check.json');
}

function cacheFresh(): boolean {
  try {
    if (!existsSync(cachePath())) return false;
    const { at } = JSON.parse(readFileSync(cachePath(), 'utf8')) as { at?: number };
    return typeof at === 'number' && Date.now() - at < 24 * 3600 * 1000;
  } catch {
    return false;
  }
}

function readCachedLatest(): string | undefined {
  try {
    const { latest } = JSON.parse(readFileSync(cachePath(), 'utf8')) as { latest?: string };
    return typeof latest === 'string' ? latest : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(latest: string): void {
  try {
    mkdirSync(dirname(cachePath()), { recursive: true });
    writeFileSync(cachePath(), JSON.stringify({ at: Date.now(), latest }));
  } catch { /* best-effort */ }
}

export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map((n) => Number(n.split('-')[0]) || 0);
  const [a1 = 0, a2 = 0, a3 = 0] = parse(latest);
  const [b1 = 0, b2 = 0, b3 = 0] = parse(current);
  return a1 > b1 || (a1 === b1 && (a2 > b2 || (a2 === b2 && a3 > b3)));
}

async function fetchLatest(): Promise<string | undefined> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const res = await fetch('https://registry.npmjs.org/@mochi%2Fagent/latest', { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return undefined;
    const { version } = (await res.json()) as { version?: string };
    return typeof version === 'string' ? version : undefined;
  } catch {
    return undefined;
  }
}

/** Warn-only daily check. Call fire-and-forget at startup; never throws. */
export async function maybeCheckUpdate(): Promise<void> {
  try {
    if (process.env.MOCHI_NO_UPDATE_CHECK === '1' || process.env.VITEST) return;
    if (!process.stderr.isTTY) return; // scripts/CI don't need the nudge
    const cur = currentVersion();
    if (cacheFresh()) {
      const cached = readCachedLatest();
      if (cached && isNewer(cached, cur)) {
        console.error(`[mochi] update available: ${cur} → ${cached} (npm i -g @mochi/agent)`);
      }
      return;
    }
    const latest = await fetchLatest();
    if (!latest) return;
    writeCache(latest);
    if (isNewer(latest, cur)) {
      console.error(`[mochi] update available: ${cur} → ${latest} (npm i -g @mochi/agent)`);
    }
  } catch { /* never break startup */ }
}
