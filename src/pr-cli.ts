// `mochi pr review <number>` — headless PR review core (team/CI workflow).
//
// Wraps the review_pr tool for non-interactive use: CI jobs, pre-merge bots,
// and scripting. Output is human-readable by default and `--json` for tooling.
// Exit codes are the contract:
//   0 — review produced (findings are informational; humans still decide)
//   1 — usage error or the PR could not be fetched (gh missing/auth)
//   2 — internal failure (should never happen; surfaced verbatim)
// `--post` leaves the summary comment on the PR (explicit, never default).
// Nothing here approves, merges, or closes — merge stays a human keystroke.

import { reviewPrTool } from './tools/review-pr.js';
import { EventBus } from './events.js';
import type { ToolContext } from './tools/types.js';
import type { MochiConfig } from './types.js';

export interface PrReviewArgs {
  /** PR number (required, positional after `pr review`). */
  pr: number;
  /** owner/repo override (default: cwd origin remote). */
  repo?: string;
  /** Leave the summary comment on the PR. */
  post: boolean;
  /** Emit machine-readable JSON instead of the rendered report. */
  json: boolean;
  /** Review lens. */
  focus: 'correctness' | 'security' | 'performance';
}

export type PrReviewExit = 0 | 1 | 2;

/** Parse `mochi pr review …` from the CLI's pre-parsed argv: positional tokens
 *  (the PR number) plus the flag dict (`--post`, `--json`, `--repo`, `--focus`).
 *  Returns an error string for the caller to print — never throws. */
export function parsePrReviewArgs(tokens: string[], flags: Record<string, string | boolean> = {}): PrReviewArgs | string {
  let pr: number | undefined;
  let repo: string | undefined;
  let post = false;
  let json = false;
  let focus: 'correctness' | 'security' | 'performance' = 'correctness';

  for (const t of tokens) {
    if (t.startsWith('--')) continue; // flags were pre-parsed by the CLI
    const n = Number(t);
    if (!Number.isInteger(n) || n <= 0) return `Bad PR number "${t}" — expected a positive integer.`;
    if (pr !== undefined) return `Unexpected extra argument "${t}" (PR number already ${pr}).`;
    pr = n;
  }

  if (flags.post === true) post = true;
  if (flags.json === true) json = true;
  if (typeof flags.repo === 'string') {
    repo = flags.repo;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return `Bad --repo "${repo}" — use owner/name.`;
  }
  const focusFlag = typeof flags.focus === 'string' ? flags.focus : undefined;
  if (focusFlag !== undefined) {
    if (focusFlag !== 'correctness' && focusFlag !== 'security' && focusFlag !== 'performance') {
      return `Bad --focus "${focusFlag}" — use correctness, security, or performance.`;
    }
    focus = focusFlag;
  }

  if (pr === undefined) return 'Usage: mochi pr review <number> [--repo owner/name] [--focus correctness|security|performance] [--post] [--json]';
  return { pr, repo, post, json, focus };
}

/** Build the ToolContext the review tool needs (cwd + minimal config). */
function reviewCtx(cwd: string): ToolContext {
  return {
    cwd,
    workspace: { dir: cwd, root: cwd } as ToolContext['workspace'],
    config: { permissions: { shell: true }, safety: { mode: 'auto' } } as unknown as MochiConfig,
    events: new EventBus(),
    agentId: 'cli-pr-review',
  } as ToolContext;
}

/** Structured result for --json consumers (CI bots, dashboards). */
export interface PrReviewJson {
  ok: boolean;
  pr?: number;
  error?: string;
  /** Hygiene finding counts keyed by kind (debug_log, todo, focused_test…). */
  findings?: Record<string, number>;
  report?: string;
}

/** Run the review. Returns the exit code; prints to stdout/stderr itself so
 *  the CLI caller is a thin dispatch (keeps this module the tested unit). */
export async function runPrReview(args: PrReviewArgs, cwd: string): Promise<PrReviewExit> {
  let out: string;
  try {
    out = await reviewPrTool.execute(
      { pr: args.pr, ...(args.repo ? { repo: args.repo } : {}), post: args.post, focus: args.focus },
      reviewCtx(cwd),
    ) as string;
  } catch (err) {
    // The tool never throws by contract; belt-and-braces so CI never sees a
    // stack trace where an exit code belongs.
    const msg = err instanceof Error ? err.message : String(err);
    if (args.json) {
      const payload: PrReviewJson = { ok: false, error: msg };
      console.log(JSON.stringify(payload));
    } else {
      console.error(`review failed: ${msg}`);
    }
    return 2;
  }

  // Tool-level failures (gh missing, PR 404) are usage-class: exit 1 so CI
  // distinguishes "couldn't review" from "reviewed, here are notes".
  const fetchFailed = /^(gh CLI not found|PR #\d+ not found|Could not fetch|Could not parse|Bad repo)/.test(out)
    || out.startsWith('review_pr needs');
  if (fetchFailed) {
    if (args.json) {
      const payload: PrReviewJson = { ok: false, pr: args.pr, error: out };
      console.log(JSON.stringify(payload));
    } else {
      console.error(out);
    }
    return 1;
  }

  // Hygiene findings rendered by the tool use `- [kind] file:line — text`;
  // count them by kind for the JSON shape (the pipeline's [HIGH] format is a
  // different renderer — parsing it here would always yield zero).
  const hygiene: Record<string, number> = {};
  for (const raw of out.split('\n')) {
    const m = /^\s*-\s*\[([a-z_]+)\]\s+\S+:\d+/i.exec(raw);
    if (m) hygiene[m[1].toLowerCase()] = (hygiene[m[1].toLowerCase()] ?? 0) + 1;
  }
  const findings = hygiene;

  if (args.json) {
    const payload: PrReviewJson = { ok: true, pr: args.pr, findings, report: out };
    console.log(JSON.stringify(payload));
  } else {
    console.log(out);
  }
  return 0;
}
