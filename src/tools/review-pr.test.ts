// review_pr tool: GitHub PR review with a fake gh (POSIX) + graceful paths.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, delimiter } from 'node:path';
import { execSync } from 'node:child_process';
import { reviewPrTool } from './review-pr.js';
import { EventBus } from '../events.js';
import type { ToolContext } from './types.js';
import type { MochiConfig } from '../types.js';

let dir: string;
let originalPath: string;
let callLog: string;

function ctx(): ToolContext {
  return {
    cwd: dir,
    workspace: { dir, root: dir } as never,
    config: { permissions: { shell: true }, safety: { mode: 'auto' } } as unknown as MochiConfig,
    events: new EventBus(),
    agentId: 'test',
  } as ToolContext;
}

beforeAll(() => {
  originalPath = process.env.PATH ?? '';
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-reviewpr-'));
  callLog = resolve(dir, 'gh-calls.log');
  writeFileSync(callLog, '');
  // Fake `gh`: view/diff/comment by argv. POSIX-only (win32 can't exec a
  // shebang script) — win32 branches below assert graceful degradation.
  if (process.platform !== 'win32') {
    const fakeBin = mkdtempSync(resolve(tmpdir(), 'mochi-reviewgh-'));
    writeFileSync(resolve(fakeBin, 'gh'), [
      '#!/bin/sh',
      `LOG="${callLog}"`,
      'if [ "$1" = "pr" ] && [ "$2" = "view" ]; then',
      '  echo "{\\"number\\":12,\\"title\\":\\"Add thing\\",\\"author\\":{\\"login\\":\\"octo\\"},\\"baseRefName\\":\\"main\\",\\"headRefName\\":\\"mochi/add-thing\\",\\"url\\":\\"https://github.com/example/repo/pull/12\\",\\"additions\\":10,\\"deletions\\":2,\\"files\\":[{\\"path\\":\\"src/a.ts\\",\\"additions\\":10,\\"deletions\\":2}]}"',
      '  exit 0',
      'fi',
      'if [ "$1" = "pr" ] && [ "$2" = "diff" ]; then',
      '  printf \'diff --git a/src/a.ts b/src/a.ts\\n--- a/src/a.ts\\n+++ b/src/a.ts\\n@@ -1,2 +1,4 @@\\n const a = 1;\\n+console.log("debug here");\\n+// TODO: remove\\n const b = 2;\\n\'',
      '  exit 0',
      'fi',
      'if [ "$1" = "pr" ] && [ "$2" = "comment" ]; then',
      '  echo "$@" >> "$LOG"',
      '  echo "https://github.com/example/repo/pull/12#issuecomment-1"',
      '  exit 0',
      'fi',
      'exit 1',
    ].join('\n'));
    execSync(`chmod +x ${resolve(fakeBin, 'gh')}`);
    process.env.PATH = `${fakeBin}${delimiter}${originalPath}`;
  }
});

afterAll(() => {
  process.env.PATH = originalPath;
  rmSync(dir, { recursive: true, force: true });
});

describe('review_pr tool', () => {
  it('rejects bad input without touching gh', async () => {
    expect(await reviewPrTool.execute({ pr: 0 }, ctx())).toContain('PR number');
    expect(await reviewPrTool.execute({ pr: -5 }, ctx())).toContain('PR number');
    expect(await reviewPrTool.execute({ pr: 12, repo: 'not a repo!!' }, ctx())).toContain('owner/name');
  });

  it('reviews read-only by default (no comment posted)', async () => {
    if (process.platform === 'win32') {
      // No exe-level gh fake is possible: assert the graceful path instead —
      // an honest message, never a throw, never a side effect.
      const res = await reviewPrTool.execute({ pr: 12 }, ctx());
      expect(typeof res).toBe('string');
      expect(res.length).toBeGreaterThan(0);
      return;
    }
    const res = await reviewPrTool.execute({ pr: 12 }, ctx());
    expect(res).toContain('PR #12: Add thing');
    expect(res).toContain('octo');
    expect(res).toContain('src/a.ts');
    expect(res).toContain('Static findings');
    // Proves the scanner parsed the hunk and rendered structured findings
    // (not just that the raw diff echoed the word "TODO").
    expect(res).toMatch(/-\s*\[debug-log\]\s+src\/a\.ts:2/);
    expect(res).toMatch(/-\s*\[todo-marker\]\s+src\/a\.ts:3/);
    expect(res).toContain('Read-only review');
    expect(readFileSync(callLog, 'utf8')).not.toContain('comment');
  });

  it('posts a summary comment only with post=true', async () => {
    if (process.platform === 'win32') {
      const res = await reviewPrTool.execute({ pr: 12, post: true }, ctx());
      expect(typeof res).toBe('string');
      return;
    }
    writeFileSync(callLog, '');
    const res = await reviewPrTool.execute({ pr: 12, post: true }, ctx());
    expect(res).toContain('Posted as a PR comment');
    expect(readFileSync(callLog, 'utf8')).toContain('comment');
  });
});
