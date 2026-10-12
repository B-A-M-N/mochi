// N-API linkage shim.
//
// The napi_* symbols this crate declares (src/napi.rs) are not linked from a
// library — they are EXPORTED BY THE HOST NODE PROCESS at dlopen time:
//
// - linux:  ld leaves undefined symbols in shared objects by default, so the
//           addon has always linked fine here (dlopen resolves them).
// - macos:  ld64 errors on undefined symbols unless told `-undefined
//           dynamic_lookup` (the standard node-addon setting).
// - windows: MSVC demands every symbol at link time; node ships an import
//           library (`node.lib`) next to `node.exe` for exactly this.
//
// Without this file the crate only ever built on Linux — CI's macOS and
// Windows legs died at link ("Undefined symbols for architecture arm64" /
// LNK2019 unresolved external symbol napi_get_cb_info).
fn main() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    match target_os.as_str() {
        "macos" => {
            println!("cargo:rustc-link-arg-cdylib=-undefined");
            println!("cargo:rustc-link-arg-cdylib=dynamic_lookup");
        }
        "windows" => {
            println!("cargo:rerun-if-env-changed=MOCHI_NODE_LIB_DIR");
            let dir = std::env::var("MOCHI_NODE_LIB_DIR")
                .ok()
                .filter(|d| std::path::Path::new(d).join("node.lib").exists())
                .or_else(find_node_lib_dir);
            match dir {
                Some(d) => {
                    println!("cargo:rustc-link-search=native={d}");
                    println!("cargo:rustc-link-lib=dylib=node");
                }
                None => {
                    let hint = std::env::var("MOCHI_NODE_LIB_DIR").unwrap_or_else(|_| "<unset>".into());
                    // Degrade exactly like before the fix: link will fail and
                    // build:native reports the accelerator as unavailable.
                    println!("cargo:warning=node.lib not found (MOCHI_NODE_LIB_DIR={hint}; scanned every PATH dir) — N-API addon will not link on Windows");
                }
            }
        }
        _ => {}
    }
}

/// Fallback: scan EVERY directory on PATH for node.lib. The first `where node`
/// hit isn't necessarily the install that ships the import library (runners can
/// have a shim node earlier in PATH than the real SDK dir).
#[cfg(target_os = "windows")]
fn find_node_lib_dir() -> Option<String> {
    let path = std::env::var("PATH").ok()?;
    for dir in std::env::split_paths(&path) {
        if dir.join("node.lib").exists() {
            return Some(dir.to_string_lossy().into_owned());
        }
    }
    None
}

#[cfg(not(target_os = "windows"))]
fn find_node_lib_dir() -> Option<String> {
    None
}
