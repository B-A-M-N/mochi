import React from 'react';

export default function Footer() {
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/mochi') ? '/mochi' : '';
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-col footer-brand">
            <a href={base + '/'} className="footer-logo">
              <span>mochi</span>
              <span className="sparkle" />
            </a>
            <p>A Softer Kind of Intelligence.</p>
          </div>
          <div className="footer-col">
            <h5>Product</h5>
            <a href={base + '/'}>Home</a>
            <a href={base + '/docs.html'}>Docs</a>
            <a href={base + '/benchmarks.html'}>Benchmarks</a>
            <a href={base + '/changelog.html'}>Changelog</a>
            <a href={base + '/source.html'}>Source</a>
          </div>
          <div className="footer-col">
            <h5>Resources</h5>
            <a href={base + '/docs.html'}>Blog</a>
            <a href="https://github.com/xanstomper/mochi/discussions" target="_blank" rel="noopener">Community</a>
            <a href="https://github.com/xanstomper/mochi/issues" target="_blank" rel="noopener">Support</a>
            <a href={base + '/benchmarks.html'}>Status</a>
          </div>
          <div className="footer-col">
            <h5>Social</h5>
            <a href="https://x.com/xanstomper" target="_blank" rel="noopener">X (Twitter)</a>
            <a href="https://discord.gg" target="_blank" rel="noopener">Discord</a>
            <a href="https://github.com/xanstomper/mochi" target="_blank" rel="noopener">GitHub</a>
            <a href="https://youtube.com" target="_blank" rel="noopener">YouTube</a>
          </div>
          <div className="footer-col footer-news">
            <h5>Stay in the loop.</h5>
            <p>Get updates, new releases, and more.</p>
            <form className="news-input" onSubmit={e => { e.preventDefault(); alert('Subscribed to Mochi updates!'); }}>
              <input type="email" placeholder="your@email.com" aria-label="Email address" required />
              <button type="submit" aria-label="Subscribe">→</button>
            </form>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2025 Mochi. All rights reserved.</span>
          <span>Built by the community. ♡</span>
        </div>
      </div>
    </footer>
  );
}
