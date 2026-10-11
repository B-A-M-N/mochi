import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import {
  SplitText, BlurText, AnimatedContent, CountUp,
  ScrollFloat, Magnetic, Marquee2, ScrollProgress,
} from '../anim.jsx';

const STATS = [
  ['18.2 MB', 'Resident Memory', '21.2× less than Claude Code'],
  ['38.2 ms', 'Time to First Input', '4.5× faster cold startup'],
  ['16', 'Specialist Agent Roles', 'Parallel DAG task execution'],
  ['0', 'Runtime Dependencies', 'Self-contained zero-overhead core'],
];

const FLOW = [
  {
    num: '01',
    title: 'Decompose the goal into a DAG',
    desc: 'State your goal in natural language. Mochi’s reasoning lead automatically extracts requirements, identifies file dependencies, and constructs a concurrent execution graph.',
    tag: 'DAG ORCHESTRATION',
  },
  {
    num: '02',
    title: 'Specialist swarm takes execution',
    desc: 'Sixteen focused agent roles — coder, reviewer, architect, tester, debugger — operate in parallel with AST-native surgical diff tools that prevent token-draining loops.',
    tag: 'PARALLEL SWARM',
  },
  {
    num: '03',
    title: 'Independent verification before merge',
    desc: 'Every code mutation is tested against baseline suites and independent acceptance criteria before it touches your working tree. Zero hallucinated success.',
    tag: 'REGRESSION GATE',
  },
];

function HeroSection() {
  const [copied, setCopied] = useState(false);
  const installCmd = 'npm install -g @mochi-ai/cli';

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(installCmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section className="hero" id="hero">
      <div className="hero-content">
        <AnimatedContent direction="bottom" delay={0.1}>
          <div className="hero-badge">
            <span className="badge-glow" />
            <span className="badge-pill">v0.20.0</span>
            <span className="badge-text">Autonomous Coding Agent for the Terminal</span>
            <span className="badge-arrow">→</span>
          </div>
        </AnimatedContent>

        <h1 className="hero-headline">
          <span className="headline-row">A softer kind of</span>
          <span className="headline-row headline-gradient">intelligence.</span>
        </h1>

        <AnimatedContent direction="bottom" delay={0.3}>
          <p className="hero-subhead">
            One binary. 16 specialist roles. Zero runtime dependencies. Mochi turns plain-language goals into verified, shipped code — 21× lighter than Claude Code.
          </p>
        </AnimatedContent>

        <AnimatedContent direction="bottom" delay={0.4}>
          <div className="hero-actions">
            <Magnetic strength={0.25}>
              <a href="https://github.com/xanstomper/mochi/releases" className="btn btn-primary" target="_blank" rel="noopener">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Binary
              </a>
            </Magnetic>
            <Magnetic strength={0.2}>
              <a href="./docs.html" className="btn btn-secondary">
                Read Documentation
                <span className="btn-arrow">→</span>
              </a>
            </Magnetic>
          </div>
        </AnimatedContent>

        <AnimatedContent direction="bottom" delay={0.5}>
          <div className="install-bar" onClick={handleCopy} role="button" tabIndex={0} title="Click to copy install command">
            <span className="install-prompt">$</span>
            <code className="install-code">{installCmd}</code>
            <button className="install-copy-btn" aria-label="Copy command">
              {copied ? (
                <span className="copy-success">✓ Copied</span>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>
        </AnimatedContent>

        <AnimatedContent direction="bottom" delay={0.6}>
          <div className="hero-specs-strip">
            <div className="spec-badge">
              <span className="spec-dot" />
              <span>18.2 MB Resident RAM</span>
            </div>
            <div className="spec-badge">
              <span className="spec-dot" />
              <span>38.2 ms TTFI</span>
            </div>
            <div className="spec-badge">
              <span className="spec-dot" />
              <span>Zero Dependencies</span>
            </div>
            <div className="spec-badge">
              <span className="spec-dot" />
              <span>16 Specialist Roles</span>
            </div>
          </div>
        </AnimatedContent>
      </div>

      <div className="hero-showcase">
        <AnimatedContent direction="right" delay={0.3} duration={0.8}>
          <div className="terminal-frame">
            <div className="terminal-topbar">
              <div className="terminal-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <div className="terminal-title">mochi — zsh — 80×24</div>
              <div className="terminal-topbar-actions">
                <span className="topbar-status">v0.20.0</span>
              </div>
            </div>
            <div className="terminal-body">
              <div className="t-line t-prompt">
                <span className="t-user">developer@box</span>
                <span className="t-sep">:</span>
                <span className="t-dir">~/repo</span>
                <span className="t-glyph">$</span>
                <span className="t-cmd">mochi goal "Implement auth token rotation & refresh middleware"</span>
              </div>
              <div className="t-line t-dim">Analyzing codebase topology (AST tree-sitter: 727 files · 24ms)</div>
              <div className="t-line t-step">
                <span className="t-pill t-pill-lead">[lead]</span>
                <span>Decomposed goal into 3 parallel DAG tasks:</span>
              </div>
              <div className="t-line t-dag">
                <span>  ├─ Task 1: Generate crypto token schema in <code>src/auth/token.rs</code></span>
              </div>
              <div className="t-line t-dag">
                <span>  ├─ Task 2: Implement refresh endpoint in <code>src/api/auth.rs</code></span>
              </div>
              <div className="t-line t-dag">
                <span>  └─ Task 3: Inject integration verification tests</span>
              </div>
              <div className="t-line t-step">
                <span className="t-pill t-pill-coder">[coder]</span>
                <span>Applying surgical diff to <code>src/auth/token.rs</code> (+84 lines, -2 lines)</span>
              </div>
              <div className="t-line t-step">
                <span className="t-pill t-pill-tester">[tester]</span>
                <span>Executing test runner: 48 assertions passed in 18ms</span>
              </div>
              <div className="t-line t-step">
                <span className="t-pill t-pill-verif">[verifier]</span>
                <span>Independent gate: 0 regressions · Working tree verified</span>
              </div>
              <div className="t-line t-success">
                <span className="t-check">✔</span>
                <span>Goal complete in 1.42s · 18.2 MB RSS · Checkpointed to git</span>
              </div>
            </div>
            <div className="mascot-companion">
              <Mochi size={180} />
            </div>
          </div>
        </AnimatedContent>
      </div>
    </section>
  );
}

function Ticker() {
  const items = [
    '18.2 MB RESIDENT MEMORY', '38.2 MS FIRST INPUT', '21.2× LIGHTER', '4.5× FASTER START',
    'ZERO RUNTIME DEPENDENCIES', '16 SPECIALIST AGENTS', 'AST TREE-SITTER TOOLS',
    'MODEL CONTEXT PROTOCOL (MCP)', '1200+ AUTOMATED TESTS', 'MIT LICENSED',
  ];
  return (
    <div className="stats-ticker" aria-hidden="true">
      <div className="ticker-track">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="ticker-item">
            <span className="ticker-dot" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatsSection() {
  return (
    <section className="section stats-band" id="stats">
      <div className="section-header">
        <div className="section-eyebrow">EFFICIENCY BENCHMARKS</div>
        <h2 className="section-title">Engineered for extreme performance.</h2>
        <p className="section-subtitle">
          Measured against industry agents on the exact same machine and environment. Real memory, real time-to-first-input.
        </p>
      </div>
      <div className="stats-grid">
        {STATS.map(([val, label, sub], i) => (
          <AnimatedContent key={label} direction="bottom" delay={i * 0.1}>
            <div className="stat-card">
              <div className="stat-glow" />
              <div className="stat-val">
                {val.includes('.') && !val.startsWith('38') ? (
                  <CountUp end={parseFloat(val)} decimals={1} suffix={val.replace(/[0-9.]/g, '')} />
                ) : val === '0' ? (
                  <CountUp end={0} />
                ) : val.includes('ms') ? (
                  <CountUp end={38.2} decimals={1} suffix=" ms" />
                ) : (
                  <CountUp end={parseFloat(val)} decimals={0} suffix={val.replace(/[0-9.]/g, '')} />
                )}
              </div>
              <div className="stat-label">{label}</div>
              <div className="stat-sub">{sub}</div>
            </div>
          </AnimatedContent>
        ))}
      </div>
    </section>
  );
}

function FlowSection() {
  return (
    <section className="section flow-section" id="flow">
      <div className="section-header">
        <div className="section-eyebrow">HOW MOCHI WORKS</div>
        <h2 className="section-title">Autonomous orchestration, verified delivery.</h2>
        <p className="section-subtitle">
          From high-level intent to tested, production-grade commits in three deterministic stages.
        </p>
      </div>
      <div className="flow-grid">
        {FLOW.map(({ num, title, desc, tag }, i) => (
          <AnimatedContent key={num} direction="bottom" delay={i * 0.12}>
            <div className="flow-card">
              <div className="flow-card-glow" />
              <div className="flow-header">
                <span className="flow-num">{num}</span>
                <span className="flow-tag">{tag}</span>
              </div>
              <h3 className="flow-title">{title}</h3>
              <p className="flow-desc">{desc}</p>
            </div>
          </AnimatedContent>
        ))}
      </div>
    </section>
  );
}

function BenchSection() {
  const mem = [
    { label: 'Mochi', value: 18.2, mochi: true, display: '18.2 MB' },
    { label: 'jcode', value: 27.8, display: '27.8 MB' },
    { label: 'Pi', value: 34.4, display: '34.4 MB' },
    { label: 'Codex CLI', value: 140.0, display: '140 MB' },
    { label: 'Cursor', value: 214.9, display: '214.9 MB' },
    { label: 'OpenCode', value: 371.5, display: '371.5 MB' },
    { label: 'Claude Code', value: 386.6, display: '386.6 MB' },
  ];
  const ttfi = [
    { label: 'Mochi', value: 38.2, mochi: true, display: '38.2 ms' },
    { label: 'jcode', value: 45.4, display: '45.4 ms' },
    { label: 'Pi', value: 52.1, display: '52.1 ms' },
    { label: 'Codex CLI', value: 93.0, display: '93 ms' },
    { label: 'Cursor', value: 121.5, display: '121.5 ms' },
    { label: 'OpenCode', value: 168.3, display: '168.3 ms' },
    { label: 'Claude Code', value: 172.4, display: '172.4 ms' },
  ];

  return (
    <section className="section bench-section" id="bench">
      <div className="section-header">
        <div className="section-eyebrow">HEAD-TO-HEAD COMPARISON</div>
        <h2 className="section-title">Measured on hardware. Not marketing claims.</h2>
        <p className="section-subtitle">
          Ten executions against a fixed warm cache. Same workstation, same Linux kernel, same terminal emulator.
        </p>
      </div>

      <div className="bench-grid">
        <AnimatedContent direction="left" delay={0.1}>
          <div className="bench-card">
            <div className="bench-header">
              <div>
                <h3 className="bench-title">Resident Process Memory (PSS)</h3>
                <p className="bench-sub">Steady-state memory consumption measured from /proc</p>
              </div>
              <span className="bench-winner-tag">21.2× lighter</span>
            </div>
            <div className="bench-bars">
              {mem.map((d) => (
                <div key={d.label} className={'bench-row' + (d.mochi ? ' is-mochi' : '')}>
                  <div className="bench-label">
                    <span>{d.label}</span>
                    {d.mochi && <span className="winner-pill">Leader</span>}
                  </div>
                  <div className="bench-track">
                    <div className="bench-fill" style={{ width: (d.value / 400 * 100) + '%' }} />
                  </div>
                  <div className="bench-val">{d.display}</div>
                </div>
              ))}
            </div>
          </div>
        </AnimatedContent>

        <AnimatedContent direction="right" delay={0.2}>
          <div className="bench-card">
            <div className="bench-header">
              <div>
                <h3 className="bench-title">Time to First Input (TTFI)</h3>
                <p className="bench-sub">High-resolution PTY wall-clock timestamp until prompt ready</p>
              </div>
              <span className="bench-winner-tag">4.5× faster</span>
            </div>
            <div className="bench-bars">
              {ttfi.map((d) => (
                <div key={d.label} className={'bench-row' + (d.mochi ? ' is-mochi' : '')}>
                  <div className="bench-label">
                    <span>{d.label}</span>
                    {d.mochi && <span className="winner-pill">Leader</span>}
                  </div>
                  <div className="bench-track">
                    <div className="bench-fill" style={{ width: (d.value / 200 * 100) + '%' }} />
                  </div>
                  <div className="bench-val">{d.display}</div>
                </div>
              ))}
            </div>
          </div>
        </AnimatedContent>
      </div>

      <div className="bench-cta-wrap">
        <a href="./benchmarks.html" className="btn btn-secondary">
          Inspect Full Methodology & Raw Telemetry →
        </a>
      </div>
    </section>
  );
}

function CodaSection() {
  return (
    <section className="coda" id="coda">
      <div className="coda-card">
        <div className="coda-glow" />
        <div className="coda-inner">
          <div className="coda-badge">GET STARTED IN SECONDS</div>
          <h2 className="coda-title">Ready to code at the speed of thought?</h2>
          <p className="coda-sub">
            Download the standalone native binary or install via npm. Zero background daemons required.
          </p>
          <div className="coda-actions">
            <Magnetic strength={0.25}>
              <a href="https://github.com/xanstomper/mochi/releases" className="btn btn-primary" target="_blank" rel="noopener">
                ↓ Download Binary (Linux/macOS)
              </a>
            </Magnetic>
            <a href="./docs.html" className="btn btn-secondary">
              Read Documentation →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <HeroSection />
      <Ticker />
      <StatsSection />
      <FlowSection />
      <BenchSection />
      <CodaSection />
      <Footer />
    </>
  );
}

const _root = document.getElementById('root');
if (_root) createRoot(_root).render(<Home />);
