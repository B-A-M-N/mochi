---
name: web-design
description: Build production-grade web UI — layout systems, typography scales, responsive breakpoints, accessibility, and performance budgets. Use when creating or redesigning a website, landing page, dashboard, or web app UI, or when reviewing frontend code quality.
---

# Web Design Procedure

Ship interfaces at the bar of Stripe, Linear, Vercel — not template output.

## 1. Hierarchy before decoration
- One primary action per screen. If two buttons compete for attention, the design is wrong.
- Establish the scale: type sizes in a strict ratio (12/14/16/20/24/32/48), spacing in a 4px grid. Arbitrary values (`margin: 13px`) are defects.
- Content width: 60-75ch for prose, max 1200px for app shells. Center with margin, not padding hacks.

## 2. Layout system
- Flexbox for one-axis, CSS Grid for two-axis. Never nested flex where one grid suffices.
- Mobile-first media queries: write the base style for 375px, add `@media (min-width: ...)`. Verify at 375, 768, 1024, 1440.
- No fixed heights on text containers; use min-height and let content breathe.

## 3. Interaction and motion
- Transitions: 150-200ms ease-out on hover/focus. Anything above 300ms feels laggy, below 100ms feels broken.
- Focus states are mandatory (`:focus-visible`), visible, and high-contrast — keyboard nav is a first-class path, not an afterthought.
- Loading states: skeleton screens over spinners for >300ms operations; optimistic UI for mutations.

## 4. Accessibility floor (WCAG AA)
- Contrast >= 4.5:1 body text, >= 3:1 large text and UI boundaries. Check with a contrast tool, not by eye.
- Semantic HTML first: button is `button`, nav is `nav`. ARIA only where semantics end.
- All images have alt text; forms have labels; the page works at 200% zoom and with CSS disabled.

## 5. Performance budget
- LCP < 2.5s, CLS < 0.1, INP < 200ms. Images: AVIF/WebP, explicit width/height, lazy below fold.
- Ship system fonts or 2 weights max of a webfont with `font-display: swap`.
- JS budget: < 170KB gzipped for landing pages. If a chart needs 500KB of D3, render it as SVG server-side instead.

## 6. Verification
- Lighthouse >= 90 across the board, or justify every point lost in the PR.
- Test: keyboard-only pass, screen reader smoke test (headings hierarchy, landmarks), prefers-reduced-motion honored.
- Screenshot at all 4 breakpoints and compare against the spec before declaring done.

## Pitfalls
- Div soup: if the DOM tree nests >5 levels to place an element, the layout approach is wrong.
- Dark mode bolted on: design the token system (light/dark semantic vars) from the first commit, not retrofitted.
- Pixel-perfect to the mock at ONE viewport: real QA is the 4-breakpoint matrix.
