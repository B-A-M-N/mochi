---
name: gui-design
description: Design and build desktop GUI applications — Qt/PySide6, Electron, Tauri, GTK patterns for layout, state management, native platform conventions, and packaging. Use when building a desktop app, settings window, launcher, or any windowed interface.
---

# GUI Design Procedure

Desktop apps are judged against the OS's own apps. Match native conventions before inventing style.

## 1. Platform conventions first
- macOS: menu bar owns commands, traffic-light window controls, Cmd-based shortcuts. Windows/Linux: in-window menu/toolbar acceptable, Ctrl-based shortcuts.
- Use the platform's native widgets for chrome (file pickers, dialogs, context menus) — custom chrome is a moat only if you ship it everywhere consistently.
- DPI: test at 1x, 1.5x, 2x scale. Blurry icons or clipped text at fractional scale = failed.

## 2. Layout architecture
- One window = one job. Settings, main workspace, and one-off dialogs are separate surfaces.
- Layout with stretch factors and size policies, never pixel coordinates. The window must be resizable from 480px wide to full-screen without breakage.
- Panels: dockable or fixed — pick one per app. Mixed modes confuse spatial memory.

## 3. State and threading (the app-killer bugs)
- UI thread never blocks: any operation >100ms goes to a worker (QThread, tokio task, worker script) with progress + cancel.
- State flows one direction: model -> view re-render. Two-way binding on complex state produces ghost bugs.
- Every long-running action has visible progress, and every progress has a cancel.

## 4. Interaction details
- Double-click selects a word; a destructive action needs Undo, not a confirm dialog (unless irreversible).
- Persist window geometry and pane sizes on close; restore on open.
- Shortcuts: discoverable in menus with the binding shown; global shortcuts registered with the OS, not polled.

## 5. Packaging and startup
- Cold start < 1s for utility apps; show a window (even a splash) within 300ms regardless.
- Single-instance behavior with args-forwarding (`qputty`-style) for document-driven apps.
- Ship code-signed; unsigned binaries get SmartScreen/Gatekeeper hell.

## 6. Verification
- Manual matrix: 3 DPI scales, light/dark mode, min/max/restore, and a 10-minute soak for memory growth.
- All keyboard paths: full traversal order, Esc semantics per dialog, no focus traps.
- Crash recovery: kill -9 mid-operation; next launch must not show corrupt state.

## Pitfalls
- Doing layout in code that should be declarative (QML, HTML/CSS, .ui files) — imperative layout rots.
- Blocking the main thread "just for this call": network calls on the UI thread are the #1 GUI bug.
- reinventing scroll/undo/clipboard: every platform gives these for free; hand-rolled versions are always worse.
