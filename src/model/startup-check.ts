// Startup model health check: answer "is this thing actually going to run?"
// BEFORE the first message burns a 50-100s failover spiral on a dead setup.
// Fresh launches with no key (or a model id the provider never heard of)
// otherwise fail every request with 401/404, and the user reads that as
// "mochi loads with a fake model". One quiet line when broken, silence when
// fine — never a menu, never blocking (chatbox-ownership rule).
//
// Pure: takes the resolved model config + env, returns the warning line or
// null. The TUI renders the string; headless paths ignore it.

import type { ModelConfig } from '../types.js';
import { PROVIDERS } from './providers.js';
import { normalizeModelName } from './router.js';

/** Placeholder-shaped keys are the same as no key (mirrors config.ts). */
export function isKeyUsable(key: string | undefined): boolean {
  if (!key) return false;
  const k = key.trim();
  if (k.length < 6) return false;
  const low = k.toLowerCase();
  return !(low === 'hi' || low.startsWith('your') || low.startsWith('sk-your')
    || low.includes('your-key') || low.includes('set me') || low.startsWith('<'));
}

/** Strip `provider/`-style prefixes the way the request router does, so
 *  `opencode/deepseek-v4-flash-free` matches the bare listed id. */
export function bareModelId(model: string, baseUrl?: string): string {
  return normalizeModelName(model, baseUrl);
}

export interface StartupModelHealth {
  ok: boolean;
  /** Single line for the transcript when !ok. */
  line?: string;
}

export function checkStartupModel(
  model: Pick<ModelConfig, 'provider' | 'model' | 'apiKey'>,
  env: NodeJS.ProcessEnv = process.env,
): StartupModelHealth {
  const prov = PROVIDERS.find((p) => p.id === (model.provider ?? '').toLowerCase());
  if (!prov) {
    return {
      ok: false,
      line: `◇ model check: unknown provider "${model.provider ?? '(none)'}". Run /model to pick a real one — until then answers will fail, not run on a placeholder.`,
    };
  }
  // Local/keyless providers (ollama, lmstudio, …) declare envKey ''.
  const envKey = prov.envKey ? env[prov.envKey] : undefined;
  const key = model.apiKey ?? (typeof envKey === 'string' ? envKey : undefined);
  if (prov.envKey && !isKeyUsable(key)) {
    return {
      ok: false,
      line: `◇ model check: no API key for ${prov.name} (${prov.id}). Requests will 401 — run /login or set $${prov.envKey}, then send your message again.`,
    };
  }
  const bare = bareModelId(model.model ?? '', prov.baseUrl);
  const listed = prov.models.some((m) => m === bare || m === model.model || bareModelId(m, prov.baseUrl) === bare);
  if (!listed && prov.models.length > 0) {
    return {
      ok: false,
      line: `◇ model check: "${model.model}" isn't a ${prov.name} model id (${prov.models.slice(0, 4).join(', ')}${prov.models.length > 4 ? ', …' : ''}). It may 404 — run /model to pick a listed one.`,
    };
  }
  return { ok: true };
}
