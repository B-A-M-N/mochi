import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';

// Adaptive context-window memory.
//
// The static per-family priors in model-manager.ts (deepseek 128k, claude 200k,
// ...) are educated guesses. The one ground truth a harness can actually observe
// is when a provider REJECTS a prompt for being too long. We record the smallest
// prompt size a given model has ever rejected and clamp the working budget below
// it on later runs, so a model whose real window is smaller than its family prior
// stops dying on a context cliff after the first (unavoidable) miss. This is
// strictly monotone: the learned bound only ever moves DOWN.
//
// File: ~/.mochi/window-limits.json  (override with MOCHI_WINDOW_LIMITS_PATH)
//   { "<provider>/<model>": { "rejectedAt": 131072, "at": 1792092269717 } }

interface WindowLimit {
  /** Prompt token count that the provider rejected as too long (upper bound). */
  rejectedAt: number;
  /** When the rejection was last observed. */
  at: number;
}

type Store = Record<string, WindowLimit>;

/** Fraction of the smallest observed rejection to treat as the working budget.
 *  Comfortably below the rejected prompt so compaction fires BEFORE the cliff. */
const SAFETY = 0.85;

export function windowModelKey(model: string, provider?: string): string {
  return `${(provider || '').toLowerCase()}/${(model || '').toLowerCase()}`;
}

export function windowLimitsPath(): string {
  const override = process.env.MOCHI_WINDOW_LIMITS_PATH;
  return override || resolve(homedir(), '.mochi', 'window-limits.json');
}

function readStore(path: string): Store {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Store;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Learned working-budget ceiling for a model, or undefined if never rejected.
 *  Returns SAFETY * the smallest rejected prompt size. */
export function learnedWindowBudget(model: string, provider?: string, path = windowLimitsPath()): number | undefined {
  const rec = readStore(path)[windowModelKey(model, provider)];
  if (!rec || !Number.isFinite(rec.rejectedAt) || rec.rejectedAt < 1000) return undefined;
  return Math.floor(rec.rejectedAt * SAFETY);
}

/** Record that `model` rejected a prompt of `promptTokens` for being too long.
 *  Keeps the smallest observed rejection so the bound only tightens. */
export function recordContextRejection(
  model: string,
  provider: string | undefined,
  promptTokens: number,
  path = windowLimitsPath(),
): void {
  if (!Number.isFinite(promptTokens) || promptTokens < 1000) return;
  const key = windowModelKey(model, provider);
  const store = readStore(path);
  const prev = store[key];
  // We know window < promptTokens (it was rejected), so promptTokens is a valid
  // upper bound. Only tighten.
  const next: WindowLimit = {
    rejectedAt: prev ? Math.min(prev.rejectedAt, Math.floor(promptTokens)) : Math.floor(promptTokens),
    at: Date.now(),
  };
  store[key] = next;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(store, null, 2));
  } catch {
    /* best effort — learning is an optimization, never a hard dependency */
  }
}
