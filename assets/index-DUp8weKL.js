import { c as createRoot, j as jsxRuntimeExports, E as EngineeringGridBackground, F as Footer, A as AnimatedContent, M as Mochi, a as EditorialReveal, r as reactExports, B as BenchChart } from "./anim-Ct-zSvWt.js";
const TICKER_ITEMS = [
  "18.2 MB RESIDENT RSS",
  "38.2 MS TTFI",
  "21.2× LIGHTER",
  "4.5× FASTER START",
  "BUBBLEWRAP SANDBOX",
  "16 SPECIALIST ROLES",
  "ZERO DEPS RUNTIME",
  "727 FILES AUDITED",
  "1,494 TESTS PASSING"
];
const SPECIALIST_ROLES = [
  {
    id: "lead",
    name: "Lead Orchestrator",
    tag: "DAG Root",
    badge: "Coordinator",
    desc: "Parses ambiguous user requests into formal execution DAGs, balances token budgets, and approves phase handoffs.",
    tools: ["dag_dispatch", "budget_audit", "checkpoint_commit"]
  },
  {
    id: "coder",
    name: "Core Coder",
    tag: "Act Phase",
    badge: "Implementation",
    desc: "Executes surgical tree-sitter AST patches and unified diffs. Preserves git blame and surrounding file invariants.",
    tools: ["apply_ast_patch", "ripgrep_search", "replace_symbol"]
  },
  {
    id: "architect",
    name: "System Architect",
    tag: "Spec Phase",
    badge: "Topology",
    desc: "Analyzes call graphs, blast radius, and module inter-dependencies across large monorepos before edits begin.",
    tools: ["blast_radius", "codegraph_query", "ast_slicer"]
  },
  {
    id: "reviewer",
    name: "Code Reviewer",
    tag: "Audit Gate",
    badge: "Quality",
    desc: "Performs multi-pass static analysis for race conditions, memory leaks, OWASP top 10, and architectural regressions.",
    tools: ["ast_lint", "diff_inspect", "security_scan"]
  },
  {
    id: "tester",
    name: "Test Synthesizer",
    tag: "TDD Gate",
    badge: "Verification",
    desc: "Generates unit tests, fuzz cases, and boundary assertions. Executes test runners in Bubblewrap sandboxes.",
    tools: ["run_test_suite", "synthesize_fixtures", "test_density"]
  },
  {
    id: "security",
    name: "Security Guardian",
    tag: "Policy Gate",
    badge: "Sandboxing",
    desc: "Enforces unprivileged Bubblewrap limits, masks sensitive credentials, and terminates anomalous outbound connections.",
    tools: ["bwrap_enforce", "credential_blackhole", "audit_log"]
  }
];
function HeroInstallBar() {
  const [copied, setCopied] = reactExports.useState(false);
  const command = "git clone https://github.com/xanstomper/mochi.git && cd mochi && npm install && npm run build && ./dist/cli.js";
  const handleCopy = (e) => {
    e.preventDefault();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(command).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      }).catch(() => {
        fallbackCopy();
      });
    } else {
      fallbackCopy();
    }
  };
  const fallbackCopy = () => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = command;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hero-install-wrap", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hero-install-box", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hero-install-code-wrap", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hero-install-prompt", children: "$" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("code", { className: "hero-install-code", title: command, children: command })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          id: "btn-copy-install",
          onClick: handleCopy,
          className: `hero-install-btn ${copied ? "copied" : ""}`,
          title: "Copy 1-line install command to clipboard",
          children: copied ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsxRuntimeExports.jsx("polyline", { points: "20 6 9 17 4 12" }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Copied!" })
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Copy" })
          ] })
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hero-install-hint", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#8A67F6" }, children: "✦" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "1-line git clone, compile, and launch" })
    ] })
  ] });
}
function HeroSection() {
  const base = typeof window !== "undefined" && window.location.pathname.startsWith("/mochi") ? "/mochi" : "";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "hero", id: "hero", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hero-copy", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.05, distance: 45, blur: 16, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hero-eyebrow-clean", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sparkle-star", children: "✦" }),
        "THE NEXT GENERATION AI CODING AGENT"
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.15, distance: 50, blur: 16, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "hero-title", children: [
        "A Softer Kind of",
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "accent-title", children: "Intelligence." })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.25, distance: 45, blur: 16, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "hero-sub", children: [
        "A minimal, powerful, and friendly AI coding intelligence.",
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        "Faster, smarter, and better than your premium coding agents,",
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        "built to be lightweight, reliable, and resource friendly."
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.35, distance: 40, blur: 16, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hero-actions", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "a",
          {
            href: "https://github.com/xanstomper/mochi/releases",
            className: "hero-btn-dl",
            target: "_blank",
            rel: "noopener",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("polyline", { points: "7 10 12 15 17 10" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })
              ] }),
              "Download"
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: base + "/docs.html", className: "hero-btn-docs", children: "Read the Docs →" })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.42, distance: 35, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsx(HeroInstallBar, {}) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hero-mascot", children: /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.2, duration: 0.85, distance: 30, blur: 16, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { position: "relative", display: "flex", justifyContent: "center" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Mochi, { size: 940 }) }) }) })
  ] });
}
function StatsTicker() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "stats-ticker", "aria-hidden": "true", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ticker-track", children: [...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ticker-item", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ticker-dot" }),
    item
  ] }, i)) }) });
}
function CapabilitiesSection() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "section", id: "capabilities", style: { maxWidth: 1560, margin: "0 auto", padding: "80px 4vw", scrollMarginTop: 100 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.05, blur: 12, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "section-tag-pill", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-sparkle", children: "✦" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-part-dark", children: "SECTION 03 /" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-part-purple", children: "WHY MOCHI?" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(EditorialReveal, { delay: 0.1, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "section-head-huge", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "section-title-huge", children: [
        "ARCHITECTURAL ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "accent-title", children: "DISCIPLINES" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "section-arrow-diag-huge", children: "↗" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.15, distance: 30, blur: 10, children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "section-desc", style: { fontSize: 17, color: "var(--ink-soft)", marginBottom: 40, maxWidth: 680 }, children: "Six core architectural disciplines that elevate Mochi above conventional AI wrappers — eliminating runaway hallucinated edits, preserving git blame, and enforcing kernel isolation." }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "editorial-showcase-container", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.12, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "editorial-split-showcase", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "editorial-split-left", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800, color: "#8A67F6" }, children: "01 // SPEC-VS-ACT PIPELINE" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 11, background: "#EDE8F8", color: "#111116", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }, children: "DAG Engine" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 28, fontWeight: 850, color: "#111116", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 16 }, children: "Dual-Phase Reasoning with Formal State DAGs" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 15.5, lineHeight: 1.7, color: "var(--ink-soft)", marginBottom: 24 }, children: "Planning is strictly decoupled from code mutation. In Spec mode, Mochi decomposes ambiguous user prompts into an immutable task dependency DAG, calculates blast radius, and locks the token quota. Only once validated does Act mode engage atomic filesystem writes." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11.5, background: "#F4EFFE", color: "#6D28D9", padding: "6px 12px", borderRadius: 8, fontWeight: 700 }, children: "✓ SPEC: Blast-radius mapped" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11.5, background: "#ECFDF5", color: "#047857", padding: "6px 12px", borderRadius: 8, fontWeight: 700 }, children: "✓ ACT: 12ms atomic patch" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11.5, background: "#EFF6FF", color: "#1D4ED8", padding: "6px 12px", borderRadius: 8, fontWeight: 700 }, children: "✓ GATE: Zero unverified commits" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "editorial-split-right", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "editorial-dark-terminal", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: 10, marginBottom: 14 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "rgba(255, 255, 255, 0.5)" }, children: "mochi-engine · spec_act_pipeline.dag" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#34D399", fontSize: 11 }, children: "● STATE: VERIFIED" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#A78BFA", marginBottom: 8 }, children: '$ mochi --spec "refactor session auth to redis cluster & update all call sites"' }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.7 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: "[SPEC] Decomposing objective into formal dependency DAG..." }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#6EE7B7" }, children: "[SPEC] Call graph mapped: 3 mutation targets · 14 read-only consumers" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#FDE047" }, children: "[SPEC] Token quota locked: 6,400 tokens · 0 runaway loops" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#C084FC", marginTop: 6 }, children: "[ACT] Handoff approved → executing surgical AST mutator" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#34D399" }, children: "[VERIFY] Bubblewrap sandbox test run: 32/32 tests green (138ms)" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#34D399", fontWeight: 700 }, children: "✓ Atomic git checkpoint #a481c0 committed in 14ms" })
          ] })
        ] }) })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "right", delay: 0.18, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "editorial-split-showcase", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "editorial-split-left", style: { background: "#FAF8FC" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "editorial-dark-terminal", style: { height: "100%", boxSizing: "border-box" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: 10, marginBottom: 14 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "rgba(255, 255, 255, 0.5)" }, children: "src/auth/jwt.ts · AST Node: RateLimitPolicy" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#34D399", fontSize: 11 }, children: "12MS SURGERY" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#818CF8", marginBottom: 6 }, children: "@@ -42,2 +42,2 @@ Tree-sitter AST Node: RateLimitPolicy" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#F87171", background: "rgba(239, 68, 68, 0.12)", padding: "2px 6px", borderRadius: 4, marginBottom: 4 }, children: "-   const maxRps = currentTier === 'free' ? 10 : 100;" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#34D399", background: "rgba(52, 211, 153, 0.12)", padding: "2px 6px", borderRadius: 4, marginBottom: 8 }, children: "+   const maxRps = currentTier === 'free' ? 25 : 250; // Surgical patch: 12ms" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "rgba(255, 255, 255, 0.65)", lineHeight: 1.6, fontSize: 12, borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 10 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#34D399" }, children: "✓ Tree-sitter grammar validated: 0 syntax errors" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#A78BFA" }, children: "✓ 100% git blame preserved across surrounding 448 lines" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#6EE7B7" }, children: "✓ 99.4% token waste eliminated vs whole-file rewrite" })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "editorial-split-right", style: { background: "#ffffff" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800, color: "#8A67F6" }, children: "02 // AST SURGICAL MUTATION" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 11, background: "#EDE8F8", color: "#111116", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }, children: "Zero Hallucination" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 28, fontWeight: 850, color: "#111116", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 16 }, children: "Surgical AST Differ vs. Naive File Rewriting" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 15.5, lineHeight: 1.7, color: "var(--ink-soft)", marginBottom: 24 }, children: "Conventional coding agents rewrite entire 400-line files from scratch, burning 12,000+ tokens on unchanged boilerplate, hallucinating missing imports, and destroying git blame history. Mochi’s tree-sitter engine isolates the exact AST node and applies whitespace-tolerant unified patches in 12ms." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11.5, background: "#F4EFFE", color: "#6D28D9", padding: "6px 12px", borderRadius: 8, fontWeight: 700 }, children: "✓ 99.4% Less Token Waste" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11.5, background: "#ECFDF5", color: "#047857", padding: "6px 12px", borderRadius: 8, fontWeight: 700 }, children: "✓ 100% Git Blame Safe" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11.5, background: "#EFF6FF", color: "#1D4ED8", padding: "6px 12px", borderRadius: 8, fontWeight: 700 }, children: "✓ Multi-File Single Pass" })
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.22, distance: 40, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "editorial-hairline-strip", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "editorial-hairline-col", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#8A67F6", marginBottom: 8, textTransform: "uppercase" }, children: "03 // ISOLATION" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { fontSize: 18, fontWeight: 800, color: "#111116", marginBottom: 10 }, children: "Bubblewrap Hardware Jail" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: "0 0 16px" }, children: [
              "Unprivileged user namespaces mount ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "/usr" }),
              " and ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "/bin" }),
              " read-only, blackhole ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "~/.ssh" }),
              " and ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "~/.aws" }),
              " via tmpfs masks, and prevent prompt breakouts."
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, background: "#EDE8F8", color: "#8A67F6", padding: "4px 10px", borderRadius: 6, fontWeight: 700, width: "fit-content" }, children: "MOCHI_SANDBOX=bwrap" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "editorial-hairline-col", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#8A67F6", marginBottom: 8, textTransform: "uppercase" }, children: "04 // RESILIENCE" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { fontSize: 18, fontWeight: 800, color: "#111116", marginBottom: 10 }, children: "Multi-Model Router" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: "0 0 16px" }, children: "Hot-swap any backup provider (Anthropic Claude Sonnet 5.5 & Claude Opus 5.5, OpenAI GPT-5.5 Astra, GPT-5 & o5, DeepSeek V4 Flash & R1, Google Gemini 2.5 Pro & 3.0 Ultra, Kimi k3, GLM-5.3, or local Ollama / llama.cpp) mid-session with multi-key pool rotation and zero lost state." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, background: "#EDE8F8", color: "#8A67F6", padding: "4px 10px", borderRadius: 6, fontWeight: 700, width: "fit-content" }, children: "Zero-Downtime Failover" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "editorial-hairline-col", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#8A67F6", marginBottom: 8, textTransform: "uppercase" }, children: "05 // DETERMINISM" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { fontSize: 18, fontWeight: 800, color: "#111116", marginBottom: 10 }, children: "Sub-5ms Codebase Search" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: "0 0 16px" }, children: "Native ripgrep indexing, AST symbol grep, and Git atomic rollback snapshots. Fast, cache-friendly, and bounded by strict privilege boundaries." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, background: "#EDE8F8", color: "#8A67F6", padding: "4px 10px", borderRadius: 6, fontWeight: 700, width: "fit-content" }, children: "3.8ms Grep Index" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "editorial-hairline-col", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#8A67F6", marginBottom: 8, textTransform: "uppercase" }, children: "06 // RUNTIME" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { fontSize: 18, fontWeight: 800, color: "#111116", marginBottom: 10 }, children: "Zero-Dep Bun Binary" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: "0 0 16px" }, children: "Compiled into a single self-contained native executable. 18.2 MB peak resident RSS and 38.2 ms cold start — 21.2× lighter than Claude Code." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, background: "#EDE8F8", color: "#8A67F6", padding: "4px 10px", borderRadius: 6, fontWeight: 700, width: "fit-content" }, children: "18.2 MB RSS · 38.2 ms TTFI" })
        ] })
      ] }) })
    ] })
  ] });
}
function SpecialistRolesSection() {
  const [selectedRole, setSelectedRole] = reactExports.useState(SPECIALIST_ROLES[0]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "section", id: "roles", style: { maxWidth: 1560, margin: "0 auto", padding: "60px 4vw", scrollMarginTop: 100 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.05, blur: 12, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "section-tag-pill", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-sparkle", children: "✦" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-part-dark", children: "SECTION 03 /" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-part-purple", children: "DAG SWARMS" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(EditorialReveal, { delay: 0.1, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "section-head-huge", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "section-title-huge", children: [
        "16 SPECIALIST ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "accent-title", children: "AGENT ROLES" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "section-arrow-diag-huge", children: "↗" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.15, distance: 30, blur: 10, children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "section-desc", style: { fontSize: 17, color: "var(--ink-soft)", marginBottom: 36, maxWidth: 680 }, children: "Rather than relying on a single monolithic context window, Mochi dispatches dedicated micro-agents across dependency DAGs." }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.1, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }, children: SPECIALIST_ROLES.map((role) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: () => setSelectedRole(role),
          style: {
            background: selectedRole.id === role.id ? "#F4EFFE" : "#ffffff",
            border: selectedRole.id === role.id ? "2px solid #8A67F6" : "1.5px solid var(--line)",
            borderRadius: 18,
            padding: "18px 20px",
            textAlign: "left",
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: selectedRole.id === role.id ? "0 6px 20px rgba(138, 103, 246, 0.16)" : "0 2px 8px rgba(0,0,0,0.03)"
          },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#8A67F6", textTransform: "uppercase" }, children: role.tag }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 11, background: "#EDE8F8", color: "#111116", padding: "3px 8px", borderRadius: 999, fontWeight: 600 }, children: role.badge })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 16, fontWeight: 800, color: "#111116", marginBottom: 4 }, children: role.name }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }, children: [
              role.desc.substring(0, 72),
              "..."
            ] })
          ]
        },
        role.id
      )) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "right", delay: 0.2, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          style: {
            background: "#ffffff",
            borderRadius: 24,
            padding: 32,
            border: "1.5px solid rgba(138, 103, 246, 0.25)",
            boxShadow: "0 8px 32px rgba(138, 103, 246, 0.12)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            boxSizing: "border-box"
          },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontFamily: "var(--font-mono)", fontSize: 12, background: "#8A67F6", color: "#ffffff", padding: "4px 12px", borderRadius: 999, fontWeight: 700 }, children: [
                  "ACTIVE ROLE / ",
                  selectedRole.tag
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }, children: "18.2 MB RSS · Sub-process Sandbox" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 26, fontWeight: 850, color: "#111116", marginBottom: 12 }, children: selectedRole.name }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 15.5, lineHeight: 1.7, color: "var(--ink-soft)", marginBottom: 24 }, children: selectedRole.desc }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: 24 }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800, color: "#111116", textTransform: "uppercase", marginBottom: 10 }, children: "Dedicated Subsystem Tools:" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: selectedRole.tools.map((tool) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "span",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      background: "#FAF8FC",
                      border: "1px solid #DCD6EE",
                      color: "#111116",
                      padding: "5px 12px",
                      borderRadius: 8,
                      fontWeight: 600
                    },
                    children: tool
                  },
                  tool
                )) })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#110F1D", borderRadius: 16, padding: "16px 20px", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "#EDE9FE" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#8A67F6", fontWeight: 700, marginBottom: 6 }, children: "// Task DAG Execution Telemetry" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#34D399" }, children: [
                "✓ Spawning ",
                selectedRole.name,
                " worker within Bubblewrap user namespace."
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "rgba(255, 255, 255, 0.6)", marginTop: 4 }, children: "→ Context budget allocated: 4,096 tokens (91% pruned) · 0 runaway loops." })
            ] })
          ]
        }
      ) })
    ] })
  ] });
}
function ArchitectureSection() {
  const [activeTab, setActiveTab] = reactExports.useState("ast");
  const tabs = [
    { id: "ast", label: "Surgical AST Patch", badge: "12ms / Turn" },
    { id: "sandbox", label: "Bubblewrap Sandbox", badge: "Hardware Isolated" },
    { id: "recovery", label: "Struggle Circuit Breaker", badge: "Autonomous Escalate" },
    { id: "multitab", label: "Multi-Tab TUI Matrix", badge: "Pinned Sessions" }
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "section", id: "architecture", style: { maxWidth: 1560, margin: "0 auto", padding: "60px 4vw", scrollMarginTop: 100 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.05, blur: 12, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "section-tag-pill", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-sparkle", children: "✦" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-part-dark", children: "SECTION 04 /" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-part-purple", children: "ARCHITECTURE" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(EditorialReveal, { delay: 0.1, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "section-head-huge", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "section-title-huge", children: [
        "ENGINEERED FOR ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "accent-title", children: "PRECISION" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "section-arrow-diag-huge", children: "↗" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.15, distance: 30, blur: 10, children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "section-desc", style: { maxWidth: 760, marginBottom: 32, fontSize: 17, color: "var(--ink-soft)" }, children: "Inspect how Mochi’s Spec/Act dual-engine separation, AST surgical diffing, and unprivileged sandboxing outperform traditional AI agent wrappers." }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.1, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }, children: tabs.map((t) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        onClick: () => setActiveTab(t.id),
        style: {
          padding: "12px 20px",
          borderRadius: 14,
          border: activeTab === t.id ? "1.5px solid var(--purple)" : "1.5px solid var(--line)",
          background: activeTab === t.id ? "var(--purple-lighter)" : "#ffffff",
          color: activeTab === t.id ? "var(--purple-dark)" : "var(--ink)",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: activeTab === t.id ? "0 4px 14px rgba(139, 117, 246, 0.18)" : "var(--shadow-card)",
          transition: "all 0.2s"
        },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: t.label }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "span",
            {
              style: {
                fontSize: 10.5,
                fontFamily: "var(--font-mono)",
                padding: "2px 8px",
                borderRadius: 6,
                background: activeTab === t.id ? "var(--purple)" : "#EDE8F5",
                color: activeTab === t.id ? "#ffffff" : "var(--purple-dark)",
                fontWeight: 700
              },
              children: t.badge
            }
          )
        ]
      },
      t.id
    )) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "right", delay: 0.18, distance: 50, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        style: {
          background: "#ffffff",
          borderRadius: 24,
          border: "1.5px solid rgba(139, 92, 246, 0.20)",
          boxShadow: "var(--shadow-card)",
          padding: 34,
          overflow: "hidden"
        },
        children: [
          activeTab === "ast" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 20, fontWeight: 800, color: "#111116", margin: 0 }, children: "Tree-Sitter AST Surgical Mutation vs. Naive Rewriting" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 14, color: "var(--ink-soft)", margin: "4px 0 0" }, children: "Modifies only the exact AST target node in 12ms. Never rewrites entire 400-line files or corrupts git blame." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, background: "#D1FAE5", color: "#065F46", padding: "4px 10px", borderRadius: 999, fontWeight: 700 }, children: "✓ 99.4% LESS TOKEN WASTE" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 20 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#110F1D", borderRadius: 16, padding: 20, fontFamily: "var(--font-mono)", fontSize: 12.5, color: "#EDE9FE", border: "1px solid rgba(255, 255, 255, 0.08)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#F87171", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "✕ Conventional AI Coding Agents" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 10, background: "rgba(239, 68, 68, 0.2)", padding: "2px 6px", borderRadius: 4 }, children: "Slow & Risky" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "rgba(255, 255, 255, 0.4)", lineHeight: 1.7 }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: "// Rewrites entire 450-line file from scratch" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: "// 12,400 tokens spent on unchanged boilerplate" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: "// Destroys git blame across entire module" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: "// Truncates halfway through on context limit" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#F87171", marginTop: 8 }, children: "- export function calculateRates(req, res) { ... 450 lines ... }" })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#110F1D", borderRadius: 16, padding: 20, fontFamily: "var(--font-mono)", fontSize: 12.5, color: "#EDE9FE", border: "1px solid rgba(139, 92, 246, 0.3)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#34D399", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "✓ Mochi Surgical Diff Engine" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 10, background: "rgba(52, 211, 153, 0.2)", padding: "2px 6px", borderRadius: 4 }, children: "Atomic & Safe" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "rgba(255, 255, 255, 0.65)", lineHeight: 1.7 }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#818CF8" }, children: "@@ -42,2 +42,2 @@ AST Node: TokenRateLimiter" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#F87171" }, children: "-   const maxRps = currentTier === 'free' ? 10 : 100;" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#34D399" }, children: "+   const maxRps = currentTier === 'free' ? 25 : 250; // Surgical patch: 12ms" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#34D399", marginTop: 8 }, children: "✓ Invariant verified: tree-sitter AST matches post-edit shape" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#A78BFA" }, children: "✓ 100% git blame preserved for surrounding 448 lines" })
                ] })
              ] })
            ] })
          ] }),
          activeTab === "sandbox" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 20, fontWeight: 800, color: "#111116", margin: 0 }, children: "Bubblewrap Hardware Sandbox & Policy Isolation" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 14, color: "var(--ink-soft)", margin: "4px 0 0" }, children: "Commands execute within unprivileged user namespaces. Host filesystems and credentials remain completely masked." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, background: "#EDE9FE", color: "var(--purple-dark)", padding: "4px 10px", borderRadius: 999, fontWeight: 700 }, children: "MOCHI_SANDBOX=bubblewrap" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#FAF8FC", borderRadius: 16, padding: 22, border: "1px solid var(--line)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 15, fontWeight: 700, color: "var(--purple-dark)", marginBottom: 8 }, children: "Read-Only System Mounts" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "/usr" }),
                  ", ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "/bin" }),
                  ", and ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "/lib" }),
                  " mounted read-only via unprivileged ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "bwrap" }),
                  ". System binaries cannot be replaced or infected."
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#FAF8FC", borderRadius: 16, padding: 22, border: "1px solid var(--line)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 15, fontWeight: 700, color: "var(--purple-dark)", marginBottom: 8 }, children: "Credential Blackhole" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "~/.ssh" }),
                  ", ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "~/.aws" }),
                  ", and ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "~/.gnupg" }),
                  " masked with isolated empty tmpfs filesystems. Prompt injections cannot exfiltrate user keys."
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#FAF8FC", borderRadius: 16, padding: 22, border: "1px solid var(--line)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 15, fontWeight: 700, color: "var(--purple-dark)", marginBottom: 8 }, children: "Strict Egress Control" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }, children: [
                  "Configurable ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "--unshare-net" }),
                  " isolates untrusted code from making rogue HTTP calls or reverse TCP shells during testing."
                ] })
              ] })
            ] })
          ] }),
          activeTab === "recovery" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 20, fontWeight: 800, color: "#111116", margin: 0 }, children: "Struggle-State Detection & Auto-Escalation" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 14, color: "var(--ink-soft)", margin: "4px 0 0" }, children: "Breaks infinite error loops autonomously. 3 consecutive verification failures escalate to high-tier reasoning models." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, background: "#FEF3C7", color: "#92400E", padding: "4px 10px", borderRadius: 999, fontWeight: 700 }, children: "ANTI-LOOP CIRCUIT BREAKER" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#FAF8FC", borderRadius: 16, padding: 18, border: "1px solid var(--line)", textAlign: "center" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)", fontWeight: 700 }, children: "TURN 1" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 14.5, fontWeight: 800, color: "#111116", margin: "6px 0 4px" }, children: "Fast Model Execution" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 12.5, color: "var(--ink-soft)" }, children: "glm-5.3-flash attempts rapid edit batch (140ms)." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#FAF8FC", borderRadius: 16, padding: 18, border: "1px solid var(--line)", textAlign: "center" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 11, fontFamily: "var(--font-mono)", color: "#DC2626", fontWeight: 700 }, children: "TURN 2 (FAILED)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 14.5, fontWeight: 800, color: "#DC2626", margin: "6px 0 4px" }, children: "Stagnation Detected" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 12.5, color: "var(--ink-soft)" }, children: "Compiler red test. 0 new files mutated. Breaker arms." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#FAF8FC", borderRadius: 16, padding: 18, border: "1.5px solid var(--purple)", textAlign: "center" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--purple-dark)", fontWeight: 700 }, children: "TURN 3 (ESCALATE)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 14.5, fontWeight: 800, color: "var(--purple-dark)", margin: "6px 0 4px" }, children: "Model Auto-Handoff" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 12.5, color: "var(--ink-soft)" }, children: "Escalates to kimi-k2.7-code with handoff diagnosis." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#FAF8FC", borderRadius: 16, padding: 18, border: "1.5px solid #059669", textAlign: "center" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 11, fontFamily: "var(--font-mono)", color: "#059669", fontWeight: 700 }, children: "VERIFIED PASS" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 14.5, fontWeight: 800, color: "#059669", margin: "6px 0 4px" }, children: "Git Checkpoint" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 12.5, color: "var(--ink-soft)" }, children: "100% tests green. Atomic commit with zero rollbacks." })
              ] })
            ] })
          ] }),
          activeTab === "multitab" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 20, fontWeight: 800, color: "#111116", margin: 0 }, children: "Multi-Tab Pinned Sessions (Mochi v0.22.0)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 14, color: "var(--ink-soft)", margin: "4px 0 0" }, children: "Run multiple autonomous agents concurrently in isolated terminal tabs with dedicated budgets and abort controllers." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, background: "#EDE9FE", color: "var(--purple-dark)", padding: "4px 10px", borderRadius: 999, fontWeight: 700 }, children: "ALT+T NEW · ALT+1-8 SWITCH" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#110F1D", borderRadius: 16, padding: "16px 20px", fontFamily: "var(--font-mono)", fontSize: 13, border: "1px solid rgba(139, 92, 246, 0.3)" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 6, alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: 12, marginBottom: 16 }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { background: "#7C3AED", color: "#ffffff", padding: "5px 12px", borderRadius: 6, fontWeight: 700, fontSize: 12 }, children: "1: auth-service [ACTIVE]" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { background: "rgba(255, 255, 255, 0.08)", color: "rgba(255, 255, 255, 0.6)", padding: "5px 12px", borderRadius: 6, fontSize: 12 }, children: "2: database-migration · 2 unread" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { background: "transparent", color: "var(--purple-light)", border: "1px dashed rgba(139, 92, 246, 0.4)", padding: "5px 12px", borderRadius: 6, fontSize: 12 }, children: "+ New session" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#EDE9FE", lineHeight: 1.8 }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#A78BFA" }, children: '$ mochi --tab 1 "refactor jwt verification into standalone middleware"' }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#34D399" }, children: "✓ Tab 1 runtime isolated — 18.2 MB RSS, own budget, background execution intact." }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "rgba(255, 255, 255, 0.5)", marginTop: 8 }, children: "[Tab 2 continues running database migration in background without transcript spam]" })
              ] })
            ] })
          ] })
        ]
      }
    ) })
  ] });
}
function AutonomousEcosystemSection() {
  const [activeStep, setActiveStep] = reactExports.useState(0);
  const steps = [
    {
      id: "decompose",
      num: "01",
      title: "Task Decomposition",
      role: "Lead Orchestrator",
      tool: "dag_dispatch",
      badge: "TOKEN BUDGET LOCKED",
      desc: "Parses ambiguous natural language prompts into a formal dependency DAG. Allocates token quotas per role and locks execution timeouts.",
      trace: [
        '$ mochi "add ed25519 jwt verification with redis cache & patch all call sites"',
        "-> [Lead] Decomposing objective into formal 3-phase execution DAG...",
        "-> [Lead] Phase 1: architect_slice · Phase 2: ast_patch · Phase 3: test_runner",
        "-> [Lead] Token budget locked: 8,000 tokens · Abort timeout: 60s"
      ],
      metrics: ["1 Objective", "3 DAG Nodes", "0 Ambiguity"]
    },
    {
      id: "slice",
      num: "02",
      title: "Monorepo AST Slicing",
      role: "System Architect",
      tool: "ripgrep + ast_slicer",
      badge: "4.2MS RECONNAISSANCE",
      desc: "Uses tree-sitter AST queries and ripgrep searches to build call graphs, identifying exact mutation targets and read-only consumers across monorepos.",
      trace: [
        "-> [Architect] Scanning codebase for JwtValidator symbol references...",
        "-> [Architect] Ripgrep returned 14 candidate files in 4.2ms",
        "-> [Architect] AST Callgraph: 2 mutation targets, 12 read-only consumers",
        "-> [Architect] Zero breaking signature changes detected. Handoff to Coder."
      ],
      metrics: ["14 Files Indexed", "2 Targets", "0 Breaking Diffs"]
    },
    {
      id: "patch",
      num: "03",
      title: "Surgical AST Patching",
      role: "Core Coder",
      tool: "apply_ast_patch",
      badge: "WHITESPACE-TOLERANT",
      desc: "Applies whitespace-tolerant unified diffs without dropping imports or surrounding comments. Preserves 100% git blame integrity.",
      trace: [
        "-> [Coder] Slicing AST scope: JwtValidator.verifyToken in src/auth/jwt.ts",
        "-> [Coder] Applying unified diff (+18 lines, -4 lines)",
        "-> [Coder] Tree-sitter grammar validated: 0 syntax errors, 0 lost imports",
        "-> [Coder] Atomic working tree patch applied in 8.4ms"
      ],
      metrics: ["18 Insertions", "4 Deletions", "100% Blame Preserved"]
    },
    {
      id: "jail",
      num: "04",
      title: "Sandboxed Verification",
      role: "QA Tester",
      tool: "bwrap_spawn",
      badge: "HARDWARE USER NAMESPACES",
      desc: "Compiles and runs test suites inside unprivileged Linux Bubblewrap containers with network egress blocked and host credentials masked.",
      trace: [
        "-> [Tester] Spawning ephemeral bwrap container: ~/.ssh & ~/.aws masked (tmpfs)",
        "-> [Tester] Executing test suite inside container: bun test src/auth/jwt.test.ts",
        "-> [Tester] Test runner: 28/28 assertions passing (142ms)",
        "-> [Tester] Zero memory leaks, exit code 0. Handoff to Release Lead."
      ],
      metrics: ["28/28 Passing", "0 Key Leakage", "142ms Duration"]
    },
    {
      id: "commit",
      num: "05",
      title: "Atomic Git Checkpoint",
      role: "Release Lead",
      tool: "checkpoint_commit",
      badge: "12MS ROLLBACK SNAPSHOT",
      desc: "Approved passes commit with clean conventional changelog metadata and an instant 12ms rollback snapshot for one-click recovery.",
      trace: [
        '-> [Git] Creating commit: "feat(auth): ed25519 jwt verification with redis caching"',
        "-> [Git] Checkpoint #82f1b4 created · 12ms revert snapshot active",
        "-> [Git] 100% mechanical verification green. Ready for pull request merge."
      ],
      metrics: ["1 Commit", "1 Checkpoint", "0 Rollback Ghost Files"]
    }
  ];
  const current = steps[activeStep];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "section", id: "pipeline", style: { maxWidth: 1560, margin: "0 auto", padding: "60px 4vw", scrollMarginTop: 100 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.05, blur: 12, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "section-tag-pill", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-sparkle", children: "✦" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-part-dark", children: "SECTION 05 /" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-part-purple", children: "AUTONOMOUS SWARM DAG" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(EditorialReveal, { delay: 0.1, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "section-head-huge", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "section-title-huge", children: [
        "THE SWARM EXECUTION ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "accent-title", children: "DAG PIPELINE" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "section-arrow-diag-huge", children: "↗" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.15, distance: 30, blur: 10, children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "section-desc", style: { fontSize: 17, color: "var(--ink-soft)", marginBottom: 40, maxWidth: 700 }, children: "From ambiguous objective to verified atomic git commit: follow how Mochi coordinates multi-role subagent swarms across directed acyclic graphs." }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.1, distance: 40, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 28 }, children: steps.map((s, idx) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        onClick: () => setActiveStep(idx),
        style: {
          padding: "16px 18px",
          borderRadius: 18,
          border: activeStep === idx ? "1.5px solid var(--purple)" : "1px solid var(--line)",
          background: activeStep === idx ? "#1A1633" : "#ffffff",
          color: activeStep === idx ? "#ffffff" : "var(--ink)",
          textAlign: "left",
          cursor: "pointer",
          transition: "all 0.25s ease",
          boxShadow: activeStep === idx ? "0 6px 20px rgba(138, 103, 246, 0.22)" : "var(--shadow-card)"
        },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: activeStep === idx ? "#A78BFA" : "#8A67F6" }, children: [
              "STAGE ",
              s.num
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 6px", borderRadius: 4, background: activeStep === idx ? "rgba(255, 255, 255, 0.15)" : "#F4EFFE", color: activeStep === idx ? "#ffffff" : "#8A67F6" }, children: s.role.split(" ")[0] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 14, fontWeight: 800 }, children: s.title })
        ]
      },
      s.id
    )) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "right", delay: 0.15, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        style: {
          background: "#ffffff",
          borderRadius: 28,
          border: "1.5px solid rgba(138, 103, 246, 0.2)",
          padding: "36px 32px",
          boxShadow: "var(--shadow-card)",
          marginBottom: 40
        },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 800, color: "#8A67F6" }, children: [
                  "STAGE ",
                  current.num,
                  " / ",
                  current.title.toUpperCase()
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, background: "#F4EFFE", color: "#6D28D9", padding: "3px 10px", borderRadius: 999, fontWeight: 700 }, children: current.role })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 15, color: "var(--ink-soft)", margin: 0, maxWidth: 640, lineHeight: 1.6 }, children: current.desc })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, background: "#EDE9FE", color: "var(--purple-dark)", padding: "6px 14px", borderRadius: 999, fontWeight: 700 }, children: current.badge })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#110F1D", borderRadius: 18, padding: "20px 24px", fontFamily: "var(--font-mono)", fontSize: 13, border: "1px solid rgba(139, 92, 246, 0.3)", marginBottom: 20 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "rgba(255, 255, 255, 0.4)", marginBottom: 12, borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: 8, display: "flex", justifyContent: "space-between" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "mochi-session · agent_trace.log" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#34D399" }, children: "● LIVE EXECUTION" })
            ] }),
            current.trace.map((line, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                style: {
                  color: line.startsWith("$") ? "#A78BFA" : line.includes("PASS") || line.includes("passing") || line.includes("green") ? "#34D399" : "#E2E8F0",
                  lineHeight: 1.8
                },
                children: line
              },
              i
            ))
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" }, children: current.metrics.map((m, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "span",
            {
              style: {
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 700,
                background: "#FAF8FC",
                color: "#111116",
                border: "1px solid var(--line)",
                padding: "6px 14px",
                borderRadius: 10
              },
              children: [
                "✓ ",
                m
              ]
            },
            i
          )) })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.18, distance: 35, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800, color: "#8A67F6", textTransform: "uppercase", letterSpacing: ".08em" }, children: "// RUNTIME SPECIFICATIONS & PROTOCOLS" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-soft)" }, children: "6 SYSTEM BOUNDARIES" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "editorial-spec-ledger", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "editorial-spec-cell", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#8A67F6" }, children: "01 // PROTOCOL" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 10, background: "#F4EFFE", color: "#6D28D9", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }, children: "stdio + sse" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { fontSize: 17, fontWeight: 800, color: "#111116", marginBottom: 8 }, children: "Model Context Protocol (MCP)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 }, children: "Connects seamlessly to any external MCP tool server over stdio and SSE protocols, enabling custom database, browser, and enterprise tools." })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "editorial-spec-cell", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#8A67F6" }, children: "02 // INFERENCE" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 10, background: "#F4EFFE", color: "#6D28D9", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }, children: "auto-backoff" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { fontSize: 17, fontWeight: 800, color: "#111116", marginBottom: 8 }, children: "Multi-Provider Router" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 }, children: "Hot-swap any backup provider (Anthropic Claude Sonnet 5.5 & Claude Opus 5.5, OpenAI GPT-5.5 Astra, GPT-5 & o5, DeepSeek V4 Flash & R1, Google Gemini 2.5 Pro & 3.0 Ultra, Kimi k3, GLM-5.3, or local Ollama / llama.cpp) with multi-key pool rotation and automatic 429 backoff." })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "editorial-spec-cell", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#8A67F6" }, children: "03 // SECURITY" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 10, background: "#F4EFFE", color: "#6D28D9", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }, children: "tmpfs mask" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { fontSize: 17, fontWeight: 800, color: "#111116", marginBottom: 8 }, children: "Bubblewrap Jail" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 }, children: "Hardware unprivileged namespaces mask your SSH keys, AWS credentials, and environment variables from rogue prompts." })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "editorial-spec-cell", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#8A67F6" }, children: "04 // SYNTAX" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 10, background: "#F4EFFE", color: "#6D28D9", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }, children: "tree-sitter AST" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { fontSize: 17, fontWeight: 800, color: "#111116", marginBottom: 8 }, children: "Tree-sitter AST Differ" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 }, children: "Real-time semantic syntax tree parsing across TypeScript, Rust, Python, Go, and C for surgical token-level patch applications." })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "editorial-spec-cell", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#8A67F6" }, children: "05 // VERIFICATION" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 10, background: "#ECFDF5", color: "#047857", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }, children: "compiler gate" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { fontSize: 17, fontWeight: 800, color: "#111116", marginBottom: 8 }, children: "Mechanical Gate" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 }, children: "Zero unverified code reaches disk; strict compiler diagnostics, test runners, and static analyzers gate every commit." })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "editorial-spec-cell", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#8A67F6" }, children: "06 // RUNTIME" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 10, background: "#EDE8F8", color: "#8A67F6", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }, children: "18.2 MB RSS" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { fontSize: 17, fontWeight: 800, color: "#111116", marginBottom: 8 }, children: "Zero-Dep Bun Binary" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 }, children: "Compiled into a single self-contained native executable with 18.2 MB peak resident RSS and 38.2 ms cold start." })
        ] }) })
      ] })
    ] }) })
  ] });
}
function BenchmarksSection() {
  const memData = [
    { label: "Mochi (Bun)", value: 18.2, color: "purple", display: "18.2 MB" },
    { label: "jcode", value: 27.8, display: "27.8 MB" },
    { label: "Crush", value: 34.4, display: "34.4 MB" },
    { label: "Codex CLI", value: 140, display: "140 MB" },
    { label: "Aider", value: 188, display: "188 MB" },
    { label: "Cursor", value: 214.9, display: "214.9 MB" },
    { label: "OpenCode", value: 371.5, display: "371.5 MB" },
    { label: "Claude Code", value: 386.6, display: "386.6 MB" }
  ];
  const ttfiData = [
    { label: "Mochi", value: 38.2, color: "purple", display: "38.2 ms" },
    { label: "jcode", value: 45.4, display: "45.4 ms" },
    { label: "Crush", value: 52.1, display: "52.1 ms" },
    { label: "Codex CLI", value: 93, display: "93 ms" },
    { label: "Cursor", value: 121.5, display: "121.5 ms" },
    { label: "Aider", value: 145.2, display: "145.2 ms" },
    { label: "OpenCode", value: 168.3, display: "168.3 ms" },
    { label: "Claude Code", value: 172.4, display: "172.4 ms" }
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "section", id: "benchmarks", style: { maxWidth: 1560, margin: "0 auto", padding: "60px 4vw", scrollMarginTop: 100 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.05, blur: 12, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "section-tag-pill", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-sparkle", children: "✦" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-part-dark", children: "SECTION 06 /" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-part-purple", children: "MEASURED RECEIPTS" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(EditorialReveal, { delay: 0.1, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "section-head-huge", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "section-title-huge", children: [
        "MEASURED. VERIFIED. ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "accent-title", children: "REPEATED." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "section-arrow-diag-huge", children: "↗" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.15, distance: 30, blur: 10, children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "section-desc", style: { fontSize: 17, color: "var(--ink-soft)", marginBottom: 40, maxWidth: 680 }, children: "Every benchmark on this site is measured empirically with Valgrind massif and high-resolution wall clocks on standard Linux x86_64 machines. Zero synthetic marketing claims." }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 24, marginBottom: 40 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.2, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          style: {
            background: "#ffffff",
            padding: "36px 32px",
            borderRadius: 24,
            border: "1.5px solid rgba(138, 103, 246, 0.25)",
            boxShadow: "var(--shadow-card)"
          },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 24
                },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "div",
                      {
                        style: {
                          fontFamily: "var(--font-mono)",
                          fontSize: 14,
                          color: "#111116",
                          textTransform: "uppercase",
                          letterSpacing: ".06em",
                          fontWeight: 850
                        },
                        children: "Peak Resident RSS (MB)"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }, children: "Valgrind massif heap + stack measurement (Lower is better)" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "span",
                    {
                      style: {
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        background: "#EDE8F8",
                        color: "#8A67F6",
                        padding: "4px 10px",
                        borderRadius: 8,
                        fontWeight: 800
                      },
                      children: "21.2× LIGHTER"
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(BenchChart, { data: memData, max: 400 })
          ]
        }
      ) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "right", delay: 0.25, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          style: {
            background: "#ffffff",
            padding: "36px 32px",
            borderRadius: 24,
            border: "1.5px solid rgba(138, 103, 246, 0.25)",
            boxShadow: "var(--shadow-card)"
          },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 24
                },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "div",
                      {
                        style: {
                          fontFamily: "var(--font-mono)",
                          fontSize: 14,
                          color: "#111116",
                          textTransform: "uppercase",
                          letterSpacing: ".06em",
                          fontWeight: 850
                        },
                        children: "Cold Start TTFI (ms)"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }, children: "Process exec to interactive prompt loop (Lower is better)" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "span",
                    {
                      style: {
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        background: "#EDE8F8",
                        color: "#8A67F6",
                        padding: "4px 10px",
                        borderRadius: 8,
                        fontWeight: 800
                      },
                      children: "4.5× FASTER"
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(BenchChart, { data: ttfiData, max: 200 })
          ]
        }
      ) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.2, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        style: {
          background: "#ffffff",
          borderRadius: 24,
          border: "1.5px solid var(--line)",
          boxShadow: "var(--shadow-card)",
          overflow: "hidden"
        },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "24px 30px", borderBottom: "1px solid var(--line)", background: "#FAF8FC" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 18, fontWeight: 800, color: "#111116", margin: 0 }, children: "Comprehensive Agent Architecture Matrix" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 13.5, color: "var(--ink-soft)", margin: "4px 0 0" }, children: "Empirical runtime capabilities across major autonomous terminal and IDE agents." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { style: { width: "100%", borderCollapse: "collapse", textAlign: "left", fontFamily: "var(--font-body)", fontSize: 13.5 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { style: { background: "#F4EFFE", borderBottom: "1.5px solid rgba(138, 103, 246, 0.2)" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { padding: "14px 20px", fontWeight: 800, color: "#111116" }, children: "Capability" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { padding: "14px 20px", fontWeight: 800, color: "#8A67F6" }, children: "Mochi (v0.22.0)" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { padding: "14px 20px", fontWeight: 700, color: "#111116" }, children: "Claude Code" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { padding: "14px 20px", fontWeight: 700, color: "#111116" }, children: "Cursor Agent" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { padding: "14px 20px", fontWeight: 700, color: "#111116" }, children: "Aider" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { padding: "14px 20px", fontWeight: 700, color: "#111116" }, children: "OpenCode" })
            ] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { style: { borderBottom: "1px solid var(--line)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", fontWeight: 700, color: "#111116" }, children: "Peak Resident Memory" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", fontWeight: 800, color: "#059669" }, children: "18.2 MB (Bun)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#DC2626" }, children: "386.6 MB (Node)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#4B5563" }, children: "214.9 MB (Electron)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#4B5563" }, children: "188.0 MB (Python)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#DC2626" }, children: "371.5 MB (Node)" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { style: { borderBottom: "1px solid var(--line)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", fontWeight: 700, color: "#111116" }, children: "Cold Start TTFI" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", fontWeight: 800, color: "#059669" }, children: "38.2 ms" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#DC2626" }, children: "172.4 ms" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#4B5563" }, children: "121.5 ms" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#4B5563" }, children: "145.2 ms" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#DC2626" }, children: "168.3 ms" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { style: { borderBottom: "1px solid var(--line)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", fontWeight: 700, color: "#111116" }, children: "Hardware Sandboxing" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", fontWeight: 800, color: "#059669" }, children: "Bubblewrap (bwrap)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#DC2626" }, children: "None (Direct Host)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#DC2626" }, children: "None (Direct Host)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#DC2626" }, children: "None (Direct Host)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#DC2626" }, children: "None (Direct Host)" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { style: { borderBottom: "1px solid var(--line)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", fontWeight: 700, color: "#111116" }, children: "Multi-Tab Pinned Sessions" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", fontWeight: 800, color: "#059669" }, children: "Native TUI Tabs" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#DC2626" }, children: "Single terminal" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#4B5563" }, children: "GUI Composer tabs" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#DC2626" }, children: "Single terminal" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#4B5563" }, children: "Multiple sessions" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { style: { borderBottom: "1px solid var(--line)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", fontWeight: 700, color: "#111116" }, children: "AST Diff Mutations" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", fontWeight: 800, color: "#059669" }, children: "Tree-sitter 12ms" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#4B5563" }, children: "Whole block replace" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#4B5563" }, children: "Fuzzy regex patch" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#4B5563" }, children: "Unified diff / search" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#4B5563" }, children: "Whole file replace" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", fontWeight: 700, color: "#111116" }, children: "License & Source" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", fontWeight: 800, color: "#059669" }, children: "100% MIT Open Source" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#DC2626" }, children: "Proprietary Closed" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#DC2626" }, children: "Proprietary Closed" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#059669" }, children: "Apache 2.0" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { padding: "14px 20px", color: "#059669" }, children: "MIT Open Source" })
              ] })
            ] })
          ] }) })
        ]
      }
    ) })
  ] });
}
function CodaSection() {
  const base = typeof window !== "undefined" && window.location.pathname.startsWith("/mochi") ? "/mochi" : "";
  const [copied, setCopied] = reactExports.useState(false);
  const copyInstall = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText("curl -fsSL https://mochi.sh | sh");
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "coda-wrap", style: { maxWidth: 1560, margin: "40px auto 80px", padding: "0 4vw" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "coda-banner",
      style: {
        background: "linear-gradient(135deg, #FAF8FC 0%, #F3EEFD 100%)",
        borderRadius: 28,
        border: "1.5px solid rgba(138, 103, 246, 0.3)",
        boxShadow: "0 12px 48px rgba(138, 103, 246, 0.14)",
        padding: "48px 44px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
        alignItems: "center",
        gap: 36
      },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.1, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { position: "relative", zIndex: 1, maxWidth: 580 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { style: { color: "#111116", fontSize: "clamp(32px, 4vw, 46px)", fontWeight: 850, marginBottom: 14, letterSpacing: "-0.03em", lineHeight: 1.1 }, children: "Ready to Build with Mochi?" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { color: "#22222B", fontSize: 17, lineHeight: 1.65, marginBottom: 28, fontWeight: 500 }, children: "Experience the lightest, fastest autonomous coding intelligence for your terminal. Single standalone Bun binary, compiled Rust core, and 0 external dependencies." }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                background: "#ffffff",
                border: "1.5px solid rgba(138, 103, 246, 0.28)",
                borderRadius: 14,
                padding: "8px 16px",
                marginBottom: 28,
                gap: 14,
                boxShadow: "0 2px 10px rgba(138, 103, 246, 0.08)"
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 13.5, color: "#111116", fontWeight: 800 }, children: "curl -fsSL https://mochi.sh | sh" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: copyInstall,
                    style: {
                      background: "#8A67F6",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    },
                    children: copied ? "✓ Copied" : "Copy"
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 14, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "a",
              {
                href: "https://github.com/xanstomper/mochi/releases",
                className: "btn btn-primary hero-btn-dl",
                target: "_blank",
                rel: "noopener",
                style: { textDecoration: "none" },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("polyline", { points: "7 10 12 15 17 10" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })
                  ] }),
                  "Download Mochi (v0.22.0)"
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "a",
              {
                href: base + "/docs.html",
                className: "btn btn-outline hero-btn-docs",
                style: { textDecoration: "none" },
                children: "Read the Docs →"
              }
            )
          ] })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "right", delay: 0.2, distance: 45, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            style: {
              background: "#110F1D",
              borderRadius: 20,
              padding: "16px 16px 20px",
              border: "1.5px solid rgba(138, 103, 246, 0.35)",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.25)"
            },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 6, alignItems: "center", marginBottom: 12, paddingLeft: 4 }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { width: 10, height: 10, borderRadius: "50%", background: "#EF4444" } }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { width: 10, height: 10, borderRadius: "50%", background: "#F59E0B" } }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { width: 10, height: 10, borderRadius: "50%", background: "#10B981" } }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255, 255, 255, 0.5)", marginLeft: 8 }, children: "mochi-terminal-session.gif" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "img",
                {
                  src: base + "/assets/demo/tui_snake.gif",
                  alt: "Mochi Autonomous Terminal Demo",
                  style: {
                    width: "100%",
                    borderRadius: 12,
                    display: "block",
                    border: "1px solid rgba(255, 255, 255, 0.08)"
                  }
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { textAlign: "center", marginTop: 12, fontSize: 12, color: "rgba(255, 255, 255, 0.6)", fontWeight: 600, fontFamily: "var(--font-mono)" }, children: "Live session trace: autonomous multi-pass verification loop" })
            ]
          }
        ) })
      ]
    }
  ) });
}
function Home() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(EngineeringGridBackground, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(HeroSection, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(StatsTicker, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(CapabilitiesSection, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(SpecialistRolesSection, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ArchitectureSection, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AutonomousEcosystemSection, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(BenchmarksSection, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(CodaSection, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Footer, {})
  ] });
}
const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(/* @__PURE__ */ jsxRuntimeExports.jsx(Home, {}));
}
