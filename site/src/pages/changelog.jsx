import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import { AnimatedContent } from '../anim.jsx';

const FEATURED_RELEASES = [
  {
    version: 'v0.2.0',
    isNew: true,
    date: 'Apr 28, 2025',
    title: 'Improved code generation & faster agent loop',
    bullets: [
      'Better handling of complex multi-file changes across large repositories',
      '30% faster response times with streaming speculative tokens',
      'Improved automated error recovery and compiler linter hooks',
    ],
  },
  {
    version: 'v0.1.2',
    isNew: false,
    date: 'Apr 15, 2025',
    title: 'Added support for custom frameworks',
    bullets: [
      'Native presets for Next.js, React, Vue, Svelte, and Bun',
      'Better project understanding via Tree-sitter AST symbol maps',
      'New CLI flags: -p, --auto, --workspace, and --model overrides',
    ],
  },
  {
    version: 'v0.1.0',
    isNew: false,
    date: 'Mar 30, 2025',
    title: 'Initial release',
    bullets: [
      'Core autonomous coding agent loop with 16 specialist roles',
      'Zero-dependency standalone binary compiled with Bun runtime',
      'Deterministic file editing with atomic git snapshots and rollback',
    ],
  },
];

const HISTORICAL_RELEASES = [
  {
    version: 'v0.5.2',
    date: 'Oct 2026',
    summary: 'Standalone native executable builds (dist/mochi-bin) via Bun with zero runtime dependencies. Memoized OpenAI-compatible tool schemas.',
  },
  {
    version: 'v0.5.1',
    date: 'Oct 2026',
    summary: 'ContextEngine caching for project rules and memory. bench/efficiency suite measuring cold-start wall time (~50ms) and peak RSS (~41MB).',
  },
  {
    version: 'v0.5.0',
    date: 'Oct 2026',
    summary: 'Persistent UsageStore tracking token/cost metrics, /plan and /approve commands, known-good baseline snapshots, and Tree-sitter AST symbol backend.',
  },
  {
    version: 'v0.3.0',
    date: 'Oct 2026',
    summary: 'Incremental SSE stream parser, microtask event batch scheduler, dirty-region terminal renderer with smooth typing animation.',
  },
];

export default function Changelog() {
  const [showHistory, setShowHistory] = useState(false);
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
                  UPDATES
                </div>
              </AnimatedContent>

              <h1 className="hero-title">
                What’s New <span className="accent-title">in Mochi.</span>
              </h1>

              <AnimatedContent direction="bottom" delay={0.2}>
                <p className="lede">
                  We ship updates frequently to make Mochi faster, smarter, and more capable. Here’s what’s new.
                </p>
              </AnimatedContent>
            </div>

            {/* Mascot with "new stuff!" doodle matching Image 2 Panel 4 */}
            <AnimatedContent direction="right" delay={0.2}>
              <div className="subpage-mascot-wrap">
                <div className="subpage-doodle">new stuff!</div>
                <Mochi size={140} />
              </div>
            </AnimatedContent>
          </div>

          {/* 3 Timeline Feature Cards matching Image 2 Panel 4 */}
          <div className="timeline">
            {FEATURED_RELEASES.map((rel, i) => (
              <AnimatedContent key={rel.version} direction="bottom" delay={i * 0.1}>
                <div className="timeline-entry">
                  <div className="timeline-marker" />
                  <div className="timeline-content">
                    <div className="timeline-head">
                      <span className="timeline-version">{rel.version}</span>
                      {rel.isNew && <span className="timeline-badge">NEW</span>}
                      <span className="timeline-date">{rel.date}</span>
                    </div>

                    <h3 className="timeline-title">{rel.title}</h3>

                    <div className="timeline-body">
                      <ul>
                        {rel.bullets.map((b, bi) => (
                          <li key={bi}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </AnimatedContent>
            ))}
          </div>

          {/* Stay Updated Card matching Image 2 Panel 4 */}
          <AnimatedContent direction="bottom" delay={0.35}>
            <div className="stay-updated-card">
              <div>
                <h4>Want to stay updated?</h4>
                <p>Follow us for the latest releases, performance benchmarks, and announcements.</p>
              </div>
              <a
                href="https://x.com/xanstomper"
                target="_blank"
                rel="noopener"
                className="btn btn-secondary"
                style={{ whiteSpace: 'nowrap' }}
              >
                𝕏 Follow on X
              </a>
            </div>
          </AnimatedContent>

          {/* Full release history drawer */}
          <div style={{ maxWidth: 820, margin: '36px auto 0', textAlign: 'center' }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="btn btn-outline"
              style={{ fontSize: 13.5, padding: '10px 24px' }}
            >
              {showHistory ? 'Hide Complete History ↑' : 'View Full Historical Archive (31 Releases) ↓'}
            </button>

            {showHistory && (
              <div style={{ marginTop: 24, textAlign: 'left', background: '#ffffff', borderRadius: 20, padding: '24px 28px', border: '1.5px solid var(--line)', boxShadow: 'var(--shadow-card)' }}>
                <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--ink)' }}>
                  Complete Historical Changelog
                </h4>
                <div style={{ display: 'grid', gap: 14 }}>
                  {HISTORICAL_RELEASES.map(h => (
                    <div key={h.version} style={{ paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--purple-dark)' }}>
                          {h.version}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {h.date}
                        </span>
                      </div>
                      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                        {h.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dark CTA Banner matching Image 2 Panel 5 */}
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

      <Footer />
    </>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<Changelog />);
}
