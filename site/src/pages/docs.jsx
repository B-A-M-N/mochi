import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Footer from '../Footer.jsx';
import { AnimatedContent, Reveal } from '../anim.jsx';

const SKILLS = {
  'AI Architectures & Protocols': ['gpt-5-agent', 'o3-reasoning', 'deep-research', 'anthropic-research', 'cursor-workflow', 'devin-mode', 'github-copilot', 'vscode-copilot', 'gemini-learning', 'claude-design', 'hermes-workflow'],
  'System Integration': ['mcp-setup', 'acp-setup', 'mochi-architecture', 'core-harness', 'tools-design', 'memory-design', 'replication-design'],
  'Domain Engineering': ['rust-engineer', 'golang-pro', 'python-expert', 'typescript-master', 'frontend-craft', 'backend-architecture', 'docker-containerization', 'database-optimizer', 'performance-profiling', 'security-audit', 'tdd-workflow', 'code-refactoring', 'code-review', 'api-design', 'git-wizard'],
};

const ROLES = [
  ['lead', 'reasoning', 'Decomposes goals into DAGs, coordinates swarms, resolves blockers'],
  ['coder', 'coding', 'Full-stack implementation, surgical diffs, headless test verification'],
  ['reviewer', 'review', 'Read-only PR/diff inspection, SOLID/DRY audits, edge cases'],
  ['tester', 'fast', 'Test creation, bug reproduction, suite execution'],
  ['researcher', 'fast', 'AST/call-graph traversal, doc indexing, web research'],
  ['debugger', 'reasoning', 'Root-cause diagnosis, hypothesis testing, telemetry injection'],
  ['security', 'reasoning', 'OWASP auditing, threat modeling, secret-leak detection'],
  ['architect', 'reasoning', 'API contracts, distributed trade-offs, service boundaries'],
  ['devops', 'coding', 'Dockerfiles, K8s manifests, CI/CD, Terraform'],
  ['db_admin', 'reasoning', 'Schema migrations, index design, EXPLAIN analysis'],
  ['frontend', 'coding', 'UI components and interaction logic'],
  ['backend', 'coding', 'REST/GraphQL/gRPC APIs and concurrency'],
  ['performance', 'reasoning', 'Hotspot profiling, leak detection, Big-O optimization'],
  ['tech_writer', 'coding', 'ADRs, READMEs, Mermaid diagrams, API references'],
  ['qa_engineer', 'coding', 'Playwright/Cypress E2E, visual regression, smoke tests'],
  ['data_scientist', 'reasoning', 'Pandas/Polars wrangling, PyTorch/TensorFlow modeling'],
];

const TOOLS = {
  'Editing': [['edit', 'anchor-matched, whitespace-tolerant'], ['patch', 'multi-file *** Begin Patch, refuses ambiguity'], ['write', 'create/overwrite files'], ['delete', 'remove files/dirs'], ['replace_symbol', 'AST-driven whole-symbol rewrite'], ['rename_symbol', 'project-wide atomic rename'], ['search_replace_multi', 'batch replacements'], ['regex_replace', 'regex-driven edits']],
  'Code intelligence': [['get_function', 'extract a function by name'], ['find_callers', 'reverse call graph'], ['type_hierarchy', 'resolve inheritance'], ['find_references', 'all usages of a symbol'], ['find_definitions', 'locate declarations'], ['analyze_code', 'structure/complexity report'], ['read', 'with skeleton:true → AST outline, 85% fewer tokens']],
  'Execution': [['shell', 'with background jobs'], ['repl', 'stateful Node/Python/Shell'], ['search', 'N-API accelerated, sub-millisecond'], ['glob', 'async, hard-bounded walker'], ['inspect', 'runtime introspection']],
  'Agent & state': [['git', 'checkpoints, rollback'], ['memory', 'persistent project memory'], ['todo', 'task tracking'], ['skill', 'load SKILL.md workflows'], ['subagent', 'spawn any of 16 roles']],
};

const SIDEBAR = [
  ['Get started', [['install', 'Installation'], ['first-run', 'First run'], ['cli', 'CLI reference']]],
  ['Core concepts', [['architecture', 'Architecture'], ['roles', 'Agent roles'], ['tools', 'Native tools'], ['skills', 'Skills'], ['mcp-acp', 'MCP & ACP'], ['daemon', 'Daemon API'], ['sessions', 'Sessions & traces'], ['safety', 'Permissions & safety']]],
  ['Reference', [['benchmarks.html', 'Benchmarks'], ['source.html', 'Source browser'], ['https://github.com/xanstomper/mochi/blob/main/docs/CAPABILITIES.md', 'Full capabilities ↗'], ['https://github.com/xanstomper/mochi/blob/main/docs/ARCHITECTURE.md', 'Architecture blueprint ↗']]],
];

function Docs() {
  const [toolTab, setToolTab] = useState('Editing');

  return (
    <>
      <div className="pagehead">
        <div className="wrap">
          <div className="pagehead-inner">
            <div className="hero-badge">
              <span className="badge-glow" />
              <span className="badge-pill">DOCUMENTATION</span>
              <span>Complete Architecture &amp; API Reference</span>
            </div>
            <h1 className="pagehead-title">Everything Mochi can do.</h1>
            <p className="pagehead-lede">
              Zero-dependency Rust core, 16 agent roles, 30+ skills, AST-native tooling, background daemon, and full traceability.
            </p>
          </div>
        </div>
      </div>

      <div className="wrap layout doc-layout">
        <aside className="sidebar">
          {SIDEBAR.map(([g, items]) => (
            <div className="grp" key={g}>
              <h5>{g}</h5>
              {items.map(([href, label]) => (
                <a
                  key={href}
                  href={href.startsWith('http') || href.endsWith('.html') ? href : '#' + href}
                  {...(href.startsWith('http') && { target: '_blank', rel: 'noopener' })}
                >
                  {label}
                </a>
              ))}
            </div>
          ))}
        </aside>

        <main className="doc-body">
          <div className="doc-intro">
            <h2>Overview</h2>
            <p className="lede">
              Mochi is an autonomous coding agent engineered from the ground up for the terminal. It pairs a zero-dependency Rust core with a TypeScript agent harness, 16 specialized roles, persistent SQLite FTS5 memory, and independent acceptance verification.
            </p>
          </div>

          <h2 id="install">Installation</h2>
          <Reveal as="div">
            <p>Requires Node 22+ or Bun. Mochi has zero runtime JavaScript dependencies.</p>
            <pre><code>{`# clone and build
git clone https://github.com/xanstomper/mochi.git
cd mochi
npm install && npm run build

# optional: build standalone native binary (zero runtime required)
npm run build:bin`}</code></pre>
            <p className="doc-tip">
              A memory regression gate (<code>npm run bench:memory</code>) runs in CI after every build and fails above 80 MB codegraph import / 95 MB runtime import.
            </p>
          </Reveal>

          <h2 id="first-run">First run</h2>
          <pre><code>{`# launch the interactive terminal UI
mochi

# execute a goal in one-shot headless mode
mochi "add a rate limiter to the auth service"

# orchestrate a concurrent multi-agent team
mochi team "refactor payments and add webhook tests"`}</code></pre>

          <h2 id="cli">CLI reference</h2>
          <div className="table-wrapper">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Command</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['mochi', 'Launch interactive full-screen terminal UI'],
                  ['mochi "prompt"', 'Terminal UI preloaded with an objective'],
                  ['mochi daemon start --host 0.0.0.0', 'Start persistent background daemon on port 8642'],
                  ['mochi daemon status', 'Inspect daemon status and active jobs'],
                  ['mochi daemon send "task"', 'Send a task to the running daemon without a TTY'],
                  ['mochi daemon cron add|list|remove', 'Schedule recurring autonomous tasks'],
                  ['mochi team "goal"', 'Decompose and execute across a multi-agent swarm'],
                  ['mochi trace [goalId]', 'Replay a run end to end with redaction'],
                  ['mochi session list / search "q"', 'Full-text SQLite+FTS5 historical search'],
                  ['mochi termix --sessions 3', 'Launch multi-pane terminal matrix workspace'],
                  ['mochi acp', 'Start Agent Client Protocol v1 stdio server'],
                  ['mochi doctor', 'Diagnostic health check of toolchains and environment'],
                  ['mochi skills', 'List all bundled and discovered skills'],
                  ['mochi import-skills <src>', 'Import external SKILL.md trees into ~/.mochi/skills'],
                ].map(([c, d]) => (
                  <tr key={c}>
                    <td><code>{c}</code></td>
                    <td>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 id="architecture">Architecture</h2>
          <p>Mochi runs on a dual-engine architecture designed for minimum memory and maximum determinism:</p>
          <ul className="doc-list">
            <li><strong>Rust core (<code>native/mochi_core</code>)</strong>: A zero-dependency compiled crate handling BPE tokenization (0.28 ms / 100k chars), compaction cut planning (0.12 ms on 250-turn transcripts), N-API workspace indexing (50k files in 3.8 ms), and agent loop state machines.</li>
            <li><strong>TypeScript harness</strong>: Model I/O, tool execution, TUI rendering via direct ANSI (no webview, zero Electron), persistence (SQLite + FTS5).</li>
            <li><strong>Parity fallbacks</strong>: Every native Rust capability has an identical TypeScript fallback for hermetic CI.</li>
          </ul>

          <h2 id="roles">Agent roles (16 Specialists)</h2>
          <p>Sixteen specialized subagents spawn via <code>subagent</code> or <code>mochi team</code>. Each role gets a capability profile and a scoped tool allowlist:</p>
          <div className="table-wrapper">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Profile</th>
                  <th>Responsibility</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map(([r, t, d]) => (
                  <tr key={r}>
                    <td><strong className="role-name">{r}</strong></td>
                    <td><span className="profile-pill">{t}</span></td>
                    <td>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 id="tools">Native tools</h2>
          <div className="tabrow">
            {Object.keys(TOOLS).map(t => (
              <button key={t} className={'tabbtn' + (t === toolTab ? ' on' : '')} onClick={() => setToolTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="table-wrapper">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Tool Name</th>
                  <th>Capability &amp; Behavior</th>
                </tr>
              </thead>
              <tbody>
                {TOOLS[toolTab].map(([c, d]) => (
                  <tr key={c}>
                    <td><code>{c}</code></td>
                    <td>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 id="skills">Skills</h2>
          <p>Mochi bundles 30+ <code>SKILL.md</code> workflows, invoked via the <code>skill</code> tool or command palette. Import community skills from local folders or git repos with <code>mochi import-skills</code>.</p>
          {Object.entries(SKILLS).map(([cat, list]) => (
            <div key={cat} className="skill-cat">
              <h3>{cat}</h3>
              <div className="chips">
                {list.map(s => <code key={s} className="chip">{s}</code>)}
              </div>
            </div>
          ))}

          <h2 id="mcp-acp">MCP &amp; ACP</h2>
          <p><strong>Model Context Protocol (MCP):</strong> Connect external tools and databases through standard JSON-RPC stdio. Configured in <code>~/.mochi/config.json</code>:</p>
          <pre><code>{`{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    }
  }
}`}</code></pre>
          <p><strong>Agent Client Protocol (ACP):</strong> <code>mochi acp</code> speaks ACP v1 over stdio, allowing IDEs like VS Code, JetBrains, and Zed to embed Mochi directly.</p>

          <h2 id="daemon">Daemon API</h2>
          <pre><code>{`mochi daemon start --host 0.0.0.0   # Binds API server to port 8642
mochi daemon send "run test suite"   # Submits background job
mochi daemon cron add "0 9 * * *" "triage open issues"`}</code></pre>

          <h2 id="sessions">Sessions &amp; traces</h2>
          <p>Every conversational turn and tool call is persisted into SQLite with FTS5 search. Replay any historical run using <code>mochi trace &lt;goalId&gt;</code>.</p>

          <h2 id="safety">Permissions &amp; safety</h2>
          <p>Six independent limiters prevent runaway loops: token budget, cost budget, time fence, repeated tool breaker, model rate limiter, and subagent depth guards. Destructive actions automatically checkpoint git for instant rollback.</p>
        </main>
      </div>

      <Footer />
    </>
  );
}

createRoot(document.getElementById('root')).render(<Docs />);
