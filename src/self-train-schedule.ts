// `mochi self-train --schedule` core: nightly-learning preset as a tested
// unit (cli.ts stays a thin adapter). Composes the cron prompt an agent can
// actually execute (review traces/lessons, fix one real gap with tests, run
// the curator) and validates the schedule spec with the daemon's own parser.

import { isRunnable } from './daemon/cron.js';

/** Default cadence for unattended learning (daemon parses "every <n> <unit>"). */
export const DEFAULT_TRAIN_SCHEDULE = 'every 24h';

/** The agent-native prompt installed as the cron job (no nested CLI). */
export function trainCronPrompt(focus?: string): string {
  const scope = focus?.trim() ? ` Focus: ${focus.trim()}.` : '';
  return [
    'Scheduled self-training cycle.' + scope,
    '1. Review the latest run traces (.mochi/traces) and recorded lessons for real, observed gaps — never invent work.',
    '2. Fix the single most valuable gap with tests (small, typed, verified).',
    '3. Run the skill curator so proven lessons persist as reusable skills.',
    '4. Report what changed and what was deliberately left alone.',
  ].join('\n');
}

/** Validate a --schedule value. Null when fine, otherwise the usage error. */
export function validateTrainSchedule(raw: unknown): string | null {
  const spec = typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_TRAIN_SCHEDULE;
  if (isRunnable(spec)) return null;
  return `Bad schedule "${spec}" — use "every 30m", "every 24h", or a 5-field cron like "0 3 * * *".`;
}

/** Resolve the effective schedule (flag or default). */
export function trainSchedule(raw: unknown): string {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_TRAIN_SCHEDULE;
}
