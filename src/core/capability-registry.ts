// Capability Registry for Mochi VNext
// Central repository for all native, MCP, ACP, Subagent, and Skill capabilities.

import type { Capability, CapabilityContext, CapabilityExecutionRequest, CapabilityExecutionResponse } from './capability.js';
import type { ToolDefinition } from '../types.js';
import { TOOL_ALIASES, normalizeToolArgs } from '../tools/index.js';

export class CapabilityRegistry {
  private capabilities = new Map<string, Capability>();
  private domainMap = new Map<string, Set<string>>();

  register(cap: Capability): void {
    this.capabilities.set(cap.name, cap);
    const domain = cap.domain ?? 'core';
    if (!this.domainMap.has(domain)) {
      this.domainMap.set(domain, new Set());
    }
    this.domainMap.get(domain)!.add(cap.name);
  }

  unregister(name: string): boolean {
    const canonical = TOOL_ALIASES[name] || name;
    const cap = this.capabilities.get(canonical);
    if (!cap) return false;
    this.capabilities.delete(canonical);
    const domain = cap.domain ?? 'core';
    this.domainMap.get(domain)?.delete(canonical);
    return true;
  }

  get(name: string): Capability | undefined {
    const canonical = TOOL_ALIASES[name] || name;
    return this.capabilities.get(canonical);
  }

  has(name: string): boolean {
    const canonical = TOOL_ALIASES[name] || name;
    return this.capabilities.has(canonical);
  }

  list(): Capability[] {
    return [...this.capabilities.values()];
  }

  getDomains(): string[] {
    return [...this.domainMap.keys()];
  }

  getByDomain(domain: string): Capability[] {
    const names = this.domainMap.get(domain);
    if (!names) return [];
    return [...names].map((n) => this.capabilities.get(n)!).filter(Boolean);
  }

  getSchemas(activeDomains?: string[]): ToolDefinition[] {
    return [...this.capabilities.values()]
      .filter((c) => {
        if (!activeDomains || activeDomains.length === 0) return true;
        const domain = c.domain ?? 'core';
        return activeDomains.includes(domain) || domain === 'core';
      })
      .map((c) => c.schema);
  }

  async execute(
    name: string,
    rawArgs: Record<string, unknown>,
    context: CapabilityContext,
    callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  ): Promise<CapabilityExecutionResponse> {
    const canonical = TOOL_ALIASES[name] || name;
    const cap = this.capabilities.get(canonical);
    if (!cap) {
      return {
        callId,
        name,
        output: '',
        error: `Unknown capability or tool: "${name}"`,
        durationMs: 0,
        truncated: false,
        rawTokensEstimate: 0,
      };
    }

    const args = normalizeToolArgs(canonical, rawArgs);
    const req: CapabilityExecutionRequest = {
      callId,
      name: canonical,
      args,
      context,
    };

    const start = performance.now();
    try {
      const res = await cap.execute(req);
      const durationMs = Math.round(performance.now() - start);
      return {
        ...res,
        durationMs,
      };
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      return {
        callId,
        name,
        output: '',
        error: err instanceof Error ? err.message : String(err),
        durationMs,
        truncated: false,
        rawTokensEstimate: 0,
      };
    }
  }
}

import type { Tool } from '../tools/types.js';
import type { ToolContext } from '../tools/types.js';
import { ALL_TOOLS, validateArgs } from '../tools/index.js';

const READ_ONLY_TOOLS = new Set([
  'read', 'search', 'glob', 'inspect', 'git', 'diff', 'tree',
  'get_function', 'find_callers', 'type_hierarchy', 'perf_audit',
  'deepwiki', 'clipboard', 'sql_codebase', 'analyze_code', 'memory',
  'web_search', 'get_diagnostics', 'git_blame', 'git_history', 'system_info',
  'find_references', 'find_definitions', 'db_inspect', 'think',
]);
// 'verify' is deliberately ABSENT: it has permission:'shell', dangerous:true,
// and executes its command argument verbatim (tools/verify.ts). Classifying
// it read-only let ToolDispatcher run it in the concurrent read-only
// Promise.allSettled batch while builds/tests mutate the tree. (Re-removed
// after the fetch-methods PR accidentally restored it from its base.)
// 'fetch' is deliberately ABSENT: its method arg selects POST/PUT/PATCH/
// DELETE, which mutate REMOTE state (tools/fetch.ts), and this static flag is
// arg-blind — mutating requests must not ride the concurrent read-only
// Promise.allSettled batch. GET/HEAD stay read-only in the arg-aware gates
// (security/permission.ts autoAllow, agent/loop.ts isReadOnly); here fetch
// pays the sequential-batch fee for correctness.

export function toolToCapability(tool: Tool): Capability {
  const isReadOnly = READ_ONLY_TOOLS.has(tool.def.name);
  return {
    id: `native:${tool.def.name}`,
    name: tool.def.name,
    kind: 'native',
    description: tool.def.description,
    schema: tool.def,
    isReadOnly,
    domain: isReadOnly ? 'inspect' : 'mutate',
    execute: async (req: CapabilityExecutionRequest): Promise<CapabilityExecutionResponse> => {
      const validation = validateArgs(tool, req.args);
      if (validation) {
        return {
          callId: req.callId,
          name: tool.def.name,
          output: '',
          error: validation,
          durationMs: 0,
          truncated: false,
          rawTokensEstimate: 0,
        };
      }

      // Permission gate
      const perm = tool.def.permission;
      if (perm && req.context.config.permissions) {
        const isPermitted = perm === 'admin'
          ? req.context.config.permissions.admin !== false
          : (req.context.config.permissions[perm] ?? (perm === 'read' || perm === 'write' || perm === 'shell' || perm === 'network'));
        if (!isPermitted) {
          return {
            callId: req.callId,
            name: tool.def.name,
            output: '',
            error: `Permission denied for tool ${tool.def.name} (${perm})`,
            durationMs: 0,
            truncated: false,
            rawTokensEstimate: 0,
          };
        }
      }

      req.context.events.emit({
        type: 'tool:called',
        tool: tool.def.name,
        args: req.args,
        agentId: req.context.agentId,
      });

      const start = performance.now();
      try {
        // Bridge the capability context to a tool context: same cwd/workspace/
        // config/events/agentId/cache by reference; the subagent spawner is
        // adapted (AgentResult → summary string) since the two layers type it
        // differently. No `as any` — incompatibilities stay visible here.
        const toolCtx: ToolContext = {
          cwd: req.context.cwd,
          workspace: req.context.workspace,
          config: req.context.config,
          events: req.context.events,
          agentId: req.context.agentId,
          abortSignal: req.context.abortSignal,
          readCache: req.context.readCache,
          ...(req.context.spawnSubagent
            ? { spawnSubagent: async (prompt: string, opts?: { role?: string }) => (await req.context.spawnSubagent!(prompt, opts)).summary }
            : {}),
        };
        const output = await tool.execute(req.args, toolCtx);
        const durationMs = Math.round(performance.now() - start);
        return {
          callId: req.callId,
          name: tool.def.name,
          output,
          durationMs,
          truncated: false,
          rawTokensEstimate: Math.ceil(output.length / 4),
        };
      } catch (err) {
        const durationMs = Math.round(performance.now() - start);
        return {
          callId: req.callId,
          name: tool.def.name,
          output: '',
          error: err instanceof Error ? err.message : String(err),
          durationMs,
          truncated: false,
          rawTokensEstimate: 0,
        };
      }
    },
  };
}

export function createDefaultCapabilityRegistry(_config: any, allowed?: string[]): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  for (const tool of ALL_TOOLS) {
    if (!allowed || allowed.includes(tool.def.name) || tool.def.name === 'todo' || tool.def.name === 'skill' || tool.def.name === 'subagent') {
      registry.register(toolToCapability(tool));
    }
  }
  return registry;
}
