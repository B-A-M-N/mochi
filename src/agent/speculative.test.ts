import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SpeculativeEngine } from './speculative.js';
import { BudgetEngine } from '../budget.js';
import { startFakeOpenAI, type FakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig } from '../types.js';

let fake: FakeOpenAI;
let config: MochiConfig;

// Route scripted replies by REQUEST SHAPE, not arrival order: the engine fires
// the three candidate evaluations concurrently (Promise.all), so a positional
// FIFO hands responses out by scheduler/OS timing — this test flaked on macOS
// CI runners (candidate 1 received candidate 2's reply) while passing on
// Linux. The verifier request is matched first because its body quotes every
// candidate's text.
const CANDIDATE_REPLIES: Record<string, string> = {
  'inspect types': 'Inspect the inferred types and fix the caller.',
  'reproduce with logging': 'Add logging and reproduce the failure.',
  'check dependencies': 'Check dependency versions and imports.',
};

beforeAll(async () => {
  fake = await startFakeOpenAI([
    {
      sticky: true,
      respondFn: (body) => {
        const text = JSON.stringify(body?.messages ?? body);
        if (text.includes('Candidate 1:')) {
          return {
            content: '{"index":1,"reason":"Type inspection finds the root cause most directly."}',
            completionTokens: 24,
          };
        }
        for (const [strategy, reply] of Object.entries(CANDIDATE_REPLIES)) {
          if (text.includes(strategy)) return { content: reply, completionTokens: 12 };
        }
        return { content: JSON.stringify(Object.keys(CANDIDATE_REPLIES)), completionTokens: 20 };
      },
    },
  ]);
  config = {
    model: {
      provider: 'openai',
      baseUrl: fake.url,
      model: 'fake-model',
    },
    safety: {
      mode: 'auto',
      commandTimeoutSeconds: 10,
      maxIterations: 10,
      maxRuntimeMinutes: 10,
      maxConcurrentAgents: 2,
      contextBudgetTokens: 1000,
      maxModelCalls: 10,
    },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: false },
    telemetry: false,
    projectDir: '.mochi',
    configDir: '/tmp',
    quiet: true,
    verbose: false,
    debug: false,
  } as unknown as MochiConfig;
});

afterAll(async () => { await fake.close(); });

describe('SpeculativeEngine', () => {
  it('generates strategies, evaluates them, and selects the best candidate', async () => {
    const budget = new BudgetEngine(config.safety);
    budget.start();
    const engine = new SpeculativeEngine(config, budget, 3);
    const result = await engine.speculate('TypeScript TS2345 error');
    expect(result.candidates).toHaveLength(3);
    expect(result.best?.strategy).toBe('inspect types');
    expect(result.best?.response).toContain('inferred types');
    // Selection is not a measured score. Missing verifier scores stay absent.
    expect(result.best?.score).toBeUndefined();
  });

  it('disables speculation when the budget is exhausted', async () => {
    const budget = new BudgetEngine({ ...config.safety, maxModelCalls: 0 });
    budget.start();
    const engine = new SpeculativeEngine(config, budget, 3);
    const result = await engine.speculate('anything');
    expect(result.candidates).toEqual([]);
    expect(result.verifierNotes).toContain('Budget exhausted');
  });
});
