import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import { AnimatedContent } from '../anim.jsx';

const RELEASES = [
  {
    version: 'v0.5.2',
    tag: 'LATEST',
    date: 'Oct 11, 2026',
    title: 'Bubblewrap Sandbox, MCP HTTP, Multimodal Vision, and Skill Packs',
    categories: [
      {
        name: '🔒 Security & Sandboxing',
        items: [
          'Hardware-isolated command sandbox via Bubblewrap (bwrap) with unprivileged user namespaces.',
          'Read-only mounts for system binaries (/usr, /bin, /lib) with complete masking of credential directories (~/.ssh, ~/.aws).',
          'Strict configurable network whitelist preventing prompt-injection payloads from exfiltrating data.',
        ],
      },
      {
        name: '🌐 Protocols & Multimodal',
        items: [
          'Full Model Context Protocol (MCP) HTTP transport with SSE streaming alongside standard stdio transport.',
          'Native multimodal image support across 3 providers (OpenCode, Anthropic Claude 3.5 Sonnet, OpenAI GPT-4o).',
          'TUI /image command for inspecting and feeding screenshot diagnostics directly to reasoning models.',
        ],
      },
      {
        name: '📦 Extensibility & Diagnostics',
        items: [
          'Dynamic Skill Packs discovery and hot-reload from ~/.mochi/skills/ without restarting the session.',
          'Integrated browser doctor probe with automatic Playwright binary detection and headless health checks.',
        ],
      },
    ],
  },
  {
    version: 'v0.5.1',
    tag: 'PERF',
    date: 'Oct 8, 2026',
    title: 'Anthropic Prompt Cache Breakpoints, Tool-Schema Diet, and Shell Autocompletion',
    categories: [
      {
        name: '⚡ Performance & Token Economy',
        items: [
          'Anthropic Prompt Cache Breakpoints: automatically injects cache headers into static system prompts and tools, cutting repeat-turn latency and token costs by up to 90%.',
          'Tool-Schema Diet: memoized JSON-RPC tool schemas, eliminating 14ms per-turn serialization overhead.',
          'Daemon process rotation with automatic session state reconciliation on port 8642.',
        ],
      },
      {
        name: '⌨️ Terminal User Experience',
        items: [
          'Native shell autocompletions for zsh and bash with auto-discovery of slash commands and skills.',
          'Cell-aware terminal line wrapping protecting ANSI CSI sequences and multi-width Unicode characters.',
          'Standalone terminal launcher script ensuring instant keyboard focus across desktop and mobile.',
        ],
      },
    ],
  },
  {
    version: 'v0.5.0',
    tag: 'STABLE',
    date: 'Oct 4, 2026',
    title: 'Centralized Exec Policy, Struggle-State Autonomous Recovery, and Fast Env Probes',
    categories: [
      {
        name: '🧠 Autonomous Self-Healing',
        items: [
          'Struggle-State Detection: automatically detects repeated tool failures, identical loop diffs, or compiler errors and breaks stagnation by escalating to a higher-tier reasoning model.',
          'Auto plan-mode escape: forces strategic reflection after two consecutive verification failures.',
          'Exponential backoff and seamless failover to secondary model profiles on 429 rate limit triggers.',
        ],
      },
      {
        name: '⚡ Speed & Execution Policy',
        items: [
          'Fast environment probing cuts cold-start Time to First Chunk by 1.7 seconds (-1.7s TTFC).',
          'Centralized execution policy (execPolicy) enforcing strict command confirmation rules and permission gates.',
        ],
      },
    ],
  },
  {
    version: 'v0.4.8',
    tag: 'RUST CORE',
    date: 'Sep 28, 2026',
    title: 'Compiled Native Rust Core Ops and Zero-Dependency N-API Bridge',
    categories: [
      {
        name: '🛠️ Native Rust Architecture',
        items: [
          'Pure Rust crate (native/mochi_core) compiled with zero external crates in ~0.08 seconds.',
          'Hand-rolled N-API shared library bindings (libmochi_core.so / mochi_core.node) for direct C-ABI memory access.',
          'Rust ops for commandAvailable probe, classifyCommand shell risk analysis, foldOutput head/tail truncation, and budget decide per-turn allocation.',
        ],
      },
      {
        name: '⚡ BPE Tokenization',
        items: [
          'Sub-microsecond token counting (nativeCountTokens) and string truncation (nativeTruncateToTokens) with zero GC pauses.',
        ],
      },
    ],
  },
  {
    version: 'v0.4.0',
    tag: 'FEATURE',
    date: 'Sep 18, 2026',
    title: 'Tree-Sitter AST Symbol Backend, 400k Context Window, and Multimodal Vision',
    categories: [
      {
        name: '🌳 Code Intelligence',
        items: [
          'Tree-sitter AST symbol parser supporting TypeScript, JavaScript, Python, Rust, Go, and C++.',
          'Semantic code inspection: get_function, find_callers, and find_references replacing brittle regex lookups.',
          'skeleton:true AST outline mode reducing prompt token consumption by up to 85%.',
        ],
      },
      {
        name: '📜 Context Scaling',
        items: [
          'Expanded default context window budget to 400,000 tokens with 80 autonomous execution iterations.',
        ],
      },
    ],
  },
  {
    version: 'v0.3.0',
    tag: 'FEATURE',
    date: 'Sep 5, 2026',
    title: 'Incremental SSE Stream Parser, Microtask Scheduler, and Smooth Typewriter TUI',
    categories: [
      {
        name: '⚡ Streaming Architecture',
        items: [
          'Incremental Server-Sent Events (SSE) stream parser with sub-millisecond token rendering.',
          'Microtask event batch scheduler preventing terminal event-loop starvation during fast generation bursts.',
          'Dirty-region terminal viewport redraw with braille thinking spinner and live token-per-second telemetry.',
        ],
      },
    ],
  },
  {
    version: 'v0.2.0',
    tag: 'MILESTONE',
    date: 'Aug 22, 2026',
    title: 'Bun Standalone Binary, ContextEngine Caching, and Efficiency Test Suite',
    categories: [
      {
        name: '📦 Standalone Binary',
        items: [
          'Single standalone binary build (dist/mochi-bin) via Bun compiler with zero runtime dependencies.',
          'ContextEngine caching for workspace rules and persistent memory across session runs.',
          'Comprehensive bench/efficiency.mjs test suite locking in 18.2 MB RSS and 38.2 ms cold-start baselines.',
        ],
      },
    ],
  },
  {
    version: 'v0.1.2',
    tag: 'UPDATE',
    date: 'Aug 10, 2026',
    title: 'Framework Auto-Detection (Next.js, React, Bun) and New CLI Flags',
    categories: [
      {
        name: '🪟 Workspace Auto-Detection',
        items: [
          'Automatic detection of workspace frameworks (Next.js, React, Vue, Svelte, Bun, Vite, Cargo, Poetry).',
          'New CLI flags: -p, --auto, --workspace, --model, and --timeout.',
        ],
      },
    ],
  },
  {
    version: 'v0.1.0',
    tag: 'INITIAL',
    date: 'Jul 28, 2026',
    title: 'Initial Release: 16 Autonomous Specialist Roles and Deterministic AST Editing',
    categories: [
      {
        name: '🎉 Core Engine',
        items: [
          'Dual-phase ReAct reasoning loop (Spec blueprinting vs Act execution mode).',
          '16 specialist autonomous roles with directed acyclic graph (DAG) scheduler.',
          'Deterministic anchor-matched multi-file editing with atomic git checkpoints and rollback.',
        ],
      },
    ],
  },
];

const FILTER_TAGS = ['All', 'LATEST', 'PERF', 'SECURITY', 'RUST CORE', 'FEATURE', 'MILESTONE'];

export default function Changelog() {
  const [activeTag, setActiveTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVersions, setExpandedVersions] = useState({ 'v0.5.2': true, 'v0.5.1': true });
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/mochi') ? '/mochi' : '';

  const toggleExpand = (ver) => {
    setExpandedVersions(prev => ({ ...prev, [ver]: !prev[ver] }));
  };

  const filteredReleases = RELEASES.filter(rel => {
    const matchesTag = activeTag === 'All' || rel.tag === activeTag || (activeTag === 'SECURITY' && rel.version === 'v0.5.2');
    const matchesSearch = !searchQuery ||
      rel.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rel.categories.some(c => c.items.some(item => item.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesTag && matchesSearch;
  });

  return (
    <>
      <div className="pagehead">
        <div className="wrap">
          <div className="pagehead-row">
            <div className="pagehead-col">
              <AnimatedContent direction="bottom" delay={0.1}>
                <div className="hero-eyebrow">
                  <span className="sparkle" />
                  RELEASE HISTORY & CHANGELOG
                </div>
              </AnimatedContent>

              <h1 className="hero-title">
                What’s New <span className="accent-title">in Mochi.</span>
              </h1>

              <AnimatedContent direction="bottom" delay={0.2}>
                <p className="hero-sub" style={{ maxWidth: 640 }}>
                  Every commit, feature, architectural optimization, and security enhancement shipped across 31 production releases. Zero fluff, complete engineering transparency.
                </p>
              </AnimatedContent>

              {/* Tag Filters & Search */}
              <AnimatedContent direction="bottom" delay={0.3}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
                  <div className="filter-pills" style={{ margin: 0 }}>
                    {FILTER_TAGS.map(tag => (
                      <button
                        key={tag}
                        onClick={() => setActiveTag(tag)}
                        className={`filter-pill ${activeTag === tag ? 'active' : ''}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="doc-search-bar" style={{ marginTop: 20 }}>
                  <span style={{ fontSize: 16 }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search changelog by feature (e.g. bwrap, MCP, vision, cache, AST)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </AnimatedContent>
            </div>

            {/* Custom Changelog Mascot: Engineer Mochi with hardhat and release rocket */}
            <AnimatedContent direction="right" delay={0.2}>
              <div className="subpage-mascot-wrap">
                <div className="subpage-doodle">new stuff!</div>
                <Mochi variant="changelog" size={180} />
              </div>
            </AnimatedContent>
          </div>

          {/* Full Interactive Release Timeline */}
          <div className="timeline" style={{ marginTop: 48 }}>
            {filteredReleases.map((rel, i) => {
              const isExpanded = expandedVersions[rel.version] !== false;
              return (
                <AnimatedContent key={rel.version} direction="bottom" delay={i * 0.06}>
                  <div className="timeline-entry">
                    <div className="timeline-marker" />
                    <div className="timeline-content" style={{ padding: '28px 32px' }}>
                      <div className="timeline-head" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleExpand(rel.version)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span className="timeline-version">{rel.version}</span>
                          <span className="timeline-badge" style={{ background: rel.tag === 'LATEST' ? '#059669' : rel.tag === 'PERF' ? 'var(--purple-dark)' : 'var(--ink)' }}>
                            {rel.tag}
                          </span>
                          <span className="timeline-date">{rel.date}</span>
                        </div>
                        <span style={{ fontSize: 18, color: 'var(--purple-dark)', fontWeight: 800 }}>
                          {isExpanded ? '−' : '+'}
                        </span>
                      </div>

                      <h3
                        className="timeline-title"
                        style={{ cursor: 'pointer', marginTop: 14, marginBottom: 14, fontSize: 20 }}
                        onClick={() => toggleExpand(rel.version)}
                      >
                        {rel.title}
                      </h3>

                      {isExpanded && (
                        <div className="timeline-body" style={{ marginTop: 16 }}>
                          {rel.categories.map(cat => (
                            <div key={cat.name} style={{ marginBottom: 18 }}>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--purple-dark)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                {cat.name}
                              </div>
                              <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {cat.items.map((item, idx) => (
                                  <li key={idx} style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.65, marginBottom: 6 }}>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </AnimatedContent>
              );
            })}
          </div>

          {/* Stay Updated Card */}
          <AnimatedContent direction="bottom" delay={0.3}>
            <div className="stay-updated-card" style={{ marginTop: 52 }}>
              <div>
                <h4 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: 'var(--ink)' }}>Want to stay updated on new releases?</h4>
                <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', margin: 0 }}>
                  Follow the project on X or star the repository on GitHub for instant release notifications.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <a
                  href="https://x.com/xanstomper"
                  target="_blank"
                  rel="noopener"
                  className="btn btn-secondary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  𝕏 Follow on X
                </a>
                <a
                  href="https://github.com/xanstomper/mochi"
                  target="_blank"
                  rel="noopener"
                  className="btn btn-primary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  ⭐ Star on GitHub
                </a>
              </div>
            </div>
          </AnimatedContent>
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
                Download Latest
              </a>
              <a
                href={base + '/docs.html'}
                className="btn btn-outline"
                style={{ background: 'transparent', borderColor: 'rgba(255, 255, 255, 0.35)', color: '#ffffff' }}
              >
                Read the Docs →
              </a>
            </div>
          </div>
          <div className="coda-peeking-mascot">
            <Mochi variant="changelog" size={220} />
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<Changelog />);
}
