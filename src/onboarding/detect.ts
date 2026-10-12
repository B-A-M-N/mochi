// Cozy first-run onboarding — detection layer.
// Scans this machine for other agents' providers/keys, skills, MCPs and
// models so `mochi onboard` can offer one-click imports. Pure + best-effort:
// every probe is sync, guarded, and never throws — missing files just mean
// "not found". Secrets are never logged; callers mask before display.

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

export interface DetectedSkillSource {
  agent: string;
  dir: string;
  count: number;
}

export interface DetectedMcpSource {
  agent: string;
  file: string;
  servers: string[];
}

export interface OnboardScan {
  providers: DetectedProvider[];
  skillSources: DetectedSkillSource[];
  mcpSources: DetectedMcpSource[];
  totalSkills: number;
  totalMcpServers: number;
}

const ENV_KEYS: Array<{ id: string; name: string; envKey: string }> = [
  { id: 'opencode-zen', name: 'OpenCode Zen', envKey: 'OPENCODE_ZEN_API_KEY' },
  { id: 'opencode-go', name: 'OpenCode Go', envKey: 'OPENCODE_GO_API_KEY' },
  { id: 'freeinference', name: 'FreeInference', envKey: 'FREEINFERENCE_API_KEY' },
  { id: 'openai', name: 'OpenAI', envKey: 'OPENAI_API_KEY' },
  { id: 'anthropic', name: 'Anthropic', envKey: 'ANTHROPIC_API_KEY' },
  { id: 'gemini', name: 'Google Gemini', envKey: 'GEMINI_API_KEY' },
  { id: 'deepseek', name: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY' },
  { id: 'openrouter', name: 'OpenRouter', envKey: 'OPENROUTER_API_KEY' },
  { id: 'groq', name: 'Groq', envKey: 'GROQ_API_KEY' },
  { id: 'mistral', name: 'Mistral', envKey: 'MISTRAL_API_KEY' },
  { id: 'xai', name: 'xAI (Grok)', envKey: 'XAI_API_KEY' },
  { id: 'together', name: 'Together AI', envKey: 'TOGETHER_API_KEY' },
  { id: 'fireworks', name: 'Fireworks', envKey: 'FIREWORKS_API_KEY' },
  { id: 'cerebras', name: 'Cerebras', envKey: 'CEREBRAS_API_KEY' },
  { id: 'perplexity', name: 'Perplexity', envKey: 'PERPLEXITY_API_KEY' },
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
  for (const p of [
    resolve(process.cwd(), '.env'),
    join(home, '.mochi', '.env'),
    join(home, '.hermes', '.env'),
  ]) {
    const parsed = parseDotEnvFile(p);
    for (const [k, v] of Object.entries(parsed)) {
      if (!pool[k] && v) pool[k] = v;
    }
  }
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

function fileKeyPool(): Record<string, string> {
  // Extra keys hiding in agent config JSON (claude/codex/gemini store OAuth
  // tokens, not provider keys — we only surface real provider-like keys).
  const pool = loadEnvPool();
  const home = homedir();
  const candidates = [
    join(home, '.codex', 'auth.json'),
    join(home, '.claude', '.credentials.json'),
  ];
  for (const f of candidates) {
    try {
      if (!existsSync(f)) continue;
      const raw = readFileSync(f, 'utf8');
      // Only pick up obvious sk-/hyi-/xai- style tokens, never whole blobs.
      const hits = raw.match(/(sk-[A-Za-z0-9_-]{8,}|hyi-[A-Za-z0-9_-]{8,}|xai-[A-Za-z0-9_-]{8,})/g) ?? [];
      for (const h of hits) {
        if (!pool['__FILE_KEY__']) pool['__FILE_KEY__'] = h;
      }
    } catch { /* ignore */ }
  }
  return pool;
}

export function detectProviders(env?: Record<string, string>): DetectedProvider[] {
  const pool = env ?? fileKeyPool();
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
    { agent: 'claude', dir: join(home, '.claude', 'skills') },
    { agent: 'antigravity', dir: join(home, '.gemini', 'antigravity-cli', 'skills') },
    { agent: 'gemini', dir: join(home, '.gemini', 'skills') },
    { agent: 'cursor', dir: join(home, '.cursor', 'skills-cursor') },
    { agent: 'opencode', dir: join(home, '.config', 'opencode', 'skills') },
    { agent: 'codex', dir: join(home, '.codex', 'skills') },
    { agent: 'mochi', dir: join(home, '.mochi', 'skills') },
  ];
  const out: DetectedSkillSource[] = [];
  for (const r of roots) {
    try {
      if (!existsSync(r.dir) || !statSync(r.dir).isDirectory()) continue;
      const count = countSkills(r.dir);
      if (count > 0) out.push({ ...r, count });
    } catch { /* skip */ }
  }
  return out;
}

function extractMcpServerNames(file: string): string[] {
  try {
    if (!existsSync(file)) return [];
    const raw = readFileSync(file, 'utf8');
    // Strip // and /* */ comments (jsonc: opencode.jsonc) before parse.
    const noComments = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const parsed = JSON.parse(noComments) as Record<string, unknown>;
    const bag = (parsed.mcpServers ?? parsed.mcp ?? parsed.servers ?? {}) as Record<string, unknown>;
    if (bag && typeof bag === 'object' && !Array.isArray(bag)) return Object.keys(bag);
    // Codex config.toml [mcp_servers.*] — crude section scan.
    if (file.endsWith('.toml')) {
      const names: string[] = [];
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*\[mcp_servers\.([^\]]+)\]/);
        if (m) names.push(m[1].trim());
      }
      return names;
    }
    return [];
  } catch {
    // TOML fallback when JSON parse fails (codex config.toml).
    try {
      if (file.endsWith('.toml')) {
        const raw = readFileSync(file, 'utf8');
        const names: string[] = [];
        for (const line of raw.split('\n')) {
          const m = line.match(/^\s*\[mcp_servers\.([^\]]+)\]/);
          if (m) names.push(m[1].trim());
        }
        return names;
      }
    } catch { /* ignore */ }
    return [];
  }
}

export function detectMcpSources(cwd = process.cwd()): DetectedMcpSource[] {
  const home = homedir();
  const files: Array<{ agent: string; file: string }> = [
    { agent: 'mochi (project)', dir: '' } as unknown as { agent: string; file: string },
  ];
  void files;
  const list: Array<{ agent: string; file: string }> = [
    { agent: 'mochi (project)', file: resolve(cwd, '.mcp.json') },
    { agent: 'claude', file: join(home, '.claude.json') },
    { agent: 'claude (project)', file: resolve(cwd, '.mcp.json') },
    { agent: 'opencode', file: join(home, '.config', 'opencode', 'opencode.jsonc') },
    { agent: 'gemini', file: join(home, '.gemini', 'settings.json') },
    { agent: 'codex', file: join(home, '.codex', 'config.toml') },
    { agent: 'cursor', file: join(home, '.cursor', 'mcp.json') },
  ];
  const out: DetectedMcpSource[] = [];
  const seen = new Set<string>();
  for (const f of list) {
    if (seen.has(f.file)) continue;
    seen.add(f.file);
    const servers = extractMcpServerNames(f.file);
    if (servers.length > 0) out.push({ ...f, servers });
  }
  return out;
}

export function scanForOnboarding(cwd = process.cwd()): OnboardScan {
  const providers = detectProviders();
  const skillSources = detectSkillSources();
  const mcpSources = detectMcpSources(cwd);
  return {
    providers,
    skillSources,
    mcpSources,
    totalSkills: skillSources.reduce((a, s) => a + s.count, 0),
    totalMcpServers: mcpSources.reduce((a, s) => a + s.servers.length, 0),
  };
}
