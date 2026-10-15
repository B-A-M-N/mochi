import { describe, it, expect } from 'vitest';
import { symbolEnd } from './replace-symbol.js';

// These guard the fix for a silent-corruption bug: the old "scan for the next
// top-level definition, else run to EOF" heuristic DELETED trailing code after
// the last symbol (e.g. a Python `if __name__` guard).

describe('symbolEnd (brace languages)', () => {
  it('stops at the first non-definition statement after the function', () => {
    const lines = [
      'function foo() {',   // 0
      '  return 1;',        // 1
      '}',                  // 2
      'const x = 1;',       // 3
    ];
    expect(symbolEnd(lines, 0, '.ts')).toBe(3); // excludes `const x`
  });

  it('consumes to the matching closing brace of the LAST function (not EOF)', () => {
    const lines = [
      'const a = 1;',       // 0
      'function foo() {',   // 1
      '  if (a) {',         // 2
      '    return 2;',      // 3
      '  }',                // 4
      '}',                  // 5
      '',
    ];
    expect(symbolEnd(lines, 1, '.ts')).toBe(6); // line 6 is the empty EOF tail
  });

  it('ignores braces inside strings and comments', () => {
    const lines = [
      'function foo() {',        // 0
      '  const s = "}}}";',      // 1
      '  // { not a brace',      // 2
      '  return s;',             // 3
      '}',                       // 4
      'const y = 2;',            // 5
    ];
    expect(symbolEnd(lines, 0, '.ts')).toBe(5);
  });

  it('handles Allman-style braces', () => {
    const lines = [
      'function foo()',   // 0
      '{',                // 1
      '  return 1;',      // 2
      '}',                // 3
      'const z = 3;',     // 4
    ];
    expect(symbolEnd(lines, 0, '.ts')).toBe(4);
  });
});

describe('symbolEnd (indentation languages)', () => {
  it('stops before a dedented main guard (previously deleted)', () => {
    const lines = [
      'def foo():',                     // 0
      '    return 1',                   // 1
      '',                               // 2
      'if __name__ == "__main__":',     // 3
      '    foo()',                      // 4
    ];
    expect(symbolEnd(lines, 0, '.py')).toBe(3); // guard survives
  });

  it('stops at the next dedented definition', () => {
    const lines = [
      'def foo():',   // 0
      '    return 1', // 1
      'def bar():',   // 2
      '    return 2', // 3
    ];
    expect(symbolEnd(lines, 0, '.py')).toBe(2);
  });

  it('includes nested/indented body and trailing blank lines', () => {
    const lines = [
      'def foo():',        // 0
      '    if True:',      // 1
      '        return 1',  // 2
      '',                  // 3
      'class Bar:',        // 4
    ];
    expect(symbolEnd(lines, 0, '.py')).toBe(4);
  });
});
