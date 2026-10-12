# Install mochi

One-line installers fetch the standalone `mochi` binary from
[GitHub releases](https://github.com/xanstomper/mochi/releases)
(`mochi-<version>-<os>-<arch>.tar.gz`, or `.zip` on Windows).
No `sudo`, no global `npm install`. Re-running is safe (idempotent).

## One-line install

macOS / Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/xanstomper/mochi/main/install.sh | sh
```

With options (pin a version, custom directory):

```sh
curl -fsSL https://raw.githubusercontent.com/xanstomper/mochi/main/install.sh | sh -s -- --version 0.23.1 --to ~/.local/bin
```

No `curl`? Use `wget` to fetch the script (the script itself still needs `curl`):

```sh
wget -qO- https://raw.githubusercontent.com/xanstomper/mochi/main/install.sh | sh
```

Windows (PowerShell 5.1+):

```powershell
irm https://raw.githubusercontent.com/xanstomper/mochi/main/install.ps1 | iex
```

Pin a version / custom directory on Windows (download the script first, then run it):

```powershell
Invoke-WebRequest -UseBasicParsing -Uri https://raw.githubusercontent.com/xanstomper/mochi/main/install.ps1 -OutFile install.ps1
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Version 0.23.1
```

Pick a version explicitly (any platform):

```sh
MOCHI_VERSION=0.23.1 sh install.sh
```

Then:

```sh
mochi --help
mochi onboard
```

## What the script does

1. Detects OS (`linux` / `darwin`; Windows is refused with a pointer to `install.ps1`) and architecture (`x64` / `arm64`, others refused).
2. Resolves the version: `--version X` / first arg / `MOCHI_VERSION`, else the latest GitHub release tag, else fallback `0.23.1`.
3. Downloads `mochi-<version>-<os>-<arch>.tar.gz` (`.zip` on Windows) from the release page into a temp dir and extracts it.
4. Installs the `mochi` binary into `~/.local/bin` (`--to DIR` to change; `%LOCALAPPDATA%\mochi\bin\mochi.exe` on Windows), `chmod +x`, no `sudo`.
5. Verifies the install with `mochi --version` and tells you if the target dir is missing from `PATH` (with the `export` / `fish_add_path` line, or updates USER `PATH` on Windows).
6. Falls back to building from source (`git clone --depth 1` → `npm ci` → `npm run build`, wrapped as a `node dist/cli.js` shim) if the binary download fails and `git` + `node` + `npm` are available; otherwise fails with a clear message.

## Uninstall

Remove the binary (and the install dir if you created it only for mochi):

```sh
rm ~/.local/bin/mochi
```

Windows (PowerShell):

```powershell
Remove-Item "$env:LOCALAPPDATA\mochi\bin\mochi.exe"
```

This also removes config/state if you want a clean slate:

```sh
rm -rf ~/.config/mochi ~/.mochi
```

The source fallback checkout (only if you ever hit that path) lives at `~/.mochi-src` (or `$MOCHI_SRC`); remove it with `rm -rf ~/.mochi-src`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `mochi: command not found` after install | Target dir not on `PATH`. Run `export PATH="$HOME/.local/bin:$PATH"` (bash/zsh, persist in `~/.bashrc`/`~/.zshrc`) or `fish_add_path ~/.local/bin` (fish), then restart the shell. On Windows, open a **new** terminal after install (USER `PATH` change). |
| `curl: (22) 404` / download failed | The release asset for your version/platform may not exist yet. Retry with the fallback version (`MOCHI_VERSION=0.23.1`), check [releases](https://github.com/xanstomper/mochi/releases), or let the script use its source fallback (needs `git` + `node >= 22` + `npm`). |
| Offline / GitHub API unreachable | The script installs fallback version `0.23.1` and, if the download fails, builds from source when `git` + `node` are present. Without network neither path works — reconnect and re-run. |
| Script used source fallback (`~/.mochi-src`) | Binary asset was unavailable. This needs `node >= 22`. The installed `mochi` is a `node dist/cli.js` wrapper; you can later re-run the installer to swap in a real binary. |
| `permission denied` writing install dir | Never use `sudo`. Pick a dir you own: `sh install.sh --to ~/.local/bin` (default) or any writable path. |
| Windows: SmartScreen / Defender warning | The binary is unsigned. If SmartScreen blocks it, click *More info → Run anyway* (only for binaries from this repo's releases). For `install.ps1` blocked by policy, run `powershell -ExecutionPolicy Bypass -File .\install.ps1`. |
| Wrong architecture (e.g. 32-bit) | Only `x64` and `arm64` are supported; the script refuses others. Use a supported machine or build from source (`npm ci && npm run build`). |
