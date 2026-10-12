import type { ChatMessage, ModelResponse, StreamChunk, ToolDefinition } from '../types.js';
import { contentText, splitContent } from '../types.js';
import type { ProviderConfig } from './router.js';
import { ProviderError, describeModelError, parseRetryAfter } from '../utils/http-error.js';
import { withRetries, classifyError } from './rate-limit.js';

function logBackoff(attempt: number, delayMs: number, err: unknown): void {
  const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
  console.warn(`[rate-limit] model request backoff #${attempt}: sleeping ${Math.round(delayMs)}ms (${detail.slice(0, 80)})`);
}

function toGeminiTools(tools: ToolDefinition[]) {
  if (!tools || tools.length === 0) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: 'OBJECT',
          properties: Object.fromEntries(
            t.parameters.map((p) => [
              p.name,
              {
                type: (p.type || 'string').toUpperCase(),
                description: p.description,
              },
            ]),
          ),
          required: t.parameters.filter((p) => p.required).map((p) => p.name),
        },
      })),
    },
  ];
}

export function createGeminiProvider(config: ProviderConfig) {
  const base = config.baseUrl.replace(/\/$/, '');
  const model = config.model;

  const toContents = (msgs: ChatMessage[]) =>
    msgs
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'tool')
      .map((m) => {
        if (m.role === 'assistant') {
          const parts: Array<{ text?: string; functionCall?: { name: string; args: unknown } }> = [];
          const text = contentText(m);
          if (text) parts.push({ text });
          if (m.tool_calls) {
            for (const tc of m.tool_calls) {
              let args = {};
              try {
                args = JSON.parse(tc.function.arguments || '{}');
              } catch {}
              parts.push({
                functionCall: {
                  name: tc.function.name,
                  args,
                },
              });
            }
          }
          return { role: 'model', parts: parts.length ? parts : [{ text: '' }] };
        }
        if (m.role === 'tool') {
          return {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: m.name ?? 'tool',
                  response: { name: m.name ?? 'tool', content: contentText(m) },
                },
              },
            ],
          };
        }
        // Multimodal user turn: data-URI images become inlineData parts.
        // Remote http(s) URLs have no Gemini-native inline form (fileData
        // needs Files-API URIs), so they ride along as text — the URL itself
        // is preserved, never dropped or stringified as [object Object].
        const { text: gtext, images: gimages } = splitContent(m.content);
        const inline = gimages.filter((g): g is { mime: string; data: string } => 'data' in g);
        if (inline.length > 0) {
          const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
          if (gtext) parts.push({ text: gtext });
          for (const img of inline) parts.push({ inlineData: { mimeType: img.mime, data: img.data } });
          return { role: 'user', parts };
        }
        const remote = gimages.filter((g): g is { url: string } => 'url' in g).map((g) => g.url);
        return { role: 'user', parts: [{ text: [gtext, ...remote].filter(Boolean).join('\n') }] };
      });

  const system = (msgs: ChatMessage[]) => msgs.filter((m) => m.role === 'system').map((m) => contentText(m)).join('\n');

  async function chat(messages: ChatMessage[], tools: ToolDefinition[], options?: { reasoningEffort?: string }): Promise<ModelResponse> {
    const url = `${base}/v1beta/models/${model}:generateContent?key=${config.apiKey ?? ''}`;
    const reasoning = String(options?.reasoningEffort || process.env.MOCHI_REASONING || '').toLowerCase().trim();
    const supportsThinking = /(2\.0|2\.5|gemini-2)/i.test(model);
    const thinkingBudget = supportsThinking
      ? ((reasoning === 'max' || reasoning === 'extreme' || reasoning === 'deep') ? 24576
        : (reasoning === 'high' || reasoning === 'hard') ? 16384
        : (reasoning === 'medium') ? 8192
        : (reasoning === 'low' || reasoning === 'easy') ? 1024
        : 0)
      : 0;

    const geminiTools = toGeminiTools(tools);
    const body: Record<string, unknown> = {
      contents: toContents(messages),
      systemInstruction: system(messages) ? { parts: [{ text: system(messages) }] } : undefined,
      ...(geminiTools ? { tools: geminiTools } : {}),
      ...(thinkingBudget > 0 ? { generationConfig: { thinking_config: { thinking_budget: thinkingBudget } } } : {}),
    };
    const res = await withRetries(async () => {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const text = await r.text();
          throw describeModelError(r.status, text, model, 'Gemini', parseRetryAfter(r.headers.get('retry-after')));
        }
        return r;
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError(err instanceof Error ? err.message : String(err), { retryable: classifyError(err).retryable, cause: err });
      }
    }, { maxAttempts: 4, onBackoff: (attempt, delayMs, err) => logBackoff(attempt, delayMs, err) });
    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean; functionCall?: { name: string; args?: unknown } }> }; finishReason?: string }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };
    const candidates = data.candidates ?? [];
    const parts = candidates[0]?.content?.parts ?? [];
    const textParts = parts.filter((p) => !p.thought && p.text && !p.functionCall).map((p) => p.text as string);
    const thoughtParts = parts.filter((p) => p.thought && p.text).map((p) => p.text as string);
    const functionCalls = parts
      .filter((p): p is { text?: string; thought?: boolean; functionCall: { name: string; args?: unknown } } => !!p.functionCall)
      .map((p, idx: number) => ({
        id: `call_${Date.now()}_${idx}`,
        type: 'function' as const,
        function: {
          name: p.functionCall.name,
          arguments: JSON.stringify(p.functionCall.args ?? {}),
        },
      }));
    const content = textParts.join('');
    const reasoningText = thoughtParts.join('\n');
    const u = data.usageMetadata ?? {};
    return {
      content,
      reasoningContent: reasoningText || undefined,
      toolCalls: functionCalls.length ? functionCalls : undefined,
      finishReason: candidates[0]?.finishReason,
      usage: { promptTokens: u.promptTokenCount ?? 0, completionTokens: u.candidatesTokenCount ?? 0, totalTokens: u.totalTokenCount ?? 0, cachedTokens: (u as { cachedContentTokenCount?: number }).cachedContentTokenCount ?? 0 },
    };
  }

  async function* streamChat(messages: ChatMessage[], tools: ToolDefinition[], options?: { reasoningEffort?: string }): AsyncGenerator<StreamChunk> {
    const resp = await chat(messages, tools, options);
    yield {
      content: resp.content,
      reasoningContent: resp.reasoningContent,
      toolCalls: resp.toolCalls,
      finishReason: resp.finishReason as StreamChunk['finishReason'],
      usage: resp.usage,
    };
  }

  return { chat, streamChat };
}