import { readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { homedir } from 'node:os';
import type { Tool } from './types.js';
import { clipToolOutput } from './output-budget.js';

// Bound the walk: a tree of a large repo (or a mistyped depth on $HOME) must not
// block the event loop for seconds or emit a result that blows the context. The
// sync recursion stops at this many nodes; the rendered string is clipped by the
// shared tool-result budget.
const MAX_TREE_NODES = 20_000;

function matchesExclude(name: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const p = pattern.trim();
    if (!p) continue;
    // Simple glob: support * wildcard
    const re = new RegExp('^' + p.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    if (re.test(name)) return true;
    if (name === p) return true;
  }
  return false;
}

function buildTree(
  dir: string,
  depth: number,
  maxDepth: number,
  excludePatterns: string[],
  prefix: string,
  lines: string[],
  budget: { nodes: number },
): void {
  if (depth > maxDepth) return;
  let entries: string[];
  try {
    entries = readdirSync(dir).sort();
  } catch {
    return;
  }
  const filtered = entries.filter((e) => !matchesExclude(e, excludePatterns));
  for (let i = 0; i < filtered.length; i++) {
    if (budget.nodes >= MAX_TREE_NODES) return;
    const entry = filtered[i];
    const isLast = i === filtered.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const fullPath = join(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(fullPath).isDirectory();
    } catch {
      isDir = false;
    }
    lines.push(`${prefix}${connector}${entry}${isDir ? '/' : ''}`);
    budget.nodes++;
    if (isDir) {
      if (dir === homedir() && existsSync(join(fullPath, '.git'))) {
        continue;
      }
      buildTree(fullPath, depth + 1, maxDepth, excludePatterns, childPrefix, lines, budget);
    }
  }
}

export const treeTool: Tool = {
  def: {
    name: 'tree',
    description: 'List a directory as a visual tree (like the `tree` command). Useful for understanding project structure.',
    parameters: [
      { name: 'path', type: 'string', description: 'Directory path (defaults to cwd)', required: false },
      { name: 'depth', type: 'integer', description: 'Maximum depth (default 3)', required: false },
      { name: 'exclude', type: 'string', description: 'Comma-separated patterns to exclude, e.g. "node_modules,.git,dist"', required: false },
    ],
    permission: 'read',
  },
  async execute(args, ctx) {
    const raw = args.path ? String(args.path) : '';
    const dir = raw ? (raw === '~' ? homedir() : raw.startsWith('~/') ? resolve(homedir(), raw.slice(2)) : resolve(ctx.cwd, raw)) : ctx.cwd;
    if (!existsSync(dir)) throw new Error(`Directory not found: ${dir}`);
    const maxDepth = args.depth ? Math.max(1, Math.min(10, Number(args.depth))) : 3;
    const excludePatterns = args.exclude
      ? String(args.exclude).split(',').map((s) => s.trim()).filter(Boolean)
      : ['node_modules', '.git', 'dist', '.next', '.cache', '__pycache__', '*.pyc'];
    const lines: string[] = [basename(dir) + '/'];
    const budget = { nodes: 0 };
    buildTree(dir, 1, maxDepth, excludePatterns, '', lines, budget);
    const body = lines.join('\n');
    const clipped = clipToolOutput(body);
    return budget.nodes >= MAX_TREE_NODES ? `${clipped}\n(tree truncated after ${MAX_TREE_NODES} entries — raise depth/exclude or use glob)` : clipped;
  },
};
