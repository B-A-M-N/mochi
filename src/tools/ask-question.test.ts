// ask_question tool: normalization, headless fallback, interactive path.
import { describe, it, expect, vi } from 'vitest';
import { askQuestionTool } from './ask-question.js';
import {
  normalizePromptRequest,
  headlessUserPrompt,
  formatUserPromptResult,
} from './user-prompt.js';
import type { ToolContext } from './types.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

function ctx(overrides: Partial<ToolContext> = {}): ToolContext {
  const dir = mkdtempSync(resolve(tmpdir(), 'mochi-askq-'));
  return {
    cwd: dir,
    workspace: new Workspace(dir, '.mochi'),
    config: {} as never,
    events: new EventBus(),
    agentId: 'test',
    ...overrides,
  };
}

describe('normalizePromptRequest', () => {
  it('accepts the flat single-question form', () => {
    const req = normalizePromptRequest({
      question: 'Which auth?',
      header: 'Auth',
      options: [{ label: 'JWT', description: 'stateless' }, 'sessions'],
    });
    expect(req.questions).toHaveLength(1);
    expect(req.questions[0].header).toBe('Auth');
    expect(req.questions[0].options.map((o) => o.label)).toEqual(['JWT', 'sessions']);
  });

  it('accepts the nested questions form and caps counts', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      question: `Q${i}`,
      options: ['a', 'b', 'c', 'd', 'e', 'f'],
    }));
    const req = normalizePromptRequest({ questions: many });
    expect(req.questions).toHaveLength(4);
    expect(req.questions[0].options).toHaveLength(4);
  });

  it('drops empty questions and empty option labels', () => {
    const req = normalizePromptRequest({ questions: [{ question: '  ', options: ['a'] }, { question: 'Real?', options: ['', 'B'] }] });
    expect(req.questions).toHaveLength(1);
    expect(req.questions[0].options.map((o) => o.label)).toEqual(['B']);
  });
});

describe('headlessUserPrompt', () => {
  it('prefers the recommended option, else the first', () => {
    const res = headlessUserPrompt({
      questions: [
        { question: 'Q1', options: [{ label: 'A' }, { label: 'B', recommended: true }] },
        { question: 'Q2', options: [{ label: 'X' }] },
      ],
    });
    expect(res.answers[0].selected).toEqual(['B']);
    expect(res.answers[1].selected).toEqual(['X']);
    expect(res.answers[0].usedDefault).toBe(true);
  });
});

describe('ask_question tool', () => {
  it('rejects calls with no usable questions', async () => {
    const out = await askQuestionTool.execute({}, ctx());
    expect(out).toContain('No valid questions');
  });

  it('rejects questions with zero options', async () => {
    const out = await askQuestionTool.execute({ question: 'Which?' }, ctx());
    expect(out).toContain('at least one option');
  });

  it('uses headless defaults when no promptUser is wired', async () => {
    const out = await askQuestionTool.execute(
      { question: 'Which auth?', options: [{ label: 'JWT' }, { label: 'sessions', recommended: true }] },
      ctx(),
    );
    expect(out).toContain('User answers:');
    expect(out).toContain('sessions');
    expect(out).toContain('defaults were used');
  });

  it('awaits the interactive resolver and renders picks + custom text', async () => {
    const promptUser = vi.fn(async () => ({
      answers: [
        { question: 'Which auth?', header: 'Auth', selected: ['JWT'] },
        { question: 'Scope?', selected: [], freeText: 'just the login page' },
      ],
    }));
    const out = await askQuestionTool.execute(
      {
        questions: [
          { question: 'Which auth?', header: 'Auth', options: ['JWT', 'sessions'] },
          { question: 'Scope?', options: ['all', 'login'] },
        ],
      },
      ctx({ promptUser }),
    );
    expect(promptUser).toHaveBeenCalledTimes(1);
    expect(promptUser.mock.calls[0][0].questions).toHaveLength(2);
    expect(out).toContain('[Auth] Which auth? → JWT');
    expect(out).toContain('(custom: just the login page)');
    expect(out).not.toContain('defaults were used');
  });

  it('renders skipped questions honestly and falls back on resolver errors', async () => {
    const promptUser = vi.fn(async () => ({
      answers: [{ question: 'Which?', selected: [], skipped: true }],
    }));
    const out = await askQuestionTool.execute({ question: 'Which?', options: ['A', 'B'] }, ctx({ promptUser }));
    expect(out).toContain('user skipped');

    const failing = vi.fn(async () => { throw new Error('UI detached'); });
    const out2 = await askQuestionTool.execute({ question: 'Which?', options: ['A', 'B'] }, ctx({ promptUser: failing }));
    expect(out2).toContain('used defaults');
    expect(out2).toContain('UI detached');
  });

  it('bails out immediately when the run was aborted', async () => {
    const c = new AbortController();
    c.abort();
    const promptUser = vi.fn();
    const out = await askQuestionTool.execute(
      { question: 'Which?', options: ['A'] },
      ctx({ promptUser, abortSignal: c.signal }),
    );
    expect(out).toContain('aborted');
    expect(promptUser).not.toHaveBeenCalled();
  });
});

describe('formatUserPromptResult', () => {
  it('marks headless defaults as unconsidered', () => {
    const text = formatUserPromptResult(headlessUserPrompt({ questions: [{ question: 'Q', options: [{ label: 'A' }] }] }), true);
    expect(text).toContain('safest option');
  });
});
