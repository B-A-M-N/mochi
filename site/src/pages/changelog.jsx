import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Footer from '../Footer.jsx';
import { AnimatedContent } from '../anim.jsx';

const CATEGORIES = [
  { id: 'all', label: 'All Releases' },
  { id: 'major', label: 'Major Milestones' },
  { id: 'perf', label: 'Performance & Rust Core' },
  { id: 'proto', label: 'Protocols & MCP' },
  { id: 'rel', label: 'Reliability & Safety' },
];

const CURATED_RELEASES = [
  {
    v: '0.20.0',
    date: 'October 2026',
    title: 'Model Context Protocol (MCP) & Dual-Engine Architecture',
    latest: true,
    major: true,
    cats: ['major', 'proto', 'perf'],
    tags: [
      { label: 'FEATURE', color: 'purple' },
      { label: 'MCP', color: 'blue' },
      { label: 'ARCHITECTURE', color: 'cyan' },
    ],
    highlights: [
      {
        title: 'Model Context Protocol (MCP) Client',
        desc: 'Native stdio Model Context Protocol client support. Connect external tools, databases, and APIs configured in .mcp.json or config.mcpServers with automatic namespace isolation.',
      },
      {
        title: 'Multi-Tier Context Digest',
        desc: 'Intermediate summarization engine between mechanical tool shrinking and full compaction. Summarizes historic context while keeping current working buffers intact.',
      },
      {
        title: 'Independent Acceptance Gate',
        desc: 'Rigorous acceptance gate that verifies filesystem state and criteria independently of the agent’s own claims before checkpointing to git.',
      },
      {
        title: 'Upgraded Model Routing Profile',
        desc: 'Upgraded coding and reasoning primary profile to high-throughput specialized models with automatic fallback recovery.',
      },
    ],
  },
  {
    v: '0.11.0',
    date: 'September 2026',
    title: 'Zero-Loop Circuit Breakers & Runtime Hardening',
    major: true,
    cats: ['major', 'rel'],
    tags: [
      { label: 'RELIABILITY', color: 'green' },
      { label: 'SECURITY', color: 'orange' },
    ],
    highlights: [
      {
        title: 'Cumulative Repeated-Tool Breaker',
        desc: 'Automatically cuts short repetitive tool calls when no working tree mutations occur, completely preventing token-draining agent loops.',
      },
      {
        title: 'Silent Provider Stall Guard',
        desc: 'Hard 3-minute provider race timer ensures silent API connection hangs cleanly fail over to healthy endpoints.',
      },
      {
        title: 'Async Hard-Bounded File Walker',
        desc: 'Re-engineered filesystem walker with depth budgets, directory exclusion, and non-blocking asynchronous traversal.',
      },
      {
        title: 'Graceful Process Cleanup',
        desc: 'Strict SIGKILL fallback ensures orphaned child tasks and build commands never block the host event loop.',
      },
    ],
  },
  {
    v: '0.10.6',
    date: 'August 2026',
    title: 'Native Rust Runtime Core & 16 Specialist Swarms',
    major: true,
    cats: ['major', 'perf', 'arch'],
    tags: [
      { label: 'RUST CORE', color: 'orange' },
      { label: 'PERFORMANCE', color: 'cyan' },
    ],
    highlights: [
      {
        title: 'Zero-Dependency Rust Core (native/mochi_core)',
        desc: 'Compiled native crate handling BPE tokenization (0.28ms / 100k chars), compaction cut planning (0.12ms), and workspace indexing (50k files in 3.8ms).',
      },
      {
        title: 'Expanded 16-Role Specialist Roster',
        desc: 'Added specialized agent profiles for DevOps, DB Admin, QA Engineer, Performance Profiler, and Data Scientist.',
      },
      {
        title: 'Formal Turn State Machine',
        desc: 'Formalized LoopStateMachine walking every execution through preflight, model inference, tool execution, and regression verification.',
      },
    ],
  },
  {
    v: '0.10.0',
    date: 'July 2026',
    title: 'Persistent Background Daemon & Agent Client Protocol',
    major: true,
    cats: ['major', 'proto'],
    tags: [
      { label: 'DAEMON', color: 'purple' },
      { label: 'PROTOCOL', color: 'blue' },
    ],
    highlights: [
      {
        title: 'Headless HTTP Daemon (Port 8642)',
        desc: 'Enables continuous execution without an attached TTY. Includes bearer token authentication and remote task resumption.',
      },
      {
        title: 'Agent Client Protocol (ACP) v1',
        desc: 'Standardized JSON-RPC stdio protocol enabling IDE extensions in VS Code, Zed, and JetBrains to drive Mochi directly.',
      },
      {
        title: 'Autonomous Cron Scheduler',
        desc: 'Persistent 5-field cron runner for recurring repository audits and automated maintenance routines.',
      },
    ],
  },
  {
    v: '0.5.2',
    date: 'June 2026',
    title: 'Standalone Native Binary Compilation',
    major: false,
    cats: ['perf'],
    tags: [
      { label: 'BINARY', color: 'cyan' },
      { label: 'ZERO-DEPS', color: 'green' },
    ],
    highlights: [
      {
        title: 'Standalone Executable Packaging',
        desc: 'Compile Mochi into a self-contained binary requiring zero Node.js, Bun, or package manager dependencies on the host system.',
      },
      {
        title: 'Tool Schema Memoization',
        desc: 'WeakMap memoization of serialized tool schemas, eliminating redundant GC pressure during extended sessions.',
      },
    ],
  },
  {
    v: '0.5.0',
    date: 'May 2026',
    title: 'Multi-Provider Failover & SQLite FTS5 Memory',
    major: false,
    cats: ['rel'],
    tags: [
      { label: 'MEMORY', color: 'purple' },
      { label: 'RELIABILITY', color: 'green' },
    ],
    highlights: [
      {
        title: 'Dynamic Provider Pool & Key Rotation',
        desc: 'Transparent key rotation across provider credentials with automatic cooldowns on 429 and rate-limit spikes.',
      },
      {
        title: 'Persistent Session Memory Store',
        desc: 'Full-text indexed transcript store allowing instant search and semantic context recall across historical projects.',
      },
    ],
  },
];

const ARCHIVE_RELEASES = [
  { v: '0.10.5', date: 'Jul 2026', sum: 'Mouse copy/paste via OSC-52, GUI guard in shell tools, bounded stream handling.' },
  { v: '0.10.4', date: 'Jul 2026', sum: 'ACP editor adapter, search_replace_multi and analyze_code native tools.' },
  { v: '0.10.3', date: 'Jun 2026', sum: 'Credential rotation pool, scheduled cron jobs, background shell tasks.' },
  { v: '0.10.2', date: 'Jun 2026', sum: 'Proportionate verification, baseline-aware check gating, instant per-file diagnostics.' },
  { v: '0.10.1', date: 'Jun 2026', sum: 'Security hardening, ReDoS sanitizer updates, credential log redacting.' },
  { v: '0.9.6', date: 'May 2026', sum: 'Mid-stream wire cancellation, concurrent team mode, structured stop reasons.' },
  { v: '0.9.5', date: 'May 2026', sum: 'Content-addressed codegraph fingerprints, sensitive credential scrubbing.' },
  { v: '0.9.4', date: 'May 2026', sum: 'Initial persistent HTTP agent daemon implementation.' },
  { v: '0.9.3', date: 'Apr 2026', sum: 'Polyglot code indexing across 7 languages, strict plan-mode enforcement.' },
  { v: '0.9.2', date: 'Apr 2026', sum: 'End-to-end integration test runner against live provider harnesses.' },
  { v: '0.9.1', date: 'Apr 2026', sum: 'Scope-aware verification working directory, safe git diff filtering.' },
  { v: '0.9.0', date: 'Mar 2026', sum: 'Verification autopsy records, failure diagnosis engine, procedural memory.' },
  { v: '0.8.0', date: 'Mar 2026', sum: 'Multi-provider failover routing, missing-tool skip handling.' },
  { v: '0.7.0', date: 'Feb 2026', sum: 'CI verification pipeline, read-only plan mode allowlist.' },
  { v: '0.6.1', date: 'Feb 2026', sum: 'Output-diff mutation detection for test runners.' },
  { v: '0.6.0', date: 'Jan 2026', sum: 'Todo planning tool, agent skills spec loader, subagent delegation.' },
  { v: '0.5.5', date: 'Jan 2026', sum: 'Internal reasoning synthesis, multi-pane terminal workspace.' },
  { v: '0.5.4', date: 'Jan 2026', sum: 'Lightweight multi-terminal integration, automated system prompts.' },
  { v: '0.5.3', date: 'Dec 2025', sum: 'Per-task efficiency benchmark suite, budget-phase-aware routing.' },
  { v: '0.5.1', date: 'Dec 2025', sum: 'Cached project rules and memory reads with size and mtime fingerprints.' },
  { v: '0.3.0', date: 'Nov 2025', sum: 'Incremental SSE stream parser, FastEventBus, dirty-region ANSI renderer.' },
  { v: '0.2.0', date: 'Nov 2025', sum: 'Agent profile definitions, budget enforcement, speculative execution.' },
  { v: '0.1.0', date: 'Oct 2025', sum: 'Initial release: core runtime, tool bus, task DAG scheduler, git checkpointing.' },
];

export default function Changelog() {
  const [activeCat, setActiveCat] = useState('all');
  const [showArchive, setShowArchive] = useState(false);

  const filteredReleases = CURATED_RELEASES.filter((r) => {
    if (activeCat === 'all') return true;
    return r.cats && r.cats.includes(activeCat);
  });

  return (
    <>
      <div className="pagehead">
        <div className="wrap">
          <div className="pagehead-inner">
            <div className="hero-badge">
              <span className="badge-glow" />
              <span className="badge-pill">RELEASE ARCHIVE</span>
              <span>31 Releases Shipped · Continuous Delivery</span>
            </div>
            <h1 className="pagehead-title">Every release, on the record.</h1>
            <p className="pagehead-lede">
              Curated product milestones, runtime hardening, and architecture upgrades. Clear technical notes without noise.
            </p>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ padding: '0 24px 80px' }}>
        {/* Category Filters */}
        <div className="changelog-filter-bar">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={'c-filter-btn' + (activeCat === c.id ? ' active' : '')}
              onClick={() => setActiveCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Curated Milestone Releases */}
        <div className="changelog-timeline">
          {filteredReleases.map((r, i) => (
            <AnimatedContent key={r.v} direction="bottom" delay={i * 0.08}>
              <div className={'release-card' + (r.latest ? ' is-latest' : '')}>
                <div className="release-card-header">
                  <div className="release-version-row">
                    <span className="release-version-tag">v{r.v}</span>
                    {r.latest && <span className="latest-pill">LATEST RELEASE</span>}
                    <span className="release-date">{r.date}</span>
                  </div>
                  <h2 className="release-title">{r.title}</h2>
                  <div className="release-tags">
                    {r.tags.map((t) => (
                      <span key={t.label} className={'tag-badge ' + t.color}>{t.label}</span>
                    ))}
                  </div>
                </div>

                <div className="release-highlights">
                  {r.highlights.map((h) => (
                    <div key={h.title} className="highlight-item">
                      <div className="highlight-bullet" />
                      <div className="highlight-content">
                        <h4 className="highlight-title">{h.title}</h4>
                        <p className="highlight-desc">{h.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedContent>
          ))}
        </div>

        {/* Collapsible Complete Archive for All 31 Releases */}
        <div className="archive-section">
          <button
            className="archive-toggle-btn"
            onClick={() => setShowArchive(!showArchive)}
          >
            <span>{showArchive ? 'Hide Historical Releases' : 'View Full Historical Archive (All 31 Releases)'}</span>
            <span className="archive-toggle-icon">{showArchive ? '▲' : '▼'}</span>
          </button>

          {showArchive && (
            <div className="archive-list">
              {ARCHIVE_RELEASES.map((ar) => (
                <div key={ar.v} className="archive-row">
                  <span className="archive-v">v{ar.v}</span>
                  <span className="archive-date">{ar.date}</span>
                  <span className="archive-sum">{ar.sum}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}

const _root = document.getElementById('root');
if (_root) createRoot(_root).render(<Changelog />);
