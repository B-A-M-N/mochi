import { homedir } from 'node:os';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MochiConfig } from '../types.js';

export type ProviderKind = 'openai' | 'anthropic' | 'gemini';

export interface Provider {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  envKey: string;
  models: string[];
  defaultModel: string;
  chatPath?: string;
  /** How to obtain a key (console URL, or CLI command for token-via-OAuth
   *  flows like `gh auth login`). Optional — only filled where verified;
   *  never a placeholder. Shown by `mochi auth status` and /login hints. */
  keyHelp?: string;
}

export const PROVIDERS: Provider[] = [
  { id: 'opencode-zen', name: 'OpenCode Zen', kind: 'openai', baseUrl: 'https://opencode.ai/zen/v1', envKey: 'OPENCODE_ZEN_API_KEY', models: ['deepseek-v4-flash-free', 'deepseek-v4-flash', 'glm-5.3-flash', 'glm-5.3', 'gpt-5.4-nano', 'gpt-5.4', 'kimi-k2.7-code', 'minimax-m2.7', 'qwen3.8-flash', 'claude-sonnet-4-6'], defaultModel: 'deepseek-v4-flash' },
  { id: 'opencode-go', name: 'OpenCode Go', kind: 'openai', baseUrl: 'https://opencode.ai/zen/v1', envKey: 'OPENCODE_GO_API_KEY', models: ['deepseek-v4-flash', 'glm-5.3-flash'], defaultModel: 'deepseek-v4-flash' },
  { id: 'freeinference', name: 'FreeInference.org (Harvard SEAS)', kind: 'openai', baseUrl: 'https://freeinference.org/v1', envKey: 'FREEINFERENCE_API_KEY', models: ['glm-5.3-flash', 'deepseek-v4-flash', 'glm-5.3', 'MiniMax-M3', 'qwen3.6-35b', 'diffusiongemma', 'bge-m3'], defaultModel: 'glm-5.3-flash' },
  { id: 'openai', name: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1', envKey: 'OPENAI_API_KEY', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-5', 'gpt-5-nano', 'gpt-5.4', 'gpt-5.4-nano', 'o3', 'o4-mini'], defaultModel: 'gpt-5.4' },
  { id: 'anthropic', name: 'Anthropic', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', envKey: 'ANTHROPIC_API_KEY', models: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5', 'claude-sonnet-4-6'], defaultModel: 'claude-sonnet-4-5' },
  { id: 'gemini', name: 'Google Gemini', kind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', envKey: 'GEMINI_API_KEY', models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'], defaultModel: 'gemini-2.5-flash' },
  { id: 'deepseek', name: 'DeepSeek', kind: 'openai', baseUrl: 'https://api.deepseek.com/v1', envKey: 'DEEPSEEK_API_KEY', models: ['deepseek-chat', 'deepseek-reasoner'], defaultModel: 'deepseek-chat' },
  { id: 'openrouter', name: 'OpenRouter', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', envKey: 'OPENROUTER_API_KEY', models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-2.0-flash'], defaultModel: 'anthropic/claude-3.5-sonnet' },
  { id: 'groq', name: 'Groq', kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1', envKey: 'GROQ_API_KEY', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'], defaultModel: 'llama-3.3-70b-versatile' },
  { id: 'mistral', name: 'Mistral', kind: 'openai', baseUrl: 'https://api.mistral.ai/v1', envKey: 'MISTRAL_API_KEY', models: ['mistral-large-latest', 'mistral-medium-latest', 'codestral-latest'], defaultModel: 'mistral-large-latest' },
  { id: 'xai', name: 'xAI (Grok)', kind: 'openai', baseUrl: 'https://api.x.ai/v1', envKey: 'XAI_API_KEY', models: ['grok-4', 'grok-2-latest'], defaultModel: 'grok-4' },
  { id: 'together', name: 'Together AI', kind: 'openai', baseUrl: 'https://api.together.xyz/v1', envKey: 'TOGETHER_API_KEY', models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-Coder-32B-Instruct-Turbo'], defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  { id: 'fireworks', name: 'Fireworks', kind: 'openai', baseUrl: 'https://api.fireworks.ai/inference/v1', envKey: 'FIREWORKS_API_KEY', models: ['accounts/fireworks/models/llama-v3p3-70b-instruct'], defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct' },
  { id: 'cerebras', name: 'Cerebras', kind: 'openai', baseUrl: 'https://api.cerebras.ai/v1', envKey: 'CEREBRAS_API_KEY', models: ['llama-3.3-70b', 'llama3.1-8b'], defaultModel: 'llama-3.3-70b' },
  { id: 'azure', name: 'Azure OpenAI', kind: 'openai', baseUrl: 'YOUR_AZURE_ENDPOINT/openai/deployments/YOUR_DEPLOYMENT', envKey: 'AZURE_OPENAI_API_KEY', models: ['gpt-4o'], defaultModel: 'gpt-4o' },
  { id: 'huggingface', name: 'Hugging Face', kind: 'openai', baseUrl: 'https://router.huggingface.co/v1', envKey: 'HF_TOKEN', models: ['meta-llama/Llama-3.3-70B-Instruct'], defaultModel: 'meta-llama/Llama-3.3-70B-Instruct' },
  { id: 'bedrock', name: 'AWS Bedrock', kind: 'openai', baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1', envKey: 'AWS_BEARER_TOKEN_BEDROCK', models: ['anthropic.claude-sonnet-4-5', 'amazon.nova-pro-v1', 'meta.llama3-3-70b-instruct'], defaultModel: 'anthropic.claude-sonnet-4-5' },
  { id: 'github-models', name: 'GitHub Models', kind: 'openai', baseUrl: 'https://models.github.ai/inference', envKey: 'GITHUB_TOKEN', models: ['openai/gpt-4.1', 'anthropic/claude-sonnet-4-5', 'mistral-ai/mistral-large'], defaultModel: 'openai/gpt-4.1', keyHelp: 'No manual key needed if you use the gh CLI: run `gh auth login` (device-flow OAuth handled by gh), then export GITHUB_TOKEN=$(gh auth token)' },
  { id: 'deepinfra', name: 'DeepInfra', kind: 'openai', baseUrl: 'https://api.deepinfra.com/v1/openai', envKey: 'DEEPINFRA_API_KEY', models: ['meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-Coder-32B-Instruct'], defaultModel: 'meta-llama/Llama-3.3-70B-Instruct' },
  { id: 'lmstudio', name: 'LM Studio (local)', kind: 'openai', baseUrl: 'http://localhost:1234/v1', envKey: '', models: ['local-model'], defaultModel: 'local-model' },
  { id: 'cloudflare', name: 'Cloudflare Workers AI', kind: 'openai', baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1', envKey: 'CLOUDFLARE_API_TOKEN', models: ['@cf/meta/llama-3.3-70b-instruct-fp8-fast'], defaultModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
  { id: 'ollama', name: 'Ollama (local)', kind: 'openai', baseUrl: 'http://localhost:11434/v1', envKey: '', models: ['llama3.1', 'qwen2.5-coder'], defaultModel: 'llama3.1' },
  { id: 'llamacpp', name: 'llama.cpp (local)', kind: 'openai', baseUrl: 'http://localhost:8080/v1', envKey: '', models: ['local-model'], defaultModel: 'local-model' },
  { id: 'perplexity', name: 'Perplexity', kind: 'openai', baseUrl: 'https://api.perplexity.ai', envKey: 'PERPLEXITY_API_KEY', models: ['sonar-pro'], defaultModel: 'sonar-pro' },
  { id: 'sambanova', name: 'SambaNova', kind: 'openai', baseUrl: 'https://api.sambanova.ai/v1', envKey: 'SAMBANOVA_API_KEY', models: ['Meta-Llama-3.3-70B-Instruct'], defaultModel: 'Meta-Llama-3.3-70B-Instruct' },
  { id: 'siliconflow', name: 'SiliconFlow', kind: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', envKey: 'SILICONFLOW_API_KEY', models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-Coder-32B-Instruct'], defaultModel: 'deepseek-ai/DeepSeek-V3' },
  { id: 'moonshot', name: 'Moonshot AI (Kimi)', kind: 'openai', baseUrl: 'https://api.moonshot.ai/v1', envKey: 'MOONSHOT_API_KEY', models: ['kimi-k3', 'kimi-k2.6', 'kimi-k2.7-code'], defaultModel: 'kimi-k3' },
  { id: 'minimax', name: 'MiniMax', kind: 'openai', baseUrl: 'https://api.minimax.io/v1', envKey: 'MINIMAX_API_KEY', models: ['MiniMax-M3', 'MiniMax-M3.1-Flash-Preview', 'MiniMax-M2.7', 'MiniMax-M2.5', 'MiniMax-M2.1'], defaultModel: 'MiniMax-M3' },
  { id: 'zhipu', name: 'Zhipu BigModel (GLM)', kind: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', envKey: 'ZHIPUAI_API_KEY', models: ['glm-5.3', 'glm-4.5', 'glm-4.5-air'], defaultModel: 'glm-5.3' },
  { id: 'zai', name: 'Z.AI (GLM, overseas)', kind: 'openai', baseUrl: 'https://api.z.ai/api/paas/v4', envKey: 'ZAI_API_KEY', models: ['glm-5.3', 'glm-4.5', 'glm-4.5-air'], defaultModel: 'glm-5.3' },
  { id: 'cohere', name: 'Cohere', kind: 'openai', baseUrl: 'https://api.cohere.ai/compatibility/v1', envKey: 'COHERE_API_KEY', models: ['command-a-plus-05-2026', 'command-a-03-2025', 'command-a-reasoning-08-2025'], defaultModel: 'command-a-plus-05-2026' },
  { id: 'qwen', name: 'Alibaba Qwen (DashScope)', kind: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', envKey: 'DASHSCOPE_API_KEY', models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-coder-32b-instruct'], defaultModel: 'qwen-max' },
  { id: 'upstage', name: 'Upstage (Solar)', kind: 'openai', baseUrl: 'https://api.upstage.ai/v1', envKey: 'UPSTAGE_API_KEY', models: ['solar-pro4', 'solar-mini'], defaultModel: 'solar-pro4', keyHelp: 'Get a key at https://console.upstage.ai (API Keys)' },
  { id: 'nebius', name: 'Nebius AI Studio', kind: 'openai', baseUrl: 'https://api.studio.nebius.ai/v1', envKey: 'NEBIUS_API_KEY', models: ['meta-llama/Meta-Llama-3.3-70B-Instruct', 'Qwen/Qwen3-235B-A22B'], defaultModel: 'meta-llama/Meta-Llama-3.3-70B-Instruct', keyHelp: 'Get a key at https://studio.nebius.com (API keys)' },
  { id: 'novita', name: 'Novita AI', kind: 'openai', baseUrl: 'https://api.novita.ai/openai/v1', envKey: 'NOVITA_API_KEY', models: ['deepseek/deepseek-v4.1-flash', 'meta-llama/llama-3.1-8b-instruct'], defaultModel: 'deepseek/deepseek-v4.1-flash', keyHelp: 'Get a key at https://novita.ai (API Keys)' },
  { id: 'ai21', name: 'AI21 Labs (Jamba)', kind: 'openai', baseUrl: 'https://api.ai21.com/studio/v1', envKey: 'AI21_API_KEY', models: ['jamba-large', 'jamba-mini'], defaultModel: 'jamba-large', keyHelp: 'Get a key at https://studio.ai21.com (API keys)' },
];

export const providerById = (id: string): Provider | undefined => PROVIDERS.find((p) => p.id === id);
export const providerByName = (name: string): Provider | undefined => PROVIDERS.find((p) => p.name.toLowerCase() === name.toLowerCase() || p.id === name.toLowerCase());

export function configFilePath(): string {
  const override = process.env.MOCHI_CONFIG_PATH;
  if (override) return override;
  return resolve(homedir(), '.config/mochi', 'config.json');
}

export function loadConfigFile(): MochiConfig {
  const path = configFilePath();
  if (!existsSync(path)) return {} as MochiConfig;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as MochiConfig;
  } catch {
    return {} as MochiConfig;
  }
}

export function saveConfigFile(cfg: MochiConfig): void {
  const path = configFilePath();
  const dir = resolve(path, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2));
}