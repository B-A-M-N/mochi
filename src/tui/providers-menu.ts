// /providers browser as a testable unit (tools-menu pattern): all TUI
// effects arrive injected, so tests drive the full menu flow with scripted
// answers. app.ts stays a thin dispatcher, keeping the coverage ratchet
// honest. Beyond browsing it manages keys: re-authenticate (live-probed
// before storing, like /login) and clear the stored key — the two actions
// the read-only browser was missing.

import { PROVIDERS, type Provider, type ProviderKind } from '../model/providers.js';
import { keySource, decideLogout } from '../model/auth-cli.js';
import { isKeyUsable } from '../model/startup-check.js';
import { T } from './view.js';
import type { LineKind } from './state.js';

export interface VerifyOutcome {
  ok: boolean;
  reason?: 'auth' | 'network';
  message: string;
}

export interface ProvidersMenuDeps extends AuthDeps {
  openMenu: (title: string, items: string[]) => Promise<number>;
  setMenuSelected: (i: number) => void;
}

/** The shared key-entry effects both /providers re-auth and /login use. */
export interface AuthDeps {
  push: (kind: LineKind, text: string) => void;
  scheduleRender: () => void;
  /** Prompt for free text (used for the key entry). */
  ask: (question: string) => Promise<string>;
  /** Currently active provider id. */
  activeProvider: string;
  /** Read an env var without touching process.env directly in tests. */
  envLookup: (key: string) => string | undefined;
  /** Stored file key for the active provider (never printed). */
  storedKey: string | undefined;
  /** OAuth/CLI-sourced token (gh auth token, huggingface-cli cache…).
   *  Undefined when the provider has no ambient source or it failed. */
  getAmbientKey: (providerId: string) => Promise<string | undefined>;
  /** Live-probe a key (injected; app.ts uses verifyApiKey). */
  verifyKey: (providerId: string, baseUrl: string, kind: ProviderKind, key: string) => Promise<VerifyOutcome>;
  /** Persist a verified login (injected; app.ts runs runtime.loginProvider). */
  persistLogin: (providerId: string, key: string, model: string) => Promise<string>;
  /** Switch to a keyless local provider (injected; app.ts runs runtime.useProvider). */
  switchProvider: (providerId: string, model: string) => Promise<string>;
  /** Persist a cleared key (injected; app.ts deletes it from the config file). */
  persistCleared: () => Promise<void>;
}

/** Names sorted for the browser, optionally filtered by a query. Pure. */
export function matchProviders(names: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...names].sort();
  return names.filter((n) => n === q || n.toLowerCase().includes(q)).sort();
}

/** One-line key state for a provider (never the key itself). */
export function keyStateText(p: Provider, activeId: string, envLookup: (k: string) => string | undefined, storedKey: string | undefined): string {
  const src = keySource(p, activeId, p.envKey ? envLookup(p.envKey) : undefined, storedKey, isKeyUsable);
  return src === 'env' ? 'key: env' : src === 'file' ? 'key: file' : src === 'local' ? 'keyless local' : 'key: missing';
}

function detailsText(p: Provider, activeId: string, envLookup: (k: string) => string | undefined, storedKey: string | undefined): string {
  const head = [
    `${p.name} (${p.id})`,
    `Base URL: ${p.baseUrl}`,
    `Key: ${keyStateText(p, activeId, envLookup, storedKey)}${p.envKey ? ` ($${p.envKey})` : ''}`,
    ...(p.keyHelp ? [`Get a key: ${p.keyHelp}`] : []),
    `Models (${p.models.length}):`,
    ...p.models.map((m) => `  ${m}${m === p.defaultModel ? '  (default)' : ''}`),
  ];
  return head.join('\n');
}

function rowText(p: Provider, activeId: string): string {
  const active = p.id === activeId;
  const badge = active ? `${T.lime}[ACTIVE]${T.reset} ` : '        ';
  return `${p.name.padEnd(20)}  ${badge}${T.grayDark}${p.models.length} models · ${p.baseUrl}${T.reset}`;
}

export async function providersMenu(deps: ProvidersMenuDeps, line: string): Promise<void> {
  const { openMenu, push, scheduleRender, setMenuSelected } = deps;
  const arg = (line.length > 10 ? line.slice(10) : '').trim();

  const showProvider = async (p: Provider): Promise<void> => {
    push('system', detailsText(p, deps.activeProvider, deps.envLookup, deps.storedKey));
    scheduleRender();
    // Key actions live here so a provider can be re-authed or cleared
    // without leaving the browser.
    setMenuSelected(0);
    const action = await openMenu(`${p.name} · key actions`, [
      'Re-authenticate key',
      'Clear stored key',
      'Done',
    ]);
    if (action === 0) await reauthenticate(deps, p);
    else if (action === 1) await clearStoredKey(deps, p);
  };

  if (arg) {
    // Exact id or name → details with no menu; substring → filtered menu.
    const exact = PROVIDERS.find((p) => p.id === arg || p.id === arg.toLowerCase() || p.name.toLowerCase() === arg.toLowerCase());
    if (exact) {
      await showProvider(exact);
      return;
    }
    const names = matchProviders(PROVIDERS.map((p) => p.id), arg);
    if (!names.length) {
      push('error', `No providers match "${arg}".`);
      scheduleRender();
      return;
    }
    const items = names.map((id) => rowText(PROVIDERS.find((p) => p.id === id)!, deps.activeProvider));
    setMenuSelected(0);
    const idx = await openMenu(`Providers matching "${arg}"`, items);
    if (idx < 0 || idx >= names.length) return;
    await showProvider(PROVIDERS.find((x) => x.id === names[idx])!);
    return;
  }

  const items = PROVIDERS.map((p) => rowText(p, deps.activeProvider));
  const curIdx = PROVIDERS.findIndex((p) => p.id === deps.activeProvider);
  setMenuSelected(Math.max(0, curIdx));
  const idx = await openMenu('Connected Model Providers', items);
  if (idx < 0 || idx >= PROVIDERS.length) return;
  await showProvider(PROVIDERS[idx]);
}

/** Re-authenticate one provider: model select → key entry → persist. */
async function reauthenticate(deps: ProvidersMenuDeps, p: Provider): Promise<void> {
  const { openMenu, setMenuSelected } = deps;
  const modelItems = p.models.map((m) => `${m.padEnd(36)}`);
  const defIdx = p.models.indexOf(p.defaultModel);
  setMenuSelected(Math.max(0, defIdx >= 0 ? defIdx : 0));
  const modelIdx = await openMenu(`${p.name} · Select Model`, modelItems);
  const model = modelIdx >= 0 && modelIdx < p.models.length ? p.models[modelIdx] : p.defaultModel;
  await authenticateKey(deps, p, model);
}

/** Shared key entry used by /providers re-auth AND /login (imported by
 *  app.ts): keyless locals switch with no key; otherwise the user is ALWAYS
 *  prompted — typing replaces the configured key, Enter keeps it. The old
 *  code silently reused env/stored keys and never prompted, so a key could
 *  never be replaced. OAuth/CLI tokens (gh, huggingface-cli cache) fill in
 *  when nothing is configured and Enter is pressed. Rejected keys are never
 *  stored; unreachable endpoints store with a warning. */
export async function authenticateKey(deps: AuthDeps, p: Provider, model: string): Promise<void> {
  const { push, scheduleRender } = deps;
  // Keyless local providers need no key at all — just switch.
  if (!p.envKey) {
    const desc = await deps.switchProvider(p.id, model);
    push('system', `${p.name} needs no API key (local). ${desc}`);
    scheduleRender();
    return;
  }
  const envKey = deps.envLookup(p.envKey);
  const stored = deps.activeProvider === p.id ? deps.storedKey : undefined;
  const current = envKey ? 'env' : stored ? 'stored file' : null;
  const typed = (await deps.ask(
    current
      ? `${p.name} API Key: (Enter keeps the current ${current} key, or type a new one)`
      : `${p.name} API Key:`,
  )).trim();
  let apiKey = '';
  let source = '';
  if (typed) { apiKey = typed; source = 'typed'; }
  else if (envKey) { apiKey = envKey; source = 'env'; }
  else if (stored) { apiKey = stored; source = 'stored file'; }
  else {
    const ambient = await deps.getAmbientKey(p.id);
    if (ambient) { apiKey = ambient; source = 'oauth'; }
  }
  if (!apiKey && p.envKey) {
    push('error', `No API key for ${p.id}. Set $${p.envKey}${p.keyHelp ? ` (${p.keyHelp})` : ''} or enter one.`);
    scheduleRender();
    return;
  }
  if (!apiKey) { push('error', 'No API key provided.'); scheduleRender(); return; }
  const v = await deps.verifyKey(p.id, p.baseUrl, p.kind, apiKey);
  if (!v.ok && v.reason === 'auth') {
    push('error', `Key rejected by ${p.name}: ${v.message} Not stored — check the key and try again.`);
    scheduleRender();
    return;
  }
  if (!v.ok) push('system', `Warning: could not verify the key (${v.message}) — storing anyway.`);
  else push('system', `Verified key with ${p.name}${source === 'oauth' ? ' (OAuth token from local CLI auth)' : ''}.`);
  scheduleRender();
  const desc = await deps.persistLogin(p.id, apiKey, model);
  push('system', desc);
  scheduleRender();
}

/** Clear one provider's stored file key (env keys are reported, not touched). */
async function clearStoredKey(deps: ProvidersMenuDeps, p: Provider): Promise<void> {
  const { push, scheduleRender } = deps;
  const out = decideLogout(p.id, true, deps.activeProvider, deps.storedKey);
  if (!out.cleared) {
    push('system', `${out.message} Env-provided keys are unaffected (unset $${p.envKey} to remove those).`);
    scheduleRender();
    return;
  }
  await deps.persistCleared();
  push('system', `${out.message} Re-authenticate any time from this menu. Env-provided keys are unaffected (unset $${p.envKey} to remove those).`);
  scheduleRender();
}
