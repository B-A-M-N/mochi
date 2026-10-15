import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  claudeHooksToMochi,
  guardedCommand,
  translateMatcher,
  importClaudeInterop,
} from './claude.js';

describe('Claude Code interop', () => {
  it('translates hook events and tool matchers, reporting unmapped events', () => {
    expect(translateMatcher('Bash|Write')).toBe('shell|write');
    expect(translateMatcher('Edit,Read')).toBe('edit|read');
    expect(translateMatcher('*')).toBe('*');
    const { hooks, unmapped } = claudeHooksToMochi([{
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo guard' }] }],
        PostToolUse: [{ hooks: [{ type: 'command', command: 'echo done' }] }],
        Notification: [{ hooks: [{ command: 'echo ping' }] }],
      },
    }]);
    expect(unmapped).toContain('Notification');
    expect(Array.isArray(hooks.before_tool)).toBe(true);
    const before = (hooks.before_tool as string[])[0];
    expect(before).toContain('echo guard');
    expect(before).toContain('shell'); // Bash -> shell in the guard regex
    expect(before).toContain('MOCHI_TOOL');
    // No matcher -> command used verbatim.
    expect((hooks.after_tool as string[])[0]).toBe('echo done');
  });

  it('guardedCommand is a no-op without a matcher and portable with one', () => {
    expect(guardedCommand(undefined, 'echo x')).toBe('echo x');
    expect(guardedCommand('*', 'echo x')).toBe('echo x');
    const g = guardedCommand('Write', 'echo x');
    expect(g.startsWith('node -e ')).toBe(true);
    expect(g.endsWith('&& echo x')).toBe(true);
    // The JS body itself contains no double quotes (safe inside the quoted -e).
    const inner = g.slice('node -e "'.length, g.indexOf('" && '));
    expect(inner).not.toContain('"');
  });

  it('imports hooks, agents, and commands into .mochi (non-destructive)', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'mochi-interop-'));
    const cwd = resolve(root, 'proj');
    const home = resolve(root, 'home');
    mkdirSync(resolve(cwd, '.claude', 'agents'), { recursive: true });
    mkdirSync(resolve(cwd, '.claude', 'commands'), { recursive: true });
    writeFileSync(resolve(cwd, '.claude', 'settings.json'), JSON.stringify({
      hooks: { PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'echo post' }] }] },
    }));
    writeFileSync(resolve(cwd, '.claude', 'agents', 'helper.md'), '---\nname: helper\ndescription: h\n---\nYou help.\n');
    writeFileSync(resolve(cwd, '.claude', 'commands', 'deploy.md'), '---\ndescription: Deploy it\n---\nRun the deploy.\n');
    try {
      const report = importClaudeInterop(cwd, { home });
      expect(report.hooksAdded).toBe(1);
      expect(report.agentsImported).toEqual(['helper.md']);
      expect(report.commandsImported).toEqual(['deploy']);
      const hooks = JSON.parse(readFileSync(resolve(cwd, '.mochi', 'hooks.json'), 'utf8'));
      expect(hooks.after_tool).toHaveLength(1);
      expect(existsSync(resolve(cwd, '.mochi', 'agents', 'helper.md'))).toBe(true);
      const skill = resolve(cwd, '.mochi', 'skills', 'claude-commands', 'deploy', 'SKILL.md');
      expect(existsSync(skill)).toBe(true);
      expect(readFileSync(skill, 'utf8')).toContain('Run the deploy.');

      // Idempotent: a second run adds nothing and reports the skips.
      const again = importClaudeInterop(cwd, { home });
      expect(again.hooksAdded).toBe(0);
      expect(again.agentsImported).toEqual([]);
      expect(again.skipped.some((s) => s.name === 'helper.md')).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('dry run reports what would happen without writing', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'mochi-interop-'));
    const cwd = resolve(root, 'proj');
    mkdirSync(resolve(cwd, '.claude'), { recursive: true });
    writeFileSync(resolve(cwd, '.claude', 'settings.json'), JSON.stringify({
      hooks: { PreToolUse: [{ hooks: [{ command: 'echo hi' }] }] },
    }));
    try {
      const report = importClaudeInterop(cwd, { home: resolve(root, 'home'), dryRun: true });
      expect(report.hooksAdded).toBe(1);
      expect(existsSync(resolve(cwd, '.mochi', 'hooks.json'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
