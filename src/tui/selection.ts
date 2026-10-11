// Pure helpers for mouse text selection in the chat transcript. These are
// importable so they can be unit-tested without booting a terminal.
//
// All ranges are TERMINAL CELLS (not UTF-16 units): CJK wide chars and emoji
// count 2, combining marks 0 — matching how mouse columns arrive from SGR
// reports and how rows are measured in wrap.ts.

import { cellWidth, visibleCells } from './wrap.js';

const ANSI = /^\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|^\x1b\[[0-9;?]*[ -/]*[@-~]|^\x1b[()][0-9A-B]/;

/** Count the visible terminal cells of a string (ANSI = zero-width). */
export function visibleLen(s: string): number {
  return visibleCells(s);
}

/** Slice an ANSI-colored string to the visible cells in [from,to),
 *  preserving color codes for the requested range so it renders correctly.
 *  A wide char straddling a boundary is dropped (never half-rendered), and
 *  surrogate pairs are never split. If to exceeds the visible width,
 *  trailing color codes are preserved. */
export function sliceVisibleRange(s: string, from: number, to: number): string {
  if (to <= from) return '';
  let out = '';
  let cell = 0;
  let i = 0;
  while (i < s.length && cell < to) {
    if (s[i] === '\x1b') {
      const m = s.slice(i).match(ANSI);
      if (m) {
        out += m[0];
        i += m[0].length;
        continue;
      }
    }
    const cp = s.codePointAt(i) as number;
    const w = cellWidth(cp);
    // Include only chars fully inside the range: a straddling wide char is
    // dropped so the highlight can never spill past the selection edge.
    if (cell >= from && cell + w <= to) out += String.fromCodePoint(cp);
    cell += w;
    i += cp > 0xffff ? 2 : 1;
  }
  return out;
}

/** Wrap the visible chars [from,to) of a colored row in reverse-video. */
export function highlightRange(s: string, from: number, to: number): string {
  if (to <= from) return s;
  return (
    sliceVisibleRange(s, 0, from) +
    '\x1b[7m' +
    sliceVisibleRange(s, from, to) +
    '\x1b[27m' +
    sliceVisibleRange(s, Math.max(0, to), visibleLen(s))
  );
}