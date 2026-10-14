// `mochi auth` command core, extracted for testability (cli.ts stays a thin
// adapter). All disk/network effects arrive injected; tests use fakes.
import { PROVIDERS, providerById, loadConfigFile, saveConfigFile } from './model/providers.js';
import { isKeyUsable } from './model/startup-check.js';
import { authStatusLines, probeKeyState, decideLogout } from './model/auth-cli.js';
import { verifyApiKey } from './model/auth-verify.js';
import type { MochiConfig } from './types.js';

export interface AuthCommandDeps {
  positional: string[];
  flags: Record<string, string | boolean>;
  runtime: { config: MochiConfig };
  log: (s: string) => void;
  error: (s: string) => void;
  /** Never returns (process.exit in prod, thrown Exit in tests). */
  exit: (code: number) => never;
  verify?: typeof verifyApiKey;
}

export async function runAuthCommand(deps: AuthCommandDeps): Promise<void> {
  const { positional, flags, runtime, log, error, exit } = deps;
  const verify = deps.verify ?? verifyApiKey;
  const sub = positional[1] ?? 'status';
  const activeId = runtime.config.model.provider;
  const lookup = (k: string): string | undefined => process.env[k];
  if (sub === 'status') {
    const probing = !!flags.probe;
    const rows = authStatusLines(PROVIDERS, activeId, lookup, runtime.config.model.apiKey, isKeyUsable);
    if (probing) {
      const probed = await Promise.all(PROVIDERS.map(async (p, i) => {
        const src = rows[i].includes('set (env)') ? 'env' : rows[i].includes('set (file)') ? 'file' : null;
        if (!src) return rows[i];
        const key = src === 'env' ? String(process.env[p.envKey]) : String(runtime.config.model.apiKey);
        return `${rows[i]} · ${await probeKeyState(verify, { provider: p.id, baseUrl: p.baseUrl, apiKey: key, kind: p.kind })}`;
      }));
      log(probed.join('\n'));
    } else {
      log(rows.join('\n'));
    }
    log(`\n* = active. Authenticate with: mochi login <provider> (keys are live-probed before storing).${probing ? '' : ' Add --probe to live-verify configured keys.'}`);
    return;
  }
  if (sub === 'logout' || sub === 'reset') {
    // `reset` is an explicit alias for `logout`: changing a key is just
    // `mochi login <provider>` again (it overwrites the stored key after a
    // live probe); resetting is clearing it here. Same logic, clearer name.
    const target = positional[2] ?? activeId;
    const out = decideLogout(target, !!providerById(target), activeId, runtime.config.model.apiKey);
    if (!out.cleared) {
      log(out.message);
      if (target && !providerById(target)) exit(1);
      return;
    }
    const cfg = loadConfigFile() as { model?: { apiKey?: string } };
    if (cfg.model) delete cfg.model.apiKey;
    saveConfigFile(cfg as never);
    runtime.config.model.apiKey = undefined;
    const p = providerById(target)!;
    log(`${out.message} Re-login with: mochi login ${target}. Env-provided keys are unaffected (unset $${p.envKey} to remove those).`);
    return;
  }
  error(`Unknown auth command "${sub}". Use: mochi auth [status [--probe] | logout [provider] | reset [provider]] (authenticate with: mochi login <provider>; change a key by logging in again)`);
  exit(1);
}
