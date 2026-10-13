// mochi doctor: health self-inspection report + formatting.
import { describe, it, expect, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { doctorReport, formatDoctor, repairDoctor } from './doctor.js';
import { addJob } from './daemon/cron.js';

let dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
function tmp(): string {
  const d = mkdtempSync(resolve(tmpdir(), 'mochi-doctor-'));
  dirs.push(d);
  return d;
}

describe('doctorReport', () => {
  it('flags a missing API key', async () => {
    const r = await doctorReport({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', apiKey: null, workspaceDir: tmp() });
    expect(r.model.keySet).toBe(false);
    expect(r.problems.some((p) => p.includes('API key'))).toBe(true);
  });

  it('reports the active provider and model', async () => {
    const r = await doctorReport({ provider: 'freeinference', baseUrl: 'https://freeinference.org/v1', model: 'deepseek-v4-flash', apiKey: 'sk-test', workspaceDir: tmp() });
    expect(r.model.provider).toBe('freeinference');
    expect(r.model.model).toBe('deepseek-v4-flash');
    expect(r.model.keySet).toBe(true);
  });

  it('reports daemon running state', async () => {
    const r = await doctorReport({ provider: 'openai', baseUrl: 'x', model: 'gpt', apiKey: 'k', workspaceDir: tmp(), daemon: { running: true, port: 9470 } });
    expect(r.daemon.running).toBe(true);
    expect(r.daemon.port).toBe(9470);
  });

  it('counts cron jobs from the workspace', async () => {
    const d = tmp();
    addJob(d, 'say hi', 'every 1m');
    addJob(d, 'say bye', 'every 5m');
    const r = await doctorReport({ provider: 'openai', baseUrl: 'x', model: 'gpt', apiKey: 'k', workspaceDir: d });
    expect(r.cron.jobs).toBe(2);
    expect(r.daemon.jobs).toBe(2);
  });

  it('warns when jobs exist but the daemon is down', async () => {
    const d = tmp();
    addJob(d, 'say hi', 'every 1m');
    const r = await doctorReport({ provider: 'openai', baseUrl: 'x', model: 'gpt', apiKey: 'k', workspaceDir: d, daemon: { running: false } });
    expect(r.problems.some((p) => p.includes('daemon is not running'))).toBe(true);
  });

  it('formatDoctor is human-readable and marks problems', async () => {
    const r = await doctorReport({ provider: 'openai', baseUrl: 'x', model: '', apiKey: null, workspaceDir: tmp() });
    const out = formatDoctor(r);
    expect(out).toContain('Mochi doctor');
    expect(out).toContain('api key');
    expect(out).toMatch(/MISS/);
  });

  it('reports the live theme id so stale binaries are detectable', async () => {
    const r = await doctorReport({ provider: 'openai', baseUrl: 'x', model: 'gpt', apiKey: 'k', workspaceDir: tmp() });
    expect(r.theme.id).toBeTruthy();
    expect(formatDoctor(r)).toContain('theme');
  });

  it('probes provider reachability when asked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    try {
      const r = await doctorReport({ provider: 'openai', baseUrl: 'https://x/v1', model: 'm', apiKey: 'k', workspaceDir: tmp(), probeProvider: true });
      expect(r.providerReachable).toBe(true);
      expect(r.problems.some((p) => p.includes('did not answer'))).toBe(false);

      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connection refused'); }));
      const r2 = await doctorReport({ provider: 'openai', baseUrl: 'https://x/v1', model: 'm', apiKey: 'k', workspaceDir: tmp(), probeProvider: true });
      expect(r2.providerReachable).toBe(false);
      expect(r2.problems.some((p) => p.includes('did not answer within 2s'))).toBe(true);

      // No key and not a local provider: no probe at all (even with --probe).
      const r3 = await doctorReport({ provider: 'openai', baseUrl: 'https://x/v1', model: 'm', apiKey: null, workspaceDir: tmp(), probeProvider: true });
      expect(r3.providerReachable).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('probes keyless local providers (ollama) without demanding a key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    try {
      const r = await doctorReport({ provider: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama', apiKey: null, workspaceDir: tmp(), probeProvider: true });
      expect(r.providerReachable).toBe(true);
      expect(r.problems.some((p) => p.includes('No API key'))).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('classifies degraded skills from the workspace tree', async () => {
    const d = tmp();
    const skillsDir = resolve(d, 'skills');
    mkdirSync(resolve(skillsDir, 'nested'), { recursive: true });
    mkdirSync(resolve(skillsDir, '.hidden'), { recursive: true });
    writeFileSync(resolve(skillsDir, 'empty.md'), '');
    writeFileSync(resolve(skillsDir, 'nofm.md'), 'just plain prose with no frontmatter at all');
    writeFileSync(resolve(skillsDir, 'good.md'), '---\nname: good-skill\ndescription: does a thing\n---\ndoes things\n');
    writeFileSync(resolve(skillsDir, 'SKILL.md'), '---\nname: root-skill\ndescription: root\n---\nbody\n');
    writeFileSync(resolve(skillsDir, 'nested', 'SKILL.md'), '---\nname: deep-skill\ndescription: nested one\n---\nbody\n');
    writeFileSync(resolve(skillsDir, 'README.md'), '# skipped by the walker');
    writeFileSync(resolve(skillsDir, '.hidden', 'SKILL.md'), '---\nname: hidden\n---\n');

    const r = await doctorReport({ provider: 'openai', baseUrl: 'x', model: 'gpt', apiKey: 'k', workspaceDir: d });
    // empty.md + nofm.md + good.md + SKILL.md + nested/SKILL.md (README and
    // dot-dirs are skipped by the walker).
    expect(r.skills.total).toBe(5);
    const statuses = Object.fromEntries(r.skills.degraded.map((s) => [s.name, s.status]));
    expect(statuses['empty.md']).toBe('empty');
    expect(statuses['nofm.md']).toBe('missing-frontmatter');
    expect(r.skills.healthy).toBe(r.skills.total - r.skills.degraded.length);
    expect(r.problems.some((p) => p.includes('degraded'))).toBe(true);
    // Health line + problem bullets render in the human output.
    const out = formatDoctor(r);
    expect(out).toMatch(/\d\/5 healthy/);
    expect(out).toContain('Skill "empty.md" is degraded (empty)');
  });

  it('never double-visits the same skill path across candidate dirs', async () => {
    const d = tmp();
    // Same file reachable as <ws>/skills/SKILL.md from both candidate roots
    // is impossible, but a symlink-free duplicate check: run twice over the
    // same tree and assert the totals stay stable (visitedPaths dedupe).
    mkdirSync(resolve(d, 'skills'), { recursive: true });
    writeFileSync(resolve(d, 'skills', 'one.md'), '---\nname: one\ndescription: d\n---\nx\n');
    const r1 = await doctorReport({ provider: 'openai', baseUrl: 'x', model: 'gpt', apiKey: 'k', workspaceDir: d });
    const r2 = await doctorReport({ provider: 'openai', baseUrl: 'x', model: 'gpt', apiKey: 'k', workspaceDir: d });
    expect(r1.skills.total).toBe(1);
    expect(r2.skills.total).toBe(1);
  });
});

describe('repairDoctor', () => {
  it('creates missing workspace scaffolding, env template, and git repo', async () => {
    const cwd = tmp();
    const ws = resolve(cwd, '.mochi');
    const { items, summary } = await repairDoctor({ cwd, workspaceDir: ws });

    for (const sub of ['rules', 'plugins', 'ambient', 'checkpoints', 'sessions']) {
      expect(existsSync(resolve(ws, sub))).toBe(true);
    }
    expect(readFileSync(resolve(ws, '.env'), 'utf8')).toContain('OPENCODE_ZEN_API_KEY=');
    expect(existsSync(resolve(cwd, '.git'))).toBe(true);

    const byName = Object.fromEntries(items.map((i) => [i.name, i]));
    expect(byName['Workspace Directories'].status).toBe('fixed');
    expect(byName['Environment File'].status).toBe('fixed');
    expect(byName['Git Repository'].status).toBe('fixed');
    expect(byName['Disk Retention'].status).toBe('already_ok');
    expect(summary).toContain('Auto-Repair');
    expect(summary).toMatch(/\d+ issue\(s\) resolved/);
  });

  it('is idempotent: a second pass reports everything healthy', async () => {
    const cwd = tmp();
    const ws = resolve(cwd, '.mochi');
    await repairDoctor({ cwd, workspaceDir: ws });
    const second = await repairDoctor({ cwd, workspaceDir: ws });
    const byName = Object.fromEntries(second.items.map((i) => [i.name, i]));
    expect(byName['Workspace Directories'].status).toBe('already_ok');
    expect(byName['Environment File'].status).toBe('already_ok');
    expect(byName['Git Repository'].status).toBe('already_ok');
    expect(second.summary).toContain('0 issue(s) resolved');
  });

  it('leaves a cwd-level .env alone instead of writing a second template', async () => {
    const cwd = tmp();
    writeFileSync(resolve(cwd, '.env'), 'PREEXISTING=1\n');
    const ws = resolve(cwd, '.mochi');
    const { items } = await repairDoctor({ cwd, workspaceDir: ws });
    const envItem = items.find((i) => i.name === 'Environment File')!;
    expect(envItem.status).toBe('already_ok');
    expect(existsSync(resolve(ws, '.env'))).toBe(false);
  });
});