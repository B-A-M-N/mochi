// MCP (Model Context Protocol) server over stdio for editor ubiquity.
// VS Code (Copilot Chat MCP), Cursor, JetBrains, Neovim (via clients), Claude
// Desktop and any MCP client can spawn Mochi as a child and drive its agent
// runtime as MCP tools:
//
//   mochi_run    — run a goal to completion in the workspace cwd
//   mochi_plan   — ask for a plan without executing (plan mode)
//   mochi_status — list workspace sessions/goals
//
// Framing: MCP stdio transport = newline-delimited JSON-RPC 2.0 on
// stdin/stdout (same framing as our ACP server; MCP spec allows both
// Content-Length framing and line-delimited, all major clients accept line-
// delimited). The protocol core (handleMcp) is pure and unit-testable; the
// stdio loop is a thin adapter.
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { Runtime } from './runtime.js';

export interface McpCall {
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface ServerState {
  cwd: string;
  runtime: Runtime | null;
}

const TOOLS = [
  {
    name: 'mochi_run',
    description: 'Run Mochi agent on a goal in the current workspace and return the final result. Executes real tools (read/write files, shell, git) with the configured model provider.',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'The task for Mochi to execute' },
        constraints: { type: 'array', items: { type: 'string' }, description: 'Optional constraints' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'mochi_plan',
    description: 'Ask Mochi for a plan for the given task WITHOUT executing any changes (plan mode). Returns the decomposed task list.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The task to plan' },
      },
      required: ['task'],
    },
  },
  {
    name: 'mochi_status',
    description: 'List Mochi goals/sessions in the workspace with their status.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function getRuntime(state: ServerState): Runtime {
  if (!state.runtime) state.runtime = Runtime.create({ cwd: state.cwd });
  return state.runtime;
}

/** Pure MCP protocol core. Unit-testable without spawning. */
export async function handleMcp(
  call: McpCall,
  state: ServerState,
): Promise<McpResponse> {
  const id = call.id ?? null;
  const method = String(call.method ?? '');
  try {
    switch (method) {
      case 'initialize':
        return {
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'mochi', version: '1.0.0' },
          },
        };
      case 'notifications/initialized':
      case 'notifications/cancelled':
        return { id: null, result: {} };
      case 'tools/list':
        return { id, result: { tools: TOOLS } };
      case 'tools/call': {
        const name = String(call.params?.name ?? '');
        const args = (call.params?.arguments ?? {}) as Record<string, unknown>;
        let text: string;
        if (name === 'mochi_run') {
          const goal = String(args.goal ?? '');
          if (!goal) return { id, error: { code: -32602, message: 'mochi_run requires a goal' } };
          const rt = getRuntime(state);
          const constraints = Array.isArray(args.constraints) ? args.constraints.map(String) : [];
          const out = await rt.goal(goal, constraints);
          text = typeof out === 'string' ? out : JSON.stringify(out ?? { done: true });
        } else if (name === 'mochi_plan') {
          const task = String(args.task ?? '');
          if (!task) return { id, error: { code: -32602, message: 'mochi_plan requires a task' } };
          const rt = getRuntime(state);
          const prevPlan = rt.config.planMode;
          rt.setPlanMode(true);
          try {
            const out = await rt.goal(task, ['plan only - do not execute changes']);
            text = typeof out === 'string' ? out : JSON.stringify(out ?? { planned: true });
          } finally { rt.setPlanMode(prevPlan); }
        } else if (name === 'mochi_status') {
          const rt = getRuntime(state);
          const goals = rt.workspace.listGoals ? rt.workspace.listGoals() : [];
          text = JSON.stringify(goals, null, 2);
        } else {
          return { id, error: { code: -32602, message: `Unknown tool: ${name}` } };
        }
        return { id, result: { content: [{ type: 'text', text: String(text).slice(0, 20_000) }] } };
      }
      case 'ping':
        return { id, result: {} };
      default:
        return { id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
  } catch (e) {
    return { id, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } };
  }
}

/** stdio loop adapter. */
export async function mcpServerLoop(cwd: string): Promise<void> {
  const state: ServerState = { cwd: resolve(cwd), runtime: null };
  const rl = createInterface({ input: process.stdin });
  const write = (msg: unknown) => process.stdout.write(JSON.stringify(msg) + '\n');
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let call: McpCall;
    try { call = JSON.parse(trimmed); } catch { continue; }
    const res = await handleMcp(call, state);
    if (call.method === 'notifications/initialized' || call.method === 'notifications/cancelled') continue;
    write(call.id === undefined ? { jsonrpc: '2.0', method: 'rpc', params: res } : { jsonrpc: '2.0', id: res.id, ...(res.error ? { error: res.error } : { result: res.result }) });
    if (call.method === 'shutdown') process.exit(0);
  }
}
