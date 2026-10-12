# Mochi JetBrains Plugin

IntelliJ / JetBrains integration for the Mochi AI agent via ACP (`mochi acp` stdio JSON-RPC).

## How it works

- The plugin spawns `mochi acp` in the project base path with `ProcessBuilder`.
- It speaks newline-delimited JSON-RPC 2.0 over stdin/stdout:
  - `initialize` (protocolVersion 1)
  - `session/new` (creates a session for the project)
  - `session/prompt` (sends `{ type: text, text }` blocks, streams `session/update` chunks into the tool window)
  - `session/cancel` (notification, aborts the running prompt)
  - `shutdown` (clean exit)
- UI: `Mochi` tool window (right anchor) with transcript, input field, Send and Cancel buttons.
- Action: `Send Selection to Mochi` (editor popup menu, `Ctrl+Alt+M`).
- Settings: binary path persisted via `MochiSettings` (`mochi.xml`, default `mochi`).

## Prerequisites

- JDK 17
- Gradle (wrapper recommended) with network access to the Gradle Plugin Portal
- `mochi` binary on `PATH` (or configure another path in code via `MochiSettings.binaryPath`)
- IntelliJ IDEA Community 2024.1+ for running/debugging

## Build

```bash
cd editors/jetbrains
./gradlew buildPlugin
```

If no wrapper is present, generate one with a local Gradle install:

```bash
gradle wrapper --gradle-version 8.10
./gradlew buildPlugin
```

The distributable is written to:

```
build/distributions/mochi-jetbrains-0.1.0.zip
```

## Install from disk

1. Open IntelliJ: `Settings / Preferences -> Plugins -> Gear icon -> Install Plugin from Disk...`
2. Select the ZIP from `build/distributions/`.
3. Restart the IDE.
4. Open the `Mochi` tool window (right sidebar), type a request, press Send.
5. In an editor, select code, right-click -> `Send Selection to Mochi` (or `Ctrl+Alt+M`).

## Run in a sandbox IDE

```bash
./gradlew runIde
```

## Layout

```
settings.gradle.kts
build.gradle.kts
gradle.properties
src/main/resources/META-INF/plugin.xml
src/main/resources/icons/mochi.svg
src/main/kotlin/dev/mochi/MochiService.kt
src/main/kotlin/dev/mochi/MochiToolWindowFactory.kt
src/main/kotlin/dev/mochi/MochiPromptAction.kt
src/main/kotlin/dev/mochi/MochiSettings.kt
```
