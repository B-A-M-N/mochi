import { describe, it, expect } from 'vitest';
import {
  detectProviders,
  detectSkillSources,
  detectMcpSources,
  detectModels,
  detectAgents,
  detectMcpServerDefs,
  scanForOnboarding,
  maskKey,
} from './detect.js';
import { welcomeFrame, stepFrame, defaultChoices } from './wizard.js';
import {
  isOnboarded,
  importDetectedModels,
  importMcpServerDefs,
  injectAllAgentEcosystem,
} from './import.js';

describe('onboarding detect', () => {
  it('detects providers from env without leaking keys', () => {
    const list = detectProviders({ OPENAI_API_KEY: 'sk-test-1234567890', FOO: 'x' } as Record<string, string>);
    const openai = list.find((p) => p.id === 'openai')!;
    expect(openai.hasKey).toBe(true);
    expect(openai.maskedKey).not.toContain('1234567890');
    expect(openai.maskedKey).toContain('…');
    expect(list.find((p) => p.id === 'groq')!.hasKey).toBe(false);
  });

  it('rejects placeholder keys', () => {
    const list = detectProviders({ OPENAI_API_KEY: 'your-key-here' } as Record<string, string>);
    expect(list.find((p) => p.id === 'openai')!.hasKey).toBe(false);
  });

  it('maskKey is stable', () => {
    expect(maskKey('abcdef123456')).toBe('abcd…3456');
    expect(maskKey('hi')).toBe('****');
  });

  it('skill + mcp detectors never throw on missing homes', () => {
    expect(() => detectSkillSources()).not.toThrow();
    expect(() => detectMcpSources('/tmp')).not.toThrow();
    expect(() => detectModels()).not.toThrow();
    expect(() => detectAgents('/tmp')).not.toThrow();
    expect(() => detectMcpServerDefs('/tmp')).not.toThrow();
    expect(() => scanForOnboarding('/tmp')).not.toThrow();
  });

  it('scan returns structured agent, model, provider, and mcp details', () => {
    const scan = scanForOnboarding('/tmp');
    expect(Array.isArray(scan.agents)).toBe(true);
    expect(Array.isArray(scan.models)).toBe(true);
    expect(Array.isArray(scan.providers)).toBe(true);
    expect(Array.isArray(scan.skillSources)).toBe(true);
    expect(typeof scan.mcpServerDefs).toBe('object');
    expect(typeof scan.totalSkills).toBe('number');
    expect(typeof scan.totalMcpServers).toBe('number');
  });

  it('isOnboarded returns boolean', () => {
    expect(typeof isOnboarded()).toBe('boolean');
  });
});

describe('universal injection', () => {
  it('importDetectedModels configures model profiles', () => {
    const models = [
      { agent: 'hermes', model: 'glm-5.3-flash', role: 'fast' as const },
      { agent: 'opencode', model: 'opencode/deepseek-v4-flash', role: 'coding' as const },
      { agent: 'codex', model: 'opencode-zen-3.5', role: 'reasoning' as const },
    ];
    const res = importDetectedModels(models, { overwriteProfiles: true });
    expect(res.profiles.fast).toBeTruthy();
    expect(res.profiles.coding).toBeTruthy();
    expect(res.profiles.reasoning).toBeTruthy();
  });

  it('importMcpServerDefs registers server configs non-destructively', () => {
    const defs = {
      testserver: {
        name: 'testserver',
        agent: 'claude',
        sourceFile: '/tmp/test.json',
        command: 'npx',
        args: ['-y', 'test-mcp-server'],
      },
    };
    const res = importMcpServerDefs(defs, { force: true });
    expect(res.imported).toContain('testserver');
  });

  it('injectAllAgentEcosystem runs end-to-end without throwing', async () => {
    const rep = await injectAllAgentEcosystem(undefined, { force: false });
    expect(typeof rep.agentsCount).toBe('number');
    expect(Array.isArray(rep.providersImported)).toBe(true);
    expect(typeof rep.skillsImported).toBe('number');
  });
});

describe('onboarding wizard frames', () => {
  it('welcome frame is cozy and mentions onboard', () => {
    const frame = welcomeFrame('0.24.0').join('\n');
    expect(frame).toMatch(/welcome home/i);
    expect(frame).toContain('mochi onboard');
  });

  it('every step renders without scan data', () => {
    const scan = scanForOnboarding('/tmp');
    for (const step of ['providers', 'models', 'skills', 'mcp', 'editors', 'done'] as const) {
      const lines = stepFrame(step, scan);
      expect(lines.length).toBeGreaterThan(2);
    }
  });

  it('default choices import everything detected', () => {
    const scan = scanForOnboarding('/tmp');
    const c = defaultChoices(scan);
    expect(typeof c.importProviders).toBe('boolean');
    expect(Array.isArray(c.skillDirs)).toBe(true);
  });
});
