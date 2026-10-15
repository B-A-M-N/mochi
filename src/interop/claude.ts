// Claude Code interop — adopt an existing Claude setup instead of re-authoring it.
//
// Reads the user's Claude Code configuration and brings it into Mochi:
//   - .claude/settings.json (+ settings.local.json, + ~/.claude/settings.json)
//     `hooks` are translated into Mochi's hooks.json (event names + tool
//     matchers both differ between the two products, so both are mapped).
//   - .claude/agents/*.md    -> .mochi/agents/*.md   (native Mochi profiles)
//   - .claude/commands/*.md  -> .mochi/skills/claude-commands/<slug>/SKILL.md
//
// Non-destructive: existing Mochi files are never overwritten unless --force.
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import type { HookConfig, HookName } from '../hooks.js';
import { parseFrontmatter, safeSlug } from '../skills/skill-manager.js';

export interface ClaudeHookCommand { type?: string; command?: string }
export interface ClaudeHookMatcher { matcher?: string; hooks?: ClaudeHookCommand[] }
export interface ClaudeSettings { hooks?: Record<string, ClaudeHookMatcher[]> }

/** Claude Code hook event -> Mochi hook name. Unmapped events are reported. */
export const CLAUDE_HOOK_EVENTS: Record<string, HookName> = {
  PreToolUse: 'before_tool',
  PostToolUse: 'after_tool',
  UserPromptSubmit: 'before_task',
  Stop: 'after_goal',
  SubagentStop: 'after_agent',
  SessionStart: 'before_goal',
};

/** Claude Code tool name -> Mochi tool name (for matcher translation). */
export const CLAUDE_TOOL_NAMES: Record<string, string> = {
  Bash: 'shell',
  Edit: 'edit',
  MultiEdit: 'edit',
  Write: 'write',
  Read: 'read',
  Glob: 'glob',
  Grep: 'search',
  WebFetch: 'fetch',
  WebSearch: 'fetch',
  NotebookEdit: 'notebook',
  Task: 'subagent',
};

/** Translate a Claude tool matcher ("Bash|Write", "Edit,Write", "*") to the
 *  Mochi tool-name equivalents. Unknown tokens pass through unchanged. */
export function translateMatcher(matcher: string): string {
  return matcher
    .split(/[|,]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => CLAUDE_TOOL_NAMES[t] ?? t)
    .join('|');
}

/** Build a portable guard so a matcher-scoped hook only fires for its tools.
 *  Works in both sh and cmd.exe (uses only `&&` and a quote-free node -e). */
export function guardedCommand(matcher: string | undefined, command: string): string {
  const raw = (matcher ?? '').trim();
  if (!raw || raw === '*' || raw === '.*') return command;
  const translated = translateMatcher(raw);
  if (!translated) return command;
  const escaped = translated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `node -e "if(!/^(?:${escaped})$/.test(process.env.MOCHI_TOOL||''))process.exit(0)" && ${command}`;
}

/** Convert Claude settings into a Mochi HookConfig (commands per hook name). */
export function claudeHooksToMochi(settingsList: ClaudeSettings[]): { hooks: HookConfig; unmapped: string[] } {
  const hooks: HookConfig = {};
  const unmapped = new Set<string>();
  for (const settings of settingsList) {
    for (const [event, matchers] of Object.entries(settings.hooks ?? {})) {
      const target = CLAUDE_HOOK_EVENTS[event];
      if (!target) { unmapped.add(event); continue; }
      if (!Array.isArray(matchers)) continue;
      for (const entry of matchers) {
        for (const h of entry?.hooks ?? []) {
          const cmd = typeof h?.command === 'string' ? h.command.trim() : '';
          if (!cmd) continue;
          const guarded = guardedCommand(entry?.matcher, cmd);
          const list = Array.isArray(hooks[target]) ? (hooks[target] as string[]) : (hooks[target] ? [hooks[target] as string] : []);
          if (!list.includes(guarded)) list.push(guarded);
          hooks[target] = list;
        }
      }
    }
  }
  return { hooks, unmapped: [...unmapped] };
}

function readJson(file: string): ClaudeSettings | null {
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as ClaudeSettings) : null;
  } catch {
    return null;
  }
}

/** Locate Claude settings files: project first, then user. */
export function claudeSettingsFiles(cwd: string, home = process.env.HOME || process.env.USERPROFILE || ''): string[] {
  const out = [
    resolve(cwd, '.claude', 'settings.json'),
    resolve(cwd, '.claude', 'settings.local.json'),
  ];
  if (home) out.push(resolve(home, '.claude', 'settings.json'));
  return out;
}

function mdFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = resolve(dir, e);
    try {
      if (statSync(p).isDirectory()) out.push(...mdFiles(p)); // Claude namespaces via subdirs
      else if (extname(e).toLowerCase() === '.md') out.push(p);
    } catch { /* unreadable */ }
  }
  return out;
}

export interface ClaudeInteropReport {
  dryRun: boolean;
  hooksAdded: number;
  hooksFile: string;
  unmappedEvents: string[];
  agentsImported: string[];
  commandsImported: string[];
  skipped: Array<{ name: string; reason: string }>;
}

/** Import a Claude Code setup into this project's .mochi tree. */
export function importClaudeInterop(
  cwd: string,
  opts: { force?: boolean; dryRun?: boolean; home?: string } = {},
): ClaudeInteropReport {
  const dryRun = !!opts.dryRun;
  const home = opts.home ?? process.env.HOME ?? process.env.USERPROFILE ?? '';
  const mochiDir = resolve(cwd, '.mochi');

  // 1. Hooks -> .mochi/hooks.json (merged, never clobbering existing entries).
  const settings = claudeSettingsFiles(cwd, home).map(readJson).filter((s): s is ClaudeSettings => !!s);
  const { hooks: claudeHooks, unmapped } = claudeHooksToMochi(settings);
  const hooksFile = resolve(mochiDir, 'hooks.json');
  let existing: HookConfig = {};
  if (existsSync(hooksFile)) {
    try { existing = JSON.parse(readFileSync(hooksFile, 'utf8')) as HookConfig; } catch { existing = {}; }
  }
  let hooksAdded = 0;
  const merged: HookConfig = { ...existing };
  for (const [hook, value] of Object.entries(claudeHooks)) {
    const incoming = Array.isArray(value) ? value : [value];
    const list = Array.isArray(merged[hook]) ? (merged[hook] as string[]) : (merged[hook] ? [merged[hook] as string] : []);
    for (const cmd of incoming) {
      if (!list.includes(cmd)) { list.push(cmd); hooksAdded++; }
    }
    merged[hook] = list;
  }

  // 2. Agents -> .mochi/agents/ (native profile markdown, same format).
  const agentsDir = resolve(mochiDir, 'agents');
  const agentSources = [
    ...mdFiles(resolve(cwd, '.claude', 'agents')),
    ...(home ? mdFiles(resolve(home, '.claude', 'agents')) : []),
  ];
  const agentsImported: string[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  for (const src of agentSources) {
    const name = basename(src);
    const dest = resolve(agentsDir, name);
    if (existsSync(dest) && !opts.force) { skipped.push({ name, reason: 'already exists' }); continue; }
    if (!dryRun) {
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(dest, readFileSync(src, 'utf8'));
    }
    agentsImported.push(name);
  }

  // 3. Commands -> .mochi/skills/claude-commands/<slug>/SKILL.md.
  const commandSources = [
    ...mdFiles(resolve(cwd, '.claude', 'commands')),
    ...(home ? mdFiles(resolve(home, '.claude', 'commands')) : []),
  ];
  const commandsImported: string[] = [];
  for (const src of commandSources) {
    const text = (() => { try { return readFileSync(src, 'utf8'); } catch { return ''; } })();
    if (!text.trim()) continue;
    const fm = parseFrontmatter(text);
    const fileBase = basename(src, extname(src));
    const displayName = String(fm?.meta.name ?? fileBase);
    const slug = safeSlug(displayName);
    const destDir = resolve(mochiDir, 'skills', 'claude-commands', slug);
    const dest = resolve(destDir, 'SKILL.md');
    if (existsSync(dest) && !opts.force) { skipped.push({ name: displayName, reason: 'already exists' }); continue; }
    const description = String(fm?.meta.description ?? `Claude Code command: ${displayName}`);
    const body = (fm?.body ?? text).trim();
    const skill = `---\nname: ${displayName}\ndescription: ${description}\n---\n\n${body}\n`;
    if (!dryRun) {
      mkdirSync(destDir, { recursive: true });
      writeFileSync(dest, skill);
    }
    commandsImported.push(displayName);
  }

  // Persist hooks (even when only agents/commands changed, hooks.json may be new).
  if (!dryRun && hooksAdded > 0) {
    mkdirSync(mochiDir, { recursive: true });
    writeFileSync(hooksFile, JSON.stringify(merged, null, 2) + '\n');
  }

  return {
    dryRun,
    hooksAdded,
    hooksFile,
    unmappedEvents: unmapped,
    agentsImported,
    commandsImported,
    skipped,
  };
}

export function formatClaudeReport(r: ClaudeInteropReport): string {
  const lines = [
    r.dryRun ? 'Claude interop (dry run — nothing written):' : 'Claude interop:',
    `  hooks: ${r.hooksAdded} added${r.hooksAdded ? ` -> ${r.hooksFile}` : ''}`,
  ];
  if (r.unmappedEvents.length) lines.push(`  unmapped Claude hook events (skipped): ${r.unmappedEvents.join(', ')}`);
  lines.push(`  agents: ${r.agentsImported.length ? r.agentsImported.join(', ') : '(none)'}`);
  lines.push(`  commands: ${r.commandsImported.length ? r.commandsImported.join(', ') : '(none)'}`);
  if (r.skipped.length) lines.push(`  skipped: ${r.skipped.map((s) => `${s.name} (${s.reason})`).join(', ')}`);
  return lines.join('\n');
}
