import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import { AnimatedContent } from '../anim.jsx';
import { IconSearch, IconCheck, IconTerminal, IconShield, IconRocket } from '../icons.jsx';

const RELEASES = [
  {
    version: 'v0.5.2',
    tag: 'LATEST',
    date: 'Oct 11, 2026',
    title: 'Bubblewrap Sandbox, MCP HTTP, Multimodal Vision, and Skill Packs',
    categories: [
      {
        name: 'SECURITY & SANDBOXING',
        items: [
          'Hardware-isolated command sandbox via Bubblewrap (bwrap) with unprivileged user namespaces.',
          'Read-only mounts for system binaries (/usr, /bin, /lib) with complete masking of credential directories (~/.ssh, ~/.aws).',
          'Strict configurable network whitelist preventing prompt-injection payloads from exfiltrating data.',
        ],
      },
      {
        name: 'PROTOCOLS & MULTIMODAL',
        items: [
          'Full Model Context Protocol (MCP) HTTP transport with SSE streaming alongside standard stdio transport.',
          'Native multimodal image support across 3 providers (OpenCode, Anthropic Claude 3.5 Sonnet, OpenAI GPT-4o).',
          'TUI /image command for inspecting and feeding screenshot diagnostics directly to reasoning models.',
        ],
      },
      {
        name: 'EXTENSIBILITY & DIAGNOSTICS',
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
        name: 'PERFORMANCE & TOKEN ECONOMY',
        items: [
          'Anthropic Prompt Cache Breakpoints: automatically injects cache headers into static system prompts and tools, cutting repeat-turn latency and token costs by up to 90%.',
          'Tool-Schema Diet: memoized JSON-RPC tool schemas, eliminating 14ms per-turn serialization overhead.',
          'Daemon process rotation with automatic session state reconciliation on port 8642.',
        ],
      },
      {
        name: 'TERMINAL USER EXPERIENCE',
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
        name: 'AUTONOMOUS SELF-HEALING',
        items: [
          'Struggle-State Detection: automatically detects repeated tool failures, identical loop diffs, or compiler errors and breaks stagnation by escalating to a higher-tier reasoning model.',
          'Auto plan-mode escape: forces strategic reflection after two consecutive verification failures.',
          'Exponential backoff and seamless failover to secondary model profiles on 429 rate limit triggers.',
        ],
      },
      {
        name: 'SPEED & EXECUTION POLICY',
        items: [
          'Fast environment probing cuts cold-start Time to First Chunk by 1.7 seconds (-1.7s TTFC).',
          'Centralized execution policy (execPolicy) enforcing strict command confirmation rules and permission gates.',
        ],
      },
    ],
  },
  {
    version: 'v0.4.9',
    tag: 'RUST CORE',
    date: 'Sep 28, 2026',
    title: 'Compiled Native Rust Core Ops and Zero-Dependency N-API Bridge',
    categories: [
      {
        name: 'NATIVE RUST ARCHITECTURE',
        items: [
          'Pure Rust crate (native/mochi_core) compiled with zero external crates in ~0.08 seconds.',
          'Hand-rolled N-API shared library bindings (libmochi_core.so / mochi_core.node) for direct C-ABI memory access.',
          'Rust ops for commandAvailable probe, classifyCommand shell risk analysis, foldOutput head/tail truncation, and budget decide per-turn allocation.',
        ],
      },
      {
        name: 'FAST ANSI PROCESSING',
        items: [
          'nativeStripAnsi op: full CSI escape sequence filtering executed in compiled machine code with sub-microsecond throughput.',
        ],
      },
    ],
  },
  {
    version: 'v0.4.8',
    tag: 'FEATURE',
    date: 'Sep 22, 2026',
    title: '400k Context Window Budget, Multimodal Parts, and Expanded Test Suite',
    categories: [
      {
        name: 'CONTEXT SCALING',
        items: [
          'Expanded default context window budget to 400,000 tokens with 80 autonomous execution iterations.',
          'Multimodal content parts mapping for structured tool responses.',
          '1,428 core tests passing with zero skipped assertions.',
        ],
      },
    ],
  },
  {
    version: 'v0.4.7',
    tag: 'RUST CORE',
    date: 'Sep 15, 2026',
    title: 'Native Stream Assembly and Whole-History Stdio Token Estimation',
    categories: [
      {
        name: 'STREAM ASSEMBLY',
        items: [
          'Native Rust accum stream assembly (Map-fold in Rust for chat), eliminating JSON array syntax corruption.',
          'Batch tokens op over stdio for whole-history token estimation in a single round-trip (estimateTokensAsync).',
        ],
      },
    ],
  },
  {
    version: 'v0.4.6',
    tag: 'PERF',
    date: 'Sep 8, 2026',
    title: 'Local Heuristic Review and Named Skill-Source Registry',
    categories: [
      {
        name: 'PIPELINE SPEED',
        items: [
          'Local heuristic review replacing model rounds for simple script tasks (cuts task time by 65%).',
          'isSimpleScriptTask auto-runs requested command after edit batches (arena b1 finding).',
          'Named skill-source registry (MCH-94) in ~/.mochi/skills/.',
        ],
      },
    ],
  },
  {
    version: 'v0.4.0',
    tag: 'MILESTONE',
    date: 'Aug 24, 2026',
    title: 'Spec/Act Dual-Engine Separation, Tree-sitter AST, and SQLite Engine',
    categories: [
      {
        name: 'CORE ARCHITECTURE',
        items: [
          'Spec and Act dual-engine architecture separating task blueprinting from atomic file execution.',
          'Tree-sitter semantic symbol extraction and unified patch applicator.',
          'Zero-loss SQLite checkpoint engine with instantaneous rollback capabilities.',
        ],
      },
    ],
  },
  {
    version: 'v0.3.0',
    tag: 'FEATURE',
    date: 'Aug 15, 2026',
    title: '16 Specialist Roles, DAG Task Scheduler, and Ripgrep Search',
    categories: [
      {
        name: 'MULTI-AGENT SWARMS',
        items: [
          '16 specialist autonomous roles with directed acyclic graph (DAG) scheduler.',
          'Ripgrep-accelerated sub-millisecond keyword and regex search engine.',
        ],
      },
    ],
  },
  {
    version: 'v0.2.0',
    tag: 'MILESTONE',
    date: 'Aug 1, 2026',
    title: 'Bun Standalone Binary, Zero Dependencies, and Efficiency Suite',
    categories: [
      {
        name: 'STANDALONE BINARY',
        items: [
          'Single standalone binary build (dist/mochi-bin) via Bun compiler with zero runtime dependencies.',
          'Locked-in 18.2 MB RSS and 38.2 ms cold-start baselines in bench/efficiency.mjs.',
        ],
      },
    ],
  },
  {
    version: 'v0.1.0',
    tag: 'INITIAL',
    date: 'Jul 15, 2026',
    title: 'Initial Open-Source Release',
    categories: [
      {
        name: 'CORE ENGINE',
        items: [
          'Initial public release with terminal REPL, multi-provider model routing, and deterministic tool suite.',
        ],
      },
    ],
  },
];

const FILTER_TAGS = ['All', 'LATEST', 'PERF', 'SECURITY', 'RUST CORE', 'FEATURE', 'MILESTONE'];

export default function Changelog() {
  const [activeTag, setActiveTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVersions, setExpandedVersions] = useState({ 'v0.5.2': true, 'v0.5.1': true, 'v0.5.0': true });
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
                  Every commit, architectural optimization, native Rust op, and security enhancement shipped across production releases. Zero fluff, complete engineering transparency.
                </p>
              </AnimatedContent>

              {/* Tag Filters & Search */}
              <AnimatedContent direction="bottom" delay={0.3}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
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
                  <IconSearch size={18} className="text-muted" />
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
                <Mochi variant="changelog" size={360} />
              </div>
            </AnimatedContent>
          </div>

          {/* Full Interactive Release Timeline */}
          <div className="timeline" style={{ marginTop: 48, maxWidth: 960, margin: '48px auto 0' }}>
            {filteredReleases.map((rel, i) => {
              const isExpanded = expandedVersions[rel.version] !== false;
              return (
                <AnimatedContent key={rel.version} direction="bottom" delay={i * 0.05}>
                  <div className="timeline-entry" style={{ marginBottom: 28 }}>
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
                        <span style={{ fontSize: 20, color: 'var(--purple-dark)', fontWeight: 800 }}>
                          {isExpanded ? '−' : '+'}
                        </span>
                      </div>

                      <h3
                        className="timeline-title"
                        style={{ cursor: 'pointer', marginTop: 14, marginBottom: 14, fontSize: 20, fontWeight: 800 }}
                        onClick={() => toggleExpand(rel.version)}
                      >
                        {rel.title}
                      </h3>

                      {isExpanded && (
                        <div className="timeline-body" style={{ marginTop: 18 }}>
                          {rel.categories.map(cat => (
                            <div key={cat.name} style={{ marginBottom: 20 }}>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--purple-dark)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                                {cat.name}
                              </div>
                              <ul style={{ margin: 0, paddingLeft: 20 }}>
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
          <AnimatedContent direction="bottom" delay={0.2}>
            <div className="stay-updated-card" style={{ marginTop: 52, maxWidth: 960, margin: '52px auto 0' }}>
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
                  className="btn btn-primary"
                >
                  Follow @xanstomper
                </a>
                <a
                  href="https://github.com/xanstomper/mochi"
                  target="_blank"
                  rel="noopener"
                  className="btn btn-secondary"
                >
                  Star on GitHub
                </a>
              </div>
            </div>
          </AnimatedContent>
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
