// Chatbox ownership: only the user can put messages in the chatbox.
// Regression class: harness internals (think echoes, MCP connect chatter,
// history replay) rendering as chat lines, so mochi appears to "type messages
// automatically" into the user's transcript. These tests catch the class, not
// the instance (esm-hygiene.test.ts pattern: source scans, not behavior).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = dirname(dirname(fileURLToPath(import.meta.url)));

function listTsFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      listTsFiles(p, acc);
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts') && !e.name.endsWith('.test.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

// Strip comments AND string literals are kept: we WANT to see emit literals.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

describe('chatbox ownership (only the user writes user lines)', () => {
  it("no source file emits a `message` event with a user role onto the bus", () => {
    const offenders: string[] = [];
    for (const f of listTsFiles(srcDir)) {
      const body = stripComments(readFileSync(f, 'utf8'));
      // `type: 'message'` + `role: 'user'` within one emit call (same 300-char window).
      const re = /type:\s*['"]message['"]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(body))) {
        const window = body.slice(m.index, m.index + 300);
        if (/\brole:\s*['"]user['"]/.test(window)) {
          offenders.push(`${f.replace(srcDir + '/', '')}: ${window.slice(0, 120).replace(/\n/g, ' ')}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it("only TUI chrome may push('user' transcript lines (composer, command echo, history restore)", () => {
    const offenders: string[] = [];
    for (const f of listTsFiles(srcDir)) {
      if (f.includes('/tui/')) continue;
      const body = stripComments(readFileSync(f, 'utf8'));
      if (/push\(\s*['"]user['"]/.test(body)) {
        offenders.push(f.replace(srcDir + '/', ''));
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('think tool emits no `message` event (reasoning renders as a collapsed thought row, never a chat line)', () => {
    const body = stripComments(readFileSync(join(srcDir, 'tools', 'think.ts'), 'utf8'));
    expect(body).not.toMatch(/type:\s*['"]message['"]/);
  });
});
