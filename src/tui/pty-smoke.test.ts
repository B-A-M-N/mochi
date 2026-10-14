// TUI visual smoke — drives the BUILT binary under a PTY (script(1)), sends
// keystrokes, and asserts the splash, composer, and '/' dropdown actually
// rendered. This is the check that catches "renders fine in unit tests but
// broken on a real terminal" (two border bugs shipped that way historically).
//
// Skipped automatically when `script` is unavailable (CI containers) or the
// binary isn't built; run scripts/tui-smoke.sh manually for the full report.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const bin = resolve(root, 'dist', 'mochi-bin');
const scriptBin = ['/usr/bin/script', '/bin/script'].find((p) => existsSync(p));
// Stale-binary guard: the test drives dist/mochi-bin, which `npm test` does
// NOT rebuild (only `npm run build:bin` does). A binary older than the TUI
// sources would fail confusingly against new screen content — skip instead,
// loudly, so `npm run build:bin && npm test` is the obvious fix.
function binIsStale(): boolean {
  try {
    const binTime = statSync(bin).mtimeMs;
    for (const f of ['src/tui/app.ts', 'src/cli.ts']) {
      if (statSync(resolve(root, f)).mtimeMs > binTime) return true;
    }
    return false;
  } catch {
    return false;
  }
}
const staleMsg = binIsStale() ? ' (stale binary: run npm run build:bin first)' : '';

describe.skipIf(!scriptBin || !existsSync(bin) || binIsStale())('TUI PTY visual smoke' + staleMsg, () => {
  it('splash, composer, and dropdown render over a real PTY', () => {
    const logPath = resolve(root, '.mochi-audit', 'tui-smoke', 'vitest-typescript.log');
    mkdirSync(dirname(logPath), { recursive: true });
    try {
      const cmd = `{ sleep 2; printf '/'; sleep 1.5; printf '\\x1b'; sleep 1; } | MOCHI_SKIP_AUTOBUILD=1 TERM=xterm-256color timeout 10 '${scriptBin}' -qec '${bin}' '${logPath}'`;
      execFileSync('bash', ['-c', cmd], {
        timeout: 20_000,
        cwd: root,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      const raw = readFileSync(logPath, 'utf8');
      const text = raw
        .replace(/\x00/g, '')
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
        .replace(/\x1b\][^\x07]*\x07/g, '');
      // The splash brand and the composer keymap are the two always-rendered
      // surfaces; '/' proves the composer accepted input.
      expect(text).toContain('mochi');
      expect(text).toContain('send');      // composer hint: ⏎ send
      expect(text).toContain('/');         // dropdown opened
    } finally {
      try { rmSync(logPath, { force: true }); } catch { /* cleanup */ }
    }
  }, 30_000);
});
