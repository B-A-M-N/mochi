import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import { AnimatedContent } from '../anim.jsx';

const DOC_CARDS = [
  { icon: '🚀', title: 'Quickstart & Installation', desc: 'Single-binary setup, curl installer, package managers, and build from source.', link: '#install' },
  { icon: '⌨️', title: 'CLI & TUI Reference', desc: 'All CLI flags, interactive terminal mode, 22 slash commands, and hotkey bindings.', link: '#cli' },
  { icon: '👥', title: '16 Specialist Roles', desc: 'Goal decomposition, directed acyclic graphs (DAGs), and role-diverse swarms.', link: '#roles' },
  { icon: '🛠️', title: '30+ Deterministic Tools', desc: 'AST editing, unified diff patch, Ripgrep, native LSP, and Bubblewrap sandbox.', link: '#tools' },
  { icon: '📦', title: 'Skills Runtime & MCP', desc: 'Dynamic ~/.mochi/skills/ injection, hermes skill import, and MCP/ACP stdio servers.', link: '#skills' },
  { icon: '🌐', title: 'Daemon API & CI/CD', desc: 'Port 8642 background daemon, REST & JSON-RPC endpoints, and headless workflows.', link: '#daemon' },
];

const ROLES = [
  ['lead', 'reasoning', 'Decomposes goals into directed acyclic graphs (DAGs), coordinates swarms, resolves blockers, and manages task dependencies.'],
  ['coder', 'coding', 'Full-stack software engineering, AST-guided surgical diffs, headless compiler/linter hooks, and test-driven fixes.'],
  ['reviewer', 'review', 'Read-only PR and diff inspection, SOLID/DRY principle audits, edge-case analysis, and cyclomatic complexity gates.'],
  ['tester', 'fast', 'Automated test suite creation, regression reproducer generation, vitest/pytest execution, and coverage analysis.'],
  ['researcher', 'fast', 'Abstract syntax tree (AST) traversal, call-graph indexing, documentation lookup, and external web research.'],
  ['debugger', 'reasoning', 'Root-cause analysis, hypothesis-driven testing, runtime telemetry injection, and core dump dissection.'],
  ['security', 'reasoning', 'OWASP vulnerability scanning, threat modeling, dependency supply-chain audit, and secret-leak detection.'],
  ['architect', 'reasoning', 'API contract specification, distributed system trade-off modeling, schema migrations, and service boundaries.'],
  ['devops', 'coding', 'Containerization (Docker/Podman), CI/CD workflows, Kubernetes manifests, and infrastructure-as-code (Terraform).'],
  ['frontend', 'coding', 'UI component systems, Tailwind/CSS architecture, responsive layouts, web accessibility (a11y), and state management.'],
  ['backend', 'coding', 'REST/GraphQL/gRPC API microservices, database queries, ACID transaction safety, and high-concurrency loops.'],
  ['performance', 'reasoning', 'Hotspot profiling, memory leak detection, heap-snapshot analysis, algorithmic optimization, and cache tuning.'],
  ['data', 'coding', 'Data engineering pipelines, SQL optimization, schema ETL scripts, and analytical metric aggregation.'],
  ['docs', 'fast', 'Technical documentation authoring, OpenAPI/Swagger specifications, changelog synthesis, and user guides.'],
  ['mobile', 'coding', 'React Native and native mobile application logic, layout adaptation, platform lifecycle handling, and build tuning.'],
  ['qa', 'fast', 'End-to-end integration flows, browser automation verification, smoke tests, and user-story acceptance criteria.'],
];

const SLASH_COMMANDS = [
  ['/help', 'Display interactive command cheat-sheet and available tools.'],
  ['/clear', 'Clear visible transcript lines while preserving execution context.'],
  ['/new', 'Start a completely fresh session (clears checkpoints, memory, and state).'],
  ['/sessions', 'Interactive session switcher and full-text history browser.'],
  ['/rename', 'Rename the active session for organized transcript tracking.'],
  ['/export', 'Export current session transcript to structured JSON on disk.'],
  ['/import', 'Import and replay a historical session transcript.'],
  ['/model', 'Interactive model and provider selector (OpenCode, Claude, GPT, Ollama).'],
  ['/theme', 'Interactive 15-theme live preview and switcher with instant redraw.'],
  ['/doctor', 'Run full environment health check on workspace, compilers, and tools.'],
  ['/usage', 'Display real-time token usage, cost expenditure, and cache hit efficiency.'],
  ['/init', 'Scaffold project MOCHI.md configuration file in the repository root.'],
  ['/branch', 'Inspect active git status, modified files, and working branch.'],
  ['/commit', 'Create an atomic git checkpoint commit with automated message.'],
  ['/run <cmd>', 'Execute a sandboxed shell command directly in the active workspace.'],
  ['/test', 'Detect and execute the workspace test suite (vitest, jest, cargo, pytest).'],
  ['/review', 'Run automated read-only code review on current unstaged modifications.'],
  ['/diff', 'Display colorized git diff of pending code changes before writing.'],
  ['/rollback', 'Revert modifications back to the last known-good git checkpoint.'],
  ['/yolo', 'Toggle autonomous auto-approval mode for all tool calls.'],
  ['/stop', 'Interrupt current in-flight agent turn, tool call, or thinking stream.'],
  ['/exit', 'Safely shut down Mochi session and persist state to SQLite.'],
];

const TOOLS = {
  'File Editing': [
    ['edit', 'Anchor-matched, whitespace-tolerant multi-file editing with atomic rollbacks.'],
    ['patch', 'Standard multi-file *** Begin Patch unified diff applicator.'],
    ['write', 'Atomic file creation or full overwrite with directory auto-scaffolding.'],
    ['delete', 'Safe removal of files and directories within approved workspace boundaries.'],
    ['replace_symbol', 'AST-driven whole-symbol, function, and interface refactoring.'],
  ],
  'Code Intelligence': [
    ['get_function', 'Extract function, class, or method declaration by name via Tree-sitter AST.'],
    ['find_callers', 'Reverse call-graph traversal across all project files and modules.'],
    ['find_references', 'Locate all symbol usages, definitions, and occurrences.'],
    ['read', 'Reads file with skeleton:true mode for AST outlines, reducing tokens by 85%.'],
  ],
  'Execution & Sandbox': [
    ['shell', 'Sandboxed command execution via Bubblewrap (bwrap) with background jobs.'],
    ['search', 'Ripgrep-accelerated sub-millisecond keyword and regex search.'],
    ['glob', 'Asynchronous, hard-bounded file pattern matching avoiding node_modules.'],
  ],
  'Agent State & MCP': [
    ['git', 'Atomic checkpoints, staging, commits, and zero-loss rollback engine.'],
    ['memory', 'Persistent vector and key-value engineering memory across session runs.'],
    ['skill', 'Dynamic SKILL.md runtime loading, discovery, and prompt injection.'],
    ['subagent', 'Spawn any of 16 specialized roles concurrently in isolated scopes.'],
  ],
};

const SIDEBAR = [
  ['Get started', [
    ['install', 'Installation & Binaries'],
    ['first-run', 'First Run & Verification'],
    ['cli', 'CLI & Flags Reference'],
    ['slash-commands', '22 Slash Commands'],
  ]],
  ['Core Architecture', [
    ['architecture', 'Dual-Engine Rust Architecture'],
    ['roles', '16 Specialist Roles & Swarms'],
    ['tools', '30+ Native Tools'],
    ['sandbox', 'Bubblewrap Sandboxing'],
    ['skills', 'Skills Runtime & MCP'],
    ['daemon', 'HTTP Daemon & ACP Server'],
  ]],
  ['Ecosystem & Guides', [
    ['config', 'MOCHI.md Configuration'],
    ['ci-cd', 'Headless CI/CD Automation'],
    ['https://github.com/xanstomper/mochi', 'GitHub Repository ↗'],
    ['https://github.com/xanstomper/mochi/releases', 'Release Binaries ↗'],
  ]],
];

export default function Docs() {
  const [toolTab, setToolTab] = useState('File Editing');
  const [searchQuery, setSearchQuery] = useState('');
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/mochi') ? '/mochi' : '';

  const filteredCards = DOC_CARDS.filter(c =>
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="pagehead">
        <div className="wrap">
          <div className="pagehead-row">
            <div className="pagehead-col">
              <AnimatedContent direction="bottom" delay={0.1}>
                <div className="hero-eyebrow">
                  <span className="sparkle" />
                  DOCUMENTATION
                </div>
              </AnimatedContent>

              <h1 className="hero-title">
                Read the <span className="accent-title">Docs.</span>
              </h1>

              <AnimatedContent direction="bottom" delay={0.2}>
                <p className="hero-sub" style={{ maxWidth: 640 }}>
                  Everything you need to master Mochi: zero-dependency binary installation, 16 specialist roles, 30+ native tools, Bubblewrap sandboxing, and autonomous swarm orchestration.
                </p>
              </AnimatedContent>

              {/* Interactive Search bar */}
              <AnimatedContent direction="bottom" delay={0.3}>
                <div className="doc-search-bar">
                  <span style={{ fontSize: 16 }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search docs, slash commands, tools, flags..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  <span className="doc-search-badge">⌘ K</span>
                </div>
              </AnimatedContent>
            </div>

            {/* Custom Docs Mascot: Scholar Mochi reading documentation */}
            <AnimatedContent direction="right" delay={0.2}>
              <div className="subpage-mascot-wrap">
                <div className="subpage-doodle">easy setup!</div>
                <Mochi variant="docs" size={180} />
              </div>
            </AnimatedContent>
          </div>

          {/* 6-Card Topic Launcher Grid */}
          <div className="grid3" style={{ marginTop: 44, marginBottom: 48 }}>
            {filteredCards.map((c, i) => (
              <AnimatedContent key={c.title} direction="bottom" delay={i * 0.05}>
                <a href={c.link} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="card-icon">{c.icon}</div>
                  <h3 className="card-title">
                    <span>{c.title}</span>
                    <span className="card-arrow">→</span>
                  </h3>
                  <p className="card-desc">{c.desc}</p>
                </a>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </div>

      {/* Main Documentation Body */}
      <div className="wrap" style={{ paddingBottom: 60 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 44, alignItems: 'start' }}>
          {/* Sticky Sidebar Navigation */}
          <aside style={{ position: 'sticky', top: 96, background: '#ffffff', borderRadius: 24, padding: '28px 22px', border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
            {SIDEBAR.map(([cat, links]) => (
              <div key={cat} style={{ marginBottom: 22 }}>
                <h5 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--purple-dark)', marginBottom: 10, fontWeight: 700 }}>
                  {cat}
                </h5>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {links.map(([target, label]) => (
                    <li key={target} style={{ marginBottom: 4 }}>
                      <a
                        href={target.startsWith('http') ? target : `#${target}`}
                        target={target.startsWith('http') ? '_blank' : undefined}
                        rel={target.startsWith('http') ? 'noopener' : undefined}
                        style={{
                          fontSize: 13.5,
                          color: 'var(--ink-soft)',
                          textDecoration: 'none',
                          display: 'block',
                          padding: '6px 10px',
                          borderRadius: 8,
                          fontWeight: 500,
                          transition: 'all .15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--purple-dark)'; e.currentTarget.style.background = 'var(--purple-lighter)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-soft)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>

          {/* Deep Content Sections */}
          <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 40 }}>
            {/* Section: Installation */}
            <section id="install" style={{ background: '#ffffff', borderRadius: 24, padding: '36px 32px', border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="section-tag" style={{ marginBottom: 14 }}>
                <span className="sparkle" />
                INSTALLATION & GETTING STARTED
              </div>
              <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                Zero-Dependency Standalone Setup
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15.5, marginBottom: 20, lineHeight: 1.7 }}>
                Mochi is distributed as a single standalone executable compiled with the Bun runtime and an embedded pure-Rust core. You do not need Node.js, Python, or a 500 MB <code style={{ fontFamily: 'var(--font-mono)' }}>node_modules</code> directory installed on your host.
              </p>

              <div style={{ background: '#12111E', borderRadius: 16, padding: '20px 24px', fontFamily: 'var(--font-mono)', fontSize: 13.5, color: '#F5F3FF', marginBottom: 20, overflowX: 'auto', border: '1px solid rgba(139, 117, 246, 0.2)' }}>
                <div style={{ color: 'var(--purple-light)', marginBottom: 8 }}># Quick Install (Linux x86_64 / macOS arm64):</div>
                <div>curl -fsSL https://raw.githubusercontent.com/xanstomper/mochi/main/install.sh | bash</div>
              </div>

              <h4 style={{ fontSize: 16, fontWeight: 700, marginTop: 24, marginBottom: 10, color: 'var(--ink)' }}>Compile From Source</h4>
              <p style={{ color: 'var(--ink-soft)', fontSize: 14.5, marginBottom: 14, lineHeight: 1.6 }}>
                To build the binary yourself using the native Rust tokenizer and Bun compiler:
              </p>
              <div style={{ background: '#12111E', borderRadius: 14, padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, color: '#EDE9FE', overflowX: 'auto' }}>
                git clone https://github.com/xanstomper/mochi.git<br />
                cd mochi<br />
                bun install<br />
                bun run build:bin<br />
                ./bin/mochi --version
              </div>
            </section>

            {/* Section: First Run */}
            <section id="first-run" style={{ background: '#ffffff', borderRadius: 24, padding: '36px 32px', border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="section-tag" style={{ marginBottom: 14 }}>
                <span className="sparkle" />
                FIRST RUN & DIAGNOSTICS
              </div>
              <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                Environment Verification via Mochi Doctor
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15.5, marginBottom: 20, lineHeight: 1.7 }}>
                Before starting complex development workflows, run <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple-dark)', background: 'var(--purple-lighter)', padding: '2px 8px', borderRadius: 6 }}>mochi doctor</code> to verify compiler toolchains, Bubblewrap sandbox capabilities, browser automation drivers, and provider keys.
              </p>
              <div style={{ background: '#12111E', borderRadius: 16, padding: '20px 24px', fontFamily: 'var(--font-mono)', fontSize: 13, color: '#EDE9FE', overflowX: 'auto' }}>
                $ mochi doctor<br /><br />
                <span style={{ color: '#34D399' }}>  ✓ rust_core</span>    ok    compiled N-API tokenizer (libmochi_core.so)<br />
                <span style={{ color: '#34D399' }}>  ✓ sandbox</span>      ok    bubblewrap available (bwrap 0.9.0)<br />
                <span style={{ color: '#34D399' }}>  ✓ diagnostics</span>  TS:yes  Python:yes  Rust:yes<br />
                <span style={{ color: '#34D399' }}>  ✓ browser</span>      ok    playwright + chromium (scripts/browser-driver.mjs)<br />
                <span style={{ color: '#34D399' }}>  ✓ skills</span>       ok    31 registered skills (~/.mochi/skills)<br />
                <span style={{ color: '#34D399' }}>  ✓ daemon</span>       ok    available for background jobs (:8642)
              </div>
            </section>

            {/* Section: CLI Flags */}
            <section id="cli" style={{ background: '#ffffff', borderRadius: 24, padding: '36px 32px', border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="section-tag" style={{ marginBottom: 14 }}>
                <span className="sparkle" />
                COMMAND LINE REFERENCE
              </div>
              <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                CLI Commands & Execution Flags
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15.5, marginBottom: 20, lineHeight: 1.7 }}>
                Launch Mochi interactively in the terminal UI or execute autonomous one-shot commands in automated scripts and CI pipelines.
              </p>
              <div style={{ display: 'grid', gap: 14 }}>
                {[
                  ['mochi', 'Launch full interactive terminal user interface (TUI) with real-time streaming.'],
                  ['mochi "prompt here"', 'Launch TUI preloaded with an engineering goal and automatic role assignment.'],
                  ['mochi -p --auto "prompt"', 'Headless non-interactive execution: executes to completion without prompt gates.'],
                  ['mochi team "build feature"', 'Decompose prompt across role-diverse specialist swarm with dependency DAGs.'],
                  ['mochi --model <name>', 'Override default model (opencode, claude-3-5-sonnet, gpt-4o, deepseek-v4-flash, ollama).'],
                  ['mochi termix', 'Launch multi-pane split terminal agent console with concurrent live sessions.'],
                  ['mochi daemon start', 'Start persistent background daemon on port 8642 for webhook and API triggering.'],
                  ['mochi skills import <src>', 'Import skill packs from local directories, hermes, or remote GitHub repositories.'],
                  ['mochi bench', 'Execute local performance benchmark suite (memory RSS, TTFI, startup wall-time).'],
                ].map(([cmd, desc]) => (
                  <div key={cmd} style={{ padding: '16px 20px', background: 'var(--bg-soft)', borderRadius: 16, border: '1px solid var(--line)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 700, color: 'var(--purple-dark)', marginBottom: 5 }}>
                      {cmd}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                      {desc}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section: Slash Commands */}
            <section id="slash-commands" style={{ background: '#ffffff', borderRadius: 24, padding: '36px 32px', border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="section-tag" style={{ marginBottom: 14 }}>
                <span className="sparkle" />
                INTERACTIVE TUI COMMANDS
              </div>
              <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                22 Terminal Slash Commands
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15.5, marginBottom: 20, lineHeight: 1.7 }}>
                Inside the interactive Mochi terminal, type <code style={{ fontFamily: 'var(--font-mono)' }}>/</code> to trigger instant command autocomplete:
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table className="comp-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>Command</th>
                      <th>Operational Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SLASH_COMMANDS.map(([cmd, desc]) => (
                      <tr key={cmd}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--purple-dark)', fontSize: 13.5 }}>{cmd}</td>
                        <td style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section: 16 Specialist Roles */}
            <section id="roles" style={{ background: '#ffffff', borderRadius: 24, padding: '36px 32px', border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="section-tag" style={{ marginBottom: 14 }}>
                <span className="sparkle" />
                MULTI-AGENT SWARM ARCHITECTURE
              </div>
              <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                16 Autonomous Specialist Roles
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15.5, marginBottom: 20, lineHeight: 1.7 }}>
                Instead of burdening a single generalist model with conflicting objectives, Mochi decomposes tasks into directed acyclic graphs and dynamically assigns each step to a domain specialist:
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table className="comp-table">
                  <thead>
                    <tr>
                      <th style={{ width: '18%' }}>Role</th>
                      <th style={{ width: '18%' }}>Model Tier</th>
                      <th>Specialized Engineering Capability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLES.map(([name, tier, desc]) => (
                      <tr key={name}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--purple-dark)', fontSize: 13.5 }}>{name}</td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'var(--purple-lighter)', color: 'var(--purple-dark)', fontWeight: 700 }}>
                            {tier}
                          </span>
                        </td>
                        <td style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section: Native Tools */}
            <section id="tools" style={{ background: '#ffffff', borderRadius: 24, padding: '36px 32px', border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="section-tag" style={{ marginBottom: 14 }}>
                <span className="sparkle" />
                DETERMINISTIC TOOLS
              </div>
              <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                30+ High-Performance Native Tools
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15.5, marginBottom: 20, lineHeight: 1.7 }}>
                Tools run in compiled Rust and native N-API wrappers. They enforce anchor-based diff safety and read caching to protect your context window.
              </p>

              {/* Tool Category Tabs */}
              <div className="filter-pills" style={{ marginBottom: 20 }}>
                {Object.keys(TOOLS).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setToolTab(cat)}
                    className={`filter-pill ${toolTab === cat ? 'active' : ''}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {TOOLS[toolTab].map(([tool, desc]) => (
                  <div key={tool} style={{ padding: '14px 18px', background: 'var(--bg-soft)', borderRadius: 14, border: '1px solid var(--line)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--purple-dark)', fontSize: 14, marginRight: 12 }}>
                      {tool}()
                    </span>
                    <span style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Section: Bubblewrap Sandboxing */}
            <section id="sandbox" style={{ background: '#ffffff', borderRadius: 24, padding: '36px 32px', border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="section-tag" style={{ marginBottom: 14 }}>
                <span className="sparkle" />
                SECURITY & CONTAINER ISOLATION
              </div>
              <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                Hardware-Level Bubblewrap (bwrap) Sandbox
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15.5, marginBottom: 20, lineHeight: 1.7 }}>
                Mochi isolates shell command execution within unprivileged user namespaces via Bubblewrap. Tool commands run in a sanitized chroot container where write access is strictly locked to your project directory.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 18 }}>
                <div style={{ padding: '20px 22px', background: 'var(--bg-soft)', borderRadius: 16, border: '1px solid var(--line)' }}>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Read-Only System Binds</h4>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
                    Core paths like <code style={{ fontFamily: 'var(--font-mono)' }}>/usr</code>, <code style={{ fontFamily: 'var(--font-mono)' }}>/bin</code>, and <code style={{ fontFamily: 'var(--font-mono)' }}>/lib</code> are mounted read-only. Home directory dotfiles (<code style={{ fontFamily: 'var(--font-mono)' }}>~/.ssh</code>, <code style={{ fontFamily: 'var(--font-mono)' }}>~/.aws</code>) are masked completely.
                  </p>
                </div>
                <div style={{ padding: '20px 22px', background: 'var(--bg-soft)', borderRadius: 16, border: '1px solid var(--line)' }}>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Strict Network Policy</h4>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
                    Network access can be completely disabled or scoped to package managers. Rogue commands, credential stealers, and prompt-injection payloads cannot exfiltrate data.
                  </p>
                </div>
              </div>
            </section>

            {/* Section: Skills & MCP */}
            <section id="skills" style={{ background: '#ffffff', borderRadius: 24, padding: '36px 32px', border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="section-tag" style={{ marginBottom: 14 }}>
                <span className="sparkle" />
                EXTENSIBILITY & MCP
              </div>
              <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                Skills Runtime & Model Context Protocol
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15.5, marginBottom: 20, lineHeight: 1.7 }}>
                Extend Mochi on the fly by placing markdown skill guides in <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple-dark)', background: 'var(--purple-lighter)', padding: '2px 8px', borderRadius: 6 }}>~/.mochi/skills/</code> or connecting external MCP servers over stdio or HTTP SSE.
              </p>
              <div style={{ background: '#12111E', borderRadius: 16, padding: '20px 24px', fontFamily: 'var(--font-mono)', fontSize: 13, color: '#EDE9FE', overflowX: 'auto', marginBottom: 18 }}>
                <span style={{ color: 'var(--purple-light)' }}># Import external skills directly from GitHub:</span><br />
                mochi import-skills github:anthropics/courses/tool-use<br /><br />
                <span style={{ color: 'var(--purple-light)' }}># Bridge existing Hermes Agent skills seamlessly:</span><br />
                mochi import-skills hermes:
              </div>
            </section>

            {/* Section: Daemon API */}
            <section id="daemon" style={{ background: '#ffffff', borderRadius: 24, padding: '36px 32px', border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="section-tag" style={{ marginBottom: 14 }}>
                <span className="sparkle" />
                DAEMON & AUTOMATION API
              </div>
              <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                HTTP Daemon & Headless Automation
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15.5, marginBottom: 20, lineHeight: 1.7 }}>
                Run Mochi as a persistent systemd service or background daemon on port 8642. Trigger tasks asynchronously via curl, GitHub Actions, or local IDE extensions:
              </p>
              <div style={{ background: '#12111E', borderRadius: 16, padding: '20px 24px', fontFamily: 'var(--font-mono)', fontSize: 13, color: '#EDE9FE', overflowX: 'auto' }}>
                curl -X POST http://127.0.0.1:8642/v1/jobs \<br />
                &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                &nbsp;&nbsp;{"-d '{\"goal\": \"run unit tests and fix regressions\", \"autoApprove\": true}'"}
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* Dark Coda Banner with Peeking Mascot */}
      <div className="coda-wrap">
        <div className="coda-banner">
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
            <h2>Ready to Build with Mochi?</h2>
            <p>
              Join thousands of developers using Mochi to build faster, smarter, and better.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a
                href="https://github.com/xanstomper/mochi/releases"
                className="btn btn-purple"
                target="_blank"
                rel="noopener"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </a>
              <a
                href={base + '/'}
                className="btn btn-outline"
                style={{ background: 'transparent', borderColor: 'rgba(255, 255, 255, 0.35)', color: '#ffffff' }}
              >
                Back to Home →
              </a>
            </div>
          </div>
          <div className="coda-peeking-mascot">
            <Mochi variant="docs" size={220} />
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<Docs />);
}
