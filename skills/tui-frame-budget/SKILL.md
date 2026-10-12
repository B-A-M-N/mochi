---
name: tui-frame-budget
description: TUI rendering discipline — dirty-region rendering, 16ms frame budget, leak guards, theme correctness on pure black. Use when touching src/tui/.
---

# TUI Frame Budget

The TUI must render a full frame in under 16ms and never leak nodes across sessions.

## Trigger
- Any change in `src/tui/`.
- Reports of flicker, stale panes, or input lag.
- Adding a new pane/tab/split surface.

## Steps
1. Identify what changed on screen: if less than the whole viewport changed, mark only dirty regions and re-render those.
2. Keep the frame budget: profile with the perf probe; a frame that recomputes the whole tree every keystroke fails review.
3. Every new interactive element needs: focus handling (Tab order), keyboard alternative (no mouse-only controls), and a disabled state that is visually distinct.
4. Theme check: render on pure black (#000) and on white — verify no hardcoded hex in the new code; use theme tokens.
5. Leak guard: opening and closing 20 sessions in one process must not grow heap — assert with the leak probe if touching session lifecycle.

## Pitfalls
- Synchronous layout reads inside the render loop (forces reflow) — batch them.
- ANSI escape codes accumulated across frames (flicker) — clear regions explicitly.
- Text longer than the pane width must wrap or truncate by policy, never overflow silently.
- Focus rings drawn outside the clipping region paint on adjacent panes.

## Verification
- `npx vitest run src/tui/` green.
- Manual: split screen 2×2, resize, confirm no repaint artifacts.
- Perf probe: median frame < 16ms with three active sessions.
