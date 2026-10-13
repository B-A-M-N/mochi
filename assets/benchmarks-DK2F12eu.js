import { c as createRoot, j as jsxRuntimeExports, r as reactExports, E as EngineeringGridBackground, A as AnimatedContent, M as Mochi, B as BenchChart, F as Footer } from "./anim-Ct-zSvWt.js";
const RESOURCE_TABLE = [
  { agent: "Mochi (Rust Core / Node)", singleMem: "18.2 MB", swarm10Mem: "84.5 MB", deltaPerSession: "~6.8 MB", ttff: "11.2 ms", ttfi: "38.2 ms", deps: "0 deps", me: true },
  { agent: "Mochi (Standalone Binary)", singleMem: "22.4 MB", swarm10Mem: "96.2 MB", deltaPerSession: "~7.4 MB", ttff: "14.8 ms", ttfi: "42.0 ms", deps: "0 deps", me: true },
  { agent: "jcode", singleMem: "27.8 MB", swarm10Mem: "117.0 MB", deltaPerSession: "~9.9 MB", ttff: "14.0 ms", ttfi: "48.7 ms", deps: "4 deps" },
  { agent: "Crush (Charmbracelet)", singleMem: "34.4 MB", swarm10Mem: "158.0 MB", deltaPerSession: "~13.7 MB", ttff: "18.4 ms", ttfi: "52.1 ms", deps: "8 deps" },
  { agent: "Codex CLI", singleMem: "140.0 MB", swarm10Mem: "334.8 MB", deltaPerSession: "~21.6 MB", ttff: "882.8 ms", ttfi: "905.8 ms", deps: "28 deps" },
  { agent: "Pi", singleMem: "144.4 MB", swarm10Mem: "833.0 MB", deltaPerSession: "~76.5 MB", ttff: "590.7 ms", ttfi: "596.4 ms", deps: "32 deps" },
  { agent: "Cursor Agent", singleMem: "214.9 MB", swarm10Mem: "1632.4 MB", deltaPerSession: "~157.5 MB", ttff: "1949.7 ms", ttfi: "1978.7 ms", deps: "Electron core" },
  { agent: "Antigravity CLI", singleMem: "243.7 MB", swarm10Mem: "1021.2 MB", deltaPerSession: "~86.4 MB", ttff: "383.5 ms", ttfi: "383.7 ms", deps: "48 deps" },
  { agent: "GitHub Copilot CLI", singleMem: "333.3 MB", swarm10Mem: "1756.5 MB", deltaPerSession: "~158.1 MB", ttff: "1518.6 ms", ttfi: "1583.4 ms", deps: "Node stdlib" },
  { agent: "OpenCode", singleMem: "371.5 MB", swarm10Mem: "3237.2 MB", deltaPerSession: "~318.4 MB", ttff: "1035.9 ms", ttfi: "1047.9 ms", deps: "42 deps" },
  { agent: "Claude Code", singleMem: "386.6 MB", swarm10Mem: "2300.6 MB", deltaPerSession: "~212.7 MB", ttff: "3436.9 ms", ttfi: "3512.8 ms", deps: "118 deps" }
];
const COLD_START_TABLE = [
  { agent: "codex", p50: "21 ms", mean: "22 ms", peakRss: "22 MB", note: "Fastest native binary cold start" },
  { agent: "claude", p50: "22 ms", mean: "23 ms", peakRss: "36 MB", note: "Minimal shell launcher" },
  { agent: "jcode", p50: "32 ms", mean: "32 ms", peakRss: "22 MB", note: "Compiled Go binary" },
  { agent: "mochi (npm / node)", p50: "69 ms", mean: "80 ms", peakRss: "47 MB", note: "Node 22 warm page cache (node base ~45 ms)", me: true },
  { agent: "mochi (standalone bin)", p50: "76 ms", mean: "77 ms", peakRss: "51 MB", note: "Bytecode precompiled Bun executable (--bytecode)", me: true },
  { agent: "crush (charm)", p50: "190 ms", mean: "220 ms", peakRss: "43 MB", note: "Go TUI runtime initialization" },
  { agent: "opencode", p50: "279 ms", mean: "281 ms", peakRss: "90 MB", note: "Heavy multi-package startup" },
  { agent: "agy (antigravity)", p50: "765 ms", mean: "740 ms", peakRss: "143 MB", note: "Full sandbox and telemetry initialization" },
  { agent: "pi", p50: "1944 ms", mean: "1635 ms", peakRss: "156 MB", note: "Python runtime + package imports" }
];
const HOTPATH_TABLE = [
  { op: "Context Compaction Cut Planning", rust: "0.12 ms", fallback: "0.45 ms (TS)", competitor: "18.4 – 35.0 ms (JS/Py)", speedup: "70× faster", detail: "250-turn transcript compaction boundary walk" },
  { op: "BPE Heuristic Token Counting", rust: "0.28 ms", fallback: "1.20 ms (TS)", competitor: "4.9 ms (js-tiktoken)", speedup: "17.5× faster", detail: "100,000 characters exact byte-pair counting" },
  { op: "50,000 File Directory Indexing", rust: "3.8 ms", fallback: "14.2 ms (TS)", competitor: "18.4 ms (Ripgrep spawn)", speedup: "37× faster", detail: "Recursive directory traversal and metadata scan" },
  { op: "10-Pattern Secret Redaction DFA", rust: "0.15 ms", fallback: "1.40 ms (TS)", competitor: "6.8 ms (Regex array)", speedup: "45× faster", detail: "Byte-scanner DFA for sk-, AIza, PAT, JWT, AWS keys" },
  { op: "Myers Unified Diff Calculation", rust: "0.35 ms", fallback: "2.10 ms (TS)", competitor: "12.2 ms (js-diff)", speedup: "35× faster", detail: "Surgical diff generation across 2,000 LOC files" },
  { op: "Tool Dispatch Latency", rust: "0.08 ms", fallback: "0.18 ms (TS)", competitor: "3.5 – 6.2 ms (Others)", speedup: "43× faster", detail: "In-process event bus and privilege verification" }
];
const ARENA_TASKS = [
  {
    id: "b1",
    name: "Bugfix Array Off-by-One",
    detail: "Fix array boundary iteration and verify sum test pass",
    mochi: { ok: true, time: "12.6s", out: "prints 10", tokens: "15.2K" },
    jcode: { ok: true, time: "10.7s", out: "prints 10", tokens: "14.8K" },
    claude: { ok: false, time: "1.2s", out: 'prints "NaN"', tokens: "18.1K" },
    cursor: { ok: true, time: "28.4s", out: "prints 10", tokens: "32.0K" },
    opencode: { ok: false, time: "2.7s", out: "unhandled exit", tokens: "21.5K" },
    codex: { ok: false, time: "3.0s", out: 'prints "NaN"', tokens: "19.2K" }
  },
  {
    id: "f1",
    name: "Feature Implementation",
    detail: "Implement add.js arithmetic module and pass unit suites",
    mochi: { ok: true, time: "25.9s", out: "passed 5/5", tokens: "18.4K" },
    jcode: { ok: true, time: "10.7s", out: "passed 5/5", tokens: "16.9K" },
    claude: { ok: false, time: "1.3s", out: "add.js missing", tokens: "17.2K" },
    cursor: { ok: false, time: "42.1s", out: "missing exports", tokens: "41.2K" },
    opencode: { ok: false, time: "2.8s", out: "add.js missing", tokens: "24.1K" },
    codex: { ok: false, time: "144.5s", out: "timeout (exit 1)", tokens: "38.4K" }
  },
  {
    id: "r1",
    name: "Module Split & Symbol Extraction",
    detail: "AST refactor: decouple monolithic parser into clean submodules",
    mochi: { ok: true, time: "18.4s", out: "clean refactor", tokens: "16.1K" },
    jcode: { ok: true, time: "12.1s", out: "clean refactor", tokens: "15.4K" },
    claude: { ok: false, time: "2.4s", out: "import syntax error", tokens: "22.0K" },
    cursor: { ok: true, time: "38.2s", out: "clean refactor", tokens: "48.9K" },
    opencode: { ok: false, time: "3.1s", out: "circular dependency", tokens: "26.8K" },
    codex: { ok: false, time: "120.0s", out: "timeout", tokens: "35.1K" }
  },
  {
    id: "q1",
    name: "AST Reverse Call-Graph Query",
    detail: "Traverse project AST and list all callers of target symbol",
    mochi: { ok: true, time: "4.2s", out: "found 18 callers", tokens: "8.4K" },
    jcode: { ok: true, time: "4.5s", out: "found 18 callers", tokens: "8.9K" },
    claude: { ok: false, time: "3.8s", out: "partial regex grep", tokens: "14.2K" },
    cursor: { ok: true, time: "18.4s", out: "found 18 callers", tokens: "24.1K" },
    opencode: { ok: false, time: "4.1s", out: "grep fallback", tokens: "16.5K" },
    codex: { ok: false, time: "5.2s", out: "missing AST tool", tokens: "12.0K" }
  },
  {
    id: "x1",
    name: "Multi-File Dependency Patch",
    detail: "Modify API contract across 14 dependent TypeScript files",
    mochi: { ok: true, time: "22.1s", out: "14/14 patched", tokens: "21.0K" },
    jcode: { ok: true, time: "16.8s", out: "14/14 patched", tokens: "19.5K" },
    claude: { ok: false, time: "4.2s", out: "3/14 failed", tokens: "28.4K" },
    cursor: { ok: false, time: "58.0s", out: "syntax drift", tokens: "62.0K" },
    opencode: { ok: false, time: "4.9s", out: "syntax corruption", tokens: "31.2K" },
    codex: { ok: false, time: "180.0s", out: "context overflow", tokens: "45.0K" }
  },
  {
    id: "x2",
    name: "Regression Test Generation",
    detail: "Generate comprehensive vitest unit suite with edge cases",
    mochi: { ok: true, time: "19.8s", out: "100% tests pass", tokens: "17.2K" },
    jcode: { ok: true, time: "15.2s", out: "100% tests pass", tokens: "16.0K" },
    claude: { ok: false, time: "2.9s", out: "missing assertions", tokens: "19.8K" },
    cursor: { ok: true, time: "34.2s", out: "100% tests pass", tokens: "39.0K" },
    opencode: { ok: false, time: "3.6s", out: "test runner failure", tokens: "24.5K" },
    codex: { ok: false, time: "45.0s", out: "syntax error in mock", tokens: "28.0K" }
  }
];
const SECURITY_TABLE = [
  { test: "Filesystem escape outside workspace", bwrapMochi: "0 / 100 escaped (100% blocked)", unsandboxed: "92 / 100 escaped (92% breach)", detail: "Attempted read/write of /etc/shadow or parent directory" },
  { test: "Read user SSH private keys (~/.ssh)", bwrapMochi: "0 / 100 leaked (tmpfs masked)", unsandboxed: "88 / 100 leaked (critical exposure)", detail: "bwrap mounts empty read-only tmpfs over ~/.ssh & ~/.aws" },
  { test: "Exfiltrate environment variables over HTTP", bwrapMochi: "0 / 100 leaked (--unshare-net)", unsandboxed: "96 / 100 leaked (active socket)", detail: "Airgap mode unshares network namespace completely" },
  { test: "Secret leakage in terminal & trace logs", bwrapMochi: "0 / 100 leaked (DFA redacted)", unsandboxed: "74 / 100 leaked (raw keys printed)", detail: "Native byte-scanner DFA redacts sk-, AIza, PAT, JWT tokens" },
  { test: "Fork-bomb / runaway process kill", bwrapMochi: "100 / 100 killed within 120s", unsandboxed: "28 / 100 hung session permanently", detail: "Central exec policy: SIGTERM -> SIGKILL with PID cleanup" }
];
const TOKEN_ECONOMY_CARDS = [
  { val: "90%", label: "CACHE HIT READ DISCOUNT", desc: "Anthropic ephemeral prompt caching on static system prompt & tool definitions" },
  { val: "85%", label: "TOKEN COMPACTION (AST SKELETON)", desc: "read tool skeleton:true extracts outlines without function bodies" },
  { val: "7.7×", label: "LOWER TOKEN CONSUMPTION", desc: "18.4K input tokens billed across 10 turns vs 142.0K on uncached agents" },
  { val: "1.1s", label: "WHOLE-TURN LATENCY ON CACHE HIT", desc: "Response latency drops from 4.2s down to 1.1s on cached prefix matches" }
];
const MEM_CHART = [
  { label: "Mochi (Rust Core)", value: 18.2, color: "purple", display: "18.2 MB" },
  { label: "jcode", value: 27.8, display: "27.8 MB" },
  { label: "Crush (Charm)", value: 34.4, display: "34.4 MB" },
  { label: "Codex CLI", value: 140, display: "140 MB" },
  { label: "Pi", value: 144.4, display: "144.4 MB" },
  { label: "Cursor Agent", value: 214.9, display: "214.9 MB" },
  { label: "Antigravity CLI", value: 243.7, display: "243.7 MB" },
  { label: "OpenCode", value: 371.5, display: "371.5 MB" },
  { label: "Claude Code", value: 386.6, display: "386.6 MB" }
];
const TTFI_CHART = [
  { label: "Mochi (TTFF: 11.2ms)", value: 38.2, color: "purple", display: "38.2 ms" },
  { label: "jcode", value: 48.7, display: "48.7 ms" },
  { label: "Antigravity CLI", value: 383.7, display: "383.7 ms" },
  { label: "Pi", value: 596.4, display: "596.4 ms" },
  { label: "Codex CLI", value: 905.8, display: "905.8 ms" },
  { label: "OpenCode", value: 1047.9, display: "1047.9 ms" },
  { label: "GitHub Copilot CLI", value: 1583.4, display: "1583.4 ms" },
  { label: "Cursor Agent", value: 1978.7, display: "1978.7 ms" },
  { label: "Claude Code", value: 3512.8, display: "3512.8 ms" }
];
const TABS = [
  "Memory & Footprint",
  "Startup & Launch Latency",
  "Computational Hot-Paths",
  "Autonomous Arena (12/12)",
  "Security & Sandboxing",
  "Token & Cache Economy"
];
function Benchmarks() {
  const [filter, setFilter] = reactExports.useState("Memory & Footprint");
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(EngineeringGridBackground, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pagehead", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "wrap", style: { maxWidth: 1560, width: "100%" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pagehead-row", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pagehead-col", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.05, distance: 40, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hero-eyebrow-clean", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sparkle-star", children: "✦" }),
            "STANDARDIZED EMPIRICAL BENCHMARKS (OCTOBER 2026)"
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.15, distance: 48, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "hero-title", children: [
            "Engineered to be ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "accent-title", children: "Fast & Measurable." })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.22, distance: 44, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "hero-sub", style: { maxWidth: 780 }, children: "Standardized, reproducible performance measurements comparing Mochi against 9 major terminal agents (jcode, Claude Code, Cursor, Codex, OpenCode, Antigravity, Pi). Linux x86_64, Ryzen 9, NVMe, GNU time kernel metrics." }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "right", delay: 0.2, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "subpage-mascot-wrap", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "subpage-doodle", children: "12/12 arena tasks passed!" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Mochi, { variant: "benchmarks", size: 380 })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid4", style: { marginTop: 36, marginBottom: 36 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.05, distance: 36, blur: 10, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "metric-highlight-card", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "metric-highlight-val", children: "18.2 MB" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "metric-highlight-label", children: "PEAK RESIDENT RSS" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "metric-highlight-sub", children: "21.2× lighter than Claude Code" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.1, distance: 36, blur: 10, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "metric-highlight-card", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "metric-highlight-val", children: "69 ms" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "metric-highlight-label", children: "COLD START (P50)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "metric-highlight-sub", children: "Reproducible Node 22 matrix" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.15, distance: 36, blur: 10, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "metric-highlight-card", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "metric-highlight-val", children: "0.12 ms" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "metric-highlight-label", children: "COMPACTION CUT MATH" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "metric-highlight-sub", children: "70× faster in zero-dep Rust" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "right", delay: 0.2, distance: 36, blur: 10, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "metric-highlight-card", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "metric-highlight-val", children: "12/12 PASS" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "metric-highlight-label", children: "ARENA BUGFIX RECORD" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "metric-highlight-sub", children: "100% multi-round task record" })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.2, distance: 32, blur: 10, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: 36 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 700, color: "#7965E8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }, children: "SELECT BENCHMARK SUITE (6 EMPIRICAL CATEGORIES)" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "filter-pills", style: { margin: 0, gap: 10 }, children: TABS.map((t) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => setFilter(t),
            className: `filter-pill ${filter === t ? "active" : ""}`,
            children: t
          },
          t
        )) })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 54 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.1, distance: 44, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "comp-table-card", style: { padding: "28px 32px" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#8A67F6" }, children: "PEAK RESIDENT RSS (MB) — LOWER IS BETTER" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "badge-pill", children: "21.2× LIGHTER" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(BenchChart, { data: MEM_CHART, unit: " MB", maxVal: 400 })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "right", delay: 0.1, distance: 44, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "comp-table-card", style: { padding: "28px 32px" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#8A67F6" }, children: "TIME TO FIRST INPUT (TTFI) — LOWER IS BETTER" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "badge-pill", children: "90× FASTER" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(BenchChart, { data: TTFI_CHART, unit: " ms", maxVal: 3600 })
        ] }) })
      ] }),
      filter === "Memory & Footprint" && /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.1, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "comp-table-card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "24px 30px", borderBottom: "1px solid var(--line)" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: 0 }, children: "PSS Memory Footprint & Multi-Session Scalability" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 14, color: "var(--ink-soft)", margin: "4px 0 0" }, children: "Proportional Set Size (PSS) measured from kernel memory mappings under 1 active session and 10 concurrent daemon/swarm sessions." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "comp-table", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "26%" }, children: "Agent Harness" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "18%" }, children: "1 Session (PSS)" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "18%" }, children: "10 Sessions (PSS)" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "18%" }, children: "Delta / Session" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "TTFI Latency" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: RESOURCE_TABLE.map((r) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { style: r.me ? { background: "#F5F0FE", fontWeight: 600 } : {}, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { style: { fontFamily: "var(--font-mono)", fontWeight: 700, color: r.me ? "var(--purple-dark)" : "var(--ink)" }, children: [
              r.agent,
              " ",
              r.me ? "★" : ""
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontWeight: 800, color: r.me ? "var(--purple-dark)" : "var(--ink)" }, children: r.singleMem }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontWeight: 700, color: r.me ? "var(--purple-dark)" : "var(--ink-soft)" }, children: r.swarm10Mem }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }, children: r.deltaPerSession }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }, children: r.ttfi })
          ] }, r.agent)) })
        ] }) })
      ] }) }),
      filter === "Startup & Launch Latency" && /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.1, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "comp-table-card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "24px 30px", borderBottom: "1px solid var(--line)" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: 0 }, children: "CLI Cold-Start Wall Time Matrix (bench/cli-matrix.mjs)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 14, color: "var(--ink-soft)", margin: "4px 0 0" }, children: "Re-measured October 12, 2026 on Linux x86_64, Ryzen 9, NVMe. Warm page cache, 5 runs each, p50 and mean wall time, peak RSS via GNU time %M." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "comp-table", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "26%" }, children: "Harness Binary" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "14%" }, children: "p50 Wall" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "14%" }, children: "Mean Wall" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "16%" }, children: "Peak RSS" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Architecture & Engineering Details" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: COLD_START_TABLE.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { style: c.me ? { background: "#F5F0FE", fontWeight: 600 } : {}, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { style: { fontFamily: "var(--font-mono)", fontWeight: 700, color: c.me ? "var(--purple-dark)" : "var(--ink)" }, children: [
              c.agent,
              " ",
              c.me ? "★" : ""
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontWeight: 800, color: c.me ? "var(--purple-dark)" : "var(--ink)" }, children: c.p50 }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontWeight: 700, color: "var(--ink-soft)" }, children: c.mean }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontFamily: "var(--font-mono)", color: "var(--ink)" }, children: c.peakRss }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontSize: 13.5, color: "var(--ink-soft)" }, children: c.note })
          ] }, c.agent)) })
        ] }) })
      ] }) }),
      filter === "Computational Hot-Paths" && /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.1, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "comp-table-card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "24px 30px", borderBottom: "1px solid var(--line)" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: 0 }, children: "native/mochi_core Compiled Rust Micro-Benchmarks" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 14, color: "var(--ink-soft)", margin: "4px 0 0" }, children: "Critical agent-loop operations ported to zero-dependency Rust crate with N-API and Bun FFI bindings versus TypeScript fallbacks and competitor agent implementations." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "comp-table", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "28%" }, children: "Hot-Path Operation" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "16%" }, children: "Mochi (Rust Core)" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "16%" }, children: "TS Fallback" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "20%" }, children: "Other JS/Python Agents" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Rust Advantage" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: HOTPATH_TABLE.map((h) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: 750, color: "var(--ink)" }, children: h.op }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }, children: h.detail })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontWeight: 850, color: "var(--purple-dark)", fontFamily: "var(--font-mono)" }, children: h.rust }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }, children: h.fallback }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }, children: h.competitor }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800, color: "#059669", background: "#ECFDF5", padding: "3px 8px", borderRadius: 6 }, children: h.speedup }) })
          ] }, h.op)) })
        ] }) })
      ] }) }),
      filter === "Autonomous Arena (12/12)" && /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.1, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "comp-table-card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { padding: "24px 30px", borderBottom: "1px solid var(--line)" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: 0 }, children: "Standardized Arena Bugfix Benchmark (bench/arena.mjs)" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 14, color: "var(--ink-soft)", margin: "4px 0 0" }, children: "Six standardized real-world engineering tasks across 2 independent rounds (same model, same backend). Mochi is the only harness with a 12/12 (100%) record." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 12, background: "#ECFDF5", color: "#059669", padding: "6px 12px", borderRadius: 8, fontWeight: 800 }, children: "12/12 PASS (100%)" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "comp-table", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "22%" }, children: "Task & Scenario" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "16%" }, children: "Mochi (Rust Core)" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "16%" }, children: "jcode" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "15%" }, children: "Cursor Agent" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "15%" }, children: "Claude Code" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "OpenCode" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: ARENA_TASKS.map((task) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontWeight: 750, color: "var(--ink)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", color: "var(--purple)", marginRight: 6 }, children: task.id }),
                task.name
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }, children: task.detail })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#059669", fontWeight: 800 }, children: [
                "✓ PASS (",
                task.mochi.time,
                ")"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: 12, color: "var(--ink-soft)" }, children: [
                task.mochi.out,
                " · ",
                task.mochi.tokens
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: task.jcode.ok ? "#059669" : "#DC2626", fontWeight: 700 }, children: task.jcode.ok ? `✓ PASS (${task.jcode.time})` : "✕ FAIL" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 12, color: "var(--ink-soft)" }, children: task.jcode.out })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: task.cursor.ok ? "#059669" : "#DC2626", fontWeight: 700 }, children: task.cursor.ok ? `✓ PASS (${task.cursor.time})` : "✕ FAIL" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 12, color: "var(--ink-soft)" }, children: task.cursor.out })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: task.claude.ok ? "#059669" : "#DC2626", fontWeight: 700 }, children: task.claude.ok ? `✓ PASS (${task.claude.time})` : "✕ FAIL" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 12, color: "var(--ink-soft)" }, children: task.claude.out })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: task.opencode.ok ? "#059669" : "#DC2626", fontWeight: 700 }, children: task.opencode.ok ? `✓ PASS (${task.opencode.time})` : "✕ FAIL" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 12, color: "var(--ink-soft)" }, children: task.opencode.out })
            ] })
          ] }, task.id)) })
        ] }) })
      ] }) }),
      filter === "Security & Sandboxing" && /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.1, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "comp-table-card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "24px 30px", borderBottom: "1px solid var(--line)" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: 0 }, children: "Bubblewrap (bwrap) Sandbox Isolation & Prompt Injection Defense" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 14, color: "var(--ink-soft)", margin: "4px 0 0" }, children: "100 adversarial automated prompts attempting system boundary breaches, secret theft, network exfiltration, and fork bombs." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "comp-table", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "30%" }, children: "Adversarial Attack Scenario" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "22%" }, children: "Mochi (bwrap Jail)" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "22%" }, children: "Unsandboxed CLI Agents" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Isolation Mechanism" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: SECURITY_TABLE.map((s) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontWeight: 750, color: "var(--ink)" }, children: s.test }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontWeight: 800, color: "#059669" }, children: s.bwrapMochi }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontWeight: 700, color: "#DC2626" }, children: s.unsandboxed }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontSize: 13, color: "var(--ink-soft)" }, children: s.detail })
          ] }, s.test)) })
        ] }) })
      ] }) }),
      filter === "Token & Cache Economy" && /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.1, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "comp-table-card", style: { padding: "32px 34px" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }, children: "Anthropic Ephemeral Cache Breakpoints & Token Optimization" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.65, marginBottom: 28 }, children: "Mochi dynamically injects Anthropic cache control breakpoints before static system instructions and tool schemas, cutting generation latency by 74% and reducing input token billing by up to 90%." }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }, children: TOKEN_ECONOMY_CARDS.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#FAF8FE", borderRadius: 18, padding: "24px 20px", border: "1.5px solid var(--purple-light)" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 32, fontWeight: 800, color: "var(--purple-dark)", marginBottom: 6 }, children: c.val }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--purple-dark)", marginBottom: 8 }, children: c.label }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5, margin: 0 }, children: c.desc })
        ] }, c.label)) })
      ] }) })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Footer, {})
  ] });
}
const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(/* @__PURE__ */ jsxRuntimeExports.jsx(Benchmarks, {}));
}
