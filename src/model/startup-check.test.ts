// Startup model health: broken setups fail every request, which reads as
// "loads with a fake model". Pure contract tests.
import { describe, it, expect } from 'vitest';
import { checkStartupModel, bareModelId, isKeyUsable } from './startup-check.js';

describe('bareModelId', () => {
  it('strips opencode-style prefixes like the request router', () => {
    expect(bareModelId('opencode/deepseek-v4-flash-free')).toBe('deepseek-v4-flash-free');
    expect(bareModelId('deepseek-v4-flash')).toBe('deepseek-v4-flash');
  });
});

describe('isKeyUsable', () => {
  it('rejects missing and placeholder keys', () => {
    expect(isKeyUsable(undefined)).toBe(false);
    expect(isKeyUsable('')).toBe(false);
    expect(isKeyUsable('hi')).toBe(false);
    expect(isKeyUsable('sk-your-key-here')).toBe(false);
    expect(isKeyUsable('YOUR_KEY')).toBe(false);
    expect(isKeyUsable('sk-real-key-12345')).toBe(true);
  });
});

describe('checkStartupModel', () => {
  it('flags unknown providers', () => {
    const r = checkStartupModel({ provider: 'nope', model: 'x' });
    expect(r.ok).toBe(false);
    expect(r.line).toContain('/model');
  });

  it('flags a missing key for keyed providers, with the exact fix', () => {
    const r = checkStartupModel({ provider: 'opencode-zen', model: 'deepseek-v4-flash' }, {});
    expect(r.ok).toBe(false);
    expect(r.line).toContain('$OPENCODE_ZEN_API_KEY');
    expect(r.line).toContain('/login');
  });

  it('accepts the key from config or environment', () => {
    const cfg = { provider: 'opencode-zen', model: 'deepseek-v4-flash', apiKey: 'sk-real-key-12345' };
    expect(checkStartupModel(cfg, {}).ok).toBe(true);
    expect(checkStartupModel(
      { provider: 'opencode-zen', model: 'deepseek-v4-flash' },
      { OPENCODE_ZEN_API_KEY: 'sk-real-key-12345' },
    ).ok).toBe(true);
  });

  it('passes keyless local providers without a key', () => {
    expect(checkStartupModel({ provider: 'ollama', model: 'llama3.1' }, {}).ok).toBe(true);
  });

  it('flags model ids the provider never listed (prefixed ids match bare)', () => {
    const base = { provider: 'opencode-zen', apiKey: 'sk-real-key-12345' };
    expect(checkStartupModel({ ...base, model: 'opencode/deepseek-v4-flash-free' }).ok).toBe(true);
    const r = checkStartupModel({ ...base, model: 'definitely-not-a-model-xyz' });
    expect(r.ok).toBe(false);
    expect(r.line).toContain('/model');
  });
});
