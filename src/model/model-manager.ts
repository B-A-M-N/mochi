import type { MochiConfig, ModelProfile } from '../types.js';
import {PROVIDERS, providerById, loadConfigFile, saveConfigFile} from './providers.js';
import { normalizeModelName } from './router.js';

export interface ProviderSelection {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export function currentConfig(): MochiConfig {
  return loadConfigFile();
}

export function modelContextBudget(model: string, provider?: string): number {
  const m = (model || '').toLowerCase();
  const p = (provider || '').toLowerCase();
  if (m.includes('gemini') || p.includes('gemini')) return 400_000;
  if (m.includes('claude') || p.includes('anthropic') || m.includes('kimi') || m.includes('moonshot')) return 160_000;
  if (p.includes('freeinference') || m.includes('glm-5') || m.includes('deepseek-v4')) return 500_000;
  if (
    m.includes('gpt-4') || m.includes('gpt-5') || m.includes('o3') || m.includes('o4') ||
    m.includes('deepseek') || m.includes('glm') || m.includes('qwen') ||
    m.includes('minimax') || m.includes('llama-3') || m.includes('codestral') ||
    m.includes('mistral') || m.includes('grok')
  ) {
    return 110_000;
  }
  if (p === 'ollama' || p === 'llamacpp' || p === 'lmstudio' || m.includes('local') || m.includes('8b')) {
    return 32_000;
  }
  return 110_000;
}

export function setProvider(config: MochiConfig, selection: ProviderSelection): MochiConfig {
  const cfg = { ...config };
  // Tolerate a missing/empty config file (fresh install): loadConfigFile()
  // returns {} as MochiConfig, so cfg.model is undefined — the old code read
  // `cfg.model.apiKey` while BUILDING the object literal and threw
  // "Cannot read properties of undefined", making `mochi login/use/model`
  // fatal before anything was saved.
  const base = cfg.model ?? ({} as MochiConfig['model']);
  const p = providerById(selection.provider);
  const envKey = p?.envKey ? process.env[p.envKey] : undefined;
  // Only inherit base.apiKey if switching models on the SAME provider;
  // never send Provider A's key to Provider B!
  const sameProvider = base.provider === selection.provider;
  const apiKey = selection.apiKey || (sameProvider ? base.apiKey : (envKey || undefined));
  const normModel = normalizeModelName(selection.model, selection.baseUrl);

  cfg.model = {
    ...base,
    provider: selection.provider,
    baseUrl: selection.baseUrl,
    model: normModel,
    apiKey,
  };
  if (!cfg.reasoning) {
    cfg.reasoning = 'medium';
  }
  cfg.safety = {
    ...(cfg.safety ?? {}),
    contextBudgetTokens: modelContextBudget(normModel, selection.provider),
  };
  if (p && (p.kind === 'openai' || p.kind === 'anthropic' || p.kind === 'gemini')) {
    cfg.model.profiles = cfg.model.profiles ?? ({} as Record<ModelProfile, string>);
    cfg.model.profiles.fast = normModel;
    cfg.model.profiles.coding = normModel;
    cfg.model.profiles.reasoning = normModel;
    cfg.model.profiles.review = normModel;
  }
  saveConfigFile(cfg);
  return cfg;
}

export function login(config: MochiConfig, providerId: string, apiKey: string, model?: string): MochiConfig {
  const p = providerById(providerId);
  if (!p) throw new Error(`Unknown provider: ${providerId}`);
  return setProvider(config, {
    provider: p.id,
    baseUrl: p.baseUrl,
    model: model || p.defaultModel,
    apiKey,
  });
}

export function selectProviderById(config: MochiConfig, providerId: string, model?: string): MochiConfig {
  const p = providerById(providerId);
  if (!p) throw new Error(`Unknown provider: ${providerId}`);
  return setProvider(config, {
    provider: p.id,
    baseUrl: p.baseUrl,
    model: model || p.defaultModel,
  });
}

export function listProviderIds(): string[] {
  return PROVIDERS.map((p) => p.id);
}

export function listModelsForProvider(providerId: string): string[] {
  const p = providerById(providerId);
  return p ? p.models : [];
}

export function describeConfig(config: MochiConfig): string {
  return [
    `provider: ${config.model.provider}`,
    `baseUrl: ${config.model.baseUrl}`,
    `model:   ${config.model.model}`,
    `apiKey:  ${config.model.apiKey ? 'set' : 'NOT SET'}`,
  ].join('\n');
}

export function maskApiKey(key: string): string {
  if (key.length <= 4) return '****';
  return key.slice(0, 4) + '…' + key.slice(-4);
}