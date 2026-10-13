// Onboarding persistence + import & injection engine.
// Writes the one-time marker (~/.config/mochi/onboarded.json) and applies
// universal agent adoption choices:
//   1. Provider keys -> mochi config.json (+ failover chain)
//   2. Discovered models -> model.profiles (coding, fast, reasoning, review)
//   3. Skills -> ~/.mochi/skills via skill-importer
//   4. Tools & MCP server definitions -> mochi config.json mcpServers
//   5. Terminus shared memory -> ~/.mochi/memory/terminus-memory.md

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { PROVIDERS, loadConfigFile, saveConfigFile } from '../model/providers.js';
import type { MochiConfig } from '../types.js';
import type { DetectedModel, DetectedMcpServerDef, OnboardScan } from './detect.js';

export interface OnboardedState {
  version: number;
  at: number;
  providersImported: string[];
  skillsImported: number;
  mcpImported: number;
  modelsImported?: string[];
  memoryImported?: boolean;
}

export interface FullInjectionReport {
  agentsCount: number;
  providersImported: string[];
  modelsImported: string[];
  skillsImported: number;
  mcpImported: string[];
  memoryImported: boolean;
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
    modelsImported: state.modelsImported ?? [],
    memoryImported: state.memoryImported ?? false,
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
  const envFiles = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '.env.local'),
    join(home, '.mochi', '.env'),
    join(home, '.hermes', '.env'),
    join(home, '.antigravity_dashboard.env'),
    join(home, '.terminus.env'),
    join(home, '.aider.env'),
  ];
  for (const f of envFiles) {
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

  // Also check OpenCode CLI/service json for keys
  for (const jf of [join(home, '.config', 'opencode', 'cli.json'), join(home, '.config', 'opencode', 'service.json')]) {
    try {
      if (existsSync(jf)) {
        const j = JSON.parse(readFileSync(jf, 'utf8')) as Record<string, unknown>;
        if (typeof j.apiKey === 'string' && j.apiKey && !pool['OPENCODE_API_KEY']) {
          pool['OPENCODE_API_KEY'] = j.apiKey;
        }
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

/** Import and wire models discovered from other agents into Mochi's model profiles. */
export function importDetectedModels(
  detectedModels: DetectedModel[],
  opts: { overwriteProfiles?: boolean } = {}
): { imported: string[]; profiles: Record<string, string> } {
  const disk = loadConfigFile() as MochiConfig;
  if (!disk.model) disk.model = {} as MochiConfig['model'];
  if (!disk.model.profiles) {
    disk.model.profiles = {
      fast: disk.model.model || 'freeinference/glm-5.3-flash',
      coding: disk.model.model || 'freeinference/deepseek-v4-flash',
      reasoning: disk.model.model || 'opencode/opencode-zen-3.5',
      review: disk.model.model || 'freeinference/glm-5.3-flash',
    };
  }

  const cleanModels = detectedModels
    .map((m) => m.model.trim())
    .filter((m) => m && !m.endsWith(':') && m !== '-' && m.length > 2);

  const imported: string[] = [];

  // Pick best models for each profile role
  const fastCandidate = cleanModels.find((m) => /flash|lightning|mini|nano/i.test(m)) || cleanModels[0];
  const codingCandidate = cleanModels.find((m) => /deepseek|nemotron|code|sonnet|opus|gpt-5|claude/i.test(m)) || cleanModels[0];
  const reasoningCandidate = cleanModels.find((m) => /zen|reasoning|pro|opus|o1|o3/i.test(m)) || cleanModels[0];
  const reviewCandidate = cleanModels.find((m) => /kimi|review|audit|deepseek/i.test(m)) || cleanModels[0];

  if (opts.overwriteProfiles || !disk.model.profiles.coding) {
    if (codingCandidate) { disk.model.profiles.coding = codingCandidate; imported.push(codingCandidate); }
    if (fastCandidate) { disk.model.profiles.fast = fastCandidate; imported.push(fastCandidate); }
    if (reasoningCandidate) { disk.model.profiles.reasoning = reasoningCandidate; imported.push(reasoningCandidate); }
    if (reviewCandidate) { disk.model.profiles.review = reviewCandidate; imported.push(reviewCandidate); }
  }

  // Also set primary model if not set
  if (!disk.model.model && codingCandidate) {
    disk.model.model = codingCandidate;
  }

  try { saveConfigFile(disk); } catch { /* best-effort */ }
  return { imported: [...new Set(imported)], profiles: disk.model.profiles as Record<string, string> };
}

/** Import skills from detected agent dirs into ~/.mochi/skills. */
export async function importSkillSources(
  dirs: string[],
  opts: { force?: boolean } = {}
): Promise<{ imported: number; skipped: number; errors: string[] }> {
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

/** Deep-merge full MCP server definitions discovered across Claude, Cursor,
 *  Cline, OpenCode, Codex, etc. directly into mochi config mcpServers. */
export function importMcpServerDefs(
  defs: Record<string, DetectedMcpServerDef>,
  opts: { force?: boolean } = {}
): { imported: string[]; skipped: string[] } {
  const imported: string[] = [];
  const skipped: string[] = [];
  const disk = loadConfigFile() as MochiConfig;
  if (!disk.mcpServers) disk.mcpServers = {};

  for (const [name, def] of Object.entries(defs)) {
    if (disk.mcpServers[name] && !opts.force) {
      skipped.push(name);
      continue;
    }
    disk.mcpServers[name] = {
      command: def.command,
      args: def.args,
      url: def.url,
      headers: def.headers,
      env: def.env,
    };
    imported.push(name);
  }

  try { saveConfigFile(disk); } catch { /* best-effort */ }
  return { imported, skipped };
}

/** Import Terminus multi-agent shared memory into Mochi's memory dir so Mochi
 *  instantly shares persistent knowledge with Claude, Hermes, and Antigravity. */
export function importTerminusMemory(): boolean {
  const home = homedir();
  const terminusMemFile = join(home, '.terminus', 'memory.json');
  if (!existsSync(terminusMemFile)) return false;

  try {
    const raw = readFileSync(terminusMemFile, 'utf8');
    const parsed = JSON.parse(raw) as { entries?: Array<{ title?: string; category?: string; content?: string; text?: string }> } | Array<{ title?: string; category?: string; content?: string }>;
    const list = Array.isArray(parsed) ? parsed : (parsed.entries ?? []);
    if (!list.length) return false;

    const targetDir = join(home, '.mochi', 'memory');
    mkdirSync(targetDir, { recursive: true });
    const targetFile = join(targetDir, 'terminus-memory.md');

    const lines = [
      `# Universal Multi-Agent Memory & Context Hub`,
      `*Imported from Terminus Control Plane (~/.terminus/memory.json)*`,
      `*Shared across Claude Code, Hermes, Antigravity, and Mochi*`,
      ``,
    ];

    for (const ent of list) {
      const title = ent.title || ent.category || 'Memory Entry';
      const body = ent.content || (ent as { text?: string }).text || '';
      lines.push(`## ${title}`);
      if (ent.category) lines.push(`**Category:** ${ent.category}`);
      lines.push(body);
      lines.push(``);
    }

    writeFileSync(targetFile, lines.join('\n'), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/** Universal One-Click Agent Ecosystem Injection.
 *  Discovers every coding agent on this machine and injects:
 *    - All API keys + provider chains
 *    - Preferred models into model.profiles
 *    - Skills from all agent trees + registries
 *    - MCP servers and tools from all agent configs
 *    - Terminus shared context and memory
 *  Marks setup completed. */
export async function injectAllAgentEcosystem(
  scan?: OnboardScan,
  opts: { force?: boolean } = {}
): Promise<FullInjectionReport> {
  const { scanForOnboarding } = await import('./detect.js');
  const actualScan = scan ?? scanForOnboarding();

  // 1. Providers & Keys
  const pRes = importProviderKeys({ overwrite: false });
  const providersImported: string[] = [];
  if (pRes.primary) providersImported.push(pRes.primary);
  providersImported.push(...pRes.failover);

  // 2. Models
  const mRes = importDetectedModels(actualScan.models, { overwriteProfiles: false });
  const modelsImported = mRes.imported;

  // 3. Skills
  let skillsImported = 0;
  if (actualScan.skillSources.length) {
    const sRes = await importSkillSources(actualScan.skillSources.map((s) => s.dir), { force: opts.force });
    skillsImported = sRes.imported;
  }

  // 4. MCP Servers & Tools
  const mcpRes = importMcpServerDefs(actualScan.mcpServerDefs, { force: opts.force });
  // Also import from any raw files
  if (actualScan.mcpSources.length) {
    importMcpSources(actualScan.mcpSources.map((m) => m.file));
  }
  const mcpImported = mcpRes.imported;

  // 5. Terminus Shared Memory
  const memoryImported = importTerminusMemory();

  // 6. Mark onboarded
  markOnboarded({
    providersImported,
    skillsImported,
    mcpImported: mcpImported.length,
    modelsImported,
    memoryImported,
  });

  return {
    agentsCount: actualScan.agents.filter((a) => a.installed).length,
    providersImported,
    modelsImported,
    skillsImported,
    mcpImported,
    memoryImported,
  };
}
