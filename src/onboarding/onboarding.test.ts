import { describe, it, expect } from 'vitest';
import { detectProviders, detectSkillSources, detectMcpSources, scanForOnboarding, maskKey } from './detect.js';
import { welcomeFrame, stepFrame, defaultChoices } from './wizard.js';
import { isOnboarded } from './import.js';

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
    expect(() => scanForOnboarding('/tmp')).not.toThrow();
  });

  it('isOnboarded returns boolean', () => {
    expect(typeof isOnboarded()).toBe('boolean');
  });
});

describe('onboarding wizard frames', () => {
  it('welcome frame is cozy and mentions onboard', () => {
    const frame = welcomeFrame('0.23.0').join('\n');
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
