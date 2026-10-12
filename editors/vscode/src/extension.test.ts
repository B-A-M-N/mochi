/**
 * Pure unit tests for editors/vscode helpers.
 *
 * There is no `vscode` module outside the extension host, so this file never
 * statically imports `vscode`. Instead it installs a dynamic
 * `Module._load` guard that returns a lightweight mock whenever
 * `./extension` (which does `require('vscode')` at runtime) is loaded.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Module from 'node:module';
import { createRequire } from 'node:module';

// ── vscode mock (dynamic import guard) ──────────────────────────────────────
interface MockEditor {
  selection: { isEmpty: boolean; active: { line: number } };
  document: { getText: (sel?: unknown) => string; uri: { fsPath: string } };
}

const mockState: { editor: MockEditor | undefined; selectionText: string } = {
  editor: undefined,
  selectionText: '',
};

const mockVscode = {
  workspace: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getConfiguration: (_section?: string) => ({
      get: (_key: string, fallback: unknown) => fallback,
    }),
    asRelativePath: (uri: unknown): string => {
      if (typeof uri === 'string') return uri;
      const fsPath =
        (uri as { fsPath?: string } | undefined)?.fsPath ?? String(uri);
      const parts = fsPath.split('/');
      return parts.slice(-2).join('/');
    },
    workspaceFolders: [],
    isTrusted: true,
  },
  window: {
    get activeTextEditor(): MockEditor | undefined {
      return mockState.editor;
    },
  },
};

function setEditor(opts: {
  text: string;
  isEmpty?: boolean;
  line?: number;
  fsPath?: string;
}): void {
  mockState.selectionText = opts.text;
  mockState.editor = {
    selection: {
      isEmpty: opts.isEmpty ?? false,
      active: { line: opts.line ?? 41 },
    },
    document: {
      getText: () => mockState.selectionText,
      uri: { fsPath: opts.fsPath ?? '/ws/src/file.ts' },
    },
  };
}

// Install the guard before loading ./extension.
const modAny = Module as unknown as {
  _load: (request: string, ...rest: unknown[]) => unknown;
};
const originalLoad = modAny._load.bind(Module);
modAny._load = function (request: string, ...rest: unknown[]): unknown {
  if (request === 'vscode') return mockVscode;
  return originalLoad(request, ...rest);
};

const req = createRequire(__filename);
// Type-only import keeps tsc aware of the real signatures; the runtime load
// goes through the guarded require above.
const ext = req('./extension') as typeof import('./extension');

// ── tests ───────────────────────────────────────────────────────────────────

describe('missingBinaryMessage formatting', () => {
  it('names the binary and points at install + binaryPath + retry', () => {
    const msg = ext.missingBinaryMessage('/usr/local/bin/mochi');
    assert.ok(
      msg.includes('"/usr/local/bin/mochi"'),
      `binary quoted, got: ${msg}`,
    );
    assert.ok(msg.includes('npm i -g @mochi/agent'));
    assert.ok(msg.includes('mochi.binaryPath'));
    assert.ok(msg.includes('Mochi: New Session'));
  });

  it('quotes a bare PATH lookup name too', () => {
    const msg = ext.missingBinaryMessage('mochi');
    assert.ok(msg.includes('"mochi"'));
  });
});

describe('RpcMessage routing for string+number ids', () => {
  it('rpcKey keeps numeric and string ids distinct', () => {
    assert.equal(ext.rpcKey(1), 'number:1');
    assert.equal(ext.rpcKey('1'), 'string:1');
    assert.notEqual(ext.rpcKey(1), ext.rpcKey('1'));
    assert.equal(ext.rpcKey(0), 'number:0');
    assert.equal(ext.rpcKey('abc'), 'string:abc');
  });

  function makeClient(): {
    client: Record<string, unknown>;
    pending: Map<
      string,
      {
        resolve: (v: unknown) => void;
        reject: (e: Error) => void;
        timer: NodeJS.Timeout;
        method: string;
      }
    >;
  } {
    const proto = (
      ext as unknown as { AcpClient: { prototype: object } }
    ).AcpClient.prototype;
    const client = Object.create(proto) as Record<string, unknown>;
    const pending = new Map();
    client['pending'] = pending;
    client['onNotification'] = () => undefined;
    return { client, pending };
  }

  function route(client: Record<string, unknown>, msg: unknown): void {
    const fn = (client as unknown as { route: (m: unknown) => void }).route;
    fn.call(client, msg);
  }

  it('routes numeric-id responses without touching string-id pendings', async () => {
    const { client, pending } = makeClient();
    let numResult: unknown;
    let strResult: unknown;
    const t1 = setTimeout(() => undefined, 10_000);
    const t2 = setTimeout(() => undefined, 10_000);
    // Unref so a failed assertion never holds the runner open for 10s.
    (t1 as unknown as { unref?: () => void }).unref?.();
    (t2 as unknown as { unref?: () => void }).unref?.();
    pending.set(ext.rpcKey(1), {
      resolve: (v: unknown) => {
        numResult = v;
      },
      reject: () => assert.fail('numeric entry must not reject'),
      timer: t1,
      method: 'session/prompt',
    });
    pending.set(ext.rpcKey('1'), {
      resolve: (v: unknown) => {
        strResult = v;
      },
      reject: () => assert.fail('string entry must not reject yet'),
      timer: t2,
      method: 'session/prompt',
    });

    try {
      route(client, { jsonrpc: '2.0', id: 1, result: { ok: 'num' } });
      assert.deepEqual(numResult, { ok: 'num' });
      assert.equal(strResult, undefined);
      assert.equal(pending.has(ext.rpcKey(1)), false);
      assert.equal(pending.has(ext.rpcKey('1')), true);

      route(client, { jsonrpc: '2.0', id: '1', result: { ok: 'str' } });
      assert.deepEqual(strResult, { ok: 'str' });
      assert.equal(pending.size, 0);
    } finally {
      for (const entry of pending.values()) clearTimeout(entry.timer);
      clearTimeout(t1);
      clearTimeout(t2);
    }
  });

  it('routes string ids and surfaces ACP errors', async () => {
    const { client, pending } = makeClient();
    let capturedErr: Error | undefined;
    const t = setTimeout(() => undefined, 10_000);
    (t as unknown as { unref?: () => void }).unref?.();
    pending.set(ext.rpcKey('sess-9'), {
      resolve: () => assert.fail('error response must reject'),
      reject: (e: Error) => {
        capturedErr = e;
      },
      timer: t,
      method: 'session/new',
    });
    try {
      route(client, {
        jsonrpc: '2.0',
        id: 'sess-9',
        error: { code: -32600, message: 'bad request' },
      });
      assert.ok(capturedErr instanceof Error);
      assert.ok(capturedErr.message.includes('ACP error -32600'));
      assert.ok(capturedErr.message.includes('bad request'));
    } finally {
      clearTimeout(t);
    }
  });

  it('ignores null/unknown ids and forwards session/update notifications', () => {
    const { client, pending } = makeClient();
    let notified: { sid: string; update: unknown } | undefined;
    client['onNotification'] = (sid: string, update: unknown) => {
      notified = { sid, update };
    };
    // Must not throw.
    route(client, { jsonrpc: '2.0', id: null, result: 1 });
    route(client, { jsonrpc: '2.0', id: 9999, result: 1 });
    assert.equal(pending.size, 0);
    route(client, {
      jsonrpc: '2.0',
      method: 'session/update',
      params: {
        sessionId: 's1',
        update: { sessionUpdate: 'agent_message_chunk' },
      },
    });
    assert.deepEqual(notified, {
      sid: 's1',
      update: { sessionUpdate: 'agent_message_chunk' },
    });
  });
});

describe('timeout error text', () => {
  it('acpTimeoutMessage formats method + ms + Output hint', () => {
    assert.equal(
      ext.acpTimeoutMessage('session/prompt', 600_000),
      'ACP request "session/prompt" timed out after 600000ms (server silent — see Output > Mochi)',
    );
    assert.equal(
      ext.acpTimeoutMessage('initialize', 30_000),
      'ACP request "initialize" timed out after 30000ms (server silent — see Output > Mochi)',
    );
  });

  it('request() rejects with the timeout text when the server is silent', async () => {
    const proto = (
      ext as unknown as { AcpClient: { prototype: object } }
    ).AcpClient.prototype;
    const client = Object.create(proto) as Record<string, unknown>;
    client['pending'] = new Map();
    client['stdoutBuffer'] = '';
    client['disposed'] = false;
    client['requestId'] = 0;
    // Silent server: accept bytes, never reply.
    client['proc'] = {
      stdin: { write: () => true },
      kill: () => undefined,
    };
    const request = (
      client as unknown as {
        request: (
          method: string,
          params?: Record<string, unknown>,
          timeoutMs?: number,
        ) => Promise<unknown>;
      }
    ).request.bind(client);
    // request() unrefs its timer so a hung server never keeps the extension
    // host alive; keep a ref'd handle here so the test loop stays alive long
    // enough for the unref'd 20ms timer to fire.
    const keepAlive = setTimeout(() => undefined, 500);
    try {
      await assert.rejects(request('session/prompt', { x: 1 }, 20), (err) => {
        assert.ok(err instanceof Error);
        assert.equal(
          (err as Error).message,
          ext.acpTimeoutMessage('session/prompt', 20),
        );
        return true;
      });
    } finally {
      clearTimeout(keepAlive);
    }
  });
});

describe('escapeHtml correctness', () => {
  it('escapes &, <, >', () => {
    assert.equal(ext.escapeHtml('a&b'), 'a&amp;b');
    assert.equal(ext.escapeHtml('<div>'), '&lt;div&gt;');
    assert.equal(
      ext.escapeHtml('<a href="x&y">'),
      '&lt;a href="x&amp;y"&gt;',
    );
  });

  it('leaves plain text and quotes untouched', () => {
    assert.equal(ext.escapeHtml('hello world'), 'hello world');
    assert.equal(ext.escapeHtml(''), '');
    assert.equal(ext.escapeHtml('"quotes" \'single\''), '"quotes" \'single\'');
  });

  it('escapes in order (no double-escaping of &lt;)', () => {
    // & first, then < > — the & in &lt; must not be re-escaped.
    assert.equal(ext.escapeHtml('&<>'), '&amp;&lt;&gt;');
  });
});

describe('selectionContext truncation', () => {
  it('returns empty string with no editor or empty selection', () => {
    mockState.editor = undefined;
    assert.equal(ext.selectionContext(), '');
    setEditor({ text: 'code', isEmpty: true });
    assert.equal(ext.selectionContext(), '');
  });

  it('truncates selections longer than maxChars (default 4000)', () => {
    setEditor({ text: 'A'.repeat(4000) + 'B'.repeat(1000) });
    const ctx = ext.selectionContext();
    assert.ok(ctx.includes('Selected code from'));
    assert.ok(ctx.includes('```'));
    const code = ctx.split('```')[1] ?? '';
    // code block is "\n<selection>\n"
    const inner = code.replace(/^\n+|\n+$/g, '');
    assert.equal(inner.length, 4000);
    assert.ok(!inner.includes('B'), 'tail beyond 4000 must be cut');
    assert.ok(inner.includes('A'));
  });

  it('honours a custom maxChars and reports file:line', () => {
    setEditor({
      text: '0123456789ABCDEFGHIJ',
      line: 9,
      fsPath: '/ws/proj/app.ts',
    });
    const ctx = ext.selectionContext(10);
    assert.ok(ctx.includes('proj/app.ts:10'), `header has rel:line, got: ${ctx}`);
    const code = ctx.split('```')[1] ?? '';
    assert.equal(code.replace(/^\n+|\n+$/g, ''), '0123456789');
  });
});
