import { describe, it, expect } from 'vitest';
import { classifyTaskKind, kindHint, resolveAutoReasoning, isReviewTask, scoreTaskComplexity, isComplexTask, shouldEscalateComplexity } from './taskkind.js';

describe('classifyTaskKind', () => {
  it('classifies a bug-fix task as fix', () => {
    expect(classifyTaskKind({ title: 'Fix login bug', description: 'users see 500' })).toBe('fix');
    expect(classifyTaskKind({ title: 'Crash on startup', description: 'segfault in foo()' })).toBe('fix');
  });
  it('classifies refactor tasks', () => {
    expect(classifyTaskKind({ title: 'Refactor util module', description: 'split the helpers' })).toBe('refactor');
    expect(classifyTaskKind({ title: 'Rename Foo to Bar', description: 'across the codebase' })).toBe('refactor');
  });
  it('classifies test tasks', () => {
    expect(classifyTaskKind({ title: 'Add unit tests for parser', description: 'with vitest' })).toBe('test');
    expect(classifyTaskKind({ title: 'Improve coverage', description: 'target 90%' })).toBe('test');
  });
  it('classifies research/plan/document', () => {
    expect(classifyTaskKind({ title: 'Investigate the auth flow', description: 'how does the session live?' })).toBe('research');
    expect(classifyTaskKind({ title: 'Design the new schema', description: 'outline tables' })).toBe('plan');
    expect(classifyTaskKind({ title: 'Document the API', description: 'readme updates' })).toBe('document');
  });
  it('classifies conversational queries as chat', () => {
    expect(classifyTaskKind({ title: 'hello', description: 'hello' })).toBe('chat');
    expect(classifyTaskKind({ title: 'hey there', description: 'how are you doing?' })).toBe('chat');
    expect(classifyTaskKind({ title: 'who are you', description: 'who are you' })).toBe('chat');
  });
  it('routes short casual/typo messages to chat, not the coding pipeline', () => {
    // Real user messages from the live session that used to fall through to
    // 'implement' (git preflight + coding focus) and produced canned replies.
    expect(classifyTaskKind({ title: 'hewwo', description: 'hewwo' })).toBe('chat');
    expect(classifyTaskKind({ title: 'whats can u do', description: 'whats can u do' })).toBe('chat');
    expect(classifyTaskKind({ title: 'you there?', description: 'you there?' })).toBe('chat');
    expect(classifyTaskKind({ title: 'wassup', description: 'wassup' })).toBe('chat');
    expect(classifyTaskKind({ title: 'what issues does mochi have if it has any', description: 'what issues does mochi have if it has any', role: 'coder' as any })).toBe('chat');
    expect(classifyTaskKind({ title: 'so its still better than ever rn', description: 'so its still better than ever rn', role: 'coder' as any })).toBe('chat');
    expect(classifyTaskKind({ title: 'is mochi a single runtime', description: 'is mochi a single runtime', role: 'coder' as any })).toBe('chat');
  });
  it('routes imperative questions with action verbs to fix/implement', () => {
    expect(classifyTaskKind({ title: 'Can you fix the bug in loop.ts?', description: 'it has an issue' })).toBe('fix');
    expect(classifyTaskKind({ title: 'Could you implement the new feature?', description: 'add user profiles' })).toBe('implement');
  });
  it('still routes short action messages to implement', () => {
    expect(classifyTaskKind({ title: 'Code a calculator.', description: 'Code a calculator.' })).toBe('implement');
    expect(classifyTaskKind({ title: 'open the calculator', description: 'open the calculator' })).toBe('implement');
    expect(classifyTaskKind({ title: 'code a game', description: 'code a game' })).toBe('implement');
  });
  it('falls back to implement for unknown shapes', () => {
    expect(classifyTaskKind({ title: 'Add export to foo', description: 'export const x' })).toBe('implement');
    expect(classifyTaskKind({ title: '', description: '' })).toBe('unknown');
  });
  it('prefers explicit execution verbs over design/planning vocabulary', () => {
    expect(classifyTaskKind({ title: 'Design and implement the new schema', description: 'Design and implement the new schema' })).toBe('implement');
    expect(classifyTaskKind({ title: 'Design and build the dashboard', description: 'Design and build the dashboard' })).toBe('implement');
    expect(classifyTaskKind({ title: 'Execute the approved plan', description: 'Execute the approved plan now' })).toBe('implement');
    expect(classifyTaskKind({ title: 'Create a project plan', description: 'Write only a project plan, no code changes' })).toBe('plan');
    expect(classifyTaskKind({ title: 'Design the new schema', description: 'outline tables' })).toBe('plan');
  });
  it('honors the role field', () => {
    expect(classifyTaskKind({ title: 'Whatever', description: 'whatever', role: 'debugger' })).toBe('fix');
    expect(classifyTaskKind({ title: 'Whatever', description: 'whatever', role: 'tester' })).toBe('test');
    expect(classifyTaskKind({ title: 'Whatever', description: 'whatever', role: 'architect' })).toBe('plan');
  });
  it('routes review intent to research (never chat-starved)', () => {
    // Reviews were chat-tier: 7 tools, low effort, 3-round cutoff.
    expect(classifyTaskKind({ title: 'Review my PR', description: 'check PR #123 for correctness' })).toBe('research');
    expect(classifyTaskKind({ title: 'Can you review my PR?', description: 'correctness pass' })).toBe('research');
    expect(classifyTaskKind({ title: 'Audit the auth module', description: 'security review' })).toBe('research');
    expect(classifyTaskKind({ title: 'Look over this diff', description: 'anything wrong here?' })).toBe('research');
    // Execution verbs still win: fixing review feedback is a fix, not a review.
    expect(classifyTaskKind({ title: 'Fix the review comments', description: 'address PR feedback' })).toBe('fix');
    expect(classifyTaskKind({ title: 'Review and fix the bug', description: 'audit then patch it' })).toBe('fix');
  });
  it('routes long-form prose to document (never max-burn implement)', () => {
    expect(classifyTaskKind({ title: 'Write an essay', description: 'on remote work' })).toBe('document');
    expect(classifyTaskKind({ title: 'Write a blog post', description: 'launch announcement' })).toBe('document');
    expect(classifyTaskKind({ title: 'Write a story', description: 'sci-fi short' })).toBe('document');
    expect(classifyTaskKind({ title: 'Draft the newsletter', description: 'weekly update' })).toBe('document');
    // Code-adjacent prose keeps its engineering lane.
    expect(classifyTaskKind({ title: 'Write a test story', description: 'gherkin scenarios' })).toBe('test');
    // Bare 'post' matches no doc pattern (only 'blog post' does): a short
    // ambiguous message falls back to chat, never document.
    expect(classifyTaskKind({ title: 'POST the form data', description: 'submit handler' })).toBe('chat');
  });
});

describe('isReviewTask', () => {
  it('detects review-shaped work and nothing else', () => {
    expect(isReviewTask({ title: 'Review PR #9', description: '' })).toBe(true);
    expect(isReviewTask({ title: 'LGTM this diff', description: '' })).toBe(true);
    expect(isReviewTask({ title: 'Fix the bug', description: '' })).toBe(false);
    expect(isReviewTask({ title: 'hi', description: '' })).toBe(false);
    expect(isReviewTask({ title: 'Write docs', description: '' })).toBe(false);
  });
});

describe('kindHint', () => {
  it('returns a non-empty hint for every kind', () => {
    for (const k of ['fix', 'refactor', 'test', 'research', 'plan', 'document', 'implement', 'chat', 'unknown'] as const) {
      const h = kindHint(k);
      expect(h.length).toBeGreaterThan(20);
    }
  });
  it('debugging hint mentions reproducing the failure', () => {
    expect(kindHint('fix')).toMatch(/reproduc/i);
  });
  it('test hint lists the polyglot runners the agent must pick from', () => {
    const h = kindHint('test');
    expect(h).toMatch(/pytest|go test|cargo test|dotnet test/);
    expect(h.length).toBeGreaterThan(100);
  });
});

describe('resolveAutoReasoning', () => {
  it('maps simple kinds to low depth (token thrift)', () => {
    expect(resolveAutoReasoning('chat')).toBe('low');
    expect(resolveAutoReasoning('document')).toBe('low');
    expect(resolveAutoReasoning('research')).toBe('low');
  });
  it('maps moderate kinds to medium', () => {
    expect(resolveAutoReasoning('refactor')).toBe('medium');
    expect(resolveAutoReasoning('test')).toBe('medium');
  });
  it('maps fixes to high (root-cause depth)', () => {
    expect(resolveAutoReasoning('fix')).toBe('high');
  });
  it('maps implement/plan/unknown to max (full budget)', () => {
    expect(resolveAutoReasoning('implement')).toBe('max');
    expect(resolveAutoReasoning('plan')).toBe('max');
    expect(resolveAutoReasoning('unknown')).toBe('max');
  });
});

describe('scoreTaskComplexity', () => {
  it('is simple for a tiny greenfield create-and-run task', () => {
    const r = scoreTaskComplexity('Create add.js', 'add a multiply function to calc.js and run node calc.js', { greenfield: false, fileScope: ['calc.js'] });
    expect(r.complexity).toBe('simple');
    expect(r.score).toBeLessThan(3);
  });
  it('stays simple for a short one-file fix with no structural evidence', () => {
    expect(scoreTaskComplexity('Fix the typo in util.js', 'change foo to bar').complexity).toBe('simple');
  });
  it('is complex for a multi-file refactor in an existing repo', () => {
    const r = scoreTaskComplexity(
      'Refactor the async pipeline',
      'Convert callback hell into async/await across several modules while preserving the API contract, update all callers, and keep existing integration tests passing',
      { greenfield: false, fileScope: ['src/a.ts', 'src/b.ts', 'src/c.ts'] },
    );
    expect(r.complexity).toBe('complex');
    expect(r.reasons.length).toBeGreaterThan(0);
  });
  it('is complex for a hard ambiguous investigation (trace/root-cause)', () => {
    // Real scenario: debugging flaky/test infra in an existing repo (greenfield
    // is false — this is live code), where the model must trace and reason.
    expect(scoreTaskComplexity(
      'Debug flaky test',
      'Figure out why the build intermittently fails in CI, trace the root cause, narrow down the race condition',
      { greenfield: false },
    ).complexity).toBe('complex');
  });
  it('is complex for an existing-repo refactor even without heavy keywords', () => {
    // The failure mode this fix targets: no "audit/security/database/browser"
    // literal, yet genuinely hard. Must NOT be starved to the lean tier.
    const r = scoreTaskComplexity(
      'Refactor module boundaries',
      'Move the state handling across all callers so the contract is preserved, extend the tests in every affected module and make the whole suite green',
      { greenfield: false },
    );
    expect(r.complexity).toBe('complex');
  });
  it('is complex for a multi-file scope even when greenfield', () => {
    expect(scoreTaskComplexity('Scaffold new service', 'create these files: a.ts b.ts c.ts d.ts', { greenfield: true, fileScope: ['a.ts', 'b.ts', 'c.ts', 'd.ts'] }).complexity).toBe('complex');
  });
  it('does not misfire complex on a keyword-but-simple task or a bare chat', () => {
    // 'refactor' alone in a single-file trivial task is not enough without
    // structural evidence (scope/verify/investigation) — the conservatism
    // guarantee. It stays on the lean path (standard or simple, never complex).
    expect(scoreTaskComplexity('Refactor add.js', 'clean it up', { greenfield: false, fileScope: ['add.js'] }).complexity).not.toBe('complex');
    expect(scoreTaskComplexity('hello', 'hi there').complexity).toBe('simple');
  });
  it('is complex for an enumerated multi-step deliverable on live code', () => {
    // A task that literally enumerates its own steps (3+ acceptance criteria)
    // while mutating an existing repo is structurally hard even without the
    // scope/verify vocabulary.
    expect(scoreTaskComplexity(
      'Add rate limiting to the API',
      'implement throttling per API key',
      { greenfield: false, acceptanceCriteria: ['reject over-limit requests', 'emit metrics', 'add integration tests', 'document the headers'] },
    ).complexity).toBe('complex');
    // A numbered spec is the same signal.
    expect(scoreTaskComplexity(
      'Improve onboarding',
      '1. add a welcome step\n2. persist progress\n3. resume mid-flow\n4. add an e2e test',
      { greenfield: false },
    ).complexity).toBe('complex');
  });
  it('is complex for integration/e2e breadth on live code, without a keyword sweep', () => {
    expect(scoreTaskComplexity(
      'Wire up billing',
      'add an end-to-end path for invoice generation and a schema migration for plans',
      { greenfield: false },
    ).complexity).toBe('complex');
  });
  it('stays simple when the enumerated shape has no real-code mutation', () => {
    // Numbered steps alone, on a bare prompt with no mutation/scope/repo signal,
    // must NOT be dragged onto the heavy path.
    expect(scoreTaskComplexity('hello', '1. hi\n2. there\n3. friend').complexity).not.toBe('complex');
  });
});

describe('isComplexTask', () => {
  it('is true for a hard existing-repo refactor and false for a trivial one', () => {
    expect(isComplexTask(
      { title: 'Refactor async pipeline', description: 'across all callers preserve the contract and keep tests green', role: 'coder' as any },
      { greenfield: false },
    )).toBe(true);
    expect(isComplexTask(
      { title: 'Add multiply to calc.js', description: 'and run node calc.js', role: 'coder' as any },
      { greenfield: false, fileScope: ['calc.js'] },
    )).toBe(false);
  });
});

describe('shouldEscalateComplexity (self-tuning mid-run signal)', () => {
  const base = { complexity: 'standard' as const, alreadyEscalated: false, consecutiveVerifyFailures: 0, toolErrors: 0, iteration: 1 };

  it('stays put on a healthy run', () => {
    expect(shouldEscalateComplexity(base)).toBe(false);
    expect(shouldEscalateComplexity({ ...base, iteration: 24, toolErrors: 5, consecutiveVerifyFailures: 1 })).toBe(false);
  });

  it('promotes after repeated verification failures', () => {
    expect(shouldEscalateComplexity({ ...base, consecutiveVerifyFailures: 2 })).toBe(true);
  });

  it('promotes after sustained accumulated tool errors', () => {
    expect(shouldEscalateComplexity({ ...base, toolErrors: 6 })).toBe(true);
  });

  it('promotes a standard task that runs long, but not a simple one', () => {
    expect(shouldEscalateComplexity({ ...base, iteration: 25 })).toBe(true);
    expect(shouldEscalateComplexity({ ...base, complexity: 'simple', iteration: 40 })).toBe(false);
  });

  it('is a no-op once already complex or already escalated (one-way, idempotent)', () => {
    expect(shouldEscalateComplexity({ ...base, complexity: 'complex', toolErrors: 99, iteration: 99 })).toBe(false);
    expect(shouldEscalateComplexity({ ...base, alreadyEscalated: true, consecutiveVerifyFailures: 9 })).toBe(false);
  });
});
