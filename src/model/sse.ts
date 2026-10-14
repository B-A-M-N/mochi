// Shared Server-Sent-Events streaming plumbing for model providers.
//
// Real streaming (vs the old fetch-then-emit-one-chunk fake): the response
// body is read incrementally through `Response.body.getReader()` + a
// streaming TextDecoder and split into SSE frames as bytes arrive.
// anthropic.ts and gemini.ts share this loop so abort/timeout/error
// semantics stay identical to openai.ts:
//
//   - the caller's AbortSignal is linked to a local controller so BOTH the
//     request and the watchdogs tear down an in-flight stream, and the
//     caller's abort reason is preserved (never replaced by AbortError),
//   - header + stall watchdogs honor MOCHI_MODEL_HEADERS_TIMEOUT_MS /
//     MOCHI_MODEL_STALL_TIMEOUT_MS so a dead connection surfaces instead of
//     hanging the agent loop,
//   - non-2xx responses throw a ProviderError built from the API error body
//     (never a hang),
//   - a non-SSE (plain JSON) response is parsed whole-body and yielded once
//     as `{ kind: 'json' }` so plain-JSON gateways keep working.

import { ProviderError, describeModelError, parseRetryAfter } from '../utils/http-error.js';
import { withRetries, classifyError } from './rate-limit.js';

/** One parsed frame: a whole-body JSON fallback, or an SSE event with its
 *  optional `event:` type and joined `data:` payload. */
export type SSEFrame =
  | { kind: 'sse'; event?: string; data: string }
  | { kind: 'json'; data: unknown };

export interface SSEStreamOptions {
  /** Caller cancellation signal (Ctrl-C / interrupt); its reason is
   *  rethrown untouched so callers can tell an operator abort apart from a
   *  provider failure. */
  signal?: AbortSignal;
  model: string;
  provider: string; // error-message label, e.g. 'Anthropic'
}

function logBackoff(attempt: number, delayMs: number, err: unknown): void {
  // Walk the cause chain: undici's bare `fetch failed` hides the actual
  // reason (ECONNREFUSED vs ETIMEDOUT vs proxy vs TLS) — surface it.
  const parts: string[] = [];
  let cur: unknown = err;
  for (let depth = 0; depth < 4 && cur !== undefined && cur !== null; depth++) {
    const line = cur instanceof Error ? (cur.message.split('\n')[0] ?? '') : String(cur);
    if (line && !parts.includes(line)) parts.push(line);
    cur = cur instanceof Error ? cur.cause : undefined;
  }
  const detail = parts.join(' <- ') || String(err);
  console.warn(`[rate-limit] model request backoff #${attempt}: sleeping ${Math.round(delayMs)}ms (${detail.slice(0, 200)})`);
}

/** Structural view of Response.body's reader (keeps this file independent of
 *  undici's overloaded getReader() typings). */
interface BodyReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  cancel(): Promise<void>;
  releaseLock(): void;
}

/**
 * Perform `start()` (the actual request, wired to the plumbing-managed
 * signal) and yield parsed frames as bytes arrive.
 *
 * Non-2xx throws a ProviderError built from the API error body before any
 * frame is yielded. When the response is not `text/event-stream`, the whole
 * body is parsed once and yielded as a single `{ kind: 'json' }` frame.
 * A `data: [DONE]` sentinel terminates the stream (returns), and an event
 * still pending at EOF is flushed so servers that omit the final blank line
 * lose nothing.
 */
export async function* openSSEStream(
  start: (signal: AbortSignal) => Promise<Response>,
  opts: SSEStreamOptions,
): AsyncGenerator<SSEFrame> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort(opts.signal?.reason);
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort(opts.signal.reason);
    else opts.signal.addEventListener('abort', onAbort, { once: true });
  }

  const isReasoning = /reason|r1|deepseek|glm|o1|o3|o4|think/i.test(opts.model);
  const headerTimeoutRaw = Number(process.env.MOCHI_MODEL_HEADERS_TIMEOUT_MS);
  const headerTimeoutMs = Number.isFinite(headerTimeoutRaw) && headerTimeoutRaw > 0
    ? Math.max(100, headerTimeoutRaw)
    : (isReasoning ? 45_000 : 25_000);
  const headerTimer = setTimeout(
    () => ctrl.abort(new Error(`Model response headers stalled for ${headerTimeoutMs}ms`)),
    headerTimeoutMs,
  );

  let reader: BodyReader | null = null;
  let stallInterval: ReturnType<typeof setInterval> | undefined;
  try {
    // Rate-limit + transient-failure safe fetch: only the request is retried
    // (never mid-stream), with exponential backoff honoring Retry-After.
    const res = await withRetries(async () => {
      try {
        const r = await start(ctrl.signal);
        if (!r.ok) {
          const text = await r.text().catch(() => '');
          throw describeModelError(r.status, text, opts.model, opts.provider, parseRetryAfter(r.headers?.get?.('retry-after')));
        }
        return r;
      } catch (err) {
        if (ctrl.signal.aborted) {
          if (opts.signal?.aborted) throw opts.signal.reason ?? err;
          throw new ProviderError(err instanceof Error ? err.message : String(err), { retryable: false, cause: err });
        }
        // Network/transport errors carry no status; let the classifier decide
        // whether this is transient (retry) or permanent (host refused / bad DNS).
        if (err instanceof ProviderError) throw err;
        throw new ProviderError(err instanceof Error ? err.message : String(err), { retryable: classifyError(err).retryable, cause: err });
      }
    }, { maxAttempts: 4, onBackoff: logBackoff }).finally(() => clearTimeout(headerTimer));

    const contentType = res.headers?.get?.('content-type') ?? '';
    if (!/text\/event-stream/i.test(String(contentType))) {
      // Non-SSE fallback (plain-JSON gateway / proxy): one-shot body, still
      // surfaced through the same frame interface so callers see one chunk.
      let json: unknown;
      try {
        json = await res.json();
      } catch (err) {
        throw new ProviderError(`Non-SSE ${opts.provider} response was not valid JSON`, { retryable: false, cause: err });
      }
      yield { kind: 'json', data: json };
      return;
    }

    if (!res.body) throw new ProviderError('No response body from model', { retryable: true });
    reader = res.body.getReader() as BodyReader;
    const decoder = new TextDecoder();
    let buffer = '';
    let event: string | undefined;
    let dataLines: string[] = [];

    // Watchdog stall guard: ONE reusable timer. The stream is read bare-fast
    // and the timer aborts the request only when the stream has been silent
    // for STALL_TIMEOUT_MS (same shape as openai.ts).
    const stallTimeoutRaw = Number(process.env.MOCHI_MODEL_STALL_TIMEOUT_MS);
    const STALL_TIMEOUT_MS = Number.isFinite(stallTimeoutRaw) && stallTimeoutRaw > 0
      ? Math.max(1000, stallTimeoutRaw)
      : (isReasoning ? 60_000 : 35_000);
    let lastChunkAt = Date.now();
    let stalled = false;
    stallInterval = setInterval(() => {
      if (!stalled && Date.now() - lastChunkAt >= STALL_TIMEOUT_MS) {
        stalled = true;
        ctrl.abort(); // tear down the still-open stream now, not after read
      }
    }, 2000);

    /** Close out the pending event (blank line) — spec-accurate SSE framing. */
    const dispatch = (): Extract<SSEFrame, { kind: 'sse' }> | null => {
      const pending = dataLines;
      const evt = event;
      event = undefined;
      dataLines = [];
      if (pending.length === 0) return null;
      return { kind: 'sse', event: evt, data: pending.join('\n') };
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lastChunkAt = Date.now();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
        if (line === '') {
          const frame = dispatch();
          if (frame) {
            if (frame.data.trim() === '[DONE]') return;
            yield frame;
          }
          continue;
        }
        if (line.startsWith(':')) continue; // comment / keep-alive ping
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        let value2 = colon === -1 ? '' : line.slice(colon + 1);
        if (value2.startsWith(' ')) value2 = value2.slice(1);
        if (field === 'event') event = value2;
        else if (field === 'data') dataLines.push(value2);
        // id:/retry: are irrelevant for model streams — ignored.
      }
    }
    // EOF mid-event: some servers omit the final blank line — flush it.
    const tail = dispatch();
    if (tail && tail.data.trim() !== '[DONE]') yield tail;
  } finally {
    clearTimeout(headerTimer);
    if (stallInterval) clearInterval(stallInterval);
    opts.signal?.removeEventListener('abort', onAbort);
    // Consumer return()/throw also reaches here: stop the underlying request,
    // not just the generator.
    ctrl.abort();
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // An aborted or errored transport may already have closed the reader.
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // Reader may already be released by the transport teardown.
        }
      }
    }
  }
}
