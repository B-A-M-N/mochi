import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Footer from '../Footer.jsx';
import { AnimatedContent, Reveal } from '../anim.jsx';

const PLATFORMS = [
  {
    id: 'npm',
    label: 'npm / npx',
    code: `# Install globally via npm\nnpm install -g @mochi-ai/cli\n\n# Or run immediately via npx\nnpx @mochi-ai/cli "review src/api for security issues"`,
    note: 'Requires Node.js 22+. Zero runtime dependencies.',
  },
  {
    id: 'bun',
    label: 'Bun',
    code: `# Install globally via Bun\nbun add -g @mochi-ai/cli\n\n# Or run directly\nbunx @mochi-ai/cli`,
    note: 'Sub-millisecond startup on Linux and macOS.',
  },
  {
    id: 'bin',
    label: 'Native Binary',
    code: `# Clone and build standalone native executable\ngit clone https://github.com/xanstomper/mochi.git\ncd mochi\nnpm install && npm run build:bin\n\n# Output binary: target/mochi (zero JavaScript runtime required)`,
    note: 'Compiles the full harness into a standalone single-file binary.',
  },
  {
    id: 'curl',
    label: 'Standalone Script',
    code: `# Install via automated release fetcher\ncurl -fsSL https://mochi.sh/install.sh | bash\n\n# Verify installation\nmochi doctor`,
    note: 'Fetches the pre-compiled binary matching your CPU architecture.',
  },
];

const CLI_COMMANDS = [
  {
    cmd: 'mochi',
    cat: 'Core',
    desc: 'Launch interactive full-screen terminal UI with persistent state.',
    flags: ['--reasoning <low|med|high>', '--model <alias>', '--plan'],
  },
  {
    cmd: 'mochi "objective"',
    cat: 'Core',
    desc: 'Execute a goal in one-shot autonomous mode with automatic test verification.',
    flags: ['--auto', '--max-cost <dollars>', '--timeout <seconds>'],
  },
  {
    cmd: 'mochi team "objective"',
    cat: 'Team',
    desc: 'Decompose goal into a concurrent DAG executed by 16 specialist roles.',
    flags: ['--max-workers <num>', '--lead-model <alias>', '--isolate-branches'],
  },
  {
    cmd: 'mochi daemon start',
    cat: 'Daemon',
    desc: 'Start persistent background daemon on port 8642 with bearer token authentication.',
    flags: ['--host 0.0.0.0', '--port 8642', '--token <secret>'],
  },
  {
    cmd: 'mochi daemon send "task"',
    cat: 'Daemon',
    desc: 'Send a background task to the running daemon without requiring a TTY.',
    flags: ['--async', '--notify <webhook>'],
  },
  {
    cmd: 'mochi daemon cron add',
    cat: 'Daemon',
    desc: 'Schedule recurring autonomous tasks via 5-field cron or interval string.',
    flags: ['--schedule "0 2 * * *"', '--goal "Run security audits"'],
  },
  {
    cmd: 'mochi trace [goalId]',
    cat: 'Sessions',
    desc: 'Replay an execution run end to end with token telemetry and redacted secrets.',
    flags: ['--json', '--visual', '--export <path>'],
  },
  {
    cmd: 'mochi session search "query"',
    cat: 'Sessions',
    desc: 'Full-text historical search across prior conversations and solutions via SQLite FTS5.',
    flags: ['--limit 10', '--repo-only'],
  },
  {
    cmd: 'mochi acp',
    cat: 'Protocols',
    desc: 'Start stdio Agent Client Protocol v1 server for IDE integrations (VS Code, Zed).',
    flags: ['--debug', '--json-rpc'],
  },
  {
    cmd: 'mochi skills',
    cat: 'Core',
    desc: 'List all bundled and discovered skills from ~/.mochi/skills and repository trees.',
    flags: ['--category <cat>', '--json'],
  },
  {
    cmd: 'mochi doctor',
    cat: 'Core',
    desc: 'Run complete health diagnostics on toolchains, API endpoints, and memory limits.',
    flags: ['--verbose'],
  },
];

const ROLES = [
  {
    name: 'lead',
    tier: 'Reasoning',
    badge: 'LEAD',
    duty: 'Decomposes goals into concurrent DAG tasks, allocates specialist roles, coordinates handoffs.',
    tools: ['todo', 'subagent', 'memory', 'read', 'search'],
  },
  {
    name: 'coder',
    tier: 'Coding',
    badge: 'CODE',
    duty: 'Full-stack code mutation, AST surgical patches, anchor-matched replacements.',
    tools: ['edit', 'patch', 'write', 'replace_symbol', 'read'],
  },
  {
    name: 'reviewer',
    tier: 'Review',
    badge: 'AUDIT',
    duty: 'Read-only diff inspection, SOLID/DRY audits, anti-pattern detection, edge-case checking.',
    tools: ['read', 'git', 'analyze_code', 'find_references'],
  },
  {
    name: 'tester',
    tier: 'Fast',
    badge: 'TEST',
    duty: 'Generates reproduction fixtures, writes unit/integration suites, executes runners.',
    tools: ['shell', 'write', 'edit', 'read'],
  },
  {
    name: 'architect',
    tier: 'Reasoning',
    badge: 'ARCH',
    duty: 'API interface design, distributed system trade-offs, service boundary definition.',
    tools: ['read', 'type_hierarchy', 'find_callers', 'todo'],
  },
  {
    name: 'debugger',
    tier: 'Reasoning',
    badge: 'DEBUG',
    duty: 'Root-cause analysis, hypothesis generation, diagnostic probe injection, autopsy records.',
    tools: ['shell', 'repl', 'inspect', 'read', 'git'],
  },
  {
    name: 'security',
    tier: 'Reasoning',
    badge: 'SEC',
    duty: 'OWASP vulnerability scanning, threat modeling, credential leak detection, sanitize checks.',
    tools: ['search', 'regex_replace', 'read', 'analyze_code'],
  },
  {
    name: 'devops',
    tier: 'Coding',
    badge: 'OPS',
    duty: 'Dockerfiles, Kubernetes manifests, GitHub Actions CI/CD workflows, Terraform specs.',
    tools: ['write', 'edit', 'shell', 'read'],
  },
  {
    name: 'db_admin',
    tier: 'Reasoning',
    badge: 'DBA',
    duty: 'Schema migrations, index optimization, EXPLAIN analysis, query efficiency checks.',
    tools: ['read', 'write', 'shell', 'search'],
  },
  {
    name: 'frontend',
    tier: 'Coding',
    badge: 'UI/UX',
    duty: 'React/Vue/CSS component creation, accessibility (a11y) checks, responsive layouts.',
    tools: ['write', 'edit', 'patch', 'read'],
  },
  {
    name: 'backend',
    tier: 'Coding',
    badge: 'SRV',
    duty: 'REST, GraphQL, and gRPC endpoints, database transactions, concurrency primitives.',
    tools: ['write', 'edit', 'patch', 'read', 'shell'],
  },
  {
    name: 'performance',
    tier: 'Reasoning',
    badge: 'PERF',
    duty: 'Memory leak detection, CPU hotspot profiling, Big-O computational complexity reduction.',
    tools: ['inspect', 'shell', 'analyze_code', 'read'],
  },
  {
    name: 'tech_writer',
    tier: 'Coding',
    badge: 'DOC',
    duty: 'Architectural Decision Records (ADRs), API documentation, Mermaid diagrams, manuals.',
    tools: ['write', 'edit', 'read'],
  },
  {
    name: 'qa_engineer',
    tier: 'Coding',
    badge: 'QA',
    duty: 'Playwright/Cypress end-to-end tests, visual regression checks, smoke automation.',
    tools: ['shell', 'write', 'read'],
  },
  {
    name: 'data_scientist',
    tier: 'Reasoning',
    badge: 'ML',
    duty: 'Data wrangling with Polars/Pandas, training pipelines, model validation scripts.',
    tools: ['repl', 'shell', 'read', 'write'],
  },
  {
    name: 'researcher',
    tier: 'Fast',
    badge: 'AST',
    duty: 'AST call-graph traversal, documentation indexing, dependency tree discovery.',
    tools: ['read', 'find_callers', 'find_definitions', 'search'],
  },
];

const TOOLS = {
  'Editing': [
    { name: 'edit', desc: 'Anchor-matched, whitespace-tolerant line replacement. Never destroys file context.' },
    { name: 'patch', desc: 'Multi-file unified diff patch applier. Refuses ambiguous hunk boundaries.' },
    { name: 'write', desc: 'Atomic file creation with automatic parent directory scaffolding.' },
    { name: 'delete', desc: 'Remove deprecated files or directories with safety confirmation.' },
    { name: 'replace_symbol', desc: 'AST-driven whole-symbol replacement with exact signature matching.' },
    { name: 'rename_symbol', desc: 'Project-wide atomic symbol renaming across all source references.' },
    { name: 'search_replace_multi', desc: 'Batch replacements across multiple target files in a single turn.' },
    { name: 'regex_replace', desc: 'Regular-expression-guided surgical code transformations.' },
  ],
  'Code Intelligence': [
    { name: 'get_function', desc: 'Extract an exact function declaration and body by identifier.' },
    { name: 'find_callers', desc: 'Construct reverse call graph of all call-sites for a given function.' },
    { name: 'type_hierarchy', desc: 'Resolve complete inheritance and interface implementation trees.' },
    { name: 'find_references', desc: 'Locate every usage and import of a symbol across the workspace.' },
    { name: 'find_definitions', desc: 'Jump directly to symbol definitions and type aliases.' },
    { name: 'analyze_code', desc: 'Structural complexity, cyclomatic metrics, and lint violation reports.' },
    { name: 'read', desc: 'Read file with optional skeleton:true mode (AST outline using 85% fewer tokens).' },
  ],
  'Execution': [
    { name: 'shell', desc: 'Execute system commands with support for long-running background jobs.' },
    { name: 'repl', desc: 'Stateful interactive evaluation in Node.js, Python, or Shell.' },
    { name: 'search', desc: 'N-API accelerated workspace text search (sub-millisecond across 50k files).' },
    { name: 'glob', desc: 'Async, hard-bounded file walker with directory exclusion and depth limits.' },
    { name: 'inspect', desc: 'Introspect memory allocation, process trees, and runtime environment.' },
  ],
  'State & Memory': [
    { name: 'git', desc: 'Atomic checkpointing, stash management, and instant rollback on failed tests.' },
    { name: 'memory', desc: 'Persistent SQLite FTS5 project memory across development sessions.' },
    { name: 'todo', desc: 'Concurrency-safe task checklist manipulated by agents during DAG execution.' },
    { name: 'skill', desc: 'Load dynamic procedural workflows from standard SKILL.md specs.' },
    { name: 'subagent', desc: 'Spawn any of the 16 specialized roles with scoped tool access.' },
  ],
};

const SIDEBAR = [
  { id: 'install', label: 'Installation & Quickstart' },
  { id: 'cli', label: 'CLI Command Explorer' },
  { id: 'architecture', label: 'Dual-Engine Architecture' },
  { id: 'roles', label: '16 Specialist Roles' },
  { id: 'tools', label: 'Native Tool Catalog' },
  { id: 'protocols', label: 'MCP & ACP Protocols' },
  { id: 'daemon', label: 'Headless Daemon & Cron' },
];

export default function Docs() {
  const [platform, setPlatform] = useState('npm');
  const [cliFilter, setCliFilter] = useState('All');
  const [searchCmd, setSearchCmd] = useState('');
  const [toolCat, setToolCat] = useState('Editing');

  const selectedPlatform = PLATFORMS.find((p) => p.id === platform) || PLATFORMS[0];

  const filteredCommands = CLI_COMMANDS.filter((c) => {
    const matchesCat = cliFilter === 'All' || c.cat === cliFilter;
    const matchesSearch = !searchCmd || c.cmd.toLowerCase().includes(searchCmd.toLowerCase()) || c.desc.toLowerCase().includes(searchCmd.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <>
      <div className="pagehead">
        <div className="wrap">
          <div className="pagehead-inner">
            <div className="hero-badge">
              <span className="badge-glow" />
              <span className="badge-pill">DOCUMENTATION</span>
              <span>Architecture &amp; Comprehensive API Guide</span>
            </div>
            <h1 className="pagehead-title">Everything Mochi can do.</h1>
            <p className="pagehead-lede">
              Zero-dependency Rust core, 16 specialist agent roles, 30+ native tools, background daemon, and deterministic verification.
            </p>
          </div>
        </div>
      </div>

      <div className="wrap layout doc-layout">
        {/* Sticky Sidebar Navigation */}
        <aside className="sidebar">
          <div className="sidebar-group">
            <h5>Navigation</h5>
            {SIDEBAR.map((item) => (
              <a key={item.id} href={'#' + item.id} className="sidebar-link">
                {item.label}
              </a>
            ))}
          </div>

          <div className="sidebar-group">
            <h5>External Specs</h5>
            <a href="https://github.com/xanstomper/mochi/blob/main/docs/ARCHITECTURE.md" target="_blank" rel="noopener" className="sidebar-link">
              Architecture Blueprint ↗
            </a>
            <a href="https://github.com/xanstomper/mochi/blob/main/docs/CAPABILITIES.md" target="_blank" rel="noopener" className="sidebar-link">
              Full Capabilities Spec ↗
            </a>
            <a href="./benchmarks.html" className="sidebar-link">
              Hardware Benchmarks →
            </a>
            <a href="./changelog.html" className="sidebar-link">
              Release Notes →
            </a>
          </div>
        </aside>

        {/* Main Documentation Body */}
        <main className="doc-body">
          {/* Section 1: Installation & Quickstart */}
          <section id="install" className="doc-section">
            <h2 className="doc-section-title">Installation &amp; Quickstart</h2>
            <p className="doc-section-lede">
              Choose your preferred installation method. Mochi ships as a self-contained binary with zero runtime JavaScript dependencies.
            </p>

            <div className="platform-card">
              <div className="platform-tabs">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    className={'platform-tab' + (platform === p.id ? ' active' : '')}
                    onClick={() => setPlatform(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="platform-body">
                <pre className="code-block">
                  <code>{selectedPlatform.code}</code>
                </pre>
                <div className="platform-note">
                  <span className="note-icon">ℹ️</span>
                  <span>{selectedPlatform.note}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: CLI Command Explorer */}
          <section id="cli" className="doc-section">
            <h2 className="doc-section-title">CLI Command Explorer</h2>
            <p className="doc-section-lede">
              Filter and search across Mochi's command line interface.
            </p>

            <div className="cli-explorer-controls">
              <div className="cli-filter-pills">
                {['All', 'Core', 'Team', 'Daemon', 'Sessions', 'Protocols'].map((cat) => (
                  <button
                    key={cat}
                    className={'cli-pill' + (cliFilter === cat ? ' active' : '')}
                    onClick={() => setCliFilter(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="cli-search-input"
                placeholder="Search commands or flags..."
                value={searchCmd}
                onChange={(e) => setSearchCmd(e.target.value)}
              />
            </div>

            <div className="cli-cards-grid">
              {filteredCommands.map((c) => (
                <div key={c.cmd} className="cli-card">
                  <div className="cli-card-header">
                    <code className="cli-card-cmd">{c.cmd}</code>
                    <span className="cli-card-cat">{c.cat}</span>
                  </div>
                  <p className="cli-card-desc">{c.desc}</p>
                  {c.flags && c.flags.length > 0 && (
                    <div className="cli-card-flags">
                      {c.flags.map((f) => (
                        <span key={f} className="flag-tag"><code>{f}</code></span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Dual-Engine Architecture */}
          <section id="architecture" className="doc-section">
            <h2 className="doc-section-title">Dual-Engine Architecture</h2>
            <p className="doc-section-lede">
              Engineered with a strict division of labor: a zero-overhead compiled Rust core for mechanical computation, paired with a TypeScript harness for agent orchestration.
            </p>

            <div className="arch-blueprint">
              <div className="arch-card rust-core">
                <div className="arch-card-badge">NATIVE RUST CORE</div>
                <h3>native/mochi_core crate</h3>
                <ul>
                  <li><strong>BPE Tokenization:</strong> 0.28 ms / 100k characters with zero V8 allocation.</li>
                  <li><strong>Compaction Planning:</strong> 0.12 ms calculation on 250-turn transcripts.</li>
                  <li><strong>N-API Workspace Index:</strong> 50k files indexed in 3.8 ms.</li>
                  <li><strong>State Machine:</strong> Deterministic turn lifecycles (preflight → model → verify).</li>
                </ul>
              </div>

              <div className="arch-card ts-harness">
                <div className="arch-card-badge">AGENT HARNESS</div>
                <h3>TypeScript Execution Layer</h3>
                <ul>
                  <li><strong>Model Routing &amp; Failover:</strong> Dynamic provider pooling and key rotation.</li>
                  <li><strong>16-Role DAG Engine:</strong> Concurrent agent swarm task resolution.</li>
                  <li><strong>ANSI Terminal TUI:</strong> Direct PTY rendering without webview or Electron.</li>
                  <li><strong>Hermetic Fallback:</strong> 100% feature-complete fallback for non-Rust environments.</li>
                </ul>
              </div>

              <div className="arch-card storage-layer">
                <div className="arch-card-badge">PERSISTENCE</div>
                <h3>SQLite FTS5 Storage Engine</h3>
                <ul>
                  <li><strong>Full-Text Search:</strong> Instant query across all historic runs.</li>
                  <li><strong>Procedural Lessons:</strong> Stores hypothesis autopsies to prevent repeated mistakes.</li>
                  <li><strong>Session Resumption:</strong> Checkpointed states can be resumed from phone or terminal.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4: 16 Specialist Roles */}
          <section id="roles" className="doc-section">
            <h2 className="doc-section-title">16 Specialist Roles</h2>
            <p className="doc-section-lede">
              Rather than forcing one generalist model to handle architecture, implementation, and verification, Mochi spawns targeted specialists with tailored tool allowlists.
            </p>

            <div className="roles-grid">
              {ROLES.map((r) => (
                <div key={r.name} className="role-card">
                  <div className="role-card-top">
                    <span className="role-name">{r.name}</span>
                    <span className={'role-tier-badge ' + r.tier.toLowerCase()}>{r.tier}</span>
                  </div>
                  <p className="role-duty">{r.duty}</p>
                  <div className="role-tools">
                    <span className="role-tools-label">Allowed tools:</span>
                    {r.tools.map((t) => (
                      <span key={t} className="tool-chip">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 5: Native Tool Catalog */}
          <section id="tools" className="doc-section">
            <h2 className="doc-section-title">Native Tool Catalog (30+ Tools)</h2>
            <p className="doc-section-lede">
              Explore the surgical tool suite designed to manipulate code with mathematical precision.
            </p>

            <div className="tool-tabs">
              {Object.keys(TOOLS).map((cat) => (
                <button
                  key={cat}
                  className={'tool-tab' + (toolCat === cat ? ' active' : '')}
                  onClick={() => setToolCat(cat)}
                >
                  {cat} ({TOOLS[cat].length})
                </button>
              ))}
            </div>

            <div className="tools-list">
              {TOOLS[toolCat].map((t) => (
                <div key={t.name} className="tool-item">
                  <div className="tool-name-col">
                    <code className="tool-name">{t.name}</code>
                  </div>
                  <div className="tool-desc-col">
                    <p>{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 6: Protocols */}
          <section id="protocols" className="doc-section">
            <h2 className="doc-section-title">Protocols: MCP &amp; ACP</h2>
            <p className="doc-section-lede">
              First-class compliance with open agent communication standards.
            </p>

            <div className="protocols-grid">
              <div className="proto-card">
                <h3>Model Context Protocol (MCP)</h3>
                <p>Connect any external tool server, database, or API over stdio via <code>.mcp.json</code>:</p>
                <pre className="code-block">
                  <code>{`{
  "mcpServers": {
    "sqlite": {
      "command": "mcp-server-sqlite",
      "args": ["--db-path", "./data/prod.db"]
    }
  }
}`}</code>
                </pre>
                <p className="proto-sub">Tools appear automatically as <code>mcp_sqlite_query</code>.</p>
              </div>

              <div className="proto-card">
                <h3>Agent Client Protocol (ACP)</h3>
                <p>Integrate Mochi into editors like VS Code and Zed using JSON-RPC stdio:</p>
                <pre className="code-block">
                  <code>{`# Launch ACP server
mochi acp

# Supported methods:
# initialize, session/new, session/prompt, session/close`}</code>
                </pre>
                <p className="proto-sub">Stream diff updates and tool calls directly into IDE editors.</p>
              </div>
            </div>
          </section>

          {/* Section 7: Daemon & Cron */}
          <section id="daemon" className="doc-section">
            <h2 className="doc-section-title">Headless Daemon &amp; Cron</h2>
            <p className="doc-section-lede">
              Run Mochi continuously as a system service on port 8642. Dispatch tasks remotely from mobile devices or cron schedules.
            </p>

            <div className="daemon-card">
              <pre className="code-block">
                <code>{`# Start daemon on localhost or 0.0.0.0 for LAN access
mochi daemon start --host 0.0.0.0 --port 8642

# Schedule recurring security audit every midnight
mochi daemon cron add --schedule "0 0 * * *" --goal "Run full OWASP scan on API"

# Send a background job without an attached terminal
mochi daemon send "Refactor payment service" --async`}</code>
              </pre>
            </div>
          </section>
        </main>
      </div>

      <Footer />
    </>
  );
}

const _root = document.getElementById('root');
if (_root) createRoot(_root).render(<Docs />);
