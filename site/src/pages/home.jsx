import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import {
  SplitText, BlurText, AnimatedContent, CountUp,
  ScrollFloat, TiltCard, GooeyBorder, BenchChart,
} from '../anim.jsx';
import {
  IconBolt, IconCode, IconShield, IconGitBranch,
  IconCpu, IconUsers, IconCheck, IconTerminal, IconRocket,
} from '../icons.jsx';

const STATS = [
  ['18.2 MB', 'PEAK RESIDENT RSS', '21.2× lighter than Claude Code'],
  ['38.2 ms', 'TIME TO FIRST INPUT', '4.5× faster cold-start'],
  ['16', 'SPECIALIST ROLES', 'Autonomous DAG swarms'],
  ['35', 'RELEASES SHIPPED', '727 files & 1,459 tests passing'],
];

const TICKER_ITEMS = [
  '18.2 MB RESIDENT RSS', '38.2 MS TTFI', '21.2× LIGHTER',
  '4.5× FASTER START', 'BUBBLEWRAP SANDBOX', '16 SPECIALIST ROLES',
  'ZERO DEPS RUNTIME', '727 FILES AUDITED', '1,459 TESTS PASSING',
];

const CAPABILITIES = [
  {
    icon: IconBolt,
    title: '01 / DUAL-PHASE REASONING',
    desc: 'Separates planning from execution. Spec mode generates a formal task DAG before Act mode applies atomic file modifications, eliminating runaway hallucinated edits.'
  },
  {
    icon: IconCode,
    title: '02 / SURGICAL AST-DIFF EDITS',
    desc: 'Tree-sitter semantic symbol tracking and whitespace-tolerant unified patch applicator. Edits 20+ dependent files in a single pass without dropping import context.'
  },
  {
    icon: IconShield,
    title: '03 / BUBBLEWRAP SANDBOX',
    desc: 'Hardware-level unprivileged namespace containerization via bwrap. Masks ~/.ssh and ~/.aws, mounts system binaries read-only, and prevents prompt-injection breakouts.'
  },
  {
    icon: IconGitBranch,
    title: '04 / MULTI-MODEL ROUTER',
    desc: 'Hot-swap OpenCode Zen, Anthropic Claude 3.5 Sonnet, OpenAI GPT-4o, DeepSeek, or local Ollama mid-session. Automatically backs off and fails over on 429 rate limits.'
  },
  {
    icon: IconCpu,
    title: '05 / DETERMINISTIC TOOLS',
    desc: 'Ripgrep search, AST grep, Git checkpoint rollbacks, headless test runner, and native LSP. Fast, cache-friendly, and bounded by strict privilege boundaries.'
  },
  {
    icon: IconUsers,
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
            AUTONOMOUS CODING AGENT & ARCHITECT
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
          SECTION 02 / ARCHITECTURE
        </div>
      </AnimatedContent>

      <div className="section-head-flex">
        <h2 className="section-title">
          AGENTIC <span className="accent-title">CAPABILITIES</span>
        </h2>
        <span className="section-arrow-diag">↗</span>
      </div>

      <p className="section-desc">
        Six architectural principles that separate Mochi from conventional wrappers.
      </p>

      <div className="caps-grid">
        {CAPABILITIES.map((cap, i) => {
          const IconComp = cap.icon;
          return (
            <AnimatedContent key={cap.title} direction="bottom" delay={i * 0.08}>
              <div className="cap-card">
                <div className="cap-icon-box">
                  <IconComp size={22} />
                </div>
                <h3 className="cap-title">{cap.title}</h3>
                <p className="cap-desc">{cap.desc}</p>
              </div>
            </AnimatedContent>
          );
        })}
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
                padding: '34px 24px',
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
                  fontSize: 44,
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
                <div style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>
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
    <section className="section" id="flow" style={{ maxWidth: 980, margin: '0 auto' }}>
      <AnimatedContent direction="bottom">
        <div className="section-tag">
          <span className="sparkle" />
          EXECUTION LIFECYCLE
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

function ArchitectureSection() {
  const [activeTab, setActiveTab] = useState('ast');

  const tabs = [
    { id: 'ast', label: 'Surgical AST Patch', badge: '12ms / Turn' },
    { id: 'sandbox', label: 'Bubblewrap Sandbox', badge: 'Hardware Isolated' },
    { id: 'recovery', label: 'Struggle Circuit Breaker', badge: 'Autonomous Escalate' },
    { id: 'multitab', label: 'Multi-Tab TUI Matrix', badge: 'Pinned Sessions' },
  ];

  return (
    <section className="section" id="architecture" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <AnimatedContent direction="bottom">
        <div className="section-tag">
          <span className="sparkle" />
          INTERACTIVE ARCHITECTURE
        </div>
      </AnimatedContent>
      <h2 className="section-title" style={{ fontSize: 38, marginBottom: 16 }}>
        Engineered for Precision. <span className="accent-title">Built for Speed.</span>
      </h2>
      <p className="section-desc" style={{ maxWidth: 760, marginBottom: 32 }}>
        Inspect how Mochi’s Spec/Act dual-engine separation, AST surgical diffing, and unprivileged sandboxing outperform traditional AI agent wrappers.
      </p>

      {/* Interactive Tabs Bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              border: activeTab === t.id ? '1.5px solid var(--purple)' : '1.5px solid var(--line)',
              background: activeTab === t.id ? 'var(--purple-lighter)' : '#ffffff',
              color: activeTab === t.id ? 'var(--purple-dark)' : 'var(--ink)',
              fontWeight: 700,
              fontSize: 13.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: activeTab === t.id ? '0 4px 14px rgba(139, 117, 246, 0.18)' : 'var(--shadow-card)',
              transition: 'all 0.2s',
            }}
          >
            <span>{t.label}</span>
            <span
              style={{
                fontSize: 10.5,
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                borderRadius: 6,
                background: activeTab === t.id ? 'var(--purple)' : '#EDE8F5',
                color: activeTab === t.id ? '#ffffff' : 'var(--purple-dark)',
                fontWeight: 600,
              }}
            >
              {t.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Active Tab Interactive Display */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 24,
          border: '1.5px solid rgba(139, 92, 246, 0.20)',
          boxShadow: 'var(--shadow-card)',
          padding: 32,
          overflow: 'hidden',
        }}
      >
        {activeTab === 'ast' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#111116', margin: 0 }}>
                  Tree-Sitter AST Surgical Mutation vs. Naive Rewriting
                </h3>
                <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '4px 0 0' }}>
                  Modifies only the exact AST target node in 12ms. Never rewrites entire 400-line files or corrupts git blame.
                </p>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: '#D1FAE5', color: '#065F46', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>
                ✓ 99.4% LESS TOKEN WASTE
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ background: '#110F1D', borderRadius: 16, padding: 20, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: '#EDE9FE', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ color: '#F87171', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✕ Conventional AI Coding Agents</span>
                  <span style={{ fontSize: 10, background: 'rgba(239, 68, 68, 0.2)', padding: '2px 6px', borderRadius: 4 }}>Slow &amp; Risky</span>
                </div>
                <div style={{ color: 'rgba(255, 255, 255, 0.4)', lineHeight: 1.7 }}>
                  <div>// Rewrites entire 450-line file from scratch</div>
                  <div>// 12,400 tokens spent on unchanged boilerplate</div>
                  <div>// Destroys git blame across entire module</div>
                  <div>// Truncates halfway through on context limit</div>
                  <div style={{ color: '#F87171', marginTop: 8 }}>- export function calculateRates(req, res) &#123; ... 450 lines ... &#125;</div>
                </div>
              </div>

              <div style={{ background: '#110F1D', borderRadius: 16, padding: 20, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: '#EDE9FE', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <div style={{ color: '#34D399', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✓ Mochi Surgical Diff Engine</span>
                  <span style={{ fontSize: 10, background: 'rgba(52, 211, 153, 0.2)', padding: '2px 6px', borderRadius: 4 }}>Atomic &amp; Safe</span>
                </div>
                <div style={{ color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.7 }}>
                  <div style={{ color: '#818CF8' }}>@@ -42,2 +42,2 @@ AST Node: TokenRateLimiter</div>
                  <div style={{ color: '#F87171' }}>-   const maxRps = currentTier === 'free' ? 10 : 100;</div>
                  <div style={{ color: '#34D399' }}>+   const maxRps = currentTier === 'free' ? 25 : 250; // Surgical patch: 12ms</div>
                  <div style={{ color: '#34D399', marginTop: 8 }}>✓ Invariant verified: tree-sitter AST matches post-edit shape</div>
                  <div style={{ color: '#A78BFA' }}>✓ 100% git blame preserved for surrounding 448 lines</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sandbox' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#111116', margin: 0 }}>
                  Bubblewrap Hardware Sandbox &amp; Policy Isolation
                </h3>
                <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '4px 0 0' }}>
                  Commands execute within unprivileged user namespaces. Host filesystems and credentials remain completely masked.
                </p>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: '#EDE9FE', color: 'var(--purple-dark)', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>
                MOCHI_SANDBOX=bubblewrap
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 22, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--purple-dark)', marginBottom: 8 }}>
                  🛡️ Read-Only System Mounts
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>
                  <code>/usr</code>, <code>/bin</code>, and <code>/lib</code> mounted read-only via unprivileged <code>bwrap</code>. System binaries cannot be replaced or infected.
                </p>
              </div>

              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 22, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--purple-dark)', marginBottom: 8 }}>
                  🔒 Credential Blackhole
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>
                  <code>~/.ssh</code>, <code>~/.aws</code>, and <code>~/.gnupg</code> masked with isolated empty tmpfs filesystems. Prompt injections cannot exfiltrate user keys.
                </p>
              </div>

              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 22, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--purple-dark)', marginBottom: 8 }}>
                  🌐 Strict Egress Control
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>
                  Configurable <code>--unshare-net</code> isolates untrusted code from making rogue HTTP calls or reverse TCP shells during testing.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recovery' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#111116', margin: 0 }}>
                  Struggle-State Detection &amp; Auto-Escalation
                </h3>
                <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '4px 0 0' }}>
                  Breaks infinite error loops autonomously. 3 consecutive verification failures escalate to high-tier reasoning models.
                </p>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>
                ANTI-LOOP CIRCUIT BREAKER
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 18, border: '1px solid var(--line)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', fontWeight: 700 }}>TURN 1</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111116', margin: '6px 0 4px' }}>Fast Model Execution</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>glm-5.3-flash attempts rapid edit batch (140ms).</div>
              </div>
              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 18, border: '1px solid var(--line)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#DC2626', fontWeight: 700 }}>TURN 2 (FAILED)</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#DC2626', margin: '6px 0 4px' }}>Stagnation Detected</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Compiler red test. 0 new files mutated. Breaker arms.</div>
              </div>
              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 18, border: '1.5px solid var(--purple)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--purple-dark)', fontWeight: 700 }}>TURN 3 (ESCALATE)</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--purple-dark)', margin: '6px 0 4px' }}>Model Auto-Handoff</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Escalates to kimi-k2.7-code with handoff diagnosis.</div>
              </div>
              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 18, border: '1.5px solid #059669', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#059669', fontWeight: 700 }}>VERIFIED PASS</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#059669', margin: '6px 0 4px' }}>Git Checkpoint</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>100% tests green. Atomic commit with zero rollbacks.</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'multitab' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#111116', margin: 0 }}>
                  Multi-Tab Pinned Sessions (Mochi v0.22.0)
                </h3>
                <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '4px 0 0' }}>
                  Run multiple autonomous agents concurrently in isolated terminal tabs with dedicated budgets and abort controllers.
                </p>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: '#EDE9FE', color: 'var(--purple-dark)', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>
                ALT+T NEW · ALT+1-8 SWITCH
              </span>
            </div>

            <div style={{ background: '#110F1D', borderRadius: 16, padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              {/* Tab bar header */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: 12, marginBottom: 16 }}>
                <div style={{ background: '#7C3AED', color: '#ffffff', padding: '5px 12px', borderRadius: 6, fontWeight: 700, fontSize: 12 }}>
                  1: auth-service [ACTIVE]
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'rgba(255, 255, 255, 0.6)', padding: '5px 12px', borderRadius: 6, fontSize: 12 }}>
                  2: database-migration · 2 unread
                </div>
                <div style={{ background: 'transparent', color: 'var(--purple-light)', border: '1px dashed rgba(139, 92, 246, 0.4)', padding: '5px 12px', borderRadius: 6, fontSize: 12 }}>
                  + New session
                </div>
              </div>

              <div style={{ color: '#EDE9FE', lineHeight: 1.8 }}>
                <div style={{ color: '#A78BFA' }}>$ mochi --tab 1 "refactor jwt verification into standalone middleware"</div>
                <div style={{ color: '#34D399' }}>✓ Tab 1 runtime isolated — 18.2 MB RSS, own budget, background execution intact.</div>
                <div style={{ color: 'rgba(255, 255, 255, 0.5)', marginTop: 8 }}>[Tab 2 continues running database migration in background without transcript spam]</div>
              </div>
            </div>
          </div>
        )}
      </div>
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
    <section className="section" id="benchmarks" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <AnimatedContent direction="bottom">
        <div className="section-tag">
          <span className="sparkle" />
          MEASURED RECEIPTS
        </div>
      </AnimatedContent>
      <h2 className="section-title" style={{ fontSize: 38, marginBottom: 28, color: '#111116' }}>
        Measured. Verified. Repeated.
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36 }}>
        <AnimatedContent direction="left" delay={0.2}>
          <div
            style={{
              background: '#ffffff',
              padding: '34px 30px',
              borderRadius: 24,
              border: '1.5px solid var(--line)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: '#111116',
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                  fontWeight: 800,
                }}
              >
                Peak Resident RSS (MB)
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  background: 'var(--purple-lighter)',
                  color: 'var(--purple-dark)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontWeight: 800,
                }}
              >
                21.2× LIGHTER
              </span>
            </div>
            <BenchChart data={memData} max={400} />
          </div>
        </AnimatedContent>

        <AnimatedContent direction="right" delay={0.25}>
          <div
            style={{
              background: '#ffffff',
              padding: '34px 30px',
              borderRadius: 24,
              border: '1.5px solid var(--line)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: '#111116',
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                  fontWeight: 800,
                }}
              >
                Cold Start TTFI (ms)
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  background: 'var(--purple-lighter)',
                  color: 'var(--purple-dark)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontWeight: 800,
                }}
              >
                4.5× FASTER
              </span>
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
  const [copied, setCopied] = useState(false);

  const copyInstall = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText('curl -fsSL https://mochi.sh | sh');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="coda-wrap">
      <div className="coda-banner">
        {/* Left Column: Black readable text and download options */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 580 }}>
          <h2 style={{ color: '#111116', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, marginBottom: 14 }}>
            Ready to Build with Mochi?
          </h2>
          <p style={{ color: '#2D283E', fontSize: 16.5, lineHeight: 1.65, marginBottom: 24, fontWeight: 500 }}>
            Experience the lightest, fastest autonomous coding intelligence for your terminal. Single standalone Bun binary, compiled Rust core, and 0 external dependencies.
          </p>

          {/* Quick Install Snippet */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#FAF8FC',
              border: '1.5px solid rgba(139, 92, 246, 0.22)',
              borderRadius: 12,
              padding: '6px 14px',
              marginBottom: 24,
              gap: 12,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#111116', fontWeight: 700 }}>
              curl -fsSL https://mochi.sh | sh
            </span>
            <button
              onClick={copyInstall}
              style={{
                background: 'var(--purple)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <a
              href="https://github.com/xanstomper/mochi/releases"
              className="btn btn-primary"
              target="_blank"
              rel="noopener"
              style={{ textDecoration: 'none' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Mochi (v0.22.0)
            </a>
            <a
              href={base + '/docs.html'}
              className="btn btn-secondary"
              style={{ textDecoration: 'none', color: '#111116', border: '1.5px solid #111116' }}
            >
              Read the Docs →
            </a>
          </div>
        </div>

        {/* Right Column: User's GIF */}
        <div className="coda-gif-wrap">
          <img
            src={base + '/IMG_3098.gif'}
            alt="Mochi Autonomous Terminal Demo"
            className="coda-gif"
          />
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
            Live session playback: Mochi autonomous terminal execution
          </div>
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
      <ArchitectureSection />
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
