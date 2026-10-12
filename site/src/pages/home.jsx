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
  ['16', 'Specialist Agent Roles', 'Parallel DAG task orchestration'],
  ['0', 'Runtime Dependencies', 'Self-contained zero-overhead core'],
];

const INSTALL_OPTIONS = [
  { id: 'npm', label: 'npm', cmd: 'npm install -g @mochi-ai/cli' },
  { id: 'curl', label: 'curl', cmd: 'curl -fsSL https://mochi.sh/install.sh | bash' },
  { id: 'bun', label: 'bun', cmd: 'bun add -g @mochi-ai/cli' },
  { id: 'cargo', label: 'cargo', cmd: 'cargo install mochi-cli' },
];

function HeroSection() {
  const [activeTab, setActiveTab] = useState('npm');
  const [copied, setCopied] = useState(false);
  const [demoTab, setDemoTab] = useState('terminal');

  const currentCmd = INSTALL_OPTIONS.find((o) => o.id === activeTab)?.cmd || INSTALL_OPTIONS[0].cmd;

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentCmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section className="hero" id="hero">
      <div className="hero-content">
        <AnimatedContent direction="bottom" delay={0.1}>
          <a href="./changelog.html" className="hero-badge">
            <span className="badge-glow" />
            <span className="badge-pill">v0.20.0</span>
            <span className="badge-text">Dual-Engine Native Architecture Released</span>
            <span className="badge-arrow">→</span>
          </a>
        </AnimatedContent>

        <h1 className="hero-headline">
          <span className="headline-row">A softer kind of</span>
          <span className="headline-row headline-gradient">intelligence.</span>
        </h1>

        <AnimatedContent direction="bottom" delay={0.25}>
          <p className="hero-subhead">
            The autonomous coding agent built for the terminal. Mochi pairs a zero-dependency Rust core with an intelligent 16-role specialist swarm, AST-native surgical diffing, and deterministic regression verification.
          </p>
        </AnimatedContent>

        <AnimatedContent direction="bottom" delay={0.35}>
          <div className="hero-actions">
            <Magnetic strength={0.25}>
              <a href="https://github.com/xanstomper/mochi/releases" className="btn btn-primary" target="_blank" rel="noopener">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Native Binary
              </a>
            </Magnetic>
            <Magnetic strength={0.2}>
              <a href="./docs.html" className="btn btn-secondary">
                Documentation &amp; API
                <span className="btn-arrow">→</span>
              </a>
            </Magnetic>
          </div>
        </AnimatedContent>

        {/* Multi-Platform Install Bar */}
        <AnimatedContent direction="bottom" delay={0.45}>
          <div className="install-wrapper">
            <div className="install-tabs">
              {INSTALL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className={'install-tab' + (activeTab === opt.id ? ' active' : '')}
                  onClick={() => setActiveTab(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="install-bar" onClick={handleCopy} role="button" tabIndex={0} title="Click to copy install command">
              <span className="install-prompt">$</span>
              <code className="install-code">{currentCmd}</code>
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
          </div>
        </AnimatedContent>

        <AnimatedContent direction="bottom" delay={0.55}>
          <div className="hero-specs-strip">
            <div className="spec-badge">
              <span className="spec-dot" />
              <span>18.2 MB Resident RAM</span>
            </div>
            <div className="spec-badge">
              <span className="spec-dot" />
              <span>38.2 ms Cold Startup</span>
            </div>
            <div className="spec-badge">
              <span className="spec-dot" />
              <span>Zero Runtime Deps</span>
            </div>
            <div className="spec-badge">
              <span className="spec-dot" />
              <span>16 Specialist Roles</span>
            </div>
          </div>
        </AnimatedContent>
      </div>

      {/* Interactive Developer Showcase */}
      <div className="hero-showcase">
        <AnimatedContent direction="right" delay={0.3} duration={0.8}>
          <div className="terminal-frame">
            <div className="terminal-topbar">
              <div className="terminal-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              
              {/* Interactive Demo View Tabs */}
              <div className="terminal-tabs">
                <button
                  className={'t-tab' + (demoTab === 'terminal' ? ' active' : '')}
                  onClick={() => setDemoTab('terminal')}
                >
                  <span className="t-tab-icon">&gt;_</span> Terminal
                </button>
                <button
                  className={'t-tab' + (demoTab === 'dag' ? ' active' : '')}
                  onClick={() => setDemoTab('dag')}
                >
                  <span className="t-tab-icon">⇄</span> Agent DAG
                </button>
                <button
                  className={'t-tab' + (demoTab === 'diff' ? ' active' : '')}
                  onClick={() => setDemoTab('diff')}
                >
                  <span className="t-tab-icon">±</span> Surgical Diff
                </button>
                <button
                  className={'t-tab' + (demoTab === 'verifier' ? ' active' : '')}
                  onClick={() => setDemoTab('verifier')}
                >
                  <span className="t-tab-icon">✓</span> Verification
                </button>
              </div>

              <div className="terminal-topbar-actions">
                <span className="topbar-status">v0.20.0</span>
              </div>
            </div>

            <div className="terminal-viewport">
              {demoTab === 'terminal' && (
                <div className="terminal-body">
                  <div className="t-line t-prompt">
                    <span className="t-user">developer@box</span>
                    <span className="t-sep">:</span>
                    <span className="t-dir">~/repo</span>
                    <span className="t-glyph">$</span>
                    <span className="t-cmd">mochi goal &quot;Implement auth token rotation &amp; refresh middleware&quot;</span>
                  </div>
                  <div className="t-card-stage">
                    <div className="stage-head">
                      <span className="stage-badge stage-lead">[1/4] DECOMPOSITION</span>
                      <span className="stage-meta">AST tree-sitter: 727 files · 24ms</span>
                    </div>
                    <div className="stage-desc">Reasoning lead constructed 3 concurrent execution DAG nodes.</div>
                  </div>

                  <div className="t-card-stage">
                    <div className="stage-head">
                      <span className="stage-badge stage-coder">[2/4] SURGICAL DIFF</span>
                      <span className="stage-meta">src/auth/token.rs (+84, -2)</span>
                    </div>
                    <div className="stage-desc">Coder role applied anchor-matched AST patch without whole-file rewrites.</div>
                  </div>

                  <div className="t-card-stage">
                    <div className="stage-head">
                      <span className="stage-badge stage-tester">[3/4] TEST GENERATION</span>
                      <span className="stage-meta">48 assertions · 18ms</span>
                    </div>
                    <div className="stage-desc">Tester generated token expiration tests and verified green baseline.</div>
                  </div>

                  <div className="t-card-stage is-success">
                    <div className="stage-head">
                      <span className="stage-badge stage-verifier">[4/4] INDEPENDENT GATE</span>
                      <span className="stage-meta">0 regressions · Git Checkpoint</span>
                    </div>
                    <div className="stage-desc">Acceptance criteria satisfied independently. Checkpointed in 1.42s · 18.2 MB RSS.</div>
                  </div>
                </div>
              )}

              {demoTab === 'dag' && (
                <div className="dag-view">
                  <div className="dag-header">
                    <span className="dag-title">Goal: Token Rotation Architecture</span>
                    <span className="dag-badge">3 Nodes Parallel</span>
                  </div>
                  <div className="dag-nodes">
                    <div className="dag-node">
                      <div className="dag-node-role">Lead Planner</div>
                      <div className="dag-node-title">Decompose Intent</div>
                      <div className="dag-node-status ok">Mapped (24ms)</div>
                    </div>
                    <div className="dag-arrow">↓</div>
                    <div className="dag-parallel-row">
                      <div className="dag-node parallel">
                        <div className="dag-node-role">Coder Specialist</div>
                        <div className="dag-node-title">Token Schema</div>
                        <div className="dag-node-status ok">Applied (+84)</div>
                      </div>
                      <div className="dag-node parallel">
                        <div className="dag-node-role">Architect Specialist</div>
                        <div className="dag-node-title">Refresh Endpoint</div>
                        <div className="dag-node-status ok">Generated</div>
                      </div>
                      <div className="dag-node parallel">
                        <div className="dag-node-role">Tester Specialist</div>
                        <div className="dag-node-title">Regression Suite</div>
                        <div className="dag-node-status ok">48 Passed</div>
                      </div>
                    </div>
                    <div className="dag-arrow">↓</div>
                    <div className="dag-node final">
                      <div className="dag-node-role">Independent Verifier</div>
                      <div className="dag-node-title">Acceptance Validation &amp; Git Checkpoint</div>
                      <div className="dag-node-status verified">100% Passed</div>
                    </div>
                  </div>
                </div>
              )}

              {demoTab === 'diff' && (
                <div className="diff-view">
                  <div className="diff-header">
                    <span className="diff-file">src/auth/token.rs</span>
                    <span className="diff-stat">+84 lines / -2 lines</span>
                  </div>
                  <div className="diff-content">
                    <div className="d-line d-ctx">@@ -14,6 +14,14 @@ pub struct TokenSession &#123;</div>
                    <div className="d-line d-ctx">&nbsp;&nbsp;pub user_id: String,</div>
                    <div className="d-line d-rem">-&nbsp;&nbsp;pub expires_at: u64,</div>
                    <div className="d-line d-add">+&nbsp;&nbsp;pub access_expires_at: u64,</div>
                    <div className="d-line d-add">+&nbsp;&nbsp;pub refresh_token: String,</div>
                    <div className="d-line d-add">+&nbsp;&nbsp;pub rotation_counter: u32,</div>
                    <div className="d-line d-ctx">&#125;</div>
                    <div className="d-line d-ctx">&nbsp;</div>
                    <div className="d-line d-add">+impl TokenSession &#123;</div>
                    <div className="d-line d-add">+&nbsp;&nbsp;pub fn rotate_keys(&amp;mut self, salt: &amp;[u8]) -&gt; Result&lt;TokenPair, AuthError&gt; &#123;</div>
                    <div className="d-line d-add">+&nbsp;&nbsp;&nbsp;&nbsp;self.rotation_counter += 1;</div>
                    <div className="d-line d-add">+&nbsp;&nbsp;&nbsp;&nbsp;TokenPair::generate(self.user_id.clone(), salt)</div>
                    <div className="d-line d-add">+&nbsp;&nbsp;&#125;</div>
                    <div className="d-line d-add">+&#125;</div>
                  </div>
                </div>
              )}

              {demoTab === 'verifier' && (
                <div className="verifier-view">
                  <div className="v-summary-card">
                    <div className="v-card-top">
                      <span className="v-shield">🛡️ Independent Regression Gate</span>
                      <span className="v-pill">PASSED</span>
                    </div>
                    <div className="v-grid">
                      <div className="v-metric">
                        <span className="v-val">48 / 48</span>
                        <span className="v-label">Assertions Green</span>
                      </div>
                      <div className="v-metric">
                        <span className="v-val">0</span>
                        <span className="v-label">Working Regressions</span>
                      </div>
                      <div className="v-metric">
                        <span className="v-val">18.2 MB</span>
                        <span className="v-label">Memory Overhead</span>
                      </div>
                      <div className="v-metric">
                        <span className="v-val">18 ms</span>
                        <span className="v-label">Execution Time</span>
                      </div>
                    </div>
                    <div className="v-status-note">
                      ✓ Filesystem state verified independently against goal criteria before touching origin working tree.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mascot-companion">
              <Mochi size={160} />
            </div>
          </div>
        </AnimatedContent>
      </div>
    </section>
  );
}

function Ticker() {
  const items = [
    '18.2 MB RESIDENT MEMORY', '38.2 MS FIRST INPUT', '21.2× LIGHTER', '4.5× FASTER BOOT',
    'ZERO RUNTIME DEPENDENCIES', '16 SPECIALIST AGENTS', 'AST SURGICAL DIFF ENGINE',
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
          Measured against industry agents on the exact same Linux workstation and warm cache. Real steady-state memory, real time-to-first-input.
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

const PILLARS = [
  {
    icon: '⚡',
    title: 'AST Surgical Diff Engine',
    desc: 'Never overwrites whole files or exhausts tokens in rewrite loops. Mochi uses whitespace-tolerant, anchor-matched AST patches that surgically edit lines with zero ambiguity.',
    tag: 'TOKEN OPTIMIZED',
  },
  {
    icon: '👥',
    title: '16 Specialist Agent Roles',
    desc: 'Sixteen discrete agent roles — Lead, Coder, Reviewer, Tester, Security, DevOps, Architect, DB Admin, and more — execute concurrently with granular capability scoping.',
    tag: 'CONCURRENT SWARM',
  },
  {
    icon: '🦀',
    title: 'Zero-Dependency Rust Core',
    desc: 'A compiled native crate handles BPE tokenization (0.28ms / 100k chars), compaction cut planning (0.12ms), and workspace indexing (50k files in 3.8ms) with minimal memory footprint.',
    tag: 'NATIVE SPEED',
  },
  {
    icon: '🛡️',
    title: 'Deterministic Regression Gate',
    desc: 'Every code mutation is tested against baseline test suites and independent acceptance criteria before it touches your working tree. Zero hallucinated success.',
    tag: 'VERIFIED CODE',
  },
];

function PillarsSection() {
  return (
    <section className="section flow-section" id="pillars">
      <div className="section-header">
        <div className="section-eyebrow">CORE ARCHITECTURE</div>
        <h2 className="section-title">Built different. Built for engineering rigor.</h2>
        <p className="section-subtitle">
          Designed from first principles to eliminate the bloat, memory thrashing, and token waste found in webview-based agents.
        </p>
      </div>
      <div className="pillars-grid">
        {PILLARS.map(({ icon, title, desc, tag }, i) => (
          <AnimatedContent key={title} direction="bottom" delay={i * 0.1}>
            <div className="pillar-card">
              <div className="pillar-card-glow" />
              <div className="pillar-header">
                <span className="pillar-icon">{icon}</span>
                <span className="pillar-tag">{tag}</span>
              </div>
              <h3 className="pillar-title">{title}</h3>
              <p className="pillar-desc">{desc}</p>
            </div>
          </AnimatedContent>
        ))}
      </div>
    </section>
  );
}

function BenchPreviewSection() {
  const mem = [
    { label: 'Mochi', value: 18.2, mochi: true, display: '18.2 MB' },
    { label: 'jcode', value: 27.8, display: '27.8 MB' },
    { label: 'Pi', value: 34.4, display: '34.4 MB' },
    { label: 'Codex CLI', value: 140.0, display: '140 MB' },
    { label: 'Cursor Agent', value: 214.9, display: '214.9 MB' },
    { label: 'OpenCode', value: 371.5, display: '371.5 MB' },
    { label: 'Claude Code', value: 386.6, display: '386.6 MB' },
  ];
  const ttfi = [
    { label: 'Mochi', value: 38.2, mochi: true, display: '38.2 ms' },
    { label: 'jcode', value: 45.4, display: '45.4 ms' },
    { label: 'Pi', value: 52.1, display: '52.1 ms' },
    { label: 'Codex CLI', value: 93.0, display: '93 ms' },
    { label: 'Cursor Agent', value: 121.5, display: '121.5 ms' },
    { label: 'OpenCode', value: 168.3, display: '168.3 ms' },
    { label: 'Claude Code', value: 172.4, display: '172.4 ms' },
  ];

  return (
    <section className="section bench-section" id="bench">
      <div className="section-header">
        <div className="section-eyebrow">HEAD-TO-HEAD BENCHMARKS</div>
        <h2 className="section-title">Measured on hardware. Not marketing claims.</h2>
        <p className="section-subtitle">
          Ten executions against a fixed warm cache on Linux. PSS steady-state memory sampled from /proc; timing uses monotonic PTY timestamps.
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
          Inspect Full Telemetry &amp; Methodology →
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
      <PillarsSection />
      <BenchPreviewSection />
      <CodaSection />
      <Footer />
    </>
  );
}

const _root = document.getElementById('root');
if (_root) createRoot(_root).render(<Home />);
