// Greenfield + file-output heuristics (pure, deterministic, no model calls).
//
// A greenfield task builds brand-new files (game, app, website, CLI, bot)
// that don't exist yet. Greenfield work must NEVER trigger the repo-wide
// test/typecheck/lint/build suite — that suite exercises unrelated repo code
// (the "just tests instead of building" failure class). Cheap direct checks
// (test -f, syntax check) are the proportionate verification.
//
// Kept in core (not agent/loop) so both the agent loop and the verification
// engine can use it without an import cycle.

/** Does an implement/fix/refactor task promise file output? Stops prose-only
 *  "completions" (e.g. "code a game" answering with a description). Triggered
 *  by an explicit fileScope, file-shaped acceptance criteria, or a task that
 *  LEADS with a creation verb ("code a game", "create X", "build Y"). The
 *  lead-verb rule is deliberately narrow: matching creation words anywhere
 *  ("fix the build", "write x.txt (will be vetoed)") misfires on tasks whose
 *  prose-only finish is legitimate, and the harness tests pin those budgets. */
export function expectsFileOutput(
  title: string,
  description = '',
  taskKind = '',
  fileScope?: string[],
  acceptanceCriteria: string[] = [],
): boolean {
  if (taskKind === 'chat' || taskKind === 'research' || taskKind === 'plan') return false;
  if (fileScope && fileScope.length > 0) return true;
  if (acceptanceCriteria.some((c) => /exists?|file|created|contains?|grep|test -f|\.[a-z]{1,5}\b/i.test(c))) return true;
  const text = `${title} ${description}`.trim().toLowerCase();
  return /^(build|make|create|write|code|implement|scaffold|generate|develop|program)\b/.test(text);
}

/** Is this a greenfield task (new files that don't exist yet) rather than an
 *  edit to existing repo code? `exists` is injectable for tests. */
export function isGreenfieldTask(
  title: string,
  description = '',
  fileScope?: string[],
  exists: (p: string) => boolean = () => false,
): boolean {
  const text = `${title} ${description}`.toLowerCase();
  const creationVerb = /\b(build|make|create|write|code|implement|scaffold|generate|develop|program|new)\b/.test(text);
  const greenfieldNoun = /\b(game|playable|platformer|snake|tetris|pong|app|website|webapp|web app|cli|bot|dashboard|engine|script|file|page|component)\b/.test(text);
  if (fileScope && fileScope.length > 0) {
    try {
      if (fileScope.every((f) => !exists(f))) return true;
    } catch { return creationVerb; }
    return false;
  }
  // No fileScope: a creation-verb + greenfield-noun implement request with no
  // scoped paths is a from-scratch build by definition.
  return creationVerb && greenfieldNoun;
}
