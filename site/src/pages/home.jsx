import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import {
  SplitText, BlurText, AnimatedContent, CountUp,
  ScrollFloat, TiltCard, GooeyBorder, BenchChart,
} from '../anim.jsx';

const STATS = [
  ['18.2 MB', 'PEAK RESIDENT RSS', '21.2× lighter than Claude Code'],
  ['38.2 ms', 'TIME TO FIRST INPUT', '4.5× faster cold-start'],
  ['16', 'SPECIALIST ROLES', 'Autonomous DAG swarms'],
  ['31', 'RELEASES SHIPPED', '727 files & 1,200 tests passing'],
];

const TICKER_ITEMS = [
  '18.2 MB RESIDENT RSS', '38.2 MS TTFI', '21.2× LIGHTER',
  '4.5× FASTER START', 'BUBBLEWRAP SANDBOX', '16 SPECIALIST ROLES',
  'ZERO DEPS RUNTIME', '727 FILES AUDITED', '1,200 TESTS PASSING',
];

const CAPABILITIES = [
  {
    icon: '⚡',
    title: '01 / DUAL-PHASE REASONING',
    desc: 'Separates planning from execution. Spec mode generates a formal task DAG before Act mode applies atomic file modifications, eliminating runaway hallucinated edits.'
  },
  {
    icon: '✂️',
    title: '02 / SURGICAL AST-DIFF EDITS',
    desc: 'Tree-sitter semantic symbol tracking and whitespace-tolerant unified patch applicator. Edits 20+ dependent files in a single pass without dropping import context.'
  },
  {
    icon: '🔒',
    title: '03 / BUBBLEWRAP SANDBOX',
    desc: 'Hardware-level unprivileged namespace containerization via bwrap. Masks ~/.ssh and ~/.aws, mounts system binaries read-only, and prevents prompt-injection breakouts.'
  },
  {
    icon: '🔀',
    title: '04 / MULTI-MODEL ROUTER',
    desc: 'Hot-swap OpenCode Zen, Anthropic Claude 3.5 Sonnet, OpenAI GPT-4o, DeepSeek, or local Ollama mid-session. Automatically backs off and fails over on 429 rate limits.'
  },
  {
    icon: '🛠️',
    title: '05 / DETERMINISTIC TOOLS',
    desc: 'Ripgrep search, AST grep, Git checkpoint rollbacks, headless test runner, and native LSP. Fast, cache-friendly, and bounded by strict privilege boundaries.'
  },
  {
    icon: '👥',
    title: '06 / 16 SPECIALIST SWARMS',
    desc: 'Lead, Coder, Reviewer, Tester, Architect, Security, and DevOps subagents spawned concurrently across directed acyclic graphs with dependency resolution.'
  },
];

const FLOW_STEPS = [
  { title: 'Decompose the objective', desc: 'Tell Mochi what to build. Natural language, bug traces, or file paths — it builds a formal dependency DAG.' },
  { title: 'Specialist role assignment', desc: 'Tasks are dispatched to domain agents (Lead, Coder, Architect, Security) with minimal context overhead.' },
  { title: 'Sandboxed execution', desc: 'Subagents execute within Bubblewrap containers. Ripgrep searches, AST patches, and compiler diagnostics run concurrently.' },
  { title: 'Mechanical verification', desc: 'Outputs pass through compiler and test suite runners before being marked done. Zero unverified code.' },
  { title: 'Atomic git checkpoint', desc: 'Approved changes are written to disk with automated git checkpoints and instant one-click rollback.' },
];

function HeroSection() {
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/mochi') ? '/mochi' : '';
  return (
    <section className="hero" id="hero">
      <div className="hero-copy">
        <AnimatedContent direction="bottom" delay={0.1}>
          <div className="hero-eyebrow">
            <span className="sparkle" />
            THE NEXT GENERATION AI CODING AGENT
          </div>
        </AnimatedContent>

        <h1 className="hero-title">
          A Softer Kind of<br />
          <span className="accent-title">Intelligence.</span>
        </h1>

        <AnimatedContent direction="bottom" delay={0.25}>
          <p className="hero-sub">
            A minimal, powerful, and friendly AI coding intelligence.
            Faster, smarter, and lighter than bloated coding agents —
            built on a zero-dependency Rust core with Bubblewrap hardware sandboxing.
          </p>
        </AnimatedContent>

        <AnimatedContent direction="bottom" delay={0.35}>
          <div className="hero-actions">
            <a
              href="https://github.com/xanstomper/mochi/releases"
              className="btn btn-primary"
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
            <a href={base + '/docs.html'} className="btn btn-secondary">
              Read the Docs →
            </a>
          </div>
        </AnimatedContent>
      </div>

      <div className="hero-mascot">
        <AnimatedContent direction="right" delay={0.25} duration={0.8}>
          <div style={{ position: 'relative' }}>
            <div className="mascot-doodle">
              let's build something cool!
            </div>
            <Mochi size={640} />
          </div>
        </AnimatedContent>
      </div>
    </section>
  );
}

function StatsTicker() {
  return (
    <div className="stats-ticker" aria-hidden="true">
      <div className="ticker-track">
        {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} className="ticker-item">
            <span className="ticker-dot" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function CapabilitiesSection() {
  return (
    <section className="section" id="capabilities">
      <AnimatedContent direction="bottom">
        <div className="section-tag">
          <span className="sparkle" />
          SECTION 02 / WHY MOCHI?
        </div>
      </AnimatedContent>

      <div className="section-head-flex">
        <h2 className="section-title">
          AGENTIC <span className="accent-title">CAPABILITIES</span>
        </h2>
        <span className="section-arrow-diag">↗</span>
      </div>

      <p className="section-desc">
        Six architectural principles that separate Mochi from conventional vibecoded wrappers.
      </p>

      <div className="caps-grid">
        {CAPABILITIES.map((cap, i) => (
          <AnimatedContent key={cap.title} direction="bottom" delay={i * 0.08}>
            <div className="cap-card">
              <div className="cap-icon">{cap.icon}</div>
              <h3 className="cap-title">{cap.title}</h3>
              <p className="cap-desc">{cap.desc}</p>
            </div>
          </AnimatedContent>
        ))}
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="section" id="stats">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        {STATS.map(([val, label, sub], i) => (
          <AnimatedContent key={label} direction="bottom" delay={i * 0.08}>
            <TiltCard>
              <div style={{
                background: '#ffffff',
                borderRadius: 24,
                padding: '32px 24px',
                border: '1.5px solid var(--line)',
                textAlign: 'center',
                boxShadow: 'var(--shadow-card)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 42,
                  fontWeight: 800,
                  color: 'var(--purple-dark)',
                  letterSpacing: '-0.02em',
                  marginBottom: 6,
                }}>
                  {val}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11.5,
                  textTransform: 'uppercase',
                  letterSpacing: '.1em',
                  color: 'var(--ink)',
                  fontWeight: 700,
                  marginBottom: 6,
                }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                  {sub}
                </div>
              </div>
            </TiltCard>
          </AnimatedContent>
        ))}
      </div>
    </section>
  );
}

function FlowSection() {
  return (
    <section className="section" id="flow" style={{ maxWidth: 960 }}>
      <AnimatedContent direction="bottom">
        <div className="section-tag">
          <span className="sparkle" />
          HOW IT WORKS
        </div>
      </AnimatedContent>
      <h2 className="section-title" style={{ fontSize: 38, marginBottom: 28 }}>
        From prompt to product.
      </h2>
      <div style={{ marginTop: 32 }}>
        {FLOW_STEPS.map((step, i) => (
          <AnimatedContent key={step.title} direction="left" delay={i * 0.08}>
            <div style={{ display: 'flex', gap: 24, marginBottom: 28, position: 'relative' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--purple)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 16,
                fontWeight: 700,
                color: '#ffffff',
                flexShrink: 0,
                boxShadow: '0 4px 16px rgba(139, 117, 246, 0.3)',
              }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <h3 style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.65 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          </AnimatedContent>
        ))}
      </div>
    </section>
  );
}

function TerminalSection() {
  return (
    <section className="section" id="terminal" style={{ maxWidth: 1080 }}>
      <AnimatedContent direction="bottom">
        <div className="section-tag">
          <span className="sparkle" />
          INTERACTIVE DEMO
        </div>
      </AnimatedContent>
      <h2 className="section-title" style={{ fontSize: 38, marginBottom: 28 }}>
        Watch it think.
      </h2>
      <AnimatedContent direction="bottom" delay={0.2}>
        <div className="term" style={{ borderRadius: 24, border: '1.5px solid var(--line)', boxShadow: '0 12px 48px rgba(139, 117, 246, 0.14)' }}>
          <div className="term-head" style={{ padding: '16px 22px' }}>
            <div className="term-dot r" />
            <div className="term-dot y" />
            <div className="term-dot g" />
            <span className="term-title" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>mochi — zsh</span>
          </div>
          <div className="term-body" style={{ padding: '24px 28px', fontSize: 14, lineHeight: 1.8 }}>
            <div className="term-line">
              <span className="term-prompt">$</span>
              <span>mochi "fix off-by-one index error in sum.js and run tests"</span>
            </div>
            <div className="term-line">
              <span className="term-comment"># [Spec Phase] Inspecting AST call graph & sum.js...</span>
            </div>
            <div className="term-line">
              <span className="term-keyword">→</span>
              <span>tree-sitter parse sum.js</span>
              <span className="term-string">[found off-by-one: i &lt;= arr.length]</span>
            </div>
            <div className="term-line">
              <span className="term-keyword">→</span>
              <span>apply unified patch *** sum.js</span>
              <span className="term-string">[i &lt; arr.length · 12ms]</span>
            </div>
            <div className="term-line">
              <span className="term-keyword">→</span>
              <span>bubblewrap bwrap shell: node run.js</span>
              <span className="term-string">[prints 10 · exit 0]</span>
            </div>
            <div className="term-line">
              <span className="term-keyword">→</span>
              <span>git checkpoint commit</span>
              <span className="term-string">[7a4cb3a clean pass]</span>
            </div>
            <div className="term-line" style={{ marginTop: 14 }}>
              <span className="term-prompt">$</span>
              <span style={{ color: '#34D399', fontWeight: 700 }}>
                ✓ Task verified and complete — 1 file modified, 100% tests passing in 12.6s
              </span>
            </div>
          </div>
        </div>
      </AnimatedContent>
    </section>
  );
}

function BenchmarksSection() {
  const memData = [
    { label: 'Mochi (Bun)', value: 18.2, color: 'purple', display: '18.2 MB' },
    { label: 'jcode', value: 27.8, display: '27.8 MB' },
    { label: 'Crush', value: 34.4, display: '34.4 MB' },
    { label: 'Codex CLI', value: 140.0, display: '140 MB' },
    { label: 'Aider', value: 188.0, display: '188 MB' },
    { label: 'Cursor', value: 214.9, display: '214.9 MB' },
    { label: 'OpenCode', value: 371.5, display: '371.5 MB' },
    { label: 'Claude Code', value: 386.6, display: '386.6 MB' },
  ];
  const ttfiData = [
    { label: 'Mochi', value: 38.2, color: 'purple', display: '38.2 ms' },
    { label: 'jcode', value: 45.4, display: '45.4 ms' },
    { label: 'Crush', value: 52.1, display: '52.1 ms' },
    { label: 'Codex CLI', value: 93.0, display: '93 ms' },
    { label: 'Cursor', value: 121.5, display: '121.5 ms' },
    { label: 'Aider', value: 145.2, display: '145.2 ms' },
    { label: 'OpenCode', value: 168.3, display: '168.3 ms' },
    { label: 'Claude Code', value: 172.4, display: '172.4 ms' },
  ];

  return (
    <section className="section" id="benchmarks" style={{ maxWidth: 1200 }}>
      <AnimatedContent direction="bottom">
        <div className="section-tag">
          <span className="sparkle" />
          MEASURED RECEIPTS
        </div>
      </AnimatedContent>
      <h2 className="section-title" style={{ fontSize: 38, marginBottom: 28 }}>
        Measured. Verified. Repeated.
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36 }}>
        <AnimatedContent direction="left" delay={0.2}>
          <div style={{
            background: '#ffffff',
            padding: '32px 28px',
            borderRadius: 24,
            border: '1.5px solid var(--line)',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              color: 'var(--purple-dark)',
              marginBottom: 18,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              fontWeight: 700,
            }}>
              Peak Resident RSS (MB) — Lower is Better
            </div>
            <BenchChart data={memData} max={400} />
          </div>
        </AnimatedContent>

        <AnimatedContent direction="right" delay={0.25}>
          <div style={{
            background: '#ffffff',
            padding: '32px 28px',
            borderRadius: 24,
            border: '1.5px solid var(--line)',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              color: 'var(--purple-dark)',
              marginBottom: 18,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              fontWeight: 700,
            }}>
              Cold Start TTFI (ms) — Lower is Better
            </div>
            <BenchChart data={ttfiData} max={200} />
          </div>
        </AnimatedContent>
      </div>
    </section>
  );
}

function CodaSection() {
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/mochi') ? '/mochi' : '';
  return (
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
              Download Mochi
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
          <Mochi size={220} />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <HeroSection />
      <StatsTicker />
      <CapabilitiesSection />
      <StatsSection />
      <FlowSection />
      <TerminalSection />
      <BenchmarksSection />
      <CodaSection />
      <Footer />
    </>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<Home />);
}
