import React, { useEffect, useRef } from 'react';

/**
 * EngineeringGrid — An interactive, high-precision purple engineering dot matrix canvas.
 * Features:
 * - Regular 32px dot matrix in violet/purple (#8B67F6 / #9455FF)
 * - Major coordinate crosshairs (+) at 4-cell intervals
 * - Interactive mouse physics: elastic repulsion, brightness bloom, and ripple waves
 * - Ambient harmonic breathing wave
 * - High-DPR rendering for razor-sharp engineering lines
 */
export default function EngineeringGrid({
  dotColor = 'rgba(139, 103, 246, 0.26)',
  activeColor = 'rgba(148, 85, 255, 0.85)',
  crosshairColor = 'rgba(139, 103, 246, 0.42)',
  spacing = 32,
  style = {},
  className = '',
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Mouse state
    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      active: false,
    };

    // Expanding ripples
    const ripples = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const handlePointerMove = (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
    };

    const handlePointerLeave = () => {
      mouse.active = false;
      mouse.targetX = -1000;
      mouse.targetY = -1000;
    };

    const handleClick = (e) => {
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 0,
        maxRadius: 280,
        speed: 4.5,
        strength: 1.0,
      });
      if (ripples.length > 5) ripples.shift();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    window.addEventListener('click', handleClick, { passive: true });

    let time = 0;

    const render = () => {
      time += 0.02;

      // Smooth mouse follow
      if (mouse.active) {
        mouse.x += (mouse.targetX - mouse.x) * 0.15;
        mouse.y += (mouse.targetY - mouse.y) * 0.15;
      } else {
        mouse.x += (mouse.targetX - mouse.x) * 0.05;
        mouse.y += (mouse.targetY - mouse.y) * 0.05;
      }

      // Update ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += r.speed;
        r.strength *= 0.96;
        if (r.radius >= r.maxRadius || r.strength <= 0.02) {
          ripples.splice(i, 1);
        }
      }

      ctx.clearRect(0, 0, width, height);

      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;
      const mouseRadius = 160;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const baseX = c * spacing;
          const baseY = r * spacing;

          // Harmonic ambient wave
          const ambientWave =
            Math.sin(c * 0.22 + time * 0.8) *
            Math.cos(r * 0.22 + time * 0.6);

          // Distance to mouse
          const dx = baseX - mouse.x;
          const dy = baseY - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let offsetX = 0;
          let offsetY = 0;
          let mouseIntensity = 0;

          if (dist < mouseRadius) {
            const factor = (1 - dist / mouseRadius);
            mouseIntensity = factor;
            // Elastic repulsion
            const push = Math.sin(factor * Math.PI) * 7;
            offsetX = (dx / (dist || 1)) * push;
            offsetY = (dy / (dist || 1)) * push;
          }

          // Ripple effect
          let rippleEffect = 0;
          for (let i = 0; i < ripples.length; i++) {
            const rip = ripples[i];
            const ripDx = baseX - rip.x;
            const ripDy = baseY - rip.y;
            const ripDist = Math.sqrt(ripDx * ripDx + ripDy * ripDy);
            const waveDelta = Math.abs(ripDist - rip.radius);
            if (waveDelta < 32) {
              const ripFactor = (1 - waveDelta / 32) * rip.strength;
              rippleEffect = Math.max(rippleEffect, ripFactor);
            }
          }

          const curX = baseX + offsetX;
          const curY = baseY + offsetY;

          // Check if this is a major crosshair point (every 4 cells)
          const isMajor = (c % 4 === 0) && (r % 4 === 0);

          if (isMajor) {
            // Draw engineering crosshair (+)
            const arm = 3.5 + mouseIntensity * 1.5;
            const alpha = Math.min(
              0.88,
              0.38 + ambientWave * 0.12 + mouseIntensity * 0.5 + rippleEffect * 0.4
            );
            ctx.strokeStyle = `rgba(139, 103, 246, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(curX - arm, curY);
            ctx.lineTo(curX + arm, curY);
            ctx.moveTo(curX, curY - arm);
            ctx.lineTo(curX, curY + arm);
            ctx.stroke();

            // Center glow on mouse
            if (mouseIntensity > 0.2) {
              ctx.fillStyle = `rgba(148, 85, 255, ${mouseIntensity * 0.7})`;
              ctx.beginPath();
              ctx.arc(curX, curY, 1.6, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // Draw standard matrix dot
            const baseRadius = 1.35;
            const radius = baseRadius + mouseIntensity * 1.6 + rippleEffect * 1.2;
            const alpha = Math.min(
              0.82,
              0.22 + ambientWave * 0.08 + mouseIntensity * 0.55 + rippleEffect * 0.4
            );

            ctx.fillStyle = mouseIntensity > 0.2
              ? `rgba(148, 85, 255, ${alpha})`
              : `rgba(139, 103, 246, ${alpha})`;

            ctx.beginPath();
            ctx.arc(curX, curY, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('click', handleClick);
    };
  }, [spacing]);

  return (
    <canvas
      ref={canvasRef}
      className={`engineering-grid-canvas ${className}`}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        ...style,
      }}
    />
  );
}
