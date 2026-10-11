// Native tool: mcp_manage
// Lists, describes, and generates install guides for built-in MCP servers.

import type { Tool } from './types.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export interface BuiltinMcpServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  installHint?: string;
}

export const BUILTIN_MCP_SERVERS: BuiltinMcpServer[] = [
  {
    id: 'mcp-filesystem',
    name: 'Filesystem MCP',
    description: 'Enhanced file system operations (read, write, list, search, move, copy)',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
    installHint: 'npx -y @modelcontextprotocol/server-filesystem',
  },
  {
    id: 'mcp-github',
    name: 'GitHub MCP',
    description: 'GitHub API: repos, issues, PRs, code search, notifications',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' },
    installHint: 'export GITHUB_TOKEN=ghp_your_token_here',
  },
  {
    id: 'mcp-postgres',
    name: 'PostgreSQL MCP',
    description: 'PostgreSQL database inspection, queries, and schema analysis',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', '${DATABASE_URL}'],
    env: { DATABASE_URL: '${DATABASE_URL}' },
    installHint: 'export DATABASE_URL=postgresql://user:pass@localhost/mydb',
  },
  {
    id: 'mcp-brave-search',
    name: 'Brave Search MCP',
    description: 'Real-time web search via Brave Search API',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: '${BRAVE_API_KEY}' },
    installHint: 'Get API key at https://api.search.brave.com — export BRAVE_API_KEY=your_key',
  },
  {
    id: 'mcp-puppeteer',
    name: 'Puppeteer MCP',
    description: 'Browser automation: screenshots, scraping, navigation, form interaction',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    installHint: 'npx -y @modelcontextprotocol/server-puppeteer (requires Chrome/Chromium)',
  },
  {
    id: 'mcp-slack',
    name: 'Slack MCP',
    description: 'Slack workspace: read/send messages, list channels, manage users',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: { SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}', SLACK_TEAM_ID: '${SLACK_TEAM_ID}' },
    installHint: 'Create Slack app at https://api.slack.com/apps — export SLACK_BOT_TOKEN=xoxb-...',
  },
  {
    id: 'mcp-memory',
    name: 'Memory MCP',
    description: 'Persistent knowledge graph memory across sessions (entities + relations)',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    installHint: 'npx -y @modelcontextprotocol/server-memory',
  },
  {
    id: 'mcp-sqlite',
    name: 'SQLite MCP',
    description: 'SQLite database operations, queries, and schema analysis',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', '.mochi/mochi.db'],
    installHint: 'npx -y @modelcontextprotocol/server-sqlite --db-path ./data.db',
  },
  {
    id: 'mcp-sequential-thinking',
    name: 'Sequential Thinking MCP',
    description: 'Structured multi-step reasoning and planning with revision support',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    installHint: 'npx -y @modelcontextprotocol/server-sequential-thinking',
  },
  {
    id: 'mcp-fetch',
    name: 'Fetch MCP',
    description: 'HTTP fetch with markdown conversion for web content ingestion',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    installHint: 'pip install uv && uvx mcp-server-fetch',
  },
  {
    id: 'mcp-git',
    name: 'Git MCP',
    description: 'Advanced Git operations: log, blame, diff, branch management',
    command: 'uvx',
    args: ['mcp-server-git', '--repository', '.'],
    installHint: 'pip install uv && uvx mcp-server-git --repository /path/to/repo',
  },
  {
    id: 'mcp-everything',
    name: 'Everything MCP',
    description: 'Reference implementation with full MCP feature demo (prompts, resources, tools, sampling)',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    installHint: 'npx -y @modelcontextprotocol/server-everything',
  },
];

function yamlSnippet(server: BuiltinMcpServer): string {
  const envLines = server.env
    ? Object.entries(server.env).map(([k, v]) => `      ${k}: "${v}"`).join('\n')
    : '';
  return [
    `  ${server.id}:`,
    `    command: ${server.command}`,
    `    args: [${server.args.map(a => `"${a}"`).join(', ')}]`,
    envLines ? `    env:\n${envLines}` : '',
  ].filter(Boolean).join('\n');
}

export interface McpSearchHit {
  server: BuiltinMcpServer;
  score: number;
  snippet: string;
}

/** Interactive MCP discovery: fuzzy rank over id + name + description +
 *  install hints + env keys. Same recall-first contract as skill search —
 *  the picker (TUI menu or model) makes the final call. Pure. */
export function searchMcpServers(query: string, limit = 8): McpSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: McpSearchHit[] = [];
  for (const s of BUILTIN_MCP_SERVERS) {
    const id = s.id.toLowerCase();
    const name = s.name.toLowerCase();
    const desc = s.description.toLowerCase();
    const extra = `${s.installHint ?? ''} ${Object.keys(s.env ?? {}).join(' ')}`.toLowerCase();
    let score = 0;
    let snippet = s.description;
    if (id === q || id === `mcp-${q}`) {
      score = 1.0;
      snippet = 'exact id match';
    } else if (id.includes(q) || name.includes(q)) {
      score = 0.85;
      snippet = s.description;
    } else if (desc.includes(q) && q.length >= 3) {
      score = 0.6;
      snippet = s.description;
    } else if (extra.includes(q) && q.length >= 3) {
      score = 0.45;
      snippet = s.installHint ?? s.description;
    } else {
      const toks = new Set(q.match(/[a-z0-9]+/g) ?? []);
      if (toks.size === 0) continue;
      const hay = new Set(`${id.replace(/-/g, ' ')} ${name} ${desc}`.match(/[a-z0-9]+/g) ?? []);
      let inter = 0;
      for (const t of toks) if (hay.has(t)) inter++;
      if (inter / Math.max(1, toks.size) >= 0.5 && inter > 0) {
        score = 0.35 + 0.1 * Math.min(2, inter);
        snippet = s.description;
      }
    }
    if (score > 0) hits.push({ server: s, score, snippet });
  }
  hits.sort((a, b) => b.score - a.score || a.server.id.localeCompare(b.server.id));
  return hits.slice(0, Math.max(1, limit));
}

export interface McpAddResult {
  ok: boolean;
  message: string;
  /** True when the server was already configured (no write needed). */
  alreadyPresent?: boolean;
}

/** One-command MCP install: merges a built-in server into `<projectDir>/.mcp.json`
 *  (`{ mcpServers: { <id>: { command, args, env? } } }`). Never clobbers an
 *  existing entry or unrelated keys; corrupt files are refused with a message
 *  (not overwritten). Synchronous + dependency-free for easy testing. */
export function addMcpServerConfig(projectDir: string, serverId: string): McpAddResult {
  const server = BUILTIN_MCP_SERVERS.find((s) => s.id === serverId);
  if (!server) {
    const ids = BUILTIN_MCP_SERVERS.map((s) => s.id).join(', ');
    return { ok: false, message: `Unknown MCP server "${serverId}". Known: ${ids}` };
  }
  const file = resolve(projectDir, '.mcp.json');
  let doc: Record<string, unknown> = {};
  if (existsSync(file)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, message: `.mcp.json is corrupt (not an object) — refusing to overwrite. Back it up, delete it, and retry.` };
      }
      doc = parsed as Record<string, unknown>;
    } catch {
      return { ok: false, message: `.mcp.json is not valid JSON — refusing to overwrite. Back it up, delete it, and retry.` };
    }
  }
  const servers = (doc.mcpServers ?? doc.servers ?? {}) as Record<string, unknown>;
  if (servers[server.id] !== undefined) {
    return { ok: true, alreadyPresent: true, message: `${server.id} is already configured in .mcp.json — no changes made.` };
  }
  const entry: Record<string, unknown> = { command: server.command, args: [...server.args] };
  if (server.env) entry.env = { ...server.env };
  doc.mcpServers = { ...(servers as Record<string, unknown>), [server.id]: entry };
  try {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(file, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  } catch (e) {
    return { ok: false, message: `Could not write .mcp.json: ${e instanceof Error ? e.message : String(e)}` };
  }
  const envNote = server.env ? ` Set ${Object.keys(server.env).join(', ')} first.` : '';
  return { ok: true, message: `Added ${server.id} (${server.name}) to .mcp.json.${envNote} Restart the session (or run /doctor) so the MCP client picks it up.` };
}

export const mcpManageTool: Tool = {
  def: {
    name: 'mcp_manage',
    description: 'Discover and install MCP servers: search built-ins by keyword, one-command add to .mcp.json, list, install guides, and config snippets.',
    parameters: [
      { name: 'action', type: 'string', description: "'search' | 'add' | 'list' | 'install-guide' | 'config'", required: true },
      { name: 'query', type: 'string', description: 'Search keywords (for search action)', required: false },
      { name: 'server_id', type: 'string', description: 'Specific server ID (for config/add actions)', required: false },
      { name: 'project_dir', type: 'string', description: 'Project root for add (defaults to cwd)', required: false },
    ],
    permission: 'read',
  },
  async execute(args, ctx) {
    const action = String(args.action || '').toLowerCase();
    const serverId = args.server_id ? String(args.server_id) : undefined;

    switch (action) {
      case 'search': {
        const q = typeof args.query === 'string' ? args.query : '';
        const hits = searchMcpServers(q);
        if (!hits.length) return `No MCP servers match "${q}". Try 'list' to browse all ${BUILTIN_MCP_SERVERS.length} built-ins.`;
        return [
          `## MCP search: "${q}" (${hits.length} match${hits.length === 1 ? '' : 'es'})`,
          '',
          ...hits.map((h) => `- \`${h.server.id}\` — **${h.server.name}**: ${h.snippet}`),
          '',
          'Use `mcp_manage(action="add", server_id="<id>")` to install one into .mcp.json.',
        ].join('\n');
      }
      case 'add': {
        if (!serverId) return 'add needs server_id (use search or list to find one).';
        const dir = typeof args.project_dir === 'string' && args.project_dir ? args.project_dir : (ctx?.cwd ?? process.cwd());
        const r = addMcpServerConfig(dir, serverId);
        return r.message;
      }
      case 'list': {
        const rows = BUILTIN_MCP_SERVERS.map(s =>
          `| \`${s.id}\` | ${s.name} | ${s.description} |`
        );
        return [
          '## Built-in MCP Servers',
          '',
          '| ID | Name | Description |',
          '| :-- | :-- | :-- |',
          ...rows,
          '',
          'Use `mcp_manage(action="config")` to get the config snippet for any server.',
          'Use `mcp_manage(action="install-guide")` for full setup instructions.',
        ].join('\n');
      }

      case 'config': {
        const servers = serverId
          ? BUILTIN_MCP_SERVERS.filter(s => s.id === serverId)
          : BUILTIN_MCP_SERVERS;
        if (serverId && !servers.length) return `Unknown server: ${serverId}`;
        return [
          '## ~/.mochi/config.yaml — mcpServers section',
          '',
          '```yaml',
          'mcpServers:',
          ...servers.map(s => yamlSnippet(s)),
          '```',
        ].join('\n');
      }

      case 'install-guide': {
        const servers = serverId
          ? BUILTIN_MCP_SERVERS.filter(s => s.id === serverId)
          : BUILTIN_MCP_SERVERS;
        if (serverId && !servers.length) return `Unknown server: ${serverId}`;
        return [
          '# MCP Server Installation Guide',
          '',
          ...servers.map(s => [
            `## ${s.name} (\`${s.id}\`)`,
            `${s.description}`,
            '',
            s.installHint ? `**Setup:** \`${s.installHint}\`` : '',
            s.env ? `**Required env vars:**\n${Object.keys(s.env).map(k => `- \`${k}\``).join('\n')}` : '',
            '',
          ].filter(Boolean).join('\n')),
        ].join('\n');
      }

      default:
        throw new Error(`Unknown action: ${action}. Use search|add|list|config|install-guide.`);
    }
  },
};
