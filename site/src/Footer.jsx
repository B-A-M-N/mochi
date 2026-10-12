import React from 'react';

export default function Footer() {
  return (
    <footer style={{
      position: 'relative',
      zIndex: 10,
      padding: '32px 0 40px',
      borderTop: '1px solid rgba(138, 103, 246, 0.14)',
      textAlign: 'center',
      background: 'rgba(255, 255, 255, 0.75)',
      backdropFilter: 'blur(8px)',
      width: '100%',
    }}>
      <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, color: '#332F43', letterSpacing: '0.01em' }}>
        © 2026 Mochi · MIT Licensed · Open source on <a href="https://github.com/xanstomper/mochi" target="_blank" rel="noopener" style={{ color: '#8A67F6', textDecoration: 'none', fontWeight: 700 }}>GitHub</a>
      </div>
    </footer>
  );
}
