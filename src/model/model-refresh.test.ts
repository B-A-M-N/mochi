// model-refresh: detection-only upstream model diff (stubbed fetch).
import { describe, it, expect } from 'vitest';
import { listRemoteModels, diffModels, renderRefresh } from './model-refresh.js';

function stubFetch(body: unknown, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe('diffModels (pure)', () => {
  it('splits remote ids into added vs known, deduped', () => {
    const r = diffModels(['a', 'b'], ['b', 'c', 'c', 'd']);
    expect(r.added).toEqual(['c', 'd']);
    expect(r.known).toEqual(['b']);
  });

  it('empty remote yields empty diff without throwing', () => {
    expect(diffModels(['a'], [])).toEqual({ added: [], known: [] });
  });
});

describe('listRemoteModels', () => {
  const openai = { id: 'upstage', baseUrl: 'https://api.upstage.ai/v1', kind: 'openai' } as const;

  it('returns remote ids on 200 with a data[] array', async () => {
    const r = await listRemoteModels(openai, 'k', stubFetch({ data: [{ id: 'solar-pro4' }, { id: 'solar-mini' }] }));
    expect(r).toEqual(['solar-pro4', 'solar-mini']);
  });

  it('rejects honestly on 401 without throwing', async () => {
    const r = await listRemoteModels(openai, 'bad', stubFetch({}, 401));
    expect(r).toEqual({ error: expect.stringContaining('rejected the key') });
  });

  it('reports malformed bodies instead of crashing', async () => {
    const r = await listRemoteModels(openai, 'k', stubFetch({ nope: 1 }));
    expect(r).toEqual({ error: expect.stringContaining('malformed') });
  });

  it('refuses non-openai kinds honestly (no faked listing)', async () => {
    const anthropic = { id: 'anthropic', baseUrl: 'https://api.anthropic.com', kind: 'anthropic' } as const;
    let called = false;
    const spy = (async () => { called = true; return new Response('{}'); }) as unknown as typeof fetch;
    const r = await listRemoteModels(anthropic, 'k', spy);
    expect(called).toBe(false);
    expect(r).toEqual({ error: expect.stringContaining('does not apply') });
  });

  it('requires a key (never probes anonymously)', async () => {
    let called = false;
    const spy = (async () => { called = true; return new Response('{}'); }) as unknown as typeof fetch;
    const r = await listRemoteModels(openai, '', spy);
    expect(called).toBe(false);
    expect(r).toEqual({ error: expect.stringContaining('no usable key') });
  });
});

describe('renderRefresh', () => {
  it('prints new ids with the table-unchanged disclaimer', () => {
    const out = renderRefresh({ id: 'novita' }, { provider: 'novita', added: ['x/y'], known: ['a'] });
    expect(out).toContain('+ x/y');
    expect(out).toContain('Table unchanged');
  });

  it('confirms up-to-date providers explicitly', () => {
    expect(renderRefresh({ id: 'ai21' }, { provider: 'ai21', added: [], known: ['a', 'b'] })).toContain('up to date');
  });

  it('surfaces errors without throwing', () => {
    expect(renderRefresh({ id: 'ai21' }, { provider: 'ai21', added: [], known: [], error: 'boom' })).toContain('could not list (boom)');
  });
});
