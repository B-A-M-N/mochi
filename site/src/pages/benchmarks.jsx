import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Footer from '../Footer.jsx';
import { AnimatedContent } from '../anim.jsx';

const METRIC_TABS = [
  { id: 'mem', label: 'Memory (PSS)' },
  { id: 'ttfi', label: 'Startup (TTFI)' },
  { id: 'ttft', label: 'Streaming (TTFT)' },
  { id: 'ext', label: 'Tail Latency (P95)' },
  { id: 'task', label: 'Task Efficiency' },
];

const BENCHMARKS_DATA = {
  mem: {
    title: 'Resident Process Memory (PSS)',
    unit: ' MB',
    max: 400,
    why: 'Steady-state memory consumption sampled from /proc/[pid]/smaps_rollup. Memory is what allows Mochi to run continuously alongside editors and docker containers without fan noise or swap thrashing.',
    leaderDelta: '21.2× less memory than Claude Code',
    data: [
      { name: 'Mochi', val: 18.2, mochi: true },
      { name: 'jcode', val: 27.8 },
      { name: 'Pi', val: 34.4 },
      { name: 'Codex CLI', val: 140.0 },
      { name: 'Cursor Agent', val: 214.9 },
      { name: 'OpenCode', val: 371.5 },
      { name: 'Claude Code', val: 386.6 },
    ],
  },
  ttfi: {
    title: 'Time to First Input (TTFI)',
    unit: ' ms',
    max: 200,
    why: 'PTY master read timestamp from process spawn until the interactive prompt is fully responsive. Every fraction of a second before the prompt renders adds developer friction.',
    leaderDelta: '4.5× faster cold boot than Claude Code',
    data: [
      { name: 'Mochi', val: 38.2, mochi: true },
      { name: 'jcode', val: 45.4 },
      { name: 'Pi', val: 52.1 },
      { name: 'Codex CLI', val: 93.0 },
      { name: 'Cursor Agent', val: 121.5 },
      { name: 'OpenCode', val: 168.3 },
      { name: 'Claude Code', val: 172.4 },
    ],
  },
  ttft: {
    title: 'Time to First Token (TTFT)',
    unit: ' ms',
    max: 800,
    why: 'Latency from prompt submission until provider token streaming begins. Mochi’s lean prompt compaction engine adds near-zero overhead on top of raw inference.',
    leaderDelta: 'Lowest latency across all 7 evaluated agents',
    data: [
      { name: 'Mochi', val: 441, mochi: true },
      { name: 'jcode', val: 510 },
      { name: 'Codex CLI', val: 594 },
      { name: 'Cursor Agent', val: 621 },
      { name: 'Pi', val: 650 },
      { name: 'OpenCode', val: 679 },
      { name: 'Claude Code', val: 708 },
    ],
  },
  ext: {
    title: 'First-Token P95 Extension Ratio',
    unit: '×',
    max: 50,
    why: 'Ratio of 95th percentile latency to median latency. Measures tail predictability; deterministic responsiveness is what "feels fast" in day-to-day coding.',
    leaderDelta: 'Most predictable tail performance',
    data: [
      { name: 'Mochi', val: 10.9, mochi: true },
      { name: 'jcode', val: 12.1 },
      { name: 'Pi', val: 13.6 },
      { name: 'Codex CLI', val: 19.3 },
      { name: 'OpenCode', val: 24.8 },
      { name: 'Claude Code', val: 30.0 },
      { name: 'Cursor Agent', val: 47.2 },
    ],
  },
};

const TASK_BENCHMARKS = [
  { agent: 'Mochi (v0.20)', mem: '41.2 MB', time: '37.4s', tokens: '43.2k', cost: '$0.006', passRate: '100% (Verified)', leader: true },
  { agent: 'jcode', mem: '58.6 MB', time: '48.1s', tokens: '52.1k', cost: '$0.009', passRate: '98%' },
  { agent: 'Pi', mem: '64.0 MB', time: '55.3s', tokens: '61.4k', cost: '$0.012', passRate: '96%' },
  { agent: 'OpenCode', mem: '371.5 MB', time: '118.2s', tokens: '154.2k', cost: '$0.038', passRate: '88%' },
  { agent: 'Claude Code', mem: '386.6 MB', time: '142.6s', tokens: '192.5k', cost: '$0.048', passRate: '92%' },
];

export default function Benchmarks() {
  const [activeTab, setActiveTab] = useState('mem');
  const currentChart = BENCHMARKS_DATA[activeTab];

  return (
    <>
      <div className="pagehead">
        <div className="wrap">
          <div className="pagehead-inner">
            <div className="hero-badge">
              <span className="badge-glow" />
              <span className="badge-pill">HARDWARE BENCHMARKS</span>
              <span>10 Runs · Fixed Warm Cache · Linux Kernel 6.8</span>
            </div>
            <h1 className="pagehead-title">Numbers, not adjectives.</h1>
            <p className="pagehead-lede">
              Ten runs against a fixed warm cache. Same Linux workstation, same terminal environment, zero cold-start handouts. Steady-state PSS measured from <code>/proc</code>; timing recorded with high-resolution monotonic clocks.
            </p>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ padding: '0 24px 80px' }}>
        {/* Top 4 Hero Metric Cards */}
        <div className="bench-hero-metrics">
          <div className="b-hero-card">
            <span className="b-hero-tag">STEADY-STATE RAM</span>
            <div className="b-hero-num">18.2 MB</div>
            <p className="b-hero-sub">21.2× lighter than Claude Code</p>
          </div>
          <div className="b-hero-card">
            <span className="b-hero-tag">COLD STARTUP</span>
            <div className="b-hero-num">38.2 ms</div>
            <p className="b-hero-sub">4.5× faster time-to-first-input</p>
          </div>
          <div className="b-hero-card">
            <span className="b-hero-tag">STREAMING LATENCY</span>
            <div className="b-hero-num">441 ms</div>
            <p className="b-hero-sub">Lowest time-to-first-token</p>
          </div>
          <div className="b-hero-card">
            <span className="b-hero-tag">TAIL LATENCY</span>
            <div className="b-hero-num">10.9×</div>
            <p className="b-hero-sub">Lowest P95 latency variance</p>
          </div>
        </div>

        {/* Metric Selector Tabs */}
        <div className="bench-tab-selector">
          {METRIC_TABS.map((tab) => (
            <button
              key={tab.id}
              className={'bench-tab-btn' + (activeTab === tab.id ? ' active' : '')}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Chart or Task View */}
        {activeTab !== 'task' ? (
          <div className="bench-detail-card">
            <div className="bench-card-glow" />
            <div className="bench-detail-header">
              <div>
                <h2 className="bench-detail-title">{currentChart.title}</h2>
                <p className="bench-detail-why">{currentChart.why}</p>
              </div>
              <span className="bench-winner-tag">{currentChart.leaderDelta}</span>
            </div>

            <div className="bchart">
              {currentChart.data.map((item) => (
                <div key={item.name} className={'bchart-row' + (item.mochi ? ' is-mochi' : '')}>
                  <div className="bchart-label">
                    <span>{item.name}</span>
                    {item.mochi && <span className="winner-pill">Leader</span>}
                  </div>
                  <div className="bchart-track">
                    <div
                      className={'bchart-fill' + (item.mochi ? ' is-mochi' : '')}
                      style={{ width: `${(item.val / currentChart.max) * 100}%` }}
                    />
                  </div>
                  <div className="bchart-val">
                    {item.val.toLocaleString()}{currentChart.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bench-detail-card">
            <div className="bench-card-glow" />
            <div className="bench-detail-header">
              <div>
                <h2 className="bench-detail-title">Multi-Turn Task Efficiency (100-File Refactor)</h2>
                <p className="bench-detail-why">
                  Real-world task execution measured end-to-end: goal parsing, AST dependency analysis, multi-file code mutation, and test suite execution.
                </p>
              </div>
              <span className="bench-winner-tag">Lowest Cost &amp; Token Footprint</span>
            </div>

            <div className="table-wrapper">
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Peak Memory</th>
                    <th>Wall Time</th>
                    <th>Tokens Used</th>
                    <th>Inference Cost</th>
                    <th>Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {TASK_BENCHMARKS.map((b) => (
                    <tr key={b.agent} className={b.leader ? 'is-leader-row' : ''}>
                      <td>
                        <strong>{b.agent}</strong>
                        {b.leader && <span className="winner-pill" style={{ marginLeft: 8 }}>Leader</span>}
                      </td>
                      <td><code>{b.mem}</code></td>
                      <td><code>{b.time}</code></td>
                      <td><code>{b.tokens}</code></td>
                      <td><code>{b.cost}</code></td>
                      <td><span className="pass-pill">{b.passRate}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Test Methodology Card */}
        <div className="methodology-card">
          <h3>Test Methodology &amp; Environment</h3>
          <div className="method-grid">
            <div className="method-item">
              <h4>Workstation Hardware</h4>
              <p>AMD Ryzen 9 7950X (16 cores, 32 threads), 64 GB DDR5-6000 RAM, Linux 6.8.0, ext4 NVMe.</p>
            </div>
            <div className="method-item">
              <h4>Memory Telemetry</h4>
              <p>Proportional Set Size (PSS) sampled directly from <code>/proc/[pid]/smaps_rollup</code> at steady-state idle.</p>
            </div>
            <div className="method-item">
              <h4>Startup Timestamping</h4>
              <p>High-resolution monotonic PTY clock timestamps measured from process fork until cursor draw.</p>
            </div>
            <div className="method-item">
              <h4>Open Reproduction Suite</h4>
              <p>Run locally using <code>npm run bench:efficiency</code> and <code>npm run bench:memory</code>.</p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

const _root = document.getElementById('root');
if (_root) createRoot(_root).render(<Benchmarks />);
