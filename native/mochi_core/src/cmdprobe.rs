//! Probe whether a leading command/binary resolves on PATH or as a local
//! `./` wrapper. Mirrors `commandAvailable()` in `src/agent/loop.ts` line 96.
//!
//! This is on the per-turn hot path: every optional repo check (lint/
//! typecheck/build) calls it once per verification step. The JS version
//! does up to ~20 `statSync` round-trips; the Rust port does a single
//! linear scan of PATH with no I/O marshalling overhead.
//!
//! Returns: 1 = available, 0 = not available, -1 = bad input.
//!
//! JSON in:  `{"command":"npm test","cwd":"/path","pathEnv":"/usr/bin:..."}`
//! JSON out: `{"available":true,"bin":"npm"}` or `{"available":false,"bin":"..."}`

use std::path::{Path, PathBuf};

/// Public alias so lib.rs can re-use the same JSON-escape helper for the
/// FFI response payload. Delegates to `fold::json_escape_string` to keep
/// one canonical implementation.
pub use super::fold::json_escape_string;

/// Extract the actual program name to probe. Mirrors the TS logic:
///   - `npx X` → `npm`
///   - `cd DIR && PROG` → `PROG`
///   - `cd DIR && PROG ARGS` → `PROG`
///   - first whitespace-separated token otherwise
fn extract_bin(command: &str) -> String {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let first = trimmed.split_whitespace().next().unwrap_or("");
    if first == "npx" {
        return "npm".to_string();
    }
    if first == "cd" {
        // Look for `cd <dir> && <prog>` shape.
        if let Some(idx) = trimmed.find("&&") {
            let after = trimmed[idx + 2..].trim();
            return after.split_whitespace().next().unwrap_or("").to_string();
        }
        return String::new();
    }
    first.to_string()
}

/// True iff `path` exists and is a file. We do a single OS stat (no symlink
/// resolution beyond what stat() does on the platform) — matches the TS
/// `statSync(path).isFile()` contract closely enough.
fn is_file(path: &Path) -> bool {
    match std::fs::metadata(path) {
        Ok(m) => m.is_file(),
        Err(_) => false,
    }
}

/// Decide whether the leading command of `command` resolves on PATH or as
/// a `./<bin>` relative to `cwd`. `path_env` should be the colon-separated
/// PATH string (split is platform-naive — Unix-only by design, matching
/// the TS version which uses `:` as the separator).
pub fn command_available(command: &str, cwd: &str, path_env: &str) -> (bool, String) {
    let bin = extract_bin(command);
    if bin.is_empty() {
        return (false, bin);
    }
    // Relative or absolute path → probe the filesystem directly.
    if bin.starts_with("./") || bin.starts_with('/') {
        let p = if bin.starts_with('/') {
            PathBuf::from(&bin)
        } else {
            Path::new(cwd).join(&bin)
        };
        return (is_file(&p), bin);
    }
    // Walk PATH (single linear scan, no syscalls until we hit a candidate).
    for dir in path_env.split(':') {
        if dir.is_empty() {
            continue;
        }
        let candidate = Path::new(dir).join(&bin);
        if is_file(&candidate) {
            return (true, bin);
        }
    }
    (false, bin)
}

// ---- FFI JSON plumbing (zero-dep, string-aware) ---------------------------

fn json_string_field(src: &str, key: &str) -> Option<String> {
    let needle = format!("\"{}\":", key);
    let pos = src.find(&needle)?;
    let s = src[pos + needle.len()..].trim_start();
    if !s.starts_with('"') {
        return None;
    }
    let s = &s[1..];
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'"' {
            return String::from_utf8(out).ok();
        }
        if b == b'\\' && i + 1 < bytes.len() {
            out.push(match bytes[i + 1] {
                b'"' => b'"',
                b'\\' => b'\\',
                b'/' => b'/',
                b'n' => b'\n',
                b'r' => b'\r',
                b't' => b'\t',
                b'b' => 0x08,
                b'f' => 0x0c,
                _ => bytes[i + 1],
            });
            i += 2;
            continue;
        }
        out.push(b);
        i += 1;
    }
    None
}

// JSON escaping is provided by the re-export of `fold::json_escape_string`
// at the top of this file. Tests use the path-qualified name so they don't
// depend on the alias name.

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_command_returns_no_bin() {
        let (ok, bin) = command_available("", "/tmp", "/usr/bin");
        assert!(!ok);
        assert!(bin.is_empty());
    }

    #[test]
    fn npx_maps_to_npm() {
        let (ok, bin) = command_available("npx vitest", "/tmp", "/usr/local/bin:/usr/bin:/bin");
        // We can't assert `ok` portably (depends on host), but bin must be `npm`.
        assert_eq!(bin, "npm");
    }

    #[test]
    fn cd_and_chain_extracts_prog() {
        let (_, bin) = command_available("cd /tmp && ls -la", "/", "/usr/bin");
        assert_eq!(bin, "ls");
    }

    #[test]
    fn plain_first_token() {
        let (_, bin) = command_available("cargo build --release", "/tmp", "/usr/bin");
        assert_eq!(bin, "cargo");
    }

    #[test]
    fn nonexistent_command_in_empty_path() {
        let (ok, bin) = command_available("definitely-not-a-real-binary-xyz", "/", "");
        assert!(!ok);
        assert_eq!(bin, "definitely-not-a-real-binary-xyz");
    }

    #[test]
    fn absolute_path_existing_file() {
        // /bin/sh exists on every Unix system we run on.
        let (ok, bin) = command_available("/bin/sh -c echo", "/", "");
        assert!(ok);
        assert_eq!(bin, "/bin/sh");
    }

    #[test]
    fn absolute_path_nonexistent() {
        let (ok, _bin) = command_available("/nonexistent/path/xyz -c", "/", "");
        assert!(!ok);
    }

    #[test]
    fn relative_path_uses_cwd() {
        // This test is portable: the file we just wrote exists in /tmp during
        // the test process. We use the std::env::temp_dir() so it works
        // anywhere a temp dir exists.
        let dir = std::env::temp_dir();
        let bin_name = "mochi_command_avail_probe_test";
        let path = dir.join(bin_name);
        std::fs::write(&path, "#!/bin/sh\n").unwrap();
        let (ok, bin) = command_available("./mochi_command_avail_probe_test", dir.to_str().unwrap(), "");
        let _ = std::fs::remove_file(&path);
        assert!(ok);
        assert_eq!(bin, "./mochi_command_avail_probe_test");
    }

    #[test]
    fn json_parser_escapes() {
        let s = r#"{"command":"echo \"hi\"","cwd":"/tmp","pathEnv":"/usr/bin"}"#;
        assert_eq!(json_string_field(s, "command").unwrap(), "echo \"hi\"");
        assert_eq!(json_string_field(s, "cwd").unwrap(), "/tmp");
        assert_eq!(json_string_field(s, "pathEnv").unwrap(), "/usr/bin");
    }
}
