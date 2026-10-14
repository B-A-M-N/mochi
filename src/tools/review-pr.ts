// review_pr — review a GitHub PR like a senior engineer triaging it.
// Fetches the PR (metadata + diff) via the ambient `gh` CLI, runs the
// harness's own static checks over the diff (hygiene scan: debug leftovers,
// TODO markers, focused tests), and reports a structured review the calling
// agent reasons over. With post=true it also leaves a summary comment on the
// PR (explicit only — reading a PR never writes).
//
// What it is NOT: an approval gate. It never approves/merges/closes anything;
// `gh pr merge` stays a human keystroke. Findings are evidence (file + line
// + rule), not verdicts.

import type { Tool } from './types.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { scanDiffForHygiene, renderHygieneFindings } from '../core/diff-hygiene.js';

const execFileAsync = promisify(execFile);

/** Run a command, resolving combined output. Never rejects. Bounded so a hung
 *  gh can't stall the loop. */
async function run(cmd: string, args: string[], cwd: string, timeoutMs = 60_000): Promise<{ out: string; code: number }> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { cwd, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
    return { out: String(stdout ?? '').replace(/\n+$/, ''), code: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string; code?: number };
    return { out: String(e.stdout || e.stderr || e.message || '').trim(), code: typeof e.code === 'number' ? e.code : 1 };
  }
}

interface PrMeta {
  number: number;
  title: string;
  author: string;
  base: string;
  head: string;
  url: string;
  additions: number;
  deletions: number;
  files: Array<{ path: string; additions: number; deletions: number }>;
}

async function fetchPr(pr: number, cwd: string, repo?: string): Promise<{ meta?: PrMeta; error?: string }> {
  const base = ['pr', 'view', String(pr), '--json', 'number,title,author,baseRefName,headRefName,url,additions,deletions,files'];
  if (repo) base.push('--repo', repo);
  const r = await run('gh', base, cwd);
  if (r.code !== 0 || !r.out.startsWith('{')) {
    if (/command not found|ENOENT|spawn gh/i.test(r.out)) {
      return { error: 'gh CLI not found on PATH. Install it (https://cli.github.com) and run `gh auth login`.' };
    }
    if (/Could not resolve to a|not found|404|no pull requests/i.test(r.out)) {
      return { error: `PR #${pr} not found${repo ? ` in ${repo}` : ''} (or gh is not authenticated — run \`gh auth login\`).` };
    }
    return { error: `Could not fetch PR #${pr}: ${r.out.slice(0, 220)}` };
  }
  try {
    const j = JSON.parse(r.out) as Record<string, unknown>;
    const files = Array.isArray(j.files) ? (j.files as Array<Record<string, unknown>>) : [];
    return {
      meta: {
        number: Number(j.number ?? pr),
        title: String(j.title ?? ''),
        author: String((j.author as Record<string, unknown> | undefined)?.login ?? 'unknown'),
        base: String(j.baseRefName ?? ''),
        head: String(j.headRefName ?? ''),
        url: String(j.url ?? ''),
        additions: Number(j.additions ?? 0),
        deletions: Number(j.deletions ?? 0),
        files: files.map((f) => ({
          path: String(f.path ?? ''),
          additions: Number(f.additions ?? 0),
          deletions: Number(f.deletions ?? 0),
        })).filter((f) => f.path),
      },
    };
  } catch {
    return { error: `Could not parse PR #${pr} metadata.` };
  }
}

export const reviewPrTool: Tool = {
  def: {
    name: 'review_pr',
    description:
      'Review a GitHub pull request: fetch its metadata + diff via the ambient `gh` CLI and report a structured review (changed files, size, static hygiene findings) for you to reason over. Pass post=true to also leave a summary comment on the PR. Read-only by default; never approves or merges.',
    parameters: [
      { name: 'pr', type: 'number', description: 'PR number to review', required: true },
      { name: 'repo', type: 'string', description: 'owner/repo (default: cwd origin remote)', required: false },
      { name: 'post', type: 'boolean', description: 'Leave a summary comment on the PR (default false)', required: false },
      { name: 'focus', type: 'string', description: 'Review lens: correctness, security, or performance (shapes the checklist, default correctness)', required: false },
    ],
    permission: 'shell',
  },
  async execute(args, ctx) {
    const num = Number(args.pr);
    if (!Number.isInteger(num) || num <= 0) return 'review_pr needs a PR number, e.g. {pr: 123}.';
    const repo = typeof args.repo === 'string' && args.repo.trim() ? args.repo.trim() : undefined;
    if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) return `Bad repo "${repo}" — use owner/name.`;
    const post = args.post === true;
    const focus = typeof args.focus === 'string' ? args.focus.toLowerCase() : 'correctness';
    const lens = ['correctness', 'security', 'performance'].includes(focus) ? focus : 'correctness';

    const { meta, error } = await fetchPr(num, ctx.cwd, repo);
    if (!meta) return error ?? `Could not fetch PR #${num}.`;

    const diffArgs = ['pr', 'diff', String(num)];
    if (repo) diffArgs.push('--repo', repo);
    const diff = await run('gh', diffArgs, ctx.cwd);
    const diffText = diff.code === 0 ? diff.out : '';
    const capped = diffText.length > 60_000 ? diffText.slice(0, 60_000) + `\n… [diff truncated at 60KB of ${diffText.length} bytes]` : diffText;
    const hygiene = capped ? scanDiffForHygiene(capped) : [];

    const fileLines = meta.files.slice(0, 30).map((f) => `  ${f.path} (+${f.additions}/-${f.deletions})`).join('\n');
    const moreFiles = meta.files.length > 30 ? `\n  … (+${meta.files.length - 30} more files)` : '';
    const checklist = lens === 'security'
      ? 'Checklist (security lens): untrusted input paths; auth checks on new endpoints; secrets/keys in diff; injection (SQL/shell/template); over-broad permissions; sensitive data in logs.'
      : lens === 'performance'
        ? 'Checklist (performance lens): N+1 queries; missing indexes on new queries; hot-loop allocations; unbounded pagination; sync I/O on request path; cache invalidation gaps.'
        : 'Checklist (correctness lens): off-by-one/boundary conditions; null/undefined handling; error paths tested; behavior matches the PR description; no dead code or stray debug leftovers.';
    const hygieneBlock = hygiene.length
      ? `\nStatic findings (verify each against the diff before citing):\n${renderHygieneFindings(hygiene)}`
      : '\nStatic findings: none (no debug logs, TODOs, or focused tests detected in the diff).';

    const report = [
      `PR #${meta.number}: ${meta.title}`,
      `by ${meta.author} · ${meta.head} → ${meta.base} · +${meta.additions}/-${meta.deletions}${meta.url ? ` · ${meta.url}` : ''}`,
      `Files (${meta.files.length}):`,
      fileLines + moreFiles,
      checklist,
      hygieneBlock,
      '',
      'Diff (capped, inspect before concluding):',
      capped || '(diff unavailable — review from metadata only)',
    ].join('\n');

    if (!post) return report + '\n\nRead-only review (post=false). Pass post=true to leave this summary as a PR comment.';
    const comment = await run('gh', [...(repo ? ['--repo', repo] : []), 'pr', 'comment', String(num), '--body', report.slice(0, 60_000)], ctx.cwd);
    if (comment.code !== 0) return `${report}\n\nComment post FAILED (PR left untouched): ${comment.out.slice(0, 200)}`;
    return `${report}\n\nPosted as a PR comment.`;
  },
};
