# Mochi for VS Code

Autonomous coding agent in your editor. Sidebar chat, selection actions,
plan/act modes over ACP: the extension spawns `mochi acp` in the workspace
root and speaks newline-delimited JSON-RPC 2.0 (`initialize`, `session/new`,
`session/prompt`, `session/cancel` as notification, `session/set_mode`,
`session/close`, `shutdown`) as defined in `src/acp.ts`.

## Prerequisites

- VS Code `^1.85.0`
- Node.js 22+ (for building the extension)
- A Mochi binary on your `PATH`, or set `mochi.binaryPath` (see below)
- A trusted workspace folder (`mochi.workspaceTrust` refuses untrusted roots)

## Develop

```sh
cd editors/vscode
npm install
npm run compile      # emits ./out/extension.js
```

Press `F5` in VS Code to launch an Extension Development Host, or typecheck
without emitting:

```sh
npm run typecheck    # tsc --noEmit -p ./
```

## Package and install

```sh
cd editors/vscode
npm install
npx vsce package     # produces mochi-vscode-<version>.vsix
code --install-extension mochi-vscode-<version>.vsix
# or: mochi setup vscode   (verifies `mochi acp --check`, prints these steps)
```

## Usage

- Open the **Mochi** activity-bar icon for the chat view.
- Command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):
  - `Mochi: New Session` — closes the old session server-side (no leaks),
    handshakes (`initialize` with protocol-version check) and creates `session/new`.
    Multi-root workspaces get a folder picker; extra roots are forwarded as
    `additionalDirectories`.
  - `Mochi: Send Prompt` (`Ctrl+Alt+M`) — prompts the input box; the current
    editor selection is attached as fenced code context with file:line.
    While a prompt runs, streamed `session/update` notifications render in the
    chat view (assistant chunks as markdown, tool calls with kind, file edits,
    failures with the first 300 chars + Output log pointer).
  - `Mochi: Send Selection to Agent` — right-click menu when text is selected;
    asks what to do, then sends question + selection.
  - `Mochi: Toggle Plan / Act Mode` — flips `session/set_mode` (read-only
    blueprinting vs direct execution); the mode badge in the chat toolbar and
    status bar follows.
  - `Mochi: Cancel Running Prompt` (`Ctrl+Alt+.`) — sends `session/cancel` as a
    spec-compliant notification (no id, never hangs).
  - `Mochi: Check Agent Health` — `initialize → session/new → session/close`
    round-trip, reported in `Output > Mochi`.
  - `Mochi: Show Output Log` — opens `Output > Mochi`.
- The left status-bar item shows agent version + short session id + mode
  (`plan`/`act`). ACP exposes no per-model field; the version identifies the
  serving backend.
- Chat history trims oldest-first at `mochi.maxSessionHistory` (default 200)
  and survives view hides (`retainContextWhenHidden`).

## Settings

| Setting                  | Default | Purpose                                                        |
| ------------------------ | ------- | -------------------------------------------------------------- |
| `mochi.binaryPath`       | `mochi` | Binary used to spawn `mochi acp`; paths ending in `.js` run via Node. |
| `mochi.workspaceTrust`   | `true`  | Refuse to spawn the agent in an untrusted workspace.           |
| `mochi.requestTimeoutMs` | `600000`| Timeout for a silent server round-trip (streaming keeps it alive). |
| `mochi.maxSessionHistory`| `200`   | Sidebar messages kept before trimming oldest first.            |
| `mochi.showNotifications`| `true`  | Session lifecycle toasts (errors always show).                 |

## Troubleshooting

- **Mochi binary not found**: install with `npm i -g @mochi/agent`, or set
  `mochi.binaryPath` to your local build. The full error (including the
  failed spawn detail) is shown in the VS Code notification and logged to
  `Output > Mochi`.
- **Protocol mismatch**: server speaks a different ACP version than the
  extension. Update both (`npm i -g @mochi/agent@latest` + reinstall the .vsix).
- **Request timed out**: the server went silent for `requestTimeoutMs`. Check
  `Output > Mochi` for the last stderr, then `Mochi: Check Agent Health`.
- Agent stderr is mirrored to `Output > Mochi`. If the ACP process exits
  unexpectedly, the extension reports it and respawns on the next session.
- `mochi doctor` now reports `acp` / `vscode` / `jetbrains` / `onboard` rows;
  `mochi acp --check` verifies the bridge without an editor.
