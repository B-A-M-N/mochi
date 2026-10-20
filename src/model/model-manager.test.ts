import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  login, setProvider, selectProviderById, currentConfig, listProviderIds,
  listModelsForProvider, describeConfig, maskApiKey,
  addFallbackModel, removeFallbackModel, clearFallbackModels, modelContextBudget,
} from './model-manager.js';
import { saveConfigFile, loadConfigFile } from './providers.js';
import type { MochiConfig } from '../types.js';

let dir: string;
let prevPath: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-cfg-'));
  prevPath = process.env.MOCHI_CONFIG_PATH;
  process.env.MOCHI_CONFIG_PATH = resolve(dir, 'config.json');
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  if (prevPath === undefined) delete process.env.MOCHI_CONFIG_PATH;
  else process.env.MOCHI_CONFIG_PATH = prevPath;
});

function base(): MochiConfig {
  return { model: { provider: 'x', baseUrl: '', model: 'm' } } as MochiConfig;
}

describe('setProvider', () => {
  it('survives a missing/empty config file (fresh install has no model object)', () => {
    // loadConfigFile() returns {} as MochiConfig when config.json doesn't
    // exist — the old code read cfg.model.apiKey while building the literal
    // and threw, making login/use/model fatal before anything was saved.
    const cfg = setProvider({} as MochiConfig, { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', apiKey: 'sk-fresh-install' });
    expect(cfg.model.provider).toBe('openai');
    expect(cfg.model.model).toBe('gpt-4o');
    expect(cfg.model.apiKey).toBe('sk-fresh-install');
  });

  it('writes the provider/model and persists to the config file', () => {
    const cfg = setProvider(base(), { provider: 'freeinference', baseUrl: 'https://freeinference.org/v1', model: 'deepseek-v4-flash', apiKey: 'sk-test-1234567890' });
    expect(cfg.model.provider).toBe('freeinference');
    expect(cfg.model.model).toBe('deepseek-v4-flash');
    expect(cfg.model.apiKey).toBe('sk-test-1234567890');
    // Persisted: a fresh load reflects the write.
    const loaded = loadConfigFile();
    expect(loaded.model?.model).toBe('deepseek-v4-flash');
  });

  it('keeps the existing apiKey when a selection omits it', () => {
    const cfg = setProvider(base(), { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' });
    expect(cfg.model.apiKey).toBeUndefined();
    const cfg2 = setProvider(cfg, { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5' });
    expect(cfg2.model.apiKey).toBeUndefined();
  });

  it('sets fast/coding/reasoning/review profiles for openai-kind providers', () => {
    const cfg = setProvider(base(), { provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' });
    expect(cfg.model.profiles?.fast).toBe('llama-3.3-70b-versatile');
    expect(cfg.model.profiles?.coding).toBe('llama-3.3-70b-versatile');
    expect(cfg.model.profiles?.reasoning).toBe('llama-3.3-70b-versatile');
    expect(cfg.model.profiles?.review).toBe('llama-3.3-70b-versatile');
  });
});

describe('login / selectProviderById', () => {
  it('logs in with a known provider and its API key', () => {
    const cfg = login(base(), 'anthropic', 'sk-ant-0123456789abcdef0123');
    expect(cfg.model.provider).toBe('anthropic');
    expect(cfg.model.baseUrl).toContain('api.anthropic');
    expect(cfg.model.apiKey).toContain('sk-ant');
  });

  it('login records the keyring (per-provider owned store)', async () => {
    login(base(), 'groq', 'gsk-ring-key', 'llama-3.3-70b-versatile', 'oauth');
    const { loadKeyring, getKeyringKey } = await import('./keyring.js');
    const ring = loadKeyring();
    expect(getKeyringKey(ring, 'groq')).toBe('gsk-ring-key');
    expect(ring['groq'].type).toBe('oauth');
    expect(getKeyringKey(ring, 'openai')).toBeUndefined();
  });

  it('throws on an unknown provider', () => {
    expect(() => login(base(), 'no-such-provider', 'k')).toThrow(/Unknown provider/);
    expect(() => selectProviderById(base(), 'nope')).toThrow(/Unknown provider/);
  });

  it('selects a provider with its default model when none given', () => {
    const cfg = selectProviderById(base(), 'freeinference');
    expect(cfg.model.model).toBe('glm-5.3-flash');
  });
});

describe('list + describe', () => {
  it('lists providers and per-provider models', () => {
    expect(listProviderIds()).toContain('freeinference');
    expect(listProviderIds()).toContain('ollama');
    expect(listModelsForProvider('openai')).toContain('gpt-4o');
    expect(listModelsForProvider('nope')).toEqual([]);
  });

  it('builds a safe describe string (key presence only, never raw or masked)', () => {
    const cfg = setProvider(base(), { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', apiKey: 'sk-ABCDEFGHIJKLMNOPQRST' });
    const d = describeConfig(cfg);
    expect(d).toContain('provider: openai');
    expect(d).toContain('apiKey:  set');
    expect(d).not.toContain('sk-');
  });

  it('masks short keys completely', () => {
    expect(maskApiKey('ab')).toBe('****');
    expect(maskApiKey('sk-ABCDEFGHIJKLMNOPQRST')).toMatch(/^sk-A.+.RST$/);
  });

  it('currentConfig reads the persisted file', () => {
    setProvider(base(), { provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: 'k' });
    expect(currentConfig().model?.model).toBe('deepseek-chat');
  });
});

describe('modelContextBudget (working budget prior)', () => {
  const prev = process.env.MOCHI_CONTEXT_WINDOW;
  afterEach(() => {
    if (prev === undefined) delete process.env.MOCHI_CONTEXT_WINDOW;
    else process.env.MOCHI_CONTEXT_WINDOW = prev;
  });

  it('rounds DOWN to a conservative window per family, never an inflated one', () => {
    // DeepSeek/GLM/Qwen are 128k-class; the old table returned 500k/110k and
    // let the compaction floor sit past the provider's hard limit.
    // (glm-5/deepseek-v4 are the newer 500k long-context classes; plain
    // deepseek-v4-flash via opencode-zen stays at the conservative 128k.)
    expect(modelContextBudget('deepseek-v4-flash-free', 'opencode-zen')).toBe(500_000);
    expect(modelContextBudget('glm-5', 'zhipu')).toBe(500_000);
    expect(modelContextBudget('claude-sonnet-4-5', 'anthropic')).toBe(200_000);
    expect(modelContextBudget('gemini-2.5-pro', 'google')).toBe(1_048_576);
    expect(modelContextBudget('gpt-5.4-nano', 'openai')).toBe(400_000);
    expect(modelContextBudget('some-local-8b', 'ollama')).toBe(32_000);
  });

  it('honors the MOCHI_CONTEXT_WINDOW override', () => {
    process.env.MOCHI_CONTEXT_WINDOW = '65536';
    expect(modelContextBudget('deepseek-v4-flash-free', 'opencode-zen')).toBe(65_536);
    process.env.MOCHI_CONTEXT_WINDOW = 'nonsense';
    expect(modelContextBudget('deepseek-v4-flash-free', 'opencode-zen')).toBe(500_000);
  });

  it('calculates full context budget for antigravity models', () => {
    expect(modelContextBudget('gemini-3.8-flash', 'antigravity')).toBe(1_048_576);
    expect(modelContextBudget('claude-sonnet-4-6', 'antigravity')).toBe(250_000);
    expect(modelContextBudget('gpt-oss-120b', 'antigravity')).toBe(131_072);
  });
});

describe('fallback model management', () => {
  it('adds and updates fallback models', () => {
    let cfg = base();
    cfg = addFallbackModel(cfg, 'anthropic', 'claude-sonnet-4-6');
    expect(cfg.model.failover).toHaveLength(1);
    expect(cfg.model.failover![0].provider).toBe('anthropic');
    expect(cfg.model.failover![0].model).toBe('claude-sonnet-4-6');

    cfg = addFallbackModel(cfg, 'anthropic', 'claude-opus-4-6');
    expect(cfg.model.failover).toHaveLength(1);
    expect(cfg.model.failover![0].model).toBe('claude-opus-4-6');

    cfg = addFallbackModel(cfg, 'openai', 'gpt-4o');
    expect(cfg.model.failover).toHaveLength(2);
  });

  it('removes and clears fallback models', () => {
    let cfg = base();
    cfg = addFallbackModel(cfg, 'anthropic', 'claude-sonnet-4-6');
    cfg = addFallbackModel(cfg, 'openai', 'gpt-4o');
    expect(cfg.model.failover).toHaveLength(2);

    cfg = removeFallbackModel(cfg, 'anthropic');
    expect(cfg.model.failover).toHaveLength(1);
    expect(cfg.model.failover![0].provider).toBe('openai');

    cfg = clearFallbackModels(cfg);
    expect(cfg.model.failover).toHaveLength(0);
  });
});