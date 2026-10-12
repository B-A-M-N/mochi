import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';

// Minimal Model Context Protocol (MCP) stdio client. MCP is the standard cline
// / jcode / pi use to connect external tool + memory servers. A server is a
// spawned subprocess speaking JSON-RPC 2.0 over newline-delimited JSON on
// stdin/stdout. This client:
//   - runs `initialize` + `notifications/initialized` handshake
//   - lists tools via `tools/list`
//   - invokes tools via `tools/call`, returning their text content
//   - never parses provider/model data; it's pure transport
// It intentionally has no server binary; tests use a tiny node server written
// inline so the whole flow is verified without any external dependency.

export interface McpServerConfig {
  /** Subprocess to spawn for stdio transport. Required unless `url` is set. */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** Lowercase protocol version accepted; default "2024-11-05". */
  version?: string;
  /** Streamable-HTTP endpoint. When set, the client uses HTTP POST (with SSE
   *  response parsing) instead of spawning a stdio subprocess. */
  url?: string;
  /** Extra headers for HTTP transport (e.g. Authorization). */
  headers?: Record<string, string>;
}

export interface McpToolInput {
  name: string;
  description?: string;
  inputSchema?: { type?: string; properties?: Record<string, unknown>; required?: string[] };
}

export interface McpResourceInput {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface McpPromptInput {
  name: string;
  description?: string;
  arguments?: { name: string; description?: string; required?: boolean }[];
}

export interface McpPromptMessage {
  role?: string;
  content?: { type?: string; text?: string };
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

/** Transport seam: newline-delimited JSON-RPC frames out, parsed lines back.
 *  stdio (subprocess) and Streamable-HTTP share the exact framing contract,
 *  so McpClient never knows which one it talks to. */
export interface McpTransport {
  /** Send one JSON-RPC frame (request with id, or id-less notification). */
  send(frame: string): void;
  onMessage(cb: (line: string) => void): void;
  onFatal(cb: (err: Error) => void): void;
  close(): void;
}

/** Subprocess transport: `command args…` speaking JSON-RPC over stdio. */
export class StdioTransport implements McpTransport {
  private child: ChildProcessWithoutNullStreams;
  private rl: ReadlineInterface;
  private msgCb: (line: string) => void = () => {};
  private fatalCb: (err: Error) => void = () => {};

  constructor(config: McpServerConfig, label = 'mcp') {
    if (!config.command) {
      throw new Error(`mcp:${label} stdio transport needs config.command (or use url for HTTP)`);
    }
    this.child = spawn(config.command, config.args ?? [], {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.rl = createInterface({ input: this.child.stdout });
    this.rl.on('line', (line: string) => this.msgCb(line));
    // Drain + surface server stderr without breaking the request/reply framing.
    this.child.stderr.on('data', (d: Buffer) => {
      const s = String(d).trim();
      if (s) console.warn(`[mcp:${label}] ${s.slice(0, 200)}`);
    });
    this.child.on('error', (err) => this.fatalCb(new Error(`mcp:${label} spawn failed: ${err.message}`)));
    // A server that starts and then dies (bad script, crash) never emits
    // 'error'; without this hook its pending requests would hang forever.
    this.child.on('exit', (code, signal) => {
      this.fatalCb(new Error(`mcp:${label} server exited (code=${code ?? 'null'} signal=${signal ?? 'none'}) before responding`));
    });
  }

  send(frame: string): void {
    this.child.stdin.write(frame + '\n');
  }

  onMessage(cb: (line: string) => void): void {
    this.msgCb = cb;
  }

  onFatal(cb: (err: Error) => void): void {
    this.fatalCb = cb;
  }

  close(): void {
    try {
      this.child.kill();
    } catch {
      /* already closed */
    }
  }
}

/** Streamable-HTTP transport: stateless JSON-RPC POSTs (mirrors the proven
 *  httpChannel semantics in tools/mcp.ts: plain-JSON or SSE responses,
 *  per-request timeouts, best-effort notifications). */
export class HttpTransport implements McpTransport {
  private msgCb: (line: string) => void = () => {};
  private closed = false;

  constructor(
    private url: string,
    private headers: Record<string, string> = {},
    private label: string = 'mcp',
  ) {}

  send(frame: string): void {
    if (this.closed) throw new Error(`mcp:${this.label} transport is closed`);
    let body: { jsonrpc: string; id?: number; method?: string; params?: unknown };
    try {
      body = JSON.parse(frame);
    } catch {
      return; // malformed frame: never send garbage at a server
    }
    const isNotification = body.id === undefined;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15_000);
    void fetch(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-03-26',
        ...this.headers,
      },
      body: frame,
      signal: ctl.signal,
    }).then(async (res) => {
      clearTimeout(timer);
      if (!res.ok) {
        if (!isNotification) this.msgCb(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: `HTTP ${res.status}` } }));
        return;
      }
      const ctype = res.headers.get('content-type') ?? '';
      if (ctype.includes('text/event-stream')) {
        const text = await res.text();
        for (const line of text.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const msg = JSON.parse(payload) as { id?: number };
            if (isNotification || msg.id === body.id) this.msgCb(JSON.stringify(msg));
          } catch { /* skip undecodable events */ }
        }
        return;
      }
      const msg = (await res.json()) as { id?: number };
      if (isNotification || msg.id === body.id) this.msgCb(JSON.stringify(msg));
    }).catch((err) => {
      clearTimeout(timer);
      if (isNotification) return; // notifications are best-effort by contract
      // Stateless transport: a failed POST poisons only its own request, so
      // answer it as a JSON-RPC error frame (never fatalCb — there is no
      // persistent connection whose death should fail every pending call).
      const message = err instanceof Error && err.name === 'AbortError'
        ? 'HTTP request timed out after 15s'
        : err instanceof Error ? err.message : String(err);
      this.msgCb(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message } }));
    });
  }

  onMessage(cb: (line: string) => void): void {
    this.msgCb = cb;
  }

  onFatal(_cb: (err: Error) => void): void {
    // Stateless POSTs have no persistent connection to die; every failure
    // answers its own request as a JSON-RPC error frame (see send/catch).
  }

  close(): void {
    this.closed = true;
  }
}

export class McpClient {
  private transport: McpTransport;
  private requests = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  private initialized = false;
  private label: string;
  private version: string;

  constructor(
    config: McpServerConfig,
    label: string = 'mcp',
    transport?: McpTransport,
  ) {
    this.label = label;
    this.version = config.version ?? '2024-11-05';
    this.transport = transport ?? new StdioTransport(config, label);
    this.transport.onMessage((line) => this.handleLine(line));
    this.transport.onFatal((err) => this.rejectAll(err));
  }

  /** Build a client for either transport: `url` selects Streamable-HTTP,
   *  otherwise a stdio subprocess is spawned. */
  static forConfig(config: McpServerConfig, label: string = 'mcp'): McpClient {
    if (config.url) return new McpClient(config, label, new HttpTransport(config.url, config.headers ?? {}, label));
    return new McpClient(config, label);
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg: JsonRpcResponse;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return; // ignore malformed frames
    }
    if (typeof msg.id === 'number') {
      const pending = this.requests.get(msg.id);
      if (!pending) return;
      this.requests.delete(msg.id);
      if (msg.error) pending.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
      else pending.resolve(msg.result);
    }
  }

  private rejectAll(err: Error): void {
    for (const [, p] of this.requests) p.reject(err);
    this.requests.clear();
  }

  private request(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      // A server that silently ignores a method (not an error response — just
      // no response at all) must not hang the caller forever. Optional
      // capabilities (resources/prompts) are probed, so servers implementing
      // only tools may hit this; the caller treats it as "absent".
      const timer = setTimeout(() => {
        this.requests.delete(id);
        reject(new Error(`mcp:${this.label}: '${method}' timed out after 10s (server may not implement it)`));
      }, 10_000);
      this.requests.set(id, {
        resolve: (r) => { clearTimeout(timer); resolve(r); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      try {
        this.transport.send(body);
      } catch (err) {
        clearTimeout(timer);
        this.requests.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private notify(method: string, params: unknown): void {
    try {
      this.transport.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
    } catch {
      /* ignore notification failures after close */
    }
  }

  async initialize(): Promise<void> {
    // Server info + capabilities negotiation.
    await this.request('initialize', {
      protocolVersion: this.version,
      capabilities: { tools: {} },
      clientInfo: { name: 'mochi', version: '0.1' },
    });
    this.notify('notifications/initialized', {});
    this.initialized = true;
  }

  async listTools(): Promise<McpToolInput[]> {
    if (!this.initialized) await this.initialize();
    const result = (await this.request('tools/list', {})) as { tools?: McpToolInput[] };
    return result?.tools ?? [];
  }

  /** List resources the server exposes (optional capability). Servers that do
   *  not implement resources return an error, which we surface as an empty
   *  list so callers can treat it as "nothing to read". */
  async listResources(): Promise<McpResourceInput[]> {
    if (!this.initialized) await this.initialize();
    const result = (await this.request('resources/list', {})) as { resources?: McpResourceInput[] };
    return result?.resources ?? [];
  }

  /** Read a resource by URI; returns the concatenated text content. */
  async readResource(uri: string): Promise<string> {
    if (!this.initialized) await this.initialize();
    const result = (await this.request('resources/read', { uri })) as {
      contents?: { uri?: string; text?: string }[];
    };
    const parts = (result?.contents ?? []).map((c) => c?.text ?? '').filter(Boolean);
    return parts.join('\n');
  }

  /** List prompts the server exposes (optional capability). Servers that do
   *  not implement prompts return an error, which we surface as an empty
   *  list so callers can treat it as "no prompts". */
  async listPrompts(): Promise<McpPromptInput[]> {
    if (!this.initialized) await this.initialize();
    const result = (await this.request('prompts/list', {})) as { prompts?: McpPromptInput[] };
    return result?.prompts ?? [];
  }

  /** Get a prompt by name; returns its rendered messages. */
  async getPrompt(name: string, args: Record<string, string> = {}): Promise<McpPromptMessage[]> {
    if (!this.initialized) await this.initialize();
    const result = (await this.request('prompts/get', { name, arguments: args })) as {
      messages?: McpPromptMessage[];
    };
    return result?.messages ?? [];
  }

  /** Call a tool; returns the concatenated text content of the result. */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.initialized) await this.initialize();
    const result = (await this.request('tools/call', { name, arguments: args })) as {
      content?: { type?: string; text?: string }[];
      isError?: boolean;
    };
    const parts = (result?.content ?? []).map((c) => c?.text ?? '').filter(Boolean);
    const text = parts.join('\n');
    if (result?.isError) throw new Error(text || `MCP tool ${name} returned an error`);
    return text;
  }

  close(): void {
    try {
      this.transport.close();
    } catch {
      /* already closed */
    }
  }
}

// Helper: turn an MCP input schema into Mochi's ToolParameter list.
export function schemaToParameters(schema?: McpToolInput['inputSchema']): import('../types.js').ToolParameter[] {
  const props = (schema?.properties ?? {}) as Record<string, { type?: string; description?: string }>;
  const required = new Set(schema?.required ?? []);
  const out: import('../types.js').ToolParameter[] = [];
  for (const [name, p] of Object.entries(props)) {
    out.push({
      name,
      type: (['string', 'number', 'integer', 'boolean', 'array'].includes(p?.type ?? '') ? p.type : 'string') as import('../types.js').ToolParameter['type'],
      description: p?.description ?? '',
      required: required.has(name),
    });
  }
  return out;
}