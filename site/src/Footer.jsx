import React from 'react';

export default function Footer() {
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/mochi') ? '/mochi' : '';
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-col footer-brand">
            <a href={base + '/'} className="footer-logo">
              <span className="brand-mascot-dot" />
              <span>mochi</span>
            </a>
            <p className="footer-tagline">
              Autonomous coding agent for the terminal. Built for engineers who demand speed, low overhead, and verified correctness.
            </p>
            <div className="footer-status">
              <span className="status-dot-pulse" />
              <span>v0.20.0 · All systems operational</span>
            </div>
          </div>
          <div className="footer-col">
            <h5>Product</h5>
            <a href={base + '/'}>Overview</a>
            <a href={base + '/docs.html'}>Documentation</a>
            <a href={base + '/benchmarks.html'}>Benchmarks</a>
            <a href={base + '/changelog.html'}>Changelog</a>
            <a href={base + '/source.html'}>Source Tree</a>
          </div>
          <div className="footer-col">
            <h5>Architecture</h5>
            <a href={base + '/docs.html#architecture'}>Rust Core</a>
            <a href={base + '/docs.html#roles'}>16 Agent Roles</a>
            <a href={base + '/docs.html#tools'}>AST Tools</a>
            <a href={base + '/docs.html#daemon'}>Daemon API</a>
            <a href={base + '/docs.html#mcp-acp'}>MCP & ACP</a>
          </div>
          <div className="footer-col">
            <h5>Community</h5>
            <a href="https://github.com/xanstomper/mochi" target="_blank" rel="noopener">GitHub</a>
            <a href="https://x.com/xanstomper" target="_blank" rel="noopener">X / Twitter</a>
            <a href="https://github.com/xanstomper/mochi/releases" target="_blank" rel="noopener">Releases</a>
            <a href="https://github.com/xanstomper/mochi/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">Contribute</a>
          </div>
          <div className="footer-col footer-news">
            <h5>Stay updated</h5>
            <p className="footer-subtext">Release notifications and technical writeups.</p>
            <form className="news-input" onSubmit={e => e.preventDefault()}>
              <input type="email" placeholder="developer@domain.com" aria-label="Email address" />
              <button type="submit" aria-label="Subscribe">→</button>
            </form>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Mochi. Open-source under MIT License.</span>
          <div className="footer-links">
            <a href="https://github.com/xanstomper/mochi/blob/main/LICENSE" target="_blank" rel="noopener">License</a>
            <span className="dot-sep">•</span>
            <a href="https://github.com/xanstomper/mochi/blob/main/docs/ARCHITECTURE.md" target="_blank" rel="noopener">Architecture</a>
            <span className="dot-sep">•</span>
            <a href="https://github.com/xanstomper/mochi/blob/main/docs/CAPABILITIES.md" target="_blank" rel="noopener">Capabilities</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
