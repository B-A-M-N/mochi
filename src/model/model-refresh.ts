// `mochi models --refresh` core: detect upstream models not yet in our table.
//
// Detection only — it NEVER mutates providers.ts. When an endpoint lists ids
// we don't know, we print them so a human can verify and file a table update
// (the table-integrity test then pins the new default if one changes).
// Only the OpenAI-shape `/models` list is used (same cheap read as the login
// probe — no generation cost). Anthropic/Gemini kinds report honestly that
// this path doesn't list for them instead of faking results.

import type { Provider } from './providers.js';

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface RefreshResult {
  provider: string;
  /** Remote ids minus table ids (the actual news). */
  added: string[];
  /** Remote ids already in the table. */
  known: string[];
  /** Set when nothing could be listed (auth/network/unsupported). */
  error?: string;
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + path;
}

/** List remote model ids for one provider. Injected fetch so tests stub it. */
export async function listRemoteModels(
  p: Pick<Provider, 'id' | 'baseUrl' | 'kind'>,
  apiKey: string,
  fetchFn: FetchFn = fetch,
  timeoutMs = 10_000,
): Promise<string[] | { error: string }> {
  if (p.kind !== 'openai') {
    return { error: `${p.id} is a ${p.kind}-kind provider — model listing via the OpenAI-shape /models path does not apply. Check the vendor console for new models.` };
  }
  if (!apiKey) return { error: `no usable key for ${p.id} (set its env key or log in first)` };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn(joinUrl(p.baseUrl, '/models'), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: ctl.signal,
    });
    if (res.status === 401 || res.status === 403) {
      return { error: `endpoint rejected the key (HTTP ${res.status}) — key not stored or changed; re-login to fix` };
    }
    if (!res.ok) return { error: `endpoint answered HTTP ${res.status} (not a model list)` };
    const body = (await res.json().catch(() => null)) as { data?: Array<{ id?: unknown }> } | null;
    if (!body || !Array.isArray(body.data)) return { error: 'model list response malformed (no data[] array)' };
    const ids = body.data.map((d) => d?.id).filter((id): id is string => typeof id === 'string' && id.length > 0);
    return ids;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg.includes('aborted') ? `no answer within ${timeoutMs}ms` : msg.slice(0, 160) };
  } finally {
    clearTimeout(timer);
  }
}

/** Diff remote ids against the table (pure — directly tested). */
export function diffModels(known: string[], remote: string[]): { added: string[]; known: string[] } {
  const knownSet = new Set(known);
  const seen = new Set<string>();
  const added: string[] = [];
  const knownHits: string[] = [];
  for (const id of remote) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (knownSet.has(id)) knownHits.push(id);
    else added.push(id);
  }
  return { added, known: knownHits };
}

/** Render one provider's refresh result for the terminal. */
export function renderRefresh(p: Pick<Provider, 'id'>, result: RefreshResult): string {
  if (result.error) return `${p.id}: could not list (${result.error})`;
  if (!result.added.length) {
    return `${p.id}: up to date — ${result.known.length} remote model(s) all match the table.`;
  }
  return [
    `${p.id}: ${result.added.length} new upstream model(s) not in the table:`,
    ...result.added.map((id) => `  + ${id}`),
    `Table unchanged (detection only — verify an id serves chat, then update providers.ts; the integrity test pins the default).`,
  ].join('\n');
}
