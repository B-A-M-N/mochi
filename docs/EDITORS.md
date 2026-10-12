# Editor Integrations

Mochi plugs into editors and MCP-capable clients two ways: an **ACP stdio server** (editor-native agent protocol) and an **MCP stdio server** (Model Context Protocol). Both spawn `mochi` as a child process speaking JSON-RPC 2.0 over stdin/stdout — no ports, no daemon required.

## MCP (VS Code, Cursor, JetBrains, Neovim, Claude Desktop)

`mochi mcp-serve` exposes three tools:

| Tool | What it does |
|---|---|
| `mochi_run` | Run a goal to completion in the workspace (real tools: files, shell, git) |
| `mochi_plan` | Plan-only mode — decompose a task without executing |
| `mochi_status` | List workspace goals/sessions |

### VS Code (GitHub Copilot Chat / VS Code MCP support)

`.vscode/mcp.json` in any workspace:

```json
{
  "servers": {
    "mochi": {
      "type": "stdio",
      "command": "mochi",
      "args": ["mcp-serve"]
    }
  }
}
```

### Cursor

Settings → MCP & Integrations → MCP Servers → **New MCP Server**, or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mochi": {
      "command": "mochi",
      "args": ["mcp-serve"]
    }
  }
}
```

### JetBrains (IntelliJ / WebStorm AI Assistant)

Settings → Tools → MCP Servers → Add → type `stdio`, command `mochi`, args `mcp-serve`.

### Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mochi": {
      "command": "mochi",
      "args": ["mcp-serve"]
    }
  }
}
```

### Neovim

With `nvim-mcp`/`mcp.nvim`-style clients, register the same stdio command (`mochi mcp-serve`) as a server.

## ACP (Zed and ACP-native editors)

`mochi acp` speaks Agent Client Protocol v1 (newline-delimited JSON-RPC): `initialize`, `session/new`, `session/prompt` with streaming `session/update` notifications, plan/act mode switching, context-budget config, and session persistence.

### Zed

`~/.zed/settings.json` → `agent`:

```json
{
  "agent": {
    "profiles": {
      "mochi": {
        "name": "Mochi",
        "default": true
      }
    },
    "servers": {
      "mochi": {
        "source": "custom",
        "command": "mochi",
        "args": ["acp"]
      }
    }
  }
}
```

(Exact Zed key layout varies by version — the invariant is: spawn `mochi acp` over stdio.)

## Verification

Both servers are protocol-core tested (`src/mcp-server.test.ts`, `src/acp.test.ts`) and live-fire verified:

```bash
printf '%s\n%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | mochi mcp-serve
```
