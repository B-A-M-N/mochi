---
name: shell-scripting
description: Bash scripts that don't rot: strict mode, quoting, tempfiles, argument parsing. Use when asked for shell scripts, automation scripts, or bash tooling.
---

# Shell Scripting Procedure

## 1. Strict mode header, always
- Start every script: `set -euo pipefail` + `IFS=$'\n\t'`. Without it, a failed command mid-script silently continues and a typo'd variable expands to empty.
- Quote every expansion: `"$var"`, `"${arr[@]}"`. Unquoted variables split on spaces and glob — the classic `rm -rf $dir/` disaster.

## 2. Tempfiles and cleanup with traps
- `tmp=$(mktemp -d)` + `trap 'rm -rf "$tmp"' EXIT`. Never fixed paths in /tmp (collisions + symlink attacks).
- `cd` into a variable? Save/restore with `pushd/popd` or subshells `( cd "$d" && ... )` so callers never inherit your cwd.

## 3. Arguments and usage
- `usage()` + getopts/getopt for anything with more than one flag. Positional args get validated up front with a clear error, not a cryptic failure 50 lines in.
- Readonly constants at top (`readonly PROG="${0##*/}"`), functions below, `main "$@"` guard at the bottom (`[[ "${BASH_SOURCE[0]}" == "$0" ]] && main "$@"`).

## 4. Verify portably
- `shellcheck` clean is mandatory (unused vars, quoting, portability). Test on bash AND sh if the shebang claims sh (`shellcheck -s sh`).
- Test the failure paths: missing arg, missing binary (`command -v` check with install hint), unwritable output — scripts fail in production exactly where you didn't test.

## Pitfalls
- `curl | bash` installers: download, inspect, then run — never pipe straight to shell in scripts you ship.
- GNU vs BSD flags (`sed -i`, `date -d`, `stat`) differ on macOS — use portable forms or detect the OS once at the top.
