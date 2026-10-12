---
name: frontend-design
description: Design distinctive, high-craft frontend interfaces — visual identity, typography, motion, 3D, and polish that avoids generic AI aesthetics. Use when building any user-facing web UI, landing page, dashboard, or component library where the result should feel designed, not generated. Ported from Claude's frontend-design practice, deepened for Mochi.
---

# Frontend Design Procedure

Generic output is failure. If the result could be mistaken for a default Tailwind template, the design did not happen.

## 1. Establish the identity (before any markup)
- Choose the ONE axis the design leads on: typography-led (editorial), motion-led (kinetic), space-led (minimal), color-led (expressive), or depth-led (layered/3D). Every later decision reinforces the chosen axis.
- Write a 5-word design thesis ("dense technical brutalism", "soft editorial warmth"). Every visual decision either serves the thesis or is cut.
- Reference triad: pick 3 real sites/products as the quality bar and articulate what they do that templates don't.

## 2. Typography (the biggest cheap win)
- Pair a characterful display face with a workhorse text face. System-ui everywhere = identity failure.
- Type scale: pick a ratio (1.25 / 1.333 / 1.5), commit, and never break it. Display sizes get tightened letter-spacing (-0.02em to -0.04em); body gets relaxed (0 to 0.01em).
- Line-height: 1.1-1.2 for display, 1.5-1.7 for body. Measure: 45-75ch.

## 3. Color with intent
- One dominant + one accent + neutrals. The accent appears in <=10% of the viewport — scarcity is what makes it pop.
- Dark modes are not inverted light modes: reduce saturation slightly, raise surface contrast incrementally (bg < surface < card), soften shadows.
- Gradient rules: one direction, one hue family, on backgrounds not text — unless the thesis is color-led, then commit fully.

## 4. Motion (choreography, not decoration)
- Stagger entrances 30-70ms apart, total sequence under 500ms. Everything enters with purpose: fade+rise 8-16px is the default; nothing spins for spin's sake.
- One spring curve family (e.g. cubic-bezier(0.22, 1, 0.36, 1)); one duration family per state class (150ms micro, 300ms panel, 500ms page).
- `prefers-reduced-motion` collapses ALL of this to opacity-only. Hover states transition 150ms; nothing transitions layout properties (width/top) — transform/opacity only.

## 5. Depth and detail (where craft lives)
- Layer with real z-semantics: background texture, content, chrome, overlay. Shadows: one ambient + one key, not five stacked box-shadows.
- Borders beat shadows on dark themes; inner 1px highlights (inset top rgba(255,255,255,0.06)) sell depth on cards.
- The details pass: consistent icon set (one stroke width), aligned baselines, focus rings that match the brand accent, selection color, scrollbar styling, empty states with the same care as full states.

## 6. 3D and canvas (when the thesis demands it)
- Three.js/R3F only when depth IS the design. Budget: <200KB gzipped; degrade to a static poster frame on mobile/low-power.
- Micro-interactions beat scenes: a card that tilts 4deg toward the cursor is worth more than a rotating hero mesh.
- Canvas/WebGL backgrounds must pause when off-screen (IntersectionObserver) and respect battery (frame-cap 30fps on mobile).

## 7. Verification
- Screenshot at 375/768/1440. The 375 must not be a squeezed 1440 — it is a different composition.
- Contrast audit (4.5:1 body), keyboard pass, reduced-motion pass, and a 3-second blur test: squint and the hierarchy must still read.
- The template test: name 3 things in this design a template could not produce. If you cannot, go back to step 1.

## Pitfalls
- Purple-gradient-on-dark-glass default AI aesthetic: if your palette is violet-on-slate, you have already failed the thesis.
- 14 fonts loaded for 2 used. Two families, four weights, max.
- Motion that plays once and annoys forever: everything loops must be subtle or exit.
