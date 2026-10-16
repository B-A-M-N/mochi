import { describe, it, expect } from 'vitest';
import { classifyOneShot } from './one-shot.js';

describe('one-shot fast-path classifier', () => {
  it('routes pure knowledge questions to a direct answer', () => {
    const r = classifyOneShot({
      title: 'Explain how quicksort works',
      description: 'Give a concise explanation of quicksort.',
      acceptanceCriteria: [],
    });
    expect(r.kind).toBe('answer');
    expect(r.suggests).toContain('one turn');
  });

  it('routes summarize tasks to a single short-read path', () => {
    const r = classifyOneShot({
      title: 'Summarize the main module',
      description: 'What does src/agent/loop.ts do?',
      acceptanceCriteria: [],
    });
    expect(r.kind).toBe('summarize');
    expect(r.suggests).toContain('Summarize');
  });

  it('refuses tasks that need to write code', () => {
    const r = classifyOneShot({
      title: 'Add authentication to the API',
      description: 'Create a login endpoint and middleware.',
      acceptanceCriteria: ['login works'],
      verificationCommand: 'npm test',
    });
    expect(r.kind).toBe('not_one_shot');
    expect(r.suggests).toBeNull();
  });

  it('refuses when acceptance criteria are present even if phrased as a question', () => {
    const r = classifyOneShot({
      title: 'Explain the bug',
      description: 'Why does it crash?',
      acceptanceCriteria: ['test passes'],
    });
    expect(r.kind).toBe('not_one_shot');
  });

  it('routes short utterance commands like "say hello" to a direct answer', () => {
    const r = classifyOneShot({
      title: 'Say hello in exactly 3 words',
      description: 'Say hello in exactly 3 words.',
      acceptanceCriteria: [],
    });
    expect(r.kind).toBe('answer');
    expect(r.suggests).toContain('one turn');

    const r2 = classifyOneShot({
      title: 'what issues does mochi have if it has any',
      description: 'what issues does mochi have if it has any',
      acceptanceCriteria: [],
    });
    expect(r2.kind).toBe('answer');

    const r3 = classifyOneShot({
      title: 'so its still better than ever rn',
      description: 'so its still better than ever rn',
      acceptanceCriteria: [],
    });
    expect(r3.kind).toBe('answer');
  });

  it('does not route a real coding command that mentions creating a file', () => {
    const r = classifyOneShot({
      title: 'Create a hello program',
      description: 'Create a hello file that prints.',
      acceptanceCriteria: [],
    });
    expect(r.kind).toBe('not_one_shot');
  });

  it('refuses neutral tasks that are not questions (no marker)', () => {
    const r = classifyOneShot({
      title: 'Project setup',
      description: 'Initialize the repository layout.',
      acceptanceCriteria: [],
    });
    expect(r.kind).toBe('not_one_shot');
  });

  // Regression: arena q1 (codebase-question). "…what is the fallback value?
  // Write the answer … into answer.txt." carried answer phrasing AND a real
  // file deliverable. The answer lane vetoes every mutating tool, so this
  // misroute failed the task outright (write blocked → exit green → no file).
  it('routes an explicit file deliverable OUT of the answer lane (arena q1)', () => {
    const r = classifyOneShot({
      title: 'Read the src/ directory. Which exact environment variable name does the auth salt come from, and what is the fallback value? Write the answer as two lines "VAR=<name>" and "FALLBACK=<value>" into answer.txt.',
      description: '',
      acceptanceCriteria: [],
    });
    expect(r.kind).toBe('not_one_shot');
    expect(r.suggests).toBeNull();
  });

  it('routes other write-to-file deliverables out of the answer lane', () => {
    const save = classifyOneShot({
      title: 'Run the benchmark and save the numbers to bench/results.json',
      description: '',
      acceptanceCriteria: [],
    });
    expect(save.kind).toBe('not_one_shot');

    const words = classifyOneShot({
      title: 'Collect the current settings and write them into a file',
      description: '',
      acceptanceCriteria: [],
    });
    expect(words.kind).toBe('not_one_shot');
  });

  it('keeps open how-questions about files in the answer lane', () => {
    // "How do I write logs to a file?" mentions writing to a file but is a
    // knowledge question — routing it to the implement lane would spawn a
    // pointless coding loop for an explanation.
    const r = classifyOneShot({
      title: 'How do I write logs to a file in Node?',
      description: '',
      acceptanceCriteria: [],
    });
    expect(r.kind).toBe('answer');
  });
});