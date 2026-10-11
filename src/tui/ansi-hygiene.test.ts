import { describe, it, expect } from 'vitest';
import { stripAllAnsi, scrubAnsiFragments, ANSI_RE, ORPHAN_SGR_RE, terminateRow, paintCanvasBg } from './ansi-hygiene.js';

describe('ansi-hygiene', () => {
  it('strips complete SGR sequences', () => {
    expect(stripAllAnsi('\x1b[38;2;138;43;226m~/snake/index.html\x1b[0m')).toBe('~/snake/index.html');
    expect(stripAllAnsi('a\x1b[2Kb\x1b[1;32mgreen\x1b[0m')).toBe('abgreen');
  });

  it('scrubs orphaned truecolor payloads (the 138;43,226m bug)', () => {
    // ESC byte lost mid-chunk: the model sees and copies the bare payload.
    const parroted = 'at ~/snake/index.html138;43,226m from a previous session.';
    expect(scrubAnsiFragments(parroted)).toBe('at ~/snake/index.html from a previous session.');
  });

  it('scrubs orphaned 256-color payloads (the 250m bug)', () => {
    expect(scrubAnsiFragments('done;250m next line')).toBe('done next line');
    // Orphan ";num" after a WORD is scrubbed (it looks like a dropped 48;5 payload).
    expect(scrubAnsiFragments('pipeline step;250m threshold')).toBe('pipeline step threshold');
    // Full 24-bit/256 payloads are removed entirely, wherever they sit.
    expect(scrubAnsiFragments('x 48;5;233m y')).toBe('x  y');
    expect(scrubAnsiFragments('path38;2;138;43;226m suffix')).toBe('path suffix');
  });

  it('never eats legitimate prose containing digit patterns', () => {
    expect(scrubAnsiFragments('took 3;1m of pipe')).toContain('3;1m of pipe');
    expect(scrubAnsiFragments('version 1.2.3m main')).toBe('version 1.2.3m main');
    expect(scrubAnsiFragments('run 2331ms total')).toBe('run 2331ms total');
    expect(scrubAnsiFragments('3;1m')).toBe('3;1m'); // digit-prefixed ; stays
  });

  it('strips a dangling partial CSI tail at end of string', () => {
    expect(scrubAnsiFragments('text \x1b[38;2;1')).toBe('text ');
    expect(scrubAnsiFragments('text \x1b[')).toBe('text ');
  });

  it('leaves clean text untouched', () => {
    const clean = 'The file is 340 lines with 2331ms build time.';
    expect(scrubAnsiFragments(clean)).toBe(clean);
  });

  it('regexes are module-level (no per-call recompile) and global', () => {
    expect(ANSI_RE.global).toBe(true);
    expect(ORPHAN_SGR_RE.global).toBe(true);
  });
});

describe('terminateRow (SGR leak guard)', () => {
  it('passes through empty rows and already-terminated rows', () => {
    expect(terminateRow('')).toBe('');
    expect(terminateRow('plain text')).toBe('plain text[0m');
    expect(terminateRow('ok[0m')).toBe('ok[0m');
    expect(terminateRow('ok[m')).toBe('ok[m');
  });
  it('closes live colors and reverse-video so EL cannot inherit them', () => {
    // Model prose ending mid-color: without termination the frame EL would
    // clear to EOL in red and tint every following row.
    expect(terminateRow('[31mred text')).toBe('[31mred text[0m');
    // Selection highlight closes with 27m (attrs off) but SGR stays live.
    expect(terminateRow('a[7mhi[27m')).toBe('a[7mhi[27m[0m');
  });
});

describe('paintCanvasBg (black canvas & gray-bar elimination)', () => {
  const black = '[48;2;0;0;0m';

  it('passes through when bg is empty (light themes / transparent term)', () => {
    expect(paintCanvasBg('plain text', '')).toBe('plain text[0m');
    expect(paintCanvasBg('[31mred[0m', '')).toBe('[31mred[0m');
  });

  it('re-asserts canvas bg immediately after resets so text never sits on gray', () => {
    const raw = '  [31mword1[0m [32mword2[0m';
    const painted = paintCanvasBg(raw, black);
    // Every reset is paired with the forced canvas background
    expect(painted).toContain('[0m[48;2;0;0;0m [32mword2');
    expect(painted.endsWith('[0m[48;2;0;0;0m')).toBe(true);
    // No bare reset followed by space can survive
    expect(painted).not.toMatch(/\[0m /);
  });

  it('re-asserts canvas bg on compound resets like \x1b[0;31m', () => {
    const raw = '[0;31mred text[0m';
    const painted = paintCanvasBg(raw, black);
    expect(painted).toBe('[0m[48;2;0;0;0m[31mred text[0m[48;2;0;0;0m');
  });

  it('replaces \x1b[49m (default-bg reset) with forced canvas bg', () => {
    const raw = '[48;2;14;7;26mpill[49m trail';
    const painted = paintCanvasBg(raw, black);
    expect(painted).toContain('[48;2;14;7;26mpill[48;2;0;0;0m trail');
  });

  it('preserves custom element background colors within their spans', () => {
    // User message has a tinted bgUser pill ([48;2;14;7;26m); it must keep
    // its tint, and return to black only at the trailing reset.
    const userRow = '  [35m❯[0m [48;2;14;7;26m[1muser input[0m';
    const painted = paintCanvasBg(userRow, black);
    expect(painted).toContain('[48;2;14;7;26m[1muser input');
    expect(painted.endsWith('[0m[48;2;0;0;0m')).toBe(true);
  });
});
