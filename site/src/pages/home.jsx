import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import {
  SplitText, BlurText, AnimatedContent, CountUp,
  ScrollFloat, TiltCard, GooeyBorder, BenchChart,
} from '../anim.jsx';

const STATS = [
  ['18.2 MB', 'RESIDENT MEMORY'],
  ['38.2 ms', 'TO FIRST INPUT'],
  ['16', 'AGENT ROLES'],
  ['31', 'RELEASES SHIPPED'],
];

const TICKER_ITEMS = [
  '18.2 MB RESIDENT', '38.2 MS TTFI', '21× LIGHTER',
  '4.5× FASTER START', '1.6× MORE STABLE', '9 AGENTS TESTED',
  'ZERO DEPS', '727 FILES', '1200 TESTS PASSING',
];

const CAPABILITIES = [
  {
    icon: '⚡',
    title: '01 / DUAL-PHASE REASONING',
    desc: 'Plans deeply before touching code. Separates architecture from execution so you never get runaway edits.'
  },
  {
    icon: '✂️',
    title: '02 / SURGICAL MULTI-FILE EDITS',
    desc: 'Understands imports, call sites, and side effects. Edits 20 files in one pass without dropping context.'
  },
  {
    icon: '🖥️',
    title: '03 / LIVE TERMINAL DIAGNOSTICS',
    desc: 'Watches your compiler, test suite, and linter in real time. Catches regressions before you see them.'
  },
  {
    icon: '🔀',
    title: '04 / MODEL-AGNOSTIC ROUTER',
    desc: 'Anthropic, OpenAI, DeepSeek, or local Ollama. Hot-swap models mid-session without restarting.'
  },
  {
    icon: '🔒',
    title: '05 / DETERMINISTIC TOOLS',
    desc: 'Ripgrep, AST grep, Git, bash, and native LSP. Fast, cache-friendly, and bounded by tight safety checks.'
  },
  {
    icon: '📦',
    title: '06 / EXTENSIBLE SKILLS RUNTIME',
    desc: 'Drop markdown into ~/.mochi/skills to teach Mochi new domain conventions, workflows, and stacks.'
  },
];

const FLOW_STEPS = [
  { title: 'Describe your task', desc: 'Tell Mochi what to build. Natural language, code snippets, or file paths — it understands all three.' },
  { title: 'Agent decomposition', desc: 'Mochi breaks your request into subtasks and routes each to the optimal specialist agent.' },
  { title: 'Parallel execution', desc: 'Independent tasks run concurrently. Dependent tasks wait. No wasted cycles, no idle time.' },
  { title: 'Review and refine', desc: 'Each output passes through a critic agent before assembly. You review the final result.' },
  { title: 'Ship it', desc: 'Approved code is written to disk with full git integration. One command to commit and push.' },
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

        <AnimatedContent direction="bottom" delay={0.3}>
          <p className="hero-sub">
            A minimal, powerful, and friendly AI coding intelligence.
            Faster, smarter, and better than your premium coding agents,
            built to be lightweight, reliable, and resource friendly.
          </p>
        </AnimatedContent>

        <AnimatedContent direction="bottom" delay={0.4}>
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
        <AnimatedContent direction="right" delay={0.3} duration={0.8}>
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
        Six reasons why developers switch to Mochi and never look back.
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        {STATS.map(([val, label], i) => (
          <AnimatedContent key={label} direction="bottom" delay={i * 0.1}>
            <div style={{
              background: '#ffffff',
              borderRadius: 20,
              padding: '28px 24px',
              border: '1.5px solid var(--line)',
              textAlign: 'center',
              boxShadow: '0 4px 18px rgba(139, 117, 246, 0.06)',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 36,
                fontWeight: 800,
                color: 'var(--ink)',
                marginBottom: 8,
              }}>
                {val}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '.1em',
                color: 'var(--ink-soft)',
                fontWeight: 600,
              }}>
                {label}
              </div>
            </div>
          </AnimatedContent>
        ))}
      </div>
    </section>
  );
}

function FlowSection() {
  return (
    <section className="section" id="flow" style={{ maxWidth: 760 }}>
      <AnimatedContent direction="bottom">
        <div className="section-tag">
          <span className="sparkle" />
          HOW IT WORKS
        </div>
      </AnimatedContent>
      <h2 className="section-title" style={{ fontSize: 36, marginBottom: 24 }}>
        From prompt to product.
      </h2>
      <div style={{ marginTop: 32 }}>
        {FLOW_STEPS.map((step, i) => (
          <AnimatedContent key={step.title} direction="left" delay={i * 0.1}>
            <div style={{ display: 'flex', gap: 20, marginBottom: 28, position: 'relative' }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--purple)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 15,
                fontWeight: 700,
                color: '#ffffff',
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(139, 117, 246, 0.3)',
              }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
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
    <section className="section" id="terminal" style={{ maxWidth: 860 }}>
      <AnimatedContent direction="bottom">
        <div className="section-tag">
          <span className="sparkle" />
          LIVE DEMO
        </div>
      </AnimatedContent>
      <h2 className="section-title" style={{ fontSize: 36, marginBottom: 24 }}>
        Watch it think.
      </h2>
      <AnimatedContent direction="bottom" delay={0.2}>
        <div className="term">
          <div className="term-head">
            <div className="term-dot r" />
            <div className="term-dot y" />
            <div className="term-dot g" />
            <span className="term-title">mochi — zsh</span>
          </div>
          <div className="term-body">
            <div className="term-line">
              <span className="term-prompt">$</span>
              <span>mochi "build a REST API with JWT auth and unit tests"</span>
            </div>
            <div className="term-line">
              <span className="term-comment"># Decomposing goal into 4 specialist tasks...</span>
            </div>
            <div className="term-line">
              <span className="term-keyword">→</span>
              <span>scaffold-express-server</span>
              <span className="term-string">[done · 38ms]</span>
            </div>
            <div className="term-line">
              <span className="term-keyword">→</span>
              <span>implement-jwt-auth</span>
              <span className="term-string">[done · 112ms]</span>
            </div>
            <div className="term-line">
              <span className="term-keyword">→</span>
              <span>generate-vitest-suite</span>
              <span className="term-string">[done · 84ms]</span>
            </div>
            <div className="term-line">
              <span className="term-keyword">→</span>
              <span>security-audit-tokens</span>
              <span className="term-string">[done · 42ms]</span>
            </div>
            <div className="term-line" style={{ marginTop: 14 }}>
              <span className="term-prompt">$</span>
              <span style={{ color: '#34D399', fontWeight: 600 }}>
                ✓ 4/4 tasks complete — 2,847 lines written, 100% tests passing
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
    { label: 'Mochi', value: 18.2, color: 'purple', display: '18.2 MB' },
    { label: 'jcode', value: 27.8, display: '27.8 MB' },
    { label: 'Pi', value: 34.4, display: '34.4 MB' },
    { label: 'Codex CLI', value: 140.0, display: '140 MB' },
    { label: 'Cursor', value: 214.9, display: '214.9 MB' },
    { label: 'OpenCode', value: 371.5, display: '371.5 MB' },
    { label: 'Claude Code', value: 386.6, display: '386.6 MB' },
  ];
  const ttfiData = [
    { label: 'Mochi', value: 38.2, color: 'purple', display: '38.2 ms' },
    { label: 'jcode', value: 45.4, display: '45.4 ms' },
    { label: 'Pi', value: 52.1, display: '52.1 ms' },
    { label: 'Codex CLI', value: 93.0, display: '93 ms' },
    { label: 'Cursor', value: 121.5, display: '121.5 ms' },
    { label: 'OpenCode', value: 168.3, display: '168.3 ms' },
    { label: 'Claude Code', value: 172.4, display: '172.4 ms' },
  ];

  return (
    <section className="section" id="benchmarks" style={{ maxWidth: 880 }}>
      <AnimatedContent direction="bottom">
        <div className="section-tag">
          <span className="sparkle" />
          RECEIPTS, NOT VIBES
        </div>
      </AnimatedContent>
      <h2 className="section-title" style={{ fontSize: 36, marginBottom: 28 }}>
        Measured. Verified. Repeated.
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36 }}>
        <AnimatedContent direction="left" delay={0.2}>
          <div style={{
            background: '#ffffff',
            padding: 24,
            borderRadius: 20,
            border: '1.5px solid var(--line)',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--purple-dark)',
              marginBottom: 16,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              fontWeight: 700,
            }}>
              Resident Memory (MB)
            </div>
            <BenchChart data={memData} max={400} />
          </div>
        </AnimatedContent>

        <AnimatedContent direction="right" delay={0.3}>
          <div style={{
            background: '#ffffff',
            padding: 24,
            borderRadius: 20,
            border: '1.5px solid var(--line)',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--purple-dark)',
              marginBottom: 16,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              fontWeight: 700,
            }}>
              Time to First Input (ms)
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
