//! `mochi` — the default launch entry (Rust launcher).
//!
//! The shipped `mochi` command is this small compiled binary. It owns three
//! jobs so every other entry point inherits them:
//!
//!   1. **Instant fast paths** — `mochi --version` / `mochi version` and
//!      `mochi runtime` answer in <2 ms without booting Node or Bun
//!      (~76–100 ms). No JS is evaluated to print a number.
//!   2. **Runtime dispatch** — everything else is exec'd into a real engine:
//!        `mochi`               → freshest artifact (standalone wins ties)
//!        `mochi node …`        → force the Node engine (`dist/cli.js`)
//!        `mochi standalone …`  → force the Bun standalone binary
//!      `MOCHI_RUNTIME=node|standalone` forces the same way without an
//!      argument. Explicit `MOCHI_STANDALONE` / `MOCHI_NODE_ENTRY` paths pin
//!      an artifact outright.
//!   3. **Native-core wiring** — before handing off it resolves
//!      `native/bin/mochi-agent` and exports `MOCHI_AGENT_BIN` (unless the
//!      user already set it), so the TS layer's Rust-accelerated hot paths
//!      (compaction plan / token counting / stream assembly) never fall back
//!      just because a bundled virtual filesystem hid the binary.
//!
//! On Unix the hand-off is `exec(2)` — the launcher *becomes* the engine, so
//! there is no supervising parent to die on SIGINT, no extra process, and
//! signal/TTY semantics are exactly what a direct launch would give. If exec
//! fails (missing `node`, stale artifact) the other engine is tried before
//! giving up, so a broken artifact degrades instead of crashing the launch.
//!
//! Zero dependencies on purpose: std only.

use std::env;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;

const VERSION: &str = env!("CARGO_PKG_VERSION");

/// How far to walk up from the launcher looking for a source checkout
/// (`<root>/dist/mochi-bin`, `<root>/dist/cli.js`).
const ASCEND_LIMIT: usize = 6;
/// Standalone wins when the two engines' artifacts are effectively built at
/// the same moment (a single `build && build:bin` run) — self-contained beats
/// "needs node on PATH" at parity.
const TIE_WINDOW_SECS: u64 = 2;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Engine {
    Standalone,
    Node,
}

impl Engine {
    pub fn as_str(self) -> &'static str {
        match self {
            Engine::Standalone => "standalone",
            Engine::Node => "node",
        }
    }
}

#[derive(Clone, Debug)]
pub struct Candidate {
    pub path: PathBuf,
    pub mtime: Option<SystemTime>,
}

impl Candidate {
    fn probe(path: PathBuf) -> Option<Candidate> {
        let meta = fs::metadata(&path).ok()?;
        if !meta.is_file() {
            return None;
        }
        Some(Candidate {
            path,
            mtime: meta.modified().ok(),
        })
    }

    fn age_secs(&self) -> Option<u64> {
        self.mtime
            .and_then(|t| SystemTime::now().duration_since(t).ok())
            .map(|d| d.as_secs())
    }
}

#[derive(Clone, Debug)]
pub struct Resolution {
    pub engine: Engine,
    pub path: PathBuf,
    pub standalone: Vec<Candidate>,
    pub node: Vec<Candidate>,
    pub reason: String,
}

impl Resolution {
    fn chosen(&self) -> &Candidate {
        let list = match self.engine {
            Engine::Standalone => &self.standalone,
            Engine::Node => &self.node,
        };
        list.iter()
            .find(|c| c.path == self.path)
            .unwrap_or(&list[0])
    }
}

/// Candidate discovery is parameterized on the two roots that matter
/// (launcher directory + home) so tests can build fixture trees.
pub struct Roots {
    pub exe_dir: PathBuf,
    pub home: PathBuf,
}

impl Roots {
    pub fn detect() -> Roots {
        let exe = env::current_exe().unwrap_or_else(|_| PathBuf::from("mochi"));
        let exe_dir = exe.parent().map(Path::to_path_buf).unwrap_or_else(|| PathBuf::from("."));
        let home = env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(env::temp_dir);
        Roots { exe_dir, home }
    }
}

fn push_unique(list: &mut Vec<Candidate>, path: PathBuf) {
    if list.iter().any(|c| c.path == path) {
        return;
    }
    if let Some(c) = Candidate::probe(path) {
        list.push(c);
    }
}

/// Walk `start` and its parents looking for `<dir>/<rel>`.
fn ascend_find(start: &Path, rel: &str) -> Option<PathBuf> {
    let mut dir = Some(start);
    for _ in 0..ASCEND_LIMIT {
        let d = dir?;
        let hit = d.join(rel);
        if hit.is_file() {
            return Some(hit);
        }
        dir = d.parent();
    }
    None
}

fn exe_name(base: &str) -> String {
    if cfg!(windows) {
        format!("{}.exe", base)
    } else {
        base.to_string()
    }
}

pub fn collect_standalone(roots: &Roots) -> Vec<Candidate> {
    let mut out = Vec::new();
    if let Some(pin) = env::var_os("MOCHI_STANDALONE") {
        // An explicit pin is the *only* candidate for its engine: silently
        // falling back to something else would defeat the point of pinning.
        push_unique(&mut out, PathBuf::from(pin));
        return out;
    }
    push_unique(&mut out, roots.exe_dir.join(exe_name("mochi-standalone")));
    push_unique(&mut out, roots.exe_dir.join(exe_name("mochi-bin")));
    if let Some(hit) = ascend_find(&roots.exe_dir, &exe_name("dist/mochi-bin")) {
        push_unique(&mut out, hit);
    }
    push_unique(&mut out, roots.home.join(".local/bin").join(exe_name("mochi-standalone")));
    push_unique(&mut out, roots.home.join("mochi/dist").join(exe_name("mochi-bin")));
    out
}

pub fn collect_node(roots: &Roots) -> Vec<Candidate> {
    let mut out = Vec::new();
    if let Some(pin) = env::var_os("MOCHI_NODE_ENTRY") {
        push_unique(&mut out, PathBuf::from(pin));
        return out;
    }
    // npm-style prefix: `<prefix>/bin/mochi` → `<prefix>/lib/node_modules/@mochi/agent/dist/cli.js`
    push_unique(
        &mut out,
        roots
            .exe_dir
            .join("../lib/node_modules/@mochi/agent/dist/cli.js"),
    );
    if let Some(hit) = ascend_find(&roots.exe_dir, "dist/cli.js") {
        push_unique(&mut out, hit);
    }
    push_unique(&mut out, roots.exe_dir.join("cli.js"));
    push_unique(&mut out, roots.home.join("mochi/dist/cli.js"));
    out
}

fn newest(list: &[Candidate]) -> Option<&Candidate> {
    list.iter().max_by(|a, b| {
        let ta = a.mtime.unwrap_or(SystemTime::UNIX_EPOCH);
        let tb = b.mtime.unwrap_or(SystemTime::UNIX_EPOCH);
        ta.cmp(&tb)
    })
}

fn mtime_delta_ms(a: Option<SystemTime>, b: Option<SystemTime>) -> Option<u128> {
    let (a, b) = (a?, b?);
    a.duration_since(b)
        .or_else(|_| b.duration_since(a))
        .ok()
        .map(|d| d.as_millis())
}

/// Resolve which engine should run.
///
/// * `forced` (subcommand / `MOCHI_RUNTIME`) picks the engine outright.
/// * Otherwise the **freshest artifact wins** — an auto-dispatch that ran a
///   stale binary next to a fresh checkout is the classic "my fix isn't in
///   the build" harness bug. Within `TIE_WINDOW_SECS` standalone wins
///   (self-contained, no `node` required).
pub fn resolve(forced: Option<Engine>, roots: &Roots) -> Result<Resolution, String> {
    let standalone = collect_standalone(roots);
    let node = collect_node(roots);

    if standalone.is_empty() && node.is_empty() {
        return Err(format!(
            "no Mochi runtime found.\n  looked for standalone: {}\n  looked for node: {}\n  \
             build one with `npm run build && npm run build:bin`, or pin one with \
             MOCHI_STANDALONE=<path> / MOCHI_NODE_ENTRY=<path>.",
            describe_list(&standalone_paths(roots)),
            describe_list(&node_paths(roots)),
        ));
    }

    let (engine, path, reason) = match forced {
        Some(e) => {
            let list = match e {
                Engine::Standalone => &standalone,
                Engine::Node => &node,
            };
            let best = newest(list).ok_or_else(|| {
                format!(
                    "no `{}` runtime found (candidates probed: {}). \
                     Build it (`npm run build{} `) or pin one with {}.",
                    e.as_str(),
                    match e {
                        Engine::Standalone => describe_list(&standalone_paths(roots)),
                        Engine::Node => describe_list(&node_paths(roots)),
                    },
                    if e == Engine::Node { "&& npm run build:bin" } else { "" },
                    if e == Engine::Node {
                        "MOCHI_NODE_ENTRY=<path>"
                    } else {
                        "MOCHI_STANDALONE=<path>"
                    },
                )
            })?;
            (e, best.path.clone(), format!("forced by `{}`", e.as_str()))
        }
        None => {
            let s_best = newest(&standalone);
            let n_best = newest(&node);
            match (s_best, n_best) {
                (Some(s), Some(n)) => {
                    let delta = mtime_delta_ms(s.mtime, n.mtime).unwrap_or(u128::MAX);
                    let tie_ms = u128::from(TIE_WINDOW_SECS) * 1000;
                    if delta <= tie_ms {
                        (
                            Engine::Standalone,
                            s.path.clone(),
                            format!(
                                "freshest artifact (built within {}ms of the node entry — \
                                 standalone wins ties)",
                                delta
                            ),
                        )
                    } else if s.mtime > n.mtime {
                        (
                            Engine::Standalone,
                            s.path.clone(),
                            "freshest artifact (standalone is newer)".to_string(),
                        )
                    } else {
                        (
                            Engine::Node,
                            n.path.clone(),
                            "freshest artifact (node entry is newer)".to_string(),
                        )
                    }
                }
                (Some(s), None) => (
                    Engine::Standalone,
                    s.path.clone(),
                    "only a standalone artifact is present".to_string(),
                ),
                (None, Some(n)) => (
                    Engine::Node,
                    n.path.clone(),
                    "only a node entry is present".to_string(),
                ),
                (None, None) => unreachable!("emptiness checked above"),
            }
        }
    };

    Ok(Resolution {
        engine,
        path,
        standalone,
        node,
        reason,
    })
}

// Small helpers kept separate from `collect_*` so the "looked for" error can
// list every path even when none exist (Candidate::probe filters missing
// files, which would make an empty error message).
fn standalone_paths(roots: &Roots) -> Vec<PathBuf> {
    let mut v = Vec::new();
    if let Some(pin) = env::var_os("MOCHI_STANDALONE") {
        v.push(PathBuf::from(pin));
        return v;
    }
    v.push(roots.exe_dir.join(exe_name("mochi-standalone")));
    v.push(roots.exe_dir.join(exe_name("mochi-bin")));
    if let Some(hit) = ascend_find(&roots.exe_dir, &exe_name("dist/mochi-bin")) {
        v.push(hit);
    }
    v.push(roots.home.join(".local/bin").join(exe_name("mochi-standalone")));
    v.push(roots.home.join("mochi/dist").join(exe_name("mochi-bin")));
    v
}

fn node_paths(roots: &Roots) -> Vec<PathBuf> {
    let mut v = Vec::new();
    if let Some(pin) = env::var_os("MOCHI_NODE_ENTRY") {
        v.push(PathBuf::from(pin));
        return v;
    }
    v.push(roots.exe_dir.join("../lib/node_modules/@mochi/agent/dist/cli.js"));
    if let Some(hit) = ascend_find(&roots.exe_dir, "dist/cli.js") {
        v.push(hit);
    }
    v.push(roots.exe_dir.join("cli.js"));
    v.push(roots.home.join("mochi/dist/cli.js"));
    v
}

fn describe_list(paths: &[PathBuf]) -> String {
    if paths.is_empty() {
        return "(none)".to_string();
    }
    paths
        .iter()
        .map(|p| p.display().to_string())
        .collect::<Vec<_>>()
        .join(", ")
}

/// Resolve `native/bin/mochi-agent` so the TS layer can always find the
/// Rust-accelerated hot-path server. Returns None when nothing is installed.
pub fn find_agent_bin(roots: &Roots) -> Option<PathBuf> {
    if let Some(pin) = env::var_os("MOCHI_AGENT_BIN") {
        let p = PathBuf::from(pin);
        if p.is_file() {
            return Some(p);
        }
        // A stale pin is worse than no pin (the TS layer would probe a dead
        // path forever): ignore it and discover properly.
    }
    let name = exe_name("mochi-agent");
    let mut candidates = vec![
        roots.exe_dir.join(&name),
        roots.exe_dir.join("../native/bin").join(&name),
        roots.home.join(".local/bin").join(&name),
        roots.home.join("mochi/native/bin").join(&name),
        PathBuf::from("/usr/local/bin").join(&name),
    ];
    if let Some(hit) = ascend_find(&roots.exe_dir, &format!("native/bin/{}", name)) {
        candidates.push(hit);
    }
    candidates.into_iter().find(|p| p.is_file())
}

fn build_command(engine: Engine, path: &Path, args: &[OsString], roots: &Roots) -> Command {
    let mut cmd = match engine {
        Engine::Standalone => Command::new(path),
        Engine::Node => {
            let node = env::var_os("MOCHI_NODE").unwrap_or_else(|| OsString::from("node"));
            let mut c = Command::new(node);
            c.arg(path);
            c
        }
    };
    cmd.args(args);
    // Pin the native core for the child when we can see it and the user
    // hasn't already decided otherwise.
    if env::var_os("MOCHI_AGENT_BIN").is_none() {
        if let Some(agent) = find_agent_bin(roots) {
            cmd.env("MOCHI_AGENT_BIN", agent);
        }
    }
    cmd.env("MOCHI_LAUNCHER", "rust");
    cmd.env("MOCHI_ACTIVE_ENGINE", engine.as_str());
    cmd
}

/// Hand the process to `engine`. Returns only on failure (caller tries the
/// other engine) — on Unix success is exec(2) and never returns.
fn exec_engine(engine: Engine, path: &Path, args: &[OsString], roots: &Roots) -> Result<(), String> {
    let mut cmd = build_command(engine, path, args, roots);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        // SAFETY-equivalent: exec replaces this process on success. On error
        // the process image is untouched and we can fall back.
        let err = cmd.exec();
        Err(format!("exec {} failed: {}", engine.as_str(), err))
    }
    #[cfg(not(unix))]
    {
        match cmd.status() {
            Ok(status) => {
                if status.success() {
                    // Parent semantics on Windows: exit with the child's code.
                    std::process::exit(0);
                }
                std::process::exit(status.code().unwrap_or(1));
            }
            Err(e) => Err(format!("launch {} failed: {}", engine.as_str(), e)),
        }
    }
}

fn print_version() {
    println!("{}", VERSION);
}

fn human_line(c: &Candidate) -> String {
    match c.age_secs() {
        Some(age) => format!("{} ({}s ago)", c.path.display(), age),
        None => c.path.display().to_string(),
    }
}

fn print_runtime_report(json: bool, roots: &Roots) -> i32 {
    let forced = env_forced();
    match resolve(forced, roots) {
        Err(e) => {
            eprintln!("mochi runtime: {}", e);
            1
        }
        Ok(res) => {
            if json {
                let mut out = String::from("{");
                out.push_str(&format!("\"launcherVersion\":{},", json_str(VERSION)));
                out.push_str(&format!(
                    "\"engine\":{},",
                    json_str(res.engine.as_str())
                ));
                out.push_str(&format!("\"path\":{},", json_str(&res.path.display().to_string())));
                out.push_str(&format!("\"reason\":{},", json_str(&res.reason)));
                out.push_str("\"candidates\":[");
                let mut first = true;
                for (engine, list) in [
                    (Engine::Standalone, &res.standalone),
                    (Engine::Node, &res.node),
                ] {
                    for c in list {
                        if !first {
                            out.push(',');
                        }
                        first = false;
                        out.push_str(&format!(
                            "{{\"engine\":{},\"path\":{},\"mtimeAgeSecs\":{}}}",
                            json_str(engine.as_str()),
                            json_str(&c.path.display().to_string()),
                            c.age_secs()
                                .map(|a| a.to_string())
                                .unwrap_or_else(|| "null".to_string())
                        ));
                    }
                }
                out.push_str("]}");
                println!("{}", out);
            } else {
                println!("Mochi {} — runtime resolution (rust launcher)", VERSION);
                println!(
                    "  selected: {:<10} {}",
                    res.engine.as_str(),
                    human_line(res.chosen())
                );
                println!("  reason:   {}", res.reason);
                for (label, list) in [
                    ("standalone", &res.standalone),
                    ("node", &res.node),
                ] {
                    if list.is_empty() {
                        println!("  {:<10} (none found)", label);
                    }
                    for c in list {
                        println!("  {:<10} {}", label, human_line(c));
                    }
                }
                match find_agent_bin(roots) {
                    Some(p) => println!("  {:<10} {}", "rust-core", p.display()),
                    None => println!("  {:<10} (mochi-agent not found — hot paths run in TS)", "rust-core"),
                }
                println!("  force:    mochi node … | mochi standalone … | MOCHI_RUNTIME=node|standalone");
            }
            0
        }
    }
}

fn json_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn env_forced() -> Option<Engine> {
    match env::var("MOCHI_RUNTIME").ok().as_deref() {
        Some("standalone") => Some(Engine::Standalone),
        Some("node") => Some(Engine::Node),
        _ => None,
    }
}

fn main() {
    let argv: Vec<OsString> = env::args_os().collect();
    let args: Vec<OsString> = argv.into_iter().skip(1).collect();
    let words: Vec<String> = args
        .iter()
        .map(|a| a.to_string_lossy().into_owned())
        .collect();
    let roots = Roots::detect();

    let has_help = words.iter().any(|w| w == "-h" || w == "--help");
    let first = words.first().map(String::as_str).unwrap_or("");

    // ── fast paths: answer without booting an engine ──────────────────────
    if !has_help && (first == "--version" || first == "version") {
        print_version();
        return;
    }
    if !has_help && first == "runtime" {
        let json = words.iter().any(|w| w == "--json");
        std::process::exit(print_runtime_report(json, &roots));
    }

    // ── explicit engine selection ─────────────────────────────────────────
    let (forced, passthrough): (Option<Engine>, Vec<OsString>) = match first {
        "node" => (Some(Engine::Node), args[1..].to_vec()),
        "standalone" => (Some(Engine::Standalone), args[1..].to_vec()),
        _ => (env_forced(), args.clone()),
    };

    let res = match resolve(forced, &roots) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("mochi: {}", e);
            std::process::exit(127);
        }
    };

    // ── hand off (try the other engine before failing: degrade, don't crash) ──
    let mut error: Option<String> = exec_engine(res.engine, &res.path, &passthrough, &roots).err();
    if error.is_some() {
        // The selected engine wouldn't start — try whichever alternative
        // exists rather than dying on a stale or half-built artifact.
        let alt = match res.engine {
            Engine::Standalone => newest(&res.node).map(|c| (Engine::Node, c.path.clone())),
            Engine::Node => newest(&res.standalone).map(|c| (Engine::Standalone, c.path.clone())),
        };
        if let Some((engine, path)) = alt {
            eprintln!(
                "mochi: {} engine failed to start; falling back to {} ({})",
                res.engine.as_str(),
                engine.as_str(),
                path.display()
            );
            match exec_engine(engine, &path, &passthrough, &roots) {
                Ok(()) => return,
                Err(e2) => error = Some(e2),
            }
        } else {
            error.get_or_insert_with(|| format!("no {} engine available", res.engine.as_str()));
        }
    }
    eprintln!(
        "mochi: {}\n  (run `mochi runtime` to see every candidate, \
         `mochi node …` / `mochi standalone …` to pin one)",
        error.unwrap_or_else(|| "unknown launch failure".to_string())
    );
    std::process::exit(127);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    struct Fixture {
        root: PathBuf,
        roots: Roots,
    }

    impl Fixture {
        fn new(tag: &str) -> Fixture {
            let root = env::temp_dir().join(format!(
                "mochi-launcher-{}-{}-{}",
                tag,
                std::process::id(),
                SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            let exe_dir = root.join("bin");
            let home = root.join("home");
            fs::create_dir_all(&exe_dir).unwrap();
            fs::create_dir_all(&home).unwrap();
            // The pin env vars from the host environment would corrupt the
            // fixture: these tests assert discovery, not the user's pins.
            env::remove_var("MOCHI_STANDALONE");
            env::remove_var("MOCHI_NODE_ENTRY");
            env::remove_var("MOCHI_RUNTIME");
            Fixture {
                roots: Roots { exe_dir, home },
                root,
            }
        }

        fn write_newer(&self, rel: &str) -> PathBuf {
            let p = self.root.join(rel);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(&p, b"#!/bin/sh\n").unwrap();
            p
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn prefers_standalone_on_a_tie() {
        let fx = Fixture::new("tie");
        let s = fx.write_newer("bin/mochi-standalone");
        // Same-instant sibling artifact (a `build && build:bin` run).
        let n = fx.write_newer("home/mochi/dist/cli.js");
        assert!(mtime_delta_ms(
            fs::metadata(&s).unwrap().modified().ok(),
            fs::metadata(&n).unwrap().modified().ok(),
        ) <= Some(u128::from(TIE_WINDOW_SECS) * 1000));
        let res = resolve(None, &fx.roots).unwrap();
        assert_eq!(res.engine, Engine::Standalone);
        assert_eq!(res.path, s);
    }

    #[test]
    fn freshest_artifact_wins() {
        let fx = Fixture::new("fresh");
        // Standalone first (older), node entry 2.5s later (newer by > tie window).
        let s = fx.write_newer("bin/mochi-standalone");
        thread::sleep(Duration::from_millis(2500));
        let n = fx.write_newer("home/mochi/dist/cli.js");
        let res = resolve(None, &fx.roots).unwrap();
        assert_eq!(res.engine, Engine::Node, "newer node entry must win: {}", res.reason);
        assert_eq!(res.path, n);

        // And the reverse: a rebuilt standalone reclaims the default.
        thread::sleep(Duration::from_millis(2500));
        fs::write(&s, b"#!/bin/sh\n# rebuilt\n").unwrap();
        let res = resolve(None, &fx.roots).unwrap();
        assert_eq!(res.engine, Engine::Standalone);
        assert_eq!(res.path, s);
    }

    #[test]
    fn forced_engine_ignores_freshness() {
        let fx = Fixture::new("forced");
        thread::sleep(Duration::from_millis(2500));
        let _s = fx.write_newer("bin/mochi-standalone");
        let n = fx.write_newer("home/mochi/dist/cli.js");
        let res = resolve(Some(Engine::Node), &fx.roots).unwrap();
        assert_eq!(res.engine, Engine::Node);
        assert_eq!(res.path, n);
        assert!(res.reason.contains("forced"));
    }

    #[test]
    fn forced_engine_with_no_artifact_is_an_error_not_a_crash() {
        let fx = Fixture::new("missing");
        let _s = fx.write_newer("bin/mochi-standalone");
        let err = resolve(Some(Engine::Node), &fx.roots).unwrap_err();
        assert!(err.contains("node"), "error names the missing engine: {}", err);
        assert!(err.contains("MOCHI_NODE_ENTRY"), "error names the pin: {}", err);
    }

    #[test]
    fn discovers_source_checkout_relative_to_exe() {
        let fx = Fixture::new("ascend");
        // exe at <root>/dist/… walking up finds <root>/dist/cli.js? Exercise
        // the direct home checkout candidate instead: <home>/mochi/dist/cli.js.
        let n = fx.write_newer("home/mochi/dist/cli.js");
        let res = resolve(None, &fx.roots).unwrap();
        assert_eq!(res.engine, Engine::Node);
        assert_eq!(res.path, n);
    }

    #[test]
    fn ascend_finds_dist_next_to_a_checkout() {
        let fx = Fixture::new("sibling");
        let n = fx.write_newer("checkout/dist/cli.js");
        // Launcher installed inside the checkout's native/bin.
        let exe = fx.write_newer("checkout/native/bin/mochi");
        let roots = Roots {
            exe_dir: exe.parent().unwrap().to_path_buf(),
            home: fx.roots.home.clone(),
        };
        let res = resolve(None, &roots).unwrap();
        assert_eq!(res.path, n, "ascending from native/bin must find ../dist/cli.js");
    }

    #[test]
    fn nothing_found_reports_every_probe() {
        let fx = Fixture::new("empty");
        let err = resolve(None, &fx.roots).unwrap_err();
        assert!(err.contains("no Mochi runtime found"), "{}", err);
        assert!(err.contains("mochi-standalone"), "{}", err);
        assert!(err.contains("cli.js"), "{}", err);
    }

    #[test]
    fn explicit_pin_replaces_discovery() {
        let fx = Fixture::new("pin");
        let _disc = fx.write_newer("bin/mochi-standalone");
        let pinned = fx.write_newer("pinned/mochi-standalone");
        env::set_var("MOCHI_STANDALONE", &pinned);
        let res = resolve(None, &fx.roots).unwrap();
        assert_eq!(res.path, pinned);
        assert_eq!(res.standalone.len(), 1);
        env::remove_var("MOCHI_STANDALONE");
    }

    #[test]
    fn agent_bin_is_exported_for_the_ts_layer() {
        let fx = Fixture::new("agent");
        let agent = fx.write_newer("home/.local/bin/mochi-agent");
        assert_eq!(find_agent_bin(&fx.roots).unwrap(), agent);
        // A stale pin must not win over a real discovery.
        env::set_var("MOCHI_AGENT_BIN", "/nonexistent/mochi-agent");
        assert_eq!(find_agent_bin(&fx.roots).unwrap(), agent);
        env::remove_var("MOCHI_AGENT_BIN");
    }

    #[test]
    fn json_output_is_escaping_safe() {
        assert_eq!(json_str("a\"b\\c"), "\"a\\\"b\\\\c\"");
        assert_eq!(json_str("\n\t"), "\"\\n\\t\"");
    }
}
