import { describe, expect, it } from 'vitest';
import { wrap, visibleLen, visibleCells, cellWidth, sliceCells, stripAnsi, expandTabs, cellColToIndex, indexToCellCol } from './wrap.js';

describe('wrap', () => {
  it('wraps a normal sentence to the given width without overflow', () => {
    const lines = wrap('the quick brown fox jumps over the lazy dog', 12);
    for (const l of lines) {
      expect(visibleLen(l)).toBeLessThanOrEqual(12);
    }
    expect(lines[0]).toBe('the quick');
    // Reconstructing the words preserves every non-space character.
    expect(lines.join(' ').replace(/\s+/g, ' ')).toBe('the quick brown fox jumps over the lazy dog');
  });

  it('hard-splits an unbroken token longer than the width (no "fake wrapper")', () => {
    const lines = wrap('supercalifragilisticexpialidocious', 12);
    expect(lines.every((l) => visibleLen(l) <= 12)).toBe(true);
    // The token is split across exactly as many 12-char lines as needed.
    expect(lines).toEqual(['supercalifra', 'gilisticexpi', 'alidocious']);
    // No characters lost or invented.
    expect(lines.join('')).toBe('supercalifragilisticexpialidocious');
  });

  it('does not lose spaces between words across line boundaries', () => {
    const lines = wrap('alpha bravo charlie delta echo', 10);
    // Every line within width.
    expect(lines.every((l) => visibleLen(l) <= 10)).toBe(true);
    // Word separation preserved after removing wrap line breaks.
    expect(lines.join(' ').replace(/\s+/g, ' ')).toBe('alpha bravo charlie delta echo');
  });

  it('preserves intentional newlines as hard breaks', () => {
    const lines = wrap('line one\nline two', 80);
    expect(lines).toEqual(['line one', 'line two']);
  });

  it('honors a minimum width of one and handles empty input', () => {
    expect(wrap('', 4)).toEqual(['']);
    const one = wrap('x'.repeat(20), 1);
    expect(one.every((l) => visibleLen(l) <= 1)).toBe(true);
    expect(one.length).toBe(20);
  });

  it('counts CJK wide chars as 2 cells and never overflows', () => {
    expect(visibleCells('日本語')).toBe(6);
    expect(cellWidth('語'.codePointAt(0) as number)).toBe(2);
    const lines = wrap('日本語テストですよろしく', 10);
    for (const l of lines) expect(visibleCells(l)).toBeLessThanOrEqual(10);
    expect(lines.join('')).toBe('日本語テストですよろしく');
  });

  it('counts emoji as 2 cells and combining marks as 0', () => {
    expect(cellWidth('🔍'.codePointAt(0) as number)).toBe(2);
    expect(visibleCells('é')).toBe(1); // e + U+0301 combining acute
    expect(visibleCells('⚡ ok')).toBe(2 + 3);
  });

  it('strips full CSI sequences (not just SGR) from width math', () => {
    expect(stripAnsi('\x1b[2K\rprompt')).toBe('\rprompt');
    expect(visibleCells('\x1b[38;5;199mhi\x1b[0m')).toBe(2);
  });

  it('never splits a surrogate pair or wide char when hard-splitting', () => {
    const lines = wrap('🔍'.repeat(10), 5);
    for (const l of lines) {
      expect(visibleCells(l)).toBeLessThanOrEqual(5);
      expect(l).not.toContain('�');
    }
    expect(lines.join('')).toBe('🔍'.repeat(10));
    const { text } = sliceCells('\x1b[31m日本語\x1b[0m', 4);
    expect(visibleCells(text)).toBeLessThanOrEqual(4);
    expect(text).toContain('\x1b[31m');
  });
});
describe('tabs', () => {
  it('expands tabs to the next multiple-of-8 stop', () => {
    expect(expandTabs('\ta')).toBe('        a');
    expect(expandTabs('ab\tc')).toBe('ab      c');
    expect(expandTabs('1234567\tx')).toBe('1234567 x');
    expect(expandTabs('12345678\tx')).toBe('12345678        x');
  });

  it('counts tabbed text at its rendered width (never 0)', () => {
    expect(visibleCells('\ta')).toBe(9);
    expect(visibleCells('ab\tc')).toBe(9);
    // Two tabs: 8 + 8
    expect(visibleCells('\t\t')).toBe(16);
  });

  it('wrap() never overflows on tabbed code', () => {
    const lines = wrap('\tfunction foo() {\n\t\treturn 42;\n\t}', 12);
    for (const l of lines) {
      expect(visibleLen(l)).toBeLessThanOrEqual(12);
    }
    expect(lines.join('\n')).not.toContain('\t');
  });

  it('sliceCells accounts for tab width', () => {
    const { text, cells } = sliceCells('\tab', 9);
    expect(cells).toBe(9);
    expect(visibleCells(text)).toBe(9);
  });

  it('expandTabs passes ANSI through without counting it as columns', () => {
    const out = expandTabs('\x1b[31m\ta\x1b[0m');
    expect(out).toBe('\x1b[31m        a\x1b[0m');
    expect(visibleCells(out)).toBe(9);
  });
});

describe('cell column <-> string index', () => {
  it('is the identity for ASCII', () => {
    expect(cellColToIndex('hello world', 6)).toBe(6);
    expect(indexToCellCol('hello world', 6)).toBe(6);
    expect(cellColToIndex('hi', 99)).toBe(2);
  });

  it('counts wide chars as 2 cells', () => {
    // '日本' = 2 chars, 4 cells
    expect(indexToCellCol('日本x', 2)).toBe(4);
    expect(cellColToIndex('日本x', 4)).toBe(2);
    expect(cellColToIndex('日本x', 5)).toBe(3);
    // mid-wide-char snaps past the char
    expect(cellColToIndex('日本', 1)).toBe(1);
    expect(cellColToIndex('日本', 3)).toBe(2);
  });

  it('round-trips on mixed content', () => {
    const s = 'hi 日本 ok 👍 done';
    for (let col = 0; col <= indexToCellCol(s, s.length); col++) {
      const idx = cellColToIndex(s, col);
      // converting back lands on a char boundary at or before col
      expect(indexToCellCol(s, idx)).toBeLessThanOrEqual(col + 1);
    }
  });

  it('treats tabs as expanded (matching display)', () => {
    expect(indexToCellCol('\ta', 1)).toBe(8);
    expect(cellColToIndex('\ta', 8)).toBe(1);
  });

  it('ignores ANSI codes in both directions', () => {
    const s = '\x1b[31mhi\x1b[0m';
    // idx 5 = just past the opening escape → column 0; idx 7 = past 'hi' → 2.
    expect(indexToCellCol(s, 5)).toBe(0);
    expect(indexToCellCol(s, 7)).toBe(2);
    // An index landing mid-escape maps to the current (pre-escape) column.
    expect(indexToCellCol(s, 2)).toBe(0);
    // Cell columns skip escapes: col 2 = 'hi' → raw index 7.
    expect(cellColToIndex(s, 2)).toBe(7);
    expect(cellColToIndex(s, 0)).toBe(0);
  });
});
