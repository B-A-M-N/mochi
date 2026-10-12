// Cozy first-run onboarding — detection layer.
// Scans this machine for literally any coding agent (Claude Code, Hermes, Antigravity,
// Codex, Cline/Roo-Cline, OpenCode, Cursor, Windsurf, J-Code, Aider, Continue, Goose,
// Terminus, OpenHands, Crush, Codebuff, Pi, Kimi, Qwen) and discovers their:
//   1. API keys & providers (env + dotfiles + agent credentials)
//   2. Models (configured coding/fast/review/reasoning models)
//   3. Skills (SKILL.md trees + .agents/skills.json registries)
//   4. Tools & MCP servers (Claude, Cursor, Cline, OpenCode, Codex, Terminus, etc.)
//   5. Multi-agent shared memory & context (Terminus memory.json)
// Pure + best-effort: every probe is sync, guarded, and never throws.
// Secrets are never logged; callers mask before display.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export interface DetectedProvider {
  id: string;
  name: string;
  envKey: string;
  hasKey: boolean;
  keySource?: string;
  maskedKey?: string;
}

export interface DetectedModel {
  agent: string;
  model: string;
  provider?: string;
  role?: 'coding' | 'fast' | 'reasoning' | 'review';
  sourceFile?: string;
}

export interface DetectedSkillSource {
  agent: string;
  dir: string;
  count: number;
}

export interface DetectedMcpServerDef {
  name: string;
  agent: string;
  sourceFile: string;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
}

export interface DetectedMcpSource {
  agent: string;
  file: string;
  servers: string[];
}

export interface DetectedAgent {
  id: string;
  name: string;
  installed: boolean;
  configDir?: string;
  configFile?: string;
  skillsCount: number;
  models: string[];
  mcpServers: string[];
  keysFound: string[];
}

export interface OnboardScan {
  agents: DetectedAgent[];
  providers: DetectedProvider[];
  models: DetectedModel[];
  skillSources: DetectedSkillSource[];
  mcpSources: DetectedMcpSource[];
  mcpServerDefs: Record<string, DetectedMcpServerDef>;
  terminusMemoryAvailable: boolean;
  totalSkills: number;
  totalMcpServers: number;
}

const ENV_KEYS: Array<{ id: string; name: string; envKey: string }> = [
  { id: 'opencode-zen', name: 'OpenCode Zen', envKey: 'OPENCODE_ZEN_API_KEY' },
  { id: 'opencode-go', name: 'OpenCode Go', envKey: 'OPENCODE_GO_API_KEY' },
  { id: 'opencode', name: 'OpenCode', envKey: 'OPENCODE_API_KEY' },
  { id: 'freeinference', name: 'FreeInference', envKey: 'FREEINFERENCE_API_KEY' },
  { id: 'openai', name: 'OpenAI', envKey: 'OPENAI_API_KEY' },
  { id: 'anthropic', name: 'Anthropic', envKey: 'ANTHROPIC_API_KEY' },
  { id: 'gemini', name: 'Google Gemini', envKey: 'GEMINI_API_KEY' },
  { id: 'google', name: 'Google AI', envKey: 'GOOGLE_API_KEY' },
  { id: 'google-genai', name: 'Google GenAI', envKey: 'GOOGLE_GENERATIVE_AI_API_KEY' },
  { id: 'deepseek', name: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY' },
  { id: 'openrouter', name: 'OpenRouter', envKey: 'OPENROUTER_API_KEY' },
  { id: 'groq', name: 'Groq', envKey: 'GROQ_API_KEY' },
  { id: 'mistral', name: 'Mistral', envKey: 'MISTRAL_API_KEY' },
  { id: 'xai', name: 'xAI (Grok)', envKey: 'XAI_API_KEY' },
  { id: 'together', name: 'Together AI', envKey: 'TOGETHER_API_KEY' },
  { id: 'fireworks', name: 'Fireworks', envKey: 'FIREWORKS_API_KEY' },
  { id: 'cerebras', name: 'Cerebras', envKey: 'CEREBRAS_API_KEY' },
  { id: 'perplexity', name: 'Perplexity', envKey: 'PERPLEXITY_API_KEY' },
  { id: 'cohere', name: 'Cohere', envKey: 'COHERE_API_KEY' },
  { id: 'voyage', name: 'Voyage AI', envKey: 'VOYAGE_API_KEY' },
];

function parseDotEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    if (!existsSync(path)) return out;
    const text = readFileSync(path, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (k && v && !out[k]) out[k] = v;
    }
  } catch { /* best-effort */ }
  return out;
}

function loadEnvPool(): Record<string, string> {
  const home = homedir();
  const pool: Record<string, string> = { ...process.env } as Record<string, string>;
  const envFiles = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '.env.local'),
    join(home, '.mochi', '.env'),
    join(home, '.hermes', '.env'),
    join(home, '.antigravity_dashboard.env'),
    join(home, '.terminus.env'),
    join(home, '.aider.env'),
  ];
  for (const p of envFiles) {
    const parsed = parseDotEnvFile(p);
    for (const [k, v] of Object.entries(parsed)) {
      if (!pool[k] && v) pool[k] = v;
    }
  }

  // Also parse structured agent configs for API keys:
  // OpenCode cli.json / service.json
  for (const f of [join(home, '.config', 'opencode', 'cli.json'), join(home, '.config', 'opencode', 'service.json')]) {
    try {
      if (existsSync(f)) {
        const j = JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>;
        if (typeof j.apiKey === 'string' && j.apiKey && !pool['OPENCODE_API_KEY']) pool['OPENCODE_API_KEY'] = j.apiKey;
      }
    } catch { /* ignore */ }
  }

  // Codex auth.json / config.toml
  try {
    const cf = join(home, '.codex', 'auth.json');
    if (existsSync(cf)) {
      const raw = readFileSync(cf, 'utf8');
      const sk = raw.match(/sk-[A-Za-z0-9_-]{20,}/);
      if (sk && !pool['OPENAI_API_KEY']) pool['OPENAI_API_KEY'] = sk[0];
    }
  } catch { /* ignore */ }

  return pool;
}

function isRealKey(v: string | undefined): boolean {
  if (!v) return false;
  const k = v.trim();
  if (k.length < 6) return false;
  const low = k.toLowerCase();
  if (low === 'hi' || low.startsWith('your') || low.startsWith('sk-your') || low.includes('your-key') || low.includes('set me') || low.startsWith('<') || low.endsWith('_here')) return false;
  return true;
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function detectProviders(env?: Record<string, string>): DetectedProvider[] {
  const pool = env ?? loadEnvPool();
  return ENV_KEYS.map((p) => {
    const raw = pool[p.envKey];
    const hasKey = isRealKey(raw);
    return {
      ...p,
      hasKey,
      keySource: hasKey ? (process.env[p.envKey] ? 'env' : 'agent .env file') : undefined,
      maskedKey: hasKey ? maskKey(String(raw)) : undefined,
    };
  });
}

function countSkills(dir: string): number {
  try {
    if (!existsSync(dir)) return 0;
    let n = 0;
    const walk = (d: string, depth: number): void => {
      if (depth > 6) return;
      let entries;
      try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
      if (entries.some((e) => e.name === 'SKILL.md' && !e.isDirectory())) { n++; return; }
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (e.name === '.git' || e.name === 'node_modules' || e.name === '.archive') continue;
        walk(join(d, e.name), depth + 1);
      }
    };
    walk(dir, 0);
    return n;
  } catch { return 0; }
}

export function detectSkillSources(): DetectedSkillSource[] {
  const home = homedir();
  const roots: Array<{ agent: string; dir: string }> = [
    { agent: 'hermes', dir: join(home, '.hermes', 'skills') },
    { agent: 'antigravity', dir: join(home, '.gemini', 'antigravity-cli', 'skills') },
    { agent: 'antigravity (builtin)', dir: join(home, '.gemini', 'antigravity-cli', 'builtin', 'skills') },
    { agent: 'gemini', dir: join(home, '.gemini', 'skills') },
    { agent: 'claude', dir: join(home, '.claude', 'skills') },
    { agent: 'claude (commands)', dir: join(home, '.claude', 'commands') },
    { agent: 'cursor', dir: join(home, '.cursor', 'skills-cursor') },
    { agent: 'cursor', dir: join(home, '.cursor', 'skills') },
    { agent: 'cursor (rules)', dir: join(home, '.cursor', 'rules') },
    { agent: 'opencode', dir: join(home, '.config', 'opencode', 'skills') },
    { agent: 'opencode', dir: join(home, '.opencode', 'skills') },
    { agent: 'codex', dir: join(home, '.codex', 'skills') },
    { agent: 'jcode', dir: join(home, '.jcode', 'skills') },
    { agent: 'jcode', dir: join(home, '.config', 'jcode', 'skills') },
    { agent: 'terminus', dir: join(home, '.terminus', 'skills') },
    { agent: 'mochi', dir: join(home, '.mochi', 'skills') },
  ];

  // Also parse ecosystem registry files: ~/.agents/skills.json & ~/.gemini/config/skills.json
  for (const regFile of [
    join(home, '.agents', 'skills.json'),
    join(home, '.gemini', 'config', 'skills.json'),
  ]) {
    try {
      if (!existsSync(regFile)) continue;
      const parsed = JSON.parse(readFileSync(regFile, 'utf8')) as { entries?: Array<{ path?: string }> };
      for (const ent of parsed.entries ?? []) {
        if (ent.path && existsSync(ent.path)) {
          const lower = ent.path.toLowerCase();
          let agentName = 'ecosystem';
          if (lower.includes('hermes')) agentName = 'hermes';
          else if (lower.includes('gemini') || lower.includes('antigravity')) agentName = 'antigravity';
          else if (lower.includes('claude')) agentName = 'claude';
          else if (lower.includes('codex')) agentName = 'codex';
          else if (lower.includes('mochi')) agentName = 'mochi';
          roots.push({ agent: agentName, dir: ent.path });
        }
      }
    } catch { /* best-effort */ }
  }

  // Deduplicate and count skills
  const out: DetectedSkillSource[] = [];
  const seen = new Set<string>();
  for (const r of roots) {
    if (seen.has(r.dir)) continue;
    seen.add(r.dir);
    try {
      if (!existsSync(r.dir) || !statSync(r.dir).isDirectory()) continue;
      const count = countSkills(r.dir);
      if (count > 0) out.push({ ...r, count });
    } catch { /* skip */ }
  }
  return out;
}

export function detectModels(): DetectedModel[] {
  const home = homedir();
  const models: DetectedModel[] = [];
  const seen = new Set<string>();

  const add = (m: DetectedModel) => {
    const key = `${m.agent}:${m.model}`.toLowerCase();
    if (!seen.has(key) && m.model) {
      seen.add(key);
      models.push(m);
    }
  };

  // 1. Hermes (~/.hermes/config.yaml)
  try {
    const hp = join(home, '.hermes', 'config.yaml');
    if (existsSync(hp)) {
      const text = readFileSync(hp, 'utf8');
      const defMatch = text.match(/^\s*default:\s*([^\s#]+)/m);
      if (defMatch) {
        add({
          agent: 'hermes',
          model: defMatch[1].trim(),
          provider: 'hermes default',
          role: 'coding',
          sourceFile: hp,
        });
      }
      // Scan fallback models
      const fallbacks = text.match(/model:\s*([^\s#]+)/g) ?? [];
      for (const f of fallbacks) {
        const val = f.replace(/model:\s*/, '').trim();
        if (val && !val.endsWith(':') && val !== '-' && val.length > 2 && !['api_key', 'provider', 'custom_providers', 'models'].includes(val)) {
          add({ agent: 'hermes', model: val, sourceFile: hp });
        }
      }
    }
  } catch { /* ignore */ }

  // 2. OpenCode (~/.config/opencode/opencode.jsonc or opencode.json)
  for (const op of [
    join(home, '.config', 'opencode', 'opencode.jsonc'),
    join(home, '.config', 'opencode', 'opencode.json'),
  ]) {
    try {
      if (existsSync(op)) {
        const raw = readFileSync(op, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        const j = JSON.parse(raw) as { model?: string; small_model?: string };
        if (j.model) add({ agent: 'opencode', model: j.model, role: 'coding', sourceFile: op });
        if (j.small_model) add({ agent: 'opencode', model: j.small_model, role: 'fast', sourceFile: op });
      }
    } catch { /* ignore */ }
  }

  // 3. Codex (~/.codex/config.toml)
  try {
    const cp = join(home, '.codex', 'config.toml');
    if (existsSync(cp)) {
      const text = readFileSync(cp, 'utf8');
      const mm = text.match(/^\s*model\s*=\s*["']([^"']+)["']/m);
      if (mm) add({ agent: 'codex', model: mm[1].trim(), role: 'coding', sourceFile: cp });
    }
  } catch { /* ignore */ }

  // 4. Claude Code (~/.claude.json)
  try {
    const clp = join(home, '.claude.json');
    if (existsSync(clp)) {
      const raw = readFileSync(clp, 'utf8');
      const mMatch = raw.match(/"model":\s*"([^"]+)"/);
      if (mMatch) add({ agent: 'claude', model: mMatch[1].trim(), role: 'coding', sourceFile: clp });
    }
  } catch { /* ignore */ }

  // 5. J-Code (~/.jcode/config.toml)
  try {
    const jp = join(home, '.jcode', 'config.toml');
    if (existsSync(jp)) {
      const text = readFileSync(jp, 'utf8');
      const mm = text.match(/^\s*model\s*=\s*["']([^"']+)["']/m);
      if (mm) add({ agent: 'jcode', model: mm[1].trim(), role: 'coding', sourceFile: jp });
    }
  } catch { /* ignore */ }

  // 6. Continue (~/.continue/config.json)
  try {
    const cnp = join(home, '.continue', 'config.json');
    if (existsSync(cnp)) {
      const j = JSON.parse(readFileSync(cnp, 'utf8')) as { models?: Array<{ model?: string; provider?: string }> };
      for (const m of j.models ?? []) {
        if (m.model) add({ agent: 'continue', model: m.model, provider: m.provider, sourceFile: cnp });
      }
    }
  } catch { /* ignore */ }

  // 7. Goose (~/.config/goose/config.yaml)
  try {
    const gp = join(home, '.config', 'goose', 'config.yaml');
    if (existsSync(gp)) {
      const text = readFileSync(gp, 'utf8');
      const gm = text.match(/GOOSE_MODEL:\s*([^\s#]+)/) || text.match(/model:\s*([^\s#]+)/);
      if (gm) add({ agent: 'goose', model: gm[1].trim(), sourceFile: gp });
    }
  } catch { /* ignore */ }

  return models;
}

export function detectMcpServerDefs(cwd = process.cwd()): Record<string, DetectedMcpServerDef> {
  const home = homedir();
  const defs: Record<string, DetectedMcpServerDef> = {};

  const register = (
    name: string,
    agent: string,
    file: string,
    server: { command?: string; args?: string[]; env?: Record<string, string>; url?: string; headers?: Record<string, string> }
  ) => {
    if (!name || defs[name]) return;
    if (server.command || server.url) {
      defs[name] = {
        name,
        agent,
        sourceFile: file,
        command: server.command,
        args: server.args,
        env: server.env,
        url: server.url,
        headers: server.headers,
      };
    }
  };

  const jsonCandidates: Array<{ agent: string; file: string }> = [
    { agent: 'mochi (project)', file: resolve(cwd, '.mcp.json') },
    { agent: 'cursor (project)', file: resolve(cwd, '.cursor', 'mcp.json') },
    { agent: 'claude', file: join(home, '.claude.json') },
    { agent: 'claude (settings)', file: join(home, '.claude', 'settings.json') },
    { agent: 'cursor', file: join(home, '.cursor', 'mcp.json') },
    { agent: 'opencode', file: join(home, '.config', 'opencode', 'opencode.jsonc') },
    { agent: 'opencode', file: join(home, '.config', 'opencode', 'opencode.json') },
    { agent: 'gemini', file: join(home, '.gemini', 'settings.json') },
    { agent: 'antigravity', file: join(home, '.gemini', 'antigravity-cli', 'mcp.json') },
    { agent: 'terminus', file: join(home, '.terminus', 'mcp.json') },
    { agent: 'windsurf', file: join(home, '.codeium', 'windsurf', 'mcp_config.json') },
    { agent: 'continue', file: join(home, '.continue', 'config.json') },
    { agent: 'cline', file: join(home, '.cline', 'mcp_settings.json') },
    { agent: 'cline (vscode)', file: join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json') },
    { agent: 'roo-cline (vscode)', file: join(home, '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json') },
    { agent: 'cline (cursor)', file: join(home, '.config', 'Cursor', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json') },
    { agent: 'roo-cline (cursor)', file: join(home, '.config', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json') },
  ];

  for (const c of jsonCandidates) {
    try {
      if (!existsSync(c.file)) continue;
      const raw = readFileSync(c.file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      // Top level mcpServers / mcp / servers
      const bag = (parsed.mcpServers ?? parsed.mcp ?? parsed.servers ?? {}) as Record<string, unknown>;
      if (bag && typeof bag === 'object' && !Array.isArray(bag)) {
        for (const [k, v] of Object.entries(bag)) {
          if (v && typeof v === 'object') register(k, c.agent, c.file, v as Parameters<typeof register>[3]);
        }
      }

      // Project-level mcpServers inside claude.json
      if (c.agent === 'claude' && parsed.projects && typeof parsed.projects === 'object') {
        for (const proj of Object.values(parsed.projects as Record<string, unknown>)) {
          if (proj && typeof proj === 'object') {
            const pBag = (proj as { mcpServers?: Record<string, unknown> }).mcpServers;
            if (pBag && typeof pBag === 'object') {
              for (const [pk, pv] of Object.entries(pBag)) {
                if (pv && typeof pv === 'object') register(pk, 'claude (project)', c.file, pv as Parameters<typeof register>[3]);
              }
            }
          }
        }
      }
    } catch { /* skip */ }
  }

  // Codex TOML config (~/.codex/config.toml)
  try {
    const codexToml = join(home, '.codex', 'config.toml');
    if (existsSync(codexToml)) {
      const raw = readFileSync(codexToml, 'utf8');
      const sections = raw.split(/^\[mcp_servers\./m);
      for (let i = 1; i < sections.length; i++) {
        const blk = sections[i];
        const nameMatch = blk.match(/^([^\]]+)\]/);
        if (!nameMatch) continue;
        const name = nameMatch[1].trim();
        const cmdMatch = blk.match(/command\s*=\s*["']([^"']+)["']/);
        const argsMatch = blk.match(/args\s*=\s*\[(.*?)\]/s);
        let args: string[] | undefined;
        if (argsMatch) {
          args = (argsMatch[1].match(/["']([^"']+)["']/g) ?? []).map((s) => s.slice(1, -1));
        }
        if (cmdMatch) {
          register(name, 'codex', codexToml, { command: cmdMatch[1], args });
        }
      }
    }
  } catch { /* skip */ }

  return defs;
}

export function detectMcpSources(cwd = process.cwd()): DetectedMcpSource[] {
  const defs = detectMcpServerDefs(cwd);
  const byFile = new Map<string, { agent: string; servers: string[] }>();
  for (const [name, def] of Object.entries(defs)) {
    if (!byFile.has(def.sourceFile)) {
      byFile.set(def.sourceFile, { agent: def.agent, servers: [] });
    }
    byFile.get(def.sourceFile)!.servers.push(name);
  }

  const out: DetectedMcpSource[] = [];
  for (const [file, item] of byFile.entries()) {
    out.push({ agent: item.agent, file, servers: item.servers });
  }
  return out;
}

export function detectAgents(cwd = process.cwd()): DetectedAgent[] {
  const home = homedir();
  const skillSources = detectSkillSources();
  const models = detectModels();
  const mcpDefs = detectMcpServerDefs(cwd);
  const providers = detectProviders();

  const agentCatalog = [
    { id: 'hermes', name: 'Hermes Agent', dir: join(home, '.hermes'), file: join(home, '.hermes', 'config.yaml') },
    { id: 'claude', name: 'Claude Code', dir: join(home, '.claude'), file: join(home, '.claude.json') },
    { id: 'antigravity', name: 'Google Antigravity', dir: join(home, '.gemini', 'antigravity-cli'), file: join(home, '.gemini', 'antigravity-cli', 'mcp.json') },
    { id: 'codex', name: 'OpenAI Codex', dir: join(home, '.codex'), file: join(home, '.codex', 'config.toml') },
    { id: 'opencode', name: 'OpenCode', dir: join(home, '.config', 'opencode'), file: join(home, '.config', 'opencode', 'opencode.jsonc') },
    { id: 'cursor', name: 'Cursor', dir: join(home, '.cursor'), file: join(home, '.cursor', 'mcp.json') },
    { id: 'cline', name: 'Cline / Roo-Cline', dir: join(home, '.cline'), file: join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json') },
    { id: 'windsurf', name: 'Windsurf / Codeium', dir: join(home, '.codeium', 'windsurf'), file: join(home, '.codeium', 'windsurf', 'mcp_config.json') },
    { id: 'jcode', name: 'J-Code', dir: join(home, '.jcode'), file: join(home, '.jcode', 'config.toml') },
    { id: 'continue', name: 'Continue.dev', dir: join(home, '.continue'), file: join(home, '.continue', 'config.json') },
    { id: 'goose', name: 'Goose AI', dir: join(home, '.config', 'goose'), file: join(home, '.config', 'goose', 'config.yaml') },
    { id: 'aider', name: 'Aider', dir: join(home, '.aider'), file: join(home, '.aider.conf.yml') },
    { id: 'openhands', name: 'OpenHands', dir: join(home, '.openhands'), file: join(home, '.openhands', 'config.toml') },
    { id: 'terminus', name: 'Terminus Control Plane', dir: join(home, '.terminus'), file: join(home, '.terminus', 'memory.json') },
    { id: 'crush', name: 'Crush', dir: join(home, '.crush'), file: join(home, '.crush', 'config.json') },
    { id: 'codebuff', name: 'Codebuff', dir: join(home, '.codebuff'), file: join(home, '.codebuff', 'config.json') },
    { id: 'pi', name: 'Pi Agent', dir: join(home, '.pi'), file: join(home, '.pi', 'config.json') },
  ];

  return agentCatalog.map((cat) => {
    const installed = existsSync(cat.dir) || existsSync(cat.file);
    const agentSkills = skillSources.filter((s) => s.agent.toLowerCase().includes(cat.id)).reduce((acc, s) => acc + s.count, 0);
    const agentModels = models.filter((m) => m.agent.toLowerCase().includes(cat.id)).map((m) => m.model);
    const agentMcp = Object.values(mcpDefs).filter((d) => d.agent.toLowerCase().includes(cat.id)).map((d) => d.name);
    const agentKeys = providers.filter((p) => p.hasKey && p.keySource?.toLowerCase().includes(cat.id)).map((p) => p.name);

    return {
      id: cat.id,
      name: cat.name,
      installed,
      configDir: existsSync(cat.dir) ? cat.dir : undefined,
      configFile: existsSync(cat.file) ? cat.file : undefined,
      skillsCount: agentSkills,
      models: agentModels,
      mcpServers: agentMcp,
      keysFound: agentKeys,
    };
  });
}

export function scanForOnboarding(cwd = process.cwd()): OnboardScan {
  const home = homedir();
  const providers = detectProviders();
  const skillSources = detectSkillSources();
  const models = detectModels();
  const mcpServerDefs = detectMcpServerDefs(cwd);
  const mcpSources = detectMcpSources(cwd);
  const agents = detectAgents(cwd);
  const terminusMemoryAvailable = existsSync(join(home, '.terminus', 'memory.json'));

  return {
    agents,
    providers,
    models,
    skillSources,
    mcpSources,
    mcpServerDefs,
    terminusMemoryAvailable,
    totalSkills: skillSources.reduce((a, s) => a + s.count, 0),
    totalMcpServers: Object.keys(mcpServerDefs).length,
  };
}
