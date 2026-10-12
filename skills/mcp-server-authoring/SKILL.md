---
name: mcp-server-authoring
description: Authoring MCP servers that Mochi can load — stdio and Streamable HTTP transports, tool schemas, .mcp.json wiring. Use when adding or debugging MCP integrations.
---

# MCP Server Authoring

Mochi speaks Model Context Protocol: built-in servers ship in the registry, user servers land in `.mcp.json`.

## Trigger
- Adding a built-in MCP server to the registry.
- Debugging a user-reported MCP server that won't load.
- Wiring an external tool (DB, API, device) into agent sessions.

## Steps
1. Choose transport: **stdio** for local processes (default), **Streamable HTTP** for shared/remote. Prefer stdio unless there's a concrete reason.
2. Declare tools with JSON Schema — strict types, `required` fields, descriptions the model can act on (these go straight into the system prompt budget).
3. Register in `src/mcp/registry.ts` (built-ins) or document the `.mcp.json` entry (user): `{ command, args, env }` for stdio, `{ url, headers }` for HTTP.
4. Error shape: tools return `{ content: [...] }` on success, `{ isError: true, message }` on failure — never throw across the transport.
5. Test with the loader: `npx vitest run src/mcp/` plus a live session check that the tool list appears and a call round-trips.

## Pitfalls
- Tool descriptions are prompt budget: one sentence, dense, no marketing.
- stdio servers must not write to stdout except protocol frames — logs go to stderr.
- Env var references in headers (`${VAR}`) are resolved at load — fail loudly if unset, never silently empty.
- Schema `additionalProperties: false` everywhere you control it; loose schemas produce hallucinated args.

## Verification
- Registry test green; live call in a session returns real output.
- `mochi mcp list` shows the server; `mochi mcp add <name>` works from a clean workspace.
