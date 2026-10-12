import React from 'react';
import { createRoot } from 'react-dom/client';
import RepoBrowser from '../RepoBrowser.jsx';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import { AnimatedContent } from '../anim.jsx';

const FEATURES = [
  {
    icon: '🌐',
    title: 'Open Source & Permissive',
    desc: 'Transparent, community-driven, and released under the MIT license. Audit every line of Rust and TypeScript on GitHub.',
    link: 'https://github.com/xanstomper/mochi',
  },
  {
    icon: '🤝',
    title: 'Contribution Guidelines',
    desc: 'Help us improve Mochi with code, documentation, benchmarks, and community feedback. Strict CI/CD quality gates.',
    link: 'https://github.com/xanstomper/mochi/blob/main/CONTRIBUTING.md',
  },
  {
    icon: '💬',
    title: 'Community Discussions',
    desc: 'Get support, share workflows, propose skills, and connect with thousands of terminal agent developers.',
    link: 'https://github.com/xanstomper/mochi/discussions',
  },
];

const TELEMETRY_BLOCKS = [
  { val: '727', label: 'SOURCE FILES AUDITED', desc: 'Zero dead code or dangling unused dependencies' },
  { val: '1,200', label: 'TESTS PASSING', desc: 'Vitest, unit, and headless integration tests passing (100%)' },
  { val: '0', label: 'RUNTIME DEPENDENCIES', desc: 'Single self-contained Bun executable with Rust core' },
  { val: 'MIT', label: 'OPEN SOURCE LICENSE', desc: 'Free for personal, academic, and commercial use' },
];

const MARQUEE_ITEMS = [
  'REPO: XANSTOMPER/MOCHI',
  'BRANCH: MAIN',
  'LIVE FROM GITHUB',
  'MIT LICENSE',
  'ZERO DEPENDENCIES',
  '727 FILES AUDITED',
  '1,200 TESTS PASSING',
  'COMPILED RUST CORE',
  'BUBBLEWRAP SANDBOX',
];

export default function Source() {
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
                  OPEN SOURCE & TRANSPARENT
                </div>
              </AnimatedContent>

              <h1 className="hero-title">
                Open Source <span className="accent-title">and Always Free.</span>
              </h1>

              <AnimatedContent direction="bottom" delay={0.2}>
                <p className="hero-sub" style={{ maxWidth: 640 }}>
                  Mochi is 100% open source under the MIT license. Explore the live interactive repository tree, inspect our pure-Rust core tokenizer, or contribute pull requests to the project.
                </p>
              </AnimatedContent>

              <AnimatedContent direction="bottom" delay={0.3}>
                <div className="hero-actions" style={{ marginTop: 24 }}>
                  <a
                    href="https://github.com/xanstomper/mochi"
                    target="_blank"
                    rel="noopener"
                    className="btn btn-primary"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                    View on GitHub
                  </a>
                  <a
                    href="https://github.com/xanstomper/mochi/blob/main/CONTRIBUTING.md"
                    target="_blank"
                    rel="noopener"
                    className="btn btn-secondary"
                  >
                    Contribute →
                  </a>
                </div>
              </AnimatedContent>
            </div>

            {/* Custom Source Mascot: Community Builder Mochi with open-source heart & git node */}
            <AnimatedContent direction="right" delay={0.2}>
              <div className="subpage-mascot-wrap">
                <div className="subpage-doodle">built by the community ♡</div>
                <div style={{ position: 'relative' }}>
                  <span className="heart-doodle">♡</span>
                  <Mochi variant="source" size={180} />
                </div>
              </div>
            </AnimatedContent>
          </div>

          {/* 3 Cards */}
          <div className="grid3" style={{ marginTop: 44, marginBottom: 48 }}>
            {FEATURES.map((f, i) => (
              <AnimatedContent key={f.title} direction="bottom" delay={i * 0.08}>
                <a
                  href={f.link}
                  target="_blank"
                  rel="noopener"
                  className="card"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="card-icon">{f.icon}</div>
                  <h3 className="card-title">
                    <span>{f.title}</span>
                    <span className="card-arrow">↗</span>
                  </h3>
                  <p className="card-desc">{f.desc}</p>
                </a>
              </AnimatedContent>
            ))}
          </div>

          {/* Repository Telemetry Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 52 }}>
            {TELEMETRY_BLOCKS.map((b, i) => (
              <AnimatedContent key={b.label} direction="bottom" delay={i * 0.06}>
                <div style={{ background: '#ffffff', borderRadius: 20, padding: '24px 20px', border: '1.5px solid var(--line)', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--purple-dark)', marginBottom: 4 }}>
                    {b.val}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                    {b.label}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                    {b.desc}
                  </div>
                </div>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </div>

      {/* Marquee Ticker */}
      <div className="stats-ticker" style={{ marginBottom: 40 }} aria-hidden="true">
        <div className="ticker-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="ticker-item">
              <span className="ticker-dot" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Interactive Repo Browser */}
      <div className="wrap" style={{ marginBottom: 80 }}>
        <AnimatedContent direction="bottom">
          <div style={{ background: '#ffffff', borderRadius: 24, padding: '32px 28px', border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>
                  Interactive Repository Explorer
                </h3>
                <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '4px 0 0' }}>
                  Browse through Mochi's directory tree, inspect modules, and view source files live in the browser.
                </p>
              </div>
              <a
                href="https://github.com/xanstomper/mochi"
                target="_blank"
                rel="noopener"
                className="btn btn-outline"
                style={{ fontSize: 13, padding: '8px 18px' }}
              >
                Open on GitHub ↗
              </a>
            </div>
            <RepoBrowser />
          </div>
        </AnimatedContent>
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
                Download Mochi
              </a>
              <a
                href="https://github.com/xanstomper/mochi"
                className="btn btn-outline"
                target="_blank"
                rel="noopener"
                style={{ background: 'transparent', borderColor: 'rgba(255, 255, 255, 0.35)', color: '#ffffff' }}
              >
                Star Repository ↗
              </a>
            </div>
          </div>
          <div className="coda-peeking-mascot">
            <Mochi variant="source" size={220} />
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<Source />);
}
