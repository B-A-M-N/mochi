// self-train --schedule preset: prompt composition + spec validation.
import { describe, it, expect } from 'vitest';
import { trainCronPrompt, validateTrainSchedule, trainSchedule, DEFAULT_TRAIN_SCHEDULE } from './self-train-schedule.js';

describe('self-train schedule preset', () => {
  it('composes an agent-executable prompt (no nested CLI, bounded scope)', () => {
    const p = trainCronPrompt();
    expect(p).toContain('traces');
    expect(p).toContain('curator');
    expect(p).toContain('single most valuable');
    expect(p).not.toContain('mochi self-train');
    expect(trainCronPrompt('auth').split('\n')[0]).toContain('auth');
  });

  it('defaults to daily and accepts daemon schedule shapes', () => {
    expect(DEFAULT_TRAIN_SCHEDULE).toBe('every 24h');
    expect(trainSchedule(undefined)).toBe('every 24h');
    expect(trainSchedule('every 30m')).toBe('every 30m');
    expect(validateTrainSchedule(undefined)).toBeNull();
    expect(validateTrainSchedule('every 24h')).toBeNull();
    expect(validateTrainSchedule('0 3 * * *')).toBeNull();
  });

  it('rejects garbage schedules with usage guidance', () => {
    const err = validateTrainSchedule('someday-ish');
    expect(err).toContain('Bad schedule');
    expect(err).toContain('every 30m');
  });
});
