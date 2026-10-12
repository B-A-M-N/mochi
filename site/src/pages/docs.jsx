import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import EngineeringGridBackground from '../EngineeringGridBackground.jsx';
import { AnimatedContent } from '../anim.jsx';
import {
  IconRocket, IconTerminal, IconUsers, IconWrench,
  IconBox, IconGlobe, IconSearch, IconShield, IconLayers,
  IconCpu, IconCheck,
} from '../icons.jsx';

const DOC_CARDS = [
  { icon: IconRocket, title: 'Quickstart & Binaries', desc: 'Single-binary setup, curl installer, npm package, Bun builds, and source compilation.', link: '#install' },
  { icon: IconTerminal, title: 'CLI & TUI Reference', desc: 'All 40+ CLI commands, headless one-shot flags, 22 interactive slash commands, and hotkeys.', link: '#cli' },
  { icon: IconUsers, title: '16 Specialist Roles', desc: 'Goal decomposition, directed acyclic graphs (DAGs), role profiles, and multi-agent swarms.', link: '#roles' },
  { icon: IconWrench, title: '30+ Deterministic Tools', desc: 'AST editing, unified diff patch, Ripgrep, native LSP, AST skeletons, and Myers diff.', link: '#tools' },
  { icon: IconCpu, title: 'Rust Native Core', desc: 'Zero-dep native/mochi_core crate, 10 ported hot-paths, N-API & Bun FFI, and TS fallbacks.', link: '#rust-core' },
  { icon: IconShield, title: 'Bubblewrap Sandboxing', desc: 'Unprivileged Linux namespace containerization, ~/.ssh masking, and 10-pattern secret DFA.', link: '#sandbox' },
  { icon: IconBox, title: 'Model Routing & Caching', desc: 'OpenCode Zen, FreeInference, Anthropic, OpenAI, 429 auto-backoff, and 90% prompt cache.', link: '#models' },
  { icon: IconGlobe, title: 'Daemon API & ACP v1', desc: 'Port 8642 persistent HTTP daemon, cron scheduler, and ACP v1 JSON-RPC for VS Code/Zed.', link: '#daemon' },
  { icon: IconLayers, title: 'Project Memory & Traces', desc: '.mochi/project.md, durable facts, struggle-state injection, and JSONL deep run replays.', link: '#memory' },
];

const ROLES = [
  { id: 'lead', title: 'Lead Orchestrator', tier: 'reasoning', tools: 'read, search, glob, git, inspect, chameleon, fetch, web_search, think, subagent', desc: 'Decomposes high-level objectives into directed acyclic task graphs (DAGs), spawns child specialists, tracks dependencies, and resolves blockers.' },
  { id: 'coder', title: 'Senior Software Engineer', tier: 'coding', tools: 'read, write, edit, delete, patch, shell, search, glob, git, inspect, diff, tree', desc: 'Full-stack software implementation, surgical AST-guided diff edits, test-driven bugfixes, and code refactoring.' },
  { id: 'reviewer', title: 'Code Reviewer', tier: 'review', tools: 'read, search, glob, git, inspect, diff, analyze_code', desc: 'Read-only PR and diff inspection, SOLID/DRY audits, cyclomatic complexity scanning, and style verification. Strictly read-only.' },
  { id: 'tester', title: 'Test Automation Engineer', tier: 'fast', tools: 'read, search, glob, shell, inspect, edit, write, patch', desc: 'Automated unit, regression, and integration test suite generation (Vitest, Jest, PyTest, Cargo Test) with edge-case validation.' },
  { id: 'researcher', title: 'Codebase Researcher', tier: 'fast', tools: 'read, search, glob, get_function, find_callers, type_hierarchy, inspect, fetch, web_search', desc: 'Call-graph indexing, AST symbol traversal, external library documentation lookup, and architectural exploration.' },
  { id: 'debugger', title: 'Systems Debugger', tier: 'reasoning', tools: 'read, search, glob, get_function, find_callers, type_hierarchy, inspect, shell, edit, patch', desc: 'Hypothesis-driven root cause analysis, stack-trace diagnosis, temporary runtime telemetry injection, and fix verification.' },
  { id: 'security', title: 'Security Auditor', tier: 'reasoning', tools: 'read, search, glob, inspect, analyze_code', desc: 'OWASP Top 10 vulnerability scanning, credential and secret leakage audit, dependency CVE checks, and data-flow threat modeling.' },
  { id: 'architect', title: 'Principal Architect', tier: 'reasoning', tools: 'read, search, glob, inspect, get_function, find_callers, type_hierarchy, chameleon, think', desc: 'API contract specification, distributed system boundaries, database schema migrations, and Architecture Decision Records (ADRs).' },
  { id: 'devops', title: 'DevOps & SRE', tier: 'coding', tools: 'read, write, edit, patch, shell, search, glob, inspect, git', desc: 'Dockerfiles, container security, GitHub Actions CI/CD workflows, Kubernetes manifests, and Terraform infrastructure-as-code.' },
  { id: 'db_admin', title: 'Database Administrator', tier: 'reasoning', tools: 'read, write, edit, patch, shell, search, glob, inspect, sql_codebase, db_inspect', desc: 'Relational & NoSQL schema design, SQL query plan optimization, index tuning, and ACID migration safety.' },
  { id: 'frontend', title: 'Frontend UX/UI Specialist', tier: 'coding', tools: 'read, write, edit, patch, shell, search, glob, inspect, chameleon', desc: 'React, Vue, Svelte, Tailwind CSS, responsive layouts, web accessibility (a11y), and state management optimization.' },
  { id: 'backend', title: 'Backend API Engineer', tier: 'coding', tools: 'read, write, edit, patch, shell, search, glob, inspect, chameleon', desc: 'High-throughput REST, GraphQL, and gRPC microservices, concurrency controls, idempotent handlers, and connection pooling.' },
  { id: 'performance', title: 'Performance Engineer', tier: 'reasoning', tools: 'read, edit, patch, shell, search, glob, inspect, perf', desc: 'CPU profiling, memory leak detection, heap-snapshot inspection, Big-O algorithm optimization, and cache tuning.' },
  { id: 'tech_writer', title: 'Technical Writer', tier: 'coding', tools: 'read, write, edit, patch, search, glob, inspect', desc: 'Technical documentation, README authoring, OpenAPI/Swagger specifications, and Mermaid architecture diagrams.' },
  { id: 'qa_engineer', title: 'QA Automation Engineer', tier: 'coding', tools: 'read, write, edit, patch, shell, search, glob, inspect', desc: 'End-to-end browser automation (Playwright, Cypress), visual regression suites, and user acceptance criteria validation.' },
  { id: 'data_scientist', title: 'Data Scientist / ML', tier: 'reasoning', tools: 'read, write, edit, patch, shell, search, glob, inspect', desc: 'Data wrangling with Polars & Pandas, PyTorch modeling, statistical validation, and reproducible analysis scripts.' },
];

const CLI_COMMANDS = [
  ['mochi ["prompt"]', 'Launch interactive full-screen TUI, or run one-shot prompt with -p flag.'],
  ['mochi goal "<objective>"', 'Autonomous goal execution with task DAG decomposition, verification, and recovery.'],
  ['mochi team "<objective>"', 'Role-diverse multi-agent swarm coordinating concurrently on a single shared objective.'],
  ['mochi plan "<objective>"', 'Plan-then-act mode: read-only research resulting in a structured plan with zero file edits.'],
  ['mochi resume', 'Warm-start resume of the last interrupted or failed session with full context recovery.'],
  ['mochi checkpoint save <name>', 'Create a named git snapshot checkpoint for safe multi-file experiments.'],
  ['mochi rollback', 'Instantly revert repository back to the last known-good checkpoint.'],
  ['mochi trace [<goalId>]', 'Replay any previous execution turn-by-turn from deep-redacted JSONL run traces.'],
  ['mochi session list / search "<query>"', 'Full-text search across all previous agent sessions powered by SQLite FTS5.'],
  ['mochi inspect "<symbol>"', 'Deep symbol and subsystem inspection using the in-memory code graph.'],
  ['mochi speculate "<question>"', 'Speculative multi-pass reasoning on complex architectural or algorithmic problems.'],
  ['mochi mode <normal|spec|security|codemod|chaos>', 'Set harness posture: normal, speculative, security-hardened, codemod, or adversarial.'],
  ['mochi reasoning [low|med|high|max]', 'Configure reasoning depth and token expenditure budget for thinking models.'],
  ['mochi rules [list|add]', 'Inspect or modify project conventions enforced by MOCHI.md.'],
  ['mochi review [--strict] [--json]', 'Automated AI code review of the current uncommitted git working-tree diff.'],
  ['mochi fix [--auto-commit]', 'Feed a terminal error log or crash trace and generate a verified minimal fix.'],
  ['mochi security / mochi audit', 'Static security audit scanning for credential leaks, CVEs, and OWASP Top 10 vulnerabilities.'],
  ['mochi docgen [--write]', 'Generate comprehensive architecture diagrams (Mermaid) and API reference documentation.'],
  ['mochi daemon start --port 8642', 'Launch persistent HTTP daemon service for remote, mobile, and script automation.'],
  ['mochi daemon cron add --schedule "..."', 'Register recurring scheduled jobs executed autonomously by the daemon.'],
  ['mochi acp', 'Agent Client Protocol v1 server over JSON-RPC stdio for Zed, VS Code, and Cursor.'],
  ['mochi doctor', 'Self-inspect runtime health: Rust binary, compilers, tools, sandbox, and API keys.'],
  ['mochi self-train [N] [focus]', 'Execute autonomous cycles of self-review, skill curation, and harness hardening.'],
  ['mochi perf', 'Run stream pipeline and tokenization micro-benchmarks.'],
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
  'File & Code Editing': [
    ['edit', 'Anchor-matched, whitespace-tolerant multi-file editing with atomic rollbacks.'],
    ['patch', 'Standard multi-file *** Begin Patch unified diff applicator.'],
    ['write', 'Atomic file creation or full overwrite with directory auto-scaffolding.'],
    ['delete', 'Safe removal of files and directories within approved workspace boundaries.'],
    ['read', 'Reads file with skeleton:true mode for AST outlines, reducing tokens by 85%.'],
    ['replace_symbol', 'AST-driven whole-symbol, function, and interface refactoring without anchor drift.'],
    ['rename_symbol', 'Project-wide atomic identifier renamer matching exact word boundaries across all files.'],
    ['search_replace_multi', 'Atomic multi-file search and replace across the entire project.'],
    ['regex_replace', 'Pattern-based regular expression editor with capture groups.'],
  ],
  'AST & Code Intelligence': [
    ['get_function', 'Extract function, class, or method declaration by name via Tree-sitter AST.'],
    ['find_callers', 'Reverse call-graph traversal across all project files and modules.'],
    ['type_hierarchy', 'Resolves class/interface inheritance and implementation graphs.'],
    ['find_references', 'Locate all symbol usages, definitions, and occurrences across workspace.'],
    ['find_definitions', 'Jump directly to symbol definitions, types, or interface declarations.'],
    ['analyze_code', 'AST complexity analysis, cyclomatic complexity, and code smell scanner.'],
  ],
  'Execution & Inspection': [
    ['repl', 'In-process interactive runtime evaluator for JS/Node, Python, and Shell with state persistence.'],
    ['shell', 'Sandboxed command execution via Bubblewrap (bwrap) with background jobs support.'],
    ['search', 'Native N-API accelerated sub-millisecond keyword and regex search.'],
    ['glob', 'Asynchronous, hard-bounded file pattern matching avoiding node_modules.'],
    ['inspect', 'Summarizes directory trees, file sizes, and language compositions.'],
    ['tree', 'Generates ASCII visual directory trees.'],
    ['diff', 'High-throughput Myers unified diff engine accelerated in native Rust.'],
    ['git', 'Safe git operations (branch, status, log, diff, commit).'],
    ['git_blame', 'Discovers author and commit history per line.'],
    ['git_history', 'File commit log and mutation timeline.'],
  ],
  'Research & Web': [
    ['web_search', 'Searches the web for documentation, solutions, and API specs.'],
    ['web_crawl', 'Breadth-first web crawler with HTML-to-Markdown text extraction.'],
    ['fetch', 'HTTP client for raw GET/POST requests with custom headers.'],
    ['deepwiki', 'Built-in documentation server and query tool.'],
  ],
  'Swarm State & Orchestration': [
    ['subagent', 'Spawn any of 16 specialized roles concurrently in isolated scopes.'],
    ['skill', 'Dynamic SKILL.md runtime loading, discovery, and prompt injection.'],
    ['todo', 'Manages shared multi-step task checklists.'],
    ['memory', 'Persistent vector and key-value engineering memory across session runs.'],
    ['verify', 'Executes narrow verification checks to prove behavioral correctness.'],
    ['perf', 'CPU hotspot profiling, heap-snapshot analysis, and memory leak detection.'],
    ['think', 'Scratchpad for deep step-by-step reasoning.'],
    ['chameleon', 'Dynamic synthetic-parameter reasoning enhancer.'],
    ['db_inspect', 'Inspects database schemas, tables, and indices.'],
    ['create_pr', 'Synthesizes pull request descriptions and creates git PRs.'],
  ],
};

const RUST_OPS = [
  ['estimateTokens / countTokens', 'Compiled heuristic BPE tokenizer. Batched whole-history counting over stdio daemon in 0.28 ms.'],
  ['skeletonizeSource', 'Per-byte source compaction stripping function bodies while keeping interfaces, saving 85% tokens.'],
  ['diffNumstat', 'High-speed diff calculation computing added, deleted, and modified line counts in 0.35 ms.'],
  ['redactSecrets', '10-pattern byte-scanner DFA redacting sk-, AIza, PAT, JWT, AWS, and private keys on every output.'],
  ['budgetDecide', 'Per-turn budget phase state machine (exhausted -> verify -> cheap -> reduced -> full).'],
  ['classifyCommand', 'Shell command risk classification detecting 17 destructive + 16 network patterns.'],
  ['foldOutput', 'Tool-output head/tail line folding keeping output within context budget.'],
  ['stripAnsi', 'Full ECMA-48 CSI escape code stripper (0x40-0x7E terminators).'],
  ['commandAvailable', 'Batched which-style binary probes executing without subprocess overhead.'],
  ['estimateCostUsd', 'Model token cost calculations with free-tier short-circuiting.'],
  ['searchDir', 'Recursive directory traversal and metadata extraction in sub-millisecond time.'],
];

const SIDEBAR = [
  ['Get Started', [
    ['install', 'Installation & Binaries'],
    ['cli', 'CLI Command Reference'],
    ['slash-commands', '22 Slash Commands'],
  ]],
  ['Core Architecture', [
    ['roles', '16 Specialist Roles & Swarms'],
    ['tools', '30+ Native Tools'],
    ['rust-core', 'Rust Native Core (mochi_core)'],
    ['sandbox', 'Bubblewrap Sandboxing'],
    ['models', 'Model Routing & Caching'],
    ['daemon', 'HTTP Daemon & ACP v1'],
    ['memory', 'Project Memory & Traces'],
  ]],
  ['Ecosystem', [
    ['https://github.com/xanstomper/mochi', 'GitHub Repository ↗'],
    ['https://github.com/xanstomper/mochi/releases', 'Release Binaries ↗'],
  ]],
];

export default function Docs() {
  const [toolTab, setToolTab] = useState('File & Code Editing');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCards = DOC_CARDS.filter(c =>
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <EngineeringGridBackground />
      <div className="pagehead">
        <div className="wrap" style={{ maxWidth: 1560, width: '100%' }}>
          <div className="pagehead-row">
            <div className="pagehead-col">
              <AnimatedContent direction="left" delay={0.05} distance={40} blur={14}>
                <div className="hero-eyebrow">
                  <span className="sparkle" />
                  COMPLETE TECHNICAL DOCUMENTATION & REFERENCE (v0.23.0)
                </div>
              </AnimatedContent>

              <AnimatedContent direction="left" delay={0.15} distance={48} blur={14}>
                <h1 className="hero-title">
                  Master Every Layer <span className="accent-title">of Mochi.</span>
                </h1>
              </AnimatedContent>

              <AnimatedContent direction="left" delay={0.22} distance={44} blur={14}>
                <p className="hero-sub" style={{ maxWidth: 780 }}>
                  Exhaustive documentation covering everything in the repository: zero-dependency binary compilation, the 16 specialist roles, 30+ native tools, Rust native core, Bubblewrap sandboxing, prompt caching, and persistent daemon architecture.
                </p>
              </AnimatedContent>

              {/* Interactive Search Bar */}
              <AnimatedContent direction="left" delay={0.28} distance={40} blur={14}>
                <div className="doc-search-bar" style={{ maxWidth: 640 }}>
                  <IconSearch size={18} className="text-muted" />
                  <input
                    type="text"
                    placeholder="Search all documentation, roles, tools, CLI flags, Rust ops..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  <span className="doc-search-badge">v0.23.0</span>
                </div>
              </AnimatedContent>
            </div>

            {/* Scholar Mochi Mascot */}
            <AnimatedContent direction="right" delay={0.2}>
              <div className="subpage-mascot-wrap">
                <div className="subpage-doodle">complete documentation!</div>
                <Mochi variant="docs" size={380} />
              </div>
            </AnimatedContent>
          </div>

          {/* 9 Category Launchers */}
          <div className="grid3" style={{ marginTop: 44, marginBottom: 56 }}>
            {filteredCards.map((card, i) => {
              const IconComp = card.icon;
              return (
                <AnimatedContent key={card.title} direction={i % 2 === 0 ? "left" : "right"} delay={i * 0.04} distance={40} blur={12}>
                  <a href={card.link} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card-icon-box">
                      <IconComp size={22} />
                    </div>
                    <h3 className="card-title">
                      <span>{card.title}</span>
                      <span className="card-arrow">→</span>
                    </h3>
                    <p className="card-desc">{card.desc}</p>
                  </a>
                </AnimatedContent>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Documentation Grid */}
      <div className="doc-wrap">
        <div className="wrap" style={{ maxWidth: 1560, width: '100%' }}>
          <div className="doc-grid">
            {/* Sticky Sidebar */}
            <AnimatedContent direction="left" delay={0.1} distance={40} blur={12}>
              <aside className="doc-sidebar">
                {SIDEBAR.map(([groupTitle, items]) => (
                  <div key={groupTitle} className="doc-sidebar-group">
                    <div className="doc-sidebar-title">{groupTitle}</div>
                    {items.map(([id, label]) => {
                      const isExternal = id.startsWith('http');
                      return (
                        <a
                          key={id}
                          href={isExternal ? id : `#${id}`}
                          target={isExternal ? '_blank' : undefined}
                          rel={isExternal ? 'noopener' : undefined}
                          className="doc-nav-item"
                        >
                          {label}
                        </a>
                      );
                    })}
                  </div>
                ))}
              </aside>
            </AnimatedContent>

            {/* Main Content */}
            <main className="doc-content">
              {/* Section 1: Installation & Binaries */}
              <section id="install" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">INSTALLATION</span>
                    <h2 className="doc-section-title">Installation & Binary Deployments</h2>
                    <p className="doc-section-desc">
                      Deploy Mochi across Linux, macOS, and Windows. Run via prebuilt binary, npm package, or build from source.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px', marginBottom: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>1. One-Line Curl Installer (Linux & macOS)</h3>
                    <div className="code-block" style={{ background: '#12111A', borderRadius: 12, padding: '16px 20px', overflowX: 'auto', marginBottom: 14 }}>
                      <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)' }}>curl -fsSL https://xanstomper.github.io/mochi/install.sh | bash</code>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                      Downloads the latest release into <code>~/.local/bin/mochi</code> and sets up shell completions for Bash, Zsh, and Fish automatically.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px', marginBottom: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>2. Install via npm</h3>
                    <div className="code-block" style={{ background: '#12111A', borderRadius: 12, padding: '16px 20px', overflowX: 'auto', marginBottom: 14 }}>
                      <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)' }}>npm install -g @mochi/agent</code>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                      Installs the global CLI executable running on Node ≥ 22 with zero runtime npm dependencies.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>3. Standalone Bun Binary & Source Build</h3>
                    <div className="code-block" style={{ background: '#12111A', borderRadius: 12, padding: '16px 20px', overflowX: 'auto', marginBottom: 14 }}>
                      <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)', display: 'block', lineHeight: 1.6 }}>
                        git clone https://github.com/xanstomper/mochi.git<br/>
                        cd mochi && npm install<br/>
                        npm run build:bin     # Produces standalone executable ./dist/mochi-bin<br/>
                        npm run build:native  # Compiles native/mochi_core Rust crate
                      </code>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                      Compiles Mochi with bytecode precompilation (<code>--bytecode</code>) into a single standalone executable that needs no Node or Bun runtime installed.
                    </p>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 2: CLI Commands Reference */}
              <section id="cli" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">CLI REFERENCE</span>
                    <h2 className="doc-section-title">Complete Command Line Reference</h2>
                    <p className="doc-section-desc">
                      Every command in Mochi is self-documenting and covered by automated shell completion tests.
                    </p>
                  </div>

                  <div className="doc-table-card">
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th style={{ width: '35%' }}>Command Syntax</th>
                          <th>Function & Behavioral Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CLI_COMMANDS.map(([cmd, desc]) => (
                          <tr key={cmd}>
                            <td>
                              <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--purple-dark)' }}>{cmd}</code>
                            </td>
                            <td style={{ fontSize: 14, color: 'var(--ink)' }}>{desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 3: 22 Slash Commands */}
              <section id="slash-commands" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">INTERACTIVE TUI</span>
                    <h2 className="doc-section-title">22 Interactive Slash Commands</h2>
                    <p className="doc-section-desc">
                      Type <code>/</code> inside the interactive terminal TUI to trigger instant actions and configuration menus.
                    </p>
                  </div>

                  <div className="doc-table-card">
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th style={{ width: '25%' }}>Slash Command</th>
                          <th>Action Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SLASH_COMMANDS.map(([cmd, desc]) => (
                          <tr key={cmd}>
                            <td>
                              <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--purple-dark)' }}>{cmd}</code>
                            </td>
                            <td style={{ fontSize: 14, color: 'var(--ink)' }}>{desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 4: 16 Specialist Roles */}
              <section id="roles" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">MULTI-AGENT SWARMS</span>
                    <h2 className="doc-section-title">The 16 Specialist Roles</h2>
                    <p className="doc-section-desc">
                      When executing <code>mochi team "..."</code>, Mochi dynamically instantiates role-diverse specialists, routing each to optimal model tiers with scoped tool permissions.
                    </p>
                  </div>

                  <div className="doc-table-card">
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th style={{ width: '18%' }}>Role</th>
                          <th style={{ width: '12%' }}>Model Tier</th>
                          <th style={{ width: '28%' }}>Permitted Tools</th>
                          <th>Primary Mission & Capabilities</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ROLES.map(r => (
                          <tr key={r.id}>
                            <td>
                              <div style={{ fontWeight: 800, color: 'var(--ink)' }}>{r.title}</div>
                              <code style={{ fontSize: 12, color: 'var(--purple)' }}>{r.id}</code>
                            </td>
                            <td>
                              <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: r.tier === 'reasoning' ? '#F4EFFE' : r.tier === 'coding' ? '#ECFDF5' : '#EFF6FF',
                                color: r.tier === 'reasoning' ? '#6D28D9' : r.tier === 'coding' ? '#059669' : '#1D4ED8',
                              }}>
                                {r.tier}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                                {r.tools}
                              </div>
                            </td>
                            <td style={{ fontSize: 13.5, color: 'var(--ink)' }}>{r.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 5: 30+ Deterministic Tools */}
              <section id="tools" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">TOOL BUS</span>
                    <h2 className="doc-section-title">30+ Native Deterministic Tools</h2>
                    <p className="doc-section-desc">
                      Surgical AST editing, unified patching, code intelligence, background shells, and swarm state tools.
                    </p>
                  </div>

                  {/* Tool category switcher */}
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

                  <div className="doc-table-card">
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th style={{ width: '28%' }}>Tool Name</th>
                          <th>Behavior & Safety Scope</th>
                        </tr>
                      </thead>
                      <tbody>
                        {TOOLS[toolTab]?.map(([tool, desc]) => (
                          <tr key={tool}>
                            <td>
                              <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--purple-dark)' }}>{tool}</code>
                            </td>
                            <td style={{ fontSize: 14, color: 'var(--ink)' }}>{desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 6: Rust Native Core */}
              <section id="rust-core" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">NATIVE RUNTIME</span>
                    <h2 className="doc-section-title">Rust Native Core (native/mochi_core)</h2>
                    <p className="doc-section-desc">
                      A zero-dependency Rust crate (empty <code>[dependencies]</code>) providing high-throughput microsecond primitives with N-API and Bun FFI bindings.
                    </p>
                  </div>

                  <div className="doc-table-card">
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th style={{ width: '32%' }}>Exported C-ABI / N-API Op</th>
                          <th>Operation Purpose & Performance Benefit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {RUST_OPS.map(([op, desc]) => (
                          <tr key={op}>
                            <td>
                              <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--purple-dark)' }}>{op}</code>
                            </td>
                            <td style={{ fontSize: 14, color: 'var(--ink)' }}>{desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 7: Bubblewrap Sandboxing */}
              <section id="sandbox" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">SECURITY ENFORCEMENT</span>
                    <h2 className="doc-section-title">Bubblewrap (bwrap) Namespace Sandboxing</h2>
                    <p className="doc-section-desc">
                      Hardware-level unprivileged containerization preventing prompt-injection attacks, secret leakage, and filesystem tampering.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 20 }}>
                      <div style={{ background: '#FAF8FE', borderRadius: 14, padding: 18, border: '1px solid var(--purple-light)' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color: '#8A67F6', marginBottom: 6 }}>FILESYSTEM ISOLATION</div>
                        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>Root system mounted read-only (<code>--ro-bind /</code>); only project working directory and isolated tmpfs are writable.</p>
                      </div>
                      <div style={{ background: '#FAF8FE', borderRadius: 14, padding: 18, border: '1px solid var(--purple-light)' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color: '#8A67F6', marginBottom: 6 }}>CREDENTIAL MASKING</div>
                        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>Empty read-only tmpfs mounts explicitly mask <code>~/.ssh</code>, <code>~/.aws</code>, and token stores from any tool access.</p>
                      </div>
                      <div style={{ background: '#FAF8FE', borderRadius: 14, padding: 18, border: '1px solid var(--purple-light)' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color: '#8A67F6', marginBottom: 6 }}>10-PATTERN SECRET DFA</div>
                        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>Native byte-scanner DFA redacts API keys (sk-, AIza, PAT, JWT, AWS) on every tool output and trace line.</p>
                      </div>
                    </div>
                    <div className="code-block" style={{ background: '#12111A', borderRadius: 12, padding: '16px 20px', overflowX: 'auto' }}>
                      <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)' }}>
                        export MOCHI_SANDBOX=auto  # Activates bwrap namespace jail on Linux<br/>
                        export MOCHI_SAFETY=ask    # Prompts on risky shell commands
                      </code>
                    </div>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 8: Model Providers & Caching */}
              <section id="models" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">MULTI-PROVIDER ROUTING</span>
                    <h2 className="doc-section-title">Model Providers, Failover & Ephemeral Caching</h2>
                    <p className="doc-section-desc">
                      Hot-swap 20+ model backends with multi-key credential pool rotation, leaky-bucket rate limiting, and 90% prompt cache discounts.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginBottom: 20 }}>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>Supported Model Providers</h4>
                        <ul style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18 }}>
                          <li><strong>OpenCode Zen / Go:</strong> DeepSeek v4 Flash, Kimi k2.7, GPT-5.4 Nano, GLM-5.3 Flash</li>
                          <li><strong>FreeInference (Harvard SEAS):</strong> Kimi k2.7 Code, GLM-5.3, Minimax-m3, Qwen 3.6</li>
                          <li><strong>OpenAI:</strong> GPT-5, o3, GPT-4o, o4-mini</li>
                          <li><strong>Anthropic:</strong> Claude 3.5 Sonnet, Claude Opus 4</li>
                          <li><strong>Google Gemini:</strong> Gemini 2.5 Pro, Gemini 2.0 Flash</li>
                          <li><strong>Local Inference:</strong> Ollama (localhost:11434), llama.cpp (localhost:8080)</li>
                        </ul>
                      </div>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>Resilience & Rate-Throttling</h4>
                        <ul style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18 }}>
                          <li><strong>Automatic 429 Backoff:</strong> Exponential backoff honoring <code>Retry-After</code> headers without losing session state.</li>
                          <li><strong>Credential Pool Rotation:</strong> Auto-rotates alternative API keys on 401, 429, or 403 errors.</li>
                          <li><strong>Leaky-Bucket RPM Cap:</strong> <code>MOCHI_RATE_LIMIT_RPM=20</code> self-regulates swarm burst across free endpoints.</li>
                          <li><strong>3-Strike Auto-Escalation:</strong> Automatically escalates stuck tasks from fast → coding → reasoning tier.</li>
                          <li><strong>Anthropic Prompt Cache:</strong> Injects <code>cache_control: ephemeral</code> on system prompts for 90% read discount.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 9: Persistent Daemon & ACP v1 */}
              <section id="daemon" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">DAEMON SERVICE</span>
                    <h2 className="doc-section-title">Persistent HTTP Daemon (Port 8642) & ACP v1 Protocol</h2>
                    <p className="doc-section-desc">
                      Drive Mochi remotely via REST/JSON-RPC, schedule recurring cron tasks, or connect editors via Agent Client Protocol (ACP v1).
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <div className="code-block" style={{ background: '#12111A', borderRadius: 12, padding: '16px 20px', overflowX: 'auto', marginBottom: 16 }}>
                      <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)', display: 'block', lineHeight: 1.6 }}>
                        # Start background agent daemon service<br/>
                        mochi daemon start --port 8642 --token mysecrettoken<br/><br/>
                        # Submit and monitor goals over HTTP<br/>
                        curl -X POST http://localhost:8642/api/goal \<br/>
                        &nbsp;&nbsp;-H "Authorization: Bearer mysecrettoken" \<br/>
                        &nbsp;&nbsp;-d '&#123;"objective": "Run security audit and update dependencies"&#125;'<br/><br/>
                        # Start Agent Client Protocol server for VS Code / Zed<br/>
                        mochi acp
                      </code>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                      ACP v1 exposes JSON-RPC stdio methods (<code>initialize</code>, <code>session/new</code>, <code>session/prompt</code>, <code>session/cancel</code>, <code>session/set_mode</code>), allowing any ACP-capable IDE to drive Mochi natively.
                    </p>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 10: Project Memory & Run Traces */}
              <section id="memory" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">DURABLE KNOWLEDGE</span>
                    <h2 className="doc-section-title">Project Memory, Rules & Deep Run Traces</h2>
                    <p className="doc-section-desc">
                      Curated engineering memory in <code>.mochi/memory/</code> and deep-redacted JSONL run traces for full post-mortem inspection.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>Curated Project Memory</h4>
                        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                          Conversation history is never blindly dumped into context. Agents curate durable engineering facts into <code>.mochi/memory/</code> across four structured files:
                        </p>
                        <ul style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18, marginTop: 8 }}>
                          <li><code>architecture.md</code>: Service topology, invariants, boundaries</li>
                          <li><code>decisions.md</code>: Architecture Decision Records (ADRs)</li>
                          <li><code>conventions.md</code>: Code patterns, testing rules, lints</li>
                          <li><code>failures.md</code>: Past bugs and verified avoidance strategies</li>
                        </ul>
                      </div>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>Struggle-State & Run Traces</h4>
                        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                          The harness actively detects loops, consecutive tool errors, and repeated reads, injecting an explicit STRUGGLE STATE escape directive before the next turn:
                        </p>
                        <div className="code-block" style={{ background: '#12111A', borderRadius: 10, padding: '12px 16px', overflowX: 'auto', marginTop: 8 }}>
                          <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                            mochi trace &lt;goalId&gt;  # Replay entire run step-by-step
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </AnimatedContent>
              </section>
            </main>
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
