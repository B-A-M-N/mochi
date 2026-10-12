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
                    // Degrade exactly like before the fix: link will fail and
                    // build:native reports the accelerator as unavailable.
                    println!("cargo:warning=node.lib not found (set MOCHI_NODE_LIB_DIR) — N-API addon will not link on Windows");
                }
            }
        }
        _ => {}
    }
}

/// Fallback: ask PATH where node lives and look for node.lib beside it
/// (standard Node installers and nvm-windows ship it next to node.exe).
#[cfg(target_os = "windows")]
fn find_node_lib_dir() -> Option<String> {
    let out = std::process::Command::new("where").arg("node").output().ok()?;
    let first = String::from_utf8_lossy(&out.stdout).lines().next()?.to_string();
    let node_exe = std::path::PathBuf::from(first.trim());
    let dir = node_exe.parent()?;
    if dir.join("node.lib").exists() {
        Some(dir.to_string_lossy().into_owned())
    } else {
        None
    }
}

#[cfg(not(target_os = "windows"))]
fn find_node_lib_dir() -> Option<String> {
    None
}
