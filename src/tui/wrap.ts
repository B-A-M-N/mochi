// Terminal-aware text wrapping shared by the TUI and its tests.
// Kept dependency-free so the wrap logic is unit-testable in isolation.

/** Strip ANSI escape sequences: full CSI (not just SGR), OSC hyperlinks, and
 *  charset selects — so width math never counts invisible bytes as cells. */
export function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[()][0-9A-B]/g, '');
}

/** Terminal cell width of a single Unicode code point (wcwidth-style).
 *  CJK wide + most emoji render 2 cells; combining marks / variation
 *  selectors / ZWJ / controls render 0; everything else renders 1.
 *  Ambiguous-width characters count as 1 (non-CJK locale behavior). */
export function cellWidth(cp: number): number {
  if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0;
  // Zero-width: combining marks, enclosing marks, VS15/VS16, ZWJ, tags.
  if (
    (cp >= 0x0300 && cp <= 0x036f) || (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x1dc0 && cp <= 0x1dff) || (cp >= 0x20d0 && cp <= 0x20ff) ||
    (cp >= 0xfe00 && cp <= 0xfe0f) || cp === 0x200d ||
    (cp >= 0xe0000 && cp <= 0xe0fff)
  ) return 0;
  // Wide: CJK radicals/strokes, kana, CJK compat, CJK ext, Hangul, fullwidth.
  if (
    (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) || (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x20000 && cp <= 0x3fffd)
  ) return 2;
  // Emoji blocks render 2 cells on modern terminals (wcwidth's W provision
  // plus terminal emoji presentation); misc symbols/dingers stay 1.
  if (
    (cp >= 0x1f000 && cp <= 0x1faff) || (cp >= 0x231a && cp <= 0x231b) ||
    (cp >= 0x23e9 && cp <= 0x23f3) || (cp >= 0x23f8 && cp <= 0x23fa) ||
    (cp >= 0x25fd && cp <= 0x25fe) || cp === 0x2614 || cp === 0x2615 ||
    (cp >= 0x2648 && cp <= 0x2653) || cp === 0x267b || cp === 0x267f ||
    cp === 0x2693 || (cp >= 0x26a0 && cp <= 0x26a7) || cp === 0x26b0 ||
    cp === 0x26b1 || (cp >= 0x26c4 && cp <= 0x26c5) || cp === 0x26ce ||
    cp === 0x26d4 || cp === 0x26ea || (cp >= 0x26f2 && cp <= 0x26f3) ||
    (cp >= 0x26f5 && cp <= 0x26fa) || cp === 0x26fd
  ) return 2;
  // Emoji_Presentation=Yes characters outside the blocks above. These default
  // to emoji (2-cell) rendering even without VS16 — notably the status glyphs
  // agents emit constantly (✅❌⭐✨❤️➕➖➗Ⓜ️⌨️↔️‼️⁉️™️ℹ️). Missing them makes
  // every bordered table with a status column jag: measured 1, rendered 2,
  // so the right border lands one cell off per glyph. Undercounting is the
  // dangerous direction (padding absorbs overcounts); these are all 2.
  if (
    cp === 0x203c || cp === 0x2049 || cp === 0x2122 || cp === 0x2139 ||
    (cp >= 0x2194 && cp <= 0x2199) || (cp >= 0x21a9 && cp <= 0x21aa) ||
    cp === 0x2318 || cp === 0x2328 || cp === 0x24c2 ||
    cp === 0x2705 || (cp >= 0x270a && cp <= 0x270b) || cp === 0x2728 ||
    cp === 0x274c || cp === 0x274e || (cp >= 0x2753 && cp <= 0x2755) ||
    (cp >= 0x2763 && cp <= 0x2764) || (cp >= 0x2795 && cp <= 0x2797) ||
    cp === 0x27a1 || cp === 0x27b0 || cp === 0x27bf ||
    (cp >= 0x2934 && cp <= 0x2935) || (cp >= 0x2b05 && cp <= 0x2b07) ||
    (cp >= 0x2b1b && cp <= 0x2b1c) || cp === 0x2b50 || cp === 0x2b55
  ) return 2;
  return 1;
}

/** Expand tab characters to spaces at tab stops (default every 8 columns),
 *  tracking the cell column ANSI-aware. A raw `\t` counts 0 cells in
 *  cellWidth() but renders as up to 8 in the terminal — measuring without
 *  expanding misaligns every column after a tab and breaks the width-harness
 *  invariant for tabbed tool output and code. */
export function expandTabs(s: string, tabWidth = 8): string {
  if (!s.includes('\t')) return s;
  let out = '';
  let col = 0;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    // Pass ANSI sequences through without advancing the column.
    const skip = ansiSeqLen(s, i);
    if (skip > 0) { out += s.slice(i, i + skip); i += skip; continue; }
    if (ch === '\x1b') { out += ch; i++; continue; } // lone ESC: emit, no column
    if (ch === '\n' || ch === '\r') { out += ch; col = 0; i++; continue; }
    if (ch === '\t') {
      const spaces = tabWidth - (col % tabWidth);
      out += ' '.repeat(spaces);
      col += spaces;
      i++;
      continue;
    }
    const cp = s.codePointAt(i) as number;
    out += String.fromCodePoint(cp);
    col += cellWidth(cp);
    i += cp > 0xffff ? 2 : 1;
  }
  return out;
}

/** Visible terminal cell width of a string (tabs expanded, ANSI-stripped, CJK/emoji-aware). */
export function visibleCells(s: string): number {
  const plain = stripAnsi(expandTabs(s));
  let cells = 0;
  for (const ch of plain) cells += cellWidth(ch.codePointAt(0) as number);
  return cells;
}

/** Visible (ANSI-stripped) length of a string, in terminal cells. */
export function visibleLen(s: string): number {
  return visibleCells(s);
}

/** Length of the ANSI escape sequence starting at `s[i]` (0 when none).
 *  Shared by the tab expander and the column/index converters so all three
 *  agree on what is invisible. */
function ansiSeqLen(s: string, i: number): number {
  if (s[i] !== '\x1b') return 0;
  const osc = s.slice(i).match(/^\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/);
  if (osc) return osc[0].length;
  const csi = s.slice(i).match(/^\x1b\[[0-9;?]*[ -/]*[@-~]/);
  if (csi) return csi[0].length;
  const cs = s.slice(i).match(/^\x1b[()][0-9A-B]/);
  if (cs) return cs[0].length;
  return 0;
}

/** Convert a terminal-cell column to a UTF-16 string index into the RAW `s`
 *  (which may contain tabs and ANSI — both are accounted for, so the result
 *  slices the original string correctly). A column landing inside a wide char
 *  snaps to the index just past it. Out-of-range columns clamp to the end. */
export function cellColToIndex(s: string, col: number): number {
  if (col <= 0) return 0;
  let cells = 0;
  let i = 0;
  while (i < s.length && cells < col) {
    const skip = ansiSeqLen(s, i);
    if (skip > 0) { i += skip; continue; }
    const ch = s[i];
    if (ch === '\n' || ch === '\r') { i++; continue; }
    if (ch === '\t') { cells += 8 - (cells % 8); i++; continue; }
    const cp = s.codePointAt(i) as number;
    cells += cellWidth(cp);
    i += cp > 0xffff ? 2 : 1;
  }
  return i;
}

/** Convert a UTF-16 string index into the RAW `s` to a terminal-cell column:
 *  the display column where `s[idx]` renders. Tabs count to their stop,
 *  ANSI sequences count 0. The inverse of cellColToIndex (modulo
 *  mid-wide-char snapping). */
export function indexToCellCol(s: string, idx: number): number {
  let cells = 0;
  let i = 0;
  const end = Math.max(0, Math.min(idx, s.length));
  while (i < end) {
    const skip = ansiSeqLen(s, i);
    if (skip > 0) { i += skip > end - i ? end - i : skip; continue; }
    const ch = s[i];
    if (ch === '\n' || ch === '\r') { i++; continue; }
    if (ch === '\t') { cells += 8 - (cells % 8); i++; continue; }
    const cp = s.codePointAt(i) as number;
    cells += cellWidth(cp);
    i += cp > 0xffff ? 2 : 1;
  }
  return cells;
}

/** Slice the first `max` terminal cells of `s`, preserving ANSI codes and
 *  never splitting a surrogate pair or a wide character. Returns the slice
 *  plus the cell count consumed. */
export function sliceCells(s: string, max: number): { text: string; cells: number } {
  s = expandTabs(s);
  let out = '';
  let cells = 0;
  let i = 0;
  while (i < s.length && cells < max) {
    if (s[i] === '\x1b') {
      const osc = s.slice(i).match(/^\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/);
      if (osc) { out += osc[0]; i += osc[0].length; continue; }
      const csi = s.slice(i).match(/^\x1b\[[0-9;?]*[ -/]*[@-~]/);
      if (csi) { out += csi[0]; i += csi[0].length; continue; }
      const cs = s.slice(i).match(/^\x1b[()][0-9A-B]/);
      if (cs) { out += cs[0]; i += cs[0].length; continue; }
    }
    const cp = s.codePointAt(i) as number;
    const w = cellWidth(cp);
    if (cells + w > max) break;
    out += String.fromCodePoint(cp);
    cells += w;
    i += cp > 0xffff ? 2 : 1;
  }
  return { text: out, cells };
}

/** Wrap `text` to at most `max` visible columns per line (word-aware).
 *  Fixes "fake wrapping": an unbroken token longer than `max` is hard-split
 *  so no line ever spills past the terminal width, and leading spaces are
 *  preserved so adjacent wrapped lines don't visually concatenate. Widths
 *  are terminal cells (CJK/emoji count 2), and hard splits never break a
 *  surrogate pair or wide character. */
export function wrap(text: string, max: number): string[] {
  if (!text) return [''];
  const out: string[] = [];
  const maxN = Math.max(1, max);
  for (const paragraph of expandTabs(text).split('\n')) {
    let line = '';
    let lineVis = 0; // visible cells of `line`, kept O(1)
    const flush = () => { if (line.trim()) out.push(line.trimEnd()); line = ''; lineVis = 0; };
    for (const token of paragraph.split(/(\s+)/)) {
      let word = token;
      let wVis = visibleCells(word);
      if (wVis === 0) { line += word; continue; } // pure whitespace only
      if (lineVis + wVis > maxN) flush();
      // Hard-split a SINGLE token longer than the width so it can never spill
      // past the terminal (a real "fake wrapper" before).
      while (wVis > maxN) {
        const room = maxN - lineVis;
        const { text: chunk, cells } = sliceCells(word, room > 0 ? room : maxN);
        if (cells === 0) break; // zero-width remainder: avoid an infinite loop
        out.push(line + chunk);
        // `chunk` is a literal prefix of `word` (chars + ANSI passthrough),
        // so advancing by its UTF-16 length consumes exactly what we emitted.
        word = word.slice(chunk.length);
        wVis = visibleCells(word);
        line = '';
        lineVis = 0;
      }
      line += word;
      lineVis += wVis;
    }
    out.push(line);
  }
  return out.length ? out : [''];
}