import type { ChatMessage, ModelResponse, StreamChunk, ToolDefinition } from '../types.js';
import { contentText, splitContent } from '../types.js';
import type { ProviderConfig } from './router.js';
import { ProviderError, describeModelError, parseRetryAfter } from '../utils/http-error.js';
import { withRetries, classifyError } from './rate-limit.js';

function logBackoff(attempt: number, delayMs: number, err: unknown): void {
  const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
  console.warn(`[rate-limit] model request backoff #${attempt}: sleeping ${Math.round(delayMs)}ms (${detail.slice(0, 80)})`);
}

export function createAnthropicProvider(config: ProviderConfig) {
  const base = config.baseUrl.replace(/\/$/, '');
  const model = config.model;

  // Prompt-cache breakpoints (mirrors the OpenAI mapper's MCH-38 pattern):
  // the system prompt is byte-stable across turns, so mark it as one cached
  // prefix block. Without this Anthropic bills every turn at full input price
  // (~5KB system prompt × every iteration). String form when empty preserves
  // the old wire shape exactly.
  const sysText = (msgs: ChatMessage[]) => msgs.filter((m) => m.role === 'system').map((m) => contentText(m)).join('\n');
  const sysMsg = (msgs: ChatMessage[]) => {
    const text = sysText(msgs);
    if (!text) return undefined;
    return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
  };
  const bodyMsg = (m: ChatMessage) => {
    if (m.role === 'system') return null;
    if (m.role === 'tool') {
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: m.tool_call_id,
            content: contentText(m),
          },
        ],
      };
    }
    if (m.role === 'assistant' && m.tool_calls) {
      const contentBlocks: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }> = [];
      const text = contentText(m);
      if (text) contentBlocks.push({ type: 'text', text });
      for (const tc of m.tool_calls) {
        let input = {};
        try {
          input = JSON.parse(tc.function.arguments || '{}');
        } catch {}
        contentBlocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input,
        });
      }
      return { role: 'assistant', content: contentBlocks };
    }
    // Multimodal user turn: text + native image blocks. Data URIs become
    // base64 image sources; remote URLs use Anthropic's url source.
    const { text, images } = splitContent(m.content);
    if (images.length > 0) {
      const parts: Array<{ type: string; text?: string; source?: unknown }> = [];
      if (text) parts.push({ type: 'text', text });
      for (const img of images) {
        if ('data' in img) {
          parts.push({ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.data } });
        } else {
          parts.push({ type: 'image', source: { type: 'url', url: img.url } });
        }
      }
      return { role: m.role, content: parts };
    }
    return { role: m.role, content: text };
  };

  async function chat(messages: ChatMessage[], tools: ToolDefinition[], options?: { reasoningEffort?: string }): Promise<ModelResponse> {
    const reasoning = ((options?.reasoningEffort || process.env.MOCHI_REASONING) || '').toLowerCase();
    const supportsThinking = /(3-7|3\.7|opus-4|sonnet-4|claude-4)/i.test(model);
    const thinkingBudget = supportsThinking
      ? ((reasoning === 'max' || reasoning === 'extreme' || reasoning === 'deep') ? 32768
        : (reasoning === 'high' || reasoning === 'hard') ? 16384
        : (reasoning === 'medium') ? 4096 : 0)
      : 0;

    const body: Record<string, unknown> = {
      model,
      max_tokens: thinkingBudget > 0 ? Math.max(16384, thinkingBudget + 4096) : 8192,
      system: sysMsg(messages) || undefined,
      messages: messages.map(bodyMsg).filter(Boolean),
      stream: false,
      ...(thinkingBudget > 0 ? { thinking: { type: 'enabled', budget_tokens: thinkingBudget } } : {}),
      ...(tools.length ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: { type: 'object', properties: Object.fromEntries(t.parameters.map((p) => [p.name, { type: p.type, description: p.description }])), required: t.parameters.filter((x) => x.required).map((x) => x.name) } })) } : {}),
    };
    const res = await withRetries(async () => {
      try {
        const r = await fetch(`${base}/v1/messages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': config.apiKey ?? '', 'anthropic-version': '2023-06-01' },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const text = await r.text();
          throw describeModelError(r.status, text, model, 'Anthropic', parseRetryAfter(r.headers.get('retry-after')));
        }
        return r;
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError(err instanceof Error ? err.message : String(err), { retryable: classifyError(err).retryable, cause: err });
      }
    }, { maxAttempts: 4, onBackoff: (attempt, delayMs, err) => logBackoff(attempt, delayMs, err) });
    const data = await res.json() as {
      content?: Array<{ type?: string; text?: string; thinking?: string; id?: string; name?: string; input?: unknown }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      stop_reason?: string;
    };
    const blocks = data.content ?? [];
    const text = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const thinkingBlocks = blocks.filter((b) => b.type === 'thinking');
    const reasoningText = thinkingBlocks.map((b) => b.thinking).filter(Boolean).join('\n');
    const toolUses = blocks.filter((b) => b.type === 'tool_use');
    const toolCalls = toolUses.map((b: any) => ({ id: b.id, type: 'function' as const, function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
    const usage = data.usage ? { promptTokens: data.usage.input_tokens ?? 0, completionTokens: data.usage.output_tokens ?? 0, totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0) } : undefined;
    return { content: text, reasoningContent: reasoningText || undefined, toolCalls: toolCalls.length ? toolCalls : undefined, finishReason: data.stop_reason, usage };
  }

  async function* streamChat(messages: ChatMessage[], tools: ToolDefinition[], options?: { reasoningEffort?: string }): AsyncGenerator<StreamChunk> {
    const resp = await chat(messages, tools, options);
    yield { content: resp.content, reasoningContent: resp.reasoningContent, toolCalls: resp.toolCalls, finishReason: resp.finishReason as StreamChunk['finishReason'], usage: resp.usage };
  }

  return { chat, streamChat };
}