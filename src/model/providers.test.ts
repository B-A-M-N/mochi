import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { PROVIDERS, providerById, providerByName } from './providers.js';
import { setProvider, login } from './model-manager.js';
import { createProvider, resolveProvider } from './router.js';
import type { MochiConfig } from '../types.js';

const base = {
  model: {
    provider: 'opencode-zen',
    baseUrl: 'https://opencode.ai/zen/v1',
    model: 'opencode/deepseek-v4-flash-free',
  },
  safety: {
    mode: 'auto',
    commandTimeoutSeconds: 1,
    maxIterations: 1,
    maxRuntimeMinutes: 1,
    maxConcurrentAgents: 1,
    contextBudgetTokens: 100,
  },
  permissions: { read: true, write: true, shell: true, network: true, gitDestructive: false },
  projectDir: '.mochi',
  configDir: '/tmp/mochi-test',
} as unknown as MochiConfig;

describe('providers', () => {
  let tmpPath: string;
  beforeEach(() => {
    tmpPath = resolve(mkdtempSync(resolve(tmpdir(), 'mochi-provd')), 'config.json');
    process.env.MOCHI_CONFIG_PATH = tmpPath;
  });
  afterEach(() => {
    delete process.env.MOCHI_CONFIG_PATH;
  });

  it('contains a majority of major providers', () => {
    expect(PROVIDERS.length).toBeGreaterThanOrEqual(18);
    for (const id of ['openai', 'anthropic', 'gemini', 'openrouter', 'deepseek', 'groq', 'mistral', 'xai', 'openrouter']) {
      expect(providerById(id)).toBeDefined();
    }
  });

  it('resolves by name', () => {
    expect(providerByName('OpenAI')?.id).toBe('openai');
    expect(providerById('ollama')?.kind).toBe('openai');
  });

  it('sets provider without clobbering unrelated config', () => {
    const cfg = setProvider(base, { provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: 'k' });
    expect(cfg.model.provider).toBe('deepseek');
    expect(cfg.model.apiKey).toBe('k');
    expect(cfg.permissions.read).toBe(true);
  });

  it('routs anthropic and gemini providers to their adapters', () => {
    const anc = createProvider({ ...base.model, provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-sonnet' });
    expect(typeof anc.chat).toBe('function');
    const gem = createProvider({ ...base.model, provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.0-flash' });
    expect(typeof gem.chat).toBe('function');
  });

  it('login stores default model when none given', () => {
    const cfg = login({ ...base }, 'groq', 'gk');
    expect(cfg.model.provider).toBe('groq');
    expect(cfg.model.model).toBe('llama-3.3-70b-versatile');
  });

  it('strips the opencode.ai prefix to a bare model id (API uses bare ids)', () => {
    const cfg = resolveProvider({ provider: 'opencode-zen', baseUrl: 'https://opencode.ai/zen/v1', model: 'opencode/deepseek-v4-flash-free' });
    expect(cfg.model).toBe('deepseek-v4-flash-free');
  });

  it('keeps non-opencode model ids unchanged (freeinference, openai, ...)', () => {
    for (const c of [
      { provider: 'freeinference', baseUrl: 'https://freeinference.org/v1', model: 'deepseek-v4-flash' },
      { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      { provider: 'together', baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B' },
    ]) {
      expect(resolveProvider(c as never).model).toBe(c.model);
    }
  });

  it('every provider entry is shippable: default listed, models non-empty, endpoint sane', () => {
    // Fake-prevention: a defaultModel missing from models (cerebras once
    // shipped default llama-3.3-70b with only llama3.3-70b listed) silently
    // points users at a 404 — the "fake model" class. Pinned for all entries.
    for (const p of PROVIDERS) {
      expect(p.models.length, `${p.id} lists no models`).toBeGreaterThan(0);
      expect(p.models, `${p.id} default ${p.defaultModel} not listed`).toContain(p.defaultModel);
      expect(typeof p.envKey).toBe('string');
      // Azure has no fixed endpoint (per-deployment URL by construction) —
      // the template is honest, not a fake; everything else must be a real URL.
      if (p.id === 'azure') continue;
      const local = p.baseUrl.startsWith('http://localhost') || p.baseUrl.startsWith('http://127.');
      expect(local || p.baseUrl.startsWith('https://'), `${p.id} baseUrl ${p.baseUrl}`).toBe(true);
    }
  });

  it('new Asia-Pacific + coding providers resolve through the OpenAI adapter', () => {
    for (const [provider, model] of [
      ['moonshot', 'kimi-k3'],
      ['minimax', 'MiniMax-M3'],
      ['zhipu', 'glm-5.3'],
      ['zai', 'glm-5.3'],
      ['cohere', 'command-a-plus-05-2026'],
      ['qwen', 'qwen-max'],
    ] as Array<[string, string]>) {
      const cfg = providerById(provider);
      expect(cfg, provider).toBeDefined();
      const resolved = resolveProvider({ provider, baseUrl: cfg!.baseUrl, model } as never);
      expect(resolved.model).toBe(model);
      expect(typeof createProvider({ provider, baseUrl: cfg!.baseUrl, model } as never).chat).toBe('function');
    }
  });
});