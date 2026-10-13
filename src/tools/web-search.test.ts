import { describe, it, expect, vi, afterEach } from 'vitest';
import { webSearchTool } from './web-search.js';

type Ctx = { events: { emit: ReturnType<typeof vi.fn> }; agentId: string };
const makeCtx = (): Ctx => ({ events: { emit: vi.fn() }, agentId: 'test-agent' });
const run = (args: Record<string, unknown>, ctx: Ctx = makeCtx()) =>
  webSearchTool.execute(args, ctx as never);

const DDG_HTML = [
  '<html><body>',
  '<div class="result results_links highlight_d Nixon">',
  '<a class="result__url" href="https://example.com/a">example.com/a</a>',
  '<a class="result__snippet" href="https://example.com/a">Hello snippet</a>',
  '</div>',
  '<div class="result results_links">',
  '<a class="result__a" href="https://html.duckduckgo.com/l/?kh=-1&uddg=https%3A%2F%2Ffoo.dev%2F">Foo Site</a>',
  '<div class="result__snippet">Foo snippet</div>',
  '</div>',
  '</body></html>',
].join('\n');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('web_search tool', () => {
  it('rejects an empty query before any network work', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const ctx = makeCtx();
    expect(await run({ query: '   ' }, ctx)).toContain('search query cannot be empty');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ctx.events.emit).not.toHaveBeenCalled();
  });

  it('emits a tool:called event and parses DuckDuckGo results', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => DDG_HTML })));
    const ctx = makeCtx();
    const out = await run({ query: 'mochi agent' }, ctx);
    expect(ctx.events.emit).toHaveBeenCalledTimes(1);
    expect(ctx.events.emit.mock.calls[0][0]).toMatchObject({ type: 'tool:called', tool: 'web_search', agentId: 'test-agent' });
    expect(out).toContain('# Web Search Results: "mochi agent"');
    expect(out).toContain('### 1. [example.com/a](https://example.com/a)');
    expect(out).toContain('Hello snippet');
    // uddg redirect is decoded to the real destination
    expect(out).toContain('[Foo Site](https://foo.dev/)');
    expect(out).toContain('Foo snippet');
  });

  it('restricts to a domain and clamps max_results', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => DDG_HTML }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await run({ query: 'rust lifetimes', domain: 'docs.rs', max_results: 1 });
    // domain restriction lands in the query string
    expect(fetchMock.mock.calls[0][0]).toContain(encodeURIComponent('rust lifetimes site:docs.rs'));
    expect(out).toContain('"rust lifetimes site:docs.rs"');
    // max_results=1 keeps only the first block
    expect(out).toContain('### 1.');
    expect(out).not.toContain('### 2.');
  });

  it('clamps max_results into [1,10]', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => DDG_HTML }));
    vi.stubGlobal('fetch', fetchMock);
    await run({ query: 'x', max_results: 999 });
    await run({ query: 'x', max_results: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports non-OK HTTP statuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, text: async () => '' })));
    const out = await run({ query: 'anything' });
    expect(out).toContain('HTTP status 503');
  });

  it('reports when no result blocks are present', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '<html>no results here</html>' })));
    const out = await run({ query: 'zzz nothing' });
    expect(out).toContain('No web results found for query: "zzz nothing".');
  });

  it('reports network errors instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom'); }));
    const out = await run({ query: 'x' });
    expect(out).toContain('Web search error: boom.');
    expect(out).toContain('fetch');
  });
});
