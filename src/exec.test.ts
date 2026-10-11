// Central exec policy: timeouts, output caps, argv-vs-shell separation.
import { describe, it, expect } from 'vitest';
import { runArgv, runShellString, execArgvText } from './exec.js';

describe('exec policy', () => {
  it('runArgv captures stdout with exit code', async () => {
    const r = await runArgv('echo', ['hello']);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe('hello');
    expect(r.timedOut).toBe(false);
  });

  it('runArgv never invokes a shell (no interpolation)', async () => {
    const r = await runArgv('echo', ['a;touch /tmp/mochi-exec-probe-xyz']);
    expect(r.stdout).toContain('a;touch /tmp/mochi-exec-probe-xyz');
    const { existsSync } = await import('node:fs');
    expect(existsSync('/tmp/mochi-exec-probe-xyz')).toBe(false);
  });

  it('runShellString supports pipes (the feature shell mode exists for)', async () => {
    const r = await runShellString('echo hello | tr a-z A-Z');
    expect(r.stdout.trim()).toBe('HELLO');
  });

  it('times out and reports timedOut instead of hanging', async () => {
    const r = await runShellString('sleep 30', { timeoutMs: 300 });
    expect(r.timedOut).toBe(true);
  }, 15_000);

  it('aborts on signal with cancelled=true', async () => {
    const c = new AbortController();
    const p = runShellString('sleep 30', { timeoutMs: 20_000, signal: c.signal });
    setTimeout(() => c.abort(), 100);
    const r = await p;
    expect(r.cancelled).toBe(true);
  }, 15_000);

  it('truncates firehose output at the cap', async () => {
    const r = await runShellString('seq 1 200000', { maxOutput: 4096, timeoutMs: 15_000 });
    expect(r.stdout.length).toBeLessThan(9000);
    expect(r.stdout).toContain('[truncated]');
  }, 20_000);

  it('execArgvText resolves stdout and rejects on failure', async () => {
    await expect(execArgvText('echo', ['ok'])).resolves.toContain('ok');
    await expect(execArgvText('sh', ['-c', 'exit 3'])).rejects.toThrow();
  });

  it('audit hook fires exactly once per run', async () => {
    let calls = 0;
    await runArgv('true', [], { onAudit: () => { calls++; } });
    expect(calls).toBe(1);
  });
});
