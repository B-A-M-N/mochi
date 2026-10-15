// Plugin registry (spec 12-E): mochi plugin add|remove|list.
//
// A plugin is a directory under .mochi/plugins/ (project) or ~/.mochi/plugins/
// (user) containing a `plugin.json` manifest. The manifest declares metadata
// plus automation hooks, each a shell command that runs through the existing
// HookManager pipeline (before_tool/after_tool/before_edit/on_error/...).
// Hooks are merged into hooks.json on every mutation so the agent loop picks
// them up without code changes. TS automation hooks run via the plugin's own
// `node`/`bun` commands; Lua via `lua` when the plugin declares it.
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs';
import {resolve} from 'node:path';
import { SANDBOX_KEY, type HookConfig, type HookName } from './hooks.js';

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  /** Shell commands (or arrays) keyed by HookName, same shape as hooks.json. */
  hooks?: Partial<Record<HookName, string | string[]>>;
  /** Command that runs when a plugin is loaded, e.g. "node ./activate.js". */
  activation?: string;
  /** When true, hooks are documented as sandbox-safe (no network, no writes
   *  outside the workspace). The HookManager does not enforce this yet —
   *  `validateDir` warns on obviously-unsafe commands so authors opt in
   *  honestly. */
  sandbox?: boolean;
}

export interface PluginRecord {
  name: string;
  version: string;
  description: string;
  dir: string;
  scope: 'project' | 'user';
  hooks: HookName[];
  enabled: boolean;
}

const HOOK_KEYS: HookName[] = [
  'before_goal', 'after_goal', 'before_task', 'after_task', 'before_agent',
  'after_agent', 'before_tool', 'after_tool', 'before_edit', 'after_edit',
  'before_shell', 'after_shell', 'before_verify', 'after_verify', 'on_error',
  'on_checkpoint', 'on_rollback',
];

export function isHookName(s: string): s is HookName {
  return (HOOK_KEYS as string[]).includes(s);
}

/** Round-trip a plugin directory -> manifest. Throws on malformed manifests. */
export function readManifest(dir: string): PluginManifest {
  const file = resolve(dir, 'plugin.json');
  if (!existsSync(file)) throw new Error(`No plugin.json in ${dir}`);
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || !raw.name.trim()) {
    throw new Error(`Invalid plugin manifest: ${file} (missing name)`);
  }
  return raw as PluginManifest;
}

function defaultUserPluginsDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || resolve('/tmp', 'mochi-home');
  return resolve(home, '.mochi', 'plugins');
}

export class PluginRegistry {
  constructor(
    private projectDir: string,
    private userPluginsDir: string = defaultUserPluginsDir(),
  ) {}

  /** project dir (checked first) wins over the user dir. */
  list(): PluginRecord[] {
    const out: PluginRecord[] = [];
    for (const [dir, scope] of [[this.projectDir, 'project'], [this.ensureUserDir(), 'user']] as const) {
      if (!existsSync(dir)) continue;
      for (const entry of readdirSync(dir)) {
        const p = resolve(dir, entry);
        if (!statSync(p).isDirectory()) continue;
        try {
          const manifest = readManifest(p);
          out.push({
            name: manifest.name,
            version: manifest.version,
            description: manifest.description ?? '',
            dir: p,
            scope,
            hooks: Object.keys(manifest.hooks ?? {}) as HookName[],
            enabled: !existsSync(resolve(p, '.disabled')),
          });
        } catch {
          // skip malformed plugin dirs; don't crash the catalog
        }
      }
    }
    return out.sort((a, b) => (a.name < b.name ? -1 : 1));
  }

  /** Is a plugin name present (project or user scope)? */
  has(name: string): boolean {
    return this.list().some((p) => p.name === name);
  }

  /** True when the plugin lives in the project scope dir. */
  isProjectScoped(name: string): boolean {
    if (!existsSync(this.projectDir)) return false;
    return existsSync(resolve(this.projectDir, name, 'plugin.json'));
  }

  /**
   * Install a plugin by copying `sourceDir` into the appropriate scope.
   * `name` defaults to the manifest name. Validates the manifest before
   * copying; rejects when the target already exists unless overwrite=true.
   */
  install(sourceDir: string, opts: { scope?: 'project' | 'user'; overwrite?: boolean } = {}): PluginRecord {
    const source = resolve(sourceDir);
    const manifest = readManifest(source);
    // Refuse obviously-broken manifests (unknown hooks, non-credible sandbox
    // claim) at install time instead of silently loading a half-broken plugin.
    const problems = PluginRegistry.validateDir(source);
    if (problems.length) throw new Error(`Invalid plugin:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    const name = manifest.name;
    // Default scope is project for the CLI; user scope is explicit (--user).
    const scope = opts.scope ?? 'project';
    const targetRoot = scope === 'user' ? this.ensureUserDir() : this.projectDir;
    const target = resolve(targetRoot, name);
    if (existsSync(target) && !opts.overwrite) {
      throw new Error(`Plugin "${name}" already installed (${target}). Use --force to overwrite.`);
    }
    mkdirSync(targetRoot, { recursive: true });
    // Removed target first so a stale copy never masks the new one.
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    cpSync(source, target, { recursive: true });
    return { name, version: manifest.version, description: manifest.description ?? '', dir: target, scope, hooks: Object.keys(manifest.hooks ?? {}) as HookName[], enabled: true };
  }

  remove(name: string): boolean {
    let removed = false;
    for (const scope of this.list().filter((p) => p.name === name)) {
      rmSync(scope.dir, { recursive: true, force: true });
      removed = true;
    }
    return removed;
  }

  /** The hook commands a named plugin contributes (from its manifest). Read
   *  BEFORE remove(), since remove deletes the manifest. */
  pluginCommands(name: string): string[] {
    const hit = this.list().find((p) => p.name === name);
    if (!hit) return [];
    let hooks: HookConfig = {};
    try {
      hooks = readManifest(hit.dir).hooks ?? {};
    } catch {
      return [];
    }
    const out: string[] = [];
    for (const v of Object.values(hooks)) for (const c of toArray(v)) out.push(c);
    return out;
  }

  /** Drop specific hook commands from a hooks config (returns a new config).
   *  syncToHooksFile only APPENDS, so removing a plugin without stripping its
   *  commands first left them live in hooks.json — a removed/disabled plugin
   *  kept running every hook until the next install. */
  stripCommands(existing: HookConfig, commands: Iterable<string>): HookConfig {
    const dead = new Set(commands);
    const out: HookConfig = {};
    for (const [hook, value] of Object.entries(existing)) {
      if (hook === SANDBOX_KEY) {
        const keptSandbox = toArray(value).filter((c) => !dead.has(c));
        if (keptSandbox.length) out[hook] = keptSandbox;
        continue;
      }
      if (!isHookName(hook)) continue;
      const kept = toArray(value).filter((c) => !dead.has(c));
      if (kept.length) out[hook] = kept;
    }
    return out;
  }

  /** Hook commands contributed by sandbox:true plugins (they run sandboxed).
   *  Only enabled plugins contribute. */
  sandboxCommands(): string[] {
    const out: string[] = [];
    for (const plugin of this.list()) {
      if (!plugin.enabled) continue;
      try {
        const manifest = readManifest(plugin.dir);
        if (!manifest.sandbox) continue;
        for (const v of Object.values(manifest.hooks ?? {})) out.push(...toArray(v));
      } catch { /* skip malformed */ }
    }
    return [...new Set(out)];
  }

  /** Run a plugin's `activation` command (e.g. "node ./activate.js"), sandboxed
   *  when the manifest declares `sandbox: true`. Returns the outcome. Called on
   *  explicit load (install / enable) — never implicitly at session start, so
   *  installing a plugin is the moment arbitrary code runs. */
  async runActivation(name: string): Promise<{ ok: boolean; exitCode: number; stdout: string; stderr: string; skipped?: boolean }> {
    const hit = this.list().find((p) => p.name === name);
    if (!hit) throw new Error(`No plugin "${name}" installed.`);
    const manifest = readManifest(hit.dir);
    if (!manifest.activation) return { ok: true, exitCode: 0, stdout: '', stderr: '', skipped: true };
    const { runShellString } = await import('./exec.js');
    const r = await runShellString(manifest.activation, {
      cwd: hit.dir,
      env: { ...process.env, MOCHI_PLUGIN: name, MOCHI_PLUGIN_DIR: hit.dir },
      timeoutMs: 30_000,
      maxOutput: 1024 * 1024,
      ...(manifest.sandbox ? { sandbox: { mode: 'auto' as const, network: false } } : {}),
    });
    const exitCode = r.code ?? (r.timedOut ? 124 : 1);
    return { ok: exitCode === 0, exitCode, stdout: r.stdout, stderr: r.stderr };
  }

  /** Disable without deleting (writes a `.disabled` sentinel; hooks stop merging). */
  setEnabled(name: string, enabled: boolean): boolean {
    let changed = false;
    for (const p of this.list().filter((x) => x.name === name)) {
      const flag = resolve(p.dir, '.disabled');
      if (enabled && existsSync(flag)) {
        rmSync(flag, { force: true });
        changed = true;
      } else if (!enabled && !existsSync(flag)) {
        writeFileSync(flag, 'disabled by `mochi plugin disable`\n');
        changed = true;
      }
    }
    return changed;
  }

  /** Human-readable manifest dump for `mochi plugin info`. */
  info(name: string): string {
    const hit = this.list().find((p) => p.name === name);
    if (!hit) throw new Error(`No plugin "${name}" installed.`);
    const manifest = readManifest(hit.dir);
    const lines = [
      `${manifest.name} v${manifest.version} [${hit.scope}] ${hit.enabled ? 'enabled' : 'disabled'}`,
      manifest.description ? `  ${manifest.description}` : '',
      `  dir: ${hit.dir}`,
      hit.hooks.length ? `  hooks: ${hit.hooks.join(', ')}` : '  hooks: (none)',
      manifest.activation ? `  activation: ${manifest.activation}` : '',
      manifest.sandbox ? '  sandbox: true (network off + secrets scrubbed; unsafe commands rejected)' : '',
    ].filter(Boolean);
    return lines.join('\n');
  }

  /** Validate a plugin dir without installing (manifest + hook names). */
  static validateDir(dir: string): string[] {
    const problems: string[] = [];
    try {
      const manifest = readManifest(dir);
      if (!manifest.version) problems.push('plugin.json missing "version"');
      for (const k of Object.keys(manifest.hooks ?? {})) {
        if (!isHookName(k)) problems.push(`unknown hook "${k}"`);
      }
      // Enforce the sandbox CLAIM: a manifest that says sandbox:true must not
      // ship commands that plainly escape a sandbox. Refusing install here is
      // what makes the flag meaningful instead of decorative.
      if (manifest.sandbox) {
        const unsafe = PluginRegistry.lintSandbox(dir).filter((w) => !w.startsWith('manifest claims'));
        for (const w of unsafe) problems.push(`sandbox:true is not credible — ${w}`);
      }
    } catch (e) {
      problems.push(e instanceof Error ? e.message : String(e));
    }
    return problems;
  }

  /** Sandbox lint: warnings (not errors) for hooks that look unsafe when the
   *  manifest claims `sandbox: true` — or informational when it doesn't.
   *  Pure, never throws. */
  static lintSandbox(dir: string): string[] {
    const warnings: string[] = [];
    let manifest: PluginManifest;
    try {
      manifest = readManifest(dir);
    } catch {
      return warnings;
    }
    const cmds: string[] = [];
    for (const v of Object.values(manifest.hooks ?? {})) {
      if (typeof v === 'string') cmds.push(v);
      else if (Array.isArray(v)) cmds.push(...v);
    }
    if (manifest.activation) cmds.push(manifest.activation);
    const risky: Array<[RegExp, string]> = [
      [/rm\s+-rf?\s+\//, 'rm -rf / — destructive filesystem wipe'],
      [/curl[^|]*\|\s*(ba)?sh/, 'curl-piped-to-shell installer'],
      [/wget[^|]*\|\s*(ba)?sh/, 'wget-piped-to-shell installer'],
      [/nc\s+-l/, 'netcat listener'],
      [/chmod\s+777/, 'chmod 777 — world-writable'],
    ];
    for (const c of cmds) {
      for (const [re, label] of risky) {
        if (re.test(c)) warnings.push(`sandbox: ${label} in "${c.slice(0, 80)}"`);
      }
    }
    if (manifest.sandbox && warnings.length) {
      warnings.unshift('manifest claims sandbox:true but hooks look unsafe — drop the flag or clean the commands');
    }
    return [...new Set(warnings)];
  }

  /** Search installed plugins by name/description/hooks (case-insensitive). */
  search(query: string): PluginRecord[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.list();
    return this.list().filter((p) => {
      const hay = `${p.name} ${p.description} ${p.hooks.join(' ')}`.toLowerCase();
      if (hay.includes(q)) return true;
      const toks = q.split(/\s+/).filter(Boolean);
      return toks.length > 1 && toks.every((t) => hay.includes(t));
    });
  }

  /** Export an installed plugin to a portable directory (manifest + files).
   *  Share the directory; recipients install with `mochi plugin add <dir>`. */
  pack(name: string, outDir: string): string {
    const hit = this.list().find((p) => p.name === name);
    if (!hit) throw new Error(`No plugin "${name}" installed.`);
    const dest = resolve(outDir, name);
    mkdirSync(outDir, { recursive: true });
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    cpSync(hit.dir, dest, { recursive: true });
    return dest;
  }

  /** The effective hooks.json content contributed by all installed plugins. */
  mergedHooks(): HookConfig {
    const out: HookConfig = {};
    for (const plugin of this.list()) {
      if (!plugin.enabled) continue;
      const manifest = readManifest(plugin.dir);
      if (!manifest.hooks) continue;
      for (const [hook, command] of Object.entries(manifest.hooks)) {
        if (!isHookName(hook)) continue;
        out[hook] = out[hook] ? [...toArray(out[hook]), ...toArray(command)] : toArray(command);
      }
    }
    return out;
  }

  /** Write merged plugin hooks into <workspace>/.mochi/hooks.json (appended). */
  syncToHooksFile(hooksFile: string, existing: HookConfig = {}): void {
    const merged: HookConfig = {};
    for (const [hook, command] of Object.entries(existing)) {
      if (isHookName(hook)) merged[hook] = toArray(command);
    }
    for (const [hook, chunks] of Object.entries(this.mergedHooks())) {
      // Dedupe: each `plugin add` re-syncs ALL plugin hooks, so appending
      // blindly duplicated every plugin's commands in hooks.json on each add.
      const mergedList = toArray(merged[hook] ?? []);
      for (const c of toArray(chunks)) {
        if (!mergedList.includes(c)) mergedList.push(c);
      }
      merged[hook] = mergedList;
    }
    // Reserved key consumed by HookManager: commands from sandbox:true plugins
    // run with OS sandboxing + a secrets-scrubbed environment.
    const sandboxed = this.sandboxCommands();
    if (sandboxed.length) merged[SANDBOX_KEY] = sandboxed;
    else delete merged[SANDBOX_KEY];
    mkdirSync(resolve(hooksFile, '..'), { recursive: true });
    writeFileSync(hooksFile, JSON.stringify(merged, null, 2) + '\n');
  }

  get dir() {
    return this.projectDir;
  }

  private ensureUserDir(): string {
    mkdirSync(this.userPluginsDir, { recursive: true });
    return this.userPluginsDir;
  }

}

function toArray(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export const version = '0.1.0';