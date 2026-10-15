import { writeFileSync, renameSync, mkdirSync, existsSync, unlinkSync, lstatSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Write `content` to `filePath` atomically: create a hidden sibling temp file,
 * then rename it over the target. `rename` is atomic within a filesystem, so a
 * crash, SIGKILL, OOM, or power loss mid-write can never leave a half-written /
 * truncated file — a reader sees either the whole old file or the whole new one.
 *
 * Mochi's edit tools previously called `writeFileSync` directly, so killing the
 * process (or the agent's own parallel tool batch) while a file was being
 * rewritten could corrupt it. This mirrors how production editors save.
 *
 * Deliberately conservative so it is never WORSE than a plain write:
 *   - preserves the existing file's permission bits,
 *   - falls back to a direct write for symlinks (rename would replace the link
 *     itself, not its target),
 *   - falls back to a direct write if the rename fails for any reason.
 */
export function atomicWriteFileSync(filePath: string, content: string): void {
  const dir = dirname(filePath);
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  } catch {
    /* fall through to the direct write below, which reports the real error */
  }

  let mode: number | undefined;
  try {
    const st = lstatSync(filePath);
    if (st.isSymbolicLink()) {
      writeFileSync(filePath, content);
      return;
    }
    mode = st.mode & 0o777;
  } catch {
    /* target does not exist yet — default mode applies */
  }

  const tmp = join(dir, `.${basename(filePath)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`);
  try {
    writeFileSync(tmp, content, mode !== undefined ? { mode } : undefined);
    renameSync(tmp, filePath);
  } catch {
    try { unlinkSync(tmp); } catch { /* best effort */ }
    writeFileSync(filePath, content);
  }
}
