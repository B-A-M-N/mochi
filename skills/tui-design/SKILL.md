---
name: tui-design
description: Design and build professional terminal user interfaces (TUIs) — layout composition, color systems, keybinding conventions, and rendering performance budgets. Use when building or restyling a CLI dashboard, terminal app, prompt, or any ncurses/ANSI/Textual/Bubble Tea/Ratatui-style interface.
---

# TUI Design Procedure

Build terminal interfaces that feel engineered, not generated. Reference systems: lazygit, k9s, htop, btop, lazydocker, bubbletea examples.

## 1. Establish the layout grammar first
- Pick ONE composition before writing code: stacked panels, sidebar + main, or tabbed panes. Mixing grammars reads as amateur.
- Respect a character grid: design on an 80x24 minimum, verify at 120x40 and 200x50.
- Reserve line 0 for the title bar, bottom line for the hint bar. Content never touches the frame edges.

## 2. Color system (not decoration)
- Define a 6-token palette: primary, secondary, success, warning, danger, muted. All colors come from tokens — no inline hex.
- Default to the terminal's own colors (default fg/bg) for text; use ANSI-256 or truecolor only for tokens.
- Dark and light terminals both must pass: test with `TERM=xterm-256color` and a light background. Never encode meaning in color alone — pair with a glyph.

## 3. Typography and density
- Uppercase+letterspaced section labels over horizontal rules — rules waste lines.
- Numeric columns right-aligned; use a monospace-safe progress bar (`█░` or `━─`) never unicode box-drawing in labels.
- Whitespace is the cheapest polish: one blank line between logical groups beats any border.

## 4. Keybinding conventions (non-negotiable)
- `q`/`Ctrl+C` quit, `?` help, `/` search, `j/k` or arrows move, `Enter` select, `Esc` back/cancel, `Tab` cycle focus, `r` refresh, `d` delete (with confirm).
- Show the hint bar: `q quit · / search · ? help`. Every bindable action is visible or discoverable via `?`.

## 5. Rendering performance budget
- Full redraws only on tick or input; diff otherwise. A 10Hz render loop is the ceiling for stats screens.
- Never block the render loop on I/O — spawn reads async, render last-known data with a staleness marker (`…` or `syncing`).
- Budget: <16ms per frame for stdlib/ANSI, and verify with `time` on the render function.

## 6. Verification
- Run the app inside `tmux` and screenshot via `tmux capture-pane -p` at 80x24, 120x40.
- Every control reachable by keyboard alone; no dead zones; `Esc` never dead-ends.
- Resize-proof: `tmux resize-window` between captures and confirm no tearing.

## Pitfalls
- Unicode width lies: CJK/emoji are 2 cells — use a wcwidth implementation, never `str.length`.
- Colors drift: if a color literal appears outside the palette file, the design has already failed.
- Feature creep in the hint bar: max 7 hints visible; the rest go under `?`.
