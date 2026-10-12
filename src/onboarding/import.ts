// Onboarding persistence + import engine.
// Writes the one-time marker (~/.config/mochi/onboarded.json) and applies
// the user's import choices: provider keys -> config.json (+ failover chain),
// skills -> ~/.mochi/skills via skill-importer, MCPs -> config mcpServers.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { PROVIDERS, loadConfigFile, saveConfigFile } from '../model/providers.js';
import type { MochiConfig } from '../types.js';

export interface OnboardedState {
  version: number;
  at: number;
  providersImported: string[];
  skillsImported: number;
  mcpImported: number;
}

export function onboardedPath(): string {
  if (process.env.MOCHI_CONFIG_PATH) return resolve(dirname(process.env.MOCHI_CONFIG_PATH), 'onboarded.json');
  return join(homedir(), '.config', 'mochi', 'onboarded.json');
}

export function isOnboarded(): boolean {
  try {
    const p = onboardedPath();
    if (!existsSync(p)) return false;
    const parsed = JSON.parse(readFileSync(p, 'utf8')) as Partial<OnboardedState>;
    return typeof parsed.at === 'number' && (parsed.version ?? 0) >= 1;
  } catch { return false; }
}

export function markOnboarded(state: Omit<OnboardedState, 'version' | 'at'> & Partial<Pick<OnboardedState, 'at'>>): OnboardedState {
  const full: OnboardedState = {
    version: 1,
    at: state.at ?? Date.now(),
    providersImported: state.providersImported ?? [],
    skillsImported: state.skillsImported ?? 0,
    mcpImported: state.mcpImported ?? 0,
  };
  try {
    const p = onboardedPath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(full, null, 2) + '\n', 'utf8');
  } catch { /* best-effort */ }
  return full;
}

function readEnvPool(): Record<string, string> {
  const pool: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v) pool[k] = v;
  const home = homedir();
  for (const f of [resolve(process.cwd(), '.env'), join(home, '.mochi', '.env'), join(home, '.hermes', '.env')]) {
    try {
      if (!existsSync(f)) continue;
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq <= 0) continue;
        const k = t.slice(0, eq).trim();
        let v = t.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (k && v && !pool[k]) pool[k] = v;
      }
    } catch { /* ignore */ }
  }
  return pool;
}

/** Apply detected provider keys to the mochi config.
 *  Picks the first keyed provider as primary (preferring free/zen tiers),
 *  builds a failover chain from the rest. Never overwrites an explicitly-set
 *  primary unless `overwrite` is true. Returns the providers wired. */
export function importProviderKeys(opts: { overwrite?: boolean } = {}): { primary?: string; failover: string[] } {
  const pool = readEnvPool();
  const isReal = (v: string | undefined): boolean => {
    if (!v) return false;
    const k = v.trim();
    if (k.length < 6) return false;
    const low = k.toLowerCase();
    return !(low === 'hi' || low.startsWith('your') || low.startsWith('sk-your') || low.includes('your-key') || low.includes('set me') || low.startsWith('<') || low.endsWith('_here'));
  };
  const keyed = PROVIDERS.filter((p) => {
    if (!p.envKey) return false;
    return isReal(pool[p.envKey]);
  });
  if (!keyed.length) return { failover: [] };
  // Prefer free/low-friction tiers first for a cozy first run.
  const prefer = ['freeinference', 'opencode-zen', 'opencode-go', 'openai', 'anthropic', 'gemini', 'deepseek', 'openrouter', 'groq', 'mistral'];
  keyed.sort((a, b) => {
    const ia = prefer.includes(a.id) ? prefer.indexOf(a.id) : 999;
    const ib = prefer.includes(b.id) ? prefer.indexOf(b.id) : 999;
    return ia - ib;
  });

  const disk = loadConfigFile() as Partial<MochiConfig> as MochiConfig;
  const hasPrimary = !!(disk as { model?: { apiKey?: string } }).model?.apiKey;
  const cfg = (Object.keys(disk).length ? disk : {}) as MochiConfig;
  if (!cfg.model) (cfg as { model: unknown }).model = {};
  const model = cfg.model as MochiConfig['model'];

  const primary = keyed[0];
  if (!hasPrimary || opts.overwrite) {
    model.provider = primary.id;
    model.baseUrl = primary.baseUrl;
    model.apiKey = pool[primary.envKey];
    model.model = `${primary.id}/${primary.defaultModel}`;
    if (!model.profiles) {
      model.profiles = {
        fast: `${primary.id}/${primary.defaultModel}`,
        coding: `${primary.id}/${primary.defaultModel}`,
        reasoning: `${primary.id}/${primary.defaultModel}`,
        review: `${primary.id}/${primary.defaultModel}`,
      };
    }
  }
  const failover = keyed.slice(hasPrimary && !opts.overwrite ? 0 : 1).map((p) => ({
    provider: p.id,
    baseUrl: p.baseUrl,
    apiKey: pool[p.envKey],
    model: `${p.id}/${p.defaultModel}`,
  }));
  if (failover.length && !(model.failover?.length)) {
    model.failover = failover as MochiConfig['model']['failover'];
  }
  try { saveConfigFile(cfg); } catch { /* best-effort */ }
  return { primary: (!hasPrimary || opts.overwrite) ? primary.id : undefined, failover: failover.map((f) => String(f.provider)) };
}

/** Import skills from detected agent dirs into ~/.mochi/skills. */
export async function importSkillSources(dirs: string[], opts: { force?: boolean } = {}): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const { importSkills } = await import('../features/skill-importer.js');
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const d of dirs) {
    try {
      const rep = await importSkills({ source: d, force: !!opts.force });
      imported += rep.imported.length;
      skipped += rep.skipped.length;
      errors.push(...rep.errors);
    } catch (e) {
      errors.push(`${d}: ${(e as Error).message}`);
    }
  }
  return { imported, skipped, errors };
}

/** Merge MCP servers from foreign config files into mochi's config file.
 *  Only merges entries that don't already exist (never clobbers). */
export function importMcpSources(files: string[]): { imported: string[]; skipped: string[] } {
  const imported: string[] = [];
  const skipped: string[] = [];
  const disk = loadConfigFile() as MochiConfig;
  if (!disk.mcpServers) disk.mcpServers = {};
  for (const f of files) {
    try {
      if (!existsSync(f)) continue;
      let raw = readFileSync(f, 'utf8');
      raw = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown>; mcp?: Record<string, unknown>; servers?: Record<string, unknown> };
      const bag = (parsed.mcpServers ?? parsed.mcp ?? parsed.servers ?? {}) as Record<string, unknown>;
      for (const [name, entry] of Object.entries(bag)) {
        if ((disk.mcpServers as Record<string, unknown>)[name] !== undefined) { skipped.push(name); continue; }
        if (entry && typeof entry === 'object') {
          (disk.mcpServers as Record<string, unknown>)[name] = entry;
          imported.push(name);
        }
      }
    } catch { /* corrupt foreign file: skip, never crash onboarding */ }
  }
  try { saveConfigFile(disk); } catch { /* best-effort */ }
  return { imported, skipped };
}
