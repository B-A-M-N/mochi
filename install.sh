#!/bin/sh
# mochi one-line installer (POSIX sh, also bash-compatible).
#
# Installs the mochi standalone binary from GitHub releases:
#   curl -fsSL https://raw.githubusercontent.com/xanstomper/mochi/main/install.sh | sh
#
# Flags:
#   --version X   install version X (default: latest release, fallback 0.23.1)
#   --to DIR      install directory (default: ~/.local/bin)
#   --no-onboard  hide the `mochi onboard` next-step hint
#   -h, --help    print usage
# A bare first argument is treated as a version: `sh install.sh 0.23.1`.
# Env overrides: MOCHI_VERSION, MOCHI_INSTALL_DIR (or --to), MOCHI_SRC.
#
# Never uses sudo. Safe to re-run (idempotent: overwrites the binary).

set -eu

REPO="xanstomper/mochi"
FALLBACK_VERSION="0.23.1"
API_URL="https://api.github.com/repos/xanstomper/mochi/releases/latest"

VERSION="${MOCHI_VERSION:-}"
VERSION_EXPLICIT=0
INSTALL_DIR="${MOCHI_INSTALL_DIR:-}"
SHOW_ONBOARD=1

usage() {
  cat <<'USAGE'
Usage: install.sh [--version X] [--to DIR] [--no-onboard] [VERSION]

  --version X   install version X (e.g. --version 0.23.1)
  --to DIR      install directory (default: ~/.local/bin)
  --no-onboard  do not print the `mochi onboard` next step
  -h, --help    show this help

Environment: MOCHI_VERSION, MOCHI_INSTALL_DIR, MOCHI_SRC (source-fallback dir).
USAGE
}

log() { printf '%s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

# ---- arg parsing -----------------------------------------------------------
while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      [ "$#" -ge 2 ] || die "--version needs a value (e.g. --version 0.23.1)"
      VERSION="$2"; VERSION_EXPLICIT=1; shift 2 ;;
    --version=*)
      VERSION="${1#--version=}"; VERSION_EXPLICIT=1; shift ;;
    --to)
      [ "$#" -ge 2 ] || die "--to needs a directory (e.g. --to ~/.local/bin)"
      INSTALL_DIR="$2"; shift 2 ;;
    --to=*)
      INSTALL_DIR="${1#--to=}"; shift ;;
    --no-onboard)
      SHOW_ONBOARD=0; shift ;;
    -h|--help)
      usage; exit 0 ;;
    --)
      shift; break ;;
    --*)
      die "unknown flag: $1 (see --help)" ;;
    *)
      # Bare positional arg = version override.
      if [ "$VERSION_EXPLICIT" -eq 0 ] && [ -z "$VERSION" ]; then
        VERSION="$1"; VERSION_EXPLICIT=1; shift
      else
        die "unexpected argument: $1 (see --help)"
      fi
      ;;
  esac
done

[ -n "${HOME:-}" ] || die "HOME is not set; re-run with --to DIR."
if [ -z "$INSTALL_DIR" ]; then
  INSTALL_DIR="$HOME/.local/bin"
fi

# ---- OS / arch detection ----------------------------------------------------
OS=""
ARCH=""
OS_NAME="$(uname -s)"
ARCH_NAME="$(uname -m)"
case "$OS_NAME" in
  Linux) OS="linux" ;;
  Darwin) OS="darwin" ;;
  MINGW*|MSYS*|CYGWIN*|Windows*|MINGW32*|MINGW64*)
    die "native Windows detected: this script cannot install there. Use install.ps1 instead: irm https://raw.githubusercontent.com/xanstomper/mochi/main/install.ps1 | iex" ;;
  *)
    die "unsupported OS: $OS_NAME (only linux and darwin are supported; Windows users: see install.ps1)" ;;
esac
case "$ARCH_NAME" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)
    die "unsupported architecture: $ARCH_NAME (only x64 and arm64 are supported)" ;;
esac

case "${VERSION:-}" in
  *[!0-9A-Za-z._-]*)
    die "invalid version: $VERSION (expected e.g. 0.23.1)" ;;
esac

# ---- version resolution ------------------------------------------------------
resolve_version() {
  if [ -n "$VERSION" ]; then
    printf '%s\n' "$VERSION"
    return 0
  fi
  if command_exists curl; then
    api_json="$(curl -fsSL "$API_URL" 2>/dev/null)" || api_json=""
    if [ -n "${api_json:-}" ]; then
      tag="$(printf '%s' "$api_json" | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed 's/.*"v\{0,1\}\([^"]*\)".*/\1/')" || tag=""
      case "$tag" in
        ''|*[!0-9A-Za-z._-]*)
          log "warning: could not parse latest version from GitHub API; using fallback $FALLBACK_VERSION" >&2
          printf '%s\n' "$FALLBACK_VERSION" ;;
        *) printf '%s\n' "$tag" ;;
      esac
      return 0
    fi
    log "warning: GitHub API unreachable; using fallback version $FALLBACK_VERSION" >&2
  else
    log "warning: curl not found; using fallback version $FALLBACK_VERSION" >&2
  fi
  printf '%s\n' "$FALLBACK_VERSION"
}

VERSION="$(resolve_version)"
log "mochi installer: version=$VERSION os=$OS arch=$ARCH dir=$INSTALL_DIR"

# ---- temp dir -----------------------------------------------------------------
TMP_DIR=""
cleanup() {
  if [ -n "${TMP_DIR:-}" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT INT TERM
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t mochi-install)" || die "could not create temp dir"

# ---- binary install ------------------------------------------------------------
install_binary() {
  asset="mochi-${VERSION}-${OS}-${ARCH}.tar.gz"
  url="https://github.com/${REPO}/releases/download/v${VERSION}/${asset}"
  log "downloading $url ..."
  if ! command_exists curl; then
    log "curl not found."
    return 1
  fi
  if ! command_exists tar; then
    die "tar not found; please install tar and re-run."
  fi
  if ! curl -fsSL "$url" -o "$TMP_DIR/$asset"; then
    log "download failed: $url"
    return 1
  fi
  if ! tar -xzf "$TMP_DIR/$asset" -C "$TMP_DIR"; then
    die "failed to extract $asset (file may be corrupt)."
  fi
  bin_src=""
  if [ -f "$TMP_DIR/mochi" ]; then
    bin_src="$TMP_DIR/mochi"
  else
    bin_src="$(find "$TMP_DIR" -maxdepth 3 -name mochi -type f 2>/dev/null | head -n 1)" || bin_src=""
    [ -n "${bin_src:-}" ] || die "archive did not contain a 'mochi' binary (looked in $asset)."
  fi
  mkdir -p "$INSTALL_DIR" || die "cannot create $INSTALL_DIR (permission denied; pick another dir with --to DIR)."
  cp -f "$bin_src" "$INSTALL_DIR/mochi" || die "cannot write to $INSTALL_DIR (permission denied; pick another dir with --to DIR)."
  chmod +x "$INSTALL_DIR/mochi" || die "cannot chmod $INSTALL_DIR/mochi."
  log "installed $INSTALL_DIR/mochi"
  return 0
}

# ---- source fallback -------------------------------------------------------------
source_install() {
  log "attempting source fallback (git + node) ..."
  command_exists git || return 1
  command_exists node || return 1
  command_exists npm || return 1
  src_dir="${MOCHI_SRC:-$HOME/.mochi-src}"
  if [ -d "$src_dir/.git" ]; then
    log "updating existing checkout at $src_dir ..."
    git -C "$src_dir" fetch --depth 1 origin 2>/dev/null || true
  elif [ -d "$src_dir" ]; then
    die "source fallback: $src_dir exists but is not a git checkout (move it aside or set MOCHI_SRC)."
  else
    log "cloning https://github.com/xanstomper/mochi.git to $src_dir ..."
    git clone --depth 1 "https://github.com/${REPO}.git" "$src_dir" || return 1
  fi
  if [ "$VERSION_EXPLICIT" -eq 1 ]; then
    ( git -C "$src_dir" fetch --depth 1 origin "tag v$VERSION" 2>/dev/null && git -C "$src_dir" checkout "v$VERSION" 2>/dev/null ) || \
      log "warning: tag v$VERSION not found; building default branch instead." >&2
  fi
  ( cd "$src_dir" && npm ci ) || ( cd "$src_dir" && npm install ) || return 1
  ( cd "$src_dir" && npm run build ) || return 1
  [ -f "$src_dir/dist/cli.js" ] || return 1
  mkdir -p "$INSTALL_DIR" || die "cannot create $INSTALL_DIR."
  # Node wrapper so `mochi` works without a global npm install.
  printf '#!/bin/sh\nexec node "%s/dist/cli.js" "$@"\n' "$src_dir" > "$INSTALL_DIR/mochi" || return 1
  chmod +x "$INSTALL_DIR/mochi" || return 1
  log "installed source wrapper at $INSTALL_DIR/mochi (src: $src_dir)"
  return 0
}

# ---- main --------------------------------------------------------------------------
if install_binary; then
  :
else
  log "binary download failed."
  if command_exists git && command_exists node && command_exists npm; then
    log "git + node detected: falling back to building from source."
    source_install || die "source fallback failed. Check your network/node version (node >= 22 required) and re-run."
  else
    missing=""
    command_exists git || missing="${missing} git"
    command_exists node || missing="${missing} node/npm"
    command_exists curl || missing="${missing} curl"
    die "could not download the mochi binary (release v$VERSION may not exist yet or you may be offline), and source fallback is unavailable (missing:$missing). Install the missing tools and re-run, or try again later."
  fi
fi

# ---- verify --------------------------------------------------------------------------
if ! "$INSTALL_DIR/mochi" --version >/dev/null 2>&1; then
  die "verification failed: $INSTALL_DIR/mochi --version did not run. Re-run the installer or report an issue."
fi
installed_ver="$("$INSTALL_DIR/mochi" --version 2>/dev/null | head -n 1)" || installed_ver="mochi"
log "verified: $installed_ver"

# ---- PATH hint --------------------------------------------------------------------------
case ":$PATH:" in
  *":$INSTALL_DIR:"*)
    log "PATH: $INSTALL_DIR is already on your PATH." ;;
  *)
    printf '\nNOTE: %s is not on your PATH. Add it:\n' "$INSTALL_DIR"
    printf '  bash/zsh: echo %s >> ~/.bashrc  (or ~/.zshrc)\n' "'export PATH=\"$INSTALL_DIR:\$PATH\"'"
    printf '  fish:     fish_add_path %s\n' "$INSTALL_DIR"
    printf 'Then restart your shell (or run the export line now).\n\n' ;;
esac

# ---- success banner ----------------------------------------------------------------------
cat <<EOF

========================================
  mochi $VERSION installed to $INSTALL_DIR/mochi
========================================
Next steps:
  mochi --help
EOF
if [ "$SHOW_ONBOARD" -eq 1 ]; then
  printf '  mochi onboard\n'
fi
