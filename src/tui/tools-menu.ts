// /tools browser as a testable unit (onboard-flow pattern): all TUI effects
// arrive injected, so tests drive the full menu flow with scripted answers —
// details, try-it success/error paths, arg validation, Esc handling. app.ts
// stays a one-line dispatcher, keeping the coverage ratchet honest.

import { buildTools, executeTool } from '../tools/index.js';
import { formatToolDetails } from './cards.js';
import { T } from './view.js';
import type { LineKind } from './state.js';
import type { MochiConfig } from '../types.js';
import type { Workspace } from '../workspace.js';
import type { EventBus } from '../events.js';

export interface ToolsMenuDeps {
  openMenu: (title: string, items: string[]) => Promise<number>;
  ask: (question: string) => Promise<string>;
  push: (kind: LineKind, text: string) => void;
  scheduleRender: () => void;
  config: MochiConfig;
  workspace: Workspace;
  events: EventBus;
  signal: AbortSignal;
  projectRoot: string;
  setMenuSelected: (i: number) => void;
}

/** Names sorted for the browser, optionally filtered by a query. Pure. */
export function matchTools(names: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...names].sort();
  return names.filter((n) => n === q || n.includes(q)).sort();
}

export async function toolsMenu(deps: ToolsMenuDeps, line: string): Promise<void> {
  const { openMenu, ask, push, scheduleRender } = deps;
  const tools = buildTools(deps.config);
  const names = [...tools.keys()];
  const arg = (line.length > 6 ? line.slice(6) : '').trim().toLowerCase();

  const showDetails = (name: string): void => {
    const t = tools.get(name);
    if (!t) { push('error', `No tool '${name}'.`); scheduleRender(); return; }
    push('system', formatToolDetails(t.def));
    scheduleRender();
  };

  const tryTool = async (name: string): Promise<void> => {
    if (!tools.has(name)) { push('error', `No tool '${name}'.`); scheduleRender(); return; }
    const raw = await ask(`Args for ${name} as JSON ({} for none, Esc cancels):`);
    if (!raw.trim()) { push('system', 'Tool run cancelled.'); scheduleRender(); return; }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('need an object');
    } catch {
      push('error', 'Args must be a JSON object, e.g. {"path": "src/x.ts"}.');
      scheduleRender();
      return;
    }
    const tcId = `tui-${Date.now().toString(36)}`;
    deps.events.emit({ type: 'tool:called', tool: name, args: parsed, agentId: 'tui', tool_call_id: tcId });
    scheduleRender();
    const r = await executeTool(name, parsed, {
      cwd: deps.projectRoot,
      workspace: deps.workspace,
      config: deps.config,
      events: deps.events,
      agentId: 'tui',
      abortSignal: deps.signal,
      callerEmittedEvent: true,
    }, tools);
    deps.events.emit({
      type: 'tool:completed',
      tool: name,
      result: { toolCallId: tcId, name, output: r.output, error: r.error, durationMs: r.durationMs },
      agentId: 'tui',
    });
    scheduleRender();
  };

  // Exact name or single prefix hit skips the menu and goes straight there.
  const pool = matchTools(names, arg);
  if (arg && tools.has(arg)) { showDetails(arg); return; }
  if (arg && !pool.length) { push('error', `No tools match "${arg}".`); scheduleRender(); return; }
  if (arg && pool.length === 1) { showDetails(pool[0]); return; }

  const items = pool.map((n) => {
    const desc = String(tools.get(n)!.def.description).split('\n')[0].slice(0, 56);
    return `${T.cyan}${n.padEnd(22)}${T.reset}  ${T.grayDark}${desc}${T.reset}`;
  });
  deps.setMenuSelected(0);
  const idx = await openMenu(`Agent Tools (${pool.length})`, items);
  if (idx < 0 || idx >= pool.length) return;
  const chosen = pool[idx];
  const act = await openMenu(`Tool: ${chosen}`, ['Show details', 'Try it (prompt for args)', 'Back']);
  if (act === 0) showDetails(chosen);
  else if (act === 1) await tryTool(chosen);
}
