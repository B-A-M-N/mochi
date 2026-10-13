---
name: mcp-setup
description: Guide on configuring Model Context Protocol (MCP) servers in Mochi
---

# MCP Setup Guide

Mochi supports the Model Context Protocol (MCP), allowing you to attach external tool servers to the agent.

## Configuring MCP Servers
1. Prefer the one-command path: `mochi mcp search <keyword>` (or `/mcp` in the TUI) to find a server, then `mochi mcp add <id>` to install it into `.mcp.json` — no hand-editing.
2. For a custom server, add it explicitly: `mochi mcp add npm:<package>`, `uvx:<package>`, `https://…` endpoint, or `cmd:<binary> [args]`.
3. Set the required env vars the install hint names (e.g. `export GITHUB_PERSONAL_ACCESS_TOKEN=...`), then verify with `mochi mcp test [id]` — a server that can't handshake is reported, not assumed.
4. The agent loads configured servers lazily at run start (chat turns skip them entirely); `mcp_manage(action="test")` re-checks health from inside a run.

Manual `.mcp.json` shape (only if you skip the commands above):
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token"
      }
    }
  }
}
```

## Built-in DeepWiki Server
Mochi includes a built-in MCP server for DeepWiki. You can run it via:
```bash
node dist/mcp/deepwiki-server.js
```
