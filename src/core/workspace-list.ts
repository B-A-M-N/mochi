// Compact workspace file listing, injected once at run start.
//
// Purpose: kill the "let me list the directory first" model round-trip. In
// arena timings the discovery turn cost ~2-3s per task even though the
// harness ALREADY knows the workspace — shipping the listing in the prompt
// lets the model read the right files in turn 1 (in parallel) instead of
// spending a full network round-trip to enumerate them.
//
// Deliberately full-or-nothing: small workspaces (greenfield builds, scripts,
// answer tasks, most new dirs) get the complete listing under a byte cap;
// larger workspaces get NOTHING and keep using the tree/glob tools on demand,
// so the prompt never carries a misleading half-tree or bloats on a big repo.
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Directories that are never part of the task surface. */
const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.mochi',
  'target', '.next', '.nuxt', 'vendor', '__pycache__', '.venv', 'venv',
  '.pytest_cache', '.turbo', '.cache', '.gradle', '.idea',
]);

/** Dot-directories worth listing despite the dot-file rule. */
const KEEP_DOT_DIRS = new Set(['.github', '.claude', '.cursor', '.vscode']);

/** Byte cap for the listing (~1.5-2K tokens). */
const MAX_BYTES = 6000;

const MAX_DEPTH = 8;

/** Sorted relative paths of every file in a small workspace, or null when the
 *  workspace is empty, unreadable, or over the byte cap (skip the injection
 *  entirely rather than ship a truncated tree). */
export function collectWorkspaceFiles(
  cwd: string,
  opts: { maxBytes?: number; maxDepth?: number } = {},
): string[] | null {
  const maxBytes = opts.maxBytes ?? MAX_BYTES;
  const maxDepth = opts.maxDepth ?? MAX_DEPTH;
  const files: string[] = [];
  let bytes = 0;

  const walk = (dir: string, depth: number): boolean => {
    if (depth > maxDepth) return false;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return true; // unreadable dir: skip it, keep the rest
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name)) continue;
        if (e.name.startsWith('.') && !KEEP_DOT_DIRS.has(e.name)) continue;
        if (!walk(join(dir, e.name), depth + 1)) return false;
      } else if (e.isFile()) {
        const rel = relative(cwd, join(dir, e.name)).split(sep).join('/');
        bytes += rel.length + 1;
        if (bytes > maxBytes) return false;
        files.push(rel);
      }
      // Symlinks and specials are skipped: no cycles, no outside-tree walks.
    }
    return true;
  };

  if (!walk(cwd, 0)) return null;
  return files.length > 0 ? files : null;
}

/** The system message for the run, or null when there is nothing safe to say. */
export function workspaceListMessage(cwd: string): string | null {
  const files = collectWorkspaceFiles(cwd);
  if (!files) return null;
  return `Workspace files (${files.length}):\n${files.join('\n')}\nThese paths are authoritative — read them directly (in parallel) instead of listing directories first.`;
}
