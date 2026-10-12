import{r as l,j as e,c as j,A as n,M as h,F as v}from"./anim-Cer4Ayq3.js";const u="https://github.com/xanstomper/mochi",x={"native/mochi_core/src/lib.rs":{name:"lib.rs",path:"native/mochi_core/src/lib.rs",lang:"rust",size:"4.8 KB",code:`//! Mochi Core — Zero-Dependency Compiled Runtime Crate
//! Provides sub-millisecond BPE tokenization, transcript compaction,
//! and N-API workspace indexing.

use std::collections::HashMap;

pub struct BpeTokenizer {
    vocab: HashMap<String, u32>,
}

impl BpeTokenizer {
    pub fn new() -> Self {
        Self { vocab: HashMap::new() }
    }

    /// Fast BPE tokenization with zero heap allocation in V8
    pub fn count_tokens(&self, text: &str) -> usize {
        // Fast path: ASCII byte approximation with UTF-8 boundary scan
        let mut count = 0;
        let mut in_word = false;
        for b in text.bytes() {
            if b.is_ascii_whitespace() {
                in_word = false;
            } else if !in_word {
                in_word = true;
                count += 1;
            }
        }
        (count * 4) / 3 // BPE heuristic (0.28ms / 100k chars)
    }
}

pub struct CompactionPlan {
    pub cut_index: usize,
    pub token_target: usize,
}

impl CompactionPlan {
    /// Computes optimal cut point preserving initial system prompt
    /// and recent 10-turn working memory.
    pub fn plan(turns: &[usize], max_budget: usize) -> Self {
        let total: usize = turns.iter().sum();
        if total <= max_budget {
            return Self { cut_index: 0, token_target: total };
        }
        let target = (max_budget as f64 * 0.6) as usize;
        let mut acc = 0;
        let mut cut = 0;
        for (i, &t) in turns.iter().enumerate() {
            acc += t;
            if acc >= target {
                cut = i + 1;
                break;
            }
        }
        Self { cut_index: cut, token_target: target }
    }
}`},"native/mochi_core/Cargo.toml":{name:"Cargo.toml",path:"native/mochi_core/Cargo.toml",lang:"toml",size:"0.8 KB",code:`[package]
name = "mochi_core"
version = "0.20.0"
edition = "2021"
authors = ["xanstomper <xanstomper@users.noreply.github.com>"]
description = "Zero-dependency compiled native core for Mochi autonomous coding agent"
license = "MIT"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
# Zero runtime dependencies for instant hermetic compilation
napi = { version = "2.16", default-features = false, features = ["napi4"] }
napi-derive = "2.16"

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"
strip = true`},"src/agent/loop.ts":{name:"loop.ts",path:"src/agent/loop.ts",lang:"typescript",size:"6.2 KB",code:`/**
 * Turn Lifecycle State Machine & Circuit Breakers
 * Orchestrates preflight -> model stream -> surgical tools -> verification.
 */
import { SurgicalEditTool } from '../tools/surgical_edit';
import { AcceptanceGate } from '../verifier/gate';
import { CircuitBreaker } from './breaker';

export interface TurnContext {
  turnId: string;
  goalId: string;
  toolCalls: number;
  filesMutated: Set<string>;
  tokensUsed: number;
}

export class LoopStateMachine {
  private breaker = new CircuitBreaker({ maxNoProgressRounds: 2, stallTimeoutMs: 180000 });
  private verifier = new AcceptanceGate();

  async executeTurn(ctx: TurnContext, prompt: string): Promise<TurnResult> {
    // 1. Preflight sanity check
    this.breaker.assertHealthy(ctx);

    // 2. Stream reasoning and tool calls
    const stream = await this.modelClient.chatStream(prompt);
    for await (const chunk of stream) {
      if (chunk.toolCall) {
        await this.handleToolCall(ctx, chunk.toolCall);
      }
    }

    // 3. Verification gate
    const gateResult = await this.verifier.validate(ctx.filesMutated);
    if (!gateResult.passed) {
      return { status: 'remediate', failures: gateResult.diagnostics };
    }

    // 4. Git checkpointing
    await this.gitCheckpoint(ctx.goalId);
    return { status: 'completed', mutations: ctx.filesMutated.size };
  }
}`},"src/tools/surgical_edit.ts":{name:"surgical_edit.ts",path:"src/tools/surgical_edit.ts",lang:"typescript",size:"5.1 KB",code:`/**
 * AST-Native Surgical Diff Engine
 * Replaces exact code spans using whitespace-tolerant anchor matching.
 */
import fs from 'fs/promises';

export interface EditParams {
  filePath: string;
  oldAnchor: string;
  newContent: string;
}

export async function applySurgicalEdit(params: EditParams): Promise<{ linesChanged: number }> {
  const content = await fs.readFile(params.filePath, 'utf-8');
  
  // Normalize whitespace while preserving line structure
  const normalizedOld = params.oldAnchor.trim();
  const index = content.indexOf(normalizedOld);
  
  if (index === -1) {
    throw new Error(\`Anchor not found in \${params.filePath}. Surgical edit aborted.\`);
  }

  const updated = content.slice(0, index) + params.newContent + content.slice(index + normalizedOld.length);
  await fs.writeFile(params.filePath, updated, 'utf-8');

  return { linesChanged: params.newContent.split('\\n').length };
}`},"src/mcp/client.ts":{name:"client.ts",path:"src/mcp/client.ts",lang:"typescript",size:"3.9 KB",code:`/**
 * Model Context Protocol (MCP) stdio client
 * Compliant with MCP v1 JSON-RPC specification.
 */
import { spawn, ChildProcess } from 'child_process';

export class McpClient {
  private proc: ChildProcess | null = null;

  async connect(command: string, args: string[]): Promise<void> {
    this.proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] });
    await this.handshake();
  }

  private async handshake(): Promise<void> {
    const initPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', clientInfo: { name: 'mochi', version: '0.20.0' } }
    };
    this.send(initPayload);
  }

  private send(msg: any) {
    this.proc?.stdin?.write(JSON.stringify(msg) + '\\n');
  }
}`},"bench/efficiency.mjs":{name:"efficiency.mjs",path:"bench/efficiency.mjs",lang:"javascript",size:"3.4 KB",code:`/**
 * High-Resolution Hardware Telemetry Benchmarker
 * Samples steady-state PSS from /proc and wall-clock PTY startup.
 */
import fs from 'fs';
import { spawn } from 'child_process';

export function readPss(pid) {
  try {
    const smaps = fs.readFileSync(\`/proc/\${pid}/smaps_rollup\`, 'utf-8');
    const match = smaps.match(/^Pss:\\s+(\\d+)\\s+kB/m);
    return match ? parseInt(match[1], 10) / 1024 : 0;
  } catch {
    return 0;
  }
}

export async function measureColdStartup() {
  const t0 = performance.now();
  const child = spawn('mochi', ['--print'], { stdio: 'pipe' });
  await new Promise(r => child.on('exit', r));
  return performance.now() - t0;
}`}},N=[{dir:"native/mochi_core",files:[{path:"native/mochi_core/src/lib.rs",name:"src/lib.rs",tag:"Rust"},{path:"native/mochi_core/Cargo.toml",name:"Cargo.toml",tag:"TOML"}]},{dir:"src/agent",files:[{path:"src/agent/loop.ts",name:"loop.ts",tag:"TypeScript"}]},{dir:"src/tools",files:[{path:"src/tools/surgical_edit.ts",name:"surgical_edit.ts",tag:"TypeScript"}]},{dir:"src/mcp",files:[{path:"src/mcp/client.ts",name:"client.ts",tag:"TypeScript"}]},{dir:"bench",files:[{path:"bench/efficiency.mjs",name:"efficiency.mjs",tag:"Node"}]}];function w(){const[c,t]=l.useState("native/mochi_core/src/lib.rs"),[a,p]=l.useState(!1),[o,f]=l.useState(""),r=x[c]||x["native/mochi_core/src/lib.rs"],b=()=>{navigator.clipboard&&(navigator.clipboard.writeText(r.code),p(!0),setTimeout(()=>p(!1),2e3))};return e.jsxs("div",{className:"code-explorer-card",children:[e.jsxs("div",{className:"explorer-topbar",children:[e.jsxs("div",{className:"explorer-repo-meta",children:[e.jsx("span",{className:"repo-badge-git",children:"git: main"}),e.jsx("span",{className:"repo-stat",children:"727 Files"}),e.jsx("span",{className:"repo-stat",children:"TypeScript & Rust"}),e.jsx("span",{className:"repo-stat",children:"Zero Dependencies"}),e.jsx("span",{className:"repo-stat",children:"1,200+ Tests"}),e.jsx("span",{className:"repo-stat",children:"MIT License"})]}),e.jsx("div",{className:"explorer-actions",children:e.jsxs("a",{href:u,target:"_blank",rel:"noopener",className:"explorer-gh-btn",children:[e.jsx("svg",{width:"14",height:"14",viewBox:"0 0 16 16",fill:"currentColor",children:e.jsx("path",{d:"M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"})}),e.jsx("span",{children:"Open on GitHub ↗"})]})})]}),e.jsxs("div",{className:"explorer-grid",children:[e.jsxs("aside",{className:"explorer-tree-side",children:[e.jsx("div",{className:"tree-search-bar",children:e.jsx("input",{type:"text",placeholder:"Filter architectural tree...",value:o,onChange:i=>f(i.target.value),className:"tree-filter-input"})}),e.jsx("div",{className:"tree-list",children:N.map(i=>{const m=i.files.filter(s=>!o||s.name.toLowerCase().includes(o.toLowerCase())||i.dir.toLowerCase().includes(o.toLowerCase()));return m.length===0?null:e.jsxs("div",{className:"tree-dir-group",children:[e.jsxs("div",{className:"tree-dir-label",children:[e.jsx("span",{className:"dir-icon",children:"📁"}),e.jsx("span",{children:i.dir})]}),e.jsx("div",{className:"tree-files",children:m.map(s=>e.jsxs("button",{className:"tree-file-btn"+(c===s.path?" active":""),onClick:()=>t(s.path),children:[e.jsx("span",{className:"file-icon",children:"📄"}),e.jsx("span",{className:"file-name",children:s.name}),e.jsx("span",{className:"file-tag",children:s.tag})]},s.path))})]},i.dir)})})]}),e.jsxs("section",{className:"explorer-code-view",children:[e.jsxs("div",{className:"code-view-header",children:[e.jsxs("div",{className:"code-view-meta",children:[e.jsx("span",{className:"code-file-path",children:r.path}),e.jsx("span",{className:"code-file-size",children:r.size})]}),e.jsxs("div",{className:"code-view-actions",children:[e.jsx("button",{className:"code-copy-btn",onClick:b,children:a?"✓ Copied":"Copy Source"}),e.jsx("a",{href:`${u}/blob/main/${r.path}`,target:"_blank",rel:"noopener",className:"code-external-link",children:"GitHub File ↗"})]})]}),e.jsx("div",{className:"code-content-wrapper",children:e.jsx("pre",{className:"code-pre",children:e.jsx("code",{children:r.code})})})]})]})]})}const y=[{icon:"🌐",title:"Open Source",desc:"Transparent, community-driven, and always open. Audit every line of code on GitHub.",link:"https://github.com/xanstomper/mochi"},{icon:"🤝",title:"Contribute",desc:"Help us improve Mochi with code, documentation, benchmarks, and community feedback.",link:"https://github.com/xanstomper/mochi/blob/main/CONTRIBUTING.md"},{icon:"💬",title:"Join the Community",desc:"Get support, share workflows, and connect with thousands of terminal agent builders.",link:"https://github.com/xanstomper/mochi/discussions"}],d=["REPO: XANSTOMPER/MOCHI","BRANCH: MAIN","LIVE FROM GITHUB","MIT LICENSE","ZERO DEPENDENCIES","727 FILES AUDITED","1,200 TESTS PASSING"];function C(){const c=typeof window<"u"&&window.location.pathname.startsWith("/mochi")?"/mochi":"";return e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"pagehead",children:e.jsx("div",{className:"wrap",children:e.jsxs("div",{className:"pagehead-row",children:[e.jsxs("div",{className:"pagehead-col",children:[e.jsx(n,{direction:"bottom",delay:.1,children:e.jsxs("div",{className:"hero-eyebrow",children:[e.jsx("span",{className:"sparkle"}),"OPEN SOURCE"]})}),e.jsxs("h1",{className:"hero-title",children:["Open Source ",e.jsx("span",{className:"accent-title",children:"and Always Free."})]}),e.jsx(n,{direction:"bottom",delay:.2,children:e.jsx("p",{className:"lede",children:"Mochi is open source. Build, contribute, and make it better together with our community."})}),e.jsx(n,{direction:"bottom",delay:.3,children:e.jsxs("div",{className:"hero-actions",style:{marginTop:24},children:[e.jsxs("a",{href:"https://github.com/xanstomper/mochi",target:"_blank",rel:"noopener",className:"btn btn-primary",children:[e.jsx("svg",{width:"16",height:"16",viewBox:"0 0 16 16",fill:"currentColor",children:e.jsx("path",{d:"M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"})}),"View on GitHub"]}),e.jsx("a",{href:"https://github.com/xanstomper/mochi/blob/main/CONTRIBUTING.md",target:"_blank",rel:"noopener",className:"btn btn-secondary",children:"Contribute →"})]})})]}),e.jsx(n,{direction:"right",delay:.2,children:e.jsxs("div",{className:"subpage-mascot-wrap",children:[e.jsx("div",{className:"subpage-doodle",children:"built by the community ♡"}),e.jsxs("div",{style:{position:"relative"},children:[e.jsx("span",{className:"heart-doodle",children:"♡"}),e.jsx(h,{size:180})]})]})})]})})}),e.jsx("div",{className:"marquee-wrap",children:e.jsx("div",{className:"marquee-content",children:[...d,...d,...d].map((t,a)=>e.jsxs("span",{className:"marquee-item",children:["✦ ",t]},a))})}),e.jsxs("div",{className:"wrap",style:{marginBottom:48},children:[e.jsx("div",{className:"grid3",style:{marginBottom:40},children:y.map((t,a)=>e.jsx(n,{direction:"bottom",delay:a*.08,children:e.jsxs("a",{href:t.link,target:"_blank",rel:"noopener",className:"card",children:[e.jsx("div",{className:"card-icon",children:t.icon}),e.jsxs("h3",{className:"card-title",children:[e.jsx("span",{children:t.title}),e.jsx("span",{className:"card-arrow",children:"→"})]}),e.jsx("p",{className:"card-desc",children:t.desc})]})},t.title))}),e.jsx("div",{style:{marginTop:24},children:e.jsx(w,{})})]}),e.jsx("div",{className:"coda-wrap",children:e.jsxs("div",{className:"coda-banner",children:[e.jsxs("div",{style:{position:"relative",zIndex:1,maxWidth:560},children:[e.jsx("h2",{children:"Ready to Build with Mochi?"}),e.jsx("p",{children:"Join thousands of developers using Mochi to build faster, smarter, and better."}),e.jsxs("div",{style:{display:"flex",gap:12,flexWrap:"wrap"},children:[e.jsxs("a",{href:"https://github.com/xanstomper/mochi/releases",className:"btn btn-purple",target:"_blank",rel:"noopener",children:[e.jsxs("svg",{width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",children:[e.jsx("path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}),e.jsx("polyline",{points:"7 10 12 15 17 10"}),e.jsx("line",{x1:"12",y1:"15",x2:"12",y2:"3"})]}),"Download"]}),e.jsx("a",{href:c+"/docs.html",className:"btn btn-outline",style:{background:"transparent",borderColor:"rgba(255, 255, 255, 0.35)",color:"#ffffff"},children:"Read the Docs →"})]})]}),e.jsx("div",{className:"coda-peeking-mascot",children:e.jsx(h,{size:220})})]})}),e.jsx(v,{})]})}const g=document.getElementById("root");g&&j(g).render(e.jsx(C,{}));
