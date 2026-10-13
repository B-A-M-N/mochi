import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { isNewer, currentVersion, maybeCheckUpdate } from './update-check.js';

describe('update-check version compare', () => {
  it('detects newer releases', () => {
    expect(isNewer('0.24.0', '0.23.0')).toBe(true);
    expect(isNewer('0.23.0', '0.23.0')).toBe(false);
    expect(isNewer('0.22.9', '0.23.0')).toBe(false);
    expect(isNewer('1.0.0', '0.23.0')).toBe(true);
    expect(isNewer('v0.24.0', '0.23.0')).toBe(true);
  });

  it('ignores prerelease suffixes when comparing numerically', () => {
    expect(isNewer('1.0.0-rc.1', '0.9.9')).toBe(true);
    expect(isNewer('1.0.0', '1.0.0-rc.1')).toBe(false);
    expect(isNewer('0.0.1', '0.0.1')).toBe(false);
  });

  it('currentVersion reads the shipped package version', () => {
    expect(currentVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('maybeCheckUpdate', () => {
  let home: string;
  let savedHome: string | undefined;
  let savedProfile: string | undefined;
  let savedVitest: string | undefined;
  let savedNoCheck: string | undefined;
  let savedTTY: unknown;
  let errSpy: ReturnType<typeof vi.spyOn>;
  const cacheFile = () => join(home, '.config', 'mochi', 'update-check.json');

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'mochi-upd-'));
    savedHome = process.env.HOME;
    savedProfile = process.env.USERPROFILE;
    process.env.HOME = home;
    // os.homedir() on win32 reads USERPROFILE, NOT HOME — stage both so the
    // cache lands in the throwaway dir on every platform (feedback.test pattern).
    process.env.USERPROFILE = home;
    savedVitest = process.env.VITEST;
    savedNoCheck = process.env.MOCHI_NO_UPDATE_CHECK;
    // maybeCheckUpdate deliberately no-ops under test runners and non-TTY
    // stderr — remove both guards so the real cache/fetch logic is exercised.
    delete process.env.VITEST;
    delete process.env.MOCHI_NO_UPDATE_CHECK;
    savedTTY = process.stderr.isTTY;
    Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network disabled'); }));
  });

  afterEach(() => {
    if (savedHome === undefined) delete process.env.HOME; else process.env.HOME = savedHome;
    if (savedProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = savedProfile;
    if (savedVitest === undefined) delete process.env.VITEST; else process.env.VITEST = savedVitest;
    if (savedNoCheck === undefined) delete process.env.MOCHI_NO_UPDATE_CHECK; else process.env.MOCHI_NO_UPDATE_CHECK = savedNoCheck;
    Object.defineProperty(process.stderr, 'isTTY', { value: savedTTY, configurable: true });
    errSpy.mockRestore();
    vi.unstubAllGlobals();
    rmSync(home, { recursive: true, force: true });
  });

  it('honors the opt-out env var without fetching', async () => {
    process.env.MOCHI_NO_UPDATE_CHECK = '1';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await maybeCheckUpdate();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('stays silent when stderr is not a TTY', async () => {
    Object.defineProperty(process.stderr, 'isTTY', { value: false, configurable: true });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await maybeCheckUpdate();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('fetches, caches, and warns when a newer release exists', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ tag_name: 'v99.0.0' }) }));
    vi.stubGlobal('fetch', fetchMock);
    await maybeCheckUpdate();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(existsSync(cacheFile())).toBe(true);
    expect(JSON.parse(readFileSync(cacheFile(), 'utf8')).latest).toBe('99.0.0');
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes('update available'))).toBe(true);
  });

  it('reuses a fresh cache without refetching', async () => {
    mkdirSync(dirname(cacheFile()), { recursive: true });
    writeFileSync(cacheFile(), JSON.stringify({ at: Date.now(), latest: '99.0.0' }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await maybeCheckUpdate();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes('update available'))).toBe(true);
  });

  it('stays quiet when the cached latest is not newer', async () => {
    mkdirSync(dirname(cacheFile()), { recursive: true });
    writeFileSync(cacheFile(), JSON.stringify({ at: Date.now(), latest: '0.0.1' }));
    vi.stubGlobal('fetch', vi.fn());
    await maybeCheckUpdate();
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('ignores a stale cache and re-fetches', async () => {
    mkdirSync(dirname(cacheFile()), { recursive: true });
    writeFileSync(cacheFile(), JSON.stringify({ at: Date.now() - 25 * 3600 * 1000, latest: '99.0.0' }));
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ tag_name: '0.0.1' }) }));
    vi.stubGlobal('fetch', fetchMock);
    await maybeCheckUpdate();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(cacheFile(), 'utf8')).latest).toBe('0.0.1');
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes('update available'))).toBe(false);
  });

  it('swallows non-ok responses and network errors without caching', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await expect(maybeCheckUpdate()).resolves.toBeUndefined();
    expect(existsSync(cacheFile())).toBe(false);

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom'); }));
    await expect(maybeCheckUpdate()).resolves.toBeUndefined();
    expect(existsSync(cacheFile())).toBe(false);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('ignores a tag_name that is not a string', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ tag_name: 42 }) })));
    await maybeCheckUpdate();
    expect(existsSync(cacheFile())).toBe(false);
  });
});
