/**
 * Update check + apply — tells every Mochi install when a new release ships
 * and gives one-command upgrade paths for both install styles:
 *   - git checkout (~/mochi): git pull + npm ci + build
 *   - installer/curl installs: re-run install.sh from main
 *
 * Design constraints:
 *   - NEVER block startup: the check runs in the background with a hard
 *     timeout and caches its result to ~/.mochi/update-check.json (24h TTL).
 *     Offline / rate-limited / error => silent no-op (no notice shown).
 *   - The user keeps control: the notice only SUGGESTS `/update`; nothing
 *     auto-installs.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { mochiStateDir } from './core/mochi-dir.js';
import { runArgv } from './exec.js';

export const REPO = 'xanstomper/mochi';
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const CACHE_FILE = 'update-check.json';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

export interface UpdateInfo {
  available: boolean;
  current: string;
  latest: string;
  url?: string;
  notes?: string;
  /** Where the cached result came from: 'cache' (fresh enough) or 'network'. */
  source: 'cache' | 'network' | 'none';
  checkedAt: number;
}

/** Semver compare: returns >0 when a > b, <0 when a < b, 0 when equal. Tolerates v-prefix and -suffixes (ignores prerelease suffix). */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('-')[0].split('.').map((n) => Number(n) || 0);
  const pb = b.replace(/^v/i, '').split('-')[0].split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

interface CacheShape {
  latest: string;
  url?: string;
  notes?: string;
  checkedAt: number;
}

function cachePath(): string {
  // Update-check state is per-user (not per-project): cache at ~/.mochi.
  return resolve(mochiStateDir(homedir()), CACHE_FILE);
}

function readCache(): CacheShape | null {
  try {
    const raw = readFileSync(cachePath(), 'utf8');
    const c = JSON.parse(raw) as CacheShape;
    if (typeof c.latest !== 'string' || typeof c.checkedAt !== 'number') return null;
    return c;
  } catch {
    return null;
  }
}

function writeCache(c: CacheShape): void {
  try {
    mkdirSync(mochiStateDir(homedir()), { recursive: true });
    writeFileSync(cachePath(), JSON.stringify(c), 'utf8');
  } catch {
    // cache is best-effort; ignore write failures
  }
}

/**
 * Check GitHub for a newer release. Uses the 24h cache when fresh; the
 * network fetch is hard-timeout-bounded and any failure returns
 * source:'none' with available:false (callers should stay silent).
 */
export async function checkForUpdate(currentVersion: string, opts?: { force?: boolean }): Promise<UpdateInfo> {
  const now = Date.now();
  const cached = readCache();
  if (!opts?.force && cached && now - cached.checkedAt < CACHE_TTL_MS) {
    return {
      available: compareSemver(cached.latest, currentVersion) > 0,
      current: currentVersion,
      latest: cached.latest,
      url: cached.url,
      notes: cached.notes,
      source: 'cache',
      checkedAt: cached.checkedAt,
    };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(RELEASE_API, {
      headers: { 'user-agent': `mochi/${currentVersion}`, accept: 'application/vnd.github+json' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { tag_name?: string; name?: string; html_url?: string; body?: string; draft?: boolean; prerelease?: boolean };
    if (data.draft || data.prerelease) throw new Error('no stable release');
    const latest = String(data.tag_name ?? data.name ?? '').replace(/^v/i, '').trim();
    if (!latest) throw new Error('no tag');
    const info: UpdateInfo = {
      available: compareSemver(latest, currentVersion) > 0,
      current: currentVersion,
      latest,
      url: data.html_url,
      notes: data.body,
      source: 'network',
      checkedAt: now,
    };
    writeCache({ latest, url: data.html_url, notes: data.body, checkedAt: now });
    return info;
  } catch {
    // Network failed — fall back to a stale cache if present (better than nothing), else silent.
    if (cached) {
      return {
        available: compareSemver(cached.latest, currentVersion) > 0,
        current: currentVersion,
        latest: cached.latest,
        url: cached.url,
        notes: cached.notes,
        source: 'cache',
        checkedAt: cached.checkedAt,
      };
    }
    return { available: false, current: currentVersion, latest: currentVersion, source: 'none', checkedAt: now };
  }
}

/**
 * Detect how this mochi was installed, so /update picks the right mechanism.
 *  - 'git'     : we live inside a git checkout with the origin remote
 *  - 'install' : installed via install.sh / standalone (no git)
 */
export function detectInstallStyle(repoRoot: string): 'git' | 'install' {
  const gitDir = resolve(repoRoot, '.git');
  return existsSync(gitDir) ? 'git' : 'install';
}

/**
 * Apply the update. Resolves with a human-readable transcript of what
 * happened. For 'git' installs: git fetch/pull --ff-only, npm ci, build.
 * For 'install' installs: re-run the official install.sh (keeps user creds).
 * `run` is injectable for tests.
 */
export async function applyUpdate(
  repoRoot: string,
  log: (line: string) => void,
  run?: (cmd: string, args: string[], cwd: string) => Promise<{ ok: boolean; output: string }>,
): Promise<{ ok: boolean; detail: string }> {
  const exec = run ?? defaultRun;
  const style = detectInstallStyle(repoRoot);
  if (style === 'install') {
    log('Running the official installer (install.sh)...');
    const r = await exec('bash', ['-c', `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash`], repoRoot);
    if (!r.ok) return { ok: false, detail: `Installer failed:\n${r.output}` };
    return { ok: true, detail: 'Update installed. Restart mochi (and run `hash -r` in your shell).' };
  }
  // git checkout path
  log('Fetching latest from origin...');
  const fetch = await exec('git', ['fetch', 'origin', '--tags'], repoRoot);
  if (!fetch.ok) return { ok: false, detail: `git fetch failed:\n${fetch.output}` };
  const status = await exec('git', ['status', '--porcelain'], repoRoot);
  if (status.ok && status.output.trim()) {
    return {
      ok: false,
      detail: 'Your working tree has uncommitted changes. Commit or stash them, then run /update again (a forced update would destroy your work).',
    };
  }
  const pull = await exec('git', ['pull', '--ff-only', 'origin', 'main'], repoRoot);
  log(pull.output.trim() || 'pulled');
  if (!pull.ok) return { ok: false, detail: `git pull failed (diverged?):\n${pull.output}` };
  log('Installing dependencies (npm ci)...');
  const npmci = await exec('npm', ['ci'], repoRoot);
  if (!npmci.ok) {
    log('npm ci failed, falling back to npm install...');
    const npmi = await exec('npm', ['install'], repoRoot);
    if (!npmi.ok) return { ok: false, detail: `npm install failed:\n${npmi.output}` };
  }
  log('Building...');
  const build = await exec('npm', ['run', 'build'], repoRoot);
  if (!build.ok) return { ok: false, detail: `Build failed:\n${build.output}` };
  // Clear the cache so the post-update check reflects the NEW version.
  try { rmSync(cachePath()); } catch { /* ignore */ }
  return { ok: true, detail: 'Update complete. Restart mochi to run the new version.' };
}

async function defaultRun(cmd: string, args: string[], cwd: string): Promise<{ ok: boolean; output: string }> {
  // Route through the shared exec boundary (proc-sites ratchet): runArgv owns
  // spawn, timeouts, tree-kill, and output caps.
  const r = await runArgv(cmd, args, { cwd, timeoutMs: 10 * 60_000, maxOutput: 16 * 1024 * 1024 });
  return { ok: r.code === 0, output: `${r.stdout}${r.stderr ? `\n${r.stderr}` : ''}`.trim() };
}

/** One-line notice text for the TUI (also used by tests to pin the wording). */
export function updateNoticeText(info: UpdateInfo): string | null {
  if (!info.available) return null;
  return `⬆ Mochi ${info.latest} is available (you have ${info.current}). Type /update to install it now.`;
}
