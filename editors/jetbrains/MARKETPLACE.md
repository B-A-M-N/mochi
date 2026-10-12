# Mochi AI Agent — JetBrains Marketplace Listing

## Plugin Name

**Mochi AI Agent** (`dev.mochi.jetbrains`)

## Short Description (≤ 120 chars)

Chat with the Mochi coding agent in your IDE — streaming ACP chat, plan/act modes, selection actions.

## Long Description

**Mochi AI Agent** brings the Mochi coding agent directly into IntelliJ IDEA, PyCharm, WebStorm,
GoLand, Rider, PhpStorm, RubyMine, CLion, and other JetBrains IDEs (2024.1+).

### Features

- **Mochi tool window** (right sidebar): persistent chat transcript, input field, Send / Cancel /
  New-session controls, live `session/update` streaming.
- **plan / act mode toggle**: blueprint read-only in `plan`, execute directly in `act`.
- **Send Selection to Mochi** action (editor popup menu, `Ctrl+Alt+M`): explain, refactor, or
  document the selected code with one prompt.
- **Settings page** (`Settings > Tools > Mochi`): binary path, request timeout, notification toggle.
- **Agent Client Protocol (ACP)**: spawns `mochi acp` and speaks newline-delimited JSON-RPC 2.0
  over stdio (`initialize`, `session/new`, `session/prompt`, `session/cancel`, `shutdown`).

### Requirements

- `mochi` binary on `PATH` (or set a custom path in Settings).
- JetBrains IDE 2024.1 or newer (build 241+), JDK 17 for building from source.

## Screenshots (placeholders — capture before publishing)

1. `screenshots/01-tool-window.png` — Mochi tool window with streaming response.
2. `screenshots/02-selection-action.png` — "Send Selection to Mochi" in the editor popup menu.
3. `screenshots/03-settings.png` — Settings > Tools > Mochi page (binary path, timeout, notifications).
4. `screenshots/04-mode-toggle.png` — plan/act mode toggle and new-session flow.

## Install from Disk (for testing)

1. Build the distribution:
   ```bash
   cd editors/jetbrains
   ./gradlew buildPlugin
   ```
2. ZIP lands in `build/distributions/mochi-jetbrains-<version>.zip`.
3. In the IDE: `Settings / Preferences → Plugins → ⚙ gear icon → Install Plugin from Disk…`
4. Select the ZIP, restart the IDE.
5. Open the `Mochi` tool window (right sidebar), type a request, press Send.

## Publish to Marketplace (draft steps)

1. Build and sanity-check: `./gradlew buildPlugin` then `./gradlew runIde` smoke test
   (tool window opens, Send/Cancel/New/mode toggle work, selection action fires).
2. Sign in at <https://plugins.jetbrains.com> and open the upload / new-plugin draft.
3. Upload the `build/distributions/*.zip`; set:
   - Plugin ID: `dev.mochi.jetbrains`
   - Since build: `241`, Until build: leave open (or next EAP ceiling)
   - License, vendor URL (`https://github.com/mochi`), tags: `AI`, `Agent`, `Coding Assistant`
4. Paste the Short + Long descriptions above; attach the 4 screenshots + `icons/mochi.svg` icon.
5. Submit for review; iterate on reviewer feedback; approve → public listing.

## Compatibility

| IDE | Minimum version | Since build | Notes |
|-----|----------------|-------------|-------|
| IntelliJ IDEA Community / Ultimate | 2024.1 | 241 | Reference target (`intellijIdeaCommunity("2024.1")`) |
| PyCharm / WebStorm / GoLand / Rider / PhpStorm / RubyMine / CLion | 2024.1 | 241 | Platform dependency only (`com.intellij.modules.platform`) |
| Android Studio | Ladybug (2024.2-based) | 241 | Should work; verify on release channel |
| Older than 2024.1 (build < 241) | — | — | **Not supported** |

Build requirements: JDK 17, Gradle 8.10.2 (via `./gradlew`), network access to the Gradle Plugin Portal.
