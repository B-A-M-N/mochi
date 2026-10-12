import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

export default function MochiTerminalDemo() {
  const terminalContainerRef = useRef(null);
  const termRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [statusText, setStatusText] = useState('Streaming real PTY session…');
  
  const eventsRef = useRef([]);
  const idxRef = useRef(0);
  const timerRef = useRef(null);
  const isPlayingRef = useRef(true);
  const speedRef = useRef(1);

  isPlayingRef.current = isPlaying;
  speedRef.current = speed;

  // Initialize xterm.js instance
  useEffect(() => {
    if (!terminalContainerRef.current) return;

    const term = new Terminal({
      cols: 100,
      rows: 28,
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace, ui-monospace',
      fontSize: 12.5,
      lineHeight: 1.25,
      theme: {
        background: '#0a0a0a',
        foreground: '#E0DEF4',
        cursor: '#A78BFA',
        cursorAccent: '#0a0a0a',
        selectionBackground: 'rgba(138, 103, 246, 0.35)',
        black: '#121214',
        red: '#EF4444',
        green: '#10B981',
        yellow: '#F59E0B',
        blue: '#60A5FA',
        magenta: '#A78BFA',
        cyan: '#22D3EE',
        white: '#E0DEF4',
        brightBlack: '#6B7280',
        brightRed: '#F87171',
        brightGreen: '#34D399',
        brightYellow: '#FBBF24',
        brightBlue: '#818CF8',
        brightMagenta: '#C084FC',
        brightCyan: '#38BDF8',
        brightWhite: '#FFFFFF',
      },
      convertEol: true,
      scrollback: 1000,
    });

    term.open(terminalContainerRef.current);
    termRef.current = term;

    // Fetch authentic PTY recording
    const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/mochi') ? '/mochi' : '';
    fetch(base + '/mochi-session.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load session file');
        return res.json();
      })
      .then((data) => {
        eventsRef.current = data.events || [];
        playNextChunk();
      })
      .catch((err) => {
        console.error('Error loading mochi session:', err);
        setStatusText('Error loading terminal trace');
      });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      term.dispose();
    };
  }, []);

  const playNextChunk = () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const events = eventsRef.current;
    const idx = idxRef.current;
    const term = termRef.current;

    if (!term || !events.length) return;

    if (idx >= events.length) {
      setStatusText('Session complete ✓ (Replaying in 12s)');
      // Auto-loop after 12 seconds
      timerRef.current = setTimeout(() => {
        handleReset();
      }, 12000 / speedRef.current);
      return;
    }

    if (!isPlayingRef.current) {
      return;
    }

    const [delayMs, base64Chunk] = events[idx];
    
    // Decode base64 bytes directly
    try {
      const binaryString = atob(base64Chunk);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      term.write(bytes);
    } catch (e) {
      console.warn('Chunk decode error:', e);
    }

    idxRef.current = idx + 1;

    const nextDelay = Math.max(10, delayMs / speedRef.current);
    timerRef.current = setTimeout(() => {
      playNextChunk();
    }, nextDelay);
  };

  const handleTogglePlay = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    isPlayingRef.current = nextState;
    if (nextState) {
      playNextChunk();
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setStatusText('Paused');
    }
  };

  const handleToggleSpeed = () => {
    const nextSpeed = speed === 1 ? 2 : 1;
    setSpeed(nextSpeed);
    speedRef.current = nextSpeed;
  };

  const handleReset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    idxRef.current = 0;
    if (termRef.current) {
      termRef.current.reset();
      termRef.current.clear();
    }
    setStatusText('Replaying real mochi session…');
    playNextChunk();
  };

  return (
    <div className="terminal-demo-wrapper" style={{ margin: '30px auto 60px', maxWidth: 1120, width: '100%' }}>
      {/* Real Terminal Window Chrome */}
      <div
        className="terminal-window"
        style={{
          background: '#0a0a0a',
          borderRadius: 16,
          border: '1.5px solid rgba(138, 103, 246, 0.4)',
          boxShadow: '0 32px 80px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08), 0 0 60px rgba(138, 103, 246, 0.18)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Titlebar */}
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
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          {/* Traffic lights + Title */}
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
              jewboy420@dev-box: ~/project — mochi v0.24.0 (Real xterm.js PTY)
            </span>
            <span
              style={{
                background: 'rgba(138, 103, 246, 0.15)',
                color: '#A78BFA',
                padding: '1px 7px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                marginLeft: 4,
                whiteSpace: 'nowrap',
              }}
            >
              LIVE PTY
            </span>
          </div>

          {/* Interactive controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              onClick={handleTogglePlay}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 6,
                padding: '4px 10px',
                color: '#CCC8E0',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              title={isPlaying ? 'Pause stream' : 'Resume stream'}
            >
              {isPlaying ? '❚❚ Pause' : '▶ Play'}
            </button>
            <button
              onClick={handleToggleSpeed}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 6,
                padding: '4px 9px',
                color: '#CCC8E0',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              title="Toggle playback speed"
            >
              {speed}x
            </button>
            <button
              onClick={handleReset}
              style={{
                background: 'rgba(138, 103, 246, 0.22)',
                border: '1px solid rgba(138, 103, 246, 0.45)',
                borderRadius: 6,
                padding: '4px 11px',
                color: '#C4B5FD',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
              title="Replay from bash prompt"
            >
              <span>↺</span> Replay
            </button>
          </div>
        </div>

        {/* Real xterm.js Terminal Canvas/Grid Mounting Surface */}
        <div
          className="terminal-scroll-wrapper"
          style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            background: '#0a0a0a',
          }}
        >
          <div
            ref={terminalContainerRef}
            className="xterm-container"
            style={{
              padding: '14px 16px',
              background: '#0a0a0a',
              minWidth: 780,
              minHeight: 460,
            }}
          />
        </div>

        {/* Status footer bar */}
        <div
          style={{
            background: '#0e0e11',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#71717A',
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#10B981' }}>●</span>
            <span>{statusText}</span>
          </div>
          <div style={{ color: '#8A67F6', fontWeight: 600 }}>
            Powered by @xterm/xterm &amp; Linux PTY
          </div>
        </div>
      </div>

      <style>{`
        .xterm-container .xterm {
          padding: 0;
        }
        .xterm-container .xterm-viewport {
          background-color: #0a0a0a !important;
        }
        @media (max-width: 640px) {
          .terminal-title-text {
            display: none !important;
          }
          .terminal-titlebar {
            padding: 8px 10px !important;
          }
        }
      `}</style>
    </div>
  );
}
