// Harness self-repair ledger + classifier (the "Mochi fixes itself" loop).
//
// Motivation: when a run fails BECAUSE OF THE HARNESS — a tool that crashes on
// a natural input (the EISDIR class), a veto that strangles a legitimate
// workflow, a loop the anti-loop guards themselves induce — the failure signal
// used to die with the run. The next run hit the same wall, forever. Hermes
// keeps what it learns; Mochi now does too:
//
//   1. finish() classifies each failed run: harness-attributable vs plain
//      task failure (bad model output, genuinely hard task — NOT our bug).
//   2. Harness-attributable failures are recorded to a durable ledger
//      (.mochi/reports/harness-issues.json), deduped by a stable signature so
//      the same defect bumps `count` instead of flooding.
//   3. Open issues are injected into later sessions ("known harness issues")
//      so the model can work around them mid-run.
//   4. When the workspace IS Mochi's own source repo (dogfooding) — or
//      `selfRepair: true` is configured — a failed run automatically spawns a
//      repair pass: reproduce, patch src/, add a regression test. Scheduled
//      sweeps via `mochi cron add --schedule "every 6h" "mochi selfheal"`.
//
// Everything here is pure + filesystem-bounded; recording NEVER throws into a
// task's completion path (callers wrap in try/catch).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type HarnessIssueKind =
  | 'tool_error_loop'    // same tool failed with the same error >= 3 times
  | 'veto_storm'         // vetoes (identical reasons or high volume) blocked the run
  | 'stuck_no_progress'  // stopped by the anti-loop heartbeat with nothing changed
  | 'no_progress'        // ran out of iterations with errors and zero file changes
  | 'chat_escape_failed'; // the classifier misread the task as Q&A >= 2 times

export interface HarnessIssue {
  signature: string;
  kind: HarnessIssueKind;
  title: string;
  evidence: string;
  task: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  status: 'open' | 'resolved';
  lastRepairAt?: number;
}

export interface HarnessFailureInput {
  stopReason: string;
  fileChanged: boolean;
  toolCallsTotal: number;
  consecutiveToolErrors: number;
  toolErrors: Array<{ tool: string; error: string }>;
  vetoes: Array<{ tool: string; reason: string }>;
  chatMutationVetoes: number;
  taskText: string;
}

export interface HarnessClassification {
  kind: HarnessIssueKind;
  title: string;
  evidence: string;
  signature: string;
}

/** Strip the volatile parts of an error/veto string (numbers, paths, hex,
 *  durations) so the same defect hashes to the same signature across runs. */
function normalize(text: string): string {
  return text
    .replace(/0x[0-9a-f]+/gi, '0x#')
    .replace(/[a-f0-9]{7,}/gi, '#')
    .replace(/(?:[A-Za-z]:)?[\\/][\w.\\/-]+/g, (m) => m.split(/[\\/]/).pop() || '#')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 300);
}

function dominantRepeat<T>(items: T[], key: (t: T) => string): { key: string; count: number; items: T[] } | null {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = groups.get(k) ?? [];
    arr.push(it);
    groups.set(k, arr);
  }
  let best: { key: string; count: number; items: T[] } | null = null;
  for (const [k, arr] of groups) {
    if (!best || arr.length > best.count) best = { key: k, count: arr.length, items: arr };
  }
  return best && best.count >= 2 ? best : null;
}

function sig(kind: string, evidenceKey: string): string {
  return createHash('sha256').update(`${kind}|${evidenceKey}`).digest('hex').slice(0, 12);
}

const cap = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Decide whether a FAILED run was the harness's fault (and which defect).
 *  Returns null for plain task failures — those must NOT pollute the ledger. */
export function classifyHarnessFailure(input: HarnessFailureInput): HarnessClassification | null {
  // 1. The same tool failing with the same (normalized) error >= 3 times is a
  //    harness/tool defect on a natural input — the model isn't going to
  //    succeed by trying harder. (Pre-fix live example: read({path:'src'})
  //    crashing with EISDIR on every retry.)
  const errDom = dominantRepeat(input.toolErrors, (e) => `${e.tool}|${normalize(e.error)}`);
  if (errDom && errDom.count >= 3) {
    const sample = errDom.items[errDom.items.length - 1]!;
    return {
      kind: 'tool_error_loop',
      title: `${sample.tool} failed ${errDom.count}x with the same error: ${cap(normalize(sample.error), 120)}`,
      evidence: errDom.items.map((e) => `${e.tool}: ${cap(e.error, 200)}`).join('\n').slice(0, 2000),
      signature: sig('tool_error_loop', errDom.key),
    };
  }

  // 2. Veto storms: either >= 3 identical veto reasons (a guard that will not
  //    let a legitimate workflow through) or >= 6 vetoes in one run.
  const vetoDom = dominantRepeat(input.vetoes, (v) => normalize(v.reason));
  if (vetoDom && vetoDom.count >= 3) {
    return {
      kind: 'veto_storm',
      title: `identical veto fired ${vetoDom.count}x: ${cap(vetoDom.key, 120)}`,
      evidence: input.vetoes.map((v) => `${v.tool}: ${cap(v.reason, 200)}`).join('\n').slice(0, 2000),
      signature: sig('veto_storm', vetoDom.key),
    };
  }
  if (input.vetoes.length >= 6) {
    return {
      kind: 'veto_storm',
      title: `${input.vetoes.length} vetoes blocked this run`,
      evidence: input.vetoes.map((v) => `${v.tool}: ${cap(v.reason, 160)}`).join('\n').slice(0, 2000),
      signature: sig('veto_storm', `volume|${input.vetoes.length >= 12 ? '12+' : '6-11'}`),
    };
  }

  // 3. The classifier read a mutating task as Q&A twice — the escape hatch
  //    fired and the model STILL had to force mutations through.
  if (input.chatMutationVetoes >= 2) {
    return {
      kind: 'chat_escape_failed',
      title: 'task misread as chat — mutation vetoes fired twice despite the escape hatch',
      evidence: input.vetoes.map((v) => `${v.tool}: ${cap(v.reason, 200)}`).join('\n').slice(0, 2000),
      signature: sig('chat_escape_failed', normalize(input.taskText)),
    };
  }

  // 4. Anti-loop stop with nothing on disk: the harness's own guards ended the
  //    run and no deliverable exists — either a harness-induced trap or a
  //    mis-scoped task; either way it needs a human/model look, not amnesia.
  if ((input.stopReason === 'stuck_no_progress' || input.stopReason === 'tool_loop' || input.stopReason === 'pulse_abort') && !input.fileChanged) {
    return {
      kind: 'stuck_no_progress',
      title: `run ended by the ${input.stopReason} guard with zero file changes`,
      evidence: [
        `stopReason=${input.stopReason} toolCalls=${input.toolCallsTotal} consecutiveErrors=${input.consecutiveToolErrors}`,
        ...input.toolErrors.slice(-5).map((e) => `${e.tool}: ${cap(e.error, 200)}`),
      ].join('\n').slice(0, 2000),
      signature: sig('stuck_no_progress', `${input.stopReason}|${normalize(input.taskText)}`),
    };
  }

  // 5. Out of iterations with repeated tool errors and nothing written: the
  //    run burned its whole budget fighting the harness.
  if (input.stopReason === 'max_iterations' && !input.fileChanged && input.toolErrors.length >= 3) {
    return {
      kind: 'no_progress',
      title: `ran out of iterations with ${input.toolErrors.length} tool errors and zero file changes`,
      evidence: input.toolErrors.slice(-8).map((e) => `${e.tool}: ${cap(e.error, 200)}`).join('\n').slice(0, 2000),
      signature: sig('no_progress', normalize(input.taskText)),
    };
  }

  return null;
}

// ---- Durable ledger --------------------------------------------------------

export interface HarnessLedger { version: 1; issues: HarnessIssue[] }

const MAX_ISSUES = 50;

/** Ledger path for a workspace dir (the `.mochi` state dir). */
export function harnessIssuesPath(workspaceDir: string): string {
  return resolve(workspaceDir, 'reports', 'harness-issues.json');
}

export function loadHarnessIssues(workspaceDir: string): HarnessLedger {
  try {
    const raw = JSON.parse(readFileSync(harnessIssuesPath(workspaceDir), 'utf8')) as HarnessLedger;
    if (raw && raw.version === 1 && Array.isArray(raw.issues)) return raw;
  } catch { /* missing/corrupt — start fresh */ }
  return { version: 1, issues: [] };
}

function saveLedger(workspaceDir: string, ledger: HarnessLedger): void {
  // Evict: resolved issues first (oldest first), then oldest open — open
  // issues are what the repair loop and session injection act on.
  if (ledger.issues.length > MAX_ISSUES) {
    const rank = (i: HarnessIssue) => (i.status === 'resolved' ? 0 : 1);
    ledger.issues.sort((a, b) => rank(a) - rank(b) || a.lastSeen - b.lastSeen);
    ledger.issues = ledger.issues.slice(ledger.issues.length - MAX_ISSUES);
  }
  const path = harnessIssuesPath(workspaceDir);
  mkdirSync(resolve(workspaceDir, 'reports'), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(ledger, null, 2));
  renameSync(tmp, path);
}

/** Record a classification (dedup by signature — same defect bumps `count`).
 *  Returns the stored issue. Throws only on unreadable state dirs (callers
 *  wrap: recording must never affect task completion). */
export function recordHarnessIssue(
  workspaceDir: string,
  cls: HarnessClassification,
  taskText = '',
  now = Date.now(),
): HarnessIssue {
  const ledger = loadHarnessIssues(workspaceDir);
  const existing = ledger.issues.find((i) => i.signature === cls.signature);
  if (existing) {
    existing.count += 1;
    existing.lastSeen = now;
    existing.evidence = cls.evidence; // freshest evidence wins
    existing.status = 'open'; // a recurrence re-opens a resolved issue
    delete existing.lastRepairAt; // new occurrence → repair eligibility reset
    saveLedger(workspaceDir, ledger);
    return existing;
  }
  const issue: HarnessIssue = {
    signature: cls.signature,
    kind: cls.kind,
    title: cls.title,
    evidence: cls.evidence,
    task: cap(taskText, 300),
    count: 1,
    firstSeen: now,
    lastSeen: now,
    status: 'open',
  };
  ledger.issues.push(issue);
  saveLedger(workspaceDir, ledger);
  return issue;
}

export function listHarnessIssues(workspaceDir: string, opts: { status?: 'open' | 'resolved' } = {}): HarnessIssue[] {
  const all = loadHarnessIssues(workspaceDir).issues;
  return opts.status ? all.filter((i) => i.status === opts.status) : all;
}

export function resolveHarnessIssue(workspaceDir: string, signature: string, now = Date.now()): boolean {
  const ledger = loadHarnessIssues(workspaceDir);
  const issue = ledger.issues.find((i) => i.signature === signature);
  if (!issue) return false;
  issue.status = 'resolved';
  issue.lastSeen = now;
  saveLedger(workspaceDir, ledger);
  return true;
}

export function markRepairAttempt(workspaceDir: string, signature: string, now = Date.now()): void {
  const ledger = loadHarnessIssues(workspaceDir);
  const issue = ledger.issues.find((i) => i.signature === signature);
  if (!issue) return;
  issue.lastRepairAt = now;
  saveLedger(workspaceDir, ledger);
}

/** Compact block injected into later sessions so the model knows the walls
 *  that exist today (and that the self-heal loop owns the root-cause fix).
 *  Empty string when nothing is open — zero prompt cost in the common case. */
export function issuesContextBlock(workspaceDir: string, now = Date.now()): string {
  const open = listHarnessIssues(workspaceDir, { status: 'open' })
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  if (open.length === 0) return '';
  const lines = open.map((i, n) => {
    const days = Math.max(0, Math.round((now - i.lastSeen) / 86_400_000));
    return `${n + 1}) [${i.kind} x${i.count}${days > 0 ? `, last ${days}d ago` : ''}] ${cap(i.title, 160)}`;
  });
  return [
    `Known harness issues (open, auto-repair loop active):`,
    ...lines,
    `If you hit one of these EXACT failures mid-run: work around it, note it in your summary, and continue the task — do not fight it repeatedly. Root-cause patches come from the self-heal loop (mochi selfheal).`,
  ].join('\n');
}

// ---- Repair decisions ------------------------------------------------------

/** True when `cwd` is Mochi's own source repo (dogfooding target): the agent
 *  repairing itself is safe and wanted there; in USER repos it is not (the
 *  harness's source isn't even present — repairs need `selfRepair: true`). */
export function isHarnessRepo(cwd: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8')) as { name?: string };
    if (pkg.name !== 'mochi' && pkg.name !== '@mochi/agent') return false;
    return existsSync(resolve(cwd, 'src', 'agent', 'loop.ts'));
  } catch {
    return false;
  }
}

const REPAIR_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Auto-repair gate: on in the harness repo itself (or when config
 *  selfRepair===true), never for resolved issues, one repair per signature
 *  per 24h (the ledger's lastRepairAt), and callers additionally cap
 *  one spawn per process. */
export function shouldAutoRepair(opts: {
  issue: HarnessIssue;
  isHarnessRepo: boolean;
  configEnabled?: boolean;
  now?: number;
}): boolean {
  const { issue } = opts;
  if (issue.status !== 'open') return false;
  const enabled = opts.configEnabled ?? false;
  if (!opts.isHarnessRepo && !enabled) return false;
  const now = opts.now ?? Date.now();
  if (issue.lastRepairAt && now - issue.lastRepairAt < REPAIR_COOLDOWN_MS) return false;
  return true;
}

/** The repair-pass directive: reproduce → root-cause in src/ → patch →
 *  regression test → scoped verification. Bounded and explicit about marking
 *  non-harness failures resolved so the ledger self-cleans. */
export function buildRepairPrompt(issue: HarnessIssue): string {
  return [
    `[Self-repair pass — harness issue ${issue.signature}]`,
    `A previous run failed in a way attributed to the HARNESS itself, not the task:`,
    ``,
    `Kind: ${issue.kind}`,
    `Title: ${issue.title}`,
    `Seen: ${issue.count}x (first ${new Date(issue.firstSeen).toISOString().slice(0, 10)}, last ${new Date(issue.lastSeen).toISOString().slice(0, 10)})`,
    `Original task: ${issue.task || '(unknown)'}`,
    ``,
    `Evidence:`,
    issue.evidence,
    ``,
    `Your job (only if this workspace is Mochi's source repo — otherwise just reply "not the harness repo"):`,
    `1. Reproduce the failure minimally in a scratch dir (or a focused unit test) — never by re-running the original huge task.`,
    `2. Find the ROOT CAUSE in src/ (tool implementation, gate/veto logic, classifier, prompt). Do not paper over it with prompt text unless the defect IS a prompt.`,
    `3. Patch it, add a REGRESSION test that fails before and passes after, and run that test file plus typecheck (npx vitest run <file>; npx tsc --noEmit).`,
    `4. If investigation shows the failure was task-specific (NOT a harness defect), say so explicitly with the reason.`,
    `5. Do NOT commit — leave the diff for review.`,
  ].join('\n');
}
