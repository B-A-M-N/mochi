// ANSI hygiene helpers (shared).
//
// Two failure classes this fixes:
//  1. Colored tool output (npm/git --color=always) enters the MODEL CONTEXT
//     with raw escape codes; the model then parrots broken fragments of them
//     into its prose ("138;43,226m", "250m" — payload of a 38;2;r;g;b SGR
//     whose ESC byte was lost).
//  2. Stream chunk boundaries split a sequence mid-flight: one chunk ends
//     "\x1b[38;2;1", the next starts "38;43;226m". The leading ESC+CSI never
//     reassembles, so every "strip ANSI" regex misses the orphan tail.

import { nativeStripAnsi } from '../native/core.js';

/** Complete ANSI/CSI sequences (cursor moves, colors, etc.). */
export const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

/** SGR color payloads whose ESC+CSI prefix was lost (or a comma-mangled
 *  variant the model copied by eye). Three shapes occur in the wild:
 *   - the full payload "38;2;R;G;Bm" / "48;5;Nm" (ESC+[ bytes already
 *     stripped by an upstream layer), glued onto whatever preceded it;
 *   - the comma-mangled 38;2 tail that lost "38;2;" entirely: "138;43,226m"
 *     (the comma is the tell — real prose never writes "43,226m" as a
 *     semicolon-delimited unit);
 *   - the bare 256-color remainder ";250m" where "48;5" was dropped too —
 *     matched ONLY when the ';' is NOT preceded by a digit, so prose like
 *     "3;1m" (3.1 meters) and "version 1.2.3m" always survive. */
export const ORPHAN_SGR_RE =
  /(?:38|48);(?:2;[\d,;]{1,15}|5;\d{1,3})m|\d{1,3};\d{1,3},\d{1,3}m|(?<!\d);\d{1,3}m/g;

/** A dangling "\x1b[..." with no terminator at the end of a string. */
export const PARTIAL_CSI_TAIL_RE = /\x1b\[[0-9;]*$/;

/** Strip every escape sequence — for text entering the model context.
 *  Native-first: the Rust `mochi_strip_ansi` op replaces the JS regex pass. */
export function stripAllAnsi(s: string): string {
  if (!s) return s;
  const nat = nativeStripAnsi(s);
  if (nat !== null) return nat;
  return s.replace(ANSI_RE, '');
}

/** Strip complete sequences AND the orphaned fragments they decay into.
 *  For text headed to the SCREEN (model prose, streamed chunks). */
export function scrubAnsiFragments(s: string): string {
  return s.replace(ANSI_RE, '').replace(ORPHAN_SGR_RE, '').replace(PARTIAL_CSI_TAIL_RE, '');
}

/** Terminate a fully-rendered screen row so SGR state can never leak past
 *  it. Rows built from model prose or tool output can end with a live color
 *  (or a reverse-video highlight closed only with `27m`): without a trailing
 *  reset, the frame writer's EL clears the rest of the line IN that style and
 *  every later row inherits it — the classic whole-screen tint / gray-block
 *  defect. Empty rows pass through untouched (the writer paints the canvas). */
export function terminateRow(line: string): string {
  if (!line) return line;
  if (line.endsWith('\x1b[0m') || line.endsWith('\x1b[m')) return line;
  return line + '\x1b[0m';
}

/** Re-assert forced canvas background after any SGR reset sequence.
 *
 * In terminals whose default window background is not black (e.g. gray or
 * slate profile), bare SGR resets (`\x1b[0m` or `\x1b[m`) and default-bg resets
 * (`\x1b[49m`) revert the background color to the terminal's default, causing
 * any subsequent characters, words, and padding spaces to render on gray boxes
 * (the "gray bars" bug).
 *
 * This helper ensures that every reset in a row immediately re-applies the
 * forced canvas background `bg` (e.g. `\x1b[48;2;0;0;0m` or `\x1b[48;5;16m`),
 * guaranteeing that text, spaces, and padding sit seamlessly on pure black.
 * When `bg` is empty (light themes or transparent terminal), returns safe as-is. */
export function paintCanvasBg(line: string, bg: string): string {
  const safe = terminateRow(line);
  if (!bg) return safe;
  return safe
    .replace(/\x1b\[49m/g, bg)
    .replace(/\x1b\[0(?:;([0-9;]*))?m/g, (_match, rest) => {
      return rest ? `\x1b[0m${bg}\x1b[${rest}m` : `\x1b[0m${bg}`;
    })
    .replace(/\x1b\[m/g, `\x1b[0m${bg}`);
}

