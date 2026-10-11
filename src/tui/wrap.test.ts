import { describe, expect, it } from 'vitest';
import { wrap, visibleLen, visibleCells, cellWidth, sliceCells, stripAnsi } from './wrap.js';

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