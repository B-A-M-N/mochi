# Mochi in your editor — VS Code + JetBrains (ACP)

Mochi speaks **Agent Client Protocol v1** over stdio (`mochi acp`).
Both editor plugins spawn it in the project root and talk JSON-RPC
newline-delimited JSON:

```
initialize (protocol-version checked) → session/new (+additionalDirectories)
  → session/prompt (per-session queue, parallel across sessions)
  → session/cancel (notification, never hangs) → session/set_mode
  → session/close → shutdown
server→client: session/update (tool_call, tool_call_update, agent_message_chunk, usage_update)
```

Notifications (no `id`) get no reply; string and numeric ids both route.
Overlapping prompts on one session serialize; different sessions run parallel.

## VS Code — editors/vscode

- `npm install && vsce package && code --install-extension mochi-*.vsix`
- Or dev: open `editors/vscode` in VS Code, `F5`.
- Or: `mochi setup vscode` (runs `mochi acp --check`, prints install steps,
  probes the `code` CLI).
- Commands: `New Session` (closes old server-side, no leaks), `Send Prompt`
  (`Ctrl+Alt+M`, selection attached as file:line fenced context),
  `Send Selection to Agent` (context menu), `Toggle Plan / Act Mode`,
  `Cancel` (`Ctrl+Alt+.`, notification), `Check Agent Health`
  (initialize → new → close round-trip), `Show Output Log`.
- Sidebar chat (markdown code/bold, mode badge, history trim at
  `maxSessionHistory`, retained when hidden) + status bar
  (version · short session · plan/act).
- Settings: `binaryPath`, `workspaceTrust`, `requestTimeoutMs` (silent-server
  timeout, streaming keeps alive), `maxSessionHistory`, `showNotifications`.
- Errors: missing binary → install hint; protocol mismatch → update both;
  timeout → Output log pointer. Stderr mirrored to `Output > Mochi`.

See `editors/vscode/README.md`. Typechecked clean (`tsc --noEmit`).

## JetBrains — editors/jetbrains

- `./gradlew buildPlugin` → install from disk, or `./gradlew runIde`.
- Or: `mochi setup jetbrains`.
- Tool window `Mochi`: status line + transcript + input + Send/Cancel,
  plus `New` (closes old session) and `Mode: plan/act` toggle.
- Action: `Send Selection to Mochi` (editor popup, now asks what to do and
  sends question + file:line fenced selection).
- Binary-missing → warning dialog pointing at `npm i -g @mochi/agent` /
  Settings → Tools → Mochi. Settings: `binaryPath` (default `mochi`).
- Transport: `ProcessBuilder(mochi acp)` in project base path, plain-thread
  newline JSON-RPC client (`MochiService.kt` with `setMode`/`close`/`newSessionFresh`).

See `editors/jetbrains/README.md`.

## CLI ↔ editor contract

- `mochi acp` is the sole entrypoint (no auto-start on import).
  `mochi acp --check` verifies initialize → new → close without an editor.
- `mochi setup vscode|jetbrains|editors` verifies ACP first, then install steps.
- `mochi onboard` / `/onboard` wires providers/skills/MCPs once;
  editors reuse the same `~/.config/mochi/config.json`.
- `mochi plugin add|remove|list|info|enable|disable|validate` manages hook
  plugins (disabled via `.disabled` sentinel, excluded from merged hooks).
  `/plugins` in TUI shows the same state.
- Doctor: `mochi doctor` reports `acp` / `vscode` / `jetbrains` / `onboard`
  rows; `mochi doctor --probe` adds provider reachability for editor runs.

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
