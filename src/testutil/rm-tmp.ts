import { rmSync } from 'node:fs';

/**
 * Windows-resilient recursive temp-dir removal.
 *
 * On Windows, an open SQLite handle (or any file handle still held by a
 * watcher/worker) makes rmSync fail with EBUSY/EPERM — the handle closes a
 * tick later, so a short retry loop fixes it without weakening the test.
 * Retries up to 5 times with 100ms gaps, then gives up silently (force-like)
 * so a stale temp dir never fails a green-on-Linux suite.
 */
export function rmTmp(dir: string): void {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== 'EBUSY' && code !== 'EPERM' && code !== 'ENOTEMPTY') return;
      if (attempt < 4) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      }
    }
  }
}
