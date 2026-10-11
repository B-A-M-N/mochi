import { useEffect, useRef } from 'react';

/* Terminal Rain — streams of glowing glyphs raining down layered columns.
   Canvas-based, DPR-aware, pauses offscreen / on reduced-motion.
   Palette: emerald matrix green on ink; purple accents for the mascot accent. */

const GLYPHS = 'ﾐﾑｼﾍｻﾜﾓｵｱｸｻﾀﾅﾆｻ0123456789ABCDEF<>/{}[]$#*+-=;:%^&ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏ';
const GREEN = '#4ade80';
const GREEN_HI = '#a7f3d0';
const PURPLE = '#8b75f6';

function randGlyph() {
  return GLYPHS[(Math.random() * GLYPHS.length) | 0];
}

export default function TerminalRain({ className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let running = true;
    let W = 0, H = 0, dpr = 1;
    let cols = [];
    const FONT = 15;
    const LAYERS = 3;

    function spawnColumn(x, layer, fresh) {
      const speed = (0.5 + Math.random() * 0.9) * (layer + 1) * 0.55;
      const len = 8 + ((Math.random() * 22) | 0);
      return {
        x, layer,
        y: fresh ? Math.random() * H : -len * FONT,
        speed,
        len,
        trail: Array.from({ length: len }, () => randGlyph()),
        swapAt: Math.random() * 4,
        purple: Math.random() < 0.06,
      };
    }

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
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
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (const c of cols) {
        c.y += c.speed;
        if (Math.random() < 0.02) c.trail[(Math.random() * c.len) | 0] = randGlyph();
        if (c.y - c.len * FONT > H) {
          Object.assign(c, spawnColumn(c.x, c.layer, false));
          continue;
        }
        const alpha = [0.16, 0.3, 0.5][c.layer];
        const color = c.purple ? PURPLE : GREEN;
        for (let i = 0; i < c.len; i++) {
          const gy = c.y - i * FONT;
          if (gy < -FONT || gy > H + FONT) continue;
          if (i === 0) {
            ctx.fillStyle = c.purple ? '#c4b5fd' : GREEN_HI;
            ctx.globalAlpha = Math.min(1, alpha + 0.35);
          } else {
            const fade = 1 - i / c.len;
            ctx.fillStyle = color;
            ctx.globalAlpha = alpha * fade * fade;
          }
          ctx.fillText(c.trail[i], c.x, gy);
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    function still() {
      ctx.clearRect(0, 0, W, H);
      for (const c of cols) {
        const alpha = [0.16, 0.3, 0.5][c.layer];
        for (let i = 0; i < c.len; i++) {
          const gy = c.y - i * FONT;
          if (gy < 0 || gy > H) continue;
          ctx.fillStyle = c.purple ? PURPLE : GREEN;
          ctx.globalAlpha = alpha * (1 - i / c.len);
          ctx.fillText(c.trail[i], c.x, gy);
        }
      }
      ctx.globalAlpha = 1;
    }

    const io = new IntersectionObserver(([e]) => {
      running = e.isIntersecting && !reduce;
      if (running) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    });
    io.observe(canvas);

    build();
    window.addEventListener('resize', build);
    if (reduce) still(); else raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', build);
    };
  }, []);

  return <canvas ref={canvasRef} className={`terminal-rain ${className}`} aria-hidden="true" />;
}
