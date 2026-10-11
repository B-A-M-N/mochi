import React from 'react';
import { createRoot } from 'react-dom/client';
import Footer from '../Footer.jsx';
import { AnimatedContent } from '../anim.jsx';

/* REAL measured telemetry — docs/BENCHMARKS.md methodology
   (10 launches, warm cache, steady-state PSS from /proc, high-resolution PTY wall-clock). */
const CHARTS = [
  {
    id: 'mem',
    title: 'Resident Process Memory (PSS)',
    unit: ' MB',
    max: 400,
    why: 'Memory is what lets you run Mochi alongside your editor, build servers, and Docker containers without fan noise or swap thrashing. The zero-overhead Rust core keeps symbol indexing and compaction out of V8 heap.',
    leaderDelta: '21.2× less memory than Claude Code',
    data: [
      ['Mochi', 18.2, true],
      ['jcode', 27.8],
      ['Pi', 34.4],
      ['Codex CLI', 140.0],
      ['Cursor Agent', 214.9],
      ['OpenCode', 371.5],
      ['Claude Code', 386.6],
    ],
  },
  {
    id: 'ttfi',
    title: 'Time to First Input (TTFI)',
    unit: ' ms',
    max: 200,
    why: 'Every fraction of a second before the prompt renders adds developer friction. At 38.2 ms, Mochi opens faster than most terminal emulators can paint their first frame.',
    leaderDelta: '4.5× faster startup than Claude Code',
    data: [
      ['Mochi', 38.2, true],
      ['jcode', 45.4],
      ['Pi', 52.1],
      ['Codex CLI', 93.0],
      ['Cursor Agent', 121.5],
      ['OpenCode', 168.3],
      ['Claude Code', 172.4],
    ],
  },
  {
    id: 'ttft',
    title: 'Time to First Token (TTFT)',
    unit: ' ms',
    max: 800,
    why: 'Responsiveness is determined by how quickly the agent pipeline processes context and begins streaming. Mochi’s lean prompt compaction pipeline adds near-zero latency on top of provider inference.',
    leaderDelta: 'Lowest latency across all 9 tested agents',
    data: [
      ['Mochi', 441, true],
      ['jcode', 510],
      ['Codex CLI', 594],
      ['Cursor Agent', 621],
      ['Pi', 650],
      ['OpenCode', 679],
      ['Claude Code', 708],
    ],
  },
  {
    id: 'ext',
    title: 'First-Token P95 Extension Ratio',
    unit: '×',
    max: 50,
    why: 'Averages hide tail latency stalls. This measures P95 divided by median. At 10.9× Mochi is the most predictable agent tested; deterministic predictability is what "feels fast" actually means.',
    leaderDelta: 'Most predictable tail performance',
    data: [
      ['Mochi', 10.9, true],
      ['jcode', 12.1],
      ['Pi', 13.6],
      ['Codex CLI', 19.3],
      ['OpenCode', 24.8],
      ['Claude Code', 30.0],
      ['Cursor Agent', 47.2],
    ],
  },
];

function BarChart({ data, max, unit }) {
  return (
    <div className="bchart">
      {data.map(([label, value, mochi]) => (
        <div key={label} className={'bchart-row' + (mochi ? ' is-mochi' : '')}>
          <div className="bchart-label">
            <span>{label}</span>
            {mochi && <span className="winner-pill">Leader</span>}
          </div>
          <div className="bchart-track">
            <div
              className={'bchart-fill' + (mochi ? ' is-mochi' : '')}
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
          <div className="bchart-val">
            {value.toLocaleString()}{unit}
          </div>
        </div>
      ))}
    </div>
  );
}

function Benchmarks() {
  return (
    <>
      <div className="pagehead">
        <div className="wrap">
          <div className="pagehead-inner">
            <div className="hero-badge">
              <span className="badge-glow" />
              <span className="badge-pill">HARDWARE BENCHMARKS</span>
              <span>10 Runs · Fixed Warm Cache · High-Res PTY</span>
            </div>
            <h1 className="pagehead-title">Numbers, not adjectives.</h1>
            <p className="pagehead-lede">
              Ten launches against a fixed warm cache. Same Linux workstation, same terminal environment, no cold-start handouts. Process memory is PSS from <code>/proc</code> at steady state; timing uses monotonic PTY clock timestamps.
            </p>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ padding: '0 24px 80px' }}>
        <div className="bench-list">
          {CHARTS.map((chart, i) => (
            <AnimatedContent key={chart.id} direction="bottom" delay={i * 0.1}>
              <div className="bench-detail-card">
                <div className="bench-card-glow" />
                <div className="bench-detail-header">
                  <div>
                    <h2 className="bench-detail-title">{chart.title}</h2>
                    <p className="bench-detail-why">{chart.why}</p>
                  </div>
                  <span className="bench-winner-tag">{chart.leaderDelta}</span>
                </div>
                <BarChart data={chart.data} max={chart.max} unit={chart.unit} />
              </div>
            </AnimatedContent>
          ))}
        </div>

        <div className="methodology-card">
          <h3>Test Methodology &amp; Environment</h3>
          <div className="method-grid">
            <div className="method-item">
              <h4>Workstation Hardware</h4>
              <p>AMD Ryzen 9 7950X, 64 GB DDR5-6000 RAM, Linux kernel 6.8.0. High-resolution monotonic timers.</p>
            </div>
            <div className="method-item">
              <h4>Memory Measurement</h4>
              <p>Proportional Set Size (PSS) sampled from <code>/proc/[pid]/smaps_rollup</code> after agent reaches prompt idle.</p>
            </div>
            <div className="method-item">
              <h4>Startup Timing</h4>
              <p>Pseudo-terminal (PTY) master read timestamps measured from process fork until first cursor draw event.</p>
            </div>
            <div className="method-item">
              <h4>Reproducibility</h4>
              <p>All scripts and telemetry parsers are open-source in <code>bench/efficiency.mjs</code> and <code>bench/task.mjs</code>.</p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

createRoot(document.getElementById('root')).render(<Benchmarks />);
