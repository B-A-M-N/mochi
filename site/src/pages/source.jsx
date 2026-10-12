import React from 'react';
import { createRoot } from 'react-dom/client';
import RepoBrowser from '../RepoBrowser.jsx';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import { AnimatedContent } from '../anim.jsx';

const FEATURES = [
  {
    icon: '🌐',
    title: 'Open Source',
    desc: 'Transparent, community-driven, and always open. Audit every line of code on GitHub.',
    link: 'https://github.com/xanstomper/mochi',
  },
  {
    icon: '🤝',
    title: 'Contribute',
    desc: 'Help us improve Mochi with code, documentation, benchmarks, and community feedback.',
    link: 'https://github.com/xanstomper/mochi/blob/main/CONTRIBUTING.md',
  },
  {
    icon: '💬',
    title: 'Join the Community',
    desc: 'Get support, share workflows, and connect with thousands of terminal agent builders.',
    link: 'https://github.com/xanstomper/mochi/discussions',
  },
];

const MARQUEE_ITEMS = [
  'REPO: XANSTOMPER/MOCHI',
  'BRANCH: MAIN',
  'LIVE FROM GITHUB',
  'MIT LICENSE',
  'ZERO DEPENDENCIES',
  '727 FILES AUDITED',
  '1,200 TESTS PASSING',
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
                  OPEN SOURCE
                </div>
              </AnimatedContent>

              <h1 className="hero-title">
                Open Source <span className="accent-title">and Always Free.</span>
              </h1>

              <AnimatedContent direction="bottom" delay={0.2}>
                <p className="lede">
                  Mochi is open source. Build, contribute, and make it better together with our community.
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

            {/* Mascot with "built by the community ♡" and heart doodle */}
            <AnimatedContent direction="right" delay={0.2}>
              <div className="subpage-mascot-wrap">
                <div className="subpage-doodle">built by the community ♡</div>
                <div style={{ position: 'relative' }}>
                  <span className="heart-doodle">♡</span>
                  <Mochi size={180} />
                </div>
              </div>
            </AnimatedContent>
          </div>
        </div>
      </div>

      {/* Marquee Banner matching Image 2 Panel 5 */}
      <div className="marquee-wrap">
        <div className="marquee-content">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="marquee-item">
              ✦ {item}
            </span>
          ))}
        </div>
      </div>

      {/* 3 Feature Cards matching Image 2 Panel 5 */}
      <div className="wrap" style={{ marginBottom: 48 }}>
        <div className="grid3" style={{ marginBottom: 40 }}>
          {FEATURES.map((f, i) => (
            <AnimatedContent key={f.title} direction="bottom" delay={i * 0.08}>
              <a
                href={f.link}
                target="_blank"
                rel="noopener"
                className="card"
              >
                <div className="card-icon">{f.icon}</div>
                <h3 className="card-title">
                  <span>{f.title}</span>
                  <span className="card-arrow">→</span>
                </h3>
                <p className="card-desc">{f.desc}</p>
              </a>
            </AnimatedContent>
          ))}
        </div>

        {/* Live Interactive Code Browser */}
        <div style={{ marginTop: 24 }}>
          <RepoBrowser />
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
  createRoot(rootEl).render(<Source />);
}
