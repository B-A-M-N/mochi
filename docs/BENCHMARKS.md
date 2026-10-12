# Mochi Comprehensive Performance & Efficiency Benchmarks

## Re-measure — 2026-10-12, Mochi 0.23.0 (current, reproducible)

Run by `node bench/cli-matrix.mjs` on the same machine (Linux x86_64, Ryzen 9,
NVMe). Method: warm page cache, `<cli> --version`, N runs per harness, p50 +
mean wall time, peak RSS from the kernel via GNU time `%M`. The August matrix
below predates 0.23.0 and its "1st everywhere" framing is not reproducible on
this hardware — it is kept as history, not as a claim.

### Startup fix, same day (2026-10-12, post `--bytecode`)

The first slice (below) showed the standalone binary as our SLOWEST path —
bun re-parsed the whole flattened bundle on every spawn. Fix: `build:bin` now
passes `--minify --bytecode --no-compile-autoload-dotenv
--no-compile-autoload-bunfig` (bytecode precompiles the bundle at build time),
and `src/cli.ts` lost its last top-level `await` to make the CJS conversion
possible. The npm entry also got ~15% leaner (repo module lazy-loaded).

Measured AFTER the fix, same machine, load ≈ 7, 5 runs each:

| Harness | p50 | mean | peak RSS |
| :--- | ---: | ---: | ---: |
| claude | 22 ms | 23 ms | 36 MB |
| codex | 21 ms | 22 ms | 22 MB |
| jcode | 32 ms | 32 ms | 22 MB |
| **mochi (npm/node)** | **69 ms** | **80 ms** | **47 MB** |
| **mochi (bin)** | **76 ms** | **77 ms** | 51 MB |
| mochi (bun-run) | 104 ms | 116 ms | 41 MB |
| crush | 220 ms | 190 ms | 43 MB |
| opencode | 281 ms | 279 ms | 90 MB |
| agy | 740 ms | 765 ms | 143 MB |
| pi | 1635 ms | 1944 ms | 156 MB |

Binary `--version`: 464 ms wall / 248 ms CPU → **76 ms wall / 80 ms CPU
(4.7× wall)**. npm entry: 96 → 82 ms CPU (node's own floor is 45 ms CPU; the
entry's remaining overhead is ~37 ms of module init).

### First slice (before the fix, unloaded machine, 10 runs)

| Harness | p50 | mean | peak RSS |
| :--- | ---: | ---: | ---: |
| claude | 21 ms | 21 ms | 36 MB |
| codex | 20 ms | 20 ms | 22 MB |
| jcode | 23 ms | 23 ms | 24 MB |
| **mochi (node)** | **77 ms** | **76 ms** | **48 MB** |
| crush | 78 ms | 75 ms | 44 MB |
| opencode | 215 ms | 240 ms | 91 MB |
| agy | 316 ms | 282 ms | 142 MB |
| pi | 2090 ms | 2217 ms | 157 MB |

**Loaded machine (load 8–10, same command, 3–5 runs):** every harness inflates
roughly 1.6–1.9× (mochi node 128–166 ms, mochi-bin 322 ms, opencode 375 ms,
claude 32 ms, pi 3–5 s). Rankings are stable across load states; absolute
numbers are not — always cite the load.

Honest conclusions from this slice:

- **Startup/memory leaders:** codex and jcode (~20 ms, ~22 MB). After the
  same-day `--bytecode` fix, mochi's two shipped paths sit in the fast pack:
  npm/node p50 69 ms and the standalone binary 76 ms (from 464 ms) — still
  behind the compiled leaders, ahead of crush/opencode/agy/pi. Node's own
  floor (45 ms CPU before mochi loads one line) caps what the npm path can
  ever reach; the binary path's remaining gap is bun runtime startup.
- **Mochi's memory is ~half of opencode's and a third of agy's** at this
  trivial workload — the lazy-import discipline (bench/memory.mjs regression
  gate in CI, ceilings 80/95 MB) is what keeps it there.
- The trivial `--version` path measures harness init, not model work. The
  real differentiators (context engine, speculation, sandbox) are not
  captured here; arena task-suite numbers (`bench/arena.mjs`) are the
  quality-side counterpart and are still TODO on this hardware.

---

## Historical matrix (August 2026 — pre-0.23.0, hardware/methodology as documented below)

This document contains standardized empirical benchmarks comparing **Mochi** (powered by its compiled zero-dependency Rust runtime core and TypeScript TUI frontend) against major terminal AI coding agents and CLI harnesses: **jcode**, **Claude Code**, **Cursor Agent**, **GitHub Copilot CLI**, **OpenCode**, **Codex CLI**, **Pi**, and **Antigravity CLI**.

All tests were executed on Linux x86_64 (6.11 Kernel, AMD Ryzen 9 / 64 GB DDR5 RAM, NVMe PCIe 4.0 storage) across 10 independent launches per metric with PSS memory profiling and high-resolution PTY timing probes.

> **Regression gate:** `npm run bench:memory` measures fresh-process RSS for the
> codegraph import (~46MB) and the full runtime import chain (~61MB) and fails
> above ceilings (80MB / 95MB). It runs in CI after every build — this is what
> keeps the lazy-loading wins from regressing (eager grammar/compiler loading
> used to cost ~158MB on import).

---

## Summary Benchmark Matrix

| Metric | Mochi (Rust Core) | jcode | Pi | Codex CLI | Antigravity CLI | Cursor Agent | Copilot CLI | Claude Code | OpenCode |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1 Active Session (PSS)** | **18.2 MB** [1st] | 27.8 MB | 144.4 MB | 140.0 MB | 243.7 MB | 214.9 MB | 333.3 MB | 386.6 MB | 371.5 MB |
| **10 Active Sessions (PSS)**| **84.5 MB** [1st] | 117.0 MB | 833.0 MB | 334.8 MB | 1021.2 MB | 1632.4 MB | 1756.5 MB | 2300.6 MB | 3237.2 MB |
| **Memory / Added Session** | **~6.8 MB** [1st] | ~9.9 MB | ~76.5 MB | ~21.6 MB | ~86.4 MB | ~157.5 MB | ~158.1 MB | ~212.7 MB | ~318.4 MB |
| **Time to First Frame (TTFF)**| **11.2 ms** [1st] | 14.0 ms | 590.7 ms | 882.8 ms | 383.5 ms | 1949.7 ms | 1518.6 ms | 3436.9 ms | 1035.9 ms |
| **Time to First Input (TTFI)**| **38.2 ms** [1st] | 48.7 ms | 596.4 ms | 905.8 ms | 383.7 ms | 1978.7 ms | 1583.4 ms | 3512.8 ms | 1047.9 ms |
| **Compaction Cut Latency** | **0.12 ms** (Rust) [1st]| 0.45 ms | 12.8 ms | 18.2 ms | 8.4 ms | 14.5 ms | 22.1 ms | 35.0 ms | 19.8 ms |
| **Fuzzy Search 50k Files** | **3.8 ms** (N-API) [1st] | 8.2 ms | 142.0 ms | 98.4 ms | 64.2 ms | 112.0 ms | 185.0 ms | 310.0 ms | 195.0 ms |
| **Tool Dispatch Latency** | **0.08 ms** [1st] | 0.22 ms | 2.4 ms | 1.8 ms | 1.2 ms | 3.5 ms | 4.8 ms | 6.2 ms | 3.9 ms |

---

## 1. Memory Consumption (PSS)

### 1 Active Session
Measures Proportional Set Size (PSS) after starting a single interactive session, rendering the UI, and waiting for user input.

```
Mochi (Rust Core)        [██] 18.2 MB (Industry Leading)
jcode (local embed off)  [███] 27.8 MB (1.5× Mochi)
Codex CLI                [██████████████] 140.0 MB (7.7× Mochi)
pi                       [███████████████] 144.4 MB (7.9× Mochi)
jcode (default)          [█████████████████] 167.1 MB (9.2× Mochi)
Cursor Agent             [█████████████████████] 214.9 MB (11.8× Mochi)
Antigravity CLI          [████████████████████████] 243.7 MB (13.4× Mochi)
GitHub Copilot CLI       [█████████████████████████████████] 333.3 MB (18.3× Mochi)
OpenCode                 [█████████████████████████████████████] 371.5 MB (20.4× Mochi)
Claude Code              [███████████████████████████████████████] 386.6 MB (21.2× Mochi)
```

### 10 Active Sessions (Daemon & Concurrent Swarms)
Measures memory footprint under 10 concurrent daemon jobs or termix split-session panes:

```
Mochi (Rust Core)        [██] 84.5 MB
jcode (local embed off)  [███] 117.0 MB
jcode (default)          [██████] 260.8 MB
Codex CLI                [████████] 334.8 MB
pi                       [████████████████████] 833.0 MB
Antigravity CLI          [█████████████████████████] 1021.2 MB
Cursor Agent             [████████████████████████████████████████] 1632.4 MB
GitHub Copilot CLI       [███████████████████████████████████████████] 1756.5 MB
Claude Code              [█████████████████████████████████████████████████████] 2300.6 MB
OpenCode                 [███████████████████████████████████████████████████████████████████████] 3237.2 MB
```

---

## 2. Launch Latency & UI Responsiveness

### Time to First Frame (TTFF)
Measures the duration from launching the binary in a PTY until the first ANSI terminal frame is flushed to the screen.

```
Mochi (Rust Core + Node) 11.2 ms  [⚡ 1.25× faster than jcode]
jcode                    14.0 ms  [Baseline]
Antigravity CLI          383.5 ms [27.4× slower]
pi                       590.7 ms [42.2× slower]
Codex CLI                882.8 ms [63.1× slower]
OpenCode                 1035.9 ms [74.0× slower]
GitHub Copilot CLI       1518.6 ms [108.5× slower]
Cursor Agent             1949.7 ms [139.3× slower]
Claude Code              3436.9 ms [245.5× slower]
```

### Time to First Input (TTFI)
Measures the duration until the prompt cursor is active, event listeners are registered, and keystrokes are echoed.

```
Mochi                    38.2 ms  [⚡ 1.27× faster than jcode]
jcode                    48.7 ms  [Baseline]
Antigravity CLI          383.7 ms [7.9× slower]
pi                       596.4 ms [12.2× slower]
Codex CLI                905.8 ms [18.6× slower]
OpenCode                 1047.9 ms [21.5× slower]
GitHub Copilot CLI       1583.4 ms [32.5× slower]
Cursor Agent             1978.7 ms [40.6× slower]
Claude Code              3512.8 ms [72.2× slower]
```

---

## 3. Computational Hot-Path Benchmarks

### Context Compaction & Cut Planning (250-turn transcript)
- **Mochi (Rust Native `plan_compaction_cut`)**: **0.12 ms** (Zero GC pressure, O(n) walk in compiled Rust)
- **Mochi TypeScript Fallback**: **0.45 ms**
- **Other JS/Python Agents**: **8.4 ms – 35.0 ms**

### BPE Token Counting (100,000 characters)
- **Mochi (Rust Native `nativeCountTokens`)**: **0.28 ms** (Compiled heuristic BPE tokenizer)
- **JavaScript `js-tiktoken`**: **4.9 ms**
- **Python `tiktoken` bindings**: **2.1 ms**

### Workspace File Indexing (50,000 files)
- **Mochi (Rust Native N-API `nativeSearchDir`)**: **3.8 ms**
- **Ripgrep Subprocess Spawn**: **18.4 ms**
- **Node `fs.readdir` recursive**: **142.0 ms**

---

## 4. Why Mochi Outperforms Other Agents

1. **Dual-Engine Architecture**: Pure compute operations (tokenization, token budgeting, compaction cut math, repo file indexing, diff calculation) execute in compiled zero-dependency Rust with direct N-API in-process memory sharing.
2. **Zero Startup Blockers**: No synchronous shell probe executions during initial frame generation.
3. **No Heavy Webview / Electron Overhead**: Direct terminal ANSI rendering using optimized terminal buffers.
4. **Intelligent Caching**: In-memory read cache keyed by `(mtime, size)` eliminates redundant filesystem I/O across parallel agent turns.
5. **Headless & Scalable**: Runs on low-end servers, embedded environments, or resource-constrained CI nodes using under 20 MB of RAM.
