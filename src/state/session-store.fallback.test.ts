// JSON fallback for runtimes without node:sqlite (Node 22.0–22.4 satisfies
// mochi's `engines` but has no node:sqlite). Silent degradation here meant
// every prompt ran blind — the "mochi doesn't know the previous conversation"
// class — and the old driver-less constructor CRASHED (openDb throws without
// a driver). These tests force the fallback with MOCHI_SQLITE=off and pin the
// full continuity loop: begin → append → messages → search → persistence.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { SessionStore, hasSqlite } from './session-store.js';

let dir: string;
let prev: string | undefined;

beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-sessfb-'));
  prev = process.env.MOCHI_SQLITE;
  process.env.MOCHI_SQLITE = 'off';
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOCHI_SQLITE;
  else process.env.MOCHI_SQLITE = prev;
  rmSync(dir, { recursive: true, force: true });
});

describe('session store JSON fallback (no sqlite driver)', () => {
  it('hasSqlite honors MOCHI_SQLITE=off', () => {
    expect(hasSqlite()).toBe(false);
  });

  it('round-trips begin → append → messages', () => {
    const store = new SessionStore(dir);
    expect(store.works()).toBe(true);
    const sid = store.begin({ objective: 'Fix the rate limiter' });
    store.append(sid, 'user', 'Fix the rate limiter bug in auth.ts');
    store.append(sid, 'assistant', 'Patched the burst window; tests pass.');
    const msgs = store.messages(sid);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.role).toBe('user');
    expect(msgs[1]!.content).toContain('burst window');
    store.close();
  });

  it('persists across instances (the continuity requirement)', () => {
    const a = new SessionStore(dir);
    const sid = a.begin({ objective: 'remember the codeword' });
    a.append(sid, 'user', 'the magic word is zebra-42');
    a.close();
    // A brand-new store (fresh process semantics) must still see the tail.
    const b = new SessionStore(dir);
    const found = b.search('zebra-42');
    expect(found.length).toBe(1);
    expect(found[0]!.sessionId).toBe(sid);
    b.close();
  });

  it('begin({goalId}) is idempotent like the sqlite path', () => {
    const store = new SessionStore(dir);
    const s1 = store.begin({ goalId: 'goal-xyz', objective: 'First objective' });
    const s2 = store.begin({ goalId: 'goal-xyz' });
    expect(s2).toBe(s1);
    // Freshen-on-rebegin keeps working without an objective.
    const s3 = store.begin({ goalId: 'goal-xyz', objective: 'Updated objective' });
    expect(s3).toBe(s1);
    expect(store.session(s1)?.objective).toBe('Updated objective');
    store.close();
  });

  it('search approximates FTS AND-semantics (every word must appear)', () => {
    const store = new SessionStore(dir);
    const sid = store.begin({ objective: 'limiter work' });
    store.append(sid, 'assistant', 'The rate limiter now allows burst=10.');
    expect(store.search('rate limiter').length).toBeGreaterThanOrEqual(1);
    expect(store.search('limiter volcano')).toHaveLength(0);
    store.close();
  });

  it('list/rename/markCompleted/delete work over the JSON store', () => {
    const store = new SessionStore(dir);
    const sid = store.begin({ objective: 'churn me' });
    store.rename(sid, 'renamed objective');
    expect(store.session(sid)?.objective).toBe('renamed objective');
    store.markCompleted(sid, 'completed');
    expect(store.list(50).find((s) => s.id === sid)?.status).toBe('completed');
    store.delete(sid);
    expect(store.messages(sid)).toHaveLength(0);
    store.close();
  });

  it('bounds the tail: a session keeps its most recent messages', () => {
    const store = new SessionStore(dir);
    const sid = store.begin({ objective: 'chatty' });
    for (let i = 0; i < 80; i++) store.append(sid, 'user', `message ${i}`);
    const msgs = store.messages(sid);
    expect(msgs.length).toBe(60); // MAX_FB_MESSAGES
    expect(msgs[msgs.length - 1]!.content).toBe('message 79'); // newest survives
    store.close();
  });
});
