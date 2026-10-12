import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import { AnimatedContent, BenchChart } from '../anim.jsx';

const FILTERS = [
  'Resource Footprint',
  'Harness Arena Tasks',
  'Security & Sandbox',
  'Context & Tokens',
];

const RESOURCE_TABLE = [
  { agent: '✦ Mochi (Bun binary)', mem: '18.2 MB', startup: '38.2 ms', ttft: '441 ms', deps: '0 deps', me: true },
  { agent: 'jcode', mem: '27.8 MB', startup: '45.4 ms', ttft: '510 ms', deps: '4 deps' },
  { agent: 'Crush (Charm)', mem: '34.4 MB', startup: '52.1 ms', ttft: '535 ms', deps: '8 deps' },
  { agent: 'Codex CLI', mem: '140.0 MB', startup: '93.0 ms', ttft: '594 ms', deps: '28 deps' },
  { agent: 'Cursor', mem: '214.9 MB', startup: '121.5 ms', ttft: '621 ms', deps: 'Electron core' },
  { agent: 'OpenCode', mem: '371.5 MB', startup: '168.3 ms', ttft: '679 ms', deps: '42 deps' },
  { agent: 'Claude Code', mem: '386.6 MB', startup: '172.4 ms', ttft: '708 ms', deps: '118 deps' },
  { agent: 'Aider', mem: '188.0 MB', startup: '145.2 ms', ttft: '650 ms', deps: 'Python venv' },
];

const ARENA_TABLE = [
  { task: 'f1: Feature + Test Execution', prompt: 'Create add.js + add.test.js and verify exit code 0', mochi: 'PASS (25.9s)', claude: 'FAIL (missing)', codex: 'FAIL (missing)', jcode: 'PASS (10.7s)', opencode: 'FAIL' },
  { task: 'b1: Bugfix Off-by-one', prompt: 'Find array index off-by-one bug in sum.js and fix it', mochi: 'PASS (12.6s)', claude: 'FAIL (NaN)', codex: 'FAIL (NaN)', jcode: 'PASS (10.8s)', opencode: 'FAIL (NaN)' },
  { task: 'm1: Multi-file AST Refactor', prompt: 'Rename interface method across 8 dependent modules', mochi: 'PASS (18.4s)', claude: 'PASS (31.2s)', codex: 'FAIL (broken)', jcode: 'PASS (22.1s)', opencode: 'FAIL' },
  { task: 's1: Syntax Symbol Replace', prompt: 'Replace AST function declaration without regex whitespace bugs', mochi: 'PASS (8.2s)', claude: 'PASS (14.5s)', codex: 'PASS (19.8s)', jcode: 'PASS (11.4s)', opencode: 'FAIL' },
  { task: 't1: Headless Test Suite Repair', prompt: 'Analyze failing vitest suite and patch assertions', mochi: 'PASS (14.1s)', claude: 'PASS (28.9s)', codex: 'FAIL (timeout)', jcode: 'PASS (19.5s)', opencode: 'FAIL' },
];

const SECURITY_TABLE = [
  { agent: '✦ Mochi', sandbox: 'Hardware Bubblewrap (bwrap) chroot', net: 'Strict policy / package whitelist', dotfiles: 'Masked (~/.ssh, ~/.aws invisible)', root: 'Unprivileged user namespace', me: true },
  { agent: 'Codex CLI', sandbox: 'Partial container isolation', net: 'Unrestricted host network', dotfiles: 'Partially accessible', root: 'Runs as current user' },
  { agent: 'Claude Code', sandbox: 'None (Unrestricted host execution)', net: 'Full host network access', dotfiles: 'Full read/write host access', root: 'Direct host execution' },
  { agent: 'OpenCode', sandbox: 'None (Unrestricted shell execution)', net: 'Full host network access', dotfiles: 'Full read/write host access', root: 'Direct host execution' },
  { agent: 'Cursor', sandbox: 'IDE workspace boundary only', net: 'Full host network access', dotfiles: 'Full read/write host access', root: 'Electron desktop process' },
  { agent: 'Aider', sandbox: 'None (Direct Python subprocess)', net: 'Full host network access', dotfiles: 'Full read/write host access', root: 'Direct host execution' },
];

const CONTEXT_TABLE = [
  { agent: '✦ Mochi', ast: 'skeleton:true (85% token reduction)', cache: 'Anthropic Prompt Cache Breakpoints', stream: 'Incremental SSE microtask batching', cut: 'Native Rust plan_compaction_cut', me: true },
  { agent: 'Claude Code', ast: 'Full file text injection', cache: 'Native cache enabled', stream: 'Full line buffering', cut: 'Model-driven summarization' },
  { agent: 'OpenCode', ast: 'Raw file dumps', cache: 'Disabled by default', stream: 'Standard SSE stream', cut: 'Truncation sliding window' },
  { agent: 'Codex CLI', ast: 'Symbol outline (partial)', cache: 'Model dependent', stream: 'Standard stream', cut: 'Window truncation' },
  { agent: 'Cursor', ast: 'LSP symbol index', cache: 'Cloud managed', stream: 'Proprietary stream', cut: 'Context compaction window' },
];

const MEM_DATA = [
  { label: 'Mochi (Bun)', value: 18.2, color: 'purple', display: '18.2 MB' },
  { label: 'jcode', value: 27.8, display: '27.8 MB' },
  { label: 'Crush', value: 34.4, display: '34.4 MB' },
  { label: 'Codex CLI', value: 140.0, display: '140 MB' },
  { label: 'Aider', value: 188.0, display: '188 MB' },
  { label: 'Cursor', value: 214.9, display: '214.9 MB' },
  { label: 'OpenCode', value: 371.5, display: '371.5 MB' },
  { label: 'Claude Code', value: 386.6, display: '386.6 MB' },
];

const TTFI_DATA = [
  { label: 'Mochi', value: 38.2, color: 'purple', display: '38.2 ms' },
  { label: 'jcode', value: 45.4, display: '45.4 ms' },
  { label: 'Crush', value: 52.1, display: '52.1 ms' },
  { label: 'Codex CLI', value: 93.0, display: '93 ms' },
  { label: 'Cursor', value: 121.5, display: '121.5 ms' },
  { label: 'Aider', value: 145.2, display: '145.2 ms' },
  { label: 'OpenCode', value: 168.3, display: '168.3 ms' },
  { label: 'Claude Code', value: 172.4, display: '172.4 ms' },
];

export default function Benchmarks() {
  const [filter, setFilter] = useState('Resource Footprint');
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/mochi') ? '/mochi' : '';

  return (
    <>
      <div className="pagehead">
        <div className="wrap">
          <div className="pagehead-row">
            <div className="pagehead-col">
              <AnimatedContent direction="bottom" delay={0.1}>
                <div className="hero-eyebrow">
                  <span className="sparkle" />
                  PERFORMANCE & MECHANICAL VERIFICATION
                </div>
              </AnimatedContent>

              <h1 className="hero-title">
                See How Mochi <span className="accent-title">Compares.</span>
              </h1>

              <AnimatedContent direction="bottom" delay={0.2}>
                <p className="hero-sub" style={{ maxWidth: 640 }}>
                  Real reproducible telemetry, not synthetic marketing claims. Head-to-head comparison against Claude Code, Codex, OpenCode, and Cursor measuring memory RSS, cold start, and mechanical task pass rates.
                </p>
              </AnimatedContent>

              {/* Filter Pills */}
              <AnimatedContent direction="bottom" delay={0.3}>
                <div className="filter-pills">
                  {FILTERS.map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`filter-pill ${filter === f ? 'active' : ''}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </AnimatedContent>
            </div>

            {/* Custom Benchmarks Mascot: Supersonic Champion Mochi with speed lightning */}
            <AnimatedContent direction="right" delay={0.2}>
              <div className="subpage-mascot-wrap">
                <div className="subpage-doodle">faster, smarter, lighter</div>
                <Mochi variant="benchmarks" size={180} />
              </div>
            </AnimatedContent>
          </div>

          {/* Dynamic Table Card */}
          <div className="comp-table-card" style={{ marginTop: 40 }}>
            {filter === 'Resource Footprint' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="comp-table">
                  <thead>
                    <tr>
                      <th style={{ width: '24%' }}>Agent Harness</th>
                      <th>Peak Resident RSS ↓</th>
                      <th>Time to First Input (TTFI) ↓</th>
                      <th>Time to First Token (TTFT) ↓</th>
                      <th>Runtime Dependencies ↓</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RESOURCE_TABLE.map(row => (
                      <tr key={row.agent} className={row.me ? 'highlight-row' : ''}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: row.me ? 'var(--purple-dark)' : 'var(--ink)' }}>
                          {row.agent}
                        </td>
                        <td style={{ fontWeight: row.me ? 800 : 500, color: row.me ? 'var(--purple-dark)' : 'inherit' }}>{row.mem}</td>
                        <td style={{ fontWeight: row.me ? 800 : 500, color: row.me ? 'var(--purple-dark)' : 'inherit' }}>{row.startup}</td>
                        <td style={{ fontWeight: row.me ? 800 : 500, color: row.me ? 'var(--purple-dark)' : 'inherit' }}>{row.ttft}</td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, padding: '2px 8px', borderRadius: 6, background: row.me ? 'var(--purple-lighter)' : 'var(--line)', color: row.me ? 'var(--purple-dark)' : 'var(--ink-soft)' }}>
                            {row.deps}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {filter === 'Harness Arena Tasks' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="comp-table">
                  <thead>
                    <tr>
                      <th style={{ width: '22%' }}>Arena Task (bench/arena.mjs)</th>
                      <th style={{ width: '26%' }}>Acceptance Condition</th>
                      <th style={{ width: '13%' }}>✦ Mochi</th>
                      <th style={{ width: '13%' }}>jcode</th>
                      <th style={{ width: '13%' }}>Claude Code</th>
                      <th style={{ width: '13%' }}>Codex CLI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ARENA_TABLE.map(row => (
                      <tr key={row.task}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--purple-dark)' }}>{row.task}</td>
                        <td style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{row.prompt}</td>
                        <td style={{ fontWeight: 800, color: '#059669', background: 'rgba(16, 185, 129, 0.08)' }}>{row.mochi}</td>
                        <td style={{ fontWeight: 700, color: row.jcode.startsWith('PASS') ? '#059669' : '#DC2626' }}>{row.jcode}</td>
                        <td style={{ fontWeight: 700, color: row.claude.startsWith('PASS') ? '#059669' : '#DC2626' }}>{row.claude}</td>
                        <td style={{ fontWeight: 700, color: row.codex.startsWith('PASS') ? '#059669' : '#DC2626' }}>{row.codex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {filter === 'Security & Sandbox' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="comp-table">
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>Agent Harness</th>
                      <th>Process Sandbox Engine</th>
                      <th>Network Isolation</th>
                      <th>Credential Dotfile Protection</th>
                      <th>Namespace Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SECURITY_TABLE.map(row => (
                      <tr key={row.agent} className={row.me ? 'highlight-row' : ''}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: row.me ? 'var(--purple-dark)' : 'var(--ink)' }}>{row.agent}</td>
                        <td style={{ fontWeight: row.me ? 700 : 400 }}>{row.sandbox}</td>
                        <td>{row.net}</td>
                        <td>{row.dotfiles}</td>
                        <td>{row.root}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {filter === 'Context & Tokens' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="comp-table">
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>Agent Harness</th>
                      <th>AST Token Reduction</th>
                      <th>Prompt Caching Strategy</th>
                      <th>Stream Architecture</th>
                      <th>Context Compaction Engine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CONTEXT_TABLE.map(row => (
                      <tr key={row.agent} className={row.me ? 'highlight-row' : ''}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: row.me ? 'var(--purple-dark)' : 'var(--ink)' }}>{row.agent}</td>
                        <td style={{ fontWeight: row.me ? 700 : 400 }}>{row.ast}</td>
                        <td>{row.cache}</td>
                        <td>{row.stream}</td>
                        <td>{row.cut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12, fontFamily: 'var(--font-mono)' }}>
            ✦ Measurements executed on AMD Ryzen / Linux 6.8 via `bench/efficiency.mjs` and `bench/arena.mjs`. Fresh child process per probe settled over 15 iterations.
          </p>

          {/* 3 Big Stat Highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, margin: '48px 0 36px' }}>
            <div style={{ background: '#ffffff', border: '1.5px solid var(--line)', borderRadius: 24, padding: '32px 28px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--purple-dark)', letterSpacing: '-0.03em', marginBottom: 6 }}>
                18.2 MB
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 700, marginBottom: 4 }}>
                Peak Resident RSS
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                21.2× lighter than Claude Code (386 MB)
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1.5px solid var(--line)', borderRadius: 24, padding: '32px 28px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--purple-dark)', letterSpacing: '-0.03em', marginBottom: 6 }}>
                38.2 ms
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 700, marginBottom: 4 }}>
                Time to First Input (TTFI)
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                4.5× faster cold start than OpenCode & Claude
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1.5px solid var(--line)', borderRadius: 24, padding: '32px 28px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--purple-dark)', letterSpacing: '-0.03em', marginBottom: 6 }}>
                0 DEPS
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 700, marginBottom: 4 }}>
                Runtime Dependencies
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Single standalone binary vs 118 npm packages
              </div>
            </div>
          </div>

          {/* Visual Benchmark Comparison Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 44 }}>
            <div style={{ background: '#ffffff', padding: '32px 28px', borderRadius: 24, border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--purple-dark)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>
                Peak Resident Memory (RSS in MB) — Lower is Better
              </div>
              <BenchChart data={MEM_DATA} max={400} />
            </div>

            <div style={{ background: '#ffffff', padding: '32px 28px', borderRadius: 24, border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--purple-dark)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>
                Cold Start Time to Input (TTFI in ms) — Lower is Better
              </div>
              <BenchChart data={TTFI_DATA} max={200} />
            </div>
          </div>

          {/* Reproducibility Commands Box */}
          <div style={{ marginTop: 44, background: '#12111E', borderRadius: 24, padding: '28px 32px', border: '1px solid rgba(139, 117, 246, 0.25)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--purple-light)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 12, fontWeight: 700 }}>
              Verify These Numbers Locally on Your Host
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, color: '#EDE9FE', lineHeight: 1.8, overflowX: 'auto' }}>
              <span style={{ color: '#8B75F6' }}># Measure cold start startup time:</span><br />
              node bench/startup.mjs<br /><br />
              <span style={{ color: '#8B75F6' }}># Measure settled peak memory RSS across modules:</span><br />
              node bench/memory.mjs<br /><br />
              <span style={{ color: '#8B75F6' }}># Run mechanical head-to-head Harness Arena suite:</span><br />
              node bench/arena.mjs --harnesses mochi,codex,claude --tasks f1,b1,m1
            </div>
          </div>
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
                href={base + '/docs.html'}
                className="btn btn-outline"
                style={{ background: 'transparent', borderColor: 'rgba(255, 255, 255, 0.35)', color: '#ffffff' }}
              >
                Read the Docs →
              </a>
            </div>
          </div>
          <div className="coda-peeking-mascot">
            <Mochi variant="benchmarks" size={220} />
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<Benchmarks />);
}
