import { basename, resolve } from 'node:path';

/**
 * Normalize a base path to the workspace's `.mochi` state directory.
 *
 * Path helpers were historically split between two call conventions: some were
 * handed the project ROOT and appended `.mochi` themselves, while others were
 * handed the `.mochi` state dir directly. Call sites mixed the two, so a helper
 * that appended `.mochi` unconditionally produced a *second, nested* store
 * (`<root>/.mochi/.mochi/...`) — silently splitting memory, sessions, cron
 * jobs, skill usage, curator reports, and autopsies across two locations and
 * making state appear to vanish between runs.
 *
 * Resolving through this function accepts either form and always yields the
 * single canonical `<root>/.mochi`.
 */
export function mochiStateDir(base: string): string {
  const abs = resolve(base);
  return basename(abs) === '.mochi' ? abs : resolve(abs, '.mochi');
}
