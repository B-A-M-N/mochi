// Mochi SDK — embed Mochi programmatically (in-process) or drive a running
// daemon over HTTP (remote). One typed surface for both modes, so scripts,
// editors, CI jobs, and other agents can drive Mochi like the CLI does.
//
//   import { Mochi } from 'mochi';
//   const mochi = Mochi.create({ cwd: '/path/to/project' });  // in-process
//   const r = await mochi.prompt('fix the failing test in src/auth.ts');
//
//   const mochi = Mochi.connect({ port: 8642, token: '...' }); // remote daemon
//   await mochi.goal('add a REST endpoint for user avatars');
//
// Modes:
//  - in-process (Mochi.create): constructs a Runtime directly — full tool
//    access, no server needed. For scripts, CI, one-shot automation.
//  - remote (Mochi.connect): POSTs to the daemon's /api/* endpoints. Shares
//    workspace state, cron, and the SSE stream with the running daemon.
import { Runtime } from './runtime.js';
import { SessionStore } from './state/session-store.js';
import { addFact, recallFacts } from './memory/memory-store.js';
import { loadAllSkills, searchSkills } from './skills/skills.js';
import { addMcpServerConfig } from './tools/mcp-manage.js';
import type { MochiConfig, MochiEvent } from './types.js';

export interface RunResult {
  summary: string;
  status: string;
  success: boolean;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  filesModified: string[];
}

export interface GoalResultSdk {
  goalId: string;
  status: string;
  summary: string;
  tasks: Array<{ title: string; status: string }>;
}

export class Mochi {
  private constructor(private rt: Runtime) {}

  /** In-process SDK: construct a Runtime and wrap it. */
  static create(opts: { cwd?: string; config?: Partial<MochiConfig> } = {}): Mochi {
    return new Mochi(Runtime.create({ cwd: opts.cwd, config: opts.config }));
  }

  /** Remote mode: attach to a running daemon. */
  static connect(opts: { port: number; token?: string }): RemoteMochi {
    return new RemoteMochi(opts.port, opts.token ?? '');
  }

  /** One-shot prompt → full agent run → structured result. */
  async prompt(task: string): Promise<RunResult> {
    const r = await this.rt.runPromptDetailed(task);
    return {
      summary: r.summary, status: r.status, success: r.success,
      tokensUsed: r.tokensUsed, costUsd: r.costUsd, durationMs: r.durationMs,
      filesModified: r.filesModified,
    };
  }

  /** Alias of prompt() — reads as an instruction. */
  async run(task: string): Promise<RunResult> { return this.prompt(task); }

  /** Streaming prompt: yields every runtime event live, then RETURNS the
   *  final RunResult (use `for await` for progress + capture the return for
   *  the outcome). Subscription is eager (no lost early events) and bounded
   *  (500-event backlog cap); the subscription always closes on settle.
   *  Example:
   *  ```
   *  const gen = mochi.promptStream('fix the bug');
   *  let result: RunResult | undefined;
   *  while (true) {
   *    const n = await gen.next();
   *    if (n.done) { result = n.value; break; }
   *    console.log(n.value.type);
   *  }
   *  ``` */
  async *promptStream(task: string): AsyncGenerator<MochiEvent, RunResult, void> {
    const SENTINEL = Symbol('mochi-prompt-settled');
    type Item = MochiEvent | typeof SENTINEL;
    const backlog: Item[] = [];
    const waiters: Array<(item: Item) => void> = [];
    const push = (item: Item) => {
      const w = waiters.shift();
      if (w) w(item);
      else {
        backlog.push(item);
        if (backlog.length > 500) backlog.shift();
      }
    };
    const off = this.onAny((e) => push(e));
    const doneP = this.prompt(task).then(
      (r) => { push(SENTINEL); return r; },
      (e) => { push(SENTINEL); throw e; },
    );
    void doneP.catch(() => { /* surfaced via return-await below */ });
    try {
      for (;;) {
        while (backlog.length > 0) {
          const item = backlog.shift() as Item;
          if (item === SENTINEL) {
            return await doneP;
          }
          yield item as MochiEvent;
        }
        const item = await new Promise<Item>((resolve) => waiters.push(resolve));
        if (item === SENTINEL) {
          // Drain stragglers that arrived with the settle signal, then return.
          while (backlog.length > 0) {
            const tail = backlog.shift() as Item;
            if (tail === SENTINEL) break;
            yield tail as MochiEvent;
          }
          return await doneP;
        }
        yield item as MochiEvent;
      }
    } finally {
      off();
    }
  }

  /** Structured multi-step objective (task DAG + verifier + self-review). */
  async goal(objective: string, constraints: string[] = []): Promise<GoalResultSdk> {
    const r = await this.rt.runGoal(objective, constraints);
    return {
      goalId: r.goalId, status: r.status, summary: r.summary,
      tasks: r.tasks.map((t) => ({ title: t.title, status: t.status })),
    };
  }

  /** Plan without executing. */
  async plan(objective: string): Promise<string> { return this.rt.plan(objective); }

  /** Self-improvement cycles → report text. */
  async selfTrain(opts: { cycles?: number; focus?: string } = {}): Promise<string> {
    const r = await this.rt.selfTrain(opts);
    return r.report;
  }

  /** Switch provider/model at runtime (same semantics as /model). */
  async useProvider(providerId: string, model?: string): Promise<string> {
    return this.rt.useProvider(providerId, model);
  }

  /** Session operations. */
  newSession(): string { return this.rt.newSession(); }
  branchSession(title?: string): string { return this.rt.branchSession(title); }

  /** Session recall: recent past sessions (titles + objectives). */
  sessions(limit = 10): Array<{ id: string; objective: string; updated: number }> {
    const store = new SessionStore(this.rt.cwd);
    try {
      return store.list(limit).map((s) => ({ id: s.id, objective: s.objective, updated: s.updatedAt }));
    } finally {
      // Windows locks an open SQLite file — release it or the workspace dir
      // can never be deleted while this process lives.
      try { store.close(); } catch { /* best-effort */ }
    }
  }

  /** Skill discovery over every loaded skill (local + user + bundled). */
  searchSkills(query: string, limit = 8): Array<{ name: string; description: string; score: number }> {
    const { skills } = loadAllSkills(this.rt.cwd);
    return searchSkills(skills, query, { limit }).map((h) => ({
      name: h.skill.name,
      description: h.skill.description,
      score: Math.round(h.score * 100) / 100,
    }));
  }

  /** One-command MCP install into <cwd>/.mcp.json (merge-only, never
   *  clobbers; restart the session so the client picks it up). */
  addMcpServer(serverId: string): { ok: boolean; message: string } {
    const r = addMcpServerConfig(this.rt.cwd, serverId);
    return { ok: r.ok, message: r.message };
  }

  /** Persist a durable memory fact (MCH-42 store: dedup + scoring). */
  remember(statement: string, category: 'fact' | 'preference' | 'convention' | 'history' = 'fact'): boolean {
    return addFact(statement, category) !== null;
  }

  /** Semantic recall of relevant memory facts for a context. */
  recall(context: string, limit = 15): Array<{ statement: string; category: string }> {
    return recallFacts(context, limit).map((f) => ({ statement: f.statement, category: f.category }));
  }

  /** Raw Runtime escape hatch for anything the typed surface lacks. */
  get runtime(): Runtime { return this.rt; }

  /** Release process-owned resources (session/SQLite handles via the
   *  runtime). Call before deleting a workspace dir on Windows, where an
   *  open SQLite handle keeps an exclusive lock. Idempotent, best-effort. */
  close(): void {
    try { this.rt.close(); } catch { /* best-effort */ }
  }

  // ── MCH-68: typed event stream ──────────────────────────────────────────
  /** Subscribe to a specific typed event on the runtime EventBus. Returns an unsubscribe fn. */
  on<T extends MochiEvent['type']>(type: T, handler: (event: Extract<MochiEvent, { type: T }>) => void | Promise<void>): () => void {
    this.rt.events.on(type, handler);
    return () => this.rt.events.off(type, handler);
  }

  /** Subscribe to every event (wildcard). Returns an unsubscribe fn. */
  onAny(handler: (event: MochiEvent) => void | Promise<void>): () => void {
    return this.rt.events.onAll(handler);
  }

  /** Async iterator over all runtime events — `for await (const e of mochi.stream())`. */
  stream(): AsyncIterable<MochiEvent> & { close(): void } {
    const self = this;
    type Resolve = (e: MochiEvent) => void;
    const queue: MochiEvent[] = [];
    const waiters: Resolve[] = [];
    let closed = false;
    let unsubscribe: (() => void) | null = null;
    const push = (e: MochiEvent) => {
      const w = waiters.shift();
      if (w) w(e);
      else queue.push(e);
    };
    const ensureSub = () => {
      if (!unsubscribe) unsubscribe = self.onAny(push);
    };
    const close = () => {
      closed = true;
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    };
    const iterator = {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<MochiEvent>> {
            if (closed) return Promise.resolve({ value: undefined as unknown as MochiEvent, done: true });
            if (queue.length) return Promise.resolve({ value: queue.shift() as MochiEvent, done: false });
            ensureSub();
            return new Promise<IteratorResult<MochiEvent>>((resolve) => {
              waiters.push((e) => resolve({ value: e, done: false }));
            });
          },
          return(): Promise<IteratorResult<MochiEvent>> {
            close();
            return Promise.resolve({ value: undefined as unknown as MochiEvent, done: true });
          },
        };
      },
    };
    return Object.assign(iterator, { close });
  }
}

/** Thin typed client over the daemon's HTTP API. */
export class RemoteMochi {
  constructor(private port: number, private token: string) {}

  private base(): string { return `http://127.0.0.1:${this.port}`; }
  private headers(): Record<string, string> {
    return { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) };
  }

  private async post(path: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.base()}${path}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    return res.json() as Promise<Record<string, unknown>>;
  }

  /** Daemon status (POST: the daemon rejects GET on authenticated routes). */
  async status(): Promise<Record<string, unknown>> {
    return this.post('/api/status', {});
  }

  /** Unauthenticated health probe (version + uptime, no token needed). */
  async health(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.base()}/api/health`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  /** Provider + model inventory. */
  async models(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.base()}/api/models`, { headers: this.headers() });
    return res.json() as Promise<Record<string, unknown>>;
  }

  /** Skill names + descriptions. */
  async skills(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.base()}/api/skills`, { headers: this.headers() });
    return res.json() as Promise<Record<string, unknown>>;
  }

  /** Review a diff (defaults to the server's `git diff HEAD` when omitted). */
  async review(diff?: string): Promise<Record<string, unknown>> {
    return this.post('/api/review', diff ? { diff } : {});
  }

  /** Run the server repo's checks (test/build/typecheck/lint + file target). */
  async verify(command?: string, target?: string): Promise<Record<string, unknown>> {
    return this.post('/api/verify', { ...(command ? { command } : {}), ...(target ? { target } : {}) });
  }

  /** Streaming goal execution over the daemon's SSE channel. Yields live
   *  events (task:started, task:completed, log) and RETURNS the terminal
   *  payload ({ok, out} on done, {ok:false, error} on error or cutoff).
   *  Never retries: a goal must not execute twice. */
  async *goalStream(objective: string, opts: { signal?: AbortSignal } = {}): AsyncGenerator<{ event: string; data: unknown }, Record<string, unknown>, void> {
    const res = await fetch(`${this.base()}/api/goal`, {
      method: 'POST',
      headers: { ...this.headers(), accept: 'text/event-stream' },
      body: JSON.stringify({ objective }),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      return { ok: false, error: `goal stream failed: HTTP ${res.status}` };
    }
    // Structural reader (same shape as model/sse.ts: independent of undici's
    // overloaded getReader() typings).
    const reader = (res.body.getReader() as unknown as {
      read(): Promise<{ done: boolean; value?: Uint8Array }>;
      cancel(): Promise<void>;
    });
    const decoder = new TextDecoder();
    let buf = '';
    let final: Record<string, unknown> = { ok: false, error: 'stream cut off before done' };
    try {
      for (;;) {
        if (opts.signal?.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const chunk of parts) {
          const ev = (/^event:\s*(.+)$/m.exec(chunk)?.[1] ?? 'message').trim();
          const dataRaw = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
          let data: unknown = dataRaw;
          try { data = JSON.parse(dataRaw); } catch { /* keep raw text */ }
          if (ev === 'done' || ev === 'error') {
            final = (typeof data === 'object' && data !== null ? data : { ok: false, error: String(data) }) as Record<string, unknown>;
          } else {
            yield { event: ev, data };
          }
        }
      }
    } finally {
      try { await reader.cancel(); } catch { /* already closed */ }
    }
    return final;
  }

  /** One-shot prompt against the daemon (same semantics as local prompt()). */
  async prompt(task: string): Promise<RunResult> {
    const r = await this.post('/api/prompt', { task });
    return {
      summary: String(r.summary ?? ''),
      status: String(r.status ?? 'unknown'),
      success: !!r.success,
      tokensUsed: Number(r.tokensUsed ?? 0),
      costUsd: Number(r.costUsd ?? 0),
      durationMs: Number(r.durationMs ?? 0),
      filesModified: Array.isArray(r.filesModified) ? (r.filesModified as string[]) : [],
    };
  }

  /** Typed convenience over status(). */
  async statusTyped(): Promise<{ ready: boolean; tasks: number; activeAgents: number }> {
    const s = await this.status();
    return { ready: !!s.ready, tasks: Number(s.tasks ?? 0), activeAgents: Number(s.activeAgents ?? 0) };
  }

  async goal(objective: string): Promise<Record<string, unknown>> { return this.post('/api/goal', { objective }); }
  async plan(objective: string): Promise<Record<string, unknown>> { return this.post('/api/plan', { objective }); }
  async approve(): Promise<Record<string, unknown>> { return this.post('/api/approve', {}); }
  async resume(goalId: string): Promise<Record<string, unknown>> { return this.post('/api/resume', { goalId }); }
}