import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HookManager, type HookName } from './hooks.js';

describe('HookManager', () => {
  it('runs after hooks and records output', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-hooks-'));
    const marker = resolve(dir, 'marker.txt');
    // Portable hook command: `touch` is not a cmd.exe builtin/binary on a
    // stock Windows box, and a node -e one-liner nested in JSON+cmd quoting
    // is fragile — a script file plus two quoted argv paths runs identically
    // in sh and cmd.
    writeFileSync(resolve(dir, 'mk-marker.cjs'), "require('node:fs').writeFileSync(process.argv[2], '');");
    writeFileSync(resolve(dir, 'hooks.json'), JSON.stringify({ after_edit: `node "${resolve(dir, 'mk-marker.cjs')}" "${marker}"` }));
    const hooks = new HookManager(dir);
    expect(hooks.enabled('after_edit')).toBe(true);
    const results = await hooks.runAfter('after_edit', { file: 'a.ts' });
    expect(results[0].exitCode).toBe(0);
    expect(existsSync(marker)).toBe(true);
  });

  it('allows before hooks to veto an action', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-hooks-'));
    writeFileSync(resolve(dir, 'hooks.json'), JSON.stringify({ before_shell: 'exit 1' }));
    const hooks = new HookManager(dir);
    const result = await hooks.runBefore('before_shell', { command: 'echo hi' });
    expect(result.allowed).toBe(false);
  });

  it('treats successful before hooks as allowed', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-hooks-'));
    // `exit 0` is the portable success (cmd.exe has no `true`).
    writeFileSync(resolve(dir, 'hooks.json'), JSON.stringify({ before_edit: 'exit 0' }));
    const hooks = new HookManager(dir);
    const result = await hooks.runBefore('before_edit');
    expect(result.allowed).toBe(true);
  });
});

const ALL_HOOKS: HookName[] = [
  'before_goal', 'after_goal', 'before_task', 'after_task',
  'before_agent', 'after_agent', 'before_tool', 'after_tool',
  'before_edit', 'after_edit', 'before_shell', 'after_shell',
  'before_verify', 'after_verify', 'on_error', 'on_checkpoint', 'on_rollback',
];

describe('hook lifecycle coverage audit', () => {
  it('every HookName in the union fires through runBefore/runAfter', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-hooks-audit-'));
    const mk = resolve(dir, 'mk-marker.cjs');
    writeFileSync(mk, "require('node:fs').writeFileSync(process.argv[2], '');");
    const cfg: Record<string, string> = {};
    for (const h of ALL_HOOKS) cfg[h] = `node "${mk}" "${resolve(dir, `${h}.marker`)}"`;
    writeFileSync(resolve(dir, 'hooks.json'), JSON.stringify(cfg));
    // Point CWD lookups away from the repo (which may carry its own hooks.json).
    const prevCwd = process.cwd();
    process.chdir(dir);
    try {
      const hooks = new HookManager(dir);
      for (const h of ALL_HOOKS) {
        if (h.startsWith('before_') || h === 'on_checkpoint' || h === 'on_rollback') {
          const r = await hooks.runBefore(h, { probe: h });
          expect(r.allowed, `${h} should allow`).toBe(true);
        } else {
          const rs = await hooks.runAfter(h, { probe: h });
          expect(rs.length, `${h} should run`).toBe(1);
          expect(rs[0].exitCode, `${h} should succeed`).toBe(0);
        }
        expect(existsSync(resolve(dir, `${h}.marker`)), `${h} must fire`).toBe(true);
      }
    } finally {
      process.chdir(prevCwd);
    }
  }, 60_000);

  it('every HookName has a static call site in the run lifecycle (no dead hooks)', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const root = resolve(dirname(fileURLToPath(import.meta.url)));
    const sources: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d)) {
        const p = resolve(d, e);
        if (statSync(p).isDirectory()) { if (!e.startsWith('.') && e !== 'node_modules') walk(p); continue; }
        if (p.endsWith('.ts') && !p.endsWith('.test.ts') && !p.endsWith('hooks.ts')) {
          sources.push(readFileSync(p, 'utf8'));
        }
      }
    };
    walk(root);
    const haystack = sources.join('\n');
    const missing = ALL_HOOKS.filter((h) => !haystack.includes(`'${h}'`));
    expect(missing, `dead hook names with no lifecycle call site: ${missing.join(', ')}`).toEqual([]);
  });
});
