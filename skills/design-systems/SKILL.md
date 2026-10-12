---
name: design-systems
description: Build and maintain design systems — token architecture, component APIs, documentation, versioning, and adoption strategy. Use when creating a component library, unifying UI across an app, or fixing inconsistent styling across a codebase.
---

# Design System Procedure

A design system is a product whose users are developers. Ship it with the same rigor: API design, docs, versioning, and adoption metrics.

## 1. Tokens before components (the foundation that everything reads)
- Three-tier tokens: primitives (raw values: `blue-500`) -> semantic (intent: `color-action-primary`) -> component-scoped (`button-bg`). Components read ONLY semantic+scoped tiers — a component importing a primitive bypasses the whole system.
- Token naming by ROLE not value: `color-danger` not `color-red` — the day the brand changes to green, semantic names survive and value-names become lies.
- Token delivery: CSS custom properties as the runtime substrate (theme switching for free), generated from a single source (Style Dictionary-class pipeline) typed for TS consumers.

## 2. Component API design (the part that ages worst)
- Composition over configuration: children/slots beat 12 boolean props (a `card-elevated-compact` prop is a missing composition API). Variants via typed unions, never boolean soup (`variant: 'primary'|'secondary'` not `primary?: boolean; secondary?: boolean`).
- Every interactive component: polymorphic `as`/`asChild` escape hatch, className/style passthrough, and refs forwarded. Render-prop/slot patterns where styling must leak.
- Controlled + uncontrolled modes for form-adjacent components; `defaultValue`/`value` pairs. The API mirrors the platform's own conventions (onChange/onFocus names) — surprise is API debt.

## 3. Accessibility as a component invariant
- Interactive components ship keyboard/ARIA-correct from the component, not per-app: focus management (modals trap and restore), roving tabindex in lists, `aria-*` derived from props automatically.
- The a11y test suite lives IN the component repo (axe on every story) — a11y regressions are build failures, not backlog items.

## 4. Documentation that engineers actually use
- Every component: live examples (the docs ARE the test rig — Storybook/Equivalent), props table generated from types (never hand-maintained), do/don't usage guidance, and the design rationale for non-obvious decisions.
- Copy-paste-ready snippets: the docs' job is making correct usage the LAZY path.

## 5. Versioning and distribution
- Semver with a published migration path for majors (codemods when the break is mechanical). Deprecation warnings in the console at runtime for old APIs — removal dates in the docs.
- Monorepo with the consuming apps (see monorepo-tooling) for tight iteration; publish only when external consumers exist.

## 6. Adoption (the metric that decides success)
- Measure: % of screens using system components, count of one-off styles in app code (`grep className=` drift), time-to-build-standard-screen. A system with low adoption is a library nobody asked for.
- Contribution path: contributors propose components with the system's own API conventions; the system team reviews API before implementation (API review > code review).
- The escape hatch is designed: "build outside the system" is allowed with a documented reason — a system with no escape hatch gets forked silently.

## Pitfalls
- Building the system by extracting components one app at a time with no token layer: you get a component pile, not a system — inconsistency returns through the token bypass.
- Pixel-perfect pixel-locked styling (hard-coded values everywhere): themes and density modes become impossible; every value through a token or it doesn't ship.
- Big-bang adoption mandates: migrate screen-by-screen on natural touch points; a rewrite mandate produces a fork with worse components.
