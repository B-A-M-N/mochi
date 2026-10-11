import React from 'react';
import { createRoot } from 'react-dom/client';
import RepoBrowser from '../RepoBrowser.jsx';
import Footer from '../Footer.jsx';
import { AnimatedContent } from '../anim.jsx';

function Source() {
  return (
    <>
      <div className="pagehead">
        <div className="wrap">
          <div className="pagehead-inner">
            <div className="hero-badge">
              <span className="badge-glow" />
              <span className="badge-pill">SOURCE TREE</span>
              <span>MIT Licensed · Zero Dependencies · 727 Files</span>
            </div>
            <h1 className="pagehead-title">Read every line.</h1>
            <p className="pagehead-lede">
              MIT licensed, zero runtime dependencies, 727 files — every subsystem is fully auditable. Browse the live repository tree below or clone it directly.
            </p>
            <div className="source-actions">
              <a href="https://github.com/xanstomper/mochi" target="_blank" rel="noopener" className="btn btn-primary">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
                View on GitHub
              </a>
              <a href="https://github.com/xanstomper/mochi/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener" className="btn btn-secondary">
                Contribute →
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ padding: '0 24px 80px' }}>
        <AnimatedContent direction="bottom" delay={0.2}>
          <div className="rb-window">
            <RepoBrowser />
          </div>
        </AnimatedContent>
      </div>

      <Footer />
    </>
  );
}

createRoot(document.getElementById('root')).render(<Source />);
