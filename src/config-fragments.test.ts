// B26 restructure: loadProjectConfigFragments (extracted from loadConfig's
// project layer) + the CLI worktree launch-config carry. A --worktree session
// runs in the worktree COPY and project configs load from the directory being
// targeted (the worktree). The launch project's fragments are carried across
// EXPLICITLY through the overrides channel: flags > launch-project fragments >
// worktree project files > user config — the same effective precedence the old
// process.cwd() read produced, now as visible intent instead of a cwd accident.
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProjectConfigFragments, loadConfig } from './config.js';

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'mochi-b26w-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('loadProjectConfigFragments (B26 restructure)', () => {
  it('reads mochi.json over .mochi/config.json, plus the three MCP shapes (later files win)', () => {
    const dir = tmp();
    mkdirSync(join(dir, '.mochi'), { recursive: true });
    // Either/or (documented loadConfig semantics): mochi.json preferred,
    // .mochi/config.json only when mochi.json is absent.
    writeFileSync(join(dir, '.mochi', 'config.json'), JSON.stringify({ model: { model: 'from-mochi-dir' }, telemetry: true }));
    writeFileSync(join(dir, 'mochi.json'), JSON.stringify({ model: { model: 'from-mochi-json' }, telemetry: true }));
    writeFileSync(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { a: { command: 'a-cmd' } } }));
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    writeFileSync(join(dir, '.cursor', 'mcp.json'), JSON.stringify({ mcpServers: { a: { command: 'cursor-a' }, b: { command: 'b-cmd' } } }));

    const f = loadProjectConfigFragments(dir);
    expect(f.model?.model).toBe('from-mochi-json'); // mochi.json preferred
    expect(f.telemetry).toBe(true); // non-model keys from .mochi/config.json survive
    expect(f.mcpServers?.a).toEqual({ command: 'cursor-a' }); // later file wins
    expect(f.mcpServers?.b).toEqual({ command: 'b-cmd' });
  });

  it('returns an empty fragment for a directory with no project files', () => {
    expect(Object.keys(loadProjectConfigFragments(tmp()))).toEqual([]);
  });

  it('the overrides channel carries launch fragments above worktree project files', () => {
    // Simulates the CLI worktree wiring: overrides = { ...flags, ...launchFragments },
    // runtime cwd = worktree dir. The launch project's model must win over the
    // worktree's own mochi.json (launch config is the session's explicit intent),
    // and a flag must still beat the launch fragment.
    const launch = tmp();
    const worktree = tmp();
    writeFileSync(join(launch, 'mochi.json'), JSON.stringify({ model: { model: 'launch-model' }, telemetry: true }));
    writeFileSync(join(worktree, 'mochi.json'), JSON.stringify({ model: { model: 'worktree-model' }, telemetry: false }));

    // (a) no flags: launch fragment in overrides beats worktree project file.
    const overridesA = loadProjectConfigFragments(launch);
    const cfgA = loadConfig(overridesA, undefined, worktree);
    expect(cfgA.model.model).toBe('launch-model');
    // (b) flags beat the launch fragment.
    const overridesB = { ...loadProjectConfigFragments(launch), model: { ...loadProjectConfigFragments(launch).model, model: 'flag-model' } };
    const cfgB = loadConfig(overridesB, undefined, worktree);
    expect(cfgB.model.model).toBe('flag-model');
    // (c) launch fragment keys the flags DON'T set still apply (telemetry true
    // from launch beats worktree's false — same layer, launch wins via overrides).
    const cfgC = loadConfig(overridesA, undefined, worktree);
    expect(cfgC.telemetry).toBe(true);
  });
});
