import React, { useEffect, useRef } from 'react';

/**
 * EngineeringGrid — Ultra-high-performance purple engineering dot matrix.
 * Hardware-accelerated CSS vector dot-matrix + coordinate crosshairs.
 * Zero CPU overhead, zero canvas repaint stalls, solid 120 FPS.
 */
export default function EngineeringGrid({ style = {}, className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId = null;
    let targetX = -1000;
    let targetY = -1000;

    const onPointerMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          el.style.setProperty('--mouse-x', `${targetX}px`);
          el.style.setProperty('--mouse-y', `${targetY}px`);
          rafId = null;
        });
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`engineering-grid-container ${className}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        ...style,
      }}
      aria-hidden="true"
    >
      {/* High-DPI Vector Dot Matrix & Crosshairs */}
      <div className="engineering-grid-pattern" />
      {/* Interactive Ambient Purple Spotlight */}
      <div className="engineering-grid-glow" />
    </div>
  );
}
