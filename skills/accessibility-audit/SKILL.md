---
name: accessibility-audit
description: Audit and fix accessibility (a11y) — WCAG 2.2 AA compliance, screen-reader flows, keyboard navigation, and ARIA correctness for web apps. Use when checking a UI for accessibility, fixing a11y bugs, or preparing for compliance review.
---

# Accessibility Audit Procedure

Accessibility is correct semantics, not ARIA sprinkles. The stack: semantic HTML > ARIA > nothing. The test: unplug the mouse, unplug the eyes.

## 1. Keyboard pass (the cheapest audit)
- Tab through the whole flow: every interactive element reachable, visible focus (never `outline: none` without replacement), logical order, no traps.
- Modal traps: focus moves IN on open, returns to the trigger on close, `Esc` closes, tab cycles INSIDE the modal only.
- Custom widgets (tabs, dropdowns, carousels) implement their keyboard contract: arrow keys per WAI-ARIA authoring practices — arrows for tabs/options, Space/Enter for activation.

## 2. Screen-reader pass (NVDA free on Windows; VoiceOver on macOS/iOS)
- Landmarks: one `<main>`, header/nav/footer as elements, skip-link first. Headings: hierarchical (h1 unique, no level skips), nothing conveyed by "bold big text".
- Name-role-value: every control announces what it IS and DOES. Icon-only buttons need `aria-label`; toggles announce state (`aria-pressed`/`aria-expanded`).
- Live regions: async updates (toasts, search counts, loading states) announced via `aria-live="polite"` — silent UI updates are invisible to SR users.
- Forms: every input has a programmatic label (`for`/`id`, not placeholder-only); errors linked via `aria-describedby` and announced; required marked in text, not color alone.

## 3. Automated floor (catches ~30-40%; the rest is manual)
- axe-core in CI (Playwright integration) with zero violations on key pages; Lighthouse a11y section >= 95.
- But: axe cannot tell you tab ORDER is wrong, focus is lost on route change, or the flow is unusable. Manual passes above are the real audit.

## 4. Visual standards
- Contrast: 4.5:1 body, 3:1 for >=24px text and UI boundaries/focus indicators. Zoom to 200% and mobile: no loss of function, no horizontal scroll for single-column prose.
- Motion: `prefers-reduced-motion` honored; nothing flashes >3x/second (seizure threshold).
- Color-blindness: run through deuteranopia/protanopia simulation — never color-alone status; pair with icon/text.

## 5. Fix priorities (impact-ordered)
- Blockers first: unreachable flows, unlabeled forms, broken focus order. Then: SR announcements, contrast, target sizes (24x24 CSS px minimum).
- Fix at the component layer (design system), not per-page — a fix in the button component fixes every page at once.

## Pitfalls
- `role="button"` on a div instead of using `<button>`: you've rebuilt HTML badly. Native elements carry keyboard/SR behavior for free.
- aria-label overuse: it OVERRIDES content — `aria-label="Close"` on a button containing "Close ×" hides the visible text from SR users.
- Testing with the dev tools' a11y tree only: it lies by omission (not all properties shown). A real screen reader is the oracle.
