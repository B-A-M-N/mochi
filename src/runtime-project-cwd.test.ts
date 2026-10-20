// B26 regression: project-level configs must resolve against the RUNTIME'S
// cwd, not the process's cwd.
//
// loadConfig() read mochi.json / .mochi/config.json / .mcp.json etc. from
// process.cwd() (config.ts:120-140) — and the Runtime constructor called
// loadConfig BEFORE assigning this.cwd from opts.cwd (runtime.ts:74-75). For
// SDK consumers (Mochi.create({ cwd: '/other/project' })), the daemon, and
// any embedded embedding where process.cwd() != the runtime cwd, the target
// project's mochi.json and .mcp.json were silently ignored: MCP servers
// authored by other agents in that project never connected.
//
// Contract pinned here:
// 1. Runtime with opts.cwd picks up the project's mochi.json/.mcp.json from
//    THAT directory even when process.cwd() is somewhere else entirely.
// 2. An explicit override still wins over the project file.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Runtime } from './runtime.js';
import type { MochiConfig } from './types.js';

// Hermeticity: the Runtime constructor reads the USER config via
// MOCHI_CONFIG_PATH (config.ts:116) — on a machine with a real
// ~/.config/mochi/config.json, validateConfig would fail on ambient settings
// (e.g. a url-only MCP server) before our assertions run. Point it at a
// nonexistent path so no user config merges, regardless of the host.
function isolateUserConfig(): () => void {
  const saved = process.env.MOCHI_CONFIG_PATH;
  process.env.MOCHI_CONFIG_PATH = resolve(tmpdir(), 'b26-nonexistent-config.json');
  return () => {
    if (saved === undefined) delete process.env.MOCHI_CONFIG_PATH;
    else process.env.MOCHI_CONFIG_PATH = saved;
  };
}

function baseConfig(): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl: 'http://localhost:1', model: 'fake-model' },
    safety: {
      mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 10, maxRuntimeMinutes: 5,
      maxConcurrentAgents: 1, contextBudgetTokens: 4000,
    },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: false },
  } as unknown as MochiConfig;
}

describe('project config resolution follows the runtime cwd (B26)', () => {
  it('Runtime with opts.cwd loads that project mochi.json even when process.cwd differs', () => {
    const restoreEnv = isolateUserConfig();
    const project = mkdtempSync(resolve(tmpdir(), 'mochi-b26-proj-'));
    const elsewhere = mkdtempSync(resolve(tmpdir(), 'mochi-b26-else-'));
    const savedCwd = process.cwd();
    try {
      // mochi.json with an MCP canary server only the project file sets.
      // (A model override in the project file would legitimately lose to the
      // explicit config override below — same precedence as the user file.)
      writeFileSync(resolve(project, 'mochi.json'), JSON.stringify({
        mcpServers: { 'b26-canary': { command: 'echo', args: ['b26'] } },
      }));
      // Run the process from `elsewhere` — but target `project`.
      process.chdir(elsewhere);
      const rt = new Runtime({ cwd: project, config: baseConfig() });
      expect(rt.config.mcpServers?.['b26-canary']).toEqual({ command: 'echo', args: ['b26'] });
      try { rt.close(); } catch { /* best-effort */ }
    } finally {
      process.chdir(savedCwd);
      restoreEnv();
      rmSync(project, { recursive: true, force: true });
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  it('explicit overrides still beat the project file', () => {
    const restoreEnv = isolateUserConfig();
    const project = mkdtempSync(resolve(tmpdir(), 'mochi-b26-proj2-'));
    try {
      writeFileSync(resolve(project, 'mochi.json'), JSON.stringify({ model: { model: 'b26-marker-model' } }));
      const rt = new Runtime({
        cwd: project,
        config: { ...baseConfig(), model: { provider: 'openai', baseUrl: 'http://localhost:1', model: 'explicit-model' } },
      });
      expect(rt.config.model.model).toBe('explicit-model');
      try { rt.close(); } catch { /* best-effort */ }
    } finally {
      restoreEnv();
      rmSync(project, { recursive: true, force: true });
    }
  });
});
