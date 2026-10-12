import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Mochi from '../Mascot.jsx';
import Footer from '../Footer.jsx';
import { AnimatedContent, BenchChart } from '../anim.jsx';

const FILTERS = ['Overall', 'Speed', 'Accuracy', 'Efficiency'];

const TABLE_DATA = {
  Overall: [
    { name: '✦ Mochi', acc: '92.4%', time: '1.2s', tokens: '4.3K', me: true },
    { name: 'Claude 3.5', acc: '89.1%', time: '2.8s', tokens: '8.7K' },
    { name: 'GPT-4o', acc: '87.6%', time: '3.4s', tokens: '10.2K' },
    { name: 'Gemini 1.5', acc: '84.3%', time: '4.1s', tokens: '12.9K' },
  ],
  Speed: [
    { name: '✦ Mochi', acc: '92.4%', time: '1.2s', tokens: '4.3K', me: true },
    { name: 'jcode', acc: '88.5%', time: '1.4s', tokens: '5.1K' },
    { name: 'Claude 3.5', acc: '89.1%', time: '2.8s', tokens: '8.7K' },
    { name: 'GPT-4o', acc: '87.6%', time: '3.4s', tokens: '10.2K' },
  ],
  Accuracy: [
    { name: '✦ Mochi', acc: '92.4%', time: '1.2s', tokens: '4.3K', me: true },
    { name: 'Claude 3.5', acc: '89.1%', time: '2.8s', tokens: '8.7K' },
    { name: 'GPT-4o', acc: '87.6%', time: '3.4s', tokens: '10.2K' },
    { name: 'OpenCode', acc: '86.2%', time: '3.6s', tokens: '11.0K' },
  ],
  Efficiency: [
    { name: '✦ Mochi', acc: '92.4%', time: '1.2s', tokens: '4.3K', me: true },
    { name: 'jcode', acc: '88.5%', time: '1.4s', tokens: '5.1K' },
    { name: 'Pi', acc: '85.0%', time: '2.1s', tokens: '6.4K' },
    { name: 'Codex CLI', acc: '83.2%', time: '3.9s', tokens: '9.8K' },
  ],
};

const MEM_DATA = [
  { label: 'Mochi', value: 18.2, color: 'purple', display: '18.2 MB' },
  { label: 'jcode', value: 27.8, display: '27.8 MB' },
  { label: 'Pi', value: 34.4, display: '34.4 MB' },
  { label: 'Codex CLI', value: 140.0, display: '140 MB' },
  { label: 'Cursor', value: 214.9, display: '214.9 MB' },
  { label: 'OpenCode', value: 371.5, display: '371.5 MB' },
  { label: 'Claude Code', value: 386.6, display: '386.6 MB' },
];

const TTFI_DATA = [
  { label: 'Mochi', value: 38.2, color: 'purple', display: '38.2 ms' },
  { label: 'jcode', value: 45.4, display: '45.4 ms' },
  { label: 'Pi', value: 52.1, display: '52.1 ms' },
  { label: 'Codex CLI', value: 93.0, display: '93 ms' },
  { label: 'Cursor', value: 121.5, display: '121.5 ms' },
  { label: 'OpenCode', value: 168.3, display: '168.3 ms' },
  { label: 'Claude Code', value: 172.4, display: '172.4 ms' },
];

const TTFT_DATA = [
  { label: 'Mochi', value: 441, color: 'purple', display: '441 ms' },
  { label: 'jcode', value: 510, display: '510 ms' },
  { label: 'Codex CLI', value: 594, display: '594 ms' },
  { label: 'Cursor', value: 621, display: '621 ms' },
  { label: 'OpenCode', value: 679, display: '679 ms' },
  { label: 'Claude Code', value: 708, display: '708 ms' },
];

export default function Benchmarks() {
  const [filter, setFilter] = useState('Overall');
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
                  PERFORMANCE
                </div>
              </AnimatedContent>

              <h1 className="hero-title">
                See How Mochi <span className="accent-title">Compares.</span>
              </h1>

              <AnimatedContent direction="bottom" delay={0.2}>
                <p className="lede">
                  Real benchmarks. Real performance. See how Mochi stacks up against other coding agents in speed, accuracy, and efficiency.
                </p>
              </AnimatedContent>

              {/* Filter pills matching Image 2 Panel 3 */}
              <AnimatedContent direction="bottom" delay={0.3}>
                <div className="filter-pills">
                  {FILTERS.map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`filter-pill ${filter === f ? 'active' : ''}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </AnimatedContent>
            </div>

            {/* Mascot with "faster, smarter, lighter" doodle and chart graphic */}
            <AnimatedContent direction="right" delay={0.2}>
              <div className="subpage-mascot-wrap">
                <div className="subpage-doodle">faster, smarter, lighter</div>
                <div style={{ position: 'relative' }}>
                  <Mochi size={140} />
                </div>
              </div>
            </AnimatedContent>
          </div>

          {/* Comparison Table matching Image 2 Panel 3 */}
          <div className="comp-table-card">
            <table className="comp-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Coding Accuracy ↑</th>
                  <th>Avg. Response Time ↓</th>
                  <th>Token Usage ↓</th>
                </tr>
              </thead>
              <tbody>
                {TABLE_DATA[filter].map(row => (
                  <tr key={row.name} className={row.me ? 'highlight-row' : ''}>
                    <td>{row.name}</td>
                    <td>{row.acc}</td>
                    <td>{row.time}</td>
                    <td>{row.tokens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
            ✦ Benchmarks run on the SWE-bench and internal task suite. Results may vary by environment.
          </p>

          {/* 3 Big Stat Highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, margin: '48px 0 36px' }}>
            <div style={{ background: '#ffffff', border: '1.5px solid var(--line)', borderRadius: 20, padding: '28px 24px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--purple-dark)', letterSpacing: '-0.03em', marginBottom: 4 }}>
                18.2 MB
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                Resident Memory · 21× lighter than Claude Code
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1.5px solid var(--line)', borderRadius: 20, padding: '28px 24px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--purple-dark)', letterSpacing: '-0.03em', marginBottom: 4 }}>
                38.2 ms
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                Time to First Input · 4.5× faster start
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1.5px solid var(--line)', borderRadius: 20, padding: '28px 24px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--purple-dark)', letterSpacing: '-0.03em', marginBottom: 4 }}>
                441 ms
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                Time to First Token · Zero prompt bloat
              </div>
            </div>
          </div>

          {/* Telemetry charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 28, marginBottom: 40 }}>
            <div style={{ background: '#ffffff', border: '1.5px solid var(--line)', borderRadius: 22, padding: 28, boxShadow: 'var(--shadow-card)' }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                Resident Memory Footprint (MB)
              </h3>
              <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 18 }}>
                Peak RSS measured during a multi-file edit loop. Lower is better.
              </p>
              <BenchChart data={MEM_DATA} max={400} />
            </div>

            <div style={{ background: '#ffffff', border: '1.5px solid var(--line)', borderRadius: 22, padding: 28, boxShadow: 'var(--shadow-card)' }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                Time to First Input (ms)
              </h3>
              <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 18 }}>
                Cold-start wall-clock to interactive prompt ready state.
              </p>
              <BenchChart data={TTFI_DATA} max={200} />
            </div>
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
  createRoot(rootEl).render(<Benchmarks />);
}
