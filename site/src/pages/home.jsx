import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import EngineeringGridBackground from '../EngineeringGridBackground.jsx';
import {
  SplitText, BlurText, AnimatedContent, CountUp,
  ScrollFloat, TiltCard, GooeyBorder, BenchChart,
  EditorialReveal, StaggerGroup,
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

const SPECIALIST_ROLES = [
  {
    id: 'lead',
    name: 'Lead Orchestrator',
    tag: 'DAG Root',
    badge: 'Coordinator',
    desc: 'Parses ambiguous user requests into formal execution DAGs, balances token budgets, and approves phase handoffs.',
    tools: ['dag_dispatch', 'budget_audit', 'checkpoint_commit'],
  },
  {
    id: 'coder',
    name: 'Core Coder',
    tag: 'Act Phase',
    badge: 'Implementation',
    desc: 'Executes surgical tree-sitter AST patches and unified diffs. Preserves git blame and surrounding file invariants.',
    tools: ['apply_ast_patch', 'ripgrep_search', 'replace_symbol'],
  },
  {
    id: 'architect',
    name: 'System Architect',
    tag: 'Spec Phase',
    badge: 'Topology',
    desc: 'Analyzes call graphs, blast radius, and module inter-dependencies across large monorepos before edits begin.',
    tools: ['blast_radius', 'codegraph_query', 'ast_slicer'],
  },
  {
    id: 'reviewer',
    name: 'Code Reviewer',
    tag: 'Audit Gate',
    badge: 'Quality',
    desc: 'Performs multi-pass static analysis for race conditions, memory leaks, OWASP top 10, and architectural regressions.',
    tools: ['ast_lint', 'diff_inspect', 'security_scan'],
  },
  {
    id: 'tester',
    name: 'Test Synthesizer',
    tag: 'TDD Gate',
    badge: 'Verification',
    desc: 'Generates unit tests, fuzz cases, and boundary assertions. Executes test runners in Bubblewrap sandboxes.',
    tools: ['run_test_suite', 'synthesize_fixtures', 'test_density'],
  },
  {
    id: 'security',
    name: 'Security Guardian',
    tag: 'Policy Gate',
    badge: 'Sandboxing',
    desc: 'Enforces unprivileged Bubblewrap limits, masks sensitive credentials, and terminates anomalous outbound connections.',
    tools: ['bwrap_enforce', 'credential_blackhole', 'audit_log'],
  },
];

function HeroSection() {
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/mochi') ? '/mochi' : '';
  return (
    <section className="hero" id="hero">
      <div className="hero-copy">
        <AnimatedContent direction="left" delay={0.05} distance={45} blur={16}>
          <div className="hero-eyebrow-clean">
            <span className="sparkle-star">✦</span>
            THE NEXT GENERATION AI CODING AGENT
          </div>
        </AnimatedContent>

        <AnimatedContent direction="left" delay={0.15} distance={50} blur={16}>
          <h1 className="hero-title">
            A Softer Kind of<br />
            <span className="accent-title">Intelligence.</span>
          </h1>
        </AnimatedContent>

        <AnimatedContent direction="left" delay={0.25} distance={45} blur={16}>
          <p className="hero-sub">
            A minimal, powerful, and friendly AI coding intelligence.<br />
            Faster, smarter, and better than your premium coding agents,<br />
            built to be lightweight, reliable, and resource friendly.
          </p>
        </AnimatedContent>

        <AnimatedContent direction="left" delay={0.35} distance={40} blur={16}>
          <div className="hero-actions">
            <a
              href="https://github.com/xanstomper/mochi/releases"
              className="hero-btn-dl"
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
            <a href={base + '/docs.html'} className="hero-btn-docs">
              Read the Docs →
            </a>
          </div>
        </AnimatedContent>
      </div>

      <div className="hero-mascot">
        <AnimatedContent direction="bottom" delay={0.2} duration={0.85} distance={30} blur={16}>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <Mochi size={940} />
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
    <section className="section" id="capabilities" style={{ maxWidth: 1560, margin: '0 auto', padding: '80px 4vw', scrollMarginTop: 100 }}>
      <AnimatedContent direction="bottom" delay={0.05} blur={12}>
        <div className="section-tag-pill">
          <span className="tag-sparkle">✦</span>
          <span className="tag-part-dark">SECTION 02 /</span>
          <span className="tag-part-purple">WHY MOCHI?</span>
        </div>
      </AnimatedContent>

      <EditorialReveal delay={0.1}>
        <div className="section-head-huge">
          <h2 className="section-title-huge">
            ARCHITECTURAL <span className="accent-title">DISCIPLINES</span>
          </h2>
          <span className="section-arrow-diag-huge">↗</span>
        </div>
      </EditorialReveal>

      <AnimatedContent direction="left" delay={0.15} distance={30} blur={10}>
        <p className="section-desc" style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 40, maxWidth: 680 }}>
          Six core architectural disciplines that elevate Mochi above conventional AI wrappers — eliminating runaway hallucinated edits, preserving git blame, and enforcing kernel isolation.
        </p>
      </AnimatedContent>

      <div className="editorial-showcase-container">
        {/* Asymmetric Showcase 01: Dual-Phase DAG Reasoning */}
        <AnimatedContent direction="left" delay={0.12} distance={45} blur={14}>
          <div className="editorial-split-showcase">
            <div className="editorial-split-left">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800, color: '#8A67F6' }}>
                    01 // SPEC-VS-ACT PIPELINE
                  </span>
                  <span style={{ fontSize: 11, background: '#EDE8F8', color: '#111116', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                    DAG Engine
                  </span>
                </div>
                <h3 style={{ fontSize: 28, fontWeight: 850, color: '#111116', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 16 }}>
                  Dual-Phase Reasoning with Formal State DAGs
                </h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink-soft)', marginBottom: 24 }}>
                  Planning is strictly decoupled from code mutation. In Spec mode, Mochi decomposes ambiguous user prompts into an immutable task dependency DAG, calculates blast radius, and locks the token quota. Only once validated does Act mode engage atomic filesystem writes.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, background: '#F4EFFE', color: '#6D28D9', padding: '6px 12px', borderRadius: 8, fontWeight: 700 }}>
                  ✓ SPEC: Blast-radius mapped
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, background: '#ECFDF5', color: '#047857', padding: '6px 12px', borderRadius: 8, fontWeight: 700 }}>
                  ✓ ACT: 12ms atomic patch
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, background: '#EFF6FF', color: '#1D4ED8', padding: '6px 12px', borderRadius: 8, fontWeight: 700 }}>
                  ✓ GATE: Zero unverified commits
                </span>
              </div>
            </div>

            <div className="editorial-split-right">
              <div className="editorial-dark-terminal">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: 10, marginBottom: 14 }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>mochi-engine · spec_act_pipeline.dag</span>
                  <span style={{ color: '#34D399', fontSize: 11 }}>● STATE: VERIFIED</span>
                </div>
                <div style={{ color: '#A78BFA', marginBottom: 8 }}>
                  $ mochi --spec "refactor session auth to redis cluster &amp; update all call sites"
                </div>
                <div style={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.7 }}>
                  <div>[SPEC] Decomposing objective into formal dependency DAG...</div>
                  <div style={{ color: '#6EE7B7' }}>[SPEC] Call graph mapped: 3 mutation targets · 14 read-only consumers</div>
                  <div style={{ color: '#FDE047' }}>[SPEC] Token quota locked: 6,400 tokens · 0 runaway loops</div>
                  <div style={{ color: '#C084FC', marginTop: 6 }}>[ACT] Handoff approved → executing surgical AST mutator</div>
                  <div style={{ color: '#34D399' }}>[VERIFY] Bubblewrap sandbox test run: 32/32 tests green (138ms)</div>
                  <div style={{ color: '#34D399', fontWeight: 700 }}>✓ Atomic git checkpoint #a481c0 committed in 14ms</div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedContent>

        {/* Asymmetric Showcase 02: Surgical Tree-Sitter AST Diff Engine */}
        <AnimatedContent direction="right" delay={0.18} distance={45} blur={14}>
          <div className="editorial-split-showcase">
            <div className="editorial-split-left" style={{ background: '#FAF8FC' }}>
              <div className="editorial-dark-terminal" style={{ height: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: 10, marginBottom: 14 }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>src/auth/jwt.ts · AST Node: RateLimitPolicy</span>
                  <span style={{ color: '#34D399', fontSize: 11 }}>12MS SURGERY</span>
                </div>
                <div style={{ color: '#818CF8', marginBottom: 6 }}>
                  @@ -42,2 +42,2 @@ Tree-sitter AST Node: RateLimitPolicy
                </div>
                <div style={{ color: '#F87171', background: 'rgba(239, 68, 68, 0.12)', padding: '2px 6px', borderRadius: 4, marginBottom: 4 }}>
                  -   const maxRps = currentTier === 'free' ? 10 : 100;
                </div>
                <div style={{ color: '#34D399', background: 'rgba(52, 211, 153, 0.12)', padding: '2px 6px', borderRadius: 4, marginBottom: 8 }}>
                  +   const maxRps = currentTier === 'free' ? 25 : 250; // Surgical patch: 12ms
                </div>
                <div style={{ color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.6, fontSize: 12, borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 10 }}>
                  <div style={{ color: '#34D399' }}>✓ Tree-sitter grammar validated: 0 syntax errors</div>
                  <div style={{ color: '#A78BFA' }}>✓ 100% git blame preserved across surrounding 448 lines</div>
                  <div style={{ color: '#6EE7B7' }}>✓ 99.4% token waste eliminated vs whole-file rewrite</div>
                </div>
              </div>
            </div>

            <div className="editorial-split-right" style={{ background: '#ffffff' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800, color: '#8A67F6' }}>
                    02 // AST SURGICAL MUTATION
                  </span>
                  <span style={{ fontSize: 11, background: '#EDE8F8', color: '#111116', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                    Zero Hallucination
                  </span>
                </div>
                <h3 style={{ fontSize: 28, fontWeight: 850, color: '#111116', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 16 }}>
                  Surgical AST Differ vs. Naive File Rewriting
                </h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink-soft)', marginBottom: 24 }}>
                  Conventional coding agents rewrite entire 400-line files from scratch, burning 12,000+ tokens on unchanged boilerplate, hallucinating missing imports, and destroying git blame history. Mochi’s tree-sitter engine isolates the exact AST node and applies whitespace-tolerant unified patches in 12ms.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, background: '#F4EFFE', color: '#6D28D9', padding: '6px 12px', borderRadius: 8, fontWeight: 700 }}>
                  ✓ 99.4% Less Token Waste
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, background: '#ECFDF5', color: '#047857', padding: '6px 12px', borderRadius: 8, fontWeight: 700 }}>
                  ✓ 100% Git Blame Safe
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, background: '#EFF6FF', color: '#1D4ED8', padding: '6px 12px', borderRadius: 8, fontWeight: 700 }}>
                  ✓ Multi-File Single Pass
                </span>
              </div>
            </div>
          </div>
        </AnimatedContent>

        {/* 4-Column Hairline Architectural Foundation Strip */}
        <AnimatedContent direction="bottom" delay={0.22} distance={40} blur={14}>
          <div className="editorial-hairline-strip">
            {/* Column 01: Bubblewrap Sandbox */}
            <div className="editorial-hairline-col">
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#8A67F6', marginBottom: 8, textTransform: 'uppercase' }}>
                  03 // ISOLATION
                </div>
                <h4 style={{ fontSize: 18, fontWeight: 800, color: '#111116', marginBottom: 10 }}>
                  Bubblewrap Hardware Jail
                </h4>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 16px' }}>
                  Unprivileged user namespaces mount <code>/usr</code> and <code>/bin</code> read-only, blackhole <code>~/.ssh</code> and <code>~/.aws</code> via tmpfs masks, and prevent prompt breakouts.
                </p>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: '#EDE8F8', color: '#8A67F6', padding: '4px 10px', borderRadius: 6, fontWeight: 700, width: 'fit-content' }}>
                MOCHI_SANDBOX=bwrap
              </span>
            </div>

            {/* Column 02: Multi-Model Router */}
            <div className="editorial-hairline-col">
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#8A67F6', marginBottom: 8, textTransform: 'uppercase' }}>
                  04 // RESILIENCE
                </div>
                <h4 style={{ fontSize: 18, fontWeight: 800, color: '#111116', marginBottom: 10 }}>
                  Multi-Model Router
                </h4>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 16px' }}>
                  Hot-swap OpenCode Zen, Anthropic Claude 3.5 Sonnet, GPT-4o, DeepSeek, and local Ollama mid-session. Automatically detects 429 limits and backs off without lost state.
                </p>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: '#EDE8F8', color: '#8A67F6', padding: '4px 10px', borderRadius: 6, fontWeight: 700, width: 'fit-content' }}>
                Zero-Downtime Failover
              </span>
            </div>

            {/* Column 03: Deterministic Tools */}
            <div className="editorial-hairline-col">
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#8A67F6', marginBottom: 8, textTransform: 'uppercase' }}>
                  05 // DETERMINISM
                </div>
                <h4 style={{ fontSize: 18, fontWeight: 800, color: '#111116', marginBottom: 10 }}>
                  Sub-5ms Codebase Search
                </h4>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 16px' }}>
                  Native ripgrep indexing, AST symbol grep, and Git atomic rollback snapshots. Fast, cache-friendly, and bounded by strict privilege boundaries.
                </p>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: '#EDE8F8', color: '#8A67F6', padding: '4px 10px', borderRadius: 6, fontWeight: 700, width: 'fit-content' }}>
                3.8ms Grep Index
              </span>
            </div>

            {/* Column 04: Zero-Dep Bun Binary */}
            <div className="editorial-hairline-col">
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#8A67F6', marginBottom: 8, textTransform: 'uppercase' }}>
                  06 // RUNTIME
                </div>
                <h4 style={{ fontSize: 18, fontWeight: 800, color: '#111116', marginBottom: 10 }}>
                  Zero-Dep Bun Binary
                </h4>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 16px' }}>
                  Compiled into a single self-contained native executable. 18.2 MB peak resident RSS and 38.2 ms cold start — 21.2× lighter than Claude Code.
                </p>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: '#EDE8F8', color: '#8A67F6', padding: '4px 10px', borderRadius: 6, fontWeight: 700, width: 'fit-content' }}>
                18.2 MB RSS · 38.2 ms TTFI
              </span>
            </div>
          </div>
        </AnimatedContent>
      </div>
    </section>
  );
}

function SpecialistRolesSection() {
  const [selectedRole, setSelectedRole] = useState(SPECIALIST_ROLES[0]);

  return (
    <section className="section" id="roles" style={{ maxWidth: 1560, margin: '0 auto', padding: '60px 4vw', scrollMarginTop: 100 }}>
      <AnimatedContent direction="bottom" delay={0.05} blur={12}>
        <div className="section-tag-pill">
          <span className="tag-sparkle">✦</span>
          <span className="tag-part-dark">SECTION 03 /</span>
          <span className="tag-part-purple">DAG SWARMS</span>
        </div>
      </AnimatedContent>

      <EditorialReveal delay={0.1}>
        <div className="section-head-huge">
          <h2 className="section-title-huge">
            16 SPECIALIST <span className="accent-title">AGENT ROLES</span>
          </h2>
          <span className="section-arrow-diag-huge">↗</span>
        </div>
      </EditorialReveal>

      <AnimatedContent direction="left" delay={0.15} distance={30} blur={10}>
        <p className="section-desc" style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 36, maxWidth: 680 }}>
          Rather than relying on a single monolithic context window, Mochi dispatches dedicated micro-agents across dependency DAGs.
        </p>
      </AnimatedContent>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Left Column: Role Selector Grid */}
        <AnimatedContent direction="left" delay={0.1} distance={45} blur={14}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {SPECIALIST_ROLES.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                style={{
                  background: selectedRole.id === role.id ? '#F4EFFE' : '#ffffff',
                  border: selectedRole.id === role.id ? '2px solid #8A67F6' : '1.5px solid var(--line)',
                  borderRadius: 18,
                  padding: '18px 20px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedRole.id === role.id ? '0 6px 20px rgba(138, 103, 246, 0.16)' : '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#8A67F6', textTransform: 'uppercase' }}>
                    {role.tag}
                  </span>
                  <span style={{ fontSize: 11, background: '#EDE8F8', color: '#111116', padding: '3px 8px', borderRadius: 999, fontWeight: 600 }}>
                    {role.badge}
                  </span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111116', marginBottom: 4 }}>
                  {role.name}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                  {role.desc.substring(0, 72)}...
                </div>
              </button>
            ))}
          </div>
        </AnimatedContent>

        {/* Right Column: Detailed Role Inspector Card */}
        <AnimatedContent direction="right" delay={0.2} distance={45} blur={14}>
          <div
            style={{
              background: '#ffffff',
              borderRadius: 24,
              padding: 32,
              border: '1.5px solid rgba(138, 103, 246, 0.25)',
              boxShadow: '0 8px 32px rgba(138, 103, 246, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: '#8A67F6', color: '#ffffff', padding: '4px 12px', borderRadius: 999, fontWeight: 700 }}>
                  ACTIVE ROLE / {selectedRole.tag}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>
                  18.2 MB RSS · Sub-process Sandbox
                </span>
              </div>

              <h3 style={{ fontSize: 26, fontWeight: 850, color: '#111116', marginBottom: 12 }}>
                {selectedRole.name}
              </h3>

              <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink-soft)', marginBottom: 24 }}>
                {selectedRole.desc}
              </p>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800, color: '#111116', textTransform: 'uppercase', marginBottom: 10 }}>
                  Dedicated Subsystem Tools:
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selectedRole.tools.map((tool) => (
                    <span
                      key={tool}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        background: '#FAF8FC',
                        border: '1px solid #DCD6EE',
                        color: '#111116',
                        padding: '5px 12px',
                        borderRadius: 8,
                        fontWeight: 600,
                      }}
                    >
                      ⚡ {tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: '#110F1D', borderRadius: 16, padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: '#EDE9FE' }}>
              <div style={{ color: '#8A67F6', fontWeight: 700, marginBottom: 6 }}>
                // Task DAG Execution Telemetry
              </div>
              <div style={{ color: '#34D399' }}>
                ✓ Spawning {selectedRole.name} worker within Bubblewrap user namespace.
              </div>
              <div style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 }}>
                → Context budget allocated: 4,096 tokens (91% pruned) · 0 runaway loops.
              </div>
            </div>
          </div>
        </AnimatedContent>
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
    <section className="section" id="architecture" style={{ maxWidth: 1560, margin: '0 auto', padding: '60px 4vw', scrollMarginTop: 100 }}>
      <AnimatedContent direction="bottom" delay={0.05} blur={12}>
        <div className="section-tag-pill">
          <span className="tag-sparkle">✦</span>
          <span className="tag-part-dark">SECTION 04 /</span>
          <span className="tag-part-purple">ARCHITECTURE</span>
        </div>
      </AnimatedContent>

      <EditorialReveal delay={0.1}>
        <div className="section-head-huge">
          <h2 className="section-title-huge">
            ENGINEERED FOR <span className="accent-title">PRECISION</span>
          </h2>
          <span className="section-arrow-diag-huge">↗</span>
        </div>
      </EditorialReveal>

      <AnimatedContent direction="left" delay={0.15} distance={30} blur={10}>
        <p className="section-desc" style={{ maxWidth: 760, marginBottom: 32, fontSize: 17, color: 'var(--ink-soft)' }}>
          Inspect how Mochi’s Spec/Act dual-engine separation, AST surgical diffing, and unprivileged sandboxing outperform traditional AI agent wrappers.
        </p>
      </AnimatedContent>

      {/* Interactive Tabs Bar */}
      <AnimatedContent direction="left" delay={0.1} distance={45} blur={14}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '12px 20px',
                borderRadius: 14,
                border: activeTab === t.id ? '1.5px solid var(--purple)' : '1.5px solid var(--line)',
                background: activeTab === t.id ? 'var(--purple-lighter)' : '#ffffff',
                color: activeTab === t.id ? 'var(--purple-dark)' : 'var(--ink)',
                fontWeight: 700,
                fontSize: 14,
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
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: activeTab === t.id ? 'var(--purple)' : '#EDE8F5',
                  color: activeTab === t.id ? '#ffffff' : 'var(--purple-dark)',
                  fontWeight: 700,
                }}
              >
                {t.badge}
              </span>
            </button>
          ))}
        </div>
      </AnimatedContent>

      {/* Active Tab Interactive Display */}
      <AnimatedContent direction="right" delay={0.18} distance={50} blur={14}>
        <div
          style={{
            background: '#ffffff',
            borderRadius: 24,
            border: '1.5px solid rgba(139, 92, 246, 0.20)',
            boxShadow: 'var(--shadow-card)',
            padding: 34,
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 22, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--purple-dark)', marginBottom: 8 }}>
                  🛡️ Read-Only System Mounts
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>
                  <code>/usr</code>, <code>/bin</code>, and <code>/lib</code> mounted read-only via unprivileged <code>bwrap</code>. System binaries cannot be replaced or infected.
                </p>
              </div>

              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 22, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--purple-dark)', marginBottom: 8 }}>
                  🔒 Credential Blackhole
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>
                  <code>~/.ssh</code>, <code>~/.aws</code>, and <code>~/.gnupg</code> masked with isolated empty tmpfs filesystems. Prompt injections cannot exfiltrate user keys.
                </p>
              </div>

              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 22, border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--purple-dark)', marginBottom: 8 }}>
                  🌐 Strict Egress Control
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 18, border: '1px solid var(--line)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', fontWeight: 700 }}>TURN 1</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#111116', margin: '6px 0 4px' }}>Fast Model Execution</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>glm-5.3-flash attempts rapid edit batch (140ms).</div>
              </div>
              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 18, border: '1px solid var(--line)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#DC2626', fontWeight: 700 }}>TURN 2 (FAILED)</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#DC2626', margin: '6px 0 4px' }}>Stagnation Detected</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Compiler red test. 0 new files mutated. Breaker arms.</div>
              </div>
              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 18, border: '1.5px solid var(--purple)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--purple-dark)', fontWeight: 700 }}>TURN 3 (ESCALATE)</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--purple-dark)', margin: '6px 0 4px' }}>Model Auto-Handoff</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Escalates to kimi-k2.7-code with handoff diagnosis.</div>
              </div>
              <div style={{ background: '#FAF8FC', borderRadius: 16, padding: 18, border: '1.5px solid #059669', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#059669', fontWeight: 700 }}>VERIFIED PASS</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#059669', margin: '6px 0 4px' }}>Git Checkpoint</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>100% tests green. Atomic commit with zero rollbacks.</div>
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
      </AnimatedContent>
    </section>
  );
}

function AutonomousEcosystemSection() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      id: 'decompose',
      num: '01',
      title: 'Task Decomposition',
      role: 'Lead Orchestrator',
      tool: 'dag_dispatch',
      badge: 'TOKEN BUDGET LOCKED',
      desc: 'Parses ambiguous natural language prompts into a formal dependency DAG. Allocates token quotas per role and locks execution timeouts.',
      trace: [
        '$ mochi "add ed25519 jwt verification with redis cache & patch all call sites"',
        '-> [Lead] Decomposing objective into formal 3-phase execution DAG...',
        '-> [Lead] Phase 1: architect_slice · Phase 2: ast_patch · Phase 3: test_runner',
        '-> [Lead] Token budget locked: 8,000 tokens · Abort timeout: 60s',
      ],
      metrics: ['1 Objective', '3 DAG Nodes', '0 Ambiguity'],
    },
    {
      id: 'slice',
      num: '02',
      title: 'Monorepo AST Slicing',
      role: 'System Architect',
      tool: 'ripgrep + ast_slicer',
      badge: '4.2MS RECONNAISSANCE',
      desc: 'Uses tree-sitter AST queries and ripgrep searches to build call graphs, identifying exact mutation targets and read-only consumers across monorepos.',
      trace: [
        '-> [Architect] Scanning codebase for JwtValidator symbol references...',
        '-> [Architect] Ripgrep returned 14 candidate files in 4.2ms',
        '-> [Architect] AST Callgraph: 2 mutation targets, 12 read-only consumers',
        '-> [Architect] Zero breaking signature changes detected. Handoff to Coder.',
      ],
      metrics: ['14 Files Indexed', '2 Targets', '0 Breaking Diffs'],
    },
    {
      id: 'patch',
      num: '03',
      title: 'Surgical AST Patching',
      role: 'Core Coder',
      tool: 'apply_ast_patch',
      badge: 'WHITESPACE-TOLERANT',
      desc: 'Applies whitespace-tolerant unified diffs without dropping imports or surrounding comments. Preserves 100% git blame integrity.',
      trace: [
        '-> [Coder] Slicing AST scope: JwtValidator.verifyToken in src/auth/jwt.ts',
        '-> [Coder] Applying unified diff (+18 lines, -4 lines)',
        '-> [Coder] Tree-sitter grammar validated: 0 syntax errors, 0 lost imports',
        '-> [Coder] Atomic working tree patch applied in 8.4ms',
      ],
      metrics: ['18 Insertions', '4 Deletions', '100% Blame Preserved'],
    },
    {
      id: 'jail',
      num: '04',
      title: 'Sandboxed Verification',
      role: 'QA Tester',
      tool: 'bwrap_spawn',
      badge: 'HARDWARE USER NAMESPACES',
      desc: 'Compiles and runs test suites inside unprivileged Linux Bubblewrap containers with network egress blocked and host credentials masked.',
      trace: [
        '-> [Tester] Spawning ephemeral bwrap container: ~/.ssh & ~/.aws masked (tmpfs)',
        '-> [Tester] Executing test suite inside container: bun test src/auth/jwt.test.ts',
        '-> [Tester] Test runner: 28/28 assertions passing (142ms)',
        '-> [Tester] Zero memory leaks, exit code 0. Handoff to Release Lead.',
      ],
      metrics: ['28/28 Passing', '0 Key Leakage', '142ms Duration'],
    },
    {
      id: 'commit',
      num: '05',
      title: 'Atomic Git Checkpoint',
      role: 'Release Lead',
      tool: 'checkpoint_commit',
      badge: '12MS ROLLBACK SNAPSHOT',
      desc: 'Approved passes commit with clean conventional changelog metadata and an instant 12ms rollback snapshot for one-click recovery.',
      trace: [
        '-> [Git] Creating commit: "feat(auth): ed25519 jwt verification with redis caching"',
        '-> [Git] Checkpoint #82f1b4 created · 12ms revert snapshot active',
        '-> [Git] 100% mechanical verification green. Ready for pull request merge.',
      ],
      metrics: ['1 Commit', '1 Checkpoint', '0 Rollback Ghost Files'],
    },
  ];

  const current = steps[activeStep];

  return (
    <section className="section" id="pipeline" style={{ maxWidth: 1560, margin: '0 auto', padding: '60px 4vw', scrollMarginTop: 100 }}>
      <AnimatedContent direction="bottom" delay={0.05} blur={12}>
        <div className="section-tag-pill">
          <span className="tag-sparkle">✦</span>
          <span className="tag-part-dark">SECTION 05 /</span>
          <span className="tag-part-purple">AUTONOMOUS SWARM DAG</span>
        </div>
      </AnimatedContent>

      <EditorialReveal delay={0.1}>
        <div className="section-head-huge">
          <h2 className="section-title-huge">
            THE SWARM EXECUTION <span className="accent-title">DAG PIPELINE</span>
          </h2>
          <span className="section-arrow-diag-huge">↗</span>
        </div>
      </EditorialReveal>

      <AnimatedContent direction="left" delay={0.15} distance={30} blur={10}>
        <p className="section-desc" style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 40, maxWidth: 700 }}>
          From ambiguous objective to verified atomic git commit: follow how Mochi coordinates multi-role subagent swarms across directed acyclic graphs.
        </p>
      </AnimatedContent>

      {/* Stepper Navigation */}
      <AnimatedContent direction="left" delay={0.1} distance={40} blur={14}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
          {steps.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setActiveStep(idx)}
              style={{
                padding: '16px 18px',
                borderRadius: 18,
                border: activeStep === idx ? '1.5px solid var(--purple)' : '1px solid var(--line)',
                background: activeStep === idx ? '#1A1633' : '#ffffff',
                color: activeStep === idx ? '#ffffff' : 'var(--ink)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: activeStep === idx ? '0 6px 20px rgba(138, 103, 246, 0.22)' : 'var(--shadow-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: activeStep === idx ? '#A78BFA' : '#8A67F6' }}>
                  STAGE {s.num}
                </span>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: 4, background: activeStep === idx ? 'rgba(255, 255, 255, 0.15)' : '#F4EFFE', color: activeStep === idx ? '#ffffff' : '#8A67F6' }}>
                  {s.role.split(' ')[0]}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                {s.title}
              </div>
            </button>
          ))}
        </div>
      </AnimatedContent>

      {/* Active Stage Detailed Display */}
      <AnimatedContent direction="right" delay={0.15} distance={45} blur={14}>
        <div
          style={{
            background: '#ffffff',
            borderRadius: 28,
            border: '1.5px solid rgba(138, 103, 246, 0.2)',
            padding: '36px 32px',
            boxShadow: 'var(--shadow-card)',
            marginBottom: 40,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: '#8A67F6' }}>
                  STAGE {current.num} / {current.title.toUpperCase()}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: '#F4EFFE', color: '#6D28D9', padding: '3px 10px', borderRadius: 999, fontWeight: 700 }}>
                  {current.role}
                </span>
              </div>
              <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
                {current.desc}
              </p>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: '#EDE9FE', color: 'var(--purple-dark)', padding: '6px 14px', borderRadius: 999, fontWeight: 700 }}>
              {current.badge}
            </span>
          </div>

          {/* Live Terminal Output Block */}
          <div style={{ background: '#110F1D', borderRadius: 18, padding: '20px 24px', fontFamily: 'var(--font-mono)', fontSize: 13, border: '1px solid rgba(139, 92, 246, 0.3)', marginBottom: 20 }}>
            <div style={{ color: 'rgba(255, 255, 255, 0.4)', marginBottom: 12, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>mochi-session · agent_trace.log</span>
              <span style={{ color: '#34D399' }}>● LIVE EXECUTION</span>
            </div>
            {current.trace.map((line, i) => (
              <div
                key={i}
                style={{
                  color: line.startsWith('$') ? '#A78BFA' : line.includes('PASS') || line.includes('passing') || line.includes('green') ? '#34D399' : '#E2E8F0',
                  lineHeight: 1.8,
                }}
              >
                {line}
              </div>
            ))}
          </div>

          {/* Metrics Bar */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {current.metrics.map((m, i) => (
              <span
                key={i}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 700,
                  background: '#FAF8FC',
                  color: '#111116',
                  border: '1px solid var(--line)',
                  padding: '6px 14px',
                  borderRadius: 10,
                }}
              >
                ✓ {m}
              </span>
            ))}
          </div>
        </div>
      </AnimatedContent>

      {/* Architectural Specification Ledger */}
      <AnimatedContent direction="bottom" delay={0.18} distance={35} blur={14}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color: '#8A67F6', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              // RUNTIME SPECIFICATIONS &amp; PROTOCOLS
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-soft)' }}>
              6 SYSTEM BOUNDARIES
            </span>
          </div>

          <div className="editorial-spec-ledger">
            {/* Spec 01 */}
            <div className="editorial-spec-cell">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#8A67F6' }}>01 // PROTOCOL</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: '#F4EFFE', color: '#6D28D9', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>stdio + sse</span>
                </div>
                <h4 style={{ fontSize: 17, fontWeight: 800, color: '#111116', marginBottom: 8 }}>Model Context Protocol (MCP)</h4>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
                  Connects seamlessly to any external MCP tool server over stdio and SSE protocols, enabling custom database, browser, and enterprise tools.
                </p>
              </div>
            </div>

            {/* Spec 02 */}
            <div className="editorial-spec-cell">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#8A67F6' }}>02 // INFERENCE</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: '#F4EFFE', color: '#6D28D9', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>auto-backoff</span>
                </div>
                <h4 style={{ fontSize: 17, fontWeight: 800, color: '#111116', marginBottom: 8 }}>Multi-Provider Router</h4>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
                  Hot-swap OpenCode Zen, Anthropic Claude 3.5 Sonnet, GPT-4o, DeepSeek, and local Ollama mid-session with automatic 429 backoff.
                </p>
              </div>
            </div>

            {/* Spec 03 */}
            <div className="editorial-spec-cell">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#8A67F6' }}>03 // SECURITY</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: '#F4EFFE', color: '#6D28D9', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>tmpfs mask</span>
                </div>
                <h4 style={{ fontSize: 17, fontWeight: 800, color: '#111116', marginBottom: 8 }}>Bubblewrap Jail</h4>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
                  Hardware unprivileged namespaces mask your SSH keys, AWS credentials, and environment variables from rogue prompts.
                </p>
              </div>
            </div>

            {/* Spec 04 */}
            <div className="editorial-spec-cell">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#8A67F6' }}>04 // SYNTAX</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: '#F4EFFE', color: '#6D28D9', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>tree-sitter AST</span>
                </div>
                <h4 style={{ fontSize: 17, fontWeight: 800, color: '#111116', marginBottom: 8 }}>Tree-sitter AST Differ</h4>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
                  Real-time semantic syntax tree parsing across TypeScript, Rust, Python, Go, and C for surgical token-level patch applications.
                </p>
              </div>
            </div>

            {/* Spec 05 */}
            <div className="editorial-spec-cell">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#8A67F6' }}>05 // VERIFICATION</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: '#ECFDF5', color: '#047857', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>compiler gate</span>
                </div>
                <h4 style={{ fontSize: 17, fontWeight: 800, color: '#111116', marginBottom: 8 }}>Mechanical Gate</h4>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
                  Zero unverified code reaches disk; strict compiler diagnostics, test runners, and static analyzers gate every commit.
                </p>
              </div>
            </div>

            {/* Spec 06 */}
            <div className="editorial-spec-cell">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#8A67F6' }}>06 // RUNTIME</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: '#EDE8F8', color: '#8A67F6', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>18.2 MB RSS</span>
                </div>
                <h4 style={{ fontSize: 17, fontWeight: 800, color: '#111116', marginBottom: 8 }}>Zero-Dep Bun Binary</h4>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
                  Compiled into a single self-contained native executable with 18.2 MB peak resident RSS and 38.2 ms cold start.
                </p>
              </div>
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
    <section className="section" id="benchmarks" style={{ maxWidth: 1560, margin: '0 auto', padding: '60px 4vw', scrollMarginTop: 100 }}>
      <AnimatedContent direction="bottom" delay={0.05} blur={12}>
        <div className="section-tag-pill">
          <span className="tag-sparkle">✦</span>
          <span className="tag-part-dark">SECTION 06 /</span>
          <span className="tag-part-purple">MEASURED RECEIPTS</span>
        </div>
      </AnimatedContent>

      <EditorialReveal delay={0.1}>
        <div className="section-head-huge">
          <h2 className="section-title-huge">
            MEASURED. VERIFIED. <span className="accent-title">REPEATED.</span>
          </h2>
          <span className="section-arrow-diag-huge">↗</span>
        </div>
      </EditorialReveal>

      <AnimatedContent direction="left" delay={0.15} distance={30} blur={10}>
        <p className="section-desc" style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 40, maxWidth: 680 }}>
          Every benchmark on this site is measured empirically with Valgrind massif and high-resolution wall clocks on standard Linux x86_64 machines. Zero synthetic marketing claims.
        </p>
      </AnimatedContent>

      {/* Two-Column Responsive Chart Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 32, marginBottom: 40 }}>
        <AnimatedContent direction="left" delay={0.2}>
          <div
            style={{
              background: '#ffffff',
              padding: '36px 32px',
              borderRadius: 24,
              border: '1.5px solid rgba(138, 103, 246, 0.25)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    color: '#111116',
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
                    fontWeight: 850,
                  }}
                >
                  Peak Resident RSS (MB)
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                  Valgrind massif heap + stack measurement (Lower is better)
                </div>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  background: '#EDE8F8',
                  color: '#8A67F6',
                  padding: '4px 10px',
                  borderRadius: 8,
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
              padding: '36px 32px',
              borderRadius: 24,
              border: '1.5px solid rgba(138, 103, 246, 0.25)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    color: '#111116',
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
                    fontWeight: 850,
                  }}
                >
                  Cold Start TTFI (ms)
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                  Process exec to interactive prompt loop (Lower is better)
                </div>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  background: '#EDE8F8',
                  color: '#8A67F6',
                  padding: '4px 10px',
                  borderRadius: 8,
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

      {/* Comprehensive Fullscreen Architectural Comparison Matrix */}
      <AnimatedContent direction="bottom" delay={0.2} distance={45} blur={14}>
        <div
          style={{
            background: '#ffffff',
            borderRadius: 24,
            border: '1.5px solid var(--line)',
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '24px 30px', borderBottom: '1px solid var(--line)', background: '#FAF8FC' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111116', margin: 0 }}>
              Comprehensive Agent Architecture Matrix
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '4px 0 0' }}>
              Empirical runtime capabilities across major autonomous terminal and IDE agents.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: '#F4EFFE', borderBottom: '1.5px solid rgba(138, 103, 246, 0.2)' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 800, color: '#111116' }}>Capability</th>
                  <th style={{ padding: '14px 20px', fontWeight: 800, color: '#8A67F6' }}>Mochi (v0.22.0)</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700, color: '#111116' }}>Claude Code</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700, color: '#111116' }}>Cursor Agent</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700, color: '#111116' }}>Aider</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700, color: '#111116' }}>OpenCode</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#111116' }}>Peak Resident Memory</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#059669' }}>18.2 MB (Bun)</td>
                  <td style={{ padding: '14px 20px', color: '#DC2626' }}>386.6 MB (Node)</td>
                  <td style={{ padding: '14px 20px', color: '#4B5563' }}>214.9 MB (Electron)</td>
                  <td style={{ padding: '14px 20px', color: '#4B5563' }}>188.0 MB (Python)</td>
                  <td style={{ padding: '14px 20px', color: '#DC2626' }}>371.5 MB (Node)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#111116' }}>Cold Start TTFI</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#059669' }}>38.2 ms</td>
                  <td style={{ padding: '14px 20px', color: '#DC2626' }}>172.4 ms</td>
                  <td style={{ padding: '14px 20px', color: '#4B5563' }}>121.5 ms</td>
                  <td style={{ padding: '14px 20px', color: '#4B5563' }}>145.2 ms</td>
                  <td style={{ padding: '14px 20px', color: '#DC2626' }}>168.3 ms</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#111116' }}>Hardware Sandboxing</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#059669' }}>Bubblewrap (bwrap)</td>
                  <td style={{ padding: '14px 20px', color: '#DC2626' }}>None (Direct Host)</td>
                  <td style={{ padding: '14px 20px', color: '#DC2626' }}>None (Direct Host)</td>
                  <td style={{ padding: '14px 20px', color: '#DC2626' }}>None (Direct Host)</td>
                  <td style={{ padding: '14px 20px', color: '#DC2626' }}>None (Direct Host)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#111116' }}>Multi-Tab Pinned Sessions</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#059669' }}>Native TUI Tabs</td>
                  <td style={{ padding: '14px 20px', color: '#DC2626' }}>Single terminal</td>
                  <td style={{ padding: '14px 20px', color: '#4B5563' }}>GUI Composer tabs</td>
                  <td style={{ padding: '14px 20px', color: '#DC2626' }}>Single terminal</td>
                  <td style={{ padding: '14px 20px', color: '#4B5563' }}>Multiple sessions</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#111116' }}>AST Diff Mutations</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#059669' }}>Tree-sitter 12ms</td>
                  <td style={{ padding: '14px 20px', color: '#4B5563' }}>Whole block replace</td>
                  <td style={{ padding: '14px 20px', color: '#4B5563' }}>Fuzzy regex patch</td>
                  <td style={{ padding: '14px 20px', color: '#4B5563' }}>Unified diff / search</td>
                  <td style={{ padding: '14px 20px', color: '#4B5563' }}>Whole file replace</td>
                </tr>
                <tr>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#111116' }}>License &amp; Source</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#059669' }}>100% MIT Open Source</td>
                  <td style={{ padding: '14px 20px', color: '#DC2626' }}>Proprietary Closed</td>
                  <td style={{ padding: '14px 20px', color: '#DC2626' }}>Proprietary Closed</td>
                  <td style={{ padding: '14px 20px', color: '#059669' }}>Apache 2.0</td>
                  <td style={{ padding: '14px 20px', color: '#059669' }}>MIT Open Source</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </AnimatedContent>
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
    <div className="coda-wrap" style={{ maxWidth: 1560, margin: '40px auto 80px', padding: '0 4vw' }}>
      <div
        className="coda-banner"
        style={{
          background: 'linear-gradient(135deg, #FAF8FC 0%, #F3EEFD 100%)',
          borderRadius: 28,
          border: '1.5px solid rgba(138, 103, 246, 0.3)',
          boxShadow: '0 12px 48px rgba(138, 103, 246, 0.14)',
          padding: '48px 44px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          alignItems: 'center',
          gap: 36,
        }}
      >
        {/* Left Column: Bold, deep black readable typography */}
        <AnimatedContent direction="left" delay={0.1} distance={45} blur={14}>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 580 }}>
            <h2 style={{ color: '#111116', fontSize: 'clamp(32px, 4vw, 46px)', fontWeight: 850, marginBottom: 14, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Ready to Build with Mochi?
            </h2>
            <p style={{ color: '#22222B', fontSize: 17, lineHeight: 1.65, marginBottom: 28, fontWeight: 500 }}>
              Experience the lightest, fastest autonomous coding intelligence for your terminal. Single standalone Bun binary, compiled Rust core, and 0 external dependencies.
            </p>

            {/* Quick Install Snippet */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#ffffff',
                border: '1.5px solid rgba(138, 103, 246, 0.28)',
                borderRadius: 14,
                padding: '8px 16px',
                marginBottom: 28,
                gap: 14,
                boxShadow: '0 2px 10px rgba(138, 103, 246, 0.08)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, color: '#111116', fontWeight: 800 }}>
                curl -fsSL https://mochi.sh | sh
              </span>
              <button
                onClick={copyInstall}
                style={{
                  background: '#8A67F6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <a
                href="https://github.com/xanstomper/mochi/releases"
                className="btn btn-primary hero-btn-dl"
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
                className="btn btn-outline hero-btn-docs"
                style={{ textDecoration: 'none' }}
              >
                Read the Docs →
              </a>
            </div>
          </div>
        </AnimatedContent>

        {/* Right Column: User's GIF in sleek dark terminal frame */}
        <AnimatedContent direction="right" delay={0.2} distance={45} blur={14}>
          <div
            style={{
              background: '#110F1D',
              borderRadius: 20,
              padding: '16px 16px 20px',
              border: '1.5px solid rgba(138, 103, 246, 0.35)',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12, paddingLeft: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', marginLeft: 8 }}>
                mochi-terminal-session.gif
              </span>
            </div>
            <img
              src={base + '/IMG_3098.gif'}
              alt="Mochi Autonomous Terminal Demo"
              style={{
                width: '100%',
                borderRadius: 12,
                display: 'block',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            />
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              Live session trace: autonomous multi-pass verification loop
            </div>
          </div>
        </AnimatedContent>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <EngineeringGridBackground />
      <HeroSection />
      <StatsTicker />
      <CapabilitiesSection />
      <SpecialistRolesSection />
      <ArchitectureSection />
      <AutonomousEcosystemSection />
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
