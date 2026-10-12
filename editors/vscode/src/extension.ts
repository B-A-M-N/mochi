import * as vscode from 'vscode';
import { spawn, type ChildProcess } from 'node:child_process';

// Matches ACP_PROTOCOL_VERSION in src/acp.ts.
const ACP_PROTOCOL_VERSION = 1;
const CHAT_VIEW_ID = 'mochi.chat';

export type RpcId = number | string;

export interface RpcError {
  code: number;
  message: string;
}

export interface RpcMessage {
  jsonrpc?: string;
  id?: RpcId | null;
  method?: string;
  params?: {
    sessionId?: string;
    update?: Record<string, unknown>;
  };
  result?: unknown;
  error?: RpcError;
}

interface InitializeResult {
  protocolVersion: number;
  agentCapabilities?: unknown;
  implementation?: {
    name?: string;
    version?: string;
  };
}

interface NewSessionResult {
  sessionId: string;
  modes?: Array<{ id: string }>;
}

interface PromptResult {
  stopReason?: string;
}

export function missingBinaryMessage(binary: string): string {
  return (
    `Mochi binary not found ("${binary}"). ` +
    'Install it with `npm i -g @mochi/agent` or point "mochi.binaryPath" ' +
    'at your local build, then run "Mochi: New Session" again.'
  );
}

function cfg<T>(key: string, fallback: T): T {
  return vscode.workspace.getConfiguration('mochi').get<T>(key, fallback);
}

function configBinaryPath(): string {
  const value = cfg<string>('binaryPath', 'mochi');
  return value && value.trim() !== '' ? value.trim() : 'mochi';
}

function configTimeoutMs(): number {
  const v = cfg<number>('requestTimeoutMs', 600_000);
  if (!Number.isFinite(v) || v < 10_000) return 600_000;
  return Math.min(3_600_000, Math.floor(v));
}

function configMaxHistory(): number {
  const v = cfg<number>('maxSessionHistory', 200);
  if (!Number.isFinite(v) || v < 20) return 200;
  return Math.min(2000, Math.floor(v));
}

function configNotifications(): boolean {
  return cfg<boolean>('showNotifications', true);
}

/** Stable map key that keeps numeric and string JSON-RPC ids distinct. */
export function rpcKey(id: RpcId): string {
  return `${typeof id}:${String(id)}`;
}

/** Timeout text surfaced when the ACP server goes silent mid-request. */
export function acpTimeoutMessage(method: string, timeoutMs: number): string {
  return `ACP request "${method}" timed out after ${timeoutMs}ms (server silent — see Output > Mochi)`;
}

/** Newline-delimited JSON-RPC 2.0 client over `mochi acp` stdio. */
export class AcpClient {
  private requestId = 0;
  private readonly pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (err: Error) => void; timer: NodeJS.Timeout; method: string }
  >();
  private stdoutBuffer = '';
  private disposed = false;

  onNotification: (sessionId: string, update: Record<string, unknown>) => void = () =>
    undefined;
  onStderr: (text: string) => void = () => undefined;
  onExit: (code: number | null, signal: string | null) => void = () => undefined;

  private constructor(private readonly proc: ChildProcess) {
    proc.stdout?.on('data', (chunk: Buffer | string) => {
      this.handleData(chunk.toString('utf8'));
    });
    proc.stderr?.on('data', (chunk: Buffer | string) => {
      this.onStderr(chunk.toString('utf8'));
    });
    proc.on('exit', (code, signal) => {
      const err = new Error(
        `Mochi ACP process exited (code=${code ?? 'null'} signal=${signal ?? 'none'})`,
      );
      for (const entry of this.pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(err);
      }
      this.pending.clear();
      this.onExit(code, signal);
    });
    proc.on('error', (err: Error) => {
      for (const entry of this.pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(err);
      }
      this.pending.clear();
    });
  }

  /** Spawn `mochi acp` (or `node <bundle> acp` for a .js build) in cwd. */
  static async start(binary: string, cwd: string): Promise<AcpClient> {
    const trimmed = binary.trim() === '' ? 'mochi' : binary.trim();
    const proc: ChildProcess = trimmed.endsWith('.js')
      ? spawn(process.execPath, [trimmed, 'acp'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
      : spawn(trimmed, ['acp'], { cwd, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    const client = new AcpClient(proc);
    await new Promise<void>((resolve, reject) => {
      const onSpawn = () => {
        proc.off('error', onError);
        resolve();
      };
      const onError = (err: Error) => {
        proc.off('spawn', onSpawn);
        reject(err);
      };
      proc.once('spawn', onSpawn);
      proc.once('error', onError);
    });
    return client;
  }

  private key(id: RpcId): string {
    return rpcKey(id);
  }

  private handleData(chunk: string): void {
    this.stdoutBuffer += chunk;
    // Guard against a runaway non-newline blob (a model dumping 10MB on one
    // line would otherwise grow the buffer forever).
    if (this.stdoutBuffer.length > 8_388_608) {
      this.stdoutBuffer = this.stdoutBuffer.slice(-4_194_304);
    }
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let msg: RpcMessage;
      try {
        msg = JSON.parse(trimmed) as RpcMessage;
      } catch {
        continue;
      }
      this.route(msg);
    }
  }

  private route(msg: RpcMessage): void {
    if (msg.method === 'session/update') {
      const sid = msg.params?.sessionId;
      const update = msg.params?.update;
      if (typeof sid === 'string' && update && typeof update === 'object') {
        try {
          this.onNotification(sid, update);
        } catch { /* a chat-view throw must never kill the reader */ }
      }
      return;
    }
    if (msg.id !== undefined && msg.id !== null) {
      const entry = this.pending.get(this.key(msg.id));
      if (!entry) return;
      this.pending.delete(this.key(msg.id));
      clearTimeout(entry.timer);
      if (msg.error) entry.reject(new Error(`ACP error ${msg.error.code}: ${msg.error.message}`));
      else entry.resolve(msg.result);
    }
  }

  request<T>(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<T> {
    if (this.disposed) return Promise.reject(new Error('ACP client is disposed'));
    const id: RpcId = ++this.requestId;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} }) + '\n';
    const timeout = timeoutMs ?? configTimeoutMs();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(this.key(id));
        reject(new Error(acpTimeoutMessage(method, timeout)));
      }, timeout);
      // Unref so a hung server never keeps the extension host alive.
      (timer as unknown as { unref?: () => void }).unref?.();
      this.pending.set(this.key(id), {
        resolve: (value: unknown) => resolve(value as T),
        reject,
        timer,
        method,
      });
      try {
        this.proc.stdin?.write(payload, (err?: Error | null) => {
          if (err) {
            const entry = this.pending.get(this.key(id));
            if (entry) {
              clearTimeout(entry.timer);
              this.pending.delete(this.key(id));
            }
            reject(err);
          }
        });
      } catch (err) {
        const entry = this.pending.get(this.key(id));
        if (entry) {
          clearTimeout(entry.timer);
          this.pending.delete(this.key(id));
        }
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /** Spec-compliant notification (no id, no response expected). Used for
   *  session/cancel so a busy server never leaves a cancel hanging. */
  notify(method: string, params?: Record<string, unknown>): void {
    try {
      this.proc.stdin?.write(JSON.stringify({ jsonrpc: '2.0', method, params: params ?? {} }) + '\n');
    } catch { /* fire-and-forget */ }
  }

  async initialize(): Promise<InitializeResult> {
    const hello = await this.request<InitializeResult>('initialize', {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: { embeddedContext: true },
    }, 30_000);
    if (hello.protocolVersion !== ACP_PROTOCOL_VERSION) {
      throw new Error(
        `ACP protocol mismatch: server speaks v${hello.protocolVersion}, extension speaks v${ACP_PROTOCOL_VERSION}. Update mochi (` +
        '`npm i -g @mochi/agent@latest`) or the extension to matching versions.',
      );
    }
    return hello;
  }

  newSession(cwd: string, additionalDirectories?: string[]): Promise<NewSessionResult> {
    return this.request<NewSessionResult>('session/new', {
      cwd,
      ...(additionalDirectories?.length ? { additionalDirectories } : {}),
    }, 30_000);
  }

  prompt(sessionId: string, text: string): Promise<PromptResult> {
    return this.request<PromptResult>('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text }],
    });
  }

  setMode(sessionId: string, modeId: string): Promise<{ modeId: string }> {
    return this.request<{ modeId: string }>('session/set_mode', { sessionId, modeId }, 15_000);
  }

  cancel(sessionId: string): void {
    this.notify('session/cancel', { sessionId });
  }

  close(sessionId: string): Promise<unknown> {
    return this.request<unknown>('session/close', { sessionId }, 15_000);
  }

  async shutdown(): Promise<void> {
    this.disposed = true;
    try {
      await this.request<null>('shutdown', {}, 5_000);
    } catch {
      // Exiting anyway; the exit handler rejects anything outstanding.
    }
    this.dispose();
  }

  dispose(): void {
    this.disposed = true;
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('ACP client disposed'));
    }
    this.pending.clear();
    try {
      this.proc.kill();
    } catch { /* already gone */ }
  }
}

type ChatRole = 'user' | 'assistant' | 'system';

interface ChatMessage {
  role: ChatRole;
  text: string;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

class MochiChatProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private transcript: ChatMessage[] = [];

  onSendPrompt: (text: string) => void = () => undefined;
  onNewSession: () => void = () => undefined;
  onCancel: () => void = () => undefined;
  onToggleMode: () => void = () => undefined;

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.renderHtml();
    view.webview.onDidReceiveMessage((msg: unknown) => {
      if (typeof msg !== 'object' || msg === null) return;
      const envelope = msg as { command?: unknown; text?: unknown };
      if (envelope.command === 'prompt' && typeof envelope.text === 'string') {
        this.onSendPrompt(envelope.text);
      } else if (envelope.command === 'newSession') {
        this.onNewSession();
      } else if (envelope.command === 'cancel') {
        this.onCancel();
      } else if (envelope.command === 'toggleMode') {
        this.onToggleMode();
      }
    });
    for (const entry of this.transcript) {
      this.post({ command: 'addMessage', role: entry.role, text: entry.text });
    }
  }

  push(message: ChatMessage): void {
    this.transcript.push(message);
    this.trim();
    this.post({ command: 'addMessage', role: message.role, text: message.text });
  }

  appendAssistantChunk(text: string): void {
    const last = this.transcript[this.transcript.length - 1];
    if (last && last.role === 'assistant') last.text += text;
    else {
      this.transcript.push({ role: 'assistant', text });
      this.trim();
    }
    this.post({ command: 'appendChunk', text });
  }

  setModeBadge(mode: string): void {
    this.post({ command: 'setMode', mode });
  }

  private trim(): void {
    const max = configMaxHistory();
    if (this.transcript.length > max) {
      this.transcript.splice(0, this.transcript.length - max);
    }
  }

  private post(message: Record<string, unknown>): void {
    void this.view?.webview.postMessage(message);
  }

  private renderHtml(): string {
    const nonce = Math.random().toString(36).slice(2);
    return (
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; ' +
      'style-src \'unsafe-inline\'; script-src \'nonce-' +
      nonce +
      '\';">' +
      '<style>' +
      'body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);' +
      'color:var(--vscode-foreground);padding:8px;margin:0;}' +
      '#toolbar{display:flex;gap:6px;margin-bottom:8px;align-items:center;}' +
      'button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);' +
      'border:none;padding:4px 10px;cursor:pointer;border-radius:2px;}' +
      'button.secondary{background:var(--vscode-button-secondaryBackground);' +
      'color:var(--vscode-button-secondaryForeground);}' +
      '#mode{margin-left:auto;font-size:11px;color:var(--vscode-descriptionForeground);}' +
      '#messages{display:flex;flex-direction:column;gap:8px;margin-bottom:8px;}' +
      '.msg{padding:6px 8px;border-radius:4px;word-break:break-word;}' +
      '.msg pre{background:var(--vscode-textCodeBlock-background);padding:6px;overflow:auto;border-radius:4px;}' +
      '.msg code{font-family:var(--vscode-editor-font-family);font-size:12px;}' +
      '.user{background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);white-space:pre-wrap;}' +
      '.assistant{background:var(--vscode-editor-background);' +
      'border:1px solid var(--vscode-panel-border);}' +
      '.system{color:var(--vscode-descriptionForeground);font-style:italic;white-space:pre-wrap;}' +
      '#composer{display:flex;gap:6px;}' +
      '#input{flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);' +
      'border:1px solid var(--vscode-input-border);padding:6px;font:inherit;resize:vertical;}' +
      '</style></head><body>' +
      '<div id="toolbar"><button id="newBtn" class="secondary">New session</button>' +
      '<button id="cancelBtn" class="secondary">Cancel</button>' +
      '<button id="modeBtn" class="secondary">Plan/Act</button>' +
      '<span id="mode">act</span></div>' +
      '<div id="messages"></div>' +
      '<div id="composer"><textarea id="input" rows="3" placeholder="Ask Mochi… (Ctrl+Enter to send)"></textarea>' +
      '<button id="sendBtn">Send</button></div>' +
      '<script nonce="' +
      nonce +
      '">' +
      '(function(){' +
      'var api=acquireVsCodeApi();' +
      'var messages=document.getElementById("messages");' +
      'var input=document.getElementById("input");' +
      'var modeEl=document.getElementById("mode");' +
      'function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}' +
      'function md(s){' +
      'var e=esc(s);' +
      // fenced code blocks first (protected from inline passes)
      'e=e.replace(/```([\\s\\S]*?)```/g,function(m,code){return "<pre><code>"+code.replace(/^\\n+|\\n+$/g,"")+"</code></pre>";});' +
      'e=e.replace(/`([^`\\n]+)`/g,"<code>$1</code>");' +
      'e=e.replace(/\\*\\*([^\\*\\n]+)\\*\\*/g,"<b>$1</b>");' +
      'return e.replace(/\\n/g,"<br>");}' +
      'function addMessage(role,text){' +
      'var div=document.createElement("div");' +
      'div.className="msg "+role;' +
      'if(role==="assistant"){div.innerHTML=md(text);}' +
      'else{div.textContent=text;}' +
      'messages.appendChild(div);div.scrollIntoView(false);}' +
      'function appendChunk(text){' +
      'var last=messages.lastElementChild;' +
      // chunks arrive as raw text; re-render the accumulated plain text is
      // expensive, so append escaped HTML and convert newlines only.
      'if(last&&last.classList.contains("assistant")){var span=document.createElement("span");span.textContent=text;last.appendChild(span);}' +
      'else{addMessage("assistant",text);}' +
      'window.scrollTo(0,document.body.scrollHeight);}' +
      'window.addEventListener("message",function(event){' +
      'var msg=event.data||{};' +
      'if(msg.command==="addMessage"){addMessage(msg.role||"assistant",String(msg.text||""));}' +
      'else if(msg.command==="appendChunk"){appendChunk(String(msg.text||""));}' +
      'else if(msg.command==="setMode"&&modeEl){modeEl.textContent=String(msg.mode||"act");}' +
      '});' +
      'function send(){var text=input.value;if(!text.trim()){return;}' +
      'input.value="";api.postMessage({command:"prompt",text:text});}' +
      'document.getElementById("sendBtn").addEventListener("click",send);' +
      'document.getElementById("newBtn").addEventListener("click",function(){' +
      'api.postMessage({command:"newSession"});});' +
      'document.getElementById("cancelBtn").addEventListener("click",function(){' +
      'api.postMessage({command:"cancel"});});' +
      'document.getElementById("modeBtn").addEventListener("click",function(){' +
      'api.postMessage({command:"toggleMode"});});' +
      'input.addEventListener("keydown",function(e){' +
      'if((e.key==="Enter")&&(e.metaKey||e.ctrlKey)){e.preventDefault();send();}});' +
      '})();' +
      '</script></body></html>'
    );
  }
}

let client: AcpClient | undefined;
let sessionId: string | undefined;
let sessionMode: 'plan' | 'act' = 'act';
let agentVersion = 'unknown';
let running = false;
/** Files the agent reported editing in the current session (capped).
 *  Powers "Show diff" after a run — the apply-diff view for reviewers. */
const lastEdited: string[] = [];
let mochiTerminal: vscode.Terminal | undefined;
let output: vscode.OutputChannel;
let statusBar: vscode.StatusBarItem;
let chat: MochiChatProvider;

function configWorkspaceTrust(): boolean {
  return cfg<boolean>('workspaceTrust', true);
}

async function workspaceRoot(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  if (folders.length === 1) return folders[0].uri.fsPath;
  const picked = await vscode.window.showQuickPick(
    folders.map((f) => ({ label: f.name, description: f.uri.fsPath, fsPath: f.uri.fsPath })),
    { placeHolder: 'Pick a workspace folder for Mochi' },
  );
  return picked?.fsPath;
}

function shortSession(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function updateStatusBar(): void {
  const mode = sessionMode === 'plan' ? '$(list-tree) plan' : '$(zap) act';
  if (running && sessionId) {
    statusBar.text = `$(sync~spin) Mochi ${agentVersion} · ${shortSession(sessionId)} · ${mode}`;
    statusBar.tooltip =
      `Mochi agent ${agentVersion} is working on session ${sessionId} (${sessionMode} mode). ` +
      'Click to send a follow-up prompt.';
  } else if (sessionId) {
    statusBar.text = `$(sparkle) Mochi ${agentVersion} · ${shortSession(sessionId)} · ${mode}`;
    statusBar.tooltip =
      `Mochi agent ${agentVersion} — session ${sessionId} (${sessionMode} mode). Click to send a prompt.`;
  } else {
    statusBar.text = '$(sparkle) Mochi';
    statusBar.tooltip = 'Mochi AI agent (ACP). Click to start a session.';
  }
}

function notify(kind: 'info' | 'warn' | 'error', message: string): void {
  if (!configNotifications() && kind === 'info') return;
  if (kind === 'error') void vscode.window.showErrorMessage(message);
  else if (kind === 'warn') void vscode.window.showWarningMessage(message);
  else void vscode.window.showInformationMessage(message);
}

function showError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  output.appendLine(`[mochi] error: ${message}`);
  notify('error', `Mochi: ${message}`);
}

function handleAgentUpdate(sid: string, update: Record<string, unknown>): void {
  if (sid !== sessionId) return;
  const kind = update['sessionUpdate'];
  if (kind === 'agent_message_chunk') {
    const content = update['content'] as { type?: unknown; text?: unknown } | undefined;
    if (content && typeof content.text === 'string' && content.text !== '') {
      chat.appendAssistantChunk(content.text);
    }
  } else if (kind === 'tool_call') {
    const title = typeof update['title'] === 'string' ? update['title'] : 'tool';
    const toolKind = typeof update['kind'] === 'string' ? ` (${update['kind']})` : '';
    chat.appendAssistantChunk(`\n[tool${toolKind}: ${title}]\n`);
  } else if (kind === 'tool_call_update') {
    const status = update['status'];
    if (status === 'failed') {
      const content = update['content'] as Array<{ text?: unknown }> | undefined;
      const detail = Array.isArray(content)
        ? content.map((c) => (typeof c.text === 'string' ? c.text : '')).join('').slice(0, 300)
        : '';
      chat.appendAssistantChunk(`\n[tool failed${detail ? `: ${detail}` : ' — see Output > Mochi'}]\n`);
      if (detail) output.appendLine(`[mochi] tool failed: ${detail}`);
    } else if (status === 'completed') {
      const locations = update['locations'] as Array<{ path?: unknown }> | undefined;
      if (Array.isArray(locations) && locations.length > 0) {
        const paths = locations
          .map((l) => (typeof l.path === 'string' ? l.path : ''))
          .filter(Boolean)
          .slice(0, 3)
          .join(', ');
        if (paths) chat.appendAssistantChunk(`\n[edited: ${paths}]\n`);
        for (const l of locations) {
          const p = (l as { path?: unknown }).path;
          if (typeof p === 'string' && p && !lastEdited.includes(p)) {
            lastEdited.push(p);
            if (lastEdited.length > 10) lastEdited.shift();
          }
        }
      }
    }
  } else if (kind === 'usage_update') {
    const used = update['used'];
    if (typeof used === 'number' && used > 0) {
      output.appendLine(`[mochi] usage: ${used} tokens`);
    }
  }
}

async function ensureClient(): Promise<AcpClient> {
  if (client) return client;
  if (configWorkspaceTrust() && !vscode.workspace.isTrusted) {
    throw new Error(
      'Workspace is not trusted. Trust the workspace or set "mochi.workspaceTrust" to false.',
    );
  }
  const cwd = await workspaceRoot();
  if (!cwd) throw new Error('Open a folder first — Mochi needs a workspace root to spawn "mochi acp".');
  const binary = configBinaryPath();
  let starting: AcpClient;
  try {
    starting = await AcpClient.start(binary, cwd);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (/ENOENT/i.test(detail) || /not found/i.test(detail) || /spawn/i.test(detail)) {
      throw new Error(`${missingBinaryMessage(binary)} (spawn failed: ${detail})`);
    }
    throw err instanceof Error ? err : new Error(detail);
  }
  starting.onStderr = (text: string) => output.append(text);
  starting.onNotification = (sid: string, update: Record<string, unknown>) =>
    handleAgentUpdate(sid, update);
  starting.onExit = (code: number | null) => {
    client = undefined;
    running = false;
    updateStatusBar();
    output.appendLine(`[mochi] ACP process exited with code ${code ?? 'unknown'}`);
    notify('warn', `Mochi ACP process exited (code ${code ?? 'unknown'}). A new session will respawn it.`);
  };
  try {
    const hello = await starting.initialize();
    if (hello.implementation?.version) agentVersion = hello.implementation.version;
  } catch (err) {
    starting.dispose();
    throw err instanceof Error ? err : new Error(String(err));
  }
  client = starting;
  output.appendLine(`[mochi] connected to agent ${agentVersion} in ${cwd}`);
  return client;
}

async function ensureSession(): Promise<string> {
  const active = await ensureClient();
  const cwd = await workspaceRoot();
  if (!cwd) throw new Error('Open a folder first — Mochi needs a workspace root to spawn "mochi acp".');
  if (sessionId) return sessionId;
  // Forward all open folders so multi-root edits resolve without re-spawn.
  const extra = (vscode.workspace.workspaceFolders ?? []).slice(1).map((f) => f.uri.fsPath);
  const created = await active.newSession(cwd, extra);
  sessionId = created.sessionId;
  sessionMode = 'act';
  chat.setModeBadge(sessionMode);
  updateStatusBar();
  output.appendLine(`[mochi] new session ${sessionId}`);
  return sessionId;
}

async function cmdNewSession(): Promise<void> {
  try {
    // Close the old session server-side so its runtime is freed (the old code
    // leaked every previous session on the daemon).
    if (client && sessionId) {
      try {
        await client.close(sessionId);
      } catch { /* closing is best-effort */ }
    }
    const active = await ensureClient();
    const cwd = await workspaceRoot();
    if (!cwd) throw new Error('Open a folder first — Mochi needs a workspace root.');
    const extra = (vscode.workspace.workspaceFolders ?? []).slice(1).map((f) => f.uri.fsPath);
    const created = await active.newSession(cwd, extra);
    sessionId = created.sessionId;
    sessionMode = 'act';
    chat.setModeBadge(sessionMode);
    updateStatusBar();
    chat.push({ role: 'system', text: `New session ${sessionId} (act mode)` });
    notify('info', `Mochi: new session ${shortSession(sessionId)}`);
    void vscode.commands.executeCommand(`${CHAT_VIEW_ID}.focus`).then(
      () => undefined,
      () => undefined,
    );
  } catch (err) {
    showError(err);
  }
}

export function selectionContext(maxChars = 4000): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) return '';
  const selection = editor.document.getText(editor.selection).slice(0, maxChars);
  const rel = vscode.workspace.asRelativePath(editor.document.uri);
  const line = editor.selection.active.line + 1;
  return `\n\nSelected code from ${rel}:${line}:\n\`\`\`\n${selection}\n\`\`\``;
}

async function sendPrompt(prefill?: string): Promise<void> {
  if (running) {
    notify('warn', 'Mochi is already working — use "Mochi: Cancel Running Prompt" to stop it first.');
    return;
  }
  let text = prefill?.trim() ?? '';
  if (!text) {
    const asked = await vscode.window.showInputBox({
      prompt: 'Ask Mochi… (current selection is attached automatically)',
      placeHolder: 'Describe the change you want',
    });
    if (asked === undefined) return;
    text = asked.trim() + selectionContext();
    if (text.trim() === '') {
      notify('warn', 'Type a prompt or select code first.');
      return;
    }
  }
  let active: AcpClient;
  let sid: string;
  try {
    active = await ensureClient();
    sid = await ensureSession();
  } catch (err) {
    showError(err);
    return;
  }
  running = true;
  updateStatusBar();
  lastEdited.length = 0;
  chat.push({ role: 'user', text });
  output.appendLine(`[mochi] prompt -> session ${sid}: ${text.slice(0, 200)}`);
  try {
    const res = await active.prompt(sid, text);
    chat.push({ role: 'system', text: `Done (stop reason: ${res.stopReason ?? 'end_turn'})` });
    output.appendLine(`[mochi] prompt finished: ${res.stopReason ?? 'end_turn'}`);
    if (lastEdited.length > 0 && configNotifications()) {
      const n = lastEdited.length;
      const choice = await vscode.window.showInformationMessage(
        `Mochi edited ${n} file${n === 1 ? '' : 's'} (${lastEdited.slice(0, 2).join(', ')}${n > 2 ? '…' : ''}).`,
        'Show diff',
        'Dismiss',
      );
      if (choice === 'Show diff') void cmdShowDiff();
    }
  } catch (err) {
    showError(err);
  } finally {
    running = false;
    updateStatusBar();
  }
}

async function cmdPromptSelection(): Promise<void> {
  const ctx = selectionContext();
  if (!ctx.trim()) {
    notify('warn', 'Select code in the editor first, then run "Mochi: Send Selection to Agent".');
    return;
  }
  const asked = await vscode.window.showInputBox({
    prompt: 'What should Mochi do with this selection?',
    placeHolder: 'e.g. explain, refactor, add tests',
  });
  if (asked === undefined) return;
  await sendPrompt(`${asked.trim()}${ctx}`);
}

async function cmdToggleMode(): Promise<void> {
  try {
    const active = await ensureClient();
    const sid = await ensureSession();
    const next = sessionMode === 'plan' ? 'act' : 'plan';
    await active.setMode(sid, next);
    sessionMode = next;
    chat.setModeBadge(sessionMode);
    updateStatusBar();
    chat.push({ role: 'system', text: `Mode: ${sessionMode} (${sessionMode === 'plan' ? 'read-only blueprinting' : 'direct execution'})` });
  } catch (err) {
    showError(err);
  }
}

async function cmdCancel(): Promise<void> {
  if (!client || !sessionId) {
    notify('info', 'Mochi: nothing to cancel.');
    return;
  }
  try {
    client.cancel(sessionId);
    output.appendLine(`[mochi] cancel requested for session ${sessionId}`);
  } catch (err) {
    showError(err);
  }
}

async function cmdCheckHealth(): Promise<void> {
  output.show(true);
  output.appendLine('[mochi] health check: initialize → session/new → session/close');
  try {
    const active = await ensureClient();
    const cwd = (await workspaceRoot()) ?? '.';
    const created = await active.newSession(cwd);
    await active.close(created.sessionId);
    output.appendLine(`[mochi] health ok (agent ${agentVersion}, session lifecycle verified)`);
    notify('info', `Mochi health ok (agent ${agentVersion}).`);
  } catch (err) {
    showError(err);
  }
}

/** Apply-diff view: reveal SCM, log `git diff --stat`, open the first edited
 *  file so the reviewer lands on real code. Best-effort — never throws. */
async function cmdShowDiff(): Promise<void> {
  try {
    const cwd = (await workspaceRoot()) ?? '.';
    void vscode.commands.executeCommand('workbench.view.scm').then(() => undefined, () => undefined);
    const { execFile } = await import('node:child_process');
    const stat: string = await new Promise((resolve) => {
      execFile('git', ['diff', '--stat'], { cwd, timeout: 10_000 }, (err, stdout) => {
        if (err) resolve('');
        else resolve(String(stdout ?? '').slice(0, 4000));
      });
    });
    if (stat.trim()) output.appendLine(`[mochi] git diff --stat:\n${stat}`);
    else output.appendLine('[mochi] git diff: clean or not a git repo');
    const first = lastEdited[0];
    if (first) {
      try {
        const uri = vscode.Uri.file(first.startsWith('/') ? first : `${cwd}/${first}`);
        await vscode.window.showTextDocument(uri, { preview: true });
      } catch { /* file may be deleted/renamed — SCM view is the fallback */ }
    }
  } catch (err) {
    showError(err);
  }
}

/** Terminal integration: reuse one "Mochi" terminal running the TUI. */
async function cmdOpenTerminal(): Promise<void> {
  try {
    const cwd = (await workspaceRoot()) ?? '.';
    if (mochiTerminal && (mochiTerminal.exitStatus === undefined)) {
      mochiTerminal.show(true);
      return;
    }
    const binary = configBinaryPath();
    const cmd = binary.endsWith('.js') ? `node "${binary}"` : binary;
    mochiTerminal = vscode.window.createTerminal({ name: 'Mochi', cwd });
    mochiTerminal.sendText(cmd, true);
    mochiTerminal.show(false);
  } catch (err) {
    showError(err);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('Mochi');
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'mochi.prompt';
  statusBar.show();
  chat = new MochiChatProvider();
  chat.onSendPrompt = (text: string) => {
    void sendPrompt(text);
  };
  chat.onNewSession = () => {
    void cmdNewSession();
  };
  chat.onCancel = () => {
    void cmdCancel();
  };
  chat.onToggleMode = () => {
    void cmdToggleMode();
  };
  context.subscriptions.push(
    output,
    statusBar,
    vscode.window.registerWebviewViewProvider(CHAT_VIEW_ID, chat, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('mochi.newSession', () => cmdNewSession()),
    vscode.commands.registerCommand('mochi.prompt', () => sendPrompt()),
    vscode.commands.registerCommand('mochi.promptSelection', () => cmdPromptSelection()),
    vscode.commands.registerCommand('mochi.cancel', () => cmdCancel()),
    vscode.commands.registerCommand('mochi.toggleMode', () => cmdToggleMode()),
    vscode.commands.registerCommand('mochi.showOutput', () => output.show(true)),
    vscode.commands.registerCommand('mochi.checkHealth', () => cmdCheckHealth()),
    vscode.commands.registerCommand('mochi.showDiff', () => cmdShowDiff()),
    vscode.commands.registerCommand('mochi.openTerminal', () => cmdOpenTerminal()),
  );
  updateStatusBar();
  output.appendLine('[mochi] extension activated');
}

export function deactivate(): void {
  if (client) {
    const stopping = client;
    client = undefined;
    void stopping.shutdown();
  }
}
