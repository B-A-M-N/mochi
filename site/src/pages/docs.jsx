import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import { AnimatedContent } from '../anim.jsx';

const DOC_CARDS = [
  { icon: '🚀', title: 'Quick Start', desc: 'Get up and running in minutes with our simple setup guide.', link: '#install' },
  { icon: '🪟', title: 'Installation', desc: 'Step-by-step installation instructions for all platforms.', link: '#install' },
  { icon: '🎚️', title: 'Configuration', desc: 'Customize Mochi to fit your workflow and project rules.', link: '#cli' },
  { icon: '📄', title: 'API Reference', desc: 'Complete API documentation, daemon endpoints, and examples.', link: '#daemon' },
  { icon: '💡', title: 'Tutorials', desc: 'Learn through hands-on examples, agent loops, and skills.', link: '#skills' },
  { icon: '❓', title: 'FAQ', desc: 'Common questions, model switches, and troubleshooting.', link: '#safety' },
];

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
  ['frontend', 'coding', 'UI components, Tailwind/CSS, responsive layouts, web flow'],
  ['backend', 'coding', 'REST/GraphQL/gRPC APIs, microservices, concurrency'],
  ['performance', 'reasoning', 'Hotspot profiling, memory leak detection, Big-O optimization'],
];

const TOOLS = {
  'Editing': [
    ['edit', 'anchor-matched, whitespace-tolerant multi-file editing'],
    ['patch', 'multi-file *** Begin Patch unified diff applicator'],
    ['write', 'atomic create or overwrite files'],
    ['delete', 'safe removal of files and directories'],
    ['replace_symbol', 'AST-driven whole-symbol and function rewrite'],
  ],
  'Code intelligence': [
    ['get_function', 'extract a function or method by name via AST'],
    ['find_callers', 'reverse call graph traversal across project'],
    ['find_references', 'all usages and symbol occurrences'],
    ['read', 'with skeleton:true → AST outline, 85% token reduction'],
  ],
  'Execution': [
    ['shell', 'sandboxed command execution with background jobs'],
    ['search', 'ripgrep accelerated sub-millisecond keyword search'],
    ['glob', 'asynchronous, hard-bounded file pattern matching'],
  ],
  'Agent state': [
    ['git', 'atomic checkpoints and zero-loss rollback'],
    ['memory', 'persistent engineering memory across runs'],
    ['skill', 'dynamic SKILL.md runtime loading and injection'],
    ['subagent', 'spawn any of 16 specialized roles concurrently'],
  ],
};

const SIDEBAR = [
  ['Get started', [['install', 'Installation'], ['first-run', 'First run'], ['cli', 'CLI reference']]],
  ['Core concepts', [['architecture', 'Architecture'], ['roles', 'Agent roles'], ['tools', 'Native tools'], ['skills', 'Skills runtime'], ['mcp-acp', 'MCP & ACP'], ['daemon', 'Daemon API'], ['safety', 'Permissions & safety']]],
  ['External', [['https://github.com/xanstomper/mochi', 'GitHub Repo ↗'], ['https://github.com/xanstomper/mochi/blob/main/docs/ARCHITECTURE.md', 'Architecture Blueprint ↗'], ['https://github.com/xanstomper/mochi/releases', 'Release Binaries ↗']]],
];

export default function Docs() {
  const [toolTab, setToolTab] = useState('Editing');
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
                <p className="lede">
                  Everything you need to get started, from quickstart guides to advanced configuration, all in one place.
                </p>
              </AnimatedContent>

              {/* Search bar matching Image 2 Panel 2 */}
              <AnimatedContent direction="bottom" delay={0.3}>
                <div className="doc-search-bar">
                  <span style={{ fontSize: 16 }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search docs..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  <span className="doc-search-badge">⌘ K</span>
                </div>
              </AnimatedContent>
            </div>

            {/* Mascot with "easy setup!" doodle */}
            <AnimatedContent direction="right" delay={0.2}>
              <div className="subpage-mascot-wrap">
                <div className="subpage-doodle">easy setup!</div>
                <Mochi size={140} />
              </div>
            </AnimatedContent>
          </div>

          {/* 6-Card Grid matching Image 2 Panel 2 */}
          <div className="grid3" style={{ marginTop: 44, marginBottom: 48 }}>
            {filteredCards.map((c, i) => (
              <AnimatedContent key={c.title} direction="bottom" delay={i * 0.06}>
                <a href={c.link} className="card">
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

      {/* Main Documentation Content Layout */}
      <div className="wrap" style={{ paddingBottom: 60 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 48, alignItems: 'start' }}>
          {/* Sidebar */}
          <aside style={{ position: 'sticky', top: 100, background: '#ffffff', borderRadius: 20, padding: '24px 20px', border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
            {SIDEBAR.map(([cat, links]) => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <h5 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--purple-dark)', marginBottom: 10, fontWeight: 700 }}>
                  {cat}
                </h5>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {links.map(([target, label]) => (
                    <li key={target} style={{ marginBottom: 6 }}>
                      <a
                        href={target.startsWith('http') ? target : `#${target}`}
                        target={target.startsWith('http') ? '_blank' : undefined}
                        rel={target.startsWith('http') ? 'noopener' : undefined}
                        style={{
                          fontSize: 13.5,
                          color: 'var(--ink-soft)',
                          textDecoration: 'none',
                          display: 'block',
                          padding: '4px 8px',
                          borderRadius: 6,
                          transition: 'all .15s',
                        }}
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>

          {/* Docs Sections */}
          <main style={{ minWidth: 0 }}>
            {/* Install */}
            <section id="install" style={{ marginBottom: 48, background: '#ffffff', borderRadius: 24, padding: 36, border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="section-tag" style={{ marginBottom: 16 }}>
                <span className="sparkle" />
                INSTALLATION
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, color: 'var(--ink)' }}>
                Zero-Dependency Setup
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15, marginBottom: 20, lineHeight: 1.7 }}>
                Mochi is distributed as a single native binary compiled with Bun and a zero-dependency Rust core. No Node.js runtime, Python, or node_modules are required on your host.
              </p>
              <div style={{ background: '#161426', borderRadius: 16, padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, color: '#EDE9FE', marginBottom: 16, overflowX: 'auto' }}>
                <span style={{ color: 'var(--purple)' }}># One-line universal installer:</span><br />
                curl -fsSL https://raw.githubusercontent.com/xanstomper/mochi/main/install.sh | bash
              </div>
              <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
                Or compile directly from source: <code style={{ background: 'var(--purple-lighter)', color: 'var(--purple-dark)', padding: '2px 8px', borderRadius: 6 }}>git clone https://github.com/xanstomper/mochi && bun install && bun run build:bin</code>
              </p>
            </section>

            {/* CLI Reference */}
            <section id="cli" style={{ marginBottom: 48, background: '#ffffff', borderRadius: 24, padding: 36, border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="section-tag" style={{ marginBottom: 16 }}>
                <span className="sparkle" />
                COMMAND LINE INTERFACE
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, color: 'var(--ink)' }}>
                CLI Commands & Flags
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15, marginBottom: 20, lineHeight: 1.7 }}>
                Mochi runs seamlessly from any terminal window or can be driven programmatically via its daemon API.
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                {[
                  ['mochi "prompt"', 'Run a prompt in interactive flow with the default coding model.'],
                  ['mochi -p --auto "prompt"', 'Autonomous head-less execution without confirmation prompts.'],
                  ['mochi --model deepseek-v4-flash', 'Specify model override (OpenCode, Anthropic, OpenAI, Ollama).'],
                  ['mochi daemon start', 'Start persistent background daemon on port 8642 for external hooks.'],
                  ['mochi bench', 'Run local TTFI, TTFT, and RSS telemetry suite against local baselines.'],
                ].map(([cmd, desc]) => (
                  <div key={cmd} style={{ padding: '14px 18px', background: 'var(--bg-soft)', borderRadius: 14, border: '1px solid var(--line)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--purple-dark)', marginBottom: 4 }}>
                      {cmd}
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>
                      {desc}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 16 Agent Roles */}
            <section id="roles" style={{ marginBottom: 48, background: '#ffffff', borderRadius: 24, padding: 36, border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="section-tag" style={{ marginBottom: 16 }}>
                <span className="sparkle" />
                SPECIALIZATION
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, color: 'var(--ink)' }}>
                16 Autonomous Agent Roles
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15, marginBottom: 20, lineHeight: 1.7 }}>
                Mochi splits complex objectives across 16 specialized roles rather than running one generalist model in an unbounded loop.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table className="comp-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Specialty Tier</th>
                      <th>Core Responsibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLES.map(([name, tier, desc]) => (
                      <tr key={name}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--purple-dark)' }}>{name}</td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--purple-lighter)', color: 'var(--purple-dark)' }}>
                            {tier}
                          </span>
                        </td>
                        <td>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Native Tools */}
            <section id="tools" style={{ marginBottom: 48, background: '#ffffff', borderRadius: 24, padding: 36, border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="section-tag" style={{ marginBottom: 16 }}>
                <span className="sparkle" />
                DETERMINISTIC TOOLS
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, color: 'var(--ink)' }}>
                Deterministic Tool Suite
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15, marginBottom: 20, lineHeight: 1.7 }}>
                Tools execute in sub-millisecond Rust and native N-API shims, saving context tokens and eliminating runtime hallucinations.
              </p>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {Object.keys(TOOLS).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setToolTab(tab)}
                    className={`filter-pill ${toolTab === tab ? 'active' : ''}`}
                    style={{ padding: '6px 16px', fontSize: 12.5 }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {TOOLS[toolTab].map(([tool, desc]) => (
                  <div key={tool} style={{ padding: '12px 18px', background: 'var(--bg-soft)', borderRadius: 12, border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--purple-dark)' }}>
                      {tool}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* Dark CTA Banner matching Image 2 Panel 5 */}
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
                href={base + '/source.html'}
                className="btn btn-outline"
                style={{ background: 'transparent', borderColor: 'rgba(255, 255, 255, 0.35)', color: '#ffffff' }}
              >
                Explore Source Code →
              </a>
            </div>
          </div>
          <div className="coda-peeking-mascot">
            <Mochi size={220} />
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
