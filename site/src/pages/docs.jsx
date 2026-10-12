import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import EngineeringGridBackground from '../EngineeringGridBackground.jsx';
import { AnimatedContent } from '../anim.jsx';
import {
  IconRocket, IconTerminal, IconUsers, IconWrench,
  IconBox, IconGlobe, IconSearch, IconShield, IconLayers,
  IconCpu, IconCheck, IconCode, IconGitBranch, IconBolt,
} from '../icons.jsx';

const DOC_CARDS = [
  { icon: IconRocket, title: 'Quickstart & Binaries', desc: 'Single-binary setup, curl installer, npm package, Bun builds, and source compilation.', link: '#install' },
  { icon: IconTerminal, title: 'CLI & Interface Reference', desc: 'All 30+ CLI commands, headless one-shot flags, 22 interactive slash commands, and hotkeys.', link: '#cli' },
  { icon: IconUsers, title: '16 Specialist Roles', desc: 'Goal decomposition, directed acyclic graphs (DAGs), role profiles, and multi-agent swarms.', link: '#roles' },
  { icon: IconWrench, title: '30+ Deterministic Tools', desc: 'AST editing, unified diff patch, Ripgrep, native LSP, AST skeletons, and Myers diff.', link: '#tools' },
  { icon: IconCpu, title: 'Rust Native Core', desc: 'Zero-dep native/mochi_core crate, 11 C-ABI ops, N-API & Bun FFI, and TS fallbacks.', link: '#rust-core' },
  { icon: IconShield, title: 'Bubblewrap Sandboxing', desc: 'Unprivileged Linux namespace containerization, ~/.ssh masking, and 10-pattern secret DFA.', link: '#sandbox' },
  { icon: IconBox, title: 'Frontier Model Routing', desc: 'GPT-5.5 Astra, Claude Sonnet 5.5 & Opus 5.5, o5, DeepSeek V4 Flash, Kimi k3, GLM-5.3, 429 auto-backoff, 90% prompt cache.', link: '#models' },
  { icon: IconGlobe, title: 'Daemon API & Cron', desc: 'Port 8642 persistent HTTP daemon, cron scheduler, and ACP v1 JSON-RPC for VS Code/Zed.', link: '#daemon' },
  { icon: IconCode, title: 'Editor Integrations (ACP)', desc: 'Agent Client Protocol v1 over stdio for VS Code (Ctrl+Alt+M) and JetBrains tool windows.', link: '#editors' },
  { icon: IconBolt, title: 'Cozy Onboarding', desc: 'One-command autodiscovery of providers, keys, skills, and MCP servers from other installed agents.', link: '#onboarding' },
  { icon: IconGitBranch, title: 'MCP Protocol Client', desc: 'Connect stdio and Streamable-HTTP MCP servers with pre-registered OAuth client credentials.', link: '#mcp' },
  { icon: IconTerminal, title: 'Full Configuration Schema', desc: 'Annotated JSON schema for ~/.config/mochi/config.json with safety modes and budget caps.', link: '#config' },
  { icon: IconCheck, title: 'Environment Variables', desc: 'Complete table of runtime switches: MOCHI_YOLO, MOCHI_SANDBOX, MOCHI_RATE_LIMIT_RPM, etc.', link: '#env' },
  { icon: IconLayers, title: 'Skills Ecosystem & Import', desc: 'SKILL.md workflow discovery, packaging, and non-destructive external skill importing.', link: '#skills' },
  { icon: IconBox, title: 'Project Memory & Traces', desc: '.mochi/project.md, durable facts, struggle-state injection, and JSONL deep run replays.', link: '#memory' },
  { icon: IconWrench, title: 'Plugin Hooks Architecture', desc: 'Preflight, pre-tool, post-tool, verification, and cleanup hook lifecycles with .disabled sentinels.', link: '#plugins' },
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
  ['mochi daemon start --host 0.0.0.0 --port 8642', 'Start persistent background daemon on port 8642 with REST API and worker pool.'],
  ['mochi daemon status / jobs / stop', 'Inspect running daemon health, active background tasks, and graceful shutdown.'],
  ['mochi daemon cron add|list|remove', 'Schedule recurring background autonomous agent tasks via cron expressions.'],
  ['mochi termix [--sessions <n>]', 'Launch split-pane multi-agent workspace running concurrent interactive sessions.'],
  ['mochi term [--geometry 100x30]', 'Open standalone black-background monospace terminal window dedicated to Mochi.'],
  ['mochi acp [--check]', 'Launch Agent Client Protocol v1 stdio JSON-RPC server for VS Code and JetBrains IDEs.'],
  ['mochi onboard [--yes|--skip-skills|--force]', 'First-run interactive setup: autodiscover keys, models, skills, and MCP servers.'],
  ['mochi import-skills <src> [--list|--force]', 'Import external SKILL.md trees (local dir, hermes:, or github:owner/repo).'],
  ['mochi skills pack <name> / unpack <path>', 'Package or install portable Mochi skill archives.'],
  ['mochi plugin add|remove|list|enable|disable', 'Manage lifecycle hook plugins with .disabled sentinel control.'],
  ['mochi doctor [--probe]', 'Health check on workspace compilers, tools, sandbox, and provider latency.'],
  ['mochi review [--strict] [--json]', 'Automated AI code review of the current uncommitted git working-tree diff.'],
  ['mochi fix [--auto-commit]', 'Feed a terminal error log or crash trace and generate a verified minimal fix.'],
  ['eval "$(mochi completion bash|zsh|fish)"', 'Install tab-completion script for bash, zsh, or fish.'],
];

const SLASH_COMMANDS = [
  ['/help', 'Display interactive command cheat-sheet and keybindings.'],
  ['/clear', 'Clear visible transcript lines in current viewport.'],
  ['/new or /clear-all', 'Start fresh session, clearing working checkpoints and runtime state.'],
  ['/history or /sessions', 'Interactive session switcher and historical session browser.'],
  ['/rename <name>', 'Rename the current active session.'],
  ['/export [file]', 'Export full session transcript to a structured JSON document.'],
  ['/import <file>', 'Import and replay a saved session transcript.'],
  ['/model', 'Interactive model and provider selector modal with latency tiers.'],
  ['/theme', 'Interactive 15-theme live preview and switcher.'],
  ['/doctor', 'Diagnose workspace configuration, tools, and permissions.'],
  ['/usage', 'Show token usage, cost expenditure, and prompt cache hit rates.'],
  ['/init', 'Scaffold project MOCHI.md configuration file in repo root.'],
  ['/branch', 'View active git branch name, upstream tracking, and commit status.'],
  ['/commit [msg]', 'Create a git checkpoint commit of current workspace modifications.'],
  ['/run <cmd> or /shell <cmd>', 'Execute shell command directly in the workspace.'],
  ['/test', 'Detect and execute project test suite (Vitest, Jest, PyTest, Cargo).'],
  ['/review', 'Run automated architectural and style code review on uncommitted diffs.'],
  ['/diff', 'Display colorized git diff of pending modifications.'],
  ['/rollback', 'Roll back workspace to the last git checkpoint.'],
  ['/yolo', 'Toggle auto-approve mode for all tool executions.'],
  ['/stop or /skip', 'Interrupt in-flight agent turn or thinking stream.'],
  ['/exit or /quit', 'Exit Mochi terminal UI.'],
];

const TOOLS = {
  'File & Code Editing': [
    ['edit', 'Performs surgical, anchor-matched text replacements with whitespace tolerance.'],
    ['patch', 'Multi-file unified diff patcher (*** Begin Patch / Add File / Update File / Delete File).'],
    ['write', 'Creates new files or performs full-file writes with directory auto-creation.'],
    ['delete', 'Safely removes files with project-root escape prevention guards.'],
    ['read', 'Reads file with line numbers or extracts compact AST outlines (skeleton: true, 85% token save).'],
    ['replace_symbol', 'AST-driven whole-function or class rewriter without anchor drift.'],
    ['rename_symbol', 'Project-wide atomic identifier renamer matching exact word boundaries.'],
    ['search_replace_multi', 'Atomic multi-file find-and-replace across a whole project.'],
    ['regex_replace', 'Pattern-based regular expression editor.'],
  ],
  'AST & Code Intelligence': [
    ['get_function', 'Extracts function/method definition and body by symbol name.'],
    ['find_callers', 'Finds all invocation sites and call hierarchies of a function.'],
    ['type_hierarchy', 'Resolves class/interface inheritance and implementation graphs.'],
    ['find_references', 'Locates all symbol references across the workspace.'],
    ['find_definitions', 'Navigates directly to type, variable, or interface definitions.'],
    ['analyze_code', 'AST complexity analysis, cyclomatic complexity, and code smell scanner.'],
  ],
  'Execution & Inspection': [
    ['repl', 'In-process interactive runtime evaluator for JS/Node, Python, and Shell with state persistence.'],
    ['shell', 'Executes commands in the workspace. Supports background: true for asynchronous jobs.'],
    ['search', 'Native N-API accelerated regex/text search over the workspace in sub-millisecond time.'],
    ['glob', 'Fast file finding matching glob patterns.'],
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
    ['subagent', 'Spawns any of 16 specialized roles concurrently in isolated scopes.'],
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
  ['nativeCountTokens', 'Fast BPE token counting bypassing V8 heap allocations (0.28ms vs 9.6ms).'],
  ['nativeTruncateToTokens', 'Token-precise string truncation preserving UTF-8 code boundaries (0.35ms).'],
  ['nativeSearchDir', 'Recursive regex directory search over 10,000 files in 3.8ms.'],
  ['plan_compaction_cut', 'Computes conversation message compaction cut points via token budget math (0.12ms vs 8.4ms).'],
  ['fuzzy_line_match', 'Sub-millisecond fuzzy line matcher for anchor matching in edit tool (0.04ms).'],
  ['myers_diff', 'Myers unified diff generator in compiled native code (0.85ms vs 18.2ms).'],
  ['ast_skeleton_extract', 'Parses syntax trees and strips function bodies for 85% token compaction (1.4ms).'],
  ['token_budget_guard', 'Microsecond validation of in-flight prompts against context window ceilings (0.01ms).'],
  ['secret_redact_dfa', 'Deterministic finite automaton scanning 10 secret patterns per byte (0.15ms).'],
  ['bwrap_jail_exec', 'Builds and launches Bubblewrap namespace arguments in under 0.95ms.'],
  ['fts5_index_upsert', 'Fast SQLite FTS5 transcript tokenization and inverted index updates (1.1ms).'],
];

const ENV_VARS = [
  ['MOCHI_YOLO=1', 'Auto-approve all tool calls (bypasses interactive user prompts). Equivalent to --yolo.'],
  ['MOCHI_SANDBOX=auto|bubblewrap|off', 'Linux namespace isolation mode. Defaults to auto (activates when bwrap is installed).'],
  ['MOCHI_SAFETY=safe|ask|auto|uncensored', 'Safety policy enforcement mode.'],
  ['MOCHI_RATE_LIMIT_RPM=20', 'Client-side leaky-bucket requests-per-minute cap preventing swarm burst limits.'],
  ['MOCHI_RATE_LIMIT_CONCURRENCY=3', 'Maximum concurrent in-flight model calls across all active sessions.'],
  ['MOCHI_NATIVE_FUZZY=1', 'Force Rust native fuzzy line matcher over C++ fallback.'],
  ['MOCHI_THEME=<theme>', 'Pre-select terminal UI theme on launch (e.g. cyber, kanagawa, nord).'],
  ['MOCHI_DAEMON_PORT=8642', 'Override persistent HTTP daemon port (defaults to 8642).'],
  ['MOCHI_DAEMON_HOST=0.0.0.0', 'Override persistent HTTP daemon host interface (defaults to 0.0.0.0).'],
  ['MOCHI_MAX_ITERATIONS=12', 'Maximum agent loop turn count before requiring user approval.'],
  ['MOCHI_MAX_TOKENS=150000', 'Maximum token expenditure ceiling per task.'],
  ['MOCHI_MAX_COST_USD=2.00', 'Maximum financial cost budget per autonomous goal run.'],
];

const SIDEBAR = [
  ['GETTING STARTED', [
    ['install', 'Quickstart & Binaries'],
    ['onboarding', 'Cozy First-Run Setup'],
    ['cli', 'CLI Command Reference'],
    ['slash', '22 TUI Slash Commands'],
  ]],
  ['AGENT ARCHITECTURE', [
    ['roles', '16 Specialist Roles & Swarms'],
    ['tools', '30+ Native Deterministic Tools'],
    ['rust-core', 'Rust Native Core (mochi_core)'],
    ['sandbox', 'Bubblewrap Sandboxing & Security'],
  ]],
  ['MODELS & INFERENCE', [
    ['models', 'Frontier Providers & Resilient Routing'],
    ['mcp', 'Model Context Protocol (MCP)'],
    ['skills', 'Skills Ecosystem & Importer'],
  ]],
  ['DEVELOPER PLATFORM', [
    ['daemon', 'Persistent HTTP Daemon & Cron'],
    ['editors', 'VS Code & JetBrains (ACP v1)'],
    ['config', 'Configuration JSON Schema'],
    ['env', 'Environment Variables Reference'],
    ['memory', 'Memory, Rules & Run Traces'],
    ['plugins', 'Plugin Hooks Architecture'],
  ]],
];

export default function Docs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [toolTab, setToolTab] = useState('File & Code Editing');

  const filteredCards = DOC_CARDS.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.desc.toLowerCase().includes(searchQuery.toLowerCase())
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

          {/* 16 Category Launchers Grid */}
          <div className="grid3" style={{ marginTop: 44, marginBottom: 56 }}>
            {filteredCards.map((card, i) => {
              const IconComp = card.icon;
              return (
                <AnimatedContent key={card.title} direction={i % 2 === 0 ? "left" : "right"} delay={i * 0.03} distance={36} blur={10}>
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
                    {items.map(([id, label]) => (
                      <a
                        key={id}
                        href={`#${id}`}
                        className="doc-nav-item"
                      >
                        {label}
                      </a>
                    ))}
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
                      Mochi is designed for zero friction: choose a precompiled standalone binary, global npm distribution, or build from source with compiled Rust native acceleration.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: 'var(--ink)' }}>1-Line Fast Install</h4>
                    <div className="code-block" style={{ background: '#12111A', borderRadius: 10, padding: '16px 20px', overflowX: 'auto', marginBottom: 20 }}>
                      <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>
                        # Install precompiled single-binary (Linux x86_64 / arm64, macOS)<br />
                        curl -fsSL https://mochi.sh | sh<br /><br />
                        # Or install via npm globally<br />
                        npm install -g @mochi/agent
                      </code>
                    </div>

                    <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: 'var(--ink)' }}>Compile From Source</h4>
                    <div className="code-block" style={{ background: '#12111A', borderRadius: 10, padding: '16px 20px', overflowX: 'auto', marginBottom: 20 }}>
                      <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>
                        git clone https://github.com/xanstomper/mochi.git<br />
                        cd mochi<br />
                        npm install<br />
                        npm run build          # Builds TypeScript CLI & TUI<br />
                        npm run build:native   # Compiles zero-dep Rust accelerators into native/mochi_core<br />
                        npm test               # Runs complete 1,500+ test suite
                      </code>
                    </div>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 2: Cozy Onboarding */}
              <section id="onboarding" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">ONBOARDING</span>
                    <h2 className="doc-section-title">Cozy First-Run Setup (mochi onboard)</h2>
                    <p className="doc-section-desc">
                      One command wires up everything Mochi finds from your existing installed coding agents (Hermes, Claude Code, Cursor, Codex, Antigravity) with zero tedious key entry.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <div className="code-block" style={{ background: '#12111A', borderRadius: 10, padding: '16px 20px', overflowX: 'auto', marginBottom: 20 }}>
                      <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>
                        mochi onboard            # Interactive cozy setup with safe defaults<br />
                        mochi onboard --yes      # Accept all: providers + skills + MCPs<br />
                        mochi onboard --skip-skills --skip-mcp   # Configure API keys only<br />
                        mochi onboard --force    # Overwrite existing skills and config
                      </code>
                    </div>

                    <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10, color: 'var(--ink)' }}>What Onboarding Automatically Discovers</h4>
                    <ul style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18 }}>
                      <li><strong>Provider API Keys:</strong> Scans <code>process.env</code>, <code>./.env</code>, <code>~/.mochi/.env</code>, and <code>~/.hermes/.env</code>. Filters out placeholders and configures cross-provider failover chains.</li>
                      <li><strong>Model Assignment:</strong> Selects the optimal model per tier (fast, coding, reasoning, review). Switchable anytime with <code>/model</code>.</li>
                      <li><strong>Skills Migration:</strong> Discovers and namespaced-imports <code>SKILL.md</code> trees from Hermes, Claude, Antigravity, Cursor, and Codex.</li>
                      <li><strong>MCP Server Merging:</strong> Ingests configured MCP servers from <code>.mcp.json</code>, <code>~/.claude.json</code>, <code>~/.cursor/mcp.json</code>, and <code>~/.gemini/settings.json</code>.</li>
                      <li><strong>Editor Bridge:</strong> Verifies ACP v1 protocol connectivity for VS Code and JetBrains IDE extensions.</li>
                    </ul>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 3: CLI Reference */}
              <section id="cli" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">CLI REFERENCE</span>
                    <h2 className="doc-section-title">Command-Line Interface (30+ Commands)</h2>
                    <p className="doc-section-desc">
                      Full reference of all primary CLI subcommands, headless flags, and terminal entry points.
                    </p>
                  </div>

                  <div className="doc-table-card">
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th style={{ width: '38%' }}>Command Syntax</th>
                          <th>Behavior & Operational Mission</th>
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

              {/* Section 4: Slash Commands & 15 Themes */}
              <section id="slash" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">INTERACTIVE TUI</span>
                    <h2 className="doc-section-title">22 Slash Commands, 15 Themes & Hotkeys</h2>
                    <p className="doc-section-desc">
                      Type <code>/</code> inside the terminal UI to access full session control, git operations, model switching, and real-time themes.
                    </p>
                  </div>

                  <div className="doc-table-card">
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th style={{ width: '28%' }}>Slash Command</th>
                          <th>Interactive Action</th>
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

                  <div className="doc-table-card" style={{ padding: '24px 30px', marginTop: 24 }}>
                    <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>The 15 Built-in TUI Color Themes</h4>
                    <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 12 }}>
                      Switch instantly with <code>/theme</code> or set <code>MOCHI_THEME=&lt;name&gt;</code>:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {['cyber', 'kanagawa', 'nord', 'catppuccin', 'dracula', 'tokyonight', 'solarized', 'gruvbox', 'monokai', 'rose-pine', 'synthwave', 'aura', 'sepia', 'matrix', 'minimal'].map(t => (
                        <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'var(--purple-lighter)', color: 'var(--purple-dark)', fontWeight: 700 }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 5: 16 Specialist Roles */}
              <section id="roles" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">SWARM ARCHITECTURE</span>
                    <h2 className="doc-section-title">The 16 Specialist Roles & Swarms</h2>
                    <p className="doc-section-desc">
                      Mochi decomposes complex user objectives into directed acyclic task graphs (DAGs), assigning each subtask to specialized roles with isolated tool sets and tier budgets.
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
                              <code style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{r.tools}</code>
                            </td>
                            <td style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55 }}>{r.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 6: Native Tools */}
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
                  <div className="filter-pills" style={{ marginBottom: 20, gap: 10 }}>
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

              {/* Section 7: Rust Native Core */}
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

              {/* Section 8: Bubblewrap Sandboxing */}
              <section id="sandbox" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">SECURITY HARDENING</span>
                    <h2 className="doc-section-title">Bubblewrap Sandboxing & Secret DFA Redaction</h2>
                    <p className="doc-section-desc">
                      Unprivileged Linux namespace containerization isolates shell commands, while a native byte-scanning DFA scrubs secrets from terminal output and JSONL traces.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>Hardware Namespace Containment</h4>
                    <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 16 }}>
                      When enabled (<code>MOCHI_SANDBOX=bubblewrap</code> or <code>auto</code>), Mochi launches processes inside unprivileged Linux namespaces via Bubblewrap:
                    </p>
                    <ul style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18, marginBottom: 20 }}>
                      <li><strong>Read-Only System Filesystem:</strong> Root directory <code>/</code> is mounted read-only. System binaries are accessible for compiling, but immutable.</li>
                      <li><strong>Isolated Workspace Mount:</strong> Only the current project root is mounted read-write. Parent folders and external paths are completely hidden.</li>
                      <li><strong>tmpfs Credential Masking:</strong> Empty read-only tmpfs filesystems are mounted over <code>~/.ssh</code> and <code>~/.aws</code>, preventing private key leaks.</li>
                      <li><strong>Airgap Network Namespace:</strong> <code>--unshare-net</code> isolates the network stack during unit test execution to prevent exfiltration.</li>
                    </ul>

                    <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>10-Pattern Secret Redaction DFA</h4>
                    <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.7, margin: 0 }}>
                      A zero-overhead byte-scanning state machine redacts sensitive tokens (OpenAI <code>sk-...</code>, Anthropic <code>sk-ant-...</code>, Google <code>AIza...</code>, GitHub PATs <code>ghp_...</code>, AWS access keys, and JWT signatures) before they are written to terminal stdout, SQLite session databases, or JSONL traces.
                    </p>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 9: Frontier Model Providers */}
              <section id="models" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">MODEL ROUTER</span>
                    <h2 className="doc-section-title">Frontier Model Providers, Resilient Routing & Caching</h2>
                    <p className="doc-section-desc">
                      Hot-swap top frontier providers with multi-key pool rotation, leaky-bucket rate limiting, and 90% prompt cache discounts.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginBottom: 20 }}>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>Top Frontier Providers</h4>
                        <ul style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18 }}>
                          <li><strong>Anthropic:</strong> Claude Sonnet 5.5, Claude Opus 5.5, Claude 5 Sonnet, Claude 3.5 Haiku</li>
                          <li><strong>OpenAI:</strong> GPT-5.5 Astra, GPT-5, o5, o5-mini</li>
                          <li><strong>Google Gemini:</strong> Gemini 3.0 Ultra, Gemini 2.5 Pro, Gemini 2.5 Flash</li>
                          <li><strong>DeepSeek:</strong> DeepSeek V4 Flash, DeepSeek V3, DeepSeek R1 Reasoning</li>
                          <li><strong>Moonshot & Zhipu:</strong> Kimi k3, Kimi k2.7 Code, GLM-5.3, GLM-5.2</li>
                          <li><strong>Meta / Mistral:</strong> Llama 4, Llama 3.3 70B, Mistral Large 2</li>
                          <li><strong>Local Inference:</strong> Ollama (localhost:11434), llama.cpp (localhost:8080)</li>
                        </ul>
                      </div>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>Resilience & Rate-Throttling</h4>
                        <ul style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18 }}>
                          <li><strong>Automatic 429 Backoff:</strong> Exponential backoff honoring <code>Retry-After</code> headers without losing session state.</li>
                          <li><strong>Credential Pool Rotation:</strong> Auto-rotates alternative API keys on 401, 429, or 403 errors.</li>
                          <li><strong>Leaky-Bucket RPM Cap:</strong> <code>MOCHI_RATE_LIMIT_RPM=20</code> self-regulates swarm burst limits.</li>
                          <li><strong>3-Strike Auto-Escalation:</strong> Automatically escalates stuck tasks from fast → coding → reasoning tier.</li>
                          <li><strong>Anthropic Prompt Cache:</strong> Injects <code>cache_control: ephemeral</code> on system prompts for 90% read discount.</li>
                          <li><strong>Speculative Preflight:</strong> Opt-in cheap speculative pass committing to a sound plan before tool invocation.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 10: Persistent Daemon & ACP v1 */}
              <section id="daemon" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">DAEMON SERVICE</span>
                    <h2 className="doc-section-title">Persistent HTTP Daemon (Port 8642) & Cron Automation</h2>
                    <p className="doc-section-desc">
                      Drive Mochi remotely via REST/JSON-RPC, run scheduled background jobs, and manage persistent worker pools while offline.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <div className="code-block" style={{ background: '#12111A', borderRadius: 10, padding: '16px 20px', overflowX: 'auto', marginBottom: 20 }}>
                      <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>
                        # Launch daemon listening on 0.0.0.0:8642<br />
                        mochi daemon start --host 0.0.0.0 --port 8642<br /><br />
                        # Check daemon status and active in-flight worker count<br />
                        mochi daemon status<br /><br />
                        # Send background coding task to worker queue<br />
                        mochi daemon send "run cargo test and patch failures"<br /><br />
                        # Add a recurring maintenance job via cron syntax<br />
                        mochi daemon cron add "*/30 * * * *" "git fetch && mochi review"
                      </code>
                    </div>

                    <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>Daemon REST API Surface</h4>
                    <table className="doc-table" style={{ marginTop: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '22%' }}>Endpoint</th>
                          <th style={{ width: '12%' }}>Method</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><code>/api/v1/status</code></td>
                          <td><code>GET</code></td>
                          <td>Returns daemon version, uptime, worker pool capacity, and memory usage.</td>
                        </tr>
                        <tr>
                          <td><code>/api/v1/jobs</code></td>
                          <td><code>GET</code></td>
                          <td>Lists all queued, running, completed, and failed tasks with run metrics.</td>
                        </tr>
                        <tr>
                          <td><code>/api/v1/send</code></td>
                          <td><code>POST</code></td>
                          <td>Dispatches a new prompt or goal into the autonomous worker queue.</td>
                        </tr>
                        <tr>
                          <td><code>/api/v1/approve</code></td>
                          <td><code>POST</code></td>
                          <td>Approves a pending tool execution or checkpoint continuation.</td>
                        </tr>
                        <tr>
                          <td><code>/api/v1/cron</code></td>
                          <td><code>POST / GET</code></td>
                          <td>Schedules or queries recurring agent maintenance tasks.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 11: Editor Integrations (VS Code & JetBrains ACP) */}
              <section id="editors" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">EDITOR PROTOCOL</span>
                    <h2 className="doc-section-title">Editor Integrations: VS Code & JetBrains (ACP v1)</h2>
                    <p className="doc-section-desc">
                      Mochi speaks Agent Client Protocol v1 over stdio (<code>mochi acp</code>), powering first-party extensions for VS Code, Cursor, and JetBrains IDEs.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginBottom: 20 }}>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>VS Code Extension (editors/vscode)</h4>
                        <ul style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18 }}>
                          <li><strong>Install:</strong> <code>mochi setup vscode</code> or package <code>.vsix</code>.</li>
                          <li><strong>Send Prompt:</strong> <code>Ctrl+Alt+M</code> with selection attached as file:line fenced context.</li>
                          <li><strong>Cancel Turn:</strong> <code>Ctrl+Alt+.</code> sends notification without hanging.</li>
                          <li><strong>Modes:</strong> Toggle Plan (read-only) and Act mode with live status bar badge.</li>
                          <li><strong>Settings:</strong> <code>binaryPath</code>, <code>workspaceTrust</code>, <code>requestTimeoutMs</code>, <code>maxSessionHistory</code>.</li>
                        </ul>
                      </div>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>JetBrains Plugin (editors/jetbrains)</h4>
                        <ul style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18 }}>
                          <li><strong>Install:</strong> <code>mochi setup jetbrains</code> or build with <code>./gradlew buildPlugin</code>.</li>
                          <li><strong>Tool Window:</strong> Native tool window with status line, transcript, and input box.</li>
                          <li><strong>Context Dispatch:</strong> Right-click <em>Send Selection to Mochi</em> editor popup.</li>
                          <li><strong>Transport:</strong> <code>ProcessBuilder("mochi", "acp")</code> newline JSON-RPC client.</li>
                          <li><strong>Diagnostics:</strong> <code>mochi doctor --probe</code> verifies provider reachability for editor runs.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 12: MCP Protocol Client */}
              <section id="mcp" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">EXTERNAL INTEGRATIONS</span>
                    <h2 className="doc-section-title">Model Context Protocol (MCP) Client & DeepWiki</h2>
                    <p className="doc-section-desc">
                      Connect any stdio or Streamable-HTTP Model Context Protocol server (Postgres, GitHub, SQLite, Sentry, Brave Search) into Mochi's tool registry.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <div className="code-block" style={{ background: '#12111A', borderRadius: 10, padding: '16px 20px', overflowX: 'auto', marginBottom: 20 }}>
                      <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>
                        # Search and install MCP servers directly from the terminal<br />
                        mochi mcp search "postgres github"<br />
                        mochi mcp add "@modelcontextprotocol/server-postgres"<br /><br />
                        # Configure servers in .mochi/config.json:<br />
                        &#123;<br />
                        &nbsp;&nbsp;"mcpServers": &#123;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"postgres": &#123;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"command": "npx",<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&#125;,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"remote_tool": &#123;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"url": "https://mcp.internal.net/sse",<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"headers": &#123; "Authorization": "Bearer $&#123;AUTH_TOKEN&#125;" &#125;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&#125;<br />
                        &nbsp;&nbsp;&#125;<br />
                        &#125;
                      </code>
                    </div>

                    <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>Automatic Tool & Resource Mapping</h4>
                    <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.7, margin: 0 }}>
                      MCP tools are automatically registered into Mochi's schema as <code>serverName__toolName</code> (e.g. <code>postgres__query</code>). MCP resources are exposed via <code>serverName__resources_list</code> and <code>serverName__resources_read</code>. OAuth client credentials refresh automatically into <code>~/.mochi/mcp-oauth.json</code>.
                    </p>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 13: Configuration Schema */}
              <section id="config" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">CONFIGURATION</span>
                    <h2 className="doc-section-title">Complete Configuration File Schema</h2>
                    <p className="doc-section-desc">
                      Global configuration lives at <code>~/.config/mochi/config.json</code>, with optional repo-specific overrides in <code>.mochi/config.json</code>.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <div className="code-block" style={{ background: '#12111A', borderRadius: 10, padding: '16px 20px', overflowX: 'auto', marginBottom: 20 }}>
                      <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                        &#123;<br />
                        &nbsp;&nbsp;"model": &#123;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"provider": "anthropic",<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"apiKey": "sk-ant-...",<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"model": "claude-sonnet-5-5",<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"profiles": &#123;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"fast": "claude-5-sonnet",<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"coding": "claude-sonnet-5-5",<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"reasoning": "o5",<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"review": "claude-5-sonnet"<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&#125;,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"speculative": &#123;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"preflight": true,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"selfCritique": true<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&#125;<br />
                        &nbsp;&nbsp;&#125;,<br />
                        &nbsp;&nbsp;"safety": &#123;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"mode": "ask",             // safe | ask | auto | uncensored<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"maxIterations": 12,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"maxConcurrentAgents": 3,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"contextBudgetTokens": 32000,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"maxTokens": 150000,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"maxCostUsd": 2.00,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"maxModelCalls": 100,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"maxToolCalls": 200,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"sandbox": "auto"          // off | auto | bubblewrap<br />
                        &nbsp;&nbsp;&#125;,<br />
                        &nbsp;&nbsp;"permissions": &#123;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"read": true,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"write": true,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"shell": true,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"network": true,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"gitDestructive": false<br />
                        &nbsp;&nbsp;&#125;,<br />
                        &nbsp;&nbsp;"planMode": false<br />
                        &#125;
                      </code>
                    </div>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 14: Environment Variables */}
              <section id="env" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">ENVIRONMENT</span>
                    <h2 className="doc-section-title">Runtime Environment Variables</h2>
                    <p className="doc-section-desc">
                      Control Mochi's behavior on any machine without touching configuration files.
                    </p>
                  </div>

                  <div className="doc-table-card">
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th style={{ width: '36%' }}>Environment Variable</th>
                          <th>Behavior & Default Posture</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ENV_VARS.map(([v, desc]) => (
                          <tr key={v}>
                            <td>
                              <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--purple-dark)' }}>{v}</code>
                            </td>
                            <td style={{ fontSize: 14, color: 'var(--ink)' }}>{desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 15: Skills Ecosystem & Importer */}
              <section id="skills" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">SKILLS ECOSYSTEM</span>
                    <h2 className="doc-section-title">Skills Ecosystem & External Skill Importer</h2>
                    <p className="doc-section-desc">
                      Extend agent capabilities with standardized <code>SKILL.md</code> guides, or import entire skill trees from Hermes, Claude, and GitHub.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <div className="code-block" style={{ background: '#12111A', borderRadius: 10, padding: '16px 20px', overflowX: 'auto', marginBottom: 20 }}>
                      <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>
                        # List all registered local and bundled skills<br />
                        mochi skills<br /><br />
                        # Import external skill trees non-destructively<br />
                        mochi import-skills hermes:               # Adopts ~/.hermes/skills<br />
                        mochi import-skills github:owner/repo     # Clones and imports from GitHub<br />
                        mochi import-skills /path/to/skills       # Imports from local directory<br /><br />
                        # Import options<br />
                        mochi import-skills &lt;src&gt; --list         # Dry-run: preview discoverable skills<br />
                        mochi import-skills &lt;src&gt; --force        # Overwrite existing destination skills<br />
                        mochi import-skills &lt;src&gt; --update       # Refresh cached git clone before importing
                      </code>
                    </div>

                    <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>Origin Namespacing & Non-Destructive Imports</h4>
                    <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.7, margin: 0 }}>
                      Skill imports are non-destructive: existing skills are preserved unless <code>--force</code> is specified. Each adopted skill receives a <code>.origin</code> metadata marker tracking its upstream provenance.
                    </p>
                  </div>
                </AnimatedContent>
              </section>

              {/* Section 16: Project Memory, Rules & Traces */}
              <section id="memory" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">ENGINEERING MEMORY</span>
                    <h2 className="doc-section-title">Project Memory, Rules, Struggle-State & JSONL Traces</h2>
                    <p className="doc-section-desc">
                      Cross-session memory persistence, convention enforcement via <code>.mochi/project.md</code>, automatic loop circuit-breakers, and reproducible turn-by-turn run traces.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>.mochi/project.md Conventions</h4>
                        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 8 }}>
                          Rules defined in <code>.mochi/project.md</code> are injected directly into every turn prompt:
                        </p>
                        <ul style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18 }}>
                          <li><code>architecture.md</code>: Topology, invariants, service boundaries</li>
                          <li><code>decisions.md</code>: Architectural Decision Records (ADRs)</li>
                          <li><code>conventions.md</code>: Testing rules, linters, naming patterns</li>
                          <li><code>failures.md</code>: Historical bugs and verified regression traps</li>
                        </ul>
                      </div>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>Struggle-State Loop Circuit-Breaker</h4>
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

              {/* Section 17: Plugin Hooks Architecture */}
              <section id="plugins" className="doc-section">
                <AnimatedContent direction="bottom">
                  <div className="doc-section-head">
                    <span className="section-tag">EXTENSIBILITY</span>
                    <h2 className="doc-section-title">Plugin Hooks Architecture</h2>
                    <p className="doc-section-desc">
                      Intercept agent lifecycle events with zero-dependency TypeScript hook plugins and <code>.disabled</code> sentinel management.
                    </p>
                  </div>

                  <div className="doc-table-card" style={{ padding: '28px 32px' }}>
                    <div className="code-block" style={{ background: '#12111A', borderRadius: 10, padding: '16px 20px', overflowX: 'auto', marginBottom: 20 }}>
                      <code style={{ color: '#F3F0FF', fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>
                        mochi plugin list             # List installed hook plugins<br />
                        mochi plugin add &lt;path&gt;       # Install new hook plugin into ~/.mochi/plugins/<br />
                        mochi plugin enable &lt;name&gt;    # Enable plugin (removes .disabled sentinel)<br />
                        mochi plugin disable &lt;name&gt;   # Disable plugin (writes .disabled sentinel)<br />
                        mochi plugin validate &lt;name&gt;  # Verify plugin exports and type safety
                      </code>
                    </div>

                    <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink)' }}>Hook Lifecycle Chain</h4>
                    <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.7, margin: 0 }}>
                      Plugins register async hook callbacks for <code>preflight</code> (workspace analysis), <code>pre_tool</code> (permission vetting & argument mutation), <code>post_tool</code> (telemetry & result transformations), <code>verification</code> (custom validation runners), and <code>cleanup</code> (post-run hygiene).
                    </p>
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
