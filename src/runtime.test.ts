import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { Runtime } from './runtime.js';
import { createTask } from './goals/task.js';
import { startFakeOpenAI, type FakeOpenAI } from './testutil/fake-openai.js';
import type { MochiConfig } from './types.js';

function makeRepo(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'mochi-runtime-'));
  execSync('git init -q && git config user.email d@d && git config user.name d && git commit -q --allow-empty -m init', { cwd: dir });
  process.env.MOCHI_CONFIG_PATH = resolve(dir, 'config.json');
  return dir;
}

function baseConfig(): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl: 'http://x', model: 'fake' },
    safety: {
      mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 10, maxRuntimeMinutes: 5,
      maxConcurrentAgents: 1, contextBudgetTokens: 4000,
    },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
    telemetry: false, projectDir: '.mochi', configDir: '/tmp', quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
}

async function fakeServer(): Promise<FakeOpenAI> {
  return startFakeOpenAI([
    { content: '[HIGH] src/auth.ts:9 SQL injection\n[MEDIUM] src/util.ts:12 no rate limit', finishReason: 'stop', completionTokens: 20 },
  ]);
}

describe('Runtime setMode', () => {
  it('sets config.mode and returns the instruction for non-normal modes', () => {
    const rt = Runtime.create({ cwd: makeRepo() });
    const out = rt.setMode('spec');
    expect(out).toContain('SPEC MODE');
    expect(rt.config.mode).toBe('spec');
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
  });

  it('rejects unknown modes with the allowed list', () => {
    const rt = Runtime.create({ cwd: makeRepo() });
    const out = rt.setMode('banana');
    expect(out).toMatch(/Unknown mode/);
    expect(out).toContain('spec');
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
  });

  it('returns normal for normal mode and applies planMode from codemod', () => {
    const rt = Runtime.create({ cwd: makeRepo() });
    expect(rt.setMode('normal')).toBe('normal');
    rt.setMode('codemod');
    expect(rt.config.planMode).toBe(true);
    expect((rt.goals as any).config.planMode).toBe(true);
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
  });
  it('propagates explicit plan-mode transitions to the goal engine', () => {
    const rt = Runtime.create({ cwd: makeRepo(), config: { ...baseConfig(), planMode: false } });
    rt.setPlanMode(true);
    expect(rt.config.planMode).toBe(true);
    expect((rt.goals as any).config.planMode).toBe(true);
    rt.setPlanMode(undefined);
    expect(rt.config.planMode).toBeUndefined();
    expect((rt.goals as any).config.planMode).toBeUndefined();
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
  });
  it('keeps the goal engine on the merged config when project settings exist', () => {
    const dir = makeRepo();
    mkdirSync(resolve(dir, '.mochi'), { recursive: true });
    writeFileSync(resolve(dir, '.mochi', 'config.json'), JSON.stringify({ quiet: true }));
    const rt = Runtime.create({ cwd: dir });
    expect((rt.goals as any).config).toBe(rt.config);
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
  });
});

describe('Runtime review/fix (pipe composability)', () => {
  it('runtime.review returns a reviewer summary over piped input', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-rt-review-'));
    execSync('git init -q && git config user.email d@d && git config user.name d && git commit -q --allow-empty -m init', { cwd: dir });
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node -e "process.exit(0)"' } }));
    const fake = await fakeServer();
    const rt = new Runtime({
      cwd: dir,
      config: {
        ...baseConfig(),
        model: { provider: 'openai', baseUrl: fake.url, model: 'fake-model' },
      } as any,
    });
    // Reviewer is read-only: fake returns a findings block.
    const summary = await rt.review('[HIGH] src/auth.ts:9 SQL injection\n[MEDIUM] src/util.ts:12 no rate limit\n');
    expect(summary).toBeTruthy();
    expect(summary).toContain('[HIGH]');
    // Fake server observed the input in the user message.
    const inputs = fake.requests.map((r: any) => JSON.stringify(r.body ?? '')).join('\n');
    expect(inputs).toContain('auth.ts');
    await fake.close();
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(dir, { recursive: true, force: true });
  }, 60000);

  it('runtime.fix runs a fix task with piped context', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-rt-fix-'));
    execSync('git init -q && git config user.email d@d && git config user.name d && git commit -q --allow-empty -m init', { cwd: dir });
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node -e "process.exit(0)"' } }));
    const fake = await fakeServer();
    const rt = new Runtime({
      cwd: dir,
      config: {
        ...baseConfig(),
        model: { provider: 'openai', baseUrl: fake.url, model: 'fake-model' },
      } as any,
    });
    const summary = await rt.fix('TypeError: Cannot read properties of undefined (reading "map") at src/index.ts:12');
    expect(summary).toBeTruthy();
    const inputs = fake.requests.map((r: any) => JSON.stringify(r.body ?? '')).join('\n');
    expect(inputs).toContain('src/index.ts:12');
    await fake.close();
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('Runtime abort + interrupt', () => {
  it('aborts before the goal starts and does not hang on an aborted signal', async () => {
    const rt = Runtime.create({ cwd: makeRepo() });
    rt.abort('test abort');
    // runGoal receives the aborted signal; a goal whose tasks never start
    // should terminate (abort is checked at the top of each agent loop).
    const result = await rt.goals.runGoal(
      { id: 'abort-test', objective: 'x', status: 'pending', progress: 0, createdAt: Date.now(), updatedAt: Date.now(), tasks: [] } as any,
      [],
      [],
      rt['abortSignal'],
    );
    // With no tasks scheduled, runGoal completes quickly and records nothing.
    expect(result.summary).toBeDefined();
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
  });

  it('exposes abort and a signal that flips on abort()', () => {
    const rt = Runtime.create({ cwd: makeRepo() });
    const signal = rt['abortSignal'] as AbortSignal;
    expect(signal.aborted).toBe(false);
    rt.abort('stop');
    expect(signal.aborted).toBe(true);
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
  });

  it('adjusts reasoning mode with setReasoning and getReasoning', () => {
    delete process.env.MOCHI_REASONING;
    const rt = Runtime.create({ cwd: makeRepo(), config: { reasoning: 'medium' } });
    expect(rt.getReasoning()).toBe('medium');
    const desc = rt.setReasoning('high');
    expect(rt.getReasoning()).toBe('high');
    expect(desc).toContain('Deep cognitive analysis');
    expect(process.env.MOCHI_REASONING).toBe('high');

    rt.setReasoning('max');
    expect(rt.getReasoning()).toBe('max');

    rt.setReasoning('low');
    expect(rt.getReasoning()).toBe('low');

    rt.setReasoning('off');
    expect(rt.getReasoning()).toBe('off');
    expect(process.env.MOCHI_REASONING).toBe('off');

    rt.setReasoning('auto');
    expect(rt.getReasoning()).toBe('auto');
    expect(process.env.MOCHI_REASONING).toBe('auto');

    rt.newSession();
    expect(rt.activeSessionId).toBeUndefined();
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
    delete process.env.MOCHI_REASONING;
  });

  it('defaults reasoning to medium upon model initialization unless user changes it', () => {
    delete process.env.MOCHI_REASONING;
    const rt = Runtime.create({ cwd: makeRepo() });
    expect(rt.getReasoning()).toBe('medium');
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
  });

  it('autoImprove stops early on semantic convergence instead of looping indefinitely', async () => {
    const rt = Runtime.create({ cwd: makeRepo() });
    let promptCallCount = 0;
    rt.runPrompt = async () => {
      promptCallCount++;
      return 'All tasks completed cleanly. All tests pass with no remaining issues.';
    };
    const res = await rt.autoImprove('Optimize performance', 10);
    expect(promptCallCount).toBeLessThan(10);
    expect(res.summaries.length).toBeLessThan(10);
    expect(res.finalSummary).toContain('All tasks completed cleanly');
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
  });

  it('autoImprove prompts each later pass to CRITICALLY SELF-REVIEW (not "keep going")', async () => {
    const rt = Runtime.create({ cwd: makeRepo() });
    const prompts: string[] = [];
    rt.runPrompt = async (p: string) => {
      prompts.push(p);
      return `draft ${prompts.length}`;
    };
    await rt.autoImprove('Refactor the auth module', 3);
    // First pass has no prior summary; later passes must carry the review directive.
    expect(prompts[0]).not.toContain('CRITICAL SELF-REVIEW');
    expect(prompts[1]).toContain('CRITICAL SELF-REVIEW');
    expect(prompts[1]).toContain('<VERDICT>');
    // The old broken nudge must be gone.
    expect(prompts.every((p) => !/Continue: refine, fix remaining issues/.test(p))).toBe(true);
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
  });

  it('autoImprove stops immediately when a pass declares <VERDICT>DONE</VERDICT>', async () => {
    const rt = Runtime.create({ cwd: makeRepo() });
    let calls = 0;
    rt.runPrompt = async () => {
      calls++;
      return calls === 1 ? 'first draft' : 'verified and finished\n<VERDICT>DONE</VERDICT>';
    };
    const res = await rt.autoImprove('Fix the bug', 10);
    expect(calls).toBe(2); // pass 1 + pass 2 (DONE) then stop — never reaches 10
    expect(res.summaries.length).toBe(2);
    expect(res.finalSummary).toContain('<VERDICT>DONE</VERDICT>');
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
  });

  it('autoImprove keeps iterating when passes declare <VERDICT>IMPROVED</VERDICT>', async () => {
    const rt = Runtime.create({ cwd: makeRepo() });
    let calls = 0;
    rt.runPrompt = async () => {
      calls++;
      // Every pass reports a concrete improvement with an IMPROVED verdict —
      // stagnation must NOT accumulate, so it runs the full budget.
      return `made measurable change #${calls}\n<VERDICT>IMPROVED</VERDICT>`;
    };
    const res = await rt.autoImprove('Harden the parser', 4);
    expect(calls).toBe(4);
    expect(res.summaries.length).toBe(4);
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
  });

  it('autoImprove terminates early when passes repeat verbatim identical summaries even if IMPROVED is asserted (MCH-01)', async () => {
    const rt = Runtime.create({ cwd: makeRepo() });
    let calls = 0;
    rt.runPrompt = async () => {
      calls++;
      // Every pass repeats the EXACT same summary text with <VERDICT>IMPROVED</VERDICT>.
      // The breaker must detect verbatim identical repetition across passes and stop early.
      return 'Refactored code and ran tests.\n<VERDICT>IMPROVED</VERDICT>';
    };
    const res = await rt.autoImprove('Optimize performance', 10);
    // Pass 1 sets priorSummary; Pass 2 is identical to pass 1 -> stagnation += 2 -> break. Never reaches 10.
    expect(calls).toBe(2);
    expect(res.summaries.length).toBe(2);
    try { rt.close(); } catch { /* best-effort */ }
    rmSync(rt.cwd, { recursive: true, force: true });
  });
});

describe('Runtime approvePlan', () => {
  it('records whether a pending decomposition was made in plan mode', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-plan-pending-'));
    execSync('git init -q && git config user.email t@t && git config user.name t && git commit -q --allow-empty -m init', { cwd: dir });
    const fake = await startFakeOpenAI([{
      content: JSON.stringify([{
        title: 'Create approved file',
        description: 'Create approved.txt containing approved.',
        role: 'coder',
        dependencies: [],
        acceptanceCriteria: ['approved.txt exists'],
        verificationCommand: '',
      }]),
      finishReason: 'stop',
    }]);
    const rt = new Runtime({
      cwd: dir,
      config: {
        ...baseConfig(),
        planMode: true,
        model: { provider: 'openai', baseUrl: fake.url, model: 'fake-model' },
      } as any,
    });
    try {
      const plan = await rt.plan('Create approved.txt');
      expect(plan).toContain('Run /approve');
      expect(rt.workspace.readJson<{ id: string; objective: string; planMode?: boolean }>('state/pending-goal.json'))
        .toMatchObject({ objective: 'Create approved.txt', planMode: true });
    } finally {
      await fake.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it('executes a pending plan in act mode even when the runtime is in plan mode', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-approve-act-'));
    execSync('git init -q && git config user.email t@t && git config user.name t && git commit -q --allow-empty -m init', { cwd: dir });
    const fake = await startFakeOpenAI([
      {
        content: 'Creating the approved file now.',
        toolCalls: [{
          id: 'approve-write',
          type: 'function',
          function: { name: 'write', arguments: JSON.stringify({ path: 'approved.txt', content: 'approved' }) },
        }],
        finishReason: 'tool_calls',
      },
      { content: 'Approved file created.', finishReason: 'stop' },
    ]);
    const rt = new Runtime({
      cwd: dir,
      config: {
        ...baseConfig(),
        planMode: true,
        model: { provider: 'openai', baseUrl: fake.url, model: 'fake-model' },
      } as any,
    });
    try {
      const goal = await rt.goals.createGoal('Create approved.txt');
      const task = createTask('Create approved.txt', 'Create approved.txt containing approved.', {
        acceptanceCriteria: ['approved.txt exists'],
      });
      rt.workspace.saveTasks(goal.id, [task]);
      rt.workspace.writeJson('state/pending-goal.json', { id: goal.id, objective: goal.objective });

      await rt.approvePlan();

      expect(existsSync(resolve(dir, 'approved.txt'))).toBe(true);
      expect(readFileSync(resolve(dir, 'approved.txt'), 'utf8')).toBe('approved');
      // Approval executes one pending plan; it does not permanently flip the runtime mode.
      expect(rt.config.planMode).toBe(true);
      expect((rt.goals as any).config.planMode).toBe(true);
    } finally {
      await fake.close();
      try { rt.close(); } catch { /* best-effort: release SQLite handles (win32 EBUSY) */ }
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it('replaces a plan-mode pending decomposition with executable tasks on approval', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-approve-replan-'));
    execSync('git init -q && git config user.email t@t && git config user.name t && git commit -q --allow-empty -m init', { cwd: dir });
    let wrote = false;
    const fake = await startFakeOpenAI([{
      sticky: true,
      respondFn: (body: any) => {
        const text = JSON.stringify(body?.messages ?? []);
        if (text.includes('Decompose the goal into a JSON array')) {
          return {
            content: JSON.stringify([{
              title: 'Create approved file',
              description: 'Create approved.txt containing approved.',
              role: 'coder',
              dependencies: [],
              acceptanceCriteria: ['approved.txt exists'],
              verificationCommand: '',
            }]),
            finishReason: 'stop',
          };
        }
        if (!wrote && text.includes('do NOT modify anything')) {
          return { content: 'PLAN:\n1. Research approved.txt\n2. Do not modify anything', finishReason: 'stop' };
        }
        if (!wrote) {
          wrote = true;
          return {
            content: 'Creating the approved file now.',
            toolCalls: [{
              id: 'approve-write',
              type: 'function',
              function: { name: 'write', arguments: JSON.stringify({ path: 'approved.txt', content: 'approved' }) },
            }],
            finishReason: 'tool_calls',
          };
        }
        return { content: 'Approved file created.', finishReason: 'stop' };
      },
    }]);
    const rt = new Runtime({
      cwd: dir,
      config: {
        ...baseConfig(),
        planMode: true,
        model: { provider: 'openai', baseUrl: fake.url, model: 'fake-model' },
      } as any,
    });
    try {
      const goal = await rt.goals.createGoal('Create approved.txt');
      const planOnlyTask = createTask(
        'Produce an implementation plan',
        'Produce a detailed written plan (steps, files, risks, verification), do NOT modify anything.',
        { role: 'architect', acceptanceCriteria: [] },
      );
      rt.workspace.saveTasks(goal.id, [planOnlyTask]);
      rt.workspace.writeJson('state/pending-goal.json', { id: goal.id, objective: goal.objective });

      await rt.approvePlan();

      expect(existsSync(resolve(dir, 'approved.txt'))).toBe(true);
      const saved = rt.workspace.loadTasks(goal.id);
      expect(saved.some((t) => t.description.includes('do NOT modify anything'))).toBe(false);
    } finally {
      await fake.close();
      try { rt.close(); } catch { /* best-effort: release SQLite handles (win32 EBUSY) */ }
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});