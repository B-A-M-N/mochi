// /providers browser as a testable unit (tools-menu pattern): all TUI
// effects arrive injected, so tests drive the full menu flow with scripted
// answers. app.ts stays a one-line dispatcher, keeping the coverage ratchet
// honest. Read-only: it never stores keys or switches providers (that stays
// in /login and /model); it shows where each key comes from plus keyHelp
// (e.g. github-models via `gh auth login`) so users can act.

import { PROVIDERS, type Provider } from '../model/providers.js';
import { keySource } from '../model/auth-cli.js';
import { isKeyUsable } from '../model/startup-check.js';
import { T } from './view.js';
import type { LineKind } from './state.js';

export interface ProvidersMenuDeps {
  openMenu: (title: string, items: string[]) => Promise<number>;
  push: (kind: LineKind, text: string) => void;
  scheduleRender: () => void;
  setMenuSelected: (i: number) => void;
  /** Currently active provider id (for the ACTIVE badge). */
  activeProvider: string;
  /** Read an env var without touching process.env directly in tests. */
  envLookup: (key: string) => string | undefined;
  /** Stored file key for the active provider (never printed). */
  storedKey: string | undefined;
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

  if (arg) {
    // Exact id or name → details with no menu; substring → filtered menu.
    const exact = PROVIDERS.find((p) => p.id === arg || p.id === arg.toLowerCase() || p.name.toLowerCase() === arg.toLowerCase());
    if (exact) {
      push('system', detailsText(exact, deps.activeProvider, deps.envLookup, deps.storedKey));
      scheduleRender();
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
    const p = PROVIDERS.find((x) => x.id === names[idx])!;
    push('system', detailsText(p, deps.activeProvider, deps.envLookup, deps.storedKey));
    scheduleRender();
    return;
  }

  const items = PROVIDERS.map((p) => rowText(p, deps.activeProvider));
  const curIdx = PROVIDERS.findIndex((p) => p.id === deps.activeProvider);
  setMenuSelected(Math.max(0, curIdx));
  const idx = await openMenu('Connected Model Providers', items);
  if (idx < 0 || idx >= PROVIDERS.length) return;
  const p = PROVIDERS[idx];
  push('system', detailsText(p, deps.activeProvider, deps.envLookup, deps.storedKey));
  scheduleRender();
}
