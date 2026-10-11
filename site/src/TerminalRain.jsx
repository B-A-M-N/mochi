import { useEffect, useRef } from 'react';

/* Terminal Rain — streams of glowing glyphs raining down layered columns.
   All purple with a white-hot fading head. Canvas, DPR-aware.
   Reduced-motion → static field. Cheap enough to always run. */

const GLYPHS = 'ﾐﾑｼﾍｻﾜﾓｵｱｸﾀﾅﾆﾇﾈﾉ0123456789ABCDEF<>/{}[]$#*+-=;:%^&ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾊﾋﾌﾍﾎﾏﾓﾔﾕﾖﾗﾘﾙﾚﾛ';
const PURPLE = '#b79cff';
const PURPLE_DEEP = '#8558ff';
const WHITE = '#ffffff';

const randGlyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

export default function TerminalRain({ className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const FONT = 15;
    const LAYERS = 3;
    let raf = 0, W = 0, H = 0, cols = [];

    function spawnColumn(x, layer, fresh) {
      const speed = (0.6 + Math.random() * 1.2) * (layer + 1) * 0.7;
      const len = 10 + ((Math.random() * 24) | 0);
      return {
        x, layer,
        y: fresh ? Math.random() * H : -len * FONT,
        speed, len,
        trail: Array.from({ length: len }, randGlyph),
        purple: true,
      };
    }

    function build() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${FONT}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'top';
      cols = [];
      const colW = FONT * 1.15;
      const n = Math.ceil(W / colW);
      for (let i = 0; i < n; i++) {
        for (let L = 0; L < LAYERS; L++) {
          if (Math.random() < 0.72) cols.push(spawnColumn(i * colW, L, true));
        }
      }
    }

    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (const c of cols) {
        c.y += c.speed;
        if (Math.random() < 0.03) c.trail[(Math.random() * c.len) | 0] = randGlyph();
        if (c.y - c.len * FONT > H) {
          Object.assign(c, spawnColumn(c.x, c.layer, false));
          continue;
        }
        const alpha = [0.35, 0.55, 0.8][c.layer];
        for (let i = 0; i < c.len; i++) {
          const gy = c.y - i * FONT;
          if (gy < -FONT || gy > H + FONT) continue;
          const fade = 1 - i / c.len;
          if (i === 0) {
            // white-hot head with glow
            ctx.globalAlpha = Math.min(1, alpha + 0.4);
            ctx.fillStyle = WHITE;
            ctx.shadowColor = '#c4b5fd';
            ctx.shadowBlur = 14;
          } else if (i < 3) {
            // near-head: pale lavender
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#e9e4ff';
            ctx.shadowBlur = 0;
          } else {
            // deep purple tail, fading out
            ctx.globalAlpha = alpha * fade;
            ctx.fillStyle = i > c.len * 0.55 ? PURPLE_DEEP : PURPLE;
            ctx.shadowColor = PURPLE;
            ctx.shadowBlur = 5;
          }
          ctx.fillText(c.trail[i], c.x, gy);
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    }

    function still() {
      // one static render for reduced-motion users
      frame();
      cancelAnimationFrame(raf);
    }

    build();
    window.addEventListener('resize', build);
    if (reduce) still(); else raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', build);
    };
  }, []);

  return <canvas ref={canvasRef} className={`terminal-rain ${className}`} aria-hidden="true" />;
}
