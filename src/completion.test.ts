import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPLETION_COMMANDS, completionNames, subcommandNames,
  completionBash, completionZsh, completionFish, completionFor,
} from './completion.js';

describe('shell completions', () => {
  it('covers every CLI subcommand (no drift with cli.ts)', async () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)));
    const sources: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d)) {
        const p = resolve(d, e);
        if (statSync(p).isDirectory()) { if (!e.startsWith('.') && e !== 'node_modules') walk(p); continue; }
        if (p.endsWith('cli.ts')) sources.push(readFileSync(p, 'utf8'));
      }
    };
    walk(root);
    const haystack = sources.join('\n');
    const literals = [...haystack.matchAll(/first === '([a-z-]+)'/g)].map((m) => m[1]);
    const offered = new Set(completionNames());
    const missing = [...new Set(literals)].filter((c) => !offered.has(c));
    expect(missing, `commands without completion: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no duplicate canonical names', () => {
    const names = COMPLETION_COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('generates non-empty scripts mentioning mochi + key commands', () => {
    for (const gen of [completionBash, completionZsh, completionFish]) {
      const out = gen();
      expect(out.length).toBeGreaterThan(200);
      expect(out).toContain('mochi');
      expect(out).toContain('daemon');
      expect(out).toContain('skills');
    }
    expect(() => completionFor('powershell')).toThrow(/bash\|zsh\|fish/);
  });

  it('bash script parses (bash -n) when bash exists', async () => {
    const { execFile } = await import('node:child_process');
    const which = await new Promise<string>((res) => {
      execFile('command', ['-v', 'bash'], (err, stdout) => res(err ? '' : String(stdout).trim()));
    });
    if (!which) return; // no bash on this box (Windows CI): skip
    await new Promise<void>((res, rej) => {
      const child = execFile('bash', ['-n'], (err) => (err ? rej(err) : res()));
      child.stdin?.end(completionBash());
    });
  });

  it('daemon/skills subcommands complete', () => {
    expect(subcommandNames('daemon')).toContain('rotate');
    expect(subcommandNames('skills')).toContain('search');
    expect(subcommandNames('nope')).toEqual([]);
  });
});
