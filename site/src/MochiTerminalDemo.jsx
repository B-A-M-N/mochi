import React, { useState, useEffect, useRef } from 'react';

const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export default function MochiTerminalDemo() {
  const [phase, setPhase] = useState('prompt'); // 'prompt' | 'boot' | 'ready' | 'task_type' | 'running' | 'done'
  const [typedCommand, setTypedCommand] = useState('');
  const [bootProgress, setBootProgress] = useState(0);
  const [typedPrompt, setTypedPrompt] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [tabs, setTabs] = useState([
    { id: 1, title: 'Session 1', status: 'idle' }
  ]);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [activeTabMode, setActiveTabMode] = useState('act'); // 'act' | 'plan'
  const [runStep, setRunStep] = useState(0); // 0..5 progressive transcript reveal
  const [speed, setSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  // Spinner cadence
  useEffect(() => {
    const timer = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % BRAILLE_FRAMES.length);
    }, 90);
    return () => clearInterval(timer);
  }, []);

  // Main animation timeline
  useEffect(() => {
    if (isPaused) return;

    let timeoutId;
    const baseDelay = (ms) => ms / speed;

    if (phase === 'prompt') {
      const full = 'mochi';
      if (typedCommand.length < full.length) {
        timeoutId = setTimeout(() => {
          setTypedCommand(full.slice(0, typedCommand.length + 1));
        }, baseDelay(110));
      } else {
        timeoutId = setTimeout(() => {
          setPhase('boot');
          setBootProgress(0);
        }, baseDelay(450));
      }
    } else if (phase === 'boot') {
      if (bootProgress < 100) {
        timeoutId = setTimeout(() => {
          setBootProgress((p) => Math.min(100, p + 14));
        }, baseDelay(80));
      } else {
        timeoutId = setTimeout(() => {
          setPhase('ready');
        }, baseDelay(400));
      }
    } else if (phase === 'ready') {
      timeoutId = setTimeout(() => {
        setPhase('task_type');
        setTypedPrompt('');
      }, baseDelay(600));
    } else if (phase === 'task_type') {
      const fullTask = 'Add exponential backoff with retry-after header support to HTTP client';
      if (typedPrompt.length < fullTask.length) {
        timeoutId = setTimeout(() => {
          setTypedPrompt(fullTask.slice(0, typedPrompt.length + 1));
        }, baseDelay(45));
      } else {
        timeoutId = setTimeout(() => {
          setPhase('running');
          setRunStep(1);
          setTabs([
            { id: 1, title: 'Add exponential backoff…', status: 'running' }
          ]);
        }, baseDelay(500));
      }
    } else if (phase === 'running') {
      if (runStep < 5) {
        const stepDelays = [0, baseDelay(600), baseDelay(750), baseDelay(900), baseDelay(850)];
        timeoutId = setTimeout(() => {
          setRunStep((s) => s + 1);
        }, stepDelays[runStep] || baseDelay(700));
      } else {
        timeoutId = setTimeout(() => {
          setPhase('done');
          setTabs([
            { id: 1, title: 'Add exponential backoff…', status: 'done' }
          ]);
        }, baseDelay(600));
      }
    } else if (phase === 'done') {
      // Loop after 16 seconds of idle completion
      timeoutId = setTimeout(() => {
        handleReset();
      }, baseDelay(16000));
    }

    return () => clearTimeout(timeoutId);
  }, [phase, typedCommand, bootProgress, typedPrompt, runStep, isPaused, speed]);

  const handleReset = () => {
    setPhase('prompt');
    setTypedCommand('');
    setBootProgress(0);
    setTypedPrompt('');
    setRunStep(0);
    setTabs([{ id: 1, title: 'Session 1', status: 'idle' }]);
  };

  const handleNewTab = () => {
    if (tabs.length < 3) {
      const nextId = tabs.length + 1;
      setTabs([...tabs, { id: nextId, title: `Session ${nextId}`, status: 'idle' }]);
      setActiveTab(tabs.length);
    }
  };

  const currentBraille = BRAILLE_FRAMES[spinnerFrame];

  return (
    <div className="terminal-demo-wrapper" style={{ margin: '40px auto 70px', maxWidth: 1120, width: '100%' }}>
      {/* Terminal Window Container */}
      <div
        className="terminal-window"
        style={{
          background: '#0a0a0a',
          borderRadius: 16,
          border: '1.5px solid rgba(138, 103, 246, 0.35)',
          boxShadow: '0 32px 80px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.06), 0 0 60px rgba(138, 103, 246, 0.15)',
          overflow: 'hidden',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace, ui-monospace',
          fontSize: 13,
          lineHeight: 1.45,
          color: '#E0DEF4',
          position: 'relative',
        }}
      >
        {/* Titlebar Chrome */}
        <div
          className="terminal-titlebar"
          style={{
            background: '#121214',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none',
          }}
        >
          {/* Traffic light buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#EF4444', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#F59E0B', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#10B981', display: 'inline-block', flexShrink: 0 }} />
            <span
              className="terminal-title-text"
              style={{
                marginLeft: 10,
                fontSize: 11.5,
                color: '#8884A0',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              jewboy420@dev-box: ~/project — mochi v0.23.1
            </span>
          </div>

          {/* Interactive controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setIsPaused(!isPaused)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 6,
                padding: '3px 9px',
                color: '#CCC8E0',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              title={isPaused ? 'Resume simulation' : 'Pause simulation'}
            >
              {isPaused ? '▶ Play' : '❚❚ Pause'}
            </button>
            <button
              onClick={() => setSpeed(speed === 1 ? 2 : 1)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 6,
                padding: '3px 8px',
                color: '#CCC8E0',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              title="Toggle animation playback speed"
            >
              {speed}x
            </button>
            <button
              onClick={handleReset}
              style={{
                background: 'rgba(138, 103, 246, 0.18)',
                border: '1px solid rgba(138, 103, 246, 0.4)',
                borderRadius: 6,
                padding: '3px 10px',
                color: '#C4B5FD',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
              title="Restart terminal sequence"
            >
              <span>↺</span> Replay
            </button>
          </div>
        </div>

        {/* Viewport Content */}
        <div
          className="terminal-body"
          style={{
            background: '#0a0a0a',
            padding: phase === 'prompt' ? '28px 24px' : '0',
            minHeight: 460,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* PHASE 0: Pure Bash Shell */}
          {phase === 'prompt' && (
            <div>
              <div style={{ color: '#8884A0', marginBottom: 12 }}>
                Linux 6.8.0-45-generic x86_64 · node v22.12.0 · bun v1.2.4
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                <span style={{ color: '#34D399', fontWeight: 700 }}>jewboy420@dev-box</span>
                <span style={{ color: '#8884A0' }}>:</span>
                <span style={{ color: '#60A5FA', fontWeight: 700 }}>~/project</span>
                <span style={{ color: '#E0DEF4' }}>$</span>
                <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{typedCommand}</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 16,
                    background: '#A78BFA',
                    animation: 'terminal-blink 1s infinite',
                  }}
                />
              </div>
            </div>
          )}

          {/* PHASES 1..4: True Mochi TUI View */}
          {phase !== 'prompt' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 460 }}>
              {/* Row 0: OpenCode-Parity Top Tab Bar */}
              <div
                style={{
                  background: '#0a0a0a',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  padding: '7px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                {tabs.map((tab, idx) => {
                  const isActive = idx === activeTab;
                  return (
                    <div
                      key={tab.id}
                      onClick={() => setActiveTab(idx)}
                      style={{
                        background: isActive ? '#221C30' : 'transparent',
                        padding: '3px 10px',
                        borderRadius: 6,
                        color: isActive ? '#FFFFFF' : '#8884A0',
                        fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        border: isActive ? '1px solid rgba(167, 139, 250, 0.25)' : '1px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {tab.status === 'running' ? (
                        <span style={{ color: '#FBBF24' }}>{currentBraille}</span>
                      ) : tab.status === 'done' ? (
                        <span style={{ color: '#4ADE80' }}>✓</span>
                      ) : (
                        <span style={{ color: isActive ? '#A78BFA' : '#787391' }}>•</span>
                      )}
                      <span>{tab.title}</span>
                    </div>
                  );
                })}

                {/* + New session Button Pill */}
                <button
                  onClick={handleNewTab}
                  style={{
                    background: '#1E1E1E',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 6,
                    padding: '3px 10px',
                    color: '#E0DEF4',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  + New session
                </button>
              </div>

              {/* Middle Viewport */}
              <div
                style={{
                  flex: 1,
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: phase === 'boot' || phase === 'ready' ? 'center' : 'flex-start',
                  overflowY: 'auto',
                }}
              >
                {/* Boot Splash Screen */}
                {(phase === 'boot' || (phase === 'ready' && runStep === 0 && !typedPrompt)) && (
                  <div style={{ textAlign: 'center', margin: 'auto 0' }}>
                    {/* ASCII Logo */}
                    <pre
                      style={{
                        margin: '0 auto 10px',
                        fontFamily: 'inherit',
                        fontWeight: 900,
                        fontSize: 13,
                        lineHeight: 1.15,
                        color: '#BD93F9',
                        textShadow: '0 0 16px rgba(189, 147, 249, 0.4)',
                      }}
                    >
{`█▀▄▀█ █▀▀█ █▀▀▀ █  █ ▀█▀
█ ▀ █ █  █ █    █▀▀█  █ 
▀   ▀ ▀▀▀▀ ▀▀▀▀ ▀  ▀ ▀▀▀`}
                    </pre>

                    <div style={{ color: '#8884A0', fontSize: 12, marginBottom: 14 }}>
                      ── autonomous coding agent ──
                    </div>

                    {/* Progress Bar */}
                    <div style={{ color: '#A78BFA', fontSize: 12.5, marginBottom: 8 }}>
                      ⟦ {Array.from({ length: 30 }).map((_, i) => (
                        <span
                          key={i}
                          style={{
                            color: i < Math.floor((bootProgress / 100) * 30) ? '#8A67F6' : '#2D2B3D',
                          }}
                        >
                          ━
                        </span>
                      ))} ⟧
                    </div>

                    <div style={{ color: bootProgress === 100 ? '#4ADE80' : '#FBBF24', fontSize: 12, fontWeight: 700 }}>
                      {bootProgress === 100 ? '● The Dongo is ready' : `${currentBraille} initializing neural routing…`}
                    </div>

                    <div style={{ color: '#6A6785', fontSize: 11, marginTop: 4 }}>
                      mochi v0.23.1
                    </div>
                  </div>
                )}

                {/* Live Task Execution Transcript */}
                {(phase === 'running' || phase === 'done' || (phase === 'task_type' && runStep > 0)) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* User Turn */}
                    {runStep >= 1 && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ color: '#A78BFA', fontWeight: 800 }}>❯</span>
                        <span style={{ color: '#FFFFFF', fontWeight: 700 }}>
                          Add exponential backoff with retry-after header support to HTTP client
                        </span>
                      </div>
                    )}

                    {/* Thought Turn */}
                    {runStep >= 2 && (
                      <div style={{ display: 'flex', gap: 10, color: '#9CA3AF' }}>
                        <span style={{ color: '#6B7280' }}>◇</span>
                        <span>
                          Inspecting <span style={{ color: '#60A5FA' }}>src/http/transport.ts</span> error pathways and retry limits…
                        </span>
                      </div>
                    )}

                    {/* Tool Turn: read_file */}
                    {runStep >= 3 && (
                      <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                        <span style={{ color: '#22D3EE' }}>▷</span>
                        <span style={{ color: '#38BDF8', fontWeight: 600 }}>read_file</span>
                        <span style={{ color: '#A5B4FC' }}>src/http/transport.ts</span>
                        <span style={{ color: '#6B7280' }}>(142 lines)</span>
                      </div>
                    )}

                    {/* Tool Turn: replace_file_content + Diff Block */}
                    {runStep >= 4 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 22 }}>
                        <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                          <span style={{ color: '#22D3EE' }}>▷</span>
                          <span style={{ color: '#38BDF8', fontWeight: 600 }}>replace_file_content</span>
                          <span style={{ color: '#A5B4FC' }}>src/http/transport.ts</span>
                        </div>
                        <div
                          style={{
                            background: '#13111C',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: 6,
                            padding: '8px 12px',
                            fontSize: 11.5,
                            lineHeight: 1.4,
                          }}
                        >
                          <div style={{ color: '#EF4444' }}>- const res = await fetch(url, options);</div>
                          <div style={{ color: '#EF4444' }}>- if (!res.ok) throw new Error(res.statusText);</div>
                          <div style={{ color: '#10B981' }}>+ const retryAfter = res.headers.get('retry-after');</div>
                          <div style={{ color: '#10B981' }}>+ const delayMs = retryAfter ? parseHeader(retryAfter) : Math.min(1000 * 2 ** attempt, 15000);</div>
                          <div style={{ color: '#10B981' }}>+ await sleep(delayMs + Math.random() * 200);</div>
                        </div>
                      </div>
                    )}

                    {/* Tool Turn: run_command & test verification */}
                    {runStep >= 5 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 22 }}>
                        <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                          <span style={{ color: '#22D3EE' }}>▷</span>
                          <span style={{ color: '#38BDF8', fontWeight: 600 }}>run_command</span>
                          <span style={{ color: '#F472B6' }}>npm test -- transport.test.ts</span>
                        </div>
                        <div style={{ color: '#34D399', fontWeight: 700, fontSize: 12, paddingLeft: 18 }}>
                          ✓ 18 tests passed in 184ms (0 failures, 100% assertions green)
                        </div>
                        <div style={{ color: '#E2E8F0', paddingLeft: 18, marginTop: 4 }}>
                          <span style={{ color: '#22D3EE', fontWeight: 800 }}>▌</span> Exponential backoff and Retry-After header parsing implemented with jitter and 15s circuit breaker. All 18 transport tests pass.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Rich Multi-Row Status Bar Dashboard (The Exact Restored UI!) */}
              <div
                className="terminal-status-dashboard"
                style={{
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  background: '#0D0D10',
                  padding: '6px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  fontSize: 11.5,
                  userSelect: 'none',
                  overflowX: 'auto',
                }}
              >
                {/* Row 1: Model, Reasoning Level, Token Budget, Cost */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#F3F4F6', fontWeight: 700 }}>glm-5.3-flash</span>
                    <span style={{ background: '#312E81', color: '#C7D2FE', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                      REASON: MAX
                    </span>
                    <span style={{ color: '#9CA3AF' }}>██████ ({phase === 'done' ? '2.2k' : '0'})</span>
                  </div>
                  <div style={{ color: '#34D399', fontWeight: 700 }}>
                    {phase === 'done' ? '$0.003' : '$0.00'}
                  </div>
                </div>

                {/* Row 2: In/Out, Context Gradient Meter, Cache Rate, Plan/Act Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#6B7280' }}>in <span style={{ color: '#22D3EE' }}>{phase === 'done' ? '1.8k' : '0'}</span></span>
                    <span style={{ color: '#6B7280' }}>out <span style={{ color: '#FB923C' }}>{phase === 'done' ? '416' : '0'}</span></span>
                    <span style={{ color: '#8A67F6' }}>
                      {phase === 'done' ? '████░░░░░░░░ 18%' : '░░░░░░░░░░░░ 0%'}
                    </span>
                    {phase === 'done' && (
                      <span style={{ color: '#6B7280' }}>
                        cache <span style={{ color: '#4ADE80' }}>9.2k (83%)</span>
                      </span>
                    )}
                  </div>

                  {/* Plan / Act Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      onClick={() => setActiveTabMode('plan')}
                      style={{
                        color: activeTabMode === 'plan' ? '#A78BFA' : '#6B7280',
                        fontWeight: activeTabMode === 'plan' ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {activeTabMode === 'plan' ? '●' : '○'} Plan
                    </span>
                    <span
                      onClick={() => setActiveTabMode('act')}
                      style={{
                        color: activeTabMode === 'act' ? '#F43F5E' : '#6B7280',
                        fontWeight: activeTabMode === 'act' ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {activeTabMode === 'act' ? '●' : '○'} Act
                    </span>
                    <span style={{ color: '#4B5563', fontSize: 10 }}>(Tab)</span>
                  </div>
                </div>

                {/* Row 3: Project, Branch, Diff Stats, Auto-Improve */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#9CA3AF' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#E5E7EB' }}>mochi (main)</span>
                    <span style={{ color: '#6B7280' }}>·</span>
                    <span>Auto improve: <span style={{ color: '#34D399', fontWeight: 600 }}>ON</span></span>
                    <span style={{ color: '#6B7280' }}>|</span>
                    <span>1 file <span style={{ color: '#34D399' }}>+8</span> <span style={{ color: '#EF4444' }}>-3</span></span>
                  </div>
                  {phase === 'running' && (
                    <div style={{ color: '#FBBF24', fontSize: 11, fontWeight: 700 }}>
                      ⚡ 84 tok/s
                    </div>
                  )}
                </div>

                {/* Row 4: Composer Mode Indicator & Shortcuts */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#6B7280', fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: activeTabMode === 'act' ? '#F43F5E' : '#A78BFA' }}>● {activeTabMode === 'act' ? 'Act' : 'Plan'}</span>
                    <span>· ⏎ send · Tab plan/act · ESC stop · / for commands</span>
                  </div>
                  <div>v0.23.1</div>
                </div>
              </div>

              {/* Pinned Bottom Composer Box */}
              <div
                style={{
                  background: '#0a0a0a',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '9px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ color: '#A78BFA', fontWeight: 800 }}>❯</span>
                <span style={{ color: typedPrompt ? '#FFFFFF' : '#6B7280', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {typedPrompt ? typedPrompt : 'Message mochi… (type / for commands)'}
                </span>
                {phase === 'task_type' && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 15,
                      background: '#A78BFA',
                      animation: 'terminal-blink 1s infinite',
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes terminal-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @media (max-width: 640px) {
          .terminal-title-text {
            max-width: 140px;
          }
          .terminal-status-dashboard {
            font-size: 10.5px !important;
            padding: 5px 10px !important;
          }
        }
      `}</style>
    </div>
  );
}
