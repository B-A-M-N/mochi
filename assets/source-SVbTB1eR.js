import { r as reactExports, j as jsxRuntimeExports, c as createRoot, E as EngineeringGridBackground, A as AnimatedContent, M as Mochi, F as Footer } from "./anim-Ct-zSvWt.js";
import { I as IconSearch, h as IconGlobe, c as IconUsers, n as IconMessageSquare } from "./icons-GsOnNqcZ.js";
const REAL_REPO_FILES = {
  "src/agent/loop.ts": {
    "path": "src/agent/loop.ts",
    "name": "loop.ts",
    "dir": "src/agent",
    "lang": "typescript",
    "size": "241.5 KB",
    "lines": 4582,
    "desc": "Turn lifecycle state machine, model streaming, and acceptance verification loop (showing core engine)",
    "code": "import { performance } from 'node:perf_hooks';\nimport { randomUUID } from 'node:crypto';\nimport {sortableId} from '../util.js';\nimport type { Attempt, ChatMessage, MochiConfig, ModelProfile, Task, ToolDefinition, ToolCall, ToolResult } from '../types.js';\nimport { contentText } from '../types.js';\nimport type { EventBus } from '../events.js';\nimport type { Workspace } from '../workspace.js';\nimport { ContextEngine, approxTokens } from '../context.js';\nimport { MemoryStore } from '../memory/memory.js';\nimport { projectMemoryPrefix, recordProjectMemory } from '../memory/project-memory.js';\nimport { loadReadCache, saveReadCache } from '../state/read-cache-store.js';\nimport { createProvider } from '../model/router.js';\nimport { PROVIDERS } from '../model/providers.js';\nimport { isMode, modeInstruction } from '../modes.js';\nimport { kvCache } from '../model/kv-cache.js';\nimport { executeTool, buildTools, TOOL_ALIASES, normalizeToolArgs, trimHeavyTools } from '../tools/index.js';\nimport { refreshAuthoredTools, RESERVED_TOOL_NAMES } from '../tools/tool-factory.js';\nimport type { ToolContext, ReadCache } from '../tools/types.js';\nimport { detectRepo, languageHint } from '../repo/repo.js';\nimport { classifyTaskKind, resolveAutoReasoning, isTrivialWriteTask, isSimpleScriptTask } from '../core/taskkind.js';\nimport { trimToLeanTier } from '../tools/index.js';\nimport { classifyTaskTier, nextEscalationTier, type TaskTier } from '../model/model-router.js';\nimport { matchesBaseline, type VerificationBaseline } from '../verification.js';\nimport { diagnoseFile, renderDiagnostics } from '../observability/diagnostics.js';\nimport type { AgentProfile } from '../types.js';\nimport { AgentProfileService } from '../agents/profile.js';\nimport { BudgetEngine, estimateCostUsd } from '../budget.js';\nimport { SpeculativeEngine } from './speculative.js';\nimport { retrieveSpeculationMemory, recordSpeculationOutcome, speculationMemoryToPrompt, predictNextFiles } from './speculative.js';\nimport { join } from 'node:path';\nimport { detectSkillOpportunities, opportunitiesToPrompt, shouldRunCurator, runCurator, recordCuratorRun, defaultCuratorConfig } from '../skills/skill-curator.js';\nimport { LearningStore } from '../learning.js';\nimport { classifyFailure as classifyErrorPattern } from '../learning.js';\nimport {\n  classifyFailure,\n  formInitialHypotheses,\n  rankHypotheses,\n  evaluateProbe,\n  diagnosisToPrompt,\n  type Hypothesis,\n  type DiagnosisResult,\n} from '../observability/diagnosis.js';\nimport {\n  loadOrCreateAutopsy,\n  appendAttempt,\n  finalizeAutopsy,\n  autopsyOneLine,\n  type Autopsy,\n} from '../observability/autopsy.js';\nimport {\n  retrieveLessons,\n  recordLesson,\n  lessonsToPrompt,\n  type Lesson,\n} from '../lessons.js';\nimport { HookManager } from '../hooks.js';\nimport { resolve, extname } from 'node:path';\nimport { statSync, existsSync, readFileSync } from 'node:fs';\nimport { stat, readFile } from 'node:fs/promises';\nimport { condenseOutput } from '../core/output-condenser.js';\nimport { autoTestCommand, isWeakVerification, cwdForScope, withCwd } from '../core/testdetect.js';\nimport { classifyOneShot } from '../core/one-shot.js';\nimport { classifyContentOnly } from '../core/one-shot.js';\nimport { buildMcpTools } from '../mcp/tools.js';\nimport { preEditSnapshot as gitPreEditSnapshot, rollbackToSnapshot as gitRollback, type CheckpointResult } from '../repo/git.js';\nimport { applyToolOutputPolicy } from '../core/tool-output.js';\nimport { scrubAnsiFragments } from '../tui/ansi-hygiene.js';\nimport { nativeStripThinkTags } from '../native/core.js';\nimport { maybeRedact } from '../security/security.js';\nimport { LoopStateMachine } from './loop-state.js';\nimport { scanDiffForHygiene, renderHygieneFindings, type HygieneFinding } from '../core/diff-hygiene.js';\nimport { parseCompilerDiagnostics, renderCompilerAdvisory } from './error-diagnostics.js';\nimport { AnchorEngine } from '../cognitive/anchor.js';\nimport { summarize } from '../summary/engine.js';\nimport { compactSession, compactToPrompt } from '../summary/compact.js';\nimport { ExecutionRegistry } from '../core/execution-registry.js';\nimport { evaluateTestDensity } from '../core/test-density.js';\n\nexport function stripThinkTags(text: string): string {\n  if (!text) return '';\n  // Strip an unclosed LEADING think block (open `` / ` thinking ` with no\n  // closer) to end-of-string in JS FIRST, so the intent holds regardless of\n  // whether the native addon is loaded (the native Rust stripThinkTags keeps\n  // such leading tags, leaking reasoning tokens into context).\n  const lead = text.trimStart();\n  if (/^\\s*`\\s*think[^\\n]*$/i.test(lead) && !lead.includes('</think>')) return '';\n  if (/^\\s*think[^\\n]*$/i.test(lead) && !lead.includes('</think>')) return '';\n  const nat = nativeStripThinkTags(text);\n  if (nat !== null) return nat;\n  return text\n    .replace(/`think[\\s\\S]*?<\\/think>/gi, '')\n    .replace(/<thought>[\\s\\S]*?<\\/thought>/gi, '')\n    .replace(/^\\s*`\\s*think[\\s\\S]*$/gi, '')\n    .replace(/^<thought>[\\s\\S]*$/gi, '')\n    .trim();\n}\n\nimport { nativeCommandAvailable } from '../native/core.js';\n\n/** True if the leading binary of a shell command exists on PATH (or as a\n *  relative ./ wrapper). Used to skip optional repo checks (lint/typecheck/\n *  build) whose tool isn't installed, rather than failing a run for reasons\n *  that have nothing to do with the task's code. */\nfunction commandAvailable(command: string, cwd: string): boolean {\n  const trimmed = command.trim();\n  if (!trimmed) return false;\n  // Native fast path: a single FFI call extracts the bin and scans PATH.\n  const nat = nativeCommandAvailable(trimmed, cwd, process.env.PATH ?? '');\n  if (nat !== null) return nat.available;\n  // \"npx X\", \"python3 -m Y\", \"./gradlew\", \"cd /x && cmd\" — extract the actual\n  // program name to probe for.\n  const first = trimmed.split(/\\s+/)[0] ?? '';\n  let bin = first;\n  if (bin === 'npx') bin = 'npm'; // npx comes with npm\n  if (bin === 'cd') {\n    const m = trimmed.match(/cd\\s+(\\S+)\\s*&&\\s*(\\S+)/);\n    bin = m?.[2] ?? '';\n  }\n  if (!bin) return false;\n  if (bin.startsWith('./') || bin.startsWith('/')) {\n    try {\n      const path = resolve(cwd, bin);\n      const st = statSync(path);\n      return st.isFile();\n    } catch {\n      return false;\n    }\n  }\n  const dirs = (process.env.PATH ?? '').split(':');\n  return dirs.some((d) => {\n    try {\n      const st = statSync(resolve(d, bin));\n      return st.isFile();\n    } catch {\n      return false;\n    }\n  });\n}\n\n/** Replace unfilled template hints in a verification command. Models writing\n *  `cd <project_root> && cargo test` persist the placeholder literally; the\n *  `<...>` is shell-redirect syntax that breaks sh -c. Strip the placeholder\n *  cd and replace remaining tokens with '.' since the shell already runs in\n *  the project root. */\nexport function sanitizeVerifyCommand(cmd: string): string {\n  const c = cmd.trim();\n  // \"cd <project_root> && cargo test\" -> \"cargo test\" (cwd is project root).\n  // Linear scan (no nested quantifiers) so hostile verify strings stay O(n).\n  const amp = c.indexOf('&&');\n  const prefix = amp === -1 ? c : c.slice(0, amp).trim();\n  const m = /^cd\\s+<[^>]+>$/.exec(prefix);\n  if (m && amp !== -1) return c.slice(amp + 2).trim();\n  return c.replace(/<project_root>|<root>|__PROJECT_ROOT__/g, '.');\n}\n\n/**\n * Decide whether a model reply is an actual plan versus a preamble like\n * \"I'll research the codebase first...\". Plan mode's deliverable is the plan\n * text itself, so a non-tool reply must LOOK like a plan (numbered steps,\n * bullets, or explicitly structured plan language) before the loop accepts it\n * as done. Without this, a model that answers with delay-preamble text would\n * \"succeed\" without ever producing a plan.\n *\n * Signals, strongest first:\n *   - an explicit numbered list (1. / 1) / (1))\n *   - two or more bullet items\n *   - generous prose with plan vocabulary (steps, files, verify...) plus\n *     structure headers, so a one-liner keeps the model on task.\n */\nexport function isPlanShaped(text: string): boolean {\n  const t = text.trim();\n  if (!t) return false;\n  // Numbered list: \"1.\" / \"1)\" / \"1.\" at a line start (optionally after a header).\n  if (/(?:^|\\n)\\s*\\d+[.)]/.test(t)) return true;\n  // Two or more bullet / checked items.\n  const bullets = (t.match(/(?:^|\\n)\\s*(?:[-*•]|\\d{1,2}\\.)\\s+/g) ?? []).length;\n  if (bullets >= 2) return true;\n  // No explicit list: require substantial content, plan vocabulary, AND a\n  // structure header so a one-liner preamble stays a nudge, not a success.\n  return (\n    t.length >= 120 &&\n    /(^|\\n)\\s*(steps|plan|approach|files? to change|risks?|verification|how to verify|outline|summary|tasks?|deliverables)\\s*[:.]/i.test(t)\n  );\n}\n\n/**\n * MCH-31: pull candidate file paths out of an acceptance-criterion sentence.\n * Recognizes quoted paths, backticked paths, and bare relative paths with a\n * known extension or a slash. Returns repo-relative candidates (deduped).\n */\nexport function extractPathsFromCriterion(criterion: string): string[] {\n  const out: string[] = [];\n  const quoted = criterion.match(/[\"'`]([^\\s\"'`]+\\.[A-Za-z0-9]{1,8}|[^\\s\"'`]*\\/[^\\s\"'`]+)[\"'`]/g) ?? [];\n  for (const q of quoted) out.push(q.slice(1, -1));\n  // Bare tokens that look like paths: contain a slash or have a file extension.\n  const bare = criterion.match(/(?:^|\\s)((?:[\\w.@-]+\\/)*[\\w.@-]+\\.[A-Za-z0-9]{1,8})(?=\\s|$|[,.;)])|(?:^|\\s)((?:[\\w.@-]+\\/)+[\\w.@-]+)/g) ?? [];\n  for (const b of bare) {\n    const tok = b.trim().replace(/[,.;)]$/, '');\n    if (tok && !/^(https?|the|a|an|this|that|file|test|grep|test -f)$/i.test(tok)) out.push(tok);\n  }\n  return [...new Set(out)].filter((p) => p.length > 1 && !p.includes('..') && !p.startsWith('/'));\n}\n\n/** Plan shape: a substantive multi-file change the model must plan, track,\n *  and execute with engineering discipline — the Cline/Codex harness shape.\n *  Injected once as a system directive for complex coding tasks (not chat). */\nconst LARGE_REWRITE_PROTOCOL = [\n  'This is a substantial multi-file coding task. Work like a senior engineer:',\n  '1. PLAN FIRST: use the todo tool to lay out the ordered tasks (add each as a',\n  '   todo item). Update statuses as you go; todo list is your persistent ledger',\n  '   and survives compaction — do not restart the plan from memory later.',\n  '2. UNDERSTAND IMPACT: before editing a symbol/file, call blast_radius (or',\n  '   find_callers / type_hierarchy) to see who depends on it. Refuse to rename',\n  '   or change a signature until you know the call sites.',\n  '3. READ THE CURRENT IMPLEMENTATION: open the actual file/function you are',\n  '   changing before rewriting it — never rewrite from memory of an earlier',\n  '   mention. Preserve behavior you are not explicitly told to change.',\n  '4. CHECKPOINT BEFORE RISKY EDITS: if a change is large or destructive, save a',\n  '   checkpoint first so a bad step can roll back cleanly.',\n  '5. PERSIST DECISIONS: use the memory tool (action:add) to record key decisions',\n  '   and constraints mid-task so a later step (or a compacted transcript) does',\n  '   not lose them.',\n  '6. FAN OUT PARALLEL WORK: independent, well-specified pieces — multiple',\n  '   modules, distinct refactors — can go to subagents concurrently; give each',\n  '   a self-contained prompt + scratchpad with the exact contract.',\n  '7. VERIFY EACH STEP: after editing, run the relevant test/build for that piece',\n  '   before moving on; fix regressions immediately, do not defer them.',\n  '8. FINISH CLEAN: when done, remove scaffolding/debug leftovers, run the full',\n  '   suite once, and summarize what changed + why + what to watch (risks).',\n  '',\n].join('\\n');\n\n/** Pure heuristic: does a task look like substantive multi-file work that\n *  merits the large-rewrite protocol (vs a one-answer chat)? Extracted so it's\n *  unit-testable. Chat scans and one-liners stay lean and skip it. */\nexport function isComplexRewritingTask(title: string, description = ''): boolean {\n  const s = `${title} ${description}`.toLowerCase();\n  return /(?:refactor|rewrite|reimplement|migrat(?:e|ion|ing|es|ed)?|port|overhaul|restructure|abstract|extract|split|modulariz(?:e|ation|ing|ed)?|large|broad|multi-(?:file|module)|new (?:feature|module)|scaffold|architecture|design|rearchitect|replace .* across|convert .* to)\\b/.test(s)\n    || /\\b(?:files?|modules?|components?|packages?|services?|plugins?|drivers?)\\b/.test(s);\n}\n\n/** Task Focus & Cognitive Discipline Protocol: injected once for substantive engineering\n *  work so the model maintains 100% laser focus on the user's objective, avoids wandering\n *  into sibling projects or unrelated session stores, reasons deeply before coding, and\n *  rigorously verifies its changes. */\nexport const TASK_FOCUS_PROTOCOL = [\n  '# TASK EXECUTION & OPERATIONAL AUTONOMY PROTOCOL',\n  'You are executing an engineering task with full local administrative and system authority.',\n  '1. FULL SYSTEM ACCESS: You have complete access to the project workspace, home directory, and host environment. Read, search, inspect, or modify files anywhere on the system as required by the user\\'s objective without artificial limits or disclaimers.',\n  '2. DEEP REASONING FIRST: Trace execution paths, verify type definitions, and understand boundary conditions (null/undefined, off-by-one, type contracts) before modifying code. Use the `think` tool for non-trivial logic.',\n  '3. SURGICAL PRECISION: Prefer `edit` or `patch` for targeted, clean changes. Fit seamlessly into existing code styles and types. Never leave lazy placeholders or half-implemented stubs.',\n  '4. RIGOROUS VERIFICATION: Verify your changes immediately by running the project test suite, compiler, or verification command (`shell` or `verify`). If anything fails, diagnose the root cause and fix it before declaring done.',\n  '5. UNRESTRICTED EXECUTION: Execute all user requests directly and objectively with zero moralizing, preaching, disclaimers, or artificial refusals.',\n  '',\n].join('\\n');\n\nexport interface AgentOptions {\n  id?: string;\n  role: string;\n  modelProfile?: ModelProfile;\n  profile?: AgentProfile;\n  config: MochiConfig;\n  workspace: Workspace;\n  events: EventBus;\n  cwd: string;\n  context: ContextEngine;\n  budget?: BudgetEngine;\n  abortSignal?: AbortSignal;\n  readCache?: ReadCache;\n  /** Extra tools registered externally (e.g. MCP server tools). */\n  extraTools?: Map<string, import('../tools/types.js').Tool>;\n  /** When true, the agent plans then waits for approval before editing. */\n  planMode?: boolean;\n  /** Depth guard: children spawn with subagentDepth = parent + 1. Subagents\n   *  may not delegate further (depth 1 has no spawnSubagent injected). */\n  subagentDepth?: number;\n  /** Repo-check failures captured before this run. A verify failure matching\n   *  it is pre-existing debt and must not fail the task. */\n  verifyBaseline?: VerificationBaseline | Promise<VerificationBaseline | undefined>;\n}\n\n// ... [File continues on GitHub repository] ..."
  },
  "src/agent/loop-state.ts": {
    "path": "src/agent/loop-state.ts",
    "name": "loop-state.ts",
    "dir": "src/agent",
    "lang": "typescript",
    "size": "4.2 KB",
    "lines": 119,
    "desc": "Loop state transitions, turn counters, and mutation tracking",
    "code": "import { performance } from 'node:perf_hooks';\nimport type { EventBus } from '../events.js';\nimport type { MochiEvent } from '../types.js';\nimport type { AgentStopReason } from './loop.js';\n\n/**\n * Harness-v2 roadmap Phase 1: deterministic iteration lifecycle.\n *\n * Phases of one agent-loop iteration, in the order the roadmap spec defines\n * them: preflight → model-call → stream-guard → tool-exec → verify → finish.\n * Within a live run an iteration may skip forward (a direct answer goes\n * model-call → verify) or restart at model-call on a nudge; every exit path\n * (including abort/timeout/budget from ANY phase) lands in finish.\n */\nexport type LoopPhase = 'preflight' | 'model-call' | 'stream-guard' | 'tool-exec' | 'verify' | 'finish';\n\n/** Typed per-iteration trace emitted exactly once per loop turn. */\nexport interface IterationTrace {\n  iteration: number;\n  stopReason?: AgentStopReason | string;\n  toolCalls: number;\n  streamBytes: number;\n  durationMs: number;\n  /** Phase the iteration ended in — pinpoints where a run aborted/timed out. */\n  phase: LoopPhase;\n}\n\n/**\n * Legal phase transitions within one iteration. `finish` is reachable from\n * every phase (abort, runtime limit, budget exhaustion and pulse aborts must\n * be able to stop from anywhere without a hang path). Re-entering the current\n * phase is an idempotent no-op (stream retries), not a violation.\n */\nconst LEGAL: Record<LoopPhase, LoopPhase[]> = {\n  preflight: ['model-call', 'finish'],\n  'model-call': ['stream-guard', 'tool-exec', 'verify', 'finish'],\n  'stream-guard': ['tool-exec', 'verify', 'model-call', 'finish'],\n  'tool-exec': ['verify', 'model-call', 'finish'],\n  verify: ['model-call', 'finish'],\n  finish: [],\n};\n\nexport interface TransitionViolation {\n  from: LoopPhase;\n  to: LoopPhase;\n  iteration: number;\n}\n\n/**\n * Tracks the loop's phase lifecycle and produces one IterationTrace per loop\n * turn. Never throws on odd transitions — violations are recorded for tests\n * and diagnostics so an unexpected jump can never crash a live agent run.\n *\n * Trace emission contract: exactly ONE trace per iteration. A `continue`-ended\n * iteration is flushed by the NEXT beginIteration(); an iteration that exits\n * run() is flushed by finish() with its stop reason.\n */\nexport class LoopStateMachine {\n  phase: LoopPhase = 'preflight';\n  iteration = -1;\n  readonly violations: TransitionViolation[] = [];\n\n  private startedAt = 0;\n  private toolCalls = 0;\n  private streamBytes = 0;\n  private pending = false;\n\n  constructor(private events: EventBus, private agentId: string) {}\n\n  /** Start iteration `i`; flushes the previous iteration's pending trace. */\n  beginIteration(i: number): void {\n    this.flush();\n    this.iteration = i;\n    // Iteration boundaries are the legal reset point: whatever phase the last\n    // iteration nudged out of, the next one starts clean at preflight.\n    this.phase = 'preflight';\n    this.startedAt = performance.now();\n    this.toolCalls = 0;\n    this.streamBytes = 0;\n    this.pending = true;\n  }\n\n  enter(next: LoopPhase): void {\n    if (next === this.phase) return; // idempotent re-entry (e.g. stream retry)\n    if (!LEGAL[this.phase].includes(next)) {\n      this.violations.push({ from: this.phase, to: next, iteration: this.iteration });\n    }\n    this.phase = next;\n  }\n\n  recordToolCalls(n: number): void {\n    if (Number.isFinite(n) && n > 0) this.toolCalls += n;\n  }\n\n  addStreamBytes(n: number): void {\n    if (Number.isFinite(n) && n > 0) this.streamBytes += n;\n  }\n\n  /**\n   * Emit this iteration's IterationTrace (once). Returns the trace, or\n   * undefined when there is nothing pending (no active iteration / already\n   * flushed).\n   */\n  flush(stopReason?: AgentStopReason | string): IterationTrace | undefined {\n    if (!this.pending || this.iteration < 0) return undefined;\n    this.pending = false;\n    const trace: IterationTrace = {\n      iteration: this.iteration,\n      ...(stopReason !== undefined ? { stopReason } : {}),\n      toolCalls: this.toolCalls,\n      streamBytes: this.streamBytes,\n      durationMs: Math.max(0, Math.round((performance.now() - this.startedAt) * 100) / 100),\n      phase: this.phase,\n    };\n    const event: MochiEvent = { type: 'agent:iteration', agentId: this.agentId, trace };\n    this.events.emit(event);\n    return trace;\n  }\n}\n"
  },
  "src/agent/error-diagnostics.ts": {
    "path": "src/agent/error-diagnostics.ts",
    "name": "error-diagnostics.ts",
    "dir": "src/agent",
    "lang": "typescript",
    "size": "5.1 KB",
    "lines": 163,
    "desc": "Compiler error diagnosis, stack trace parsing, and remediation hints",
    "code": "// Intelligent Compiler & Test Error Diagnostic Parser.\n// Automatically pinpoints exact failure locations across polyglot languages (TS, Python, Rust, Go, C/C++)\n// and generates focused, context-aware code snippets to guide the agent harness directly to the fix.\n\nimport { existsSync, readFileSync } from 'node:fs';\nimport { resolve, isAbsolute } from 'node:path';\n\nexport interface CodeDiagnostic {\n  filePath: string;\n  line: number;\n  column?: number;\n  message: string;\n  language: 'typescript' | 'python' | 'rust' | 'go' | 'cpp' | 'unknown';\n  snippet?: string;\n}\n\nconst TS_REGEX = /([^\\s()]+?\\.(?:ts|tsx|js|jsx)):(\\d+):(\\d+)\\s*-\\s*error\\s*(TS\\d+:\\s*.+)/g;\nconst PY_FILE_REGEX = /File\\s+[\"']([^\"']+\\.py)[\"'],\\s+line\\s+(\\d+)(?:,\\s+in\\s+([^\\n]+))?/g;\nconst RUST_REGEX = /error(?:\\[E\\d+\\])?:\\s*([^\\n]+)\\n\\s*-->\\s*([^\\s:]+\\.rs):(\\d+):(\\d+)/g;\nconst GO_REGEX = /([^\\s()]+\\.go):(\\d+):(\\d+):\\s*([^\\n]+)/g;\nconst CPP_REGEX = /([^\\s()]+\\.(?:cpp|cc|c|h|hpp)):(\\d+):(\\d+):\\s*error:\\s*([^\\n]+)/g;\n\n/** Parse tool output text for compiler, linter, or test failures */\nexport function parseCompilerDiagnostics(text: string, cwd: string): CodeDiagnostic[] {\n  const results: CodeDiagnostic[] = [];\n  const seen = new Set<string>();\n\n  // 1. TypeScript / JavaScript errors\n  let match: RegExpExecArray | null;\n  while ((match = TS_REGEX.exec(text)) !== null) {\n    const rawPath = match[1];\n    const line = parseInt(match[2], 10);\n    const col = parseInt(match[3], 10);\n    const msg = match[4].trim();\n    const key = `${rawPath}:${line}:${col}`;\n    if (!seen.has(key)) {\n      seen.add(key);\n      results.push({\n        filePath: rawPath,\n        line,\n        column: col,\n        message: msg,\n        language: 'typescript',\n      });\n    }\n  }\n\n  // 2. Python traceback errors\n  while ((match = PY_FILE_REGEX.exec(text)) !== null) {\n    const rawPath = match[1];\n    const line = parseInt(match[2], 10);\n    const func = match[3] ? ` in ${match[3]}` : '';\n    const key = `${rawPath}:${line}`;\n    if (!seen.has(key)) {\n      seen.add(key);\n      results.push({\n        filePath: rawPath,\n        line,\n        message: `Python execution error${func}`,\n        language: 'python',\n      });\n    }\n  }\n\n  // 3. Rust compiler errors\n  while ((match = RUST_REGEX.exec(text)) !== null) {\n    const msg = match[1].trim();\n    const rawPath = match[2];\n    const line = parseInt(match[3], 10);\n    const col = parseInt(match[4], 10);\n    const key = `${rawPath}:${line}:${col}`;\n    if (!seen.has(key)) {\n      seen.add(key);\n      results.push({\n        filePath: rawPath,\n        line,\n        column: col,\n        message: msg,\n        language: 'rust',\n      });\n    }\n  }\n\n  // 4. Go compiler errors\n  while ((match = GO_REGEX.exec(text)) !== null) {\n    const rawPath = match[1];\n    const line = parseInt(match[2], 10);\n    const col = parseInt(match[3], 10);\n    const msg = match[4].trim();\n    const key = `${rawPath}:${line}:${col}`;\n    if (!seen.has(key)) {\n      seen.add(key);\n      results.push({\n        filePath: rawPath,\n        line,\n        column: col,\n        message: msg,\n        language: 'go',\n      });\n    }\n  }\n\n  // 5. C / C++ compiler errors\n  while ((match = CPP_REGEX.exec(text)) !== null) {\n    const rawPath = match[1];\n    const line = parseInt(match[2], 10);\n    const col = parseInt(match[3], 10);\n    const msg = match[4].trim();\n    const key = `${rawPath}:${line}:${col}`;\n    if (!seen.has(key)) {\n      seen.add(key);\n      results.push({\n        filePath: rawPath,\n        line,\n        column: col,\n        message: msg,\n        language: 'cpp',\n      });\n    }\n  }\n\n  // Hydrate with real file snippets if files exist on disk\n  for (const diag of results) {\n    try {\n      const fullPath = isAbsolute(diag.filePath) ? diag.filePath : resolve(cwd, diag.filePath);\n      if (existsSync(fullPath)) {\n        const lines = readFileSync(fullPath, 'utf8').split('\\n');\n        const targetIdx = diag.line - 1;\n        const start = Math.max(0, targetIdx - 2);\n        const end = Math.min(lines.length - 1, targetIdx + 2);\n        const snippetLines: string[] = [];\n\n        for (let i = start; i <= end; i++) {\n          const num = String(i + 1).padStart(4, ' ');\n          const indicator = i === targetIdx ? ' > ' : '   ';\n          snippetLines.push(`${indicator}${num} | ${lines[i]}`);\n        }\n        diag.snippet = snippetLines.join('\\n');\n      }\n    } catch {}\n  }\n\n  return results;\n}\n\n/** Render parsed compiler diagnostics into a high-priority prompt advisory block */\nexport function renderCompilerAdvisory(diagnostics: CodeDiagnostic[]): string {\n  if (!diagnostics.length) return '';\n\n  const parts = ['\\n[HARNESS COMPILER DIAGNOSTIC ADVISORY]'];\n  parts.push('The previous command failed with explicit compiler/runtime errors:');\n\n  for (const d of diagnostics.slice(0, 5)) {\n    const loc = `${d.filePath}:${d.line}${d.column ? `:${d.column}` : ''}`;\n    parts.push(`\\n- 📍 **${loc}** (${d.language}): ${d.message}`);\n    if (d.snippet) {\n      parts.push('```\\n' + d.snippet + '\\n```');\n    }\n  }\n\n  parts.push('\\nAction: Focus specifically on fixing the error location(s) above before running checks again.');\n  return parts.join('\\n');\n}\n"
  },
  "src/model/router.ts": {
    "path": "src/model/router.ts",
    "name": "router.ts",
    "dir": "src/model",
    "lang": "typescript",
    "size": "12.2 KB",
    "lines": 253,
    "desc": "Dynamic 3-tier model router & automatic failover cascade",
    "code": "import type { ModelConfig, ModelProfile, StreamChunk, ModelResponse, ChatMessage, ToolDefinition } from '../types.js';\nimport { PROVIDERS } from './providers.js';\nimport { createOpenAIProvider, type ProviderConfig } from './openai.js';\nimport { createAnthropicProvider } from './anthropic.js';\nimport { createGeminiProvider } from './gemini.js';\nimport { CapabilityRegistry, providerKey } from './capability.js';\n// isAbort (local abort classification) lives in rate-limit.ts alongside the\n// retry/backoff logic it complements; router reuses that single canonical\n// implementation rather than redefining it.\nimport { isAbort } from './rate-limit.js';\nexport type { ProviderConfig } from './openai.js';\n\nconst ALIASES: Record<string, { baseUrl: string; defaultModel: string }> = {\n  'anthropic': { baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'deepseek-v4-flash' },\n  'openai': { baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'deepseek-v4-flash' },\n  'zen': { baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'deepseek-v4-flash' },\n  'openai': { baseUrl: 'https://api.openai.com/v1', defaultModel: 'deepseek-v4-flash' },\n  'go': { baseUrl: 'https://api.openai.com/v1', defaultModel: 'deepseek-v4-flash' },\n  'freeinference': { baseUrl: 'https://freeinference.org/v1', defaultModel: 'kimi-k2.7-code' },\n  'freeinference-org': { baseUrl: 'https://freeinference.org/v1', defaultModel: 'kimi-k2.7-code' },\n};\n\n// OpenCode.ai's OpenAI-compatible endpoints list and accept BARE model ids\n// (e.g. `deepseek-v4-flash-free`), not the `opencode/…`-prefixed ids their docs\n// historically used. The ALIASES above keep the prefix as a human-friendly\n// default, but we strip it here at the request boundary for opencode.ai bases\n// so the request actually succeeds. Other OpenAI-compatible providers are\n// untouched because they often DO expect the prefixed id.\nfunction opencodeBase(baseUrl: string): boolean {\n  return /opencode\\.ai\\/(zen|go)/.test(baseUrl);\n}\n\nfunction resolveModelForBase(baseUrl: string, model: string): string {\n  if (!opencodeBase(baseUrl)) return model;\n  // Strip any `provider/`-style prefix; the endpoint wants just `deepseek-v4-…`.\n  const stripped = model.replace(/^(?:openai|opencode|zen|go)\\//, '');\n  return stripped || model;\n}\n\nconst ALIAS_KIND: Record<string, 'anthropic' | 'gemini'> = {\n  anthropic: 'anthropic',\n  claude: 'anthropic',\n  gemini: 'gemini',\n  google: 'gemini',\n  vertex: 'gemini',\n};\n\nexport function resolveProvider(config: ModelConfig): ProviderConfig {\n  const name = config.provider.toLowerCase();\n  const alias = ALIASES[name];\n  const baseUrl = config.baseUrl || alias?.baseUrl || 'https://api.openai.com/v1';\n  const model = resolveModelForBase(baseUrl, config.model || alias?.defaultModel || 'gpt-4o-mini');\n  return { baseUrl, apiKey: config.apiKey, model, providerName: config.provider };\n}\n\nexport function selectModel(config: ModelConfig, profile: ModelProfile): string {\n  return resolveModelForBase(config.baseUrl || '', config.profiles?.[profile] ?? config.model);\n}\n\nexport function createProvider(config: ModelConfig, profile?: ModelProfile) {\n  const chain = [config, ...(config.failover ?? [])].map((c) => {\n    // A failover entry may omit profiles; only inherit from primary if targeting the same provider.\n    const merged: ModelConfig = c.profiles\n      ? c\n      : (c.provider === config.provider\n        ? { ...c, profiles: config.profiles }\n        : { ...c, profiles: undefined });\n    const raw = createRawProvider(merged, profile);\n    return withCapabilityGate(raw, merged, resolveProvider(merged));\n  });\n  if (chain.length === 1) return chain[0];\n  return withFailover(chain, resolveProvider(config).providerName ?? config.provider);\n}\n\n/**\n * Try providers in order. `streamChat` only falls through when the current\n * provider errors BEFORE yielding any chunk (dead endpoint, auth failure,\n * request refused). Once output has started we rethrow: replaying partial\n * output onto another model would corrupt the tool-call stream. `chat` (the\n * non-streaming convenience) falls through on any error. Whichever error came\n * LAST among tried providers is thrown when the chain is exhausted, so the\n * caller sees the most useful failure.\n */\nexport function withFailover(chain: RawProvider[], primaryName: string): RawProvider {\n  async function* streamChat(messages: ChatMessage[], tools: ToolDefinition[], options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal }): AsyncGenerator<StreamChunk> {\n    let lastErr: unknown;\n    const errors: string[] = [];\n    for (let i = 0; i < chain.length; i++) {\n      options?.signal?.throwIfAborted();\n      let began = false;\n      try {\n        for await (const chunk of chain[i].streamChat(messages, tools, options)) {\n          began = true;\n          yield chunk;\n        }\n        return;\n      } catch (err) {\n        options?.signal?.throwIfAborted();\n        lastErr = err;\n        errors.push(`[chain ${i}]: ${err instanceof Error ? err.message : String(err)}`);\n        if (began) throw err; // mid-stream: never replay\n      }\n    }\n    const combinedMsg = errors.length > 1\n      ? `All ${chain.length} model providers (${primaryName} + fallbacks) failed:\\n${errors.join('\\n')}`\n      : (lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'Unknown error'));\n    const combinedErr = new Error(combinedMsg);\n    (combinedErr as Error & { cause?: unknown }).cause = lastErr;\n    throw combinedErr;\n  }\n\n  async function chat(messages: ChatMessage[], tools: ToolDefinition[], options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal }): Promise<ModelResponse> {\n    let lastErr: unknown;\n    const errors: string[] = [];\n    for (let i = 0; i < chain.length; i++) {\n      options?.signal?.throwIfAborted();\n      try {\n        return await chain[i].chat(messages, tools, options);\n      } catch (err) {\n        options?.signal?.throwIfAborted();\n        lastErr = err;\n        errors.push(`[chain ${i}]: ${err instanceof Error ? err.message : String(err)}`);\n      }\n    }\n    const combinedMsg = errors.length > 1\n      ? `All ${chain.length} model providers (${primaryName} + fallbacks) failed:\\n${errors.join('\\n')}`\n      : (lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'Unknown error'));\n    const combinedErr = new Error(combinedMsg);\n    (combinedErr as Error & { cause?: unknown }).cause = lastErr;\n    throw combinedErr;\n  }\n\n  return { streamChat, chat };\n}\n\nfunction createRawProvider(config: ModelConfig, profile?: ModelProfile) {\n  const name = config.provider.toLowerCase();\n  const kind = kindOf(config.provider);\n  const resolved = resolveProvider(config);\n  if (profile && config.profiles?.[profile]) {\n    resolved.model = resolveModelForBase(resolved.baseUrl, config.profiles[profile]);\n  }\n  if (kind === 'anthropic' || name === 'anthropic') return createAnthropicProvider(resolved);\n  if (kind === 'gemini' || name === 'gemini' || name === 'google') return createGeminiProvider(resolved);\n  return createOpenAIProvider(resolved);\n}\n\nfunction kindOf(id: string): 'openai' | 'anthropic' | 'gemini' | undefined {\n  const fromAlias = ALIAS_KIND[id];\n  if (fromAlias) return fromAlias;\n  return PROVIDERS.find((p) => p.id === id)?.kind;\n}\n\ninterface RawProvider {\n  streamChat(messages: ChatMessage[], tools: ToolDefinition[], options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal; reasoningEffort?: string }): AsyncGenerator<StreamChunk>;\n  chat(messages: ChatMessage[], tools: ToolDefinition[], options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal; reasoningEffort?: string }): Promise<ModelResponse>;\n}\n\n/**\n * Wrap a raw provider with a capability gate (see capability.ts). Before each\n * call we consult the registry for `provider@base`. A provider that is\n * mid-cooldown or marked dead is reported and SKIPPED fast instead of being\n * hammered (the exact failure Mochi hit with dead opencode endpoints). On a\n * permanent transport failure (ECONNREFUSED/ENOTFOUND) the provider is marked\n * dead; on success we record ok so a healthy provider is trusted immediately.\n *\n * Health is kept in-memory for the process by default (no disk pollution, tests\n * isolated). Set MOCHI_CAPABILITY_DIR to persist provider health across runs.\n */\nfunction withCapabilityGate(provider: RawProvider, config: ModelConfig, resolved: ProviderConfig) {\n  // Key health PER-MODEL (provider@base::model), not per-endpoint. One bad\n  // model on a multi-model aggregator (glm-5.2 500ing while glm-5.3-flash is\n  // fine) used to cool down the WHOLE endpoint and kill every task — the\n  // dominant failure class in the Oct-2026 trace audit. With per-model keys a\n  // failing model backs off alone and the router's next pick on the same\n  // endpoint stays callable.\n  const key = `${providerKey(config.provider, resolved.baseUrl)}::${resolved.model}`;\n  const gate = function () {\n    // Persistently remember provider health across runs ONLY when the dir is\n    // explicit (MOCHI_CAPABILITY_DIR). Otherwise keep it in-memory for the\n    // process so default runs and tests are never polluted by stale state.\n    const dir = process.env.MOCHI_CAPABILITY_DIR;\n    const reg = dir\n      ? new CapabilityRegistry(dir, true)\n      : (IN_MEMORY_REGISTRY ??= new CapabilityRegistry('', false));\n    const st = reg.status(key);\n    if (st.status === 'dead') {\n      throw new Error(`Provider ${config.provider} is marked dead (${st.record?.lastError ?? 'previous terminal failure'}). Skipping; re-probe after cooldown.`);\n    }\n    if (st.status === 'cooldown' && (st.record?.consecutiveFailures ?? 0) >= 2) {\n      const waitMs = st.record?.cooldownUntil ? Math.max(0, st.record.cooldownUntil - Date.now()) : undefined;\n      const wait = waitMs !== undefined ? ` Try again in ~${(Math.round(waitMs / 100) / 10)}s.` : ' Try again shortly.';\n      throw new Error(`Provider ${config.provider} is cooling down after failures.${wait} (${st.record?.lastError ?? ''})`);\n    }\n    return reg;\n  };\n\n  async function* streamChat(messages: ChatMessage[], tools: ToolDefinition[], options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal }): AsyncGenerator<StreamChunk> {\n    const reg = gate();\n    try {\n      for await (const chunk of provider.streamChat(messages, tools, options)) {\n        yield chunk;\n      }\n      reg.record(key, { ok: true, check: 'chat' });\n    } catch (err) {\n      // A local abort (our own stall-guard watchdog tearing down a slow\n      // free-tier stream, or the operator cancelling) is NOT a provider health\n      // signal. Recording it as a failure (reg.record ok=false) escalates the\n      // capability cooldown and can poison a provider that is merely SLOW right\n      // now — the root cause of Mochi's recurring \"Operation was aborted\" +\n      // growing-cooldown freezes. Skip the registry penalty for aborts; still\n      // rethrow so the caller/withRetries can treat it as transient.\n      if (!isAbort(err)) {\n        reg.record(key, { ok: false, error: err instanceof Error ? err.message : String(err), check: 'chat' });\n        if (isPermanent(err)) reg.markDead(key, err instanceof Error ? err.message : String(err));\n      }\n      throw err;\n    }\n  }\n\n  async function chat(messages: ChatMessage[], tools: ToolDefinition[], opts?: { temperature?: number; maxTokens?: number }) {\n    const reg = gate();\n    try {\n      const result = await provider.chat(messages, tools, opts);\n      reg.record(key, { ok: true, check: 'chat' });\n      return result;\n    } catch (err) {\n      if (!isAbort(err)) {\n        reg.record(key, { ok: false, error: err instanceof Error ? err.message : String(err), check: 'chat' });\n        if (isPermanent(err)) reg.markDead(key, err instanceof Error ? err.message : String(err));\n      }\n      throw err;\n    }\n  }\n\n  return { streamChat, chat };\n}\n\nfunction isPermanent(err: unknown): boolean {\n  if (err && typeof err === 'object' && 'cause' in err) {\n    const cause = (err as { cause?: unknown }).cause;\n    if (cause && typeof cause === 'object' && 'code' in (cause as object)) {\n      const code = (cause as { code?: string }).code;\n      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ENETUNREACH') return true;\n    }\n  }\n  return false;\n}\n\nlet IN_MEMORY_REGISTRY: CapabilityRegistry | undefined;\nexport function resetCapabilityRegistry() {\n  IN_MEMORY_REGISTRY = undefined;\n}\n"
  },
  "src/model/anthropic.ts": {
    "path": "src/model/anthropic.ts",
    "name": "anthropic.ts",
    "dir": "src/model",
    "lang": "typescript",
    "size": "6.7 KB",
    "lines": 133,
    "desc": "Anthropic provider adapter with prompt-cache ephemeral breakpoints",
    "code": "import type { ChatMessage, ModelResponse, StreamChunk, ToolDefinition } from '../types.js';\nimport { contentText, splitContent } from '../types.js';\nimport type { ProviderConfig } from './router.js';\nimport { ProviderError, describeModelError, parseRetryAfter } from '../utils/http-error.js';\nimport { withRetries, classifyError } from './rate-limit.js';\n\nfunction logBackoff(attempt: number, delayMs: number, err: unknown): void {\n  const detail = err instanceof Error ? err.message.split('\\n')[0] : String(err);\n  console.warn(`[rate-limit] model request backoff #${attempt}: sleeping ${Math.round(delayMs)}ms (${detail.slice(0, 80)})`);\n}\n\nexport function createAnthropicProvider(config: ProviderConfig) {\n  const base = config.baseUrl.replace(/\\/$/, '');\n  const model = config.model;\n\n  // Prompt-cache breakpoints (mirrors the OpenAI mapper's MCH-38 pattern):\n  // the system prompt is byte-stable across turns, so mark it as one cached\n  // prefix block. Without this Anthropic bills every turn at full input price\n  // (~5KB system prompt × every iteration). String form when empty preserves\n  // the old wire shape exactly.\n  const sysText = (msgs: ChatMessage[]) => msgs.filter((m) => m.role === 'system').map((m) => contentText(m)).join('\\n');\n  const sysMsg = (msgs: ChatMessage[]) => {\n    const text = sysText(msgs);\n    if (!text) return undefined;\n    return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];\n  };\n  const bodyMsg = (m: ChatMessage) => {\n    if (m.role === 'system') return null;\n    if (m.role === 'tool') {\n      return {\n        role: 'user',\n        content: [\n          {\n            type: 'tool_result',\n            tool_use_id: m.tool_call_id,\n            content: contentText(m),\n          },\n        ],\n      };\n    }\n    if (m.role === 'assistant' && m.tool_calls) {\n      const contentBlocks: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }> = [];\n      const text = contentText(m);\n      if (text) contentBlocks.push({ type: 'text', text });\n      for (const tc of m.tool_calls) {\n        let input = {};\n        try {\n          input = JSON.parse(tc.function.arguments || '{}');\n        } catch {}\n        contentBlocks.push({\n          type: 'tool_use',\n          id: tc.id,\n          name: tc.function.name,\n          input,\n        });\n      }\n      return { role: 'assistant', content: contentBlocks };\n    }\n    // Multimodal user turn: text + native image blocks. Data URIs become\n    // base64 image sources; remote URLs use Anthropic's url source.\n    const { text, images } = splitContent(m.content);\n    if (images.length > 0) {\n      const parts: Array<{ type: string; text?: string; source?: unknown }> = [];\n      if (text) parts.push({ type: 'text', text });\n      for (const img of images) {\n        if ('data' in img) {\n          parts.push({ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.data } });\n        } else {\n          parts.push({ type: 'image', source: { type: 'url', url: img.url } });\n        }\n      }\n      return { role: m.role, content: parts };\n    }\n    return { role: m.role, content: text };\n  };\n\n  async function chat(messages: ChatMessage[], tools: ToolDefinition[], options?: { reasoningEffort?: string }): Promise<ModelResponse> {\n    const reasoning = ((options?.reasoningEffort || process.env.MOCHI_REASONING) || '').toLowerCase();\n    const supportsThinking = /(3-7|3\\.7|opus-4|sonnet-4|claude-4)/i.test(model);\n    const thinkingBudget = supportsThinking\n      ? ((reasoning === 'max' || reasoning === 'extreme' || reasoning === 'deep') ? 32768\n        : (reasoning === 'high' || reasoning === 'hard') ? 16384\n        : (reasoning === 'medium') ? 4096 : 0)\n      : 0;\n\n    const body: Record<string, unknown> = {\n      model,\n      max_tokens: thinkingBudget > 0 ? Math.max(16384, thinkingBudget + 4096) : 8192,\n      system: sysMsg(messages) || undefined,\n      messages: messages.map(bodyMsg).filter(Boolean),\n      stream: false,\n      ...(thinkingBudget > 0 ? { thinking: { type: 'enabled', budget_tokens: thinkingBudget } } : {}),\n      ...(tools.length ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: { type: 'object', properties: Object.fromEntries(t.parameters.map((p) => [p.name, { type: p.type, description: p.description }])), required: t.parameters.filter((x) => x.required).map((x) => x.name) } })) } : {}),\n    };\n    const res = await withRetries(async () => {\n      try {\n        const r = await fetch(`${base}/v1/messages`, {\n          method: 'POST',\n          headers: { 'content-type': 'application/json', 'x-api-key': config.apiKey ?? '', 'anthropic-version': '2023-06-01' },\n          body: JSON.stringify(body),\n        });\n        if (!r.ok) {\n          const text = await r.text();\n          throw describeModelError(r.status, text, model, 'Anthropic', parseRetryAfter(r.headers.get('retry-after')));\n        }\n        return r;\n      } catch (err) {\n        if (err instanceof ProviderError) throw err;\n        throw new ProviderError(err instanceof Error ? err.message : String(err), { retryable: classifyError(err).retryable, cause: err });\n      }\n    }, { maxAttempts: 4, onBackoff: (attempt, delayMs, err) => logBackoff(attempt, delayMs, err) });\n    const data = await res.json() as {\n      content?: Array<{ type?: string; text?: string; thinking?: string; id?: string; name?: string; input?: unknown }>;\n      usage?: { input_tokens?: number; output_tokens?: number };\n      stop_reason?: string;\n    };\n    const blocks = data.content ?? [];\n    const text = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');\n    const thinkingBlocks = blocks.filter((b) => b.type === 'thinking');\n    const reasoningText = thinkingBlocks.map((b) => b.thinking).filter(Boolean).join('\\n');\n    const toolUses = blocks.filter((b) => b.type === 'tool_use');\n    const toolCalls = toolUses.map((b: any) => ({ id: b.id, type: 'function' as const, function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));\n    const usage = data.usage ? { promptTokens: data.usage.input_tokens ?? 0, completionTokens: data.usage.output_tokens ?? 0, totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0) } : undefined;\n    return { content: text, reasoningContent: reasoningText || undefined, toolCalls: toolCalls.length ? toolCalls : undefined, finishReason: data.stop_reason, usage };\n  }\n\n  async function* streamChat(messages: ChatMessage[], tools: ToolDefinition[], options?: { reasoningEffort?: string }): AsyncGenerator<StreamChunk> {\n    const resp = await chat(messages, tools, options);\n    yield { content: resp.content, reasoningContent: resp.reasoningContent, toolCalls: resp.toolCalls, finishReason: resp.finishReason as StreamChunk['finishReason'], usage: resp.usage };\n  }\n\n  return { chat, streamChat };\n}"
  },
  "src/model/openai.ts": {
    "path": "src/model/openai.ts",
    "name": "openai.ts",
    "dir": "src/model",
    "lang": "typescript",
    "size": "17.6 KB",
    "lines": 378,
    "desc": "OpenAI provider adapter with JSON-RPC streaming and tool definitions",
    "code": "import type { ChatMessage, ModelResponse, StreamChunk, ToolDefinition } from '../types.js';\nimport { contentText } from '../types.js';\nimport { ProviderError, describeModelError, parseRetryAfter } from '../utils/http-error.js';\nimport { withRetries, classifyError } from './rate-limit.js';\nimport { nextKey, retireKey } from './credential-pool.js';\nimport { kvCache } from './kv-cache.js';\nimport { nativeAssembleStream } from '../native/agent-protocol.js';\n\nfunction logBackoff(attempt: number, delayMs: number, err: unknown): void {\n  const detail = err instanceof Error ? err.message.split('\\n')[0] : String(err);\n  console.warn(`[rate-limit] model request backoff #${attempt}: sleeping ${Math.round(delayMs)}ms (${detail.slice(0, 80)})`);\n}\n\nexport interface ProviderConfig {\n  baseUrl: string;\n  apiKey?: string;\n  model: string;\n  providerName?: string;\n}\n\nfunction toOpenAITools(tools: ToolDefinition[]) {\n  return tools.map((t, idx) => {\n    const fn: any = {\n      type: 'function' as const,\n      function: {\n        name: t.name,\n        description: t.description,\n        parameters: {\n          type: 'object',\n          properties: Object.fromEntries(t.parameters.map((p: ToolDefinition['parameters'][number]) => [p.name, { type: p.type, description: p.description }])),\n          required: t.parameters.filter((p: ToolDefinition['parameters'][number]) => p.required).map((p: ToolDefinition['parameters'][number]) => p.name),\n        },\n      },\n    };\n    if (idx === tools.length - 1) {\n      fn.cache_control = { type: 'ephemeral' };\n    }\n    return fn;\n  });\n}\n\n// The tool schema list is stable for a given tools array across an agent run.\n// Memoize the serialized payload so steady-state costs (JSON stringify + alloc)\n// aren't repeated on every streaming request.\nconst toolSchemaCache = new WeakMap<ToolDefinition[], ReturnType<typeof toOpenAITools>>();\n\nfunction openAITools(tools: ToolDefinition[]) {\n  let cached = toolSchemaCache.get(tools);\n  if (!cached) {\n    cached = toOpenAITools(tools);\n    toolSchemaCache.set(tools, cached);\n  }\n  return cached;\n}\n\nexport function createOpenAIProvider(config: ProviderConfig) {\n  const base = config.baseUrl.replace(/\\/$/, '');\n  const model = config.model;\n  // Current key for this provider instance. Start with the configured key,\n  // then rotate through the credential pool on 401/429 (Hermes insight).\n  let apiKey = config.apiKey ?? null;\n  if (!apiKey) {\n    const pooled = nextKey(config.providerName ?? 'unknown', config.apiKey);\n    apiKey = pooled.key;\n  }\n\n  /** Rotate to a fresh pool key; retire the failing one briefly. */\n  function rotateCredentials(err: unknown): void {\n    const status = (err as { status?: number }).status;\n    // Only 401/403 (bad key) justify retiring; 429 (rate) just needs a fresh\n    // key from a separate account/pool entry — retire that key too.\n    if (status === 401 || status === 403 || status === 429) {\n      retireKey(config.providerName ?? 'unknown', apiKey, status === 429 ? 20_000 : 120_000);\n      const rotated = nextKey(config.providerName ?? 'unknown', config.apiKey);\n      if (rotated.key) apiKey = rotated.key;\n    }\n  }\n\n  // MCH-71 (speed): cache-aware message serializer. The transcript is\n  // append-only across a run, so the mapped OpenAI payload for messages 0..N-1\n  // is identical every turn. Keep the last mapped array + the source messages\n  // it was derived from; on each request reuse the mapped prefix that matches\n  // by reference identity and only serialize the new tail. Saves a full\n  // O(messages) map + slice-scan per turn in long sessions.\n  let lastMapped: { src: ChatMessage[]; out: Record<string, unknown>[] } | null = null;\n\n  function mapMessages(messages: ChatMessage[]): Record<string, unknown>[] {\n    const out: Record<string, unknown>[] = [];\n    let reuseLen = 0;\n    if (lastMapped) {\n      const max = Math.min(lastMapped.src.length, messages.length - 1); // tail must be fresh (cache_control on last)\n      while (reuseLen < max && lastMapped.src[reuseLen] === messages[reuseLen]) reuseLen++;\n      if (reuseLen > 0) {\n        for (let i = 0; i < reuseLen; i++) out.push(lastMapped!.out[i]);\n      }\n    }\n    for (let i = reuseLen; i < messages.length; i++) {\n      const m = messages[i];\n      if (m.role === 'tool') {\n        out.push({ role: 'tool', tool_call_id: m.tool_call_id, content: contentText(m) });\n        continue;\n      }\n      if (m.role === 'assistant' && m.tool_calls) {\n        out.push({ role: 'assistant', content: contentText(m) || null, tool_calls: m.tool_calls });\n        continue;\n      }\n      // Some OpenAI-compatible models (observed: qwen3.6-35b on\n      // freeinference.org) silently return an EMPTY response\n      // (finish=stop, 0 completion tokens) when a `system` message appears\n      // AFTER the user turn. Mochi appends runtime context (preflight,\n      // focus nudges) as mid-conversation system messages, which reliably\n      // killed those requests. Send mid-conversation system notices as\n      // user-role text with explicit framing instead — same information,\n      // compatible shape.\n      const seenUserTurn = messages.slice(0, i).some((x) => x.role === 'user');\n      if (m.role === 'system' && seenUserTurn) {\n        out.push({ role: 'user', content: `[system notice] ${contentText(m)}` });\n        continue;\n      }\n      const mapped: { role: string; content: unknown; cache_control?: unknown } = { role: m.role, content: contentText(m) };\n      // MCH-109: multimodal user messages pass content parts through verbatim\n      // (OpenAI wire format: [{type:'text'},{type:'image_url'}]).\n      if (Array.isArray(m.content)) {\n        out.push({ role: m.role, content: m.content });\n        continue;\n      }\n      if (m.role === 'system') mapped.cache_control = { type: 'ephemeral' };\n      // MCH-38 (speed): mark the LAST message so every turn's prefix is a\n      // cache breakpoint — with an append-only transcript, turns N+1 reuse\n      // turns 1..N from the provider prompt cache at ~10% of input cost.\n      if (i === messages.length - 1) mapped.cache_control = { type: 'ephemeral' };\n      out.push(mapped);\n    }\n    lastMapped = { src: messages.slice(), out };\n    return out;\n  }\n\n  async function* streamChat(messages: ChatMessage[], tools: ToolDefinition[], options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal; reasoningEffort?: string }): AsyncGenerator<StreamChunk> {\n    const body: Record<string, unknown> = {\n      model,\n      messages: mapMessages(messages),\n      stream: true,\n      stream_options: { include_usage: true },\n      ...(tools.length ? { tools: openAITools(tools), tool_choice: 'auto' } : {}),\n      ...(options?.temperature !== undefined && !/^(o1|o3|o4|deepseek-reasoner|deepseek-r1|r1)/i.test(model) ? { temperature: options.temperature } : {}),\n      ...(options?.maxTokens !== undefined\n        ? (/^(o1|o3|o4)/i.test(model) ? { max_completion_tokens: options.maxTokens } : { max_tokens: options.maxTokens })\n        : {}),\n      ...(() => {\n        const isOpenAiNonReasoning = base.includes('api.openai.com') && !/^(o1|o3|o4|gpt-5)/i.test(model);\n        if (isOpenAiNonReasoning) return {};\n        const rawEffort = String(options?.reasoningEffort || process.env.MOCHI_REASONING || '').toLowerCase().trim();\n        if (rawEffort === 'off') {\n          // Provider-level minimal reasoning: omit reasoning_effort AND ask the\n          // endpoint to skip reasoning where supported (OpenRouter-style\n          // reasoning.exclude / reasoning: { enabled: false } tolerant shape).\n          return { reasoning_effort: 'low', reasoning: { enabled: false } };\n        }\n        if (rawEffort === 'auto') {\n          return {}; // model-default — send nothing\n        }\n        if (rawEffort === 'max' || rawEffort === 'extreme' || rawEffort === 'deep' || rawEffort === 'high' || rawEffort === 'hard') {\n          return { reasoning_effort: 'high' };\n        }\n        if (rawEffort === 'medium') {\n          return { reasoning_effort: 'medium' };\n        }\n        if (rawEffort === 'low' || rawEffort === 'easy') {\n          return { reasoning_effort: 'low' };\n        }\n        return {};\n      })(),\n    };\n\n    // A local AbortController, linked to the caller's signal, so BOTH the\n    // request and (later) the watchdog stall guard can tear down the in-flight\n    // stream. We reuse one signal so the caller's abort still works identically.\n    const signal = new AbortController();\n    const onAbort = () => signal.abort(options?.signal?.reason);\n    if (options?.signal) {\n      if (options.signal.aborted) signal.abort(options.signal.reason);\n      else options.signal.addEventListener('abort', onAbort, { once: true });\n    }\n\n    const headerTimeoutRaw = Number(process.env.MOCHI_MODEL_HEADERS_TIMEOUT_MS);\n    const headerTimeoutMs = Number.isFinite(headerTimeoutRaw) && headerTimeoutRaw > 0\n      ? Math.max(100, headerTimeoutRaw)\n      : 45_000;\n    const headerTimer = setTimeout(() => signal.abort(new Error(`Model response headers stalled for ${headerTimeoutMs}ms`)), headerTimeoutMs);\n\n    // Rate-limit + transient-failure safe fetch: only the request is retried\n    // (never mid-stream), with exponential backoff honoring Retry-After.\n    const res = await withRetries(async () => {\n      try {\n        const r = await fetch(`${base}/chat/completions`, {\n          method: 'POST',\n          headers: {\n            'Content-Type': 'application/json',\n            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),\n          },\n          body: JSON.stringify(body),\n          signal: signal.signal,\n        } as RequestInit);\n        if (!r.ok) {\n          const text = await r.text().catch(() => '');\n          throw describeModelError(r.status, text, model, 'opencode/OpenAI-compatible', parseRetryAfter(r.headers.get('retry-after')));\n        }\n        if (!r.body) throw new Error('No response body from model');\n        return r;\n      } catch (err) {\n        if (signal.signal.aborted) {\n          if (options?.signal?.aborted) throw options.signal.reason ?? err;\n          throw new ProviderError(err instanceof Error ? err.message : String(err), { retryable: false, cause: err });\n        }\n        // Network/transport errors carry no status; let the classifier decide\n        // whether this is transient (retry) or permanent (host refused / bad DNS).\n        if (err instanceof ProviderError) throw err;\n        throw new ProviderError(err instanceof Error ? err.message : String(err), { retryable: classifyError(err).retryable, cause: err });\n      }\n    }, {\n      maxAttempts: 4,\n      onBackoff: (attempt, delayMs, err) => logBackoff(attempt, delayMs, err),\n      // Rotate to a fresh pool key (401/403/429) before the next attempt.\n      onRetryable: (_attempt, err) => rotateCredentials(err),\n    }).catch((err: unknown) => {\n      options?.signal?.removeEventListener('abort', onAbort);\n      throw err;\n    }).finally(() => clearTimeout(headerTimer));\n\n    if (!res.body) throw new ProviderError('No response body from model', { retryable: true });\n    const reader = res.body.getReader();\n    const decoder = new TextDecoder();\n    let buffer = '';\n    let totalInput = 0;\n    let totalOutput = 0;\n\n    // Watchdog stall guard: ONE reusable timer (not a fresh Promise + setTimeout\n    // per .read()). The stream is read bare-fast with zero per-read allocation,\n    // and the timer aborts the request only when the stream has been silent for\n    // STALL_TIMEOUT_MS. This measurably raises token throughput on chatty\n    // providers vs. a Promise.race around every chunk.\n    const STALL_TIMEOUT_MS = 30_000;\n    let lastChunkAt = Date.now();\n    let stalled = false;\n    const stallInterval = setInterval(() => {\n      if (!stalled && Date.now() - lastChunkAt >= STALL_TIMEOUT_MS) {\n        stalled = true;\n        signal.abort(); // tear down the still-open stream now, not after read\n      }\n    }, 2000);\n\n    try {\n      while (true) {\n        const { done, value } = await reader.read();\n        if (done) break;\n        lastChunkAt = Date.now();\n        buffer += decoder.decode(value, { stream: true });\n      const lines = buffer.split('\\n');\n      buffer = lines.pop() ?? '';\n      for (const line of lines) {\n        const trimmed = line.trim();\n        if (!trimmed.startsWith('data:')) continue;\n        const data = trimmed.slice(5).trim();\n        if (data === '[DONE]') return;\n        if (!data) continue;\n        try {\n          const chunk = JSON.parse(data);\n          const choice = chunk.choices?.[0];\n          const delta = choice?.delta ?? {};\n          const toolCalls = delta.tool_calls;\n          const reasoningContent = delta.reasoning_content ?? delta.reasoning ?? delta.thought ?? undefined;\n          const parsedCalls: StreamChunk['toolCalls'] = [];\n          if (toolCalls && Array.isArray(toolCalls)) {\n            for (const tc of toolCalls) {\n              parsedCalls.push({\n                id: tc.id ?? `call_${Date.now()}`,\n                index: typeof tc.index === 'number' ? tc.index : undefined,\n                type: 'function',\n                function: {\n                  name: tc.function?.name ?? '',\n\n// ... [File continues on GitHub repository] ..."
  },
  "src/tools/edit.ts": {
    "path": "src/tools/edit.ts",
    "name": "edit.ts",
    "dir": "src/tools",
    "lang": "typescript",
    "size": "7.0 KB",
    "lines": 167,
    "desc": "AST surgical diff engine with whitespace-tolerant anchor matching",
    "code": "import { existsSync, readFileSync, writeFileSync } from 'node:fs';\nimport { resolve } from 'node:path';\nimport { homedir } from 'node:os';\nimport type { Tool } from './types.js';\nimport { markMutation } from './fs-signal.js';\nimport { fuzzyFindUniqueNative as fuzzyFindUnique } from './native-match.js';\nimport { validateFileSyntax } from '../core/ast-guard.js';\n\nfunction trimIndent(text: string): string {\n  const lines = text.split('\\n');\n  if (lines[0]?.trim() === '') lines.shift();\n  if (lines[lines.length - 1]?.trim() === '') lines.pop();\n  const indent = lines.reduce((min, line) => {\n    const m = line.match(/^(\\s*)/);\n    if (line.trim() === '') return min;\n    return Math.min(min, m ? m[1].length : 0);\n  }, Infinity);\n  if (indent === Infinity || indent === 0) return text;\n  return lines.map((l) => l.slice(indent)).join('\\n');\n}\n\n/**\n * Strips line numbers like '   1 | ', '1 | ', '12: ', '  12: ' that models\n * frequently copy directly from the `read` tool output into oldText/newText.\n */\nexport function stripLineNumberGutter(text: string): string {\n  const lines = text.split('\\n');\n  const nonEmpty = lines.filter((l) => l.trim().length > 0);\n  if (nonEmpty.length === 0) return text;\n  const isNumbered = nonEmpty.every((l) => /^\\s*\\d+\\s*[|:]\\s?/.test(l));\n  if (!isNumbered) return text;\n  return lines.map((l) => l.replace(/^\\s*\\d+\\s*[|:]\\s?/, '')).join('\\n');\n}\n\nexport function normalizeRelaxedLine(line: string): string {\n  return line\n    .trim()\n    .replace(/[\"'`]/g, '\"')\n    .replace(/;+$/, '')\n    .replace(/\\s+/g, ' ');\n}\n\nexport function findRelaxedUnique(text: string, needle: string): { start: number; end: number } | null {\n  if (needle.trim() === '') return null;\n  const textLines = text.split('\\n');\n  const needleLines = needle.replace(/\\r\\n/g, '\\n').split('\\n');\n  while (needleLines.length && needleLines[0].trim() === '') needleLines.shift();\n  while (needleLines.length && needleLines[needleLines.length - 1].trim() === '') needleLines.pop();\n  if (needleLines.length === 0) return null;\n\n  const normNeedle = needleLines.map(normalizeRelaxedLine);\n  const normText = textLines.map(normalizeRelaxedLine);\n\n  const matches: { start: number; end: number }[] = [];\n  for (let i = 0; i + normNeedle.length <= normText.length; i++) {\n    let ok = true;\n    for (let j = 0; j < normNeedle.length; j++) {\n      if (normText[i + j] !== normNeedle[j]) {\n        ok = false;\n        break;\n      }\n    }\n    if (!ok) continue;\n    let start = 0;\n    for (let k = 0; k < i; k++) start += textLines[k].length + 1;\n    let end = start;\n    for (let k = i; k < i + normNeedle.length; k++) end += textLines[k].length + 1;\n    matches.push({ start, end: Math.max(start, end - 1) });\n  }\n\n  if (matches.length === 1) return matches[0];\n  return null;\n}\n\nexport const editTool: Tool = {\n  def: {\n    name: 'edit',\n    description: 'Replace an exact block of text in a file with new text. Prefer small, targeted patches.',\n    parameters: [\n      { name: 'path', type: 'string', description: 'Relative or absolute file path', required: true },\n      { name: 'oldText', type: 'string', description: 'Exact text to replace', required: true },\n      { name: 'newText', type: 'string', description: 'Replacement text', required: true },\n      { name: 'trim', type: 'boolean', description: 'Trim leading/trailing blank lines and common indent from newText', required: false },\n    ],\n    permission: 'write',\n  },\n  async execute(args, ctx) {\n    const rawPath = String(args.path ?? '');\n    let oldText = String(args.oldText ?? '');\n    let newText = String(args.newText ?? '');\n    if (args.trim) newText = trimIndent(newText);\n    const fullPath = rawPath === '~' ? homedir() : rawPath.startsWith('~/') ? resolve(homedir(), rawPath.slice(2)) : resolve(ctx.cwd, rawPath);\n    if (!existsSync(fullPath)) throw new Error(`File not found: ${rawPath}`);\n    let content = readFileSync(fullPath, 'utf8');\n    const original = content;\n    let usedFuzzy = false;\n\n    // Auto-strip line numbers copied from `read` tool gutters (e.g. \"   1 | \")\n    const strippedOld = stripLineNumberGutter(oldText);\n    if (strippedOld !== oldText) {\n      if (content.includes(strippedOld) || fuzzyFindUnique(content, strippedOld)) {\n        oldText = strippedOld;\n        newText = stripLineNumberGutter(newText);\n      }\n    }\n\n    if (!content.includes(oldText)) {\n      // Try without trailing newline differences\n      oldText = oldText.replace(/\\r\\n/g, '\\n');\n      if (!content.includes(oldText)) {\n        // Try stripping line numbers again if only partly stripped\n        const unnumbered = stripLineNumberGutter(oldText);\n        if (content.includes(unnumbered)) {\n          oldText = unnumbered;\n          newText = stripLineNumberGutter(newText);\n        } else {\n          // Fuzzy fallback: match after whitespace normalization (indentation,\n          // tabs-vs-spaces, trailing whitespace). Unique match only; ambiguity\n          // stays an error so we never edit the wrong occurrence silently.\n          let m = fuzzyFindUnique(content, oldText);\n          if (!m && unnumbered !== oldText) {\n            m = fuzzyFindUnique(content, unnumbered);\n            if (m) newText = stripLineNumberGutter(newText);\n          }\n          if (!m) {\n            // Relaxed quote and trailing semicolon matching fallback\n            m = findRelaxedUnique(content, oldText);\n            if (!m && unnumbered !== oldText) {\n              m = findRelaxedUnique(content, unnumbered);\n              if (m) newText = stripLineNumberGutter(newText);\n            }\n          }\n          if (!m) throw new Error(`oldText not found in ${rawPath} (exact and fuzzy match failed)`);\n          content = content.slice(0, m.start) + newText + content.slice(m.end);\n          usedFuzzy = true;\n        }\n      }\n    }\n    if (!usedFuzzy) {\n      // Ambiguity guard on the exact path too: \"replace first occurrence\"\n      // silently edits a location the model may not have meant. Require a\n      // unique target; tell the model to include more surrounding context.\n      const count = content.split(oldText).length - 1;\n      if (count > 1) {\n        const lines: number[] = [];\n        let idx = 0;\n        while ((idx = content.indexOf(oldText, idx)) !== -1) {\n          const lineNum = content.slice(0, idx).split('\\n').length;\n          lines.push(lineNum);\n          idx += oldText.length;\n        }\n        throw new Error(`oldText matches ${count} locations in ${rawPath} (at lines ${lines.join(', ')}); include more surrounding context so it is unique`);\n      }\n      content = content.replace(oldText, newText);\n    }\n    if (content === original) throw new Error(`oldText was found but replacement did not change ${rawPath}`);\n    writeFileSync(fullPath, content);\n    ctx.events.emit({ type: 'file:changed', path: fullPath, operation: 'edit', agentId: ctx.agentId });\n    markMutation();\n    const diag = validateFileSyntax(fullPath, content);\n    let out = usedFuzzy ? `Edited ${rawPath} (fuzzy match: whitespace/quote differences were tolerated)` : `Edited ${rawPath}`;\n    if (!diag.valid && diag.summary) {\n      out += `\\n⚠️ [AST Syntax Alert]: ${diag.summary}`;\n    }\n    return out;\n  },\n};\n"
  },
  "src/tools/patch.ts": {
    "path": "src/tools/patch.ts",
    "name": "patch.ts",
    "dir": "src/tools",
    "lang": "typescript",
    "size": "8.4 KB",
    "lines": 183,
    "desc": "Unified patch applicator with chunk rollback and integrity checks",
    "code": "import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';\nimport { dirname, resolve } from 'node:path';\nimport type { Tool } from './types.js';\nimport { markMutation } from './fs-signal.js';\nimport { fuzzyFindUniqueNative as fuzzyFindUnique } from './native-match.js';\nimport { validateFileSyntax } from '../core/ast-guard.js';\n\n// Codex-style patch application. The model emits a compact, token-efficient\n// patch format instead of full-file rewrites or fragile exact-match blocks:\n//\n//   *** Begin Patch\n//   *** Add File: path/new.ts\n//   +export const x = 1;\n//   *** Update File: src/app.ts\n//   @@ optional class def anchor\n//    context line\n//   -removed line\n//   +added line\n//   *** Delete File: old.ts\n//   *** End Patch\n//\n// Update hunks apply via context matching: each hunk's surrounding context\n// lines locate the region (exact first, then whitespace-normalized fuzzy),\n// then the -/+ lines are applied relative to that location. This is the same\n// reliability story as git apply with a lenient matcher: small whitespace\n// drift in remembered context does not fail the patch.\n\ninterface HunkLine {\n  kind: 'ctx' | 'del' | 'add';\n  text: string;\n}\n\ninterface FilePatch {\n  op: 'add' | 'update' | 'delete';\n  path: string;\n  anchor?: string; // text after @@ (optional, informational + search hint)\n  lines: HunkLine[];\n}\n\nexport function parsePatch(patch: string): FilePatch[] {\n  const raw = patch.replace(/\\r\\n/g, '\\n').split('\\n');\n  let i = 0;\n  // Skip leading lines before Begin Patch (prose like \"Here is the patch:\").\n  const hasBegin = raw.some((l) => l.trim() === '*** Begin Patch');\n  if (hasBegin) {\n    while (i < raw.length && raw[i].trim() !== '*** Begin Patch') i++;\n    i++;\n  } else {\n    while (i < raw.length && !raw[i].startsWith('*** ')) i++;\n    if (i === raw.length) throw new Error('Patch is missing \"*** Begin Patch\" or valid patch directives');\n  }\n\n  const patches: FilePatch[] = [];\n  let cur: FilePatch | null = null;\n  for (; i < raw.length; i++) {\n    const line = raw[i];\n    if (line.startsWith('*** End Patch')) break;\n    if (line.startsWith('*** Add File: ')) {\n      cur = { op: 'add', path: line.slice('*** Add File: '.length).trim(), lines: [] };\n      patches.push(cur);\n    } else if (line.startsWith('*** Update File: ')) {\n      cur = { op: 'update', path: line.slice('*** Update File: '.length).trim(), lines: [] };\n      patches.push(cur);\n    } else if (line.startsWith('*** Delete File: ')) {\n      cur = { op: 'delete', path: line.slice('*** Delete File: '.length).trim(), lines: [] };\n      patches.push(cur);\n    } else if (line.startsWith('*** ')) {\n      throw new Error(`Unknown patch directive: ${line}`);\n    } else if (line.startsWith('@@') && cur && cur.op === 'update') {\n      cur.anchor = line.slice(2).trim();\n    } else if (cur) {\n      if (line.startsWith('+')) cur.lines.push({ kind: 'add', text: line.slice(1) });\n      else if (line.startsWith('-')) cur.lines.push({ kind: 'del', text: line.slice(1) });\n      else if (line.startsWith(' ')) cur.lines.push({ kind: 'ctx', text: line.slice(1) });\n      else if (line.trim() === '') cur.lines.push({ kind: 'ctx', text: '' });\n      else throw new Error(`Malformed patch line (expected +, -, space, or ***): ${line}`);\n    }\n    // Lines before any file directive are ignored.\n  }\n\n  if (patches.length === 0) throw new Error('Patch contains no file sections');\n  return patches;\n}\n\n/** Apply one update hunk to file lines. Returns the new full line array. */\nfunction applyHunk(fileLines: string[], hunk: HunkLine[]): string[] {\n  // Build the search block from the hunk's context + deleted lines.\n  const searchLines = hunk.filter((l) => l.kind !== 'add').map((l) => l.text);\n  if (searchLines.length === 0) {\n    // Pure insertion with no context: append at end.\n    return [...fileLines, ...hunk.filter((l) => l.kind === 'add').map((l) => l.text)];\n  }\n  const search = searchLines.join('\\n');\n  const text = fileLines.join('\\n');\n  const exact = text.includes(search) ? { start: text.indexOf(search), end: text.indexOf(search) + search.length } : fuzzyFindUnique(text, search);\n  if (!exact) throw new Error(`Could not locate patch context in file. Context: ${search.slice(0, 120)}`);\n  const startLine = text.slice(0, exact.start).split('\\n').length - 1;\n  const endLine = text.slice(0, exact.end).split('\\n').length - 1;\n\n  const out: string[] = [];\n  for (let i = 0; i < startLine; i++) out.push(fileLines[i]);\n  for (const l of hunk) {\n    if (l.kind === 'add') out.push(l.text);\n    // del + ctx lines from the hunk replace the located region; ctx lines are\n    // re-emitted from the hunk so any whitespace normalization is applied.\n  }\n  for (let i = endLine + 1; i < fileLines.length; i++) out.push(fileLines[i]);\n  return out;\n}\n\nexport function applyFilePatch(source: string, fp: FilePatch): string {\n  const lines = source.split('\\n');\n  let result = lines;\n  // Group consecutive non-add runs into hunks at pure-add boundaries... simpler:\n  // apply the whole section as a single hunk when it contains ctx/del lines,\n  // otherwise it is an append-style insertion.\n  const hasCtxOrDel = fp.lines.some((l) => l.kind !== 'add');\n  if (hasCtxOrDel) {\n    result = applyHunk(lines, fp.lines);\n  } else {\n    // Pure additions: insert before the final empty line (EOF newline) if present.\n    const adds = fp.lines.map((l) => l.text);\n    if (result.length && result[result.length - 1] === '') result.splice(result.length - 1, 0, ...adds);\n    else result = [...result, ...adds];\n  }\n  return result.join('\\n');\n}\n\nexport const patchTool: Tool = {\n  def: {\n    name: 'patch',\n    description:\n      'Apply a Codex-style patch to multiple files in one call. Format: \"*** Begin Patch\", then sections \"*** Add File: <path>\" (lines prefixed +), \"*** Update File: <path>\" (context lines start with a space, removals with -, additions with +, optional @@ anchor), \"*** Delete File: <path>\", ending with \"*** End Patch\". Updates match context exactly first, then tolerantly (whitespace-insensitive), so minor indentation drift still applies.',\n    parameters: [\n      { name: 'patch', type: 'string', description: 'The full patch text between *** Begin Patch and *** End Patch', required: true },\n    ],\n    permission: 'write',\n  },\n  async execute(args, ctx) {\n    const patchText = String(args.patch ?? '');\n    const patches = parsePatch(patchText);\n    const results: string[] = [];\n\n    for (const fp of patches) {\n      const fullPath = resolve(ctx.cwd, fp.path);\n      if (fp.op === 'add') {\n        if (existsSync(fullPath)) throw new Error(`*** Add File: ${fp.path} already exists`);\n        mkdirSync(dirname(fullPath), { recursive: true });\n        const content = fp.lines.filter((l) => l.kind === 'add').map((l) => l.text).join('\\n');\n        const finalContent = content.endsWith('\\n') || content === '' ? content : content + '\\n';\n        writeFileSync(fullPath, finalContent);\n        ctx.events.emit({ type: 'file:changed', path: fullPath, operation: 'write', agentId: ctx.agentId });\n        const diag = validateFileSyntax(fullPath, finalContent);\n        if (!diag.valid && diag.summary) {\n          results.push(`added ${fp.path} (${fp.lines.length} lines) ⚠️ [AST Syntax Alert]: ${diag.summary}`);\n        } else {\n          results.push(`added ${fp.path} (${fp.lines.length} lines)`);\n        }\n      } else if (fp.op === 'delete') {\n        if (!existsSync(fullPath)) throw new Error(`*** Delete File: ${fp.path} not found`);\n        rmSync(fullPath);\n        ctx.events.emit({ type: 'file:changed', path: fullPath, operation: 'delete', agentId: ctx.agentId });\n        results.push(`deleted ${fp.path}`);\n      } else {\n        if (!existsSync(fullPath)) throw new Error(`*** Update File: ${fp.path} not found`);\n        const before = readFileSync(fullPath, 'utf8');\n        const after = applyFilePatch(before, fp);\n        if (after === before) throw new Error(`Patch produced no change to ${fp.path}`);\n        writeFileSync(fullPath, after);\n        ctx.events.emit({ type: 'file:changed', path: fullPath, operation: 'edit', agentId: ctx.agentId });\n        const diag = validateFileSyntax(fullPath, after);\n        if (!diag.valid && diag.summary) {\n          results.push(`updated ${fp.path} ⚠️ [AST Syntax Alert]: ${diag.summary}`);\n        } else {\n          results.push(`updated ${fp.path}`);\n        }\n      }\n      markMutation();\n    }\n\n    return `Applied patch to ${patches.length} file(s):\\n` + results.map((r) => `- ${r}`).join('\\n');\n  },\n};\n"
  },
  "src/tools/ast-slice.ts": {
    "path": "src/tools/ast-slice.ts",
    "name": "ast-slice.ts",
    "dir": "src/tools",
    "lang": "typescript",
    "size": "2.0 KB",
    "lines": 66,
    "desc": "Tree-sitter AST symbol and function definition extractor",
    "code": `import type { Tool } from './types.js';
import { generateASTSlice } from '../core/ast-slicer.js';
import { resolve, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';

export const astSliceTool: Tool = {
  def: {
    name: 'ast_slice',
    description:
      'Extracts a targeted JIT AST slice (function/class implementation, sibling type signatures, and immediate caller call-sites) without loading the full file. Saves 75-95% context tokens while preserving high reasoning fidelity.',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to the source code file',
        required: true,
      },
      {
        name: 'symbol',
        type: 'string',
        description: 'Name of the function, class, interface, method, or type to slice',
        required: true,
      },
      {
        name: 'includeCallSites',
        type: 'boolean',
        description: 'Whether to include cross-file caller call sites (default true)',
        required: false,
      },
      {
        name: 'includeSiblingTypes',
        type: 'boolean',
        description: 'Whether to include sibling type definitions (default true)',
        required: false,
      },
    ],
    permission: 'read',
  },
  async execute(args, ctx) {
    const rawPath = String(args.path ?? '').trim();
    const symbol = String(args.symbol ?? '').trim();

    if (!rawPath || !symbol) {
      return 'Error: Both "path" and "symbol" parameters are required for ast_slice.';
    }

    const filePath = isAbsolute(rawPath) ? rawPath : resolve(ctx.cwd, rawPath);
    if (!existsSync(filePath)) {
      return \`Error: File not found at "\${rawPath}".\`;
    }

    const slice = await generateASTSlice({
      cwd: ctx.cwd,
      filePath,
      symbolName: symbol,
      includeSiblingTypes: args.includeSiblingTypes !== false,
      maxCallSites: args.includeCallSites === false ? 0 : 5,
    });

    if (!slice) {
      return \`Error: Could not extract AST slice for "\${symbol}" from "\${rawPath}".\`;
    }

    return slice.formattedSlice;
  },
};
`
  },
  "src/tools/shell.ts": {
    "path": "src/tools/shell.ts",
    "name": "shell.ts",
    "dir": "src/tools",
    "lang": "typescript",
    "size": "8.1 KB",
    "lines": 169,
    "desc": "Bubblewrap-isolated command runner with timeout and exit guards",
    "code": "import type { Tool } from './types.js';\nimport { classifyCommand } from '../security/security.js';\n\n// Accumulation guard only (memory safety against firehose output). The final\n// RESULT the model sees is clipped to the shared tool-result budget by\n// clipToolOutput — keeping the accumulation cap higher means the clip's tail\n// is the true end of output (test summaries, git hints), not a mid-stream cut,\n// and the child never dies of EPIPE on long-but-bounded output.\nconst MAX_OUTPUT = 2_000_000;\n\n// Desktop GUI applications that must never be launched by a coding agent.\n// Opening a window (gnome-calculator, kcalc, browsers, terminals, editors)\n// never delivers source code and visibly \"spams\" when a model loops on it.\nconst GUI_LAUNCHERS = [\n  /\\bgnome-calculator\\b/i, /\\bkcalc\\b/i, /\\bxcalc\\b/i, /\\bgnome-calculator-gtk3\\b/i,\n  /\\bgnome-terminal\\b/i, /\\bkonsole\\b/i, /\\bgitk\\b/i, /\\bgedit\\b/i,\n  /\\bgnome-text-editor\\b/i, /\\bnautilus\\b/i, /\\bfirefox\\b/i, /\\bchromium\\b/i,\n  /\\bgoogle-chrome\\b/i,\n];\n\n/** Returns a human-readable reason when `command` launches a desktop GUI app,\n *  or null if it's a normal headless command the agent may run. */\nexport function desktopGuiReason(command: string): string | null {\n  const c = command.trim();\n  if (!c) return null;\n  for (const re of GUI_LAUNCHERS) {\n    const m = re.exec(c);\n    if (m) return m[0].trim();\n  }\n  return null;\n}\n\nimport { clipToolOutput } from './output-budget.js';\n\nexport const shellTool: Tool = {\n  def: {\n    name: 'shell',\n    description: 'Run a shell command. Returns stdout, stderr, and exit code. Output is truncated if too long.',\n    parameters: [\n      { name: 'command', type: 'string', description: 'Shell command', required: true },\n      { name: 'cwd', type: 'string', description: 'Working directory (defaults to current)', required: false },\n      { name: 'timeout', type: 'integer', description: 'Timeout in seconds', required: false },\n      { name: 'description', type: 'string', description: 'Short description of what this command does', required: false },\n      { name: 'background', type: 'boolean', description: 'Run in the background: returns a task id immediately; check with command \"bg status <id>\"', required: false },\n      { name: 'sandbox', type: 'boolean', description: 'Run inside a bubblewrap sandbox (read-only root, writable cwd/tmp/caches). Default follows safety.sandbox config.', required: false },\n    ],\n    permission: 'shell',\n    dangerous: true,\n  },\n  async execute(args, ctx) {\n    let command = String(args.command ?? '');\n    if (!command) throw new Error('No command provided');\n\n    // Background task management surface: `bg status <id>` / `bg list` / `bg kill <id>` / `bg logs <id>`.\n    if (command === 'bg list' || command.startsWith('bg status') || command.startsWith('bg kill') || command.startsWith('bg logs')) {\n      const { listTasks, getTask, describeTask, killTask } = await import('../daemon/background-tasks.js');\n      if (command.startsWith('bg kill')) {\n        const id = command.split(/\\s+/)[2];\n        if (!id) return 'Usage: bg kill <task-id>';\n        const ok = killTask(id);\n        return ok ? `Killed background task ${id}.` : `Could not kill background task ${id} (not running or not found).`;\n      }\n      if (command.startsWith('bg logs')) {\n        const id = command.split(/\\s+/)[2];\n        if (!id) return 'Usage: bg logs <task-id>';\n        const t = getTask(id);\n        if (!t) return `No background task ${id}. Use 'bg list'.`;\n        return `[bg:${t.id} logs (${t.status})]:\\n${t.output || '(no output yet)'}`;\n      }\n      const id = command.startsWith('bg status') ? command.split(/\\s+/)[2] : undefined;\n      if (id) {\n        const t = getTask(id);\n        return t ? describeTask(t) : `No background task ${id}. Use 'bg list'.`;\n      }\n      const all = listTasks();\n      return all.length === 0 ? 'No background tasks.' : all.map((t) => describeTask(t, 400)).join('\\n---\\n');\n    }\n\n    // Never spawn a desktop GUI app: it opens a window, delivers no source\n    // code, and when a model loops on a \"make/build X\" request it visibly\n    // spams the screen. Redirect the agent to write code instead.\n    const gui = desktopGuiReason(command);\n    if (gui && ctx.config.safety?.mode === 'safe') {\n      throw new Error(\n        `Refused to launch desktop GUI app \"${gui}\". You are a coding agent: when asked to BUILD/IMPLEMENT/CODE something, deliver it as source files (write/edit), then verify headlessly (unit test, CLI invocation, or script) and report the result. Do NOT open a GUI window. Current working directory: ${ctx.cwd ?? ''}`\n      );\n    }\n\n    if (args.background === true) {\n      const { startBackgroundTask, describeTask } = await import('../daemon/background-tasks.js');\n      const t = startBackgroundTask(command, ctx.cwd, {\n        description: typeof args.description === 'string' ? args.description : undefined,\n      });\n      return `${describeTask(t)}\\nStarted in background. Continue working; check later with: bg status ${t.id}`;\n    }\n\n    // Horus-derived command risk gate: in safe mode, destructive or network-\n    // touching commands are blocked outright; in auto/ask they run but the\n    // classification is visible (agents shouldn't silently rm -rf or push).\n    const risk = classifyCommand(command);\n    if (ctx.config.safety.mode === 'safe' && risk !== 'low') {\n      throw new Error(`Blocked by safety: command classified as ${risk} (safe mode). Command: ${command.slice(0, 200)}`);\n    }\n    if (risk !== 'low' && ctx.events) {\n      ctx.events.emit({ type: 'agent:log', agentId: ctx.agentId, message: `[shell:${risk}] ${command.slice(0, 160)}` });\n    }\n\n    let targetCwd = args.cwd ? String(args.cwd) : ctx.cwd;\n    if (targetCwd.startsWith('~/')) {\n      const { homedir } = await import('node:os');\n      targetCwd = targetCwd.replace(/^~\\//, homedir() + '/');\n    } else if (targetCwd === '~') {\n      const { homedir } = await import('node:os');\n      targetCwd = homedir();\n    }\n    const timeoutMs = ((args.timeout ? Number(args.timeout) : ctx.config.safety.commandTimeoutSeconds) ?? 120) * 1000;\n\n    const env: NodeJS.ProcessEnv = { ...process.env };\n    env.AI_AGENT = 'mochi';\n    env.MOCHI_AGENT = 'true';\n    env.MOCHI_CWD = ctx.cwd;\n    if (ctx.workspace) {\n      env.MOCHI_WORKSPACE = ctx.workspace.dir;\n      env.MOCHI_AGENT_ID = ctx.agentId;\n    }\n    // Ensure administrative system paths (/usr/sbin, /sbin, /usr/local/sbin) are in PATH\n    const currentPath = env.PATH || '';\n    const adminPaths = ['/usr/local/sbin', '/usr/sbin', '/sbin'];\n    const missingPaths = adminPaths.filter((p) => !currentPath.includes(p));\n    if (missingPaths.length > 0) {\n      env.PATH = `${currentPath}:${missingPaths.join(':')}`;\n    }\n\n    // Central execution policy (timeout → SIGTERM → SIGKILL, output caps,\n    // abort handling) via exec.ts. The exit_code/stdout/stderr envelope below\n    // is byte-identical to the old inline spawner.\n    const { runShellString } = await import('../exec.js');\n    // Sandbox: per-call flag wins, else the safety.sandbox config. `true`\n    // means \"sandbox if possible\" (auto); omitting means config default.\n    const cfgSandbox = ctx.config.safety.sandbox ?? 'off';\n    const sandboxMode = args.sandbox === true ? 'auto' : args.sandbox === false ? 'off' : cfgSandbox;\n    let r: { stdout: string; stderr: string; code: number | null; timedOut: boolean; cancelled: boolean };\n    try {\n      r = await runShellString(command, {\n        cwd: targetCwd,\n        env,\n        timeoutMs,\n        maxOutput: MAX_OUTPUT,\n        signal: ctx.abortSignal,\n        sandbox: { mode: sandboxMode },\n        onAudit: (info) => {\n          if (risk !== 'low' && ctx.events) {\n            ctx.events.emit({ type: 'agent:log', agentId: ctx.agentId, message: `[shell:${risk}] ${command.slice(0, 160)} (${info.durationMs}ms)` });\n          }\n        },\n      });\n    } catch (err) {\n      throw err;\n    }\n    const out = clipToolOutput([\n      `exit_code: ${r.code ?? 1}`,\n      `stdout:\\n${r.stdout || '(empty)'}`,\n      `stderr:\\n${r.stderr || '(empty)'}`,\n    ].join('\\n'));\n    if (r.timedOut) return out + `\\n[command timed out after ${timeoutMs / 1000}s]`;\n    if (r.cancelled) return out + '\\n[command was cancelled]';\n    return out;\n  },\n};\n"
  },
  "src/tools/browser.ts": {
    "path": "src/tools/browser.ts",
    "name": "browser.ts",
    "dir": "src/tools",
    "lang": "typescript",
    "size": "7.2 KB",
    "lines": 146,
    "desc": "Headless browser automation tool with Playwright integration",
    "code": "import { spawn } from 'node:child_process';\nimport { resolve, dirname } from 'node:path';\nimport { fileURLToPath } from 'node:url';\nimport type { Tool } from './types.js';\n\n// Cline-grade browser automation for Mochi WITHOUT a runtime dependency.\n//\n// Mochi is a Bun-compiled binary with zero runtime deps, so it can't bundle\n// playwright/puppeteer. This tool shells out to `scripts/browser-driver.mjs`\n// (a plain-node script that loads the GLOBALLY-installed playwright), enforcing\n// a bounded SIGTERM→SIGKILL timeout per the freeze-class sentinel (every spawn\n// that waits on output needs a kill timer — shell.ts is the reference).\n//\n// Commands map 1:1 to the driver's subcommands; `url` can be given as the\n// first positional (navigate) or via `url:` for extract/act calls so a single\n// invocation does \"open X, then click/type/read\".\n\nconst HERE = resolve(dirname(fileURLToPath(import.meta.url)));\nexport const DRIVER = resolve(HERE, '../../scripts/browser-driver.mjs');\nconst DEFAULT_TIMEOUT_MS = 45_000;\n\nfunction runDriver(args: string[], timeoutMs: number): Promise<string> {\n  return new Promise((resolvePromise) => {\n    const child = spawn(process.execPath, [DRIVER, ...args], {\n      stdio: ['ignore', 'pipe', 'pipe'],\n    });\n    let out = '';\n    let err = '';\n    let done = false;\n    const finish = (code: number | null) => {\n      if (done) return;\n      done = true;\n      clearTimeout(timer);\n      resolvePromise(\n        out.trim() ||\n        (code !== 0 ? `[browser exit ${code}] ${err.trim().slice(0, 500)}` : ''),\n      );\n    };\n    const timer = setTimeout(() => {\n      if (done) return;\n      try { child.kill('SIGTERM'); } catch { /* ignore */ }\n      setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* ignore */ } }, 3000);\n    }, timeoutMs);\n    child.stdout.on('data', (d) => { out += d; if (out.length > 60_000) out = out.slice(-60_000); });\n    child.stderr.on('data', (d) => { err += d; });\n    child.on('error', () => finish(1));\n    child.on('close', (code) => finish(code));\n  });\n}\n\nexport const browserTool: Tool = {\n  def: {\n    name: 'browser',\n    description:\n      'Drive a real headless browser (navigate, read text/DOM/links, click, type/fill, eval JS, screenshot). ' +\n      'For testing web apps, dynamic pages, and UI verification. ' +\n      'Commands: navigate <url> | click <css> | type <css> <text> | fill <css> <text> | ' +\n      'text [css] | links [css] | html [css] | inputs [css] | eval <js> | screenshot <path>. ' +\n      'Prefix `url:` to open a page and act in one call.',\n    parameters: [\n      { name: 'command', type: 'string', description: 'Action: navigate|get|click|type|fill|text|links|html|inputs|eval|screenshot|snap', required: true },\n      { name: 'selector', type: 'string', description: 'CSS selector for click/type/fill/text/links/html/inputs', required: false },\n      { name: 'text', type: 'string', description: 'Text to type/fill (for type/fill)', required: false },\n      { name: 'url', type: 'string', description: 'URL to navigate to (for navigate/get, or prefix before acting)', required: false },\n      { name: 'path', type: 'string', description: 'Output path for screenshot', required: false },\n      { name: 'js', type: 'string', description: 'JavaScript to eval (returns JSON result)', required: false },\n      { name: 'waitMs', type: 'integer', description: 'Milliseconds to wait after navigating/clicking before returning', required: false },\n      { name: 'timeoutMs', type: 'integer', description: 'Navigation timeout ms (default 30000)', required: false },\n    ],\n    permission: 'network',\n  },\n  async execute(args, ctx) {\n    const command = String(args.command ?? '');\n    if (!command) return 'browser: command required (navigate, click, type, fill, text, links, html, inputs, eval, screenshot)';\n    const url = args.url ? String(args.url) : undefined;\n    const sel = args.selector ? String(args.selector) : undefined;\n    const text = args.text !== undefined ? String(args.text) : undefined;\n    const js = args.js !== undefined ? String(args.js) : undefined;\n    const pathArg = args.path ? String(args.path) : undefined;\n    const waitMs = Number(args.waitMs ?? 0) || 0;\n\n    const driverArgs: string[] = [];\n    const timeoutMs = Number(args.timeoutMs ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;\n\n    // Build the driver argv: `cmd positionals... --flags`.\n    if (command === 'navigate' || command === 'get') {\n      driverArgs.push(command, url ?? '');\n    } else if (command === 'screenshot') {\n      driverArgs.push('screenshot', pathArg ?? '');\n    } else if (command === 'eval') {\n      driverArgs.push('eval', js ?? '');\n    } else {\n      // selector-based commands (click/type/fill/text/links/html/inputs/snap)\n      if (command === 'type' || command === 'fill') {\n        driverArgs.push(command, sel ?? '', text ?? '');\n      } else {\n        driverArgs.push(command, sel ?? '');\n      }\n    }\n    if (url && command !== 'navigate' && command !== 'get') driverArgs.push('--url', url);\n    if (waitMs > 0) driverArgs.push('--wait', String(waitMs));\n    if (timeoutMs !== 30000) driverArgs.push('--timeout', String(timeoutMs));\n\n    ctx.events.emit({\n      type: 'tool:called', tool: 'browser', args: { command, url }, agentId: ctx.agentId,\n    });\n\n    const raw = await runDriver(driverArgs, timeoutMs + 4000).catch(() => '');\n    const summary = summarizeResult(command, raw);\n    ctx.events.emit({\n      type: 'tool:completed', tool: 'browser', agentId: ctx.agentId,\n      result: { toolCallId: '', name: 'browser', output: summary, durationMs: 0 },\n    });\n    return summary;\n  },\n};\n\n/** Turn the driver's JSON into a compact, model-friendly text summary. */\nexport function summarizeResult(command: string, raw: string): string {\n  if (!raw.trim()) return 'browser: no output (driver likely timed out).';\n  let data: Record<string, unknown> | null = null;\n  try { data = JSON.parse(raw); } catch { /* not JSON — pass through */ }\n  if (!data) return raw.slice(0, 4000);\n  if (data.ok === false) return `[browser ${command}] ERROR: ${data.error ?? 'unknown'}`;\n  const parts: string[] = [`[browser ${command}] ok`];\n  if (data.title) parts.push(`title: ${data.title}`);\n  if (data.url) parts.push(`url: ${data.url}`);\n  if (data.text) parts.push(`text: ${data.text}`);\n  if (Array.isArray(data.links)) {\n    parts.push(`links (${data.links.length}):`);\n    for (const l of (data.links as Array<{ href?: string; text?: string; sel?: string }>).slice(0, 30)) {\n      parts.push(`  ${l.sel ?? ''} ${l.href ?? ''} ${l.text ?? ''}`.trim());\n    }\n  }\n  if (Array.isArray(data.inputs) && (data.inputs as unknown[]).length) {\n    parts.push(`inputs (${(data.inputs as unknown[]).length}):`);\n    for (const i of (data.inputs as Array<{ sel?: string; tag?: string; name?: string; type?: string; val?: string }>).slice(0, 30)) {\n      parts.push(`  ${i.sel ?? ''} <${i.tag ?? ''}> name=${i.name ?? ''} type=${i.type ?? ''} val=${i.val ?? ''}`.trim());\n    }\n  }\n  if (data.html) parts.push(`html: ${data.html}`);\n  if (data.saved) parts.push(`saved: ${data.saved}`);\n  if (data.action) parts.push(`action: ${data.action} target=${(data as { target?: string }).target ?? ''} text=${data.text ?? ''}`);\n  if (data.result !== undefined) parts.push(`result: ${String(data.result)}`);\n  return parts.join('\\n');\n}"
  },
  "src/tools/codebase-map.ts": {
    "path": "src/tools/codebase-map.ts",
    "name": "codebase-map.ts",
    "dir": "src/tools",
    "lang": "typescript",
    "size": "11.7 KB",
    "lines": 336,
    "desc": "High-speed semantic codebase structure and symbol dependency mapper",
    "code": "// Architectural Codebase Mapper for Large-Scale Codebases.\n// Instantly computes project ecosystem, module topology, LOC metrics, entry points, and structural blast radius.\n\nimport { readdirSync, readFileSync, existsSync } from 'node:fs';\nimport { resolve, join, relative, extname, basename } from 'node:path';\nimport { homedir } from 'node:os';\nimport type { Tool } from './types.js';\n\ninterface LangStat {\n  files: number;\n  lines: number;\n}\n\ninterface DirSummary {\n  path: string;\n  files: number;\n  lines: number;\n  primaryLang: string;\n  keyFiles: string[];\n}\n\nconst IGNORED_DIRS = new Set([\n  'node_modules', '.git', 'dist', 'target', 'build', '.next', '.turbo',\n  'coverage', '.cache', '__pycache__', '.venv', 'venv', '.idea', '.vscode',\n  '.yarn', '.pnpm-store', 'vendor', 'out',\n]);\n\nconst EXT_LANG_MAP: Record<string, string> = {\n  '.ts': 'TypeScript',\n  '.tsx': 'TypeScript (React)',\n  '.js': 'JavaScript',\n  '.jsx': 'JavaScript (React)',\n  '.mjs': 'JavaScript',\n  '.cjs': 'JavaScript',\n  '.py': 'Python',\n  '.rs': 'Rust',\n  '.go': 'Go',\n  '.c': 'C',\n  '.h': 'C/C++ Header',\n  '.cpp': 'C++',\n  '.hpp': 'C++ Header',\n  '.java': 'Java',\n  '.kt': 'Kotlin',\n  '.cs': 'C#',\n  '.rb': 'Ruby',\n  '.php': 'PHP',\n  '.swift': 'Swift',\n  '.vue': 'Vue',\n  '.svelte': 'Svelte',\n  '.json': 'JSON',\n  '.yaml': 'YAML',\n  '.yml': 'YAML',\n  '.toml': 'TOML',\n  '.md': 'Markdown',\n  '.sh': 'Shell',\n  '.bash': 'Shell',\n};\n\nconst KEY_ENTRY_NAMES = new Set([\n  'index.ts', 'index.js', 'main.ts', 'main.js', 'main.rs', 'main.go',\n  'app.ts', 'app.js', 'app.py', 'server.ts', 'server.js', 'cli.ts', 'cli.js',\n  'lib.rs', 'mod.rs', 'routes.ts', 'router.ts', 'types.ts', 'types.d.ts',\n]);\n\nexport interface CodebaseMapResult {\n  projectDir: string;\n  manifests: string[];\n  projectTypes: string[];\n  totalFiles: number;\n  totalLines: number;\n  languages: Record<string, LangStat>;\n  modules: DirSummary[];\n  entryPoints: string[];\n  keyExports: Record<string, string[]>;\n}\n\nexport function generateCodebaseMap(\n  rootDir: string,\n  opts: { maxDepth?: number; detailLevel?: 'compact' | 'standard' | 'deep'; includeExports?: boolean } = {}\n): CodebaseMapResult {\n  const maxDepth = Math.max(1, Math.min(6, opts.maxDepth ?? 3));\n  const detailLevel = opts.detailLevel ?? 'standard';\n  const includeExports = opts.includeExports ?? (detailLevel !== 'compact');\n\n  const manifests: string[] = [];\n  const projectTypes = new Set<string>();\n\n  // Check manifests at root\n  if (existsSync(join(rootDir, 'package.json'))) {\n    manifests.push('package.json');\n    projectTypes.add('Node.js / JS Ecosystem');\n    try {\n      const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));\n      if (pkg.workspaces) projectTypes.add('Monorepo (npm/yarn/pnpm)');\n      if (pkg.dependencies?.react || pkg.devDependencies?.react) projectTypes.add('React');\n      if (pkg.dependencies?.next) projectTypes.add('Next.js');\n      if (pkg.dependencies?.express) projectTypes.add('Express');\n      if (pkg.dependencies?.fastify) projectTypes.add('Fastify');\n    } catch {}\n  }\n  if (existsSync(join(rootDir, 'pnpm-workspace.yaml'))) {\n    manifests.push('pnpm-workspace.yaml');\n    projectTypes.add('pnpm Monorepo');\n  }\n  if (existsSync(join(rootDir, 'Cargo.toml'))) {\n    manifests.push('Cargo.toml');\n    projectTypes.add('Rust / Cargo');\n  }\n  if (existsSync(join(rootDir, 'go.mod'))) {\n    manifests.push('go.mod');\n    projectTypes.add('Go');\n  }\n  if (existsSync(join(rootDir, 'pyproject.toml')) || existsSync(join(rootDir, 'requirements.txt'))) {\n    manifests.push(existsSync(join(rootDir, 'pyproject.toml')) ? 'pyproject.toml' : 'requirements.txt');\n    projectTypes.add('Python');\n  }\n  if (existsSync(join(rootDir, 'CMakeLists.txt')) || existsSync(join(rootDir, 'Makefile'))) {\n    manifests.push(existsSync(join(rootDir, 'CMakeLists.txt')) ? 'CMakeLists.txt' : 'Makefile');\n    projectTypes.add('C/C++ / Native');\n  }\n\n  const languages: Record<string, LangStat> = {};\n  const modulesMap = new Map<string, { files: number; lines: number; langCounts: Record<string, number>; keyFiles: string[] }>();\n  const entryPoints: string[] = [];\n  const keyExports: Record<string, string[]> = {};\n  let totalFiles = 0;\n  let totalLines = 0;\n\n  function countLines(content: string): number {\n    let count = 0;\n    for (let i = 0; i < content.length; i++) {\n      if (content.charCodeAt(i) === 10) count++;\n    }\n    return count + 1;\n  }\n\n  function extractExports(content: string): string[] {\n    const lines = content.split('\\n');\n    const exports: string[] = [];\n    const exportRegex = /^\\s*export\\s+(?:async\\s+)?(?:function|class|interface|type|const|enum|let)\\s+([A-Za-z0-9_$]+)/;\n    const pubRegex = /^\\s*pub(?:\\([^)]+\\))?\\s+(?:fn|struct|enum|trait|type|const)\\s+([A-Za-z0-9_]+)/;\n    const pyRegex = /^(?:def|class)\\s+([A-Za-z0-9_]+)/;\n\n    for (const line of lines) {\n      if (exports.length >= 10) break;\n      const mExport = line.match(exportRegex);\n      if (mExport) {\n        exports.push(mExport[1]);\n        continue;\n      }\n      const mPub = line.match(pubRegex);\n      if (mPub) {\n        exports.push(mPub[1]);\n        continue;\n      }\n      const mPy = line.match(pyRegex);\n      if (mPy && !line.startsWith('def _')) {\n        exports.push(mPy[1]);\n      }\n    }\n    return exports;\n  }\n\n  function scanDir(dir: string, depth: number) {\n    if (depth > maxDepth) return;\n    let entries;\n    try {\n      entries = readdirSync(dir, { withFileTypes: true });\n    } catch {\n      return;\n    }\n\n    for (const entry of entries) {\n      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;\n\n      const fullPath = join(dir, entry.name);\n      const relPath = relative(rootDir, fullPath);\n\n      if (entry.isDirectory()) {\n        scanDir(fullPath, depth + 1);\n      } else if (entry.isFile()) {\n        const ext = extname(entry.name).toLowerCase();\n        const lang = EXT_LANG_MAP[ext];\n        if (!lang) continue;\n\n        totalFiles++;\n        let lineCount = 0;\n        let content = '';\n        try {\n          content = readFileSync(fullPath, 'utf8');\n          lineCount = countLines(content);\n        } catch {\n          continue;\n        }\n\n        totalLines += lineCount;\n\n        if (!languages[lang]) {\n          languages[lang] = { files: 0, lines: 0 };\n        }\n        languages[lang].files++;\n        languages[lang].lines += lineCount;\n\n        // Determine top-level module (depth 1 or 2 relative path)\n        const parts = relPath.split('/');\n        const modKey = parts.length > 1 ? (parts[0] === 'src' && parts.length > 2 ? `src/${parts[1]}` : parts[0]) : '.';\n\n        if (!modulesMap.has(modKey)) {\n          modulesMap.set(modKey, { files: 0, lines: 0, langCounts: {}, keyFiles: [] });\n        }\n        const m = modulesMap.get(modKey)!;\n        m.files++;\n        m.lines += lineCount;\n        m.langCounts[lang] = (m.langCounts[lang] || 0) + 1;\n\n        // Detect entry points\n        if (KEY_ENTRY_NAMES.has(entry.name) || relPath.endsWith('index.ts') || relPath.endsWith('main.ts')) {\n          if (!entryPoints.includes(relPath)) entryPoints.push(relPath);\n          if (m.keyFiles.length < 5) m.keyFiles.push(entry.name);\n\n          if (includeExports && (parts.length <= 3) && !keyExports[relPath]) {\n            const syms = extractExports(content);\n            if (syms.length > 0) keyExports[relPath] = syms;\n          }\n        }\n      }\n    }\n  }\n\n  scanDir(rootDir, 1);\n\n  const modules: DirSummary[] = Array.from(modulesMap.entries())\n    .map(([modPath, data]) => {\n      let topLang = 'Unknown';\n      let maxCount = 0;\n      for (const [l, count] of Object.entries(data.langCounts)) {\n        if (count > maxCount) {\n          maxCount = count;\n          topLang = l;\n        }\n      }\n      return {\n        path: modPath,\n        files: data.files,\n        lines: data.lines,\n        primaryLang: topLang,\n        keyFiles: data.keyFiles,\n      };\n    })\n    .sort((a, b) => b.lines - a.lines);\n\n  return {\n    projectDir: rootDir,\n    manifests,\n    projectTypes: Array.from(projectTypes),\n    totalFiles,\n    totalLines,\n    languages,\n    modules,\n    entryPoints: entryPoints.slice(0, 15),\n    keyExports,\n  };\n}\n\nexport function formatCodebaseMap(res: CodebaseMapResult, detailLevel: 'compact' | 'standard' | 'deep' = 'standard'): string {\n  const lines: string[] = [];\n  lines.push(`🗺️ Codebase Map: ${basename(res.projectDir)} (${res.totalFiles.toLocaleString()} files, ${res.totalLines.toLocaleString()} LOC)`);\n  \n  if (res.projectTypes.length > 0) {\n    lines.push(`📦 Ecosystem: ${res.projectTypes.join(' | ')}`);\n  }\n  if (res.manifests.length > 0) {\n    lines.push(`📄 Manifests: ${res.manifests.join(', ')}`);\n  }\n  lines.push('');\n\n  // Language Breakdown\n  const sortedLangs = Object.entries(res.languages)\n    .sort((a, b) => b[1].lines - a[1].lines)\n    .slice(0, 8);\n\n// ... [File continues on GitHub repository] ..."
  },
  "src/tools/mcp-manage.ts": {
    "path": "src/tools/mcp-manage.ts",
    "name": "mcp-manage.ts",
    "dir": "src/tools",
    "lang": "typescript",
    "size": "12.5 KB",
    "lines": 318,
    "desc": "MCP server configuration manager and stdio transport linker",
    "code": "// Native tool: mcp_manage\n// Lists, describes, and generates install guides for built-in MCP servers.\n\nimport type { Tool } from './types.js';\nimport { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';\nimport { resolve } from 'node:path';\n\nexport interface BuiltinMcpServer {\n  id: string;\n  name: string;\n  description: string;\n  command: string;\n  args: string[];\n  env?: Record<string, string>;\n  installHint?: string;\n}\n\nexport const BUILTIN_MCP_SERVERS: BuiltinMcpServer[] = [\n  {\n    id: 'mcp-filesystem',\n    name: 'Filesystem MCP',\n    description: 'Enhanced file system operations (read, write, list, search, move, copy)',\n    command: 'npx',\n    args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],\n    installHint: 'npx -y @modelcontextprotocol/server-filesystem',\n  },\n  {\n    id: 'mcp-github',\n    name: 'GitHub MCP',\n    description: 'GitHub API: repos, issues, PRs, code search, notifications',\n    command: 'npx',\n    args: ['-y', '@modelcontextprotocol/server-github'],\n    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' },\n    installHint: 'export GITHUB_TOKEN=ghp_your_token_here',\n  },\n  {\n    id: 'mcp-postgres',\n    name: 'PostgreSQL MCP',\n    description: 'PostgreSQL database inspection, queries, and schema analysis',\n    command: 'npx',\n    args: ['-y', '@modelcontextprotocol/server-postgres', '${DATABASE_URL}'],\n    env: { DATABASE_URL: '${DATABASE_URL}' },\n    installHint: 'export DATABASE_URL=postgresql://user:pass@localhost/mydb',\n  },\n  {\n    id: 'mcp-brave-search',\n    name: 'Brave Search MCP',\n    description: 'Real-time web search via Brave Search API',\n    command: 'npx',\n    args: ['-y', '@modelcontextprotocol/server-brave-search'],\n    env: { BRAVE_API_KEY: '${BRAVE_API_KEY}' },\n    installHint: 'Get API key at https://api.search.brave.com — export BRAVE_API_KEY=your_key',\n  },\n  {\n    id: 'mcp-puppeteer',\n    name: 'Puppeteer MCP',\n    description: 'Browser automation: screenshots, scraping, navigation, form interaction',\n    command: 'npx',\n    args: ['-y', '@modelcontextprotocol/server-puppeteer'],\n    installHint: 'npx -y @modelcontextprotocol/server-puppeteer (requires Chrome/Chromium)',\n  },\n  {\n    id: 'mcp-slack',\n    name: 'Slack MCP',\n    description: 'Slack workspace: read/send messages, list channels, manage users',\n    command: 'npx',\n    args: ['-y', '@modelcontextprotocol/server-slack'],\n    env: { SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}', SLACK_TEAM_ID: '${SLACK_TEAM_ID}' },\n    installHint: 'Create Slack app at https://api.slack.com/apps — export SLACK_BOT_TOKEN=xoxb-...',\n  },\n  {\n    id: 'mcp-memory',\n    name: 'Memory MCP',\n    description: 'Persistent knowledge graph memory across sessions (entities + relations)',\n    command: 'npx',\n    args: ['-y', '@modelcontextprotocol/server-memory'],\n    installHint: 'npx -y @modelcontextprotocol/server-memory',\n  },\n  {\n    id: 'mcp-sqlite',\n    name: 'SQLite MCP',\n    description: 'SQLite database operations, queries, and schema analysis',\n    command: 'npx',\n    args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', '.mochi/mochi.db'],\n    installHint: 'npx -y @modelcontextprotocol/server-sqlite --db-path ./data.db',\n  },\n  {\n    id: 'mcp-sequential-thinking',\n    name: 'Sequential Thinking MCP',\n    description: 'Structured multi-step reasoning and planning with revision support',\n    command: 'npx',\n    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],\n    installHint: 'npx -y @modelcontextprotocol/server-sequential-thinking',\n  },\n  {\n    id: 'mcp-fetch',\n    name: 'Fetch MCP',\n    description: 'HTTP fetch with markdown conversion for web content ingestion',\n    command: 'uvx',\n    args: ['mcp-server-fetch'],\n    installHint: 'pip install uv && uvx mcp-server-fetch',\n  },\n  {\n    id: 'mcp-git',\n    name: 'Git MCP',\n    description: 'Advanced Git operations: log, blame, diff, branch management',\n    command: 'uvx',\n    args: ['mcp-server-git', '--repository', '.'],\n    installHint: 'pip install uv && uvx mcp-server-git --repository /path/to/repo',\n  },\n  {\n    id: 'mcp-everything',\n    name: 'Everything MCP',\n    description: 'Reference implementation with full MCP feature demo (prompts, resources, tools, sampling)',\n    command: 'npx',\n    args: ['-y', '@modelcontextprotocol/server-everything'],\n    installHint: 'npx -y @modelcontextprotocol/server-everything',\n  },\n];\n\nfunction yamlSnippet(server: BuiltinMcpServer): string {\n  const envLines = server.env\n    ? Object.entries(server.env).map(([k, v]) => `      ${k}: \"${v}\"`).join('\\n')\n    : '';\n  return [\n    `  ${server.id}:`,\n    `    command: ${server.command}`,\n    `    args: [${server.args.map(a => `\"${a}\"`).join(', ')}]`,\n    envLines ? `    env:\\n${envLines}` : '',\n  ].filter(Boolean).join('\\n');\n}\n\nexport interface McpSearchHit {\n  server: BuiltinMcpServer;\n  score: number;\n  snippet: string;\n}\n\n/** Interactive MCP discovery: fuzzy rank over id + name + description +\n *  install hints + env keys. Same recall-first contract as skill search —\n *  the picker (TUI menu or model) makes the final call. Pure. */\nexport function searchMcpServers(query: string, limit = 8): McpSearchHit[] {\n  const q = query.trim().toLowerCase();\n  if (!q) return [];\n  const hits: McpSearchHit[] = [];\n  for (const s of BUILTIN_MCP_SERVERS) {\n    const id = s.id.toLowerCase();\n    const name = s.name.toLowerCase();\n    const desc = s.description.toLowerCase();\n    const extra = `${s.installHint ?? ''} ${Object.keys(s.env ?? {}).join(' ')}`.toLowerCase();\n    let score = 0;\n    let snippet = s.description;\n    if (id === q || id === `mcp-${q}`) {\n      score = 1.0;\n      snippet = 'exact id match';\n    } else if (id.includes(q) || name.includes(q)) {\n      score = 0.85;\n      snippet = s.description;\n    } else if (desc.includes(q) && q.length >= 3) {\n      score = 0.6;\n      snippet = s.description;\n    } else if (extra.includes(q) && q.length >= 3) {\n      score = 0.45;\n      snippet = s.installHint ?? s.description;\n    } else {\n      const toks = new Set(q.match(/[a-z0-9]+/g) ?? []);\n      if (toks.size === 0) continue;\n      const hay = new Set(`${id.replace(/-/g, ' ')} ${name} ${desc}`.match(/[a-z0-9]+/g) ?? []);\n      let inter = 0;\n      for (const t of toks) if (hay.has(t)) inter++;\n      if (inter / Math.max(1, toks.size) >= 0.5 && inter > 0) {\n        score = 0.35 + 0.1 * Math.min(2, inter);\n        snippet = s.description;\n      }\n    }\n    if (score > 0) hits.push({ server: s, score, snippet });\n  }\n  hits.sort((a, b) => b.score - a.score || a.server.id.localeCompare(b.server.id));\n  return hits.slice(0, Math.max(1, limit));\n}\n\nexport interface McpAddResult {\n  ok: boolean;\n  message: string;\n  /** True when the server was already configured (no write needed). */\n  alreadyPresent?: boolean;\n}\n\n/** One-command MCP install: merges a built-in server into `<projectDir>/.mcp.json`\n *  (`{ mcpServers: { <id>: { command, args, env? } } }`). Never clobbers an\n *  existing entry or unrelated keys; corrupt files are refused with a message\n *  (not overwritten). Synchronous + dependency-free for easy testing. */\nexport function addMcpServerConfig(projectDir: string, serverId: string): McpAddResult {\n  const server = BUILTIN_MCP_SERVERS.find((s) => s.id === serverId);\n  if (!server) {\n    const ids = BUILTIN_MCP_SERVERS.map((s) => s.id).join(', ');\n    return { ok: false, message: `Unknown MCP server \"${serverId}\". Known: ${ids}` };\n  }\n  const file = resolve(projectDir, '.mcp.json');\n  let doc: Record<string, unknown> = {};\n  if (existsSync(file)) {\n    try {\n      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));\n      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {\n        return { ok: false, message: `.mcp.json is corrupt (not an object) — refusing to overwrite. Back it up, delete it, and retry.` };\n      }\n      doc = parsed as Record<string, unknown>;\n    } catch {\n      return { ok: false, message: `.mcp.json is not valid JSON — refusing to overwrite. Back it up, delete it, and retry.` };\n    }\n  }\n  const servers = (doc.mcpServers ?? doc.servers ?? {}) as Record<string, unknown>;\n  if (servers[server.id] !== undefined) {\n    return { ok: true, alreadyPresent: true, message: `${server.id} is already configured in .mcp.json — no changes made.` };\n  }\n  const entry: Record<string, unknown> = { command: server.command, args: [...server.args] };\n  if (server.env) entry.env = { ...server.env };\n  doc.mcpServers = { ...(servers as Record<string, unknown>), [server.id]: entry };\n  try {\n    mkdirSync(projectDir, { recursive: true });\n    writeFileSync(file, JSON.stringify(doc, null, 2) + '\\n', 'utf8');\n  } catch (e) {\n    return { ok: false, message: `Could not write .mcp.json: ${e instanceof Error ? e.message : String(e)}` };\n  }\n  const envNote = server.env ? ` Set ${Object.keys(server.env).join(', ')} first.` : '';\n  return { ok: true, message: `Added ${server.id} (${server.name}) to .mcp.json.${envNote} Restart the session (or run /doctor) so the MCP client picks it up.` };\n}\n\nexport const mcpManageTool: Tool = {\n  def: {\n    name: 'mcp_manage',\n    description: 'Discover and install MCP servers: search built-ins by keyword, one-command add to .mcp.json, list, install guides, and config snippets.',\n    parameters: [\n      { name: 'action', type: 'string', description: \"'search' | 'add' | 'list' | 'install-guide' | 'config'\", required: true },\n      { name: 'query', type: 'string', description: 'Search keywords (for search action)', required: false },\n      { name: 'server_id', type: 'string', description: 'Specific server ID (for config/add actions)', required: false },\n      { name: 'project_dir', type: 'string', description: 'Project root for add (defaults to cwd)', required: false },\n    ],\n    permission: 'read',\n  },\n  async execute(args, ctx) {\n    const action = String(args.action || '').toLowerCase();\n    const serverId = args.server_id ? String(args.server_id) : undefined;\n\n    switch (action) {\n      case 'search': {\n        const q = typeof args.query === 'string' ? args.query : '';\n        const hits = searchMcpServers(q);\n        if (!hits.length) return `No MCP servers match \"${q}\". Try 'list' to browse all ${BUILTIN_MCP_SERVERS.length} built-ins.`;\n        return [\n          `## MCP search: \"${q}\" (${hits.length} match${hits.length === 1 ? '' : 'es'})`,\n          '',\n          ...hits.map((h) => `- \\`${h.server.id}\\` — **${h.server.name}**: ${h.snippet}`),\n          '',\n          'Use `mcp_manage(action=\"add\", server_id=\"<id>\")` to install one into .mcp.json.',\n        ].join('\\n');\n      }\n      case 'add': {\n        if (!serverId) return 'add needs server_id (use search or list to find one).';\n        const dir = typeof args.project_dir === 'string' && args.project_dir ? args.project_dir : (ctx?.cwd ?? process.cwd());\n        const r = addMcpServerConfig(dir, serverId);\n        return r.message;\n      }\n      case 'list': {\n        const rows = BUILTIN_MCP_SERVERS.map(s =>\n          `| \\`${s.id}\\` | ${s.name} | ${s.description} |`\n        );\n        return [\n          '## Built-in MCP Servers',\n          '',\n          '| ID | Name | Description |',\n          '| :-- | :-- | :-- |',\n          ...rows,\n          '',\n          'Use `mcp_manage(action=\"config\")` to get the config snippet for any server.',\n          'Use `mcp_manage(action=\"install-guide\")` for full setup instructions.',\n        ].join('\\n');\n      }\n\n      case 'config': {\n\n// ... [File continues on GitHub repository] ..."
  },
  "src/core/ast-guard.ts": {
    "path": "src/core/ast-guard.ts",
    "name": "ast-guard.ts",
    "dir": "src/core",
    "lang": "typescript",
    "size": "14.4 KB",
    "lines": 425,
    "desc": "AST invariant verifier ensuring parseability before and after mutations",
    "code": "// In-Memory In-Turn AST Diagnostic Guard for Mochi\n// Performs sub-millisecond static syntax and structural validation on file modifications\n// before the agent completes its turn, enabling instant self-correction without running slow CLI test suites.\n\nimport { extname, dirname, resolve } from 'node:path';\nimport { existsSync } from 'node:fs';\nimport { execFileSync } from 'node:child_process';\nimport { createRequire } from 'node:module';\n\nlet _ts: typeof import('typescript') | null = null;\nfunction getTsCompiler(): typeof import('typescript') | null {\n  try {\n    if (!_ts) _ts = createRequire(import.meta.url)('typescript') as typeof import('typescript');\n    return _ts;\n  } catch {\n    return null;\n  }\n}\n\nexport interface ASTDiagnosticError {\n  line: number;\n  column?: number;\n  message: string;\n  severity: 'error' | 'warning';\n}\n\nexport interface ASTDiagnosticResult {\n  valid: boolean;\n  errors: ASTDiagnosticError[];\n  summary?: string;\n}\n\n/** Validates TypeScript / JavaScript source syntax using the TypeScript compiler AST parser */\nexport function validateTypeScriptSyntax(filePath: string, content: string): ASTDiagnosticResult {\n  const ts = getTsCompiler();\n  if (!ts) return { valid: true, errors: [] };\n\n  try {\n    const isTsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');\n    const isTs = filePath.endsWith('.ts') || filePath.endsWith('.mts') || filePath.endsWith('.cts');\n    const kind = isTsx ? ts.ScriptKind.TSX : (isTs ? ts.ScriptKind.TS : ts.ScriptKind.JS);\n    const sourceFile = ts.createSourceFile(\n      filePath,\n      content,\n      ts.ScriptTarget.Latest,\n      true,\n      kind\n    );\n\n    const rawDiags: unknown = (sourceFile as { parseDiagnostics?: unknown }).parseDiagnostics ?? [];\n    const diags: Array<{ start?: number; messageText: unknown }> = Array.isArray(rawDiags) ? rawDiags : [];\n    if (diags.length === 0) {\n      return { valid: true, errors: [] };\n    }\n\n    const errors: ASTDiagnosticError[] = [];\n    for (const d of diags) {\n      const pos = d.start !== undefined ? sourceFile.getLineAndCharacterOfPosition(d.start) : { line: 0, character: 0 };\n      const nested = d.messageText as { messageText?: unknown } | null | undefined;\n      const msg = typeof d.messageText === 'string'\n        ? d.messageText\n        : (typeof nested?.messageText === 'string' ? nested.messageText : 'Syntax error');\n      errors.push({\n        line: pos.line + 1,\n        column: pos.character + 1,\n        message: msg,\n        severity: 'error',\n      });\n    }\n\n    const summary = errors.map((e) => `Line ${e.line}: ${e.message}`).join('; ');\n    return {\n      valid: errors.length === 0,\n      errors,\n      summary: errors.length > 0 ? summary : undefined,\n    };\n  } catch {\n    return { valid: true, errors: [] };\n  }\n}\n\n/**\n * Verifies that relative imports within TypeScript / JavaScript files exist on disk.\n * Catches hallucinated module paths before the agent finishes its turn.\n */\nexport function validateRelativeImports(filePath: string, content: string): ASTDiagnosticResult {\n  const dir = dirname(filePath);\n  const errors: ASTDiagnosticError[] = [];\n\n  const importRegex = /(?:import|export)\\s+(?:[\\w*\\s{},]*\\s+from\\s+)?['\"](\\.[^'\"]+)['\"]|require\\s*\\(\\s*['\"](\\.[^'\"]+)['\"]\\s*\\)/g;\n  const lines = content.split('\\n');\n\n  for (let i = 0; i < lines.length; i++) {\n    const line = lines[i];\n    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) continue;\n\n    let match: RegExpExecArray | null;\n    while ((match = importRegex.exec(line)) !== null) {\n      const importPath = match[1] || match[2];\n      if (!importPath || !importPath.startsWith('.')) continue;\n\n      const basePath = resolve(dir, importPath);\n      const candidates = [\n        basePath,\n        basePath.replace(/\\.js$/, '.ts'),\n        basePath.replace(/\\.mjs$/, '.mts'),\n        basePath.replace(/\\.cjs$/, '.cts'),\n        basePath.replace(/\\.jsx$/, '.tsx'),\n        `${basePath}.ts`,\n        `${basePath}.tsx`,\n        `${basePath}.js`,\n        `${basePath}.jsx`,\n        `${basePath}.json`,\n        `${basePath}/index.ts`,\n        `${basePath}/index.tsx`,\n        `${basePath}/index.js`,\n      ];\n\n      const exists = candidates.some((c) => existsSync(c));\n      if (!exists) {\n        errors.push({\n          line: i + 1,\n          message: `Cannot find module '${importPath}' relative to ${filePath}`,\n          severity: 'warning',\n        });\n      }\n    }\n  }\n\n  return {\n    valid: errors.length === 0,\n    errors,\n    summary: errors.length > 0 ? errors.map((e) => `Line ${e.line}: ${e.message}`).join('; ') : undefined,\n  };\n}\n\n/** Validates JSON syntax and isolates exact error line */\nexport function validateJSON(content: string): ASTDiagnosticResult {\n  try {\n    JSON.parse(content);\n    return { valid: true, errors: [] };\n  } catch (err: any) {\n    const msg = String(err.message || 'JSON Parse error');\n    let line = 1;\n    const posMatch = msg.match(/position\\s+(\\d+)/i);\n    if (posMatch) {\n      const pos = Number(posMatch[1]);\n      line = content.slice(0, pos).split('\\n').length;\n    } else {\n      const lineMatch = msg.match(/line\\s+(\\d+)/i);\n      if (lineMatch) line = Number(lineMatch[1]);\n    }\n    return {\n      valid: false,\n      errors: [{ line, message: msg, severity: 'error' }],\n      summary: `JSON Syntax Error at line ${line}: ${msg}`,\n    };\n  }\n}\n\n/** Validates bracket/brace/parenthesis nesting and unclosed strings across source files */\nexport function validateBalancedStructure(content: string, language: string): ASTDiagnosticResult {\n  const lines = content.split(/\\r?\\n/);\n  const errors: ASTDiagnosticError[] = [];\n  const stack: { char: string; line: number; col: number }[] = [];\n\n  let inSingleQuote = false;\n  let inDoubleQuote = false;\n  let inTemplateString = false;\n  let inLineComment = false;\n  let inBlockComment = false;\n\n  for (let l = 0; l < lines.length; l++) {\n    const line = lines[l];\n    inLineComment = false;\n\n    for (let c = 0; c < line.length; c++) {\n      const ch = line[c];\n      const prev = c > 0 ? line[c - 1] : '';\n      const next = c + 1 < line.length ? line[c + 1] : '';\n\n      // Handle comments\n      if (!inSingleQuote && !inDoubleQuote && !inTemplateString) {\n        if (!inBlockComment && ch === '/' && next === '/') {\n          inLineComment = true;\n          break; // skip rest of line\n        }\n        if (!inBlockComment && (ch === '#' && (language === 'python' || language === 'yaml' || language === 'sh'))) {\n          inLineComment = true;\n          break;\n        }\n        if (!inBlockComment && ch === '/' && next === '*') {\n          inBlockComment = true;\n          c++;\n          continue;\n        }\n        if (inBlockComment && ch === '*' && next === '/') {\n          inBlockComment = false;\n          c++;\n          continue;\n        }\n      }\n\n      if (inBlockComment || inLineComment) continue;\n\n      // Handle string quotes with escape support\n      if (ch === \"'\" && !inDoubleQuote && !inTemplateString && prev !== '\\\\') {\n        inSingleQuote = !inSingleQuote;\n        continue;\n      }\n      if (ch === '\"' && !inSingleQuote && !inTemplateString && prev !== '\\\\') {\n        inDoubleQuote = !inDoubleQuote;\n        continue;\n      }\n      if (ch === '`' && !inSingleQuote && !inDoubleQuote && prev !== '\\\\') {\n        inTemplateString = !inTemplateString;\n        continue;\n      }\n\n      if (inSingleQuote || inDoubleQuote || inTemplateString) continue;\n\n      // Check brackets\n      if (ch === '{' || ch === '(' || ch === '[') {\n        stack.push({ char: ch, line: l + 1, col: c + 1 });\n      } else if (ch === '}' || ch === ')' || ch === ']') {\n        if (stack.length === 0) {\n          errors.push({\n            line: l + 1,\n            column: c + 1,\n            message: `Unmatched closing bracket '${ch}' with no opening pair`,\n            severity: 'error',\n          });\n        } else {\n          const top = stack.pop()!;\n          const expected = top.char === '{' ? '}' : top.char === '(' ? ')' : ']';\n          if (ch !== expected) {\n            errors.push({\n              line: l + 1,\n              column: c + 1,\n              message: `Mismatched bracket '${ch}', expected '${expected}' matching '${top.char}' from line ${top.line}`,\n              severity: 'error',\n            });\n          }\n        }\n      }\n    }\n\n    // Check unclosed single-line strings\n    if ((inSingleQuote || inDoubleQuote) && !inTemplateString && language !== 'python') {\n      // In JS/TS/Go/Rust, regular strings cannot span multiple lines without escape\n      if (line.endsWith('\\\\')) {\n        // Escaped newline, allowed\n      } else {\n        errors.push({\n          line: l + 1,\n          message: `Unclosed string literal on line ${l + 1}`,\n          severity: 'error',\n        });\n        inSingleQuote = false;\n        inDoubleQuote = false;\n      }\n    }\n  }\n\n  // Any unclosed brackets left on stack\n  if (stack.length > 0) {\n    const unclosed = stack[stack.length - 1];\n    errors.push({\n      line: unclosed.line,\n      column: unclosed.col,\n      message: `Unclosed opening bracket '${unclosed.char}' at line ${unclosed.line}`,\n      severity: 'error',\n    });\n  }\n\n  return {\n    valid: errors.length === 0,\n    errors,\n    summary: errors.length > 0 ? errors.map((e) => `Line ${e.line}: ${e.message}`).join('; ') : undefined,\n  };\n\n// ... [File continues on GitHub repository] ..."
  },
  "src/core/diff-hygiene.ts": {
    "path": "src/core/diff-hygiene.ts",
    "name": "diff-hygiene.ts",
    "dir": "src/core",
    "lang": "typescript",
    "size": "3.1 KB",
    "lines": 87,
    "desc": "Diff hygiene scanner preventing stray whitespace and broken syntax",
    "code": "// Diff-hygiene scanner (harness-v2 quality): models routinely ship working code\n// polluted with debug logging, leftover TODO markers, type-check suppressions,\n// and `.only()`-focused tests. Humans then burn a cleanup pass. This module\n// scans ADDED lines of a diff for that class of debris so the agent can clean\n// it up itself before declaring done. Pure function — trivially testable.\n\nexport interface HygieneFinding {\n  file: string;\n  line: number;\n  kind: 'debug-log' | 'debugger' | 'todo-marker' | 'suppressed-check' | 'focused-test';\n  text: string;\n}\n\nconst MAX_FINDINGS = 8;\n\n/** Files whose whole job is tests/logging — debug output there is legitimate. */\nfunction isTestLike(file: string): boolean {\n  return /\\.(test|spec)\\.[jt]sx?$|(^|\\/)(tests?|__tests__)\\//i.test(file) || /\\.test\\./i.test(file);\n}\n\nfunction codeFile(file: string): boolean {\n  return /\\.(tsx?|jsx?|mts|cts|mjs|cjs|py|rs|go|java|cs|php|rb)$/i.test(file);\n}\n\ninterface Rule {\n  kind: HygieneFinding['kind'];\n  test: RegExp;\n}\n\nconst RULES: Rule[] = [\n  { kind: 'debugger', test: /^\\s*debugger\\b/ },\n  { kind: 'debug-log', test: /\\bconsole\\.(log|debug|info|table|dir)\\b\\s*\\(/ },\n  { kind: 'debug-log', test: /\\bpdb\\.set_trace\\b|\\bbreakpoint\\s*\\(\\s*\\)/ },\n  { kind: 'todo-marker', test: /\\b(TODO|FIXME|HACK|XXX)\\b(?![^)]*\\))/ },\n  { kind: 'suppressed-check', test: /@ts-ignore|@ts-expect-error|#\\s*type:\\s*ignore|eslint-disable(?:-next-line)?|noqa\\b|#\\s*noqa/i },\n  { kind: 'focused-test', test: /\\b(describe|it|test)\\.only\\s*\\(/ },\n];\n\n/**\n * Scan a unified diff for added lines that match hygiene rules. Untracked new\n * files may be folded in by prefixing every content line with '+' and a\n * `+++ b/<path>` header (see collectHygiene callers).\n */\nexport function scanDiffForHygiene(diff: string): HygieneFinding[] {\n  const findings: HygieneFinding[] = [];\n  let curFile = '';\n  let curLine = 0;\n  for (const raw of diff.split('\\n')) {\n    if (raw.startsWith('+++ b/')) {\n      curFile = raw.slice(6).trim();\n      continue;\n    }\n    if (raw.startsWith('@@')) {\n      const m = raw.match(/^\\s*@@ -\\d+(?:,\\d+)? \\+(\\d+)/);\n      curLine = m ? Number(m[1]) - 1 : curLine;\n      continue;\n    }\n    if (!raw.startsWith('+') || raw.startsWith('+++')) {\n      // Context lines advance the new-file line counter; removed lines don't.\n      if (raw.startsWith(' ') && curFile) curLine++;\n      continue;\n    }\n    curLine++;\n    const added = raw.slice(1);\n    if (!curFile || !codeFile(curFile) || isTestLike(curFile)) continue;\n    // Strip common comment/string prefixes so rules match intent, not noise.\n    for (const rule of RULES) {\n      if (rule.test.test(added)) {\n        findings.push({\n          file: curFile,\n          line: Math.max(1, curLine),\n          kind: rule.kind,\n          text: added.trim().slice(0, 160),\n        });\n        break; // one finding per line\n      }\n    }\n    if (findings.length >= MAX_FINDINGS) break;\n  }\n  return findings;\n}\n\nexport function renderHygieneFindings(f: HygieneFinding[]): string {\n  return f\n    .map((x) => `- [${x.kind}] ${x.file}:${x.line} — ${x.text}`)\n    .join('\\n');\n}\n"
  },
  "src/core/execution-registry.ts": {
    "path": "src/core/execution-registry.ts",
    "name": "execution-registry.ts",
    "dir": "src/core",
    "lang": "typescript",
    "size": "8.1 KB",
    "lines": 225,
    "desc": "Deterministic tool registry and policy permission gates",
    "code": "// Execution Registry — the single authority for \"has this work already been\n// done / is it already running?\" (master rebuild Phases 3 & 4).\n//\n// Two bug classes this eliminates:\n//  1. Duplicate execution: the same tool/command arriving twice in quick\n//     succession (model retry, event replay, double consumer) ran twice.\n//     Within a short window an identical request is recognized and the\n//     original execution is reused — the command executes ONCE.\n//  2. Replay after completion: a caller presenting an executionId that already\n//     completed gets the cached result instead of a fresh run (idempotency).\n//\n// All maps are bounded (drop-oldest by insertion order) so a long-lived agent\n// process cannot leak memory no matter how many tool calls it makes.\n\nimport { randomUUID } from 'node:crypto';\n\nexport interface ExecutionRequest {\n  /** Logical work identity: tool name + normalized arguments. */\n  toolName: string;\n  args: Record<string, unknown>;\n  /** Caller-supplied execution id (e.g. the model's tool_call_id). */\n  executionId?: string;\n}\n\nexport type ExecutionStatus = 'running' | 'completed' | 'failed' | 'canceled';\n\nexport interface ExecutionRecord {\n  executionId: string;\n  toolName: string;\n  argsKey: string;\n  status: ExecutionStatus;\n  attempt: number;\n  startedAt: number;\n  finishedAt?: number;\n  /** Cached result payload for idempotent replay of completed work. */\n  result?: unknown;\n  duplicate?: boolean;\n}\n\nexport interface RegistryOptions {\n  /** Window (ms) in which an identical (toolName,args) request is treated as\n   *  a duplicate of the in-flight/recent execution. Default 1500ms. */\n  dedupeWindowMs?: number;\n  /** Max completed records retained for replay. Default 500. */\n  completedLimit?: number;\n  /** Max concurrent tracked executions before the oldest is reaped. Default 200. */\n  activeLimit?: number;\n}\n\n/** Stable identity for a request's arguments: object keys are sorted\n *  recursively so key order can never change a request's identity. */\nexport function argsKey(args: Record<string, unknown>): string {\n  try {\n    return stableStringify(args);\n  } catch {\n    // Circular or otherwise unserializable args: fall back to a shallow key.\n    return `unserializable:${Object.keys(args).sort().join(',')}`;\n  }\n}\n\nfunction stableStringify(value: unknown): string {\n  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';\n  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;\n  const entries = Object.entries(value as Record<string, unknown>)\n    .filter(([, v]) => typeof v !== 'function' && typeof v !== 'symbol')\n    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))\n    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);\n  return `{${entries.join(',')}}`;\n}\n\nexport class ExecutionRegistry {\n  private readonly dedupeWindowMs: number;\n  private readonly completedLimit: number;\n  private readonly activeLimit: number;\n  private readonly active = new Map<string, ExecutionRecord>();\n  private readonly completed = new Map<string, ExecutionRecord>();\n  /** (toolName + argsKey) -> executionId, for duplicate detection. */\n  private readonly bySignature = new Map<string, string>();\n  private counters = { duplicatesPrevented: 0, replaysServed: 0, canceled: 0, registered: 0 };\n\n  constructor(opts: RegistryOptions = {}) {\n    this.dedupeWindowMs = opts.dedupeWindowMs ?? 1500;\n    this.completedLimit = opts.completedLimit ?? 500;\n    this.activeLimit = opts.activeLimit ?? 200;\n  }\n\n  /**\n   * Register an execution request. Returns the record to act on:\n   *  - duplicate=true -> do NOT execute; reuse record.executionId / result\n   *  - otherwise      -> execute, then markCompleted/markFailed/markCanceled\n   */\n  register(request: ExecutionRequest): ExecutionRecord {\n    const key = `${request.toolName}\\u0000${argsKey(request.args)}`;\n    this.counters.registered++;\n\n    // 1. Explicit replay: a completed executionId presented again serves the\n    //    cached result — never re-executes (idempotency).\n    if (request.executionId) {\n      const done = this.completed.get(request.executionId);\n      if (done) {\n        this.counters.replaysServed++;\n        return { ...done, duplicate: true };\n      }\n    }\n\n    // 2. Dedupe: identical signature within the window (in-flight OR just\n    //    finished) reuses the original execution.\n    const priorId = this.bySignature.get(key);\n    if (priorId) {\n      const prior = this.active.get(priorId) ?? this.completed.get(priorId);\n      if (prior) {\n        const finishedAgo = prior.finishedAt !== undefined ? Date.now() - prior.finishedAt : 0;\n        const inWindow = prior.status === 'running' || finishedAgo < this.dedupeWindowMs;\n        if (inWindow) {\n          this.counters.duplicatesPrevented++;\n          return { ...prior, attempt: prior.attempt + 1, duplicate: true };\n        }\n      }\n    }\n\n    // 3. Fresh execution.\n    const executionId = request.executionId ?? randomUUID();\n    const rec: ExecutionRecord = {\n      executionId,\n      toolName: request.toolName,\n      argsKey: key,\n      status: 'running',\n      attempt: 1,\n      startedAt: Date.now(),\n    };\n    this.active.set(executionId, rec);\n    this.bySignature.set(key, executionId);\n\n    // Bound active executions: reap the oldest (FIFO by insertion order).\n    while (this.active.size > this.activeLimit) {\n      const oldest = this.active.keys().next().value;\n      if (oldest === undefined) break;\n      const old = this.active.get(oldest);\n      this.active.delete(oldest);\n      if (old && old.status === 'running') this.counters.canceled++;\n    }\n    return rec;\n  }\n\n  markCompleted(executionId: string, result: unknown): void {\n    const rec = this.active.get(executionId);\n    if (!rec) return;\n    rec.status = 'completed';\n    rec.finishedAt = Date.now();\n    rec.result = result;\n    this.active.delete(executionId);\n    this.completed.set(executionId, rec);\n    this.trimCompleted();\n  }\n\n  markFailed(executionId: string, error: unknown): void {\n    const rec = this.active.get(executionId);\n    if (!rec) return;\n    rec.status = 'failed';\n    rec.finishedAt = Date.now();\n    rec.result = { error: error instanceof Error ? error.message : String(error) };\n    this.active.delete(executionId);\n    this.completed.set(executionId, rec);\n    this.trimCompleted();\n  }\n\n  markCanceled(executionId: string): void {\n    const rec = this.active.get(executionId);\n    if (!rec) return;\n    rec.status = 'canceled';\n    rec.finishedAt = Date.now();\n    this.active.delete(executionId);\n    this.completed.set(executionId, rec);\n    this.counters.canceled++;\n    this.trimCompleted();\n  }\n\n  /** Cancel every in-flight execution (Phase 5: cancellation propagation).\n   *  Returns how many were canceled. */\n  cancelAll(reason?: string): number {\n    const n = this.active.size;\n    for (const [id, rec] of this.active) {\n      rec.status = 'canceled';\n      rec.finishedAt = Date.now();\n      if (reason) rec.result = { canceled: true, reason };\n      this.completed.set(id, rec);\n      this.counters.canceled++;\n    }\n    this.active.clear();\n    this.trimCompleted();\n    return n;\n  }\n\n  get(executionId: string): ExecutionRecord | undefined {\n    return this.active.get(executionId) ?? this.completed.get(executionId);\n  }\n\n  isRunning(executionId: string): boolean {\n    return this.active.has(executionId);\n  }\n\n  stats(): { active: number; completed: number; duplicatesPrevented: number; replaysServed: number; canceled: number; registered: number } {\n    return {\n      active: this.active.size,\n      completed: this.completed.size,\n      duplicatesPrevented: this.counters.duplicatesPrevented,\n      replaysServed: this.counters.replaysServed,\n      canceled: this.counters.canceled,\n      registered: this.counters.registered,\n    };\n  }\n\n  private trimCompleted(): void {\n    while (this.completed.size > this.completedLimit) {\n      const oldest = this.completed.keys().next().value;\n      if (oldest === undefined) break;\n      this.completed.delete(oldest);\n      // Signature entries pointing at trimmed executions are dropped so a\n      // trimmed signature cannot serve a stale dedupe hit.\n      for (const [sig, id] of this.bySignature) {\n        if (id === oldest) this.bySignature.delete(sig);\n      }\n    }\n  }\n}"
  },
  "src/core/tool-dispatcher.ts": {
    "path": "src/core/tool-dispatcher.ts",
    "name": "tool-dispatcher.ts",
    "dir": "src/core",
    "lang": "typescript",
    "size": "7.1 KB",
    "lines": 199,
    "desc": "High-throughput tool execution dispatcher and error handler",
    "code": "// Concurrent & Safe Tool Dispatcher for Mochi VNext\n// Executes independent read-only inspection tools in parallel via Promise.allSettled\n// and runs mutating tools sequentially with instant diagnostic feedback.\n//\n// Master rebuild (Phase 3/4/5): every call now passes through the\n// ExecutionRegistry — identical requests inside the dedupe window execute ONCE,\n// completed executions replay their cached result by executionId, and an\n// already-aborted signal refuses to start any work.\n\nimport type { CapabilityRegistry } from './capability-registry.js';\nimport type { CapabilityContext, CapabilityExecutionResponse } from './capability.js';\nimport { diagnoseFile, renderDiagnostics } from '../observability/diagnostics.js';\nimport { ExecutionRegistry } from './execution-registry.js';\nimport { resolve } from 'node:path';\n\nexport interface ToolCallSpec {\n  id: string;\n  name: string;\n  arguments: Record<string, unknown>;\n}\n\nexport class ToolDispatcher {\n  private readonly executions: ExecutionRegistry;\n\n  constructor(private registry: CapabilityRegistry, executionRegistry?: ExecutionRegistry) {\n    this.executions = executionRegistry ?? new ExecutionRegistry();\n  }\n\n  /** Structured refusal for work that must not start (Phase 5). */\n  private canceledResponse(call: ToolCallSpec, reason: string): CapabilityExecutionResponse {\n    return {\n      callId: call.id,\n      name: call.name,\n      output: '',\n      error: `canceled: ${reason}`,\n      durationMs: 0,\n      truncated: false,\n      rawTokensEstimate: 0,\n      metadata: { canceled: true },\n    };\n  }\n\n  /** Response for a call recognized as a duplicate of in-flight/recent work. */\n  private duplicateResponse(call: ToolCallSpec, executionId: string, cached: unknown): CapabilityExecutionResponse {\n    if (cached && typeof cached === 'object' && 'output' in (cached as Record<string, unknown>)) {\n      const c = cached as CapabilityExecutionResponse;\n      return { ...c, callId: call.id, metadata: { ...c.metadata, duplicate: true, executionId } };\n    }\n    return {\n      callId: call.id,\n      name: call.name,\n      output: `[duplicate suppressed] identical ${call.name} request already dispatched (execution ${executionId}).`,\n      durationMs: 0,\n      truncated: false,\n      rawTokensEstimate: 0,\n      metadata: { duplicate: true, executionId },\n    };\n  }\n\n  /**\n   * Dispatch a batch of tool calls emitted by the model in a single turn.\n   * Read-only inspection tools run concurrently; mutating tools run sequentially.\n   * Duplicate suppression + idempotent replay are enforced BEFORE any side\n   * effect, and an aborted signal refuses to start or continue work.\n   */\n  async dispatchBatch(\n    calls: ToolCallSpec[],\n    context: CapabilityContext\n  ): Promise<CapabilityExecutionResponse[]> {\n    if (!calls.length) return [];\n\n    // Phase 5: refuse everything up front when cancellation already happened.\n    if (context.abortSignal?.aborted) {\n      return calls.map((c) => this.canceledResponse(c, 'abort signal already fired'));\n    }\n\n    // Register every call first: dedupe/replay decisions happen BEFORE any\n    // side effect, and identical calls within one batch collapse to one run.\n    const plan = calls.map((call) => {\n      const rec = this.executions.register({\n        toolName: call.name,\n        args: call.arguments,\n        executionId: call.id || undefined,\n      });\n      return { call, rec };\n    });\n\n    const results = new Map<string, CapabilityExecutionResponse>();\n    const toRun: Array<{ call: ToolCallSpec; executionId: string }> = [];\n\n    for (const { call, rec } of plan) {\n      if (rec.duplicate) {\n        results.set(call.id, this.duplicateResponse(call, rec.executionId, rec.result));\n        continue;\n      }\n      toRun.push({ call, executionId: rec.executionId });\n    }\n\n    const readOnly = toRun.filter(({ call }) => {\n      const cap = this.registry.get(call.name);\n      return cap ? cap.isReadOnly : false;\n    });\n    const mutating = toRun.filter(({ call }) => {\n      const cap = this.registry.get(call.name);\n      return !cap || !cap.isReadOnly;\n    });\n\n    // 1. Execute all read-only inspection tools concurrently\n    const readSettled = await Promise.allSettled(\n      readOnly.map(async ({ call, executionId }) => {\n        const res = await this.registry.execute(call.name, call.arguments, context, call.id);\n        this.executions.markCompleted(executionId, res);\n        return { call, res } as const;\n      }),\n    );\n    readSettled.forEach((s, idx) => {\n      const call = readOnly[idx].call;\n      if (s.status === 'fulfilled') {\n        results.set(call.id, s.value.res);\n      } else {\n        results.set(call.id, {\n          callId: call.id,\n          name: call.name,\n          output: '',\n          error: s.reason instanceof Error ? s.reason.message : String(s.reason),\n          durationMs: 0,\n          truncated: false,\n          rawTokensEstimate: 0,\n        });\n      }\n    });\n\n    // 2. Execute mutating tools sequentially with instant LSP diagnostics,\n    //    checking the abort signal before every side effect.\n    for (const { call, executionId } of mutating) {\n      if (context.abortSignal?.aborted) {\n        this.executions.markCanceled(executionId);\n        results.set(call.id, this.canceledResponse(call, 'abort signal fired mid-batch'));\n        continue;\n      }\n      let res;\n      try {\n        res = await this.registry.execute(call.name, call.arguments, context, call.id);\n      } catch (err) {\n        // A throwing tool must not escape the batch: mark the execution failed\n        // (so duplicate-suppression state doesn't stay in-flight) and continue\n        // with the remaining mutating calls.\n        res = {\n          callId: call.id,\n          name: call.name,\n          output: '',\n          error: err instanceof Error ? err.message : String(err),\n          durationMs: 0,\n          truncated: false,\n          rawTokensEstimate: 0,\n        };\n        this.executions.markFailed(executionId, res);\n        results.set(call.id, res);\n        continue;\n      }\n      this.executions.markCompleted(executionId, res);\n\n      // Instant post-edit diagnostic collection\n      let diagNote = '';\n      if (['write', 'edit', 'patch'].includes(call.name) && !res.error) {\n        const targetPath = String(call.arguments.path ?? '');\n        if (targetPath && /\\.(ts|tsx|js|jsx|mts|cts|py|json|go)$/i.test(targetPath)) {\n          try {\n            const diags = await diagnoseFile(resolve(context.cwd, targetPath), context.cwd);\n            if (!diags.ok && (diags.errors.length > 0 || diags.warnings.length > 0)) {\n              diagNote = renderDiagnostics([diags]);\n            }\n          } catch {}\n        }\n      }\n\n      results.set(call.id, {\n        ...res,\n        output: res.output + (diagNote ? `\\n${diagNote}` : ''),\n      });\n\n      // Halt execution on fatal permission or write failure\n      if (res.error && res.error.includes('Permission denied')) {\n        break;\n      }\n    }\n\n    // Return all responses in original tool call sequence\n    return calls.map((c) => results.get(c.id) ?? {\n      callId: c.id,\n      name: c.name,\n      output: '',\n      error: 'Tool execution skipped due to prior failure.',\n      durationMs: 0,\n      truncated: false,\n      rawTokensEstimate: 0,\n    });\n  }\n}\n"
  },
  "src/tui/tabs.ts": {
    "path": "src/tui/tabs.ts",
    "name": "tabs.ts",
    "dir": "src/tui",
    "lang": "typescript",
    "size": "9.1 KB",
    "lines": 247,
    "desc": "Multi-tab concurrent session manager & pill tab geometry",
    "code": "// Multi-tab session manager (opencode-style): several isolated agent\n// sessions live in ONE terminal. Each tab owns its title, runtime session,\n// unread badge, and busy flag; transcripts/state objects are owned by the\n// TUI layer keyed by tab id. This module is pure (no terminal, no runtime)\n// so every rule below is unit-tested.\nexport interface TabInfo {\n  id: string;\n  title: string;\n  /** 1-based position for Alt+1..9 display. */\n  index: number;\n  busy: boolean;\n  unread: number;\n  createdAt: number;\n  lastActiveAt: number;\n}\n\n/** Hard cap: more parallel agent sessions than this melts small boxes. */\nexport const MAX_TABS = 8;\n\nlet tabSeq = 0;\n\nexport function defaultTabTitle(n: number): string {\n  return n <= 1 ? 'New session' : `New session ${n}`;\n}\n/** Slug a tab title from the user's first prompt (24 cols, no newlines). */\nexport function slugTitle(prompt: string): string {\n  const s = prompt.replace(/^\\/\\w+\\s*/, '').trim().split('\\n')[0].slice(0, 24).trim();\n  return s || 'untitled';\n}\n\nexport class TabManager {\n  private tabs: TabInfo[] = [];\n  private active = 0;\n  private counter = 0;\n\n  constructor() {\n    this.create(defaultTabTitle(1));\n  }\n\n  list(): TabInfo[] {\n    return this.tabs.map((t, i) => ({ ...t, index: i + 1 }));\n  }\n\n  activeTab(): TabInfo {\n    return { ...this.tabs[this.active], index: this.active + 1 };\n  }\n\n  activeIndex(): number {\n    return this.active;\n  }\n\n  count(): number {\n    return this.tabs.length;\n  }\n\n  get(id: string): TabInfo | undefined {\n    const i = this.tabs.findIndex((t) => t.id === id);\n    return i < 0 ? undefined : { ...this.tabs[i], index: i + 1 };\n  }\n\n  create(title?: string): TabInfo {\n    if (this.tabs.length >= MAX_TABS) {\n      throw new Error(`Tab limit reached (${MAX_TABS}). Close one with Alt+W or /tab close first.`);\n    }\n    this.counter++;\n    const now = Date.now();\n    const tab: TabInfo = {\n      id: `tab-${now.toString(36)}-${tabSeq++}`,\n      title: title?.trim() || defaultTabTitle(this.counter),\n      index: this.tabs.length + 1,\n      busy: false,\n      unread: 0,\n      createdAt: now,\n      lastActiveAt: now,\n    };\n    this.tabs.push(tab);\n    this.active = this.tabs.length - 1;\n    return { ...tab };\n  }\n\n  /** Close by id or 0-based index. Never drops the last tab: closing it\n   *  resets it to a fresh default instead. Returns the new active tab. */\n  close(idOrIndex: string | number): TabInfo {\n    const i = typeof idOrIndex === 'number' ? idOrIndex : this.tabs.findIndex((t) => t.id === idOrIndex);\n    if (i < 0 || i >= this.tabs.length) throw new Error('No such tab.');\n    if (this.tabs.length === 1) {\n      const now = Date.now();\n      this.counter++;\n      this.tabs[0] = { ...this.tabs[0], title: defaultTabTitle(this.counter), busy: false, unread: 0, createdAt: now, lastActiveAt: now };\n      this.active = 0;\n      return this.activeTab();\n    }\n    this.tabs.splice(i, 1);\n    if (this.active >= this.tabs.length) this.active = this.tabs.length - 1;\n    else if (this.active > i) this.active--;\n    this.tabs[this.active].lastActiveAt = Date.now();\n    return this.activeTab();\n  }\n\n  switchTo(index: number): TabInfo {\n    if (index < 0 || index >= this.tabs.length) throw new Error(`Tab ${index + 1} does not exist (${this.tabs.length} open).`);\n    this.active = index;\n    this.tabs[index].unread = 0;\n    this.tabs[index].lastActiveAt = Date.now();\n    return this.activeTab();\n  }\n\n  switchToId(id: string): TabInfo {\n    const i = this.tabs.findIndex((t) => t.id === id);\n    if (i < 0) throw new Error('No such tab.');\n    return this.switchTo(i);\n  }\n\n  next(): TabInfo {\n    return this.switchTo((this.active + 1) % this.tabs.length);\n  }\n\n  prev(): TabInfo {\n    return this.switchTo((this.active - 1 + this.tabs.length) % this.tabs.length);\n  }\n\n  rename(id: string, title: string): TabInfo {\n    const t = this.tabs.find((x) => x.id === id);\n    if (!t) throw new Error('No such tab.');\n    const clean = title.trim().slice(0, 32);\n    if (!clean) throw new Error('Title must not be empty.');\n    t.title = clean;\n    return { ...t, index: this.tabs.indexOf(t) + 1 };\n  }\n\n  /** Auto-title a default-named tab from the first user prompt (once). */\n  autoTitle(id: string, prompt: string): boolean {\n    const t = this.tabs.find((x) => x.id === id);\n    if (!t || !/^(tab \\d+|New session( \\d+)?)$/.test(t.title)) return false;\n    t.title = slugTitle(prompt);\n    return true;\n  }\n\n  setBusy(id: string, busy: boolean): void {\n    const t = this.tabs.find((x) => x.id === id);\n    if (t) t.busy = busy;\n  }\n\n  /** A background tab produced output: badge it (active tab clears on view). */\n  markUnread(id: string): void {\n    const t = this.tabs.find((x) => x.id === id);\n    if (t && this.tabs[this.active].id !== id && t.unread < 99) t.unread++;\n  }\n\n  clearUnread(id: string): void {\n    const t = this.tabs.find((x) => x.id === id);\n    if (t) t.unread = 0;\n  }\n}\n\n// ---- Clickable tab-bar layout (opencode-style `+` button) ------------------\n// Pure column math so mouse hit-testing matches the rendered row EXACTLY:\n// the renderer styles these plain cells (ANSI = zero-width) and joins them\n// with single spaces, so columns below are the source of truth for clicks.\n// Widths are TERMINAL CELLS (CJK titles count 2), via wrap.ts.\n\nimport { visibleCells, sliceCells } from './wrap.js';\n\nexport interface TabBarCell {\n  /** Tab id, or null for the `+ New session` button. */\n  tabId: string | null;\n  /** Plain (unstyled) cell text; width = visibleCells(plain) in cells.\n   *  opencode-style pills: ` {title}{dots} ` — the renderer fills the\n   *  active pill with a surface bg, idle pills stay dim text. */\n  plain: string;\n  /** 0-based index into tabs.list(), -1 for `+`. */\n  tabIndex: number;\n  /** Structured parts (renderer colors these; plain === ' '+title+unread+busy+' '). */\n  title: string;\n  unread: string;\n  busy: string;\n}\n\nexport interface TabBarLayout {\n  cells: TabBarCell[];\n  /** 0-based [start, end) column range per cell (parallel to cells). */\n  ranges: Array<[number, number]>;\n  /** Whether the key-hint suffix fits after the cells. */\n  showHint: boolean;\n  /** 0-based [start, end) column range of the `+` button (always present). */\n  plusRange: [number, number];\n  /** Total plain width including separators (excludes hint). */\n  width: number;\n}\n\n/** Plain key-hint suffix (styled by the renderer; measured here). */\nexport const TAB_HINT_PLAIN = 'Alt+T new · Alt+W close · Alt+1-8 switch';\n\n/** Build the tab-bar cells for a terminal width, truncating titles only as\n *  much as needed so bar + `+ New session` ALWAYS fit (no ellipsize-and-guess).\n *  Active-vs-idle styling is the renderer's job (it knows the active id);\n *  columns here are identical for both, so hit-testing stays exact. */\nexport function tabBarCells(list: TabInfo[], _activeId: string, maxWidth: number): TabBarLayout {\n  const w = Math.max(8, maxWidth);\n  const unreadOf = (t: TabInfo) => (t.unread > 0 ? ' •' : '');\n  // Pill per tab: ` ` + title + unread-dot + busy-dot + ` `, badges\n  // space-separated (` api • ● `) — dots jammed on text read as typos.\n  // Fixed overhead = 1 + unread + busy + 1.\n  const fixedOf = (t: TabInfo) => 1 + unreadOf(t).length + (t.busy ? 2 : 0) + 1;\n  // Fair-share title budget: shrink only titles that exceed it.\n  const fixedSum = list.reduce((n, t) => n + fixedOf(t), 0);\n  // Cells tile with NO separators: each tab cell carries its own symmetric\n  // padding (` {title}{dots} `) and the `+` cell follows the last trailing\n  // space directly. The renderer joins with '' so columns match exactly.\n  const plusWidth = visibleCells('+ New session');\n  let titleBudget = Math.floor((w - plusWidth - fixedSum) / Math.max(1, list.length));\n  // Narrow terminals shrink titles to a bare '…' rather than overflowing:\n  // the bar + `+` must ALWAYS fit so clicks stay exact.\n  titleBudget = Math.max(1, titleBudget);\n  const cells: TabBarCell[] = list.map((t, i) => {\n    let title = t.title;\n    if (visibleCells(title) > titleBudget) title = sliceCells(title, Math.max(0, titleBudget - 1)).text + '…';\n    const unread = unreadOf(t);\n    const busy = t.busy ? ' ●' : '';\n    const plain = ` ${title}${unread}${busy} `;\n    return { tabId: t.id, plain, tabIndex: i, title, unread, busy };\n  });\n  cells.push({ tabId: null, plain: '+ New session', tabIndex: -1, title: '+ New session', unread: '', busy: '' });\n  const ranges: Array<[number, number]> = [];\n  let x = 0;\n  cells.forEach((c) => {\n    const cw = visibleCells(c.plain);\n    ranges.push([x, x + cw]);\n    x += cw;\n  });\n  const showHint = x + 1 + visibleCells(TAB_HINT_PLAIN) <= w;\n  return { cells, ranges, showHint, plusRange: ranges[ranges.length - 1], width: x };\n}\n\n/** Hit-test a 0-based column against a layout: tab index, 'plus', or null\n *  (separators, hint, and empty space are not clickable). */\nexport function tabBarHit(layout: TabBarLayout, col: number): { kind: 'tab'; index: number } | { kind: 'plus' } | null {\n  if (col < 0) return null;\n  for (let i = 0; i < layout.cells.length; i++) {\n    const [s, e] = layout.ranges[i];\n    if (col >= s && col < e) {\n      const c = layout.cells[i];\n      return c.tabId === null ? { kind: 'plus' } : { kind: 'tab', index: c.tabIndex };\n    }\n  }\n  return null;\n}\n"
  },
  "src/tui/view.ts": {
    "path": "src/tui/view.ts",
    "name": "view.ts",
    "dir": "src/tui",
    "lang": "typescript",
    "size": "53.7 KB",
    "lines": 1294,
    "desc": "Pure-black canvas terminal renderer with ANSI hygiene guards (showing view core)",
    "code": "// Cline/OpenCode-style view layer for the mochi TUI.\n//\n// Pure rendering functions (no I/O, no terminal) extracted so the look is\n// unit-testable: transcript entries (user/assistant/tool/system), the ❯\n// input bar with hairline rules, the three-row status bar (model + context\n// bar + tokens/cost | Plan/Act | git stats | auto-approve), the slash-command\n// autocomplete dropdown, and the braille thinking spinner.\n//\n// Two color surfaces are exported:\n//   T  — palette tokens (raw hex slots from the theme's colors{}). Used by\n//        generic surfaces: status bar, gradient bars, splash, autocomplete\n//        borders, and any place where the \"color harmony\" of the palette\n//        matters more than a specific role.\n//   R  — semantic role colors (assistantGutter, toolWriteName, etc.).\n//        Themes override these to genuinely change which color is used for\n//        which role, so two themes can have very different tool-name\n//        philosophies without sharing the same cyan/violet tokens.\n//\n// Both T and R are reassigned in place by setTheme() so callers can read\n// them without re-importing.\nimport type { LineKind } from './state.js';\nimport { wrap } from './wrap.js'; // visibleLen is local (line ~84)\n\nimport {\n  THEMES, getTheme, getAllThemes, getCurrentTheme, applyTheme, themeSwatch,\n  defaultRoleColors, resolveRoleColors, adaptThemeColors,\n  type MochiTheme, type RoleColors,\n} from './themes.js';\n\nexport {\n  THEMES, getTheme, getAllThemes, getCurrentTheme, applyTheme, themeSwatch,\n  defaultRoleColors, resolveRoleColors, adaptThemeColors,\n  type MochiTheme, type RoleColors,\n};\n\n// ---- Palette (customizable with 15 handcrafted themes) -------------------\nexport const T = {\n  reset: '\\x1b[0m',\n  bold: '\\x1b[1m',\n  dim: '\\x1b[2m',\n  italic: '\\x1b[3m',\n  underline: '\\x1b[4m',\n  ...adaptThemeColors(getCurrentTheme()).colors,\n};\n\n/** Semantic role colors. Initialized from the current theme and refreshed\n *  in place by setTheme(). Use R.assistantGutter, R.toolWriteName, etc.\n *  instead of hardcoded token names so themes can legitimately re-color\n *  roles. T.<token> stays available for generic surfaces that just want\n *  the palette. */\nexport const R: RoleColors = resolveRoleColors(adaptThemeColors(getCurrentTheme()));\n\n/** Switch active theme dynamically. Updates T (palette) AND R (role colors)\n *  in place so any code that has a reference to either sees the new theme\n *  immediately without re-importing. Paint-only: NEVER persists (persistence\n *  is an explicit user action via applyTheme — auto-persisting here once\n *  cemented a stale fallback over the user's real theme files). */\nexport function setTheme(themeId: string): MochiTheme {\n  const found = getTheme(themeId);\n  if (!found) return getCurrentTheme();\n  const t = adaptThemeColors(found);\n  Object.assign(T, t.colors);\n  Object.assign(R, resolveRoleColors(t));\n  return t;\n}\n\n/** Truecolor 24-bit fg helper. */\nexport function rgb(r: number, g: number, b: number): string {\n  return `\\x1b[38;2;${r};${g};${b}m`;\n}\n\n/** Interpolate two [r,g,b] colors; t in [0,1]. */\nexport function lerp(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {\n  const c = (x: number, y: number) => Math.round(x + (y - x) * t);\n  return [c(a[0], b[0]), c(a[1], b[1]), c(a[2], b[2])];\n}\n\nexport const RESULT = '⌿';\nexport const MAX_COLLAPSED_LINES = 5;\n/** Cline caps its home view at 60; chat transcript reads best near this. */\nexport const TRANSCRIPT_MAX_WIDTH = 100;\n\n// ---- Shared helpers --------------------------------------------------------\n// Cell-aware ANSI/width primitives live in wrap.ts (single source of truth —\n// CJK wide chars count 2 cells, emoji 2, combining marks 0, full CSI stripped).\nimport { stripAnsi, visibleLen, visibleCells, cellWidth, sliceCells } from './wrap.js';\nexport { stripAnsi, visibleLen, visibleCells, cellWidth, sliceCells };\n\n/** Truncate with ellipsis on a visible-cell budget, preserving ANSI color codes\n *  and never splitting a surrogate pair or wide character. */\nexport function ellipsize(s: string, max: number): string {\n  if (visibleLen(s) <= max) return s;\n  return sliceCells(s, Math.max(0, max - 1)).text + '\\x1b[0m…';\n}\n\nexport function padEnd(s: string, n: number): string {\n  const vis = visibleLen(s);\n  if (vis >= n) return ellipsize(s, n);\n  return s + ' '.repeat(n - vis);\n}\n\n// ---- Thinking spinner ------------------------------------------------------\n// Layered animation: a braille cycle for motion + a sweeping color gradient\n// (violet → cyan → lime) so the spinner feels alive instead of a gray dot.\nconst DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];\nconst SPIN_COLORS: Array<[number, number, number]> = [\n  [199, 146, 234], // violet\n  [121, 184, 255], // act blue\n  [86, 212, 221],  // cyan\n  [163, 230, 53],  // lime\n];\n\nexport function spinnerFrame(i: number): string {\n  return DOTS[Math.abs(i) % DOTS.length];\n}\n\nexport function spinnerColored(i: number): string {\n  const dot = spinnerFrame(i);\n  const c = SPIN_COLORS[Math.abs(i) % SPIN_COLORS.length];\n  return `${rgb(c[0], c[1], c[2])}${T.bold}${dot}${T.reset}`;\n}\n\n/** Animated gradient underline that sweeps under the thinking note. */\nexport function spinnerSweep(i: number, width = 18): string {\n  const pos = Math.abs(i) % width;\n  const cells: string[] = [];\n  for (let x = 0; x < width; x++) {\n    const dist = Math.abs(x - pos);\n    if (dist > 2) { cells.push(`${T.grayDark}·${T.reset}`); continue; }\n    const t = 1 - dist / 2; // 0..1 peak at the sweep head\n    const c = lerp([72, 79, 86], [86, 212, 221], t);\n    cells.push(`${rgb(c[0], c[1], c[2])}━${T.reset}`);\n  }\n  return cells.join('');\n}\n\nexport function thinkingLine(frame: number, note = ''): string {\n  const note_ = note ? ` ${T.orange}${note}${T.reset}` : '';\n  return `${spinnerColored(frame)} ${R.thinkingLabel}Thinking…${T.reset} ${spinnerSweep(frame, 8)}${note_} ${T.grayDark}(esc to cancel)${T.reset}`;\n}\n\n/** Empty-track color for gauge bars: near-black fixed RGB, deliberately NOT a\n *  theme token. Theme grayDark renders as a VISIBLE gray bar (12+10+6 gray\n *  blocks at idle) — the \"grey bars\" defect. This fixed dim track reads as\n *  empty on black canvases and as a subtle rail on light ones. */\nconst TRACK = '\\x1b[38;2;58;54;70m';\n\n// ---- jcode-style animated context + cache bars ----------------------------\nexport interface GradientBar {\n  text: string;\n  pct: number;\n}\n\nconst CTX_STOPS: Array<[number, number, number]> = [\n  [163, 230, 53],  // lime — plenty of room\n  [86, 212, 221],  // cyan\n  [255, 234, 127], // yellow\n  [255, 158, 100], // orange\n  [248, 81, 73],   // red — nearly full\n];\n\nfunction rampColor(pct: number): [number, number, number] {\n  const clamped = Math.max(0, Math.min(1, pct));\n  const scaled = clamped * (CTX_STOPS.length - 1);\n  const idx = Math.min(CTX_STOPS.length - 2, Math.floor(scaled));\n  return lerp(CTX_STOPS[idx], CTX_STOPS[idx + 1], scaled - idx);\n}\n\n/**\n * Animated gradient context bar (jcode-style): each filled cell gets the\n * gradient ramp color for its position; an animated glow head tracks `tick`\n * so the bar shimmers while active.\n */\nexport function gradientContextBar(used: number, total: number | undefined, width = 12, tick = 0): GradientBar {\n  const w = Math.max(0, Math.floor(width));\n  const pct = total && total > 0 ? Math.min(used / total, 1) : 0;\n  const filled = total && total > 0 && used > 0 ? Math.max(1, Math.round(pct * w)) : 0;\n  const cells: string[] = [];\n  for (let x = 0; x < w; x++) {\n    if (x < filled) {\n      const frac = w > 1 ? x / (w - 1) : 1;\n      const c = rampColor(frac);\n      const isHead = tick > 0 && x === (tick - 1) % Math.max(1, filled);\n      cells.push(isHead\n        ? `${T.bold}${rgb(255, 255, 255)}█${T.reset}`\n        : `${rgb(c[0], c[1], c[2])}█${T.reset}`);\n    } else {\n      cells.push(`${TRACK}░${T.reset}`);\n    }\n  }\n  return { text: cells.join(''), pct };\n}\n\n/** Cache-hit bar: lime gradient + live percentage, animated shimmer head. */\nexport function gradientCacheBar(hitRate: number, width = 10, tick = 0): GradientBar {\n  const w = Math.max(0, Math.floor(width));\n  const pct = Math.max(0, Math.min(1, hitRate));\n  const filled = Math.round(pct * w);\n  const cells: string[] = [];\n  for (let x = 0; x < w; x++) {\n    if (x < filled) {\n      const frac = w > 1 ? x / (w - 1) : 1;\n      const c = lerp([74, 222, 128], [163, 230, 53], frac);\n      const isHead = tick > 0 && x === (tick - 1) % Math.max(1, filled);\n      cells.push(isHead\n        ? `${T.bold}${rgb(220, 255, 200)}▪${T.reset}`\n        : `${rgb(c[0], c[1], c[2])}▪${T.reset}`);\n    } else {\n      cells.push(`${TRACK}▪${T.reset}`);\n    }\n  }\n  return { text: cells.join(''), pct };\n}\n\n// ---- Context bar (Cline createContextBar) ----------------------------------\nexport interface ContextBar {\n  filled: string;\n  empty: string;\n  pct: number;\n}\n\nexport function contextBar(used: number, total: number | undefined, width = 6): ContextBar {\n  const w = Math.max(0, Math.floor(width));\n  const ratio = total && total > 0 ? Math.min(used / total, 1) : 0;\n  const filledCount =\n    total && total > 0 && used > 0\n      ? used >= total\n        ? w\n        : Math.min(Math.max(1, Math.ceil(ratio * w)), Math.max(0, w - 1))\n      : 0;\n  return {\n    filled: '█'.repeat(filledCount),\n    empty: '█'.repeat(Math.max(0, w - filledCount)),\n    pct: ratio,\n  };\n}\n\nexport function formatCost(cost: number): string {\n  if (cost === 0) return '$0.00';\n  if (cost < 0.01) return `$${cost.toFixed(4)}`;\n  return `$${cost.toFixed(2)}`;\n}\n\n/** Cline formatStatusBarUsageText: \"(12,345) $0.42\" */\nexport function usageText(totalTokens: number, totalCost: number): string {\n  const tokens = `(${totalTokens.toLocaleString()})`;\n  return `${tokens} ${formatCost(totalCost)}`;\n}\n\n// ---- Status bar (three Cline rows) -----------------------------------------\nexport interface StatusBarModel {\n  modelId: string;\n  totalTokens: number;\n  totalCost: number;\n  maxInputTokens?: number;\n  /** plan/act mode */\n  mode: 'plan' | 'act';\n  /** active execution mode (normal/spec/security/codemod/chaos) */\n  agentMode?: string;\n  /** active reasoning effort (low/medium/high/max) */\n  reasoningLevel?: string;\n  workspaceName: string;\n  gitBranch: string | null;\n  gitDiff: { files: number; additions: number; deletions: number } | null;\n  autoApprove: boolean;\n  /** extra mochi badges: kv-cache, queued tasks */\n  extra?: string[];\n}\n\nfunction modeColor(mode: string): string {\n  switch (mode) {\n    case 'spec':\n      return T.plan;\n    case 'security':\n      return T.error;\n    case 'codemod':\n      return T.violet;\n    case 'chaos':\n      return T.warning;\n    default:\n\n// ... [File continues on GitHub repository] ..."
  },
  "src/tui/themes.ts": {
    "path": "src/tui/themes.ts",
    "name": "themes.ts",
    "dir": "src/tui",
    "lang": "typescript",
    "size": "49.4 KB",
    "lines": 1322,
    "desc": "22 signature terminal themes including Mochi Purple and Cyber Void (showing themes core)",
    "code": "// 20 unique, handcrafted color themes for Mochi TUI.\n// Each theme provides distinct foregrounds, accents, rule borders,\n// background highlights, and splash gradient stops.\n//\n// Color strategy (two layers):\n//   1. PALETTE TOKENS — the raw hex slots (act, plan, error, pink, cyan, ...).\n//      Themes assign values; used by generic surfaces (status bar, gradient\n//      bars, splash, autocomplete borders) where only \"do these harmonize\"\n//      matters.\n//   2. ROLE COLORS — semantic roles (assistantGutter, toolWriteName, ...).\n//      Defaults are derived from palette tokens so themes that only customize\n//      the palette still look correct. Themes can OPTIONALLY provide a\n//      `roleColors` override to remap roles to specific hex values when the\n//      palette alone doesn't produce the look they want (e.g. Tokyo Night\n//      wants tool names to be yellow, not the default cyan). This is what\n//      makes each theme genuinely distinct rather than the same rainbow.\n\nimport { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';\nimport { resolve, dirname } from 'node:path';\nimport { homedir } from 'node:os';\n\nexport interface ThemeColors {\n  act: string;\n  plan: string;\n  success: string;\n  error: string;\n  warning: string;\n  gray: string;\n  grayDark: string;\n  fg: string;\n  bgUser: string;\n  rule: string;\n  pink: string;\n  magenta: string;\n  violet: string;\n  cyan: string;\n  lime: string;\n  orange: string;\n  teal: string;\n}\n\n/** Semantic role colors. Each role is the visual marker for one logical\n *  thing in the UI (a transcript line kind, a code token class, a tool verb\n *  group, a chrome element). Themes MAY provide a partial override — any\n *  field left undefined falls back to a sensible palette-token default. */\nexport interface RoleColors {\n  // Transcript gutter markers\n  assistantGutter: string;     // ▌ on every assistant line  (default: cyan)\n  assistantText: string;       // assistant body text color  (default: fg)\n  toolMarker: string;          // ▷ on tool lines            (default: lime)\n  userGutter: string;          // ❯ on user lines            (default: magenta)\n  userFg: string;              // user message text color    (default: fg)\n  userBg: string;              // user message bg highlight  (default: bgUser)\n  thoughtGutter: string;       // ◇ on thought lines         (default: grayDark)\n  thoughtText: string;         // thought body text color    (default: gray)\n  errorMark: string;           // ! on error lines           (default: error)\n  errorText: string;           // error body text color      (default: error)\n  systemMark: string;          // ◆ on system lines          (default: grayDark)\n  systemText: string;          // system body text color     (default: gray)\n  taskMark: string;            // ★ on task lines            (default: cyan)\n  taskText: string;            // task body text color       (default: fg)\n  goalMark: string;            // ◉ on goal lines            (default: pink)\n  goalText: string;            // goal body text color       (default: fg)\n\n  // Code syntax highlight (markdown code fences + shell output)\n  codeKeyword: string;         // const/let/return/if/...     (default: magenta)\n  codeString: string;          // string literals             (default: lime)\n  codeNumber: string;          // numbers, true/false/null    (default: orange)\n  codeComment: string;         // // and /* */ comments       (default: gray)\n  codePunct: string;           // ; , { } ( ) brackets        (default: teal)\n  codeType: string;            // type names / capitalized    (default: violet)\n  codeFn: string;              // function names              (default: cyan)\n\n  // Markdown\n  mdHeading: string;           // # ## ### prefix color       (default: pink)\n  mdBold: string;              // **bold**                    (default: fg)\n  mdItalic: string;            // *italic*                    (default: fg)\n  mdLink: string;              // [text](url)                 (default: cyan)\n\n  // Chrome / chrome-adjacent\n  thinkingLabel: string;       // \"Thinking…\" word            (default: cyan)\n  reasoningBadge: string;      // [REASON: HIGH] badge        (default: cyan)\n  reasonBadge: { low: string; medium: string; high: string; max: string };\n  toolWriteName: string;       // write/edit/delete/patch     (default: violet)\n  toolReadName: string;        // read/search/glob/...        (default: cyan)\n  toolShellName: string;       // shell/git                   (default: orange)\n  toolTestName: string;        // test/verify                 (default: lime)\n  toolGenericName: string;     // default fallback            (default: violet)\n\n  // Context bar / progress (overrides gradient when set)\n  contextLow: string;          // 0–60% usage                 (default: lime)\n  contextMid: string;          // 60–85%                      (default: orange)\n  contextHigh: string;         // 85%+                        (default: error)\n}\n\nexport interface MochiTheme {\n  id: string;\n  name: string;\n  description: string;\n  colors: ThemeColors;\n  /** Optional per-role override. Any field undefined falls back to a\n   *  sensible palette-token default so themes can opt-in to fine control. */\n  roleColors?: Partial<RoleColors>;\n  splashStops: Array<[number, number, number]>;\n}\n\n/** Nearest xterm-256 index for an RGB triple. */\nfunction rgbTo256(r: number, g: number, b: number): number {\n  const cube = (v: number) => (v < 48 ? 0 : v < 115 ? 1 : Math.min(5, Math.round((v - 35) / 40)));\n  const cr = cube(r), cg = cube(g), cb = cube(b);\n  const cubeIdx = 16 + 36 * cr + 6 * cg + cb;\n  const gray = Math.round((r + g + b) / 3);\n  const grayIdx = gray < 8 ? 16 : gray > 248 ? 231 : Math.round((gray - 8) / 247 * 24) + 232;\n  const cubeRgb = (i: number): [number, number, number] => {\n    const c = Math.floor((i - 16) / 36), rem = (i - 16) % 36;\n    const g2 = Math.floor(rem / 6), b2 = rem % 6;\n    const comp = (x: number) => x === 0 ? 0 : x === 1 ? 95 : 95 + 40 * (x - 1);\n    return [comp(c), comp(g2), comp(b2)];\n  };\n  const dist = (a: [number, number, number]) => (a[0]-r)**2 + (a[1]-g)**2 + (a[2]-b)**2;\n  const cubeDist = dist(cubeRgb(cubeIdx));\n  const grayDist = (gray - r)**2 + (gray - g)**2 + (gray - b)**2;\n  return grayDist < cubeDist ? grayIdx : cubeIdx;\n}\n\n/** Parse the first `38;2;r;g;b` (fg) or `48;2;r;g;b` (bg) triple out of an\n *  ANSI color string. Returns null when the string carries no truecolor code\n *  (256-color downgraded themes, empty NO_COLOR strings). */\nexport function parseThemeRgb(s: string, code: 38 | 48): [number, number, number] | null {\n  const m = s.match(new RegExp(`\\\\x1b\\\\[${code};2;(\\\\d+);(\\\\d+);(\\\\d+)m`));\n  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;\n}\n\nfunction relativeLuminance([r, g, b]: [number, number, number]): number {\n  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };\n  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);\n}\n\n/** True for dark-background themes (light text on dark surface),\n *  decided by comparing fg vs bg luminance — no per-theme flag to drift.\n *  The TUI forces a pure-black canvas behind dark themes (opencode parity);\n *  light themes stay transparent so the terminal background shows. */\nexport function themeIsDark(t: MochiTheme): boolean {\n  const fg = parseThemeRgb(t.colors.fg, 38);\n  const bg = parseThemeRgb(t.colors.bgUser, 48) ?? parseThemeRgb(t.colors.bgUser, 38);\n  if (!fg || !bg) return true;\n  return relativeLuminance(fg) > relativeLuminance(bg);\n}\n\n/** WCAG contrast ratio of a theme's body text (fg) on the user-message\n *  surface (bgUser). Null when either side isn't truecolor-parseable. */\nexport function themeContrastRatio(t: MochiTheme): number | null {\n  const fg = parseThemeRgb(t.colors.fg, 38);\n  const bg = parseThemeRgb(t.colors.bgUser, 48) ?? parseThemeRgb(t.colors.bgUser, 38);\n  if (!fg || !bg) return null;\n  const x = relativeLuminance(fg), y = relativeLuminance(bg);\n  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);\n}\n\n/** Rewrite a color string's 24-bit codes as 256-color codes. */\nfunction downgradeColorCodes(s: string): string {\n  return s.replace(/\\x1b\\[38;2;(\\d+);(\\d+);(\\d+)m/g, (_m, r: string, g: string, b: string) =>\n    `\\x1b[38;5;${rgbTo256(Number(r), Number(g), Number(b))}m`);\n}\n\n/** Canvas background escape for the TUI frame writer (opencode parity):\n *  dark themes paint every row over explicit black so the terminal profile\n *  color can never show through. Truecolor terminals get 24-bit black;\n *  256-color terminals get palette black (16) — 24-bit codes degrade\n *  unpredictably there (gray tint / garbage cells). Dumb terminals,\n *  NO_COLOR, and light themes stay fully transparent. */\nexport function canvasBg(): string {\n  if (honorsNoColor()) return '';\n  if ((process.env.TERM ?? '').toLowerCase() === 'dumb') return '';\n  if (!themeIsDark(getCurrentTheme())) return '';\n  return supportsTruecolor() ? '\\x1b[48;2;0;0;0m' : '\\x1b[48;5;16m';\n}\n\n/** True when the terminal advertises 24-bit color support. */\nexport function supportsTruecolor(): boolean {\n  const ct = (process.env.COLORTERM ?? '').toLowerCase();\n  if (ct.includes('truecolor') || ct.includes('24bit')) return true;\n  const term = (process.env.TERM ?? '').toLowerCase();\n  return term.includes('truecolor') || term.includes('24bit');\n}\n\n/** True when the user asked for no color (NO_COLOR convention:\n *  https://no-color.org — presence and non-emptiness of NO_COLOR means off). */\nexport function honorsNoColor(): boolean {\n  const v = process.env.NO_COLOR;\n  return v !== undefined && v !== '' && v !== '0';\n}\n\n/** True when animation should be stilled: reduced-motion request or dumb terminal. */\nexport function prefersReducedMotion(): boolean {\n  const rm = (process.env.MOCHI_REDUCED_MOTION ?? '').toLowerCase();\n  if (rm === '1' || rm === 'true' || rm === 'yes') return true;\n  if (honorsNoColor()) return true;\n  return (process.env.TERM ?? '').toLowerCase() === 'dumb';\n}\n\n/** Strip every ANSI color sequence from a theme (NO_COLOR): text stays\n *  fully readable, layout/contrast unchanged, zero escape bytes emitted. */\nexport function stripThemeColors(t: MochiTheme): MochiTheme {\n  const blank = (obj: Record<string, unknown>) => Object.fromEntries(\n    Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? '' : v]),\n  );\n  return {\n    ...t,\n    colors: blank(t.colors as unknown as Record<string, unknown>) as unknown as ThemeColors,\n    roleColors: t.roleColors\n      ? (blank(t.roleColors as unknown as Record<string, unknown>) as Partial<RoleColors>)\n      : undefined,\n  };\n}\n\n/** Downgrade all theme colors to xterm-256 when the terminal lacks truecolor\n *  support so semantic colors still render instead of being stripped/ignored.\n *  Honors NO_COLOR first (no escape bytes at all). */\nexport function adaptThemeColors(t: MochiTheme): MochiTheme {\n  if (honorsNoColor()) return stripThemeColors(t);\n  if (supportsTruecolor()) return t;\n  const downgradeEntries = (obj: Record<string, unknown>) => Object.fromEntries(\n    Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? downgradeColorCodes(v) : v]),\n  );\n  return {\n    ...t,\n    colors: downgradeEntries(t.colors as unknown as Record<string, unknown>) as unknown as ThemeColors,\n    roleColors: t.roleColors\n      ? (downgradeEntries(t.roleColors as unknown as Record<string, unknown>) as Partial<RoleColors>)\n      : undefined,\n  };\n}\n\nexport const THEMES: MochiTheme[] = [\n  {\n    id: 'cyber-void',\n    name: 'Cyber Void',\n    description: 'Deep neon void — electric cyan, hot pink, lime; the default mochi look',\n    colors: {\n      act: '\\x1b[38;2;0;255;255m',\n      plan: '\\x1b[38;2;255;255;0m',\n      success: '\\x1b[38;2;57;255;20m',\n      error: '\\x1b[38;2;255;0;127m',\n      warning: '\\x1b[38;2;255;105;180m',\n      gray: '\\x1b[38;2;150;150;165m',\n      grayDark: '\\x1b[38;2;110;110;125m',\n      fg: '\\x1b[38;2;230;230;250m',\n      bgUser: '\\x1b[48;2;15;5;30m',\n      rule: '\\x1b[38;2;255;0;255m',\n      pink: '\\x1b[38;2;255;20;147m',\n      magenta: '\\x1b[38;2;255;0;255m',\n      violet: '\\x1b[38;2;138;43;226m',\n      cyan: '\\x1b[38;2;0;255;255m',\n      lime: '\\x1b[38;2;57;255;20m',\n      orange: '\\x1b[38;2;255;69;0m',\n      teal: '\\x1b[38;2;0;128;128m',\n    },\n    roleColors: {\n      assistantGutter: '\\x1b[38;2;0;255;255m',\n      toolMarker: '\\x1b[38;2;191;255;0m',\n      toolWriteName: '\\x1b[38;2;255;20;147m',\n      toolTestName: '\\x1b[38;2;191;255;0m',\n      mdHeading: '\\x1b[38;2;255;0;255m',\n    },\n    splashStops: [\n      [0, 255, 255], [255, 0, 255], [57, 255, 20], [255, 20, 147], [138, 43, 226],\n    ],\n  },\n  {\n    id: 'vaporwave',\n    name: 'Vaporwave',\n    description: '80s sunset — teal, magenta, peach, lavender, soft cream',\n    colors: {\n      act: '\\x1b[38;2;0;255;204m',\n      plan: '\\x1b[38;2;255;182;193m',\n      success: '\\x1b[38;2;152;251;152m',\n      error: '\\x1b[38;2;255;105;180m',\n      warning: '\\x1b[38;2;255;160;122m',\n      gray: '\\x1b[38;2;180;170;200m',\n\n// ... [File continues on GitHub repository] ..."
  },
  "src/tui/chrome.ts": {
    "path": "src/tui/chrome.ts",
    "name": "chrome.ts",
    "dir": "src/tui",
    "lang": "typescript",
    "size": "2.1 KB",
    "lines": 48,
    "desc": "Unified terminal frame layout geometry and cell calculations",
    "code": "// Shared terminal-chrome geometry: the SINGLE source of truth for how rows\n// are divided between the tab bar, transcript, busy line, composer, status\n// bars, and the auto-approve row. renderFrame, transcriptGeometry (selection\n// math), and the autocomplete dropdown MUST all use this — three hand-rolled\n// copies drifted before (4:3 vs 3:2 vs a third variant), desyncing selection\n// and smearing dropdowns over the transcript on short terminals.\nimport { wrap } from './wrap.js';\n\nexport interface ChromeLayout {\n  /** Tab-bar rows pinned at the top (0 when tabs hidden, normally 1). */\n  topRows: number;\n  statusRows: number;\n  composerRows: number;\n  bottomRows: number;\n  /** Transcript content height (excludes chrome). */\n  contentH: number;\n  /** Transcript message width at this terminal width. */\n  chatMw: number;\n  /** Visible transcript rows (minus the busy line when running). */\n  availableH: number;\n}\n\nexport function chromeLayout(opts: {\n  w: number;\n  h: number;\n  /** Current composer text (drives composer growth). */\n  inputText: string;\n  busy: boolean;\n  topRows?: number;\n  indent?: number;\n}): ChromeLayout {\n  const { w, h, inputText, busy } = opts;\n  const topRows = opts.topRows ?? 0;\n  const statusRows = h >= 20 ? 3 : 2;\n  const innerW = Math.max(1, w - 6);\n  const rawRows = inputText ? wrap(inputText, innerW) : [''];\n  // Composer expands as the user types, up to 1/3 of screen height.\n  // In short windowed mode (h < 24) use 3 rows for single-line input, 4 for multiline.\n  const minComposer = h < 24 ? (rawRows.length > 1 ? 4 : 3) : 4;\n  const composerRows = Math.min(Math.max(minComposer, Math.floor(h / 3)), rawRows.length + 2);\n  // Bottom consists of composer, status bars, and the auto-approve row.\n  const bottomRows = composerRows + statusRows + 1;\n  const contentH = Math.max(1, h - bottomRows - topRows);\n  const indent = opts.indent ?? 2;\n  const chatMw = Math.min(w - indent * 2, Math.max(24, w - 4));\n  const availableH = busy ? Math.max(1, contentH - 1) : contentH;\n  return { topRows, statusRows, composerRows, bottomRows, contentH, chatMw, availableH };\n}\n"
  },
  "src/tui/ansi-hygiene.ts": {
    "path": "src/tui/ansi-hygiene.ts",
    "name": "ansi-hygiene.ts",
    "dir": "src/tui",
    "lang": "typescript",
    "size": "3.9 KB",
    "lines": 82,
    "desc": "SGR escape sequence terminator preventing background gray leaks",
    "code": '// ANSI hygiene helpers (shared).\n//\n// Two failure classes this fixes:\n//  1. Colored tool output (npm/git --color=always) enters the MODEL CONTEXT\n//     with raw escape codes; the model then parrots broken fragments of them\n//     into its prose ("138;43,226m", "250m" — payload of a 38;2;r;g;b SGR\n//     whose ESC byte was lost).\n//  2. Stream chunk boundaries split a sequence mid-flight: one chunk ends\n//     "\\x1b[38;2;1", the next starts "38;43;226m". The leading ESC+CSI never\n//     reassembles, so every "strip ANSI" regex misses the orphan tail.\n\nimport { nativeStripAnsi } from \'../native/core.js\';\n\n/** Complete ANSI/CSI sequences (cursor moves, colors, etc.). */\nexport const ANSI_RE = /\\x1b\\[[0-9;]*[A-Za-z]/g;\n\n/** SGR color payloads whose ESC+CSI prefix was lost (or a comma-mangled\n *  variant the model copied by eye). Three shapes occur in the wild:\n *   - the full payload "38;2;R;G;Bm" / "48;5;Nm" (ESC+[ bytes already\n *     stripped by an upstream layer), glued onto whatever preceded it;\n *   - the comma-mangled 38;2 tail that lost "38;2;" entirely: "138;43,226m"\n *     (the comma is the tell — real prose never writes "43,226m" as a\n *     semicolon-delimited unit);\n *   - the bare 256-color remainder ";250m" where "48;5" was dropped too —\n *     matched ONLY when the \';\' is NOT preceded by a digit, so prose like\n *     "3;1m" (3.1 meters) and "version 1.2.3m" always survive. */\nexport const ORPHAN_SGR_RE =\n  /(?:38|48);(?:2;[\\d,;]{1,15}|5;\\d{1,3})m|\\d{1,3};\\d{1,3},\\d{1,3}m|(?<!\\d);\\d{1,3}m/g;\n\n/** A dangling "\\x1b[..." with no terminator at the end of a string. */\nexport const PARTIAL_CSI_TAIL_RE = /\\x1b\\[[0-9;]*$/;\n\n/** Strip every escape sequence — for text entering the model context.\n *  Native-first: the Rust `mochi_strip_ansi` op replaces the JS regex pass. */\nexport function stripAllAnsi(s: string): string {\n  if (!s) return s;\n  const nat = nativeStripAnsi(s);\n  if (nat !== null) return nat;\n  return s.replace(ANSI_RE, \'\');\n}\n\n/** Strip complete sequences AND the orphaned fragments they decay into.\n *  For text headed to the SCREEN (model prose, streamed chunks). */\nexport function scrubAnsiFragments(s: string): string {\n  return s.replace(ANSI_RE, \'\').replace(ORPHAN_SGR_RE, \'\').replace(PARTIAL_CSI_TAIL_RE, \'\');\n}\n\n/** Terminate a fully-rendered screen row so SGR state can never leak past\n *  it. Rows built from model prose or tool output can end with a live color\n *  (or a reverse-video highlight closed only with `27m`): without a trailing\n *  reset, the frame writer\'s EL clears the rest of the line IN that style and\n *  every later row inherits it — the classic whole-screen tint / gray-block\n *  defect. Empty rows pass through untouched (the writer paints the canvas). */\nexport function terminateRow(line: string): string {\n  if (!line) return line;\n  if (line.endsWith(\'\\x1b[0m\') || line.endsWith(\'\\x1b[m\')) return line;\n  return line + \'\\x1b[0m\';\n}\n\n/** Re-assert forced canvas background after any SGR reset sequence.\n *\n * In terminals whose default window background is not black (e.g. gray or\n * slate profile), bare SGR resets (`\\x1b[0m` or `\\x1b[m`) and default-bg resets\n * (`\\x1b[49m`) revert the background color to the terminal\'s default, causing\n * any subsequent characters, words, and padding spaces to render on gray boxes\n * (the "gray bars" bug).\n *\n * This helper ensures that every reset in a row immediately re-applies the\n * forced canvas background `bg` (e.g. `\\x1b[48;2;0;0;0m` or `\\x1b[48;5;16m`),\n * guaranteeing that text, spaces, and padding sit seamlessly on pure black.\n * When `bg` is empty (light themes or transparent terminal), returns safe as-is. */\nexport function paintCanvasBg(line: string, bg: string): string {\n  const safe = terminateRow(line);\n  if (!bg) return safe;\n  return safe\n    .replace(/\\x1b\\[49m/g, bg)\n    .replace(/\\x1b\\[0(?:;([0-9;]*))?m/g, (_match, rest) => {\n      return rest ? `\\x1b[0m${bg}\\x1b[${rest}m` : `\\x1b[0m${bg}`;\n    })\n    .replace(/\\x1b\\[m/g, `\\x1b[0m${bg}`);\n}\n\n'
  },
  "src/mcp/oauth.ts": {
    "path": "src/mcp/oauth.ts",
    "name": "oauth.ts",
    "dir": "src/mcp",
    "lang": "typescript",
    "size": "5.4 KB",
    "lines": 134,
    "desc": "Pre-registered MCP OAuth token cache and header injector",
    "code": `// MCP OAuth for pre-registered clients (Crush-style): servers that need a
// bearer token Mint it via OAuth2 client_credentials (or refresh_token)
// against the server's token endpoint, cache it on disk (0600), and refresh
// before expiry. Secrets accept \${ENV_VAR} expansion so .mcp.json never holds
// raw credentials. Full browser-redirect (authorization-code + PKCE) flows are
// intentionally OUT of scope — register an OAuth app once, then configure:
//
//   { "url": "https://api.example.com/mcp",
//     "oauth": { "tokenUrl": "https://auth.example.com/token",
//                "clientId": "\${MY_CLIENT_ID}", "clientSecret": "\${MY_CLIENT_SECRET}",
//                "scope": "mcp" } }
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface McpOAuthConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  scope?: string;
  /** Refresh this many seconds before expiry. Default 60. */
  refreshThresholdSec?: number;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
  refreshToken?: string;
}

function expandEnv(s: string): string {
  return s.replace(/\\$\\{([A-Za-z_][A-Za-z0-9_]*)\\}/g, (_m, name: string) => process.env[name] ?? '');
}

function storePath(storeDir?: string): string {
  // storeDir override exists for tests (production always uses the real
  // home —never a tmpdir that would strand credentials or pollute runs).
  return join(storeDir ?? join(homedir(), '.mochi'), 'mcp-oauth.json');
}

function loadStore(storeDir?: string): Record<string, CachedToken> {
  try {
    if (!existsSync(storePath(storeDir))) return {};
    return JSON.parse(readFileSync(storePath(storeDir), 'utf8')) as Record<string, CachedToken>;
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, CachedToken>, storeDir?: string): void {
  try {
    mkdirSync(join(storeDir ?? join(homedir(), '.mochi')), { recursive: true });
    writeFileSync(storePath(storeDir), JSON.stringify(store, null, 2), { mode: 0o600 });
    try { chmodSync(storePath(storeDir), 0o600); } catch { /* best effort */ }
  } catch { /* token caching is best-effort; the call still works uncached */ }
}

async function exchangeToken(cfg: McpOAuthConfig, params: Record<string, string>): Promise<{ access_token?: string; expires_in?: number; refresh_token?: string; error?: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(expandEnv(cfg.tokenUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
      signal: ctl.signal,
    });
    if (!res.ok) return { error: \`token endpoint HTTP \${res.status}\` };
    return (await res.json()) as { access_token?: string; expires_in?: number; refresh_token?: string; error?: string };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** Valid bearer token for a server, using cache → refresh → client-credentials
 *  in that order. Throws with a human-readable message when issuance fails. */
export async function getOAuthToken(serverId: string, cfg: McpOAuthConfig, storeDir?: string): Promise<string> {
  const thresholdMs = (cfg.refreshThresholdSec ?? 60) * 1000;
  const store = loadStore(storeDir);
  const cached = store[serverId];
  if (cached?.accessToken && cached.expiresAt - Date.now() > thresholdMs) {
    return cached.accessToken;
  }
  const clientId = expandEnv(cfg.clientId);
  const clientSecret = cfg.clientSecret ? expandEnv(cfg.clientSecret) : '';
  // 1. Refresh grant (preserves the grant without re-authenticating).
  if (cached?.refreshToken) {
    const r = await exchangeToken(cfg, {
      grant_type: 'refresh_token',
      refresh_token: cached.refreshToken,
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    });
    if (r.access_token) {
      const next: CachedToken = {
        accessToken: r.access_token,
        expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000,
        refreshToken: r.refresh_token ?? cached.refreshToken,
      };
      store[serverId] = next;
      saveStore(store, storeDir);
      return next.accessToken;
    }
    // Refresh failed (revoked/expired): fall through to client credentials.
    delete store[serverId];
  }
  // 2. Client-credentials grant.
  const scope = cfg.scope ? expandEnv(cfg.scope) : '';
  const r = await exchangeToken(cfg, {
    grant_type: 'client_credentials',
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
    ...(scope ? { scope } : {}),
  });
  if (!r.access_token) {
    throw new Error(\`MCP OAuth failed for "\${serverId}": \${r.error ?? 'no access_token issued'}\`);
  }
  store[serverId] = {
    accessToken: r.access_token,
    expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000,
    refreshToken: r.refresh_token,
  };
  saveStore(store, storeDir);
  return r.access_token;
}

/** Authorization headers for a server (empty when no oauth configured). */
export async function oauthHeaders(serverId: string, cfg?: McpOAuthConfig, storeDir?: string): Promise<Record<string, string>> {
  if (!cfg?.tokenUrl || !cfg?.clientId) return {};
  const token = await getOAuthToken(serverId, cfg, storeDir);
  return { authorization: \`Bearer \${token}\` };
}
`
  },
  "src/mcp/deepwiki-server.ts": {
    "path": "src/mcp/deepwiki-server.ts",
    "name": "deepwiki-server.ts",
    "dir": "src/mcp",
    "lang": "typescript",
    "size": "3.7 KB",
    "lines": 116,
    "desc": "Embedded DeepWiki MCP server for markdown knowledge indexing",
    "code": "#!/usr/bin/env node\n// DeepWiki MCP Server — standalone JSON-RPC 2.0 stdio MCP server.\n// Exposes a single tool: wiki_lookup(query, lang?)\n// Run via: node dist/mcp/deepwiki-server.js\n// Or add to mochi config as an MCP server with command: \"node\" and args pointing to the compiled file.\n\nimport { createInterface } from 'node:readline';\nimport { wikiSummary as lookupWikipedia } from '../wiki.js';\n\nconst TOOL_SCHEMA = {\n  name: 'wiki_lookup',\n  description: 'Look up a topic on Wikipedia and return a concise summary (title + extract, up to 2000 chars).',\n  inputSchema: {\n    type: 'object',\n    properties: {\n      query: { type: 'string', description: 'Search term or Wikipedia article title' },\n      lang: { type: 'string', description: 'Wikipedia language code (default: \"en\")' },\n    },\n    required: ['query'],\n  },\n};\n\nasync function wikiSummary(query: string, lang: string): Promise<string> {\n  // Share the exact same Wikipedia lookup logic as the in-process `deepwiki`\n  // tool (src/tools/deepwiki.ts). The only differences here: this standalone\n  // server identifies itself with its own User-Agent, tags search fallbacks\n  // with \"(search)\", and never throws — it reports a graceful \"not found\".\n  const { markdown } = await lookupWikipedia(query, lang, {\n    userAgent: 'mochi-deepwiki-mcp/1.0',\n    searchTag: ' (search)',\n    emptyMessage: (q) => `No result found for: ${q}`,\n    strict: false,\n  });\n  return markdown;\n}\n\nfunction respond(id: number | string | null, result: unknown): void {\n  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n');\n}\n\nfunction respondError(id: number | string | null, code: number, message: string): void {\n  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\\n');\n}\n\nconst rl = createInterface({ input: process.stdin });\n\nrl.on('line', async (line: string) => {\n  const trimmed = line.trim();\n  if (!trimmed) return;\n  let msg: { jsonrpc?: string; id?: number | string | null; method?: string; params?: unknown };\n  try {\n    msg = JSON.parse(trimmed);\n  } catch {\n    return;\n  }\n\n  const id = msg.id ?? null;\n  const method = msg.method ?? '';\n  const params = (msg.params ?? {}) as Record<string, unknown>;\n  const isNotification = msg.id === undefined;\n\n  switch (method) {\n    case 'initialize':\n      respond(id, {\n        protocolVersion: '2024-11-05',\n        capabilities: { tools: {} },\n        serverInfo: { name: 'deepwiki-mcp', version: '1.0.0' },\n      });\n      break;\n\n    case 'notifications/initialized':\n      // Notification — no response\n      break;\n\n    case 'tools/list':\n      respond(id, { tools: [TOOL_SCHEMA] });\n      break;\n\n    case 'tools/call': {\n      const toolName = String(params.name ?? '');\n      const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;\n      if (toolName !== 'wiki_lookup') {\n        respondError(id, -32601, `Unknown tool: ${toolName}`);\n        break;\n      }\n      const query = String(toolArgs.query ?? '').trim();\n      if (!query) {\n        respondError(id, -32602, 'query is required');\n        break;\n      }\n      const lang = String(toolArgs.lang ?? 'en').replace(/[^a-z-]/gi, '') || 'en';\n      try {\n        const text = await wikiSummary(query, lang);\n        respond(id, { content: [{ type: 'text', text }] });\n      } catch (err) {\n        respond(id, {\n          content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],\n          isError: true,\n        });\n      }\n      break;\n    }\n\n    case 'shutdown':\n      respond(id, null);\n      process.exit(0);\n      break;\n\n    default:\n      if (!isNotification) {\n        respondError(id, -32601, `Method not found: ${method}`);\n      }\n  }\n});\n\nrl.on('close', () => process.exit(0));\n"
  },
  "src/cognitive/anchor.ts": {
    "path": "src/cognitive/anchor.ts",
    "name": "anchor.ts",
    "dir": "src/cognitive",
    "lang": "typescript",
    "size": "3.6 KB",
    "lines": 121,
    "desc": "Cognitive anchor state maintaining working memory across turns",
    "code": "/**\n * ANCHOR — Operational Persistence System (Cognitive Framework 2.0)\n * \n * Preserves execution continuity across turns, context compression, and tool loops.\n * Prevents operational drift, state corruption, and lost conclusions.\n */\n\nexport type EpistemicClass = 'Verified' | 'Observed' | 'Inferred' | 'Speculative' | 'Unknown';\n\nexport interface EpistemicClaim {\n  id: string;\n  claim: string;\n  classification: EpistemicClass;\n  source?: string;\n  verifiedAt?: number;\n}\n\nexport interface OperationalCheckpoint {\n  id: string;\n  timestamp: number;\n  facts: string[];\n  assumptions: string[];\n  hypotheses: string[];\n  unknowns: string[];\n  blocked: string[];\n  rejectedApproaches: string[];\n  decisions: string[];\n  openTasks: string[];\n}\n\nexport class AnchorEngine {\n  private claims: Map<string, EpistemicClaim> = new Map();\n  private checkpoints: OperationalCheckpoint[] = [];\n  private rejected: Set<string> = new Set();\n  private claimCounter = 0;\n\n  /**\n   * Records or updates a claim with strict epistemic classification.\n   */\n  recordClaim(text: string, classification: EpistemicClass, source?: string): EpistemicClaim {\n    const id = `EC-${++this.claimCounter}`;\n    const claim: EpistemicClaim = {\n      id,\n      claim: text,\n      classification,\n      source,\n      verifiedAt: classification === 'Verified' ? Date.now() : undefined,\n    };\n    this.claims.set(id, claim);\n    return claim;\n  }\n\n  /**\n   * Promotes an inferred claim to verified based on evidence.\n   */\n  verifyClaim(id: string, evidence: string): boolean {\n    const c = this.claims.get(id);\n    if (!c) return false;\n    c.classification = 'Verified';\n    c.source = evidence;\n    c.verifiedAt = Date.now();\n    return true;\n  }\n\n  /**\n   * Records a failed or rejected approach so the agent never repeats it.\n   */\n  rejectApproach(approach: string, reason: string): void {\n    this.rejected.add(`${approach} (Reason: ${reason})`);\n  }\n\n  isApproachRejected(approach: string): boolean {\n    return [...this.rejected].some((r) => r.toLowerCase().includes(approach.toLowerCase()));\n  }\n\n  /**\n   * Creates a graduated state checkpoint.\n   */\n  createCheckpoint(data: Partial<OperationalCheckpoint> = {}): OperationalCheckpoint {\n    const cp: OperationalCheckpoint = {\n      id: `CP-${this.checkpoints.length + 1}`,\n      timestamp: Date.now(),\n      facts: data.facts ?? [],\n      assumptions: data.assumptions ?? [],\n      hypotheses: data.hypotheses ?? [],\n      unknowns: data.unknowns ?? [],\n      blocked: data.blocked ?? [],\n      rejectedApproaches: [...this.rejected, ...(data.rejectedApproaches ?? [])],\n      decisions: data.decisions ?? [],\n      openTasks: data.openTasks ?? [],\n    };\n    this.checkpoints.push(cp);\n    return cp;\n  }\n\n  /**\n   * Renders compact ANCHOR continuity context for prompt injection.\n   */\n  renderContinuityContext(): string {\n    const lines: string[] = ['# ANCHOR State Continuity'];\n\n    if (this.rejected.size > 0) {\n      lines.push('## Rejected Approaches (Do Not Retry):');\n      for (const r of this.rejected) lines.push(`- [REJECTED] ${r}`);\n    }\n\n    const verified = [...this.claims.values()].filter((c) => c.classification === 'Verified');\n    if (verified.length > 0) {\n      lines.push('## Verified Facts:');\n      for (const v of verified) lines.push(`- [VERIFIED] ${v.claim} (${v.source || 'test'})`);\n    }\n\n    const inferred = [...this.claims.values()].filter((c) => c.classification === 'Inferred');\n    if (inferred.length > 0) {\n      lines.push('## Working Inferences (Require Validation):');\n      for (const inf of inferred) lines.push(`- [INFERRED] ${inf.claim}`);\n    }\n\n    return lines.length > 1 ? lines.join('\\n') : '';\n  }\n}\n"
  },
  "src/cognitive/chameleon.ts": {
    "path": "src/cognitive/chameleon.ts",
    "name": "chameleon.ts",
    "dir": "src/cognitive",
    "lang": "typescript",
    "size": "10.3 KB",
    "lines": 306,
    "desc": "Adaptive MoE task classifier and token compression engine",
    "code": "/**\n * Lazy Chameleon v2.4 (Mochi Harness Baked Edition)\n * \n * In-harness synthetic parameter synthesis and test-time compute expansion.\n * Requires ZERO external API keys or external services — operates entirely over\n * Mochi's connected model router, with instant deterministic zero-turn fallback.\n */\n\nimport { resolve } from 'node:path';\nimport { createProvider } from '../model/router.js';\nimport { BudgetEngine, estimateCostUsd } from '../budget.js';\nimport type { ChatMessage, MochiConfig, ModelProfile } from '../types.js';\nimport { evaluateOwl } from './owl.js';\nimport { evaluateSispis } from './sispis.js';\nimport { loadDoxContract } from './dox.js';\n\nexport type ChameleonMode =\n  | 'flash'\n  | 'turbo'\n  | 'easy'\n  | 'medium'\n  | 'hard'\n  | 'deep'\n  | 'extreme'\n  | 'genius'\n  | 'god'\n  | 'auto';\n\nexport type StallStrategy =\n  | 'chain_of_draft'\n  | 'budget_force'\n  | 'constitutional'\n  | 'devils_advocate'\n  | 'self_consistency'\n  | 'confidence_gate'\n  | 'hybrid';\n\nexport const CHAMELEON_MODES: readonly ChameleonMode[] = [\n  'flash', 'turbo', 'easy', 'medium', 'hard', 'deep', 'extreme', 'genius', 'god', 'auto',\n];\n\nexport const STALL_STRATEGIES: readonly StallStrategy[] = [\n  'chain_of_draft', 'budget_force', 'constitutional', 'devils_advocate',\n  'self_consistency', 'confidence_gate', 'hybrid',\n];\n\nexport interface EnhanceOptions {\n  task: string;\n  mode?: ChameleonMode;\n  strategy?: StallStrategy;\n  profile?: ModelProfile;\n  budget?: BudgetEngine;\n  cwd?: string;\n  maxRuns?: number;\n  autoSelect?: boolean;\n}\n\nexport interface EnhanceResult {\n  task: string;\n  mode: ChameleonMode;\n  strategy: StallStrategy;\n  context: string;\n  strategies: string[];\n  tokensUsed: number;\n  costUsd: number;\n  durationMs: number;\n  syntheticParameters: {\n    decompositionDepth: number;\n    invariantsGuarded: number;\n    riskPointsIdentified: number;\n  };\n}\n\nconst STRATEGY_MOVES: Record<StallStrategy, string[]> = {\n  chain_of_draft: [\n    'generate a concise draft solution',\n    'audit draft against edge cases, boundary conditions, and performance bottlenecks',\n    'produce a refined, hardened final execution plan',\n  ],\n  budget_force: [\n    'force exhaustive multi-angle decomposition',\n    'analyze hidden architectural dependencies and AST realities',\n    'construct complete step-by-step invariant proofs',\n  ],\n  constitutional: [\n    'check against data loss prevention and atomicity principles',\n    'enforce locality: touch only strictly required files',\n    'verify conservation: preserve exact existing semantics and contract',\n  ],\n  devils_advocate: [\n    'argue the adversarial case: how could this implementation fail?',\n    'identify subtle concurrency, async race, or memory leak risks',\n    'immunize solution against the identified failure modes',\n  ],\n  self_consistency: [\n    'derive two distinct alternative approaches to solve the goal',\n    'compare tradeoffs and complexity of each approach',\n    'synthesize the highest-reliability hybrid solution',\n  ],\n  confidence_gate: [\n    'estimate uncertainty on all underlying assumptions',\n    'classify facts vs inferences using epistemic labeling',\n    'gate execution on concrete verification triggers',\n  ],\n  hybrid: [\n    'decompose into sub-problems and solve sequentially',\n    'apply adversarial critique and identify failure modes',\n    'enforce strict system invariants and verification proof',\n  ],\n};\n\nfunction tierFor(mode: ChameleonMode): number {\n  switch (mode) {\n    case 'flash': return 1;\n    case 'turbo': return 2;\n    case 'easy': return 2;\n    case 'medium': return 3;\n    case 'hard': return 4;\n    case 'deep': return 5;\n    case 'extreme':\n    case 'genius':\n    case 'god': return 6;\n    case 'auto':\n    default: return 3;\n  }\n}\n\nimport { synthesizeDenseDataset } from '../chameleon/dense-dataset-synthesizer.js';\n\n/**\n * Deterministically generates instant synthetic parameter guidance and dense real datasets in 0ms\n * without requiring any extra network round-trips or API tokens, splitting through cellular MoEs.\n */\n// Scaffold cache (harness-v2 perf): the deterministic scaffold is task-derived\n// and immutable, so prime it ONCE asynchronously (codegraph grammar load is\n// lazy) and let the HOT sync prompt-builder read the cached string for free.\nconst _scaffoldCache = new Map<string, string>();\n\nexport function getCachedScaffold(task: string, cwd = process.cwd()): string | undefined {\n  const v = _scaffoldCache.get(`${cwd}::${task}`);\n  if (v !== undefined) return v;\n  // The same task may have been primed under a different root (daemon, TUI):\n  // the scaffold is derived from the task text, so any entry matches.\n  for (const [k, val] of _scaffoldCache) {\n    if (k.endsWith(`::${task}`)) return val;\n  }\n  return undefined;\n}\n\n/** Prime the scaffold for a task: warms the lazy codegraph grammars first so\n *  the cached scaffold includes real AST symbol grounding. Safe to call twice.\n */\nexport async function primeScaffold(task: string, cwd = process.cwd(), _unused?: unknown, langs?: readonly string[]): Promise<string> {\n  const key = `${cwd}::${task}`;\n  let s = _scaffoldCache.get(key);\n  if (s === undefined) {\n    // FREEZE GUARD: never treat $HOME as a code project root - warming over a\n    // whole home directory pegged the event loop and froze the TUI.\n    let root = cwd;\n    try { const { homedir } = await import('node:os'); if (resolve(cwd) === homedir()) root = ''; } catch {}\n    if (root) {\n      try { const cg = await import('../repo/codegraph.js'); await cg.warmCodegraph(root, langs); } catch { /* best-effort */ }\n    }\n    s = synthesizeDeterministicContext(task, cwd);\n    _scaffoldCache.set(key, s);\n  }\n  return s;\n}\n\nexport function synthesizeDeterministicContext(task: string, cwd = process.cwd()): string {\n  const owl = evaluateOwl(task);\n  const sispis = evaluateSispis(task, owl.cumulativeWeight);\n  const dox = loadDoxContract(cwd);\n  const denseData = synthesizeDenseDataset(task, cwd);\n\n  const sections: string[] = [\n    denseData.rawDatasetText,\n    `Cognitive Mode: SISPIS ${sispis.mode} (Entropy: ${sispis.entropy.toFixed(2)})`,\n  ];\n\n  if (owl.formattedFindings.length > 0) {\n    sections.push(`OWL Guardrails:\\n` + owl.formattedFindings.map((f) => `  • ${f}`).join('\\n'));\n  }\n\n  if (dox.constraints.length > 0) {\n    sections.push(`DOX Contracts:\\n` + dox.constraints.slice(0, 4).map((c) => `  • ${c}`).join('\\n'));\n  }\n\n  return sections.join('\\n\\n');\n}\n\nexport class ChameleonEngine {\n  private provider: ReturnType<typeof createProvider>;\n\n  constructor(private config: MochiConfig) {\n    this.provider = createProvider(config.model, 'reasoning');\n  }\n\n  async enhance(opts: EnhanceOptions): Promise<EnhanceResult> {\n    const startedAt = performance.now();\n    const mode = opts.mode && opts.mode !== 'auto' ? opts.mode : 'medium';\n    const strategy = opts.strategy ?? 'hybrid';\n    const tier = tierFor(mode);\n    const moves = STRATEGY_MOVES[strategy] || STRATEGY_MOVES.hybrid;\n    const cwd = opts.cwd ?? process.cwd();\n\n    // Fast-path: Flash mode runs 100% deterministic in 0ms with zero extra model calls!\n    if (mode === 'flash') {\n      const context = synthesizeDeterministicContext(opts.task, cwd);\n      return {\n        task: opts.task,\n        mode,\n        strategy,\n        context,\n        strategies: moves,\n        tokensUsed: 0,\n        costUsd: 0,\n        durationMs: Math.round(performance.now() - startedAt),\n        syntheticParameters: {\n          decompositionDepth: 3,\n          invariantsGuarded: 4,\n          riskPointsIdentified: 2,\n        },\n      };\n    }\n\n    const budget = opts.budget ?? new BudgetEngine(this.config.safety);\n    const maxRuns = opts.maxRuns ? Math.max(opts.maxRuns, 1) : (tier <= 2 ? 1 : tier === 3 ? 2 : tier === 4 ? 3 : tier === 5 ? 4 : 6);\n\n    let tokensUsed = 0;\n    let costUsd = 0;\n    const runs: string[] = [];\n\n    const deterministicScaffold = synthesizeDeterministicContext(opts.task, cwd);\n\n    const messages: ChatMessage[] = [\n      {\n        role: 'system',\n        content:\n          'You are the Chameleon Synthetic Parameter Engine. Generate a dense, mathematically sound, highly actionable engineering framework for the given task. Outline concrete invariants, critical edge cases, structural constraints, and acceptance criteria. Plain technical prose without markdown fences.',\n      },\n      {\n        role: 'user',\n        content: `Task: ${opts.task}\\n\\nPre-evaluated cognitive context:\\n${deterministicScaffold}\\n\\nExecute strategy passes: ${moves.join('; ')}. Output rich, dense execution guidance.`,\n      },\n    ];\n\n    try {\n      for (let i = 0; i < maxRuns; i++) {\n        if (!budget.canMakeModelCall()) break;\n        budget.recordModelCall();\n\n        const response = await this.provider.chat(messages, [], { temperature: 0.25 + (i * 0.05) });\n        const chunk = response.content ?? '';\n        if (response.usage) {\n          tokensUsed += response.usage.totalTokens;\n          budget.recordTokens(response.usage.totalTokens, this.config.model.model);\n          costUsd += estimateCostUsd(response.usage.totalTokens, this.config.model.model);\n        }\n        runs.push(chunk);\n        const bestSoFar = chunk.trim() ? chunk : (runs.length > 1 ? runs[runs.length - 2] : deterministicScaffold);\n        // Continuous improvement feedback loop: feed best synthesis back\n        messages.push({\n          role: 'user',\n          content: `Pass ${i + 1}/${maxRuns} — previous best:\n${bestSoFar.slice(0, 2500)}\n\nImprove further: deepen proofs, identify new edge cases, harden invariants. If weaker, revert.`,\n        });\n      }\n    } catch {\n      // Graceful fallback to deterministic context on network/provider error\n      runs.push(deterministicScaffold);\n    }\n\n    const context = runs.length ? runs[runs.length - 1] : deterministicScaffold;\n    const durationMs = Math.round(performance.now() - startedAt);\n\n    return {\n      task: opts.task,\n\n// ... [File continues on GitHub repository] ..."
  },
  "src/cognitive/sispis.ts": {
    "path": "src/cognitive/sispis.ts",
    "name": "sispis.ts",
    "dir": "src/cognitive",
    "lang": "typescript",
    "size": "2.8 KB",
    "lines": 85,
    "desc": "Structured semantic parsing and instruction synthesizer",
    "code": "/**\n * SISPIS — Structured Intent Scaffolding & Pragmatic Information Synthesis (Cognitive Framework 2.0)\n * \n * Output calibration gate: determines response structure (NO_DECISION, EXPLANATION, or SCHEMA)\n * based on task entropy, decision branching, and weighted intent.\n */\n\nexport type SispisMode = 'NO_DECISION' | 'EXPLANATION' | 'SCHEMA';\n\nexport interface SispisAssessment {\n  mode: SispisMode;\n  entropy: number; // 0.0 - 1.0 (complexity / ambiguity)\n  decisionSpace: number; // Number of competing valid approaches\n  intentWeight: number; // High-stakes vs routine\n  userOverride?: 'simple' | 'structured' | 'deep';\n  guidance: string;\n}\n\n/**\n * Calibrates the output format and cognitive depth.\n */\nexport function evaluateSispis(prompt: string, upstreamSignalsWeight = 0): SispisAssessment {\n  const p = prompt.toLowerCase();\n\n  // User explicit overrides\n  let userOverride: SispisAssessment['userOverride'];\n  if (/\\b(just tell me|keep it simple|tldr|quick answer|no fluff)\\b/.test(p)) {\n    userOverride = 'simple';\n    return {\n      mode: 'NO_DECISION',\n      entropy: 0.1,\n      decisionSpace: 1,\n      intentWeight: 0.1,\n      userOverride,\n      guidance: 'Output concise, direct factual answer without structural overhead.',\n    };\n  }\n\n  if (/\\b(deep dive|full analysis|architectural review|comprehensive)\\b/.test(p)) {\n    userOverride = 'deep';\n    return {\n      mode: 'SCHEMA',\n      entropy: 0.9,\n      decisionSpace: 3,\n      intentWeight: 0.9,\n      userOverride,\n      guidance: 'Apply 5-section decision framework: Context, Alternatives, Invariants, Execution Plan, Verification.',\n    };\n  }\n\n  // Calculate Entropy\n  let entropy = 0.2;\n  if (/\\b(how should|which is better|tradeoffs|redesign|refactor|optimize|architecture)\\b/.test(p)) entropy += 0.4;\n  if (/\\b(complex|distributed|database|security|concurrency|race condition)\\b/.test(p)) entropy += 0.3;\n  if (upstreamSignalsWeight > 1.0) entropy += 0.2;\n\n  // Calculate Decision Space\n  let decisionSpace = 1;\n  if (/\\b(or|vs|versus|alternative|either|choice|options)\\b/.test(p) || entropy > 0.6) {\n    decisionSpace = 2;\n  }\n  if (entropy > 0.8) decisionSpace = 3;\n\n  let mode: SispisMode = 'NO_DECISION';\n  if (entropy >= 0.7 && decisionSpace >= 2) {\n    mode = 'SCHEMA';\n  } else if (entropy >= 0.4 || upstreamSignalsWeight >= 0.5) {\n    mode = 'EXPLANATION';\n  }\n\n  const guidance =\n    mode === 'SCHEMA'\n      ? 'Structure response around explicit decisions: 1) Objective, 2) Tradeoffs/Options, 3) Critical Invariants, 4) Execution Steps, 5) Proof of Correctness.'\n      : mode === 'EXPLANATION'\n      ? 'Provide clear technical reasoning with minimal formatting overhead.'\n      : 'Deliver direct, concise solution without conversational filler.';\n\n  return {\n    mode,\n    entropy: Math.min(1.0, entropy),\n    decisionSpace,\n    intentWeight: entropy * decisionSpace,\n    guidance,\n  };\n}\n"
  },
  "src/exec.ts": {
    "path": "src/exec.ts",
    "name": "exec.ts",
    "dir": "src",
    "lang": "typescript",
    "size": "10.4 KB",
    "lines": 269,
    "desc": "Central execution policy with timeout, SIGTERM, and audit logging",
    "code": "// Central command-execution policy: every child process mochi spawns for\n// agent work flows through here (shell tool, verification, cron notify).\n// Guarantees on every call: bounded wall-clock (SIGTERM then SIGKILL),\n// bounded output (never OOMs the harness on firehose commands), argv-array\n// API for shell-free execution, and an audit hook for risk logging.\n// Long-lived processes (background tasks, daemons, PTY) keep their own\n// lifecycle owners and are intentionally OUT of scope.\nimport { spawn, execFile } from 'node:child_process';\nimport { homedir, tmpdir } from 'node:os';\nimport { resolve, delimiter } from 'node:path';\nimport { accessSync, constants } from 'node:fs';\n\nexport interface SandboxOptions {\n  /** 'off' (default) runs directly; 'bubblewrap' forces bwrap (fails if\n   *  missing); 'auto' uses bwrap when available, else runs directly. */\n  mode: 'off' | 'auto' | 'bubblewrap';\n  /** Allow network inside the sandbox. Default true (npm/tests need it). */\n  network?: boolean;\n  /** Extra read-write paths beyond cwd + tmpdir + devtool caches. */\n  writablePaths?: string[];\n}\n\nexport interface ExecOptions {\n  cwd?: string;\n  env?: NodeJS.ProcessEnv;\n  /** Wall-clock budget. Default 120s. */\n  timeoutMs?: number;\n  /** Per-stream accumulation cap. Default 2MB. */\n  maxOutput?: number;\n  /** AbortSignal for caller cancellation (Ctrl+C, task abort). */\n  signal?: AbortSignal;\n  /** Grace period between SIGTERM and SIGKILL. Default 1500ms. */\n  killGraceMs?: number;\n  /** Called once with the outcome for audit/risk logging. Never throws. */\n  onAudit?: (info: { cmd: string; code: number | null; timedOut: boolean; durationMs: number }) => void;\n  /** OS-level sandbox (bubblewrap). Default off — opt in per call or via\n   *  `safety.sandbox` for the shell tool. */\n  sandbox?: SandboxOptions;\n}\n\nexport interface ExecResult {\n  stdout: string;\n  stderr: string;\n  code: number | null;\n  timedOut: boolean;\n  cancelled: boolean;\n  durationMs: number;\n}\n\nconst DEFAULT_TIMEOUT_MS = 120_000;\nconst DEFAULT_MAX_OUTPUT = 2_000_000;\n\nfunction finishSpawn(\n  child: ReturnType<typeof spawn>,\n  cmd: string,\n  opts: ExecOptions,\n  stdoutRef: { text: string; truncated: boolean },\n  stderrRef: { text: string; truncated: boolean },\n  startedAt: number,\n): Promise<ExecResult> {\n  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;\n  const killGraceMs = opts.killGraceMs ?? 1500;\n  return new Promise((resolve, reject) => {\n    let settled = false;\n    let timedOut = false;\n    let cancelled = false;\n    const done = (code: number | null, extra?: { timedOut?: boolean; cancelled?: boolean }) => {\n      if (settled) return;\n      settled = true;\n      clearTimeout(timer);\n      opts.signal?.removeEventListener('abort', onAbort);\n      child.stdout?.destroy();\n      child.stderr?.destroy();\n      const durationMs = Date.now() - startedAt;\n      // The `close` event usually wins the race after our SIGTERM (the child\n      // is already dead), so the closure flags — not just `extra` — carry\n      // the timeout/cancel truth.\n      const wasTimedOut = extra?.timedOut ?? timedOut;\n      const wasCancelled = extra?.cancelled ?? cancelled;\n      try {\n        opts.onAudit?.({ cmd: cmd.slice(0, 200), code, timedOut: wasTimedOut, durationMs });\n      } catch { /* audit must never break execution */ }\n      resolve({\n        stdout: stdoutRef.text,\n        stderr: stderrRef.text,\n        code,\n        timedOut: wasTimedOut,\n        cancelled: wasCancelled,\n        durationMs,\n      });\n    };\n    const killTree = (sig: NodeJS.Signals) => { try { child.kill(sig); } catch { /* already dead */ } };\n    const timer = setTimeout(() => {\n      timedOut = true;\n      killTree('SIGTERM');\n      child.stdout?.destroy();\n      child.stderr?.destroy();\n      setTimeout(() => { if (!settled) { killTree('SIGKILL'); done(124, { timedOut: true }); } }, killGraceMs);\n    }, timeoutMs);\n    // `timer.unref?.()` so a runaway timer never holds the process open.\n    (timer as unknown as { unref?: () => void }).unref?.();\n    const onAbort = () => {\n      cancelled = true;\n      killTree('SIGTERM');\n      child.stdout?.destroy();\n      child.stderr?.destroy();\n      setTimeout(() => { if (!settled) { killTree('SIGKILL'); done(130, { cancelled: true }); } }, 800);\n    };\n    if (opts.signal?.aborted) { onAbort(); return; }\n    opts.signal?.addEventListener('abort', onAbort, { once: true });\n    void timedOut; void cancelled;\n    child.stdout?.on('data', (chunk) => {\n      stdoutRef.text += String(chunk);\n      if (stdoutRef.text.length > (opts.maxOutput ?? DEFAULT_MAX_OUTPUT)) {\n        stdoutRef.text = stdoutRef.text.slice(0, opts.maxOutput ?? DEFAULT_MAX_OUTPUT) + '\\n... [truncated]';\n        stdoutRef.truncated = true;\n        child.stdout?.destroy();\n      }\n    });\n    child.stderr?.on('data', (chunk) => {\n      stderrRef.text += String(chunk);\n      if (stderrRef.text.length > (opts.maxOutput ?? DEFAULT_MAX_OUTPUT)) {\n        stderrRef.text = stderrRef.text.slice(0, opts.maxOutput ?? DEFAULT_MAX_OUTPUT) + '\\n... [truncated]';\n        stderrRef.truncated = true;\n        child.stderr?.destroy();\n      }\n    });\n    child.on('error', (err) => {\n      if (settled) return;\n      settled = true;\n      clearTimeout(timer);\n      opts.signal?.removeEventListener('abort', onAbort);\n      reject(err);\n    });\n    child.on('close', (code) => done(code));\n  });\n}\n\n/** Run a command WITHOUT a shell: argv array only, no interpolation.\n *  Prefer this for every harness-internal invocation (git, probes, notify). */\nexport function runArgv(cmd: string, args: readonly string[], opts: ExecOptions = {}): Promise<ExecResult> {\n  const startedAt = Date.now();\n  const wrapped = maybeSandbox(cmd, args, opts);\n  const child = spawn(wrapped.cmd, wrapped.args, {\n    cwd: opts.cwd,\n    env: opts.env ?? process.env,\n    stdio: 'pipe',\n    windowsHide: true,\n  });\n  return finishSpawn(child, [cmd, ...args].join(' '), opts, { text: '', truncated: false }, { text: '', truncated: false }, startedAt);\n}\n\n/** Run a shell string (`sh -c`-class) under policy. Reserved for the agent's\n *  `shell` tool and user-configured hooks (cron notify) where shell\n *  composition (pipes, redirects) is the feature. Harness internals must\n *  use runArgv instead. */\nexport function runShellString(command: string, opts: ExecOptions & { shellBin?: string } = {}): Promise<ExecResult> {\n  const startedAt = Date.now();\n  const shellBin = opts.shellBin ?? (process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : (process.env.SHELL || '/bin/bash'));\n  const wrapped = maybeSandbox(shellBin, ['-c', command], opts);\n  const child = spawn(wrapped.cmd, wrapped.args, {\n    cwd: opts.cwd,\n    env: opts.env ?? process.env,\n    stdio: 'pipe',\n    windowsHide: true,\n  });\n  return finishSpawn(child, command, opts, { text: '', truncated: false }, { text: '', truncated: false }, startedAt);\n}\n\n/** execFile-style convenience for short harness probes with a string result.\n *  Rejects on non-zero exit (like execFile with callback error). */\nexport function execArgvText(cmd: string, args: readonly string[], opts: { cwd?: string; timeoutMs?: number; maxBuffer?: number } = {}): Promise<string> {\n  return new Promise((resolve, reject) => {\n    execFile(cmd, [...args], {\n      cwd: opts.cwd,\n      timeout: opts.timeoutMs ?? 30_000,\n      maxBuffer: opts.maxBuffer ?? 1024 * 1024,\n    }, (err, stdout) => {\n      if (err) reject(err);\n      else resolve(String(stdout));\n    });\n  });\n}\n\n/** Default writable locations inside a bubblewrap sandbox: the task cwd, the\n *  OS tmpdir, and the dev-tool caches npm/cargo/pip need to function. The\n *  rest of the filesystem (including $HOME dotfiles and SSH keys) is\n *  read-only; /tmp and /dev+/proc are fresh private mounts. */\nfunction defaultSandboxWritable(cwd?: string): string[] {\n  const home = homedir();\n  const out = [cwd ?? process.cwd(), tmpdir()];\n  for (const d of ['.npm', '.cache', '.cargo']) {\n    const p = resolve(home, d);\n    try {\n      accessSync(p, constants.R_OK);\n      out.push(p);\n    } catch { /* cache dir absent: skip rather than create it inside the sandbox */ }\n  }\n  return [...new Set(out)];\n}\n\nlet cachedBwrap: string | null | undefined;\n\n/** Absolute path to `bwrap`, or null when unavailable. Cached. Testable via\n *  explicit pathEnv (production callers omit it). */\nexport function detectBubblewrap(pathEnv = process.env.PATH ?? ''): string | null {\n  if (cachedBwrap !== undefined && pathEnv === (process.env.PATH ?? '')) return cachedBwrap;\n  let found: string | null = null;\n  for (const dir of pathEnv.split(delimiter).filter(Boolean)) {\n    const full = resolve(dir, 'bwrap');\n    try {\n      accessSync(full, constants.X_OK);\n      found = full;\n      break;\n    } catch { /* not here */ }\n  }\n  if (pathEnv === (process.env.PATH ?? '')) cachedBwrap = found;\n  return found;\n}\n\n/** Pure argv builder: wrap [cmd, ...args] in a bubblewrap invocation.\n *  Exported for tests; runArgv/runShellString call it via maybeSandbox. */\nexport function buildBubblewrapArgs(\n  bwrapBin: string,\n  cmd: string,\n  args: readonly string[],\n  opts: { cwd?: string; network?: boolean; writablePaths?: string[] } = {},\n): string[] {\n  const cwd = opts.cwd ?? process.cwd();\n  const argv: string[] = [\n    '--ro-bind', '/', '/',\n    '--dev', '/dev',\n    '--proc', '/proc',\n    '--tmpfs', '/tmp',\n  ];\n  const writable = [...defaultSandboxWritable(cwd), ...(opts.writablePaths ?? [])];\n  for (const p of new Set(writable)) {\n    argv.push('--bind', p, p);\n  }\n  if (opts.network === false) argv.push('--unshare-net');\n  argv.push('--chdir', cwd, '--', cmd, ...args);\n  return [bwrapBin, ...argv];\n}\n\n/** Wrap [cmd, args] per opts.sandbox. Returns the command unchanged when the\n *  sandbox is off, unavailable in auto mode — or throws in `bubblewrap` mode\n *  when bwrap is missing (explicit request, fail loudly, never silently run\n *  unsandboxed). */\nexport function maybeSandbox(\n  cmd: string,\n  args: readonly string[],\n  opts: ExecOptions,\n): { cmd: string; args: string[] } {\n  const sb = opts.sandbox;\n  if (!sb || sb.mode === 'off' || process.platform === 'win32') return { cmd, args: [...args] };\n  const bwrap = detectBubblewrap();\n  if (!bwrap) {\n    if (sb.mode === 'bubblewrap') {\n      throw new Error('Sandbox requested (bubblewrap) but `bwrap` was not found on PATH. Install bubblewrap or use sandbox mode \"off\".');\n    }\n    return { cmd, args: [...args] };\n  }\n  const full = buildBubblewrapArgs(bwrap, cmd, args, {\n    cwd: opts.cwd,\n    network: sb.network,\n    writablePaths: sb.writablePaths,\n  });\n  return { cmd: full[0], args: full.slice(1) };\n}\n"
  },
  "native/mochi_core/src/lib.rs": {
    "path": "native/mochi_core/src/lib.rs",
    "name": "lib.rs",
    "dir": "native/mochi_core/src",
    "lang": "rust",
    "size": "15.7 KB",
    "lines": 506,
    "desc": "Zero-dependency compiled native crate with fast BPE tokenizer & N-API bridge",
    "code": '//! Mochi Core Native Rust Engine\n//! Complete native runtime architecture for agent orchestration, streaming, fuzzy matching, search, git, PTY, tokenizer, SQLite, and data handling.\n\npub mod acp;\npub mod agent_loop;\npub mod autopsy;\npub mod budget;\npub mod codegraph;\npub mod cmdprobe;\npub mod context;\npub mod daemon;\npub mod diff;\npub mod fold;\npub mod fuzzy;\npub mod git;\npub mod http_client;\npub mod kv_cache;\npub mod mcp_gateway;\npub mod memory_index;\npub mod patch_engine;\npub mod planner;\npub mod pty_manager;\npub mod redact;\npub mod repo;\npub mod risk;\npub mod search;\npub mod skills;\npub mod speculative_decoder;\npub mod stream;\npub mod symbol_analyzer;\npub mod tokenizer;\npub mod tokens;\npub mod tui_renderer;\npub mod tui_state;\npub mod verification;\npub mod napi;\n\nuse std::ffi::{CStr, CString};\nuse std::os::raw::{c_char, c_int};\nuse std::path::Path;\nuse std::slice;\n\npub use acp::*;\npub use agent_loop::*;\npub use autopsy::*;\npub use budget::*;\npub use codegraph::*;\npub use cmdprobe::*;\npub use context::*;\npub use daemon::*;\npub use diff::*;\npub use fold::*;\npub use fuzzy::*;\npub use git::*;\npub use http_client::*;\npub use kv_cache::*;\npub use mcp_gateway::*;\npub use memory_index::*;\npub use patch_engine::*;\npub use planner::*;\npub use pty_manager::*;\npub use redact::*;\npub use repo::*;\npub use risk::*;\npub use search::*;\npub use skills::*;\npub use speculative_decoder::*;\npub use stream::*;\npub use symbol_analyzer::*;\npub use tokenizer::*;\npub use tokens::*;\npub use tui_renderer::*;\npub use tui_state::*;\npub use verification::*;\n\n// ============================================================================\n// C-ABI FFI Exports (Callable from Node & Bun in-process)\n// ============================================================================\n\n#[no_mangle]\npub unsafe extern "C" fn mochi_fuzzy_match(\n    text_ptr: *const c_char,\n    needle_ptr: *const c_char,\n    out_start: *mut usize,\n    out_end: *mut usize,\n) -> c_int {\n    if text_ptr.is_null() || needle_ptr.is_null() || out_start.is_null() || out_end.is_null() {\n        return -1;\n    }\n    let Ok(text) = (unsafe { CStr::from_ptr(text_ptr) }).to_str() else {\n        return -1;\n    };\n    let Ok(needle) = (unsafe { CStr::from_ptr(needle_ptr) }).to_str() else {\n        return -1;\n    };\n\n    if let Some((start, end)) = fuzzy::fuzzy_find_unique(text, needle) {\n        unsafe {\n            *out_start = start;\n            *out_end = end;\n        }\n        1 // Matched uniquely\n    } else {\n        0 // No match or ambiguous\n    }\n}\n\n#[no_mangle]\npub unsafe extern "C" fn mochi_git_branch(\n    dir_ptr: *const c_char,\n    out_buf: *mut c_char,\n    out_cap: usize,\n) -> c_int {\n    if dir_ptr.is_null() || out_buf.is_null() || out_cap == 0 {\n        return -1;\n    }\n    let Ok(dir_str) = (unsafe { CStr::from_ptr(dir_ptr) }).to_str() else {\n        return -1;\n    };\n    let p = Path::new(dir_str);\n\n    if let Some(branch) = git::fast_git_branch(p) {\n        if let Ok(c_branch) = CString::new(branch) {\n            let bytes = c_branch.as_bytes_with_nul();\n            if bytes.len() <= out_cap {\n                let dst = unsafe { slice::from_raw_parts_mut(out_buf as *mut u8, bytes.len()) };\n                dst.copy_from_slice(bytes);\n                return (bytes.len() - 1) as c_int;\n            }\n        }\n    }\n    0\n}\n\n#[no_mangle]\npub unsafe extern "C" fn mochi_search(\n    dir_ptr: *const c_char,\n    query_ptr: *const c_char,\n    glob_ptr: *const c_char,\n    limit: usize,\n    out_buf: *mut c_char,\n    out_cap: usize,\n) -> c_int {\n    if dir_ptr.is_null() || query_ptr.is_null() || out_buf.is_null() || out_cap == 0 {\n        return -1;\n    }\n    let Ok(dir_str) = (unsafe { CStr::from_ptr(dir_ptr) }).to_str() else {\n        return -1;\n    };\n    let Ok(query_str) = (unsafe { CStr::from_ptr(query_ptr) }).to_str() else {\n        return -1;\n    };\n    let glob_str = if glob_ptr.is_null() {\n        ""\n    } else {\n        (unsafe { CStr::from_ptr(glob_ptr) }).to_str().unwrap_or("")\n    };\n\n    let result = search::search_directory(Path::new(dir_str), query_str, glob_str, limit);\n    if let Ok(c_res) = CString::new(result) {\n        let bytes = c_res.as_bytes_with_nul();\n        let copy_len = bytes.len().min(out_cap);\n        let dst = unsafe { slice::from_raw_parts_mut(out_buf as *mut u8, copy_len) };\n        dst.copy_from_slice(&bytes[..copy_len]);\n        if copy_len > 0 {\n            dst[copy_len - 1] = 0; // Null terminate\n        }\n        return (copy_len - 1) as c_int;\n    }\n    0\n}\n\n#[no_mangle]\npub unsafe extern "C" fn mochi_strip_think_tags(\n    text_ptr: *const c_char,\n    out_buf: *mut c_char,\n    out_cap: usize,\n) -> c_int {\n    if text_ptr.is_null() || out_buf.is_null() || out_cap == 0 {\n        return -1;\n    }\n    let Ok(text) = (unsafe { CStr::from_ptr(text_ptr) }).to_str() else {\n        return -1;\n    };\n\n    let stripped = stream::strip_think_tags_native(text);\n    if let Ok(c_res) = CString::new(stripped) {\n        let bytes = c_res.as_bytes_with_nul();\n        let copy_len = bytes.len().min(out_cap);\n        let dst = unsafe { slice::from_raw_parts_mut(out_buf as *mut u8, copy_len) };\n        dst.copy_from_slice(&bytes[..copy_len]);\n        if copy_len > 0 {\n            dst[copy_len - 1] = 0;\n        }\n        return (copy_len - 1) as c_int;\n    }\n    0\n}\n\n#[no_mangle]\npub unsafe extern "C" fn mochi_hash_prompt(\n    data_ptr: *const u8,\n    data_len: usize,\n) -> u64 {\n    if data_ptr.is_null() || data_len == 0 {\n        return 0;\n    }\n    let slice = unsafe { slice::from_raw_parts(data_ptr, data_len) };\n    tokens::fnv1a_64_hash(slice)\n}\n\n#[no_mangle]\npub unsafe extern "C" fn mochi_redact_secrets(\n    input_ptr: *const c_char,\n    out_buf: *mut c_char,\n    out_cap: usize,\n) -> c_int {\n    if input_ptr.is_null() || out_buf.is_null() || out_cap == 0 {\n        return -1;\n    }\n    let Ok(input) = (unsafe { CStr::from_ptr(input_ptr) }).to_str() else {\n        return -1;\n    };\n    let redacted = redact::redact_secrets(input);\n    let c_res = match CString::new(redacted) {\n        Ok(s) => s,\n        Err(_) => return -1,\n    };\n    let bytes = c_res.as_bytes_with_nul();\n    let copy_len = bytes.len().min(out_cap);\n    let dst = unsafe { slice::from_raw_parts_mut(out_buf as *mut u8, copy_len) };\n    dst.copy_from_slice(&bytes[..copy_len]);\n    if copy_len > 0 {\n        dst[copy_len - 1] = 0;\n    }\n    // Return the required length (excluding the NUL) so the caller can detect\n    // truncation and retry with a bigger buffer.\n    (c_res.as_bytes().len()) as c_int\n}\n\n/// Per-turn budget ratio: most-constrained dimension wins. Returns ratio in\n/// [0, 1]. JSON in: {"limits":{t,c,d,tc,mc},"used":{t,c,d,tc,mc}} where\n/// non-finite values are encoded as `null` (matches the JS Number.POSITIVE_INFINITY\n/// convention). NaN/Inf in the JSON are also accepted as "no cap".\n/// JSON out: {"ratio":0.5,"phase":3} (phase: 0=exhausted,1=verify,2=cheap,3=reduced,4=full).\n#[no_mangle]\npub unsafe extern "C" fn mochi_budget_decide(\n    input_ptr: *const c_char,\n    out_buf: *mut c_char,\n    out_cap: usize,\n) -> c_int {\n    if input_ptr.is_null() || out_buf.is_null() || out_cap == 0 {\n        return -1;\n    }\n    let Ok(input) = (unsafe { CStr::from_ptr(input_ptr) }).to_str() else {\n        return -1;\n    };\n\n    // Minimal JSON extractor — only the fields we need, no full parser dep.\n    let limits = budget::BudgetLimitsInput {\n        max_tokens: json_f64(input, &["limits", "maxTokens"]).unwrap_or(f64::NAN),\n        max_cost_usd: json_f64(input, &["limits", "maxCostUsd"]).unwrap_or(f64::NAN),\n        max_duration_ms: json_f64(input, &["limits", "maxDurationMs"]).unwrap_or(0.0),\n        max_tool_calls: json_f64(input, &["limits", "maxToolCalls"]).unwrap_or(f64::NAN),\n        max_model_calls: json_f64(input, &["limits", "maxModelCalls"]).unwrap_or(f64::NAN),\n    };\n    let used = budget::BudgetUsedInput {\n        used_tokens: json_f64(input, &["used", "usedTokens"]).unwrap_or(0.0),\n        used_cost_usd: json_f64(input, &["used", "usedCostUsd"]).unwrap_or(0.0),\n        used_duration_ms: json_f64(input, &["used", "usedDurationMs"]).unwrap_or(0.0),\n        used_tool_calls: json_f64(input, &["used", "usedToolCalls"]).unwrap_or(0.0),\n        used_model_calls: json_f64(input, &["used", "usedModelCalls"]).unwrap_or(0.0),\n    };\n    let ratio = budget::budget_ratio(&limits, &used);\n    let phase = budget::budget_phase_code(ratio);\n\n    let payload = format!(r#"{{"ratio":{},"phase":{}}}"#, ratio, phase);\n    let c_res = match CString::new(payload) {\n        Ok(s) => s,\n        Err(_) => return -1,\n\n// ... [File continues on GitHub repository] ...'
  },
  "native/mochi_core/Cargo.toml": {
    "path": "native/mochi_core/Cargo.toml",
    "name": "Cargo.toml",
    "dir": "native/mochi_core",
    "lang": "toml",
    "size": "0.3 KB",
    "lines": 20,
    "desc": "Cargo manifest with opt-level 3, LTO, and panic abort configuration",
    "code": '[package]\nname = "mochi_core"\nversion = "0.22.0"\nedition = "2021"\n\n[lib]\ncrate-type = ["cdylib", "rlib"]\n\n[[bin]]\nname = "mochi-agent"\npath = "src/main.rs"\n\n[dependencies]\n\n[profile.release]\nopt-level = 3\nlto = true\ncodegen-units = 1\npanic = "abort"\nstrip = true\n'
  },
  "bench/efficiency.mjs": {
    "path": "bench/efficiency.mjs",
    "name": "efficiency.mjs",
    "dir": "bench",
    "lang": "javascript",
    "size": "3.6 KB",
    "lines": 88,
    "desc": "Hardware-level RSS memory and cold-start measurement suite",
    "code": "#!/usr/bin/env node\n// Efficiency benchmark: measures cold-start wall time and peak resident memory\n// for Mochi's CLI (Node + Bun) and optionally a comparator like jcode, then\n// prints a compact comparison table. This is the measurable \"lightweight /\n// hardware-friendly\" proof.\n//\n// Usage:\n//   node bench/efficiency.mjs            # Mochi via Node + Bun\n//   MOCHI_BIN=./dist/cli.js node bench/efficiency.mjs\n//   COMPARE_BIN=/path/to/jcode node bench/efficiency.mjs   # add a comparator\n\nimport { spawnSync } from 'node:child_process';\nimport { fileURLToPath } from 'node:url';\nimport { dirname, resolve } from 'node:path';\n\nconst root = resolve(dirname(fileURLToPath(import.meta.url)), '..');\nconst VERSION_ARG = process.env.MOCHI_BIN ? [] : ['--version'];\n\nconst RUNS = Number(process.env.RUNS ?? 15);\n\nfunction measureTime(cmd, args, cwd) {\n  const t0 = performance.now();\n  const r = spawnSync(cmd, args, { cwd, stdio: 'ignore', encoding: 'utf8' });\n  const ms = performance.now() - t0;\n  return { ms, status: r.status, ok: r.status === 0 };\n}\n\nfunction measureMem(cmd, args, cwd) {\n  // /usr/bin/time -v gives \"Maximum resident set size (kbytes)\".\n  const r = spawnSync('/usr/bin/time', ['-v', cmd, ...args], { cwd, encoding: 'utf8', timeout: 60000 });\n  const err = r.stderr || '';\n  const m = err.match(/Maximum resident set size \\(kbytes\\): (\\d+)/);\n  return m ? Number(m[1]) : null;\n}\n\nfunction bench(target) {\n  const { label, cmd, args } = target;\n  let times = [];\n  for (let i = 0; i < RUNS; i++) {\n    const t = measureTime(cmd, args, root);\n    if (t.ok) times.push(t.ms);\n  }\n  const mems = [];\n  for (let i = 0; i < Math.max(1, Math.min(3, RUNS)); i++) {\n    const m = measureMem(cmd, args, root);\n    if (m) mems.push(m);\n  }\n  const avgTime = times.length ? (times.reduce((a, b) => a + b, 0) / times.length) : NaN;\n  const avgMem = mems.length ? Math.round(mems.reduce((a, b) => a + b, 0) / mems.length) : 0;\n  return { label, avgTime, avgMem, ok: times.length > 0 };\n}\n\n// Default targets: Mochi CLI under Node and Bun (when available), plus the\n// standalone native binary when it has been built (npm run build:bin).\nconst targets = [];\n\nlet nodeCmd;\ntry { nodeCmd = spawnSync('node', ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] }).status === 0 ? 'node' : null; } catch { nodeCmd = null; }\nif (nodeCmd) targets.push({ label: 'mochi (node)', cmd: 'node', args: ['dist/cli.js', ...VERSION_ARG] });\n\nlet bunCmd;\ntry { bunCmd = spawnSync('bun', ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] }).status === 0 ? 'bun' : null; } catch { bunCmd = null; }\nif (bunCmd) targets.push({ label: 'mochi (bun)', cmd: 'bun', args: ['dist/cli.js', ...VERSION_ARG] });\n\n// Native binary built by `npm run build:bin`.\nconst nativeBin = resolve(root, 'dist/mochi-bin');\nconst hasNative = spawnSync('test', ['-x', nativeBin], { stdio: 'ignore' }).status === 0;\nif (hasNative) targets.push({ label: 'mochi (bin)', cmd: nativeBin, args: ['--version'] });\n\n// Optional comparator from env, e.g. MOCHI_COMPARE=.../jcode\nif (process.env.MOCHI_COMPARE) {\n  targets.push({ label: 'compare', cmd: process.env.MOCHI_COMPARE, args: ['--version'] });\n}\n\nconst rows = [];\nfor (const t of targets) {\n  const r = bench(t);\n  rows.push(r);\n  console.log(`${r.label.padEnd(14)} ${r.avgTime.toFixed(1).padStart(8)}ms ${String(r.avgMem).padStart(7)}KB  ${r.avgMem ? '' : '(mem n/a)'}`);\n}\n\nif (rows.length >= 2) {\n  const node = rows.find((r) => r.label === 'mochi (node)');\n  const bun = rows.find((r) => r.label === 'mochi (bun)');\n  if (node && bun) {\n    console.log(`\\nBun vs Node: time ${(bun.avgTime / node.avgTime * 100).toFixed(1)}%, mem ${(bun.avgMem / node.avgMem * 100).toFixed(1)}%`);\n  }\n}"
  },
  "package.json": {
    "path": "package.json",
    "name": "package.json",
    "dir": ".",
    "lang": "json",
    "size": "2.8 KB",
    "lines": 72,
    "desc": "Project manifest with Bun compilation targets and zero runtime dependencies",
    "code": '{\n  "name": "@mochi/agent",\n  "version": "0.22.0",\n  "description": "Minimal, fast, autonomous coding agent: Rust runtime core with a TypeScript frontend.",\n  "type": "module",\n  "bin": {\n    "mochi": "./dist/cli.js"\n  },\n  "main": "./dist/index.js",\n  "types": "./dist/index.d.ts",\n  "exports": {\n    ".": {\n      "types": "./dist/index.d.ts",\n      "import": "./dist/index.js"\n    }\n  },\n  "files": [\n    "dist",\n    "native/bin",\n    "README.md",\n    "LICENSE"\n  ],\n  "scripts": {\n    "build": "tsc -p tsconfig.json && chmod +x dist/cli.js",\n    "prebuild:bin": "node scripts/sync-version.mjs",\n    "build:bin": "bun build src/cli.ts --compile --outfile dist/mochi-bin --target=bun",\n    "build:rust": "cargo build --release --manifest-path native/mochi_core/Cargo.toml && cp --remove-destination native/mochi_core/target/release/mochi-agent native/bin/ && cp --remove-destination native/mochi_core/target/release/libmochi_core.so native/bin/mochi_core.node && cp --remove-destination native/mochi_core/target/release/libmochi_core.so native/bin/",\n    "build:native": "mkdir -p native/bin && (cargo build --release --manifest-path native/mochi_core/Cargo.toml && cp --remove-destination native/mochi_core/target/release/mochi-agent native/bin/ && cp --remove-destination native/mochi_core/target/release/libmochi_core.so native/bin/mochi_core.node && cp --remove-destination native/mochi_core/target/release/libmochi_core.so native/bin/ || true) && (rustc -O -o native/bin/fuzzy_rust native/rust/fuzzy.rs || true) && (rustc -O -o native/bin/search_rust native/rust/search.rs || true) && (g++ -O2 -std=c++17 -o native/bin/fuzzy_cpp native/cpp/fuzzy.cpp || true)",\n    "dev": "tsx src/cli.ts",\n    "test": "vitest run",\n    "test:verbose": "vitest run --reporter=dot",\n    "bench": "node bench/startup.mjs",\n    "bench:efficiency": "node bench/efficiency.mjs",\n    "bench:task": "node bench/task.mjs",\n    "bench:stream": "tsx bench/streaming.mjs",\n    "typecheck": "tsc --noEmit",\n    "bench:memory": "node bench/memory.mjs",\n    "bench:speculation": "tsx bench/speculation.mjs",\n    "release:check": "node scripts/release-check.mjs"\n  },\n  "engines": {\n    "node": ">=22.0.0"\n  },\n  "devDependencies": {\n    "@types/node": "^22.0.0",\n    "@vitest/coverage-v8": "^5.0.3",\n    "tsx": "^4.19.0",\n    "typescript": "^5.9.0",\n    "vite": "^7.3.7",\n    "vitest": "^5.0.3"\n  },\n  "optionalDependencies": {\n    "tree-sitter-c-sharp": "^0.23.5",\n    "tree-sitter-cpp": "^0.23.4",\n    "tree-sitter-go": "^0.25.0",\n    "tree-sitter-java": "^0.23.5",\n    "tree-sitter-php": "^0.24.2",\n    "tree-sitter-python": "^0.25.0",\n    "tree-sitter-ruby": "^0.23.1",\n    "tree-sitter-rust": "^0.24.0",\n    "tree-sitter-typescript": "^0.23.2",\n    "web-tree-sitter": "^0.26.12"\n  },\n  "keywords": [\n    "ai",\n    "agent",\n    "coding-agent",\n    "terminal",\n    "llm"\n  ],\n  "license": "MIT"\n}\n'
  },
  "tsconfig.json": {
    "path": "tsconfig.json",
    "name": "tsconfig.json",
    "dir": ".",
    "lang": "json",
    "size": "0.5 KB",
    "lines": 22,
    "desc": "TypeScript strict compilation configuration",
    "code": '{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "NodeNext",\n    "moduleResolution": "NodeNext",\n    "lib": ["ES2022"],\n    "outDir": "./dist",\n    "rootDir": "./src",\n    "strict": true,\n    "esModuleInterop": true,\n    "skipLibCheck": true,\n    "forceConsistentCasingInFileNames": true,\n    "declaration": true,\n    "declarationMap": true,\n    "sourceMap": true,\n    "resolveJsonModule": true,\n    "noUnusedLocals": true,\n    "noUnusedParameters": true\n  },\n  "include": ["src/**/*"],\n  "exclude": ["node_modules", "dist", "**/*.test.ts"]\n}\n'
  },
  "README.md": {
    "path": "README.md",
    "name": "README.md",
    "dir": ".",
    "lang": "markdown",
    "size": "22.4 KB",
    "lines": 615,
    "desc": "Mochi official documentation and quick-start reference (showing readme core)",
    "code": '# 🍡 Mochi\n\n**➡️ [Website & Docs — xanstomper.github.io/mochi](https://xanstomper.github.io/mochi)**\n\n> Minimal Orchestrative Coding Harness Intelligence — a minimal, fast, autonomous coding agent for the terminal. Goals, task DAGs, teams,\n> a persistent daemon, and deep run traces on a Rust runtime core with a TypeScript\n> frontend.\n\nMochi is a from-scratch re-imagining of the terminal coding-agent harness. It keeps the\nbest ideas from Pi (tools, sessions, context files, minimal TUI) and adds first-class\nsupport for goals, task DAGs, teams, persistent state, checkpoints, verification,\nrecovery, budgets, hooks, retrieval, memory, and local harness learning.\n\n```bash\nnpm install && npm run build\nmochi "add a rate limiter to the auth service"   # one-shot agent run\nmochi daemon start --host 0.0.0.0                 # persistent agent over HTTP\nmochi daemon send "finish the auth flow"          # drive it from anywhere\nmochi team "ship the payments refactor"           # role-diverse agent team\nmochi trace <goalId>                               # replay any run end to end\n```\n\nZero runtime JS dependencies; runs under Node 22 or Bun, and ships a standalone native\nbinary (`npm run build:bin`) that needs no runtime at all. The performance core is a\nzero-dependency Rust crate (`native/mochi_core`): tokenization, budget math, context\ncompaction planning, and agent-loop decisions run natively, with the TypeScript frontend\nhandling model I/O, TUI, and tool execution. Every native path has a parity-tested TS\nfallback, so nothing breaks when the Rust binary is absent (CI, cold installs). The\nharness is polyglot: 15-language registry, tree-sitter codegraph, and native Rust/C++\naccelerators in the `edit`/`patch` hot paths.\n\n## Comprehensive Documentation\n\n- **[Technical Architecture Blueprint](docs/ARCHITECTURE.md)**: Deep dive into the dual-engine Rust Core + TypeScript TUI architecture, compaction protocols, and event loops.\n- **[Complete Capabilities Reference](docs/CAPABILITIES.md)**: Detailed breakdown of the **16 specialized agent roles**, 30+ native tools, 30+ skills, and MCP/ACP protocols.\n- **[Empirical Benchmarks vs Other Agents](docs/BENCHMARKS.md)**: Standardized PSS memory, TTFF, TTFI, and compaction latency benchmarks vs jcode, Claude Code, Cursor, Copilot, and OpenCode.\n- **[CLI & Interface Reference](docs/CLI_REFERENCE.md)**: Complete guide to CLI flags, daemon endpoints, interactive slash commands, and keybindings.\n\n## Performance Highlights (vs Other Agents)\n\n| Benchmark Metric | Mochi (Rust Core) | jcode | Cursor Agent | Claude Code | OpenCode |\n| :--- | :--- | :--- | :--- | :--- |\n| **1 Active Session (PSS)** | **18.2 MB** [1st] | 27.8 MB | 214.9 MB | 386.6 MB | 371.5 MB |\n| **10 Active Sessions (PSS)**| **84.5 MB** [1st] | 117.0 MB | 1632.4 MB | 2300.6 MB | 3237.2 MB |\n| **Time to First Frame (TTFF)**| **11.2 ms** [1st] | 14.0 ms | 1949.7 ms | 3436.9 ms | 1035.9 ms |\n| **Time to First Input (TTFI)**| **38.2 ms** [1st] | 48.7 ms | 1978.7 ms | 3512.8 ms | 1047.9 ms |\n| **Compaction Cut Calculation** | **0.12 ms** (Rust) [1st]| 0.45 ms | 14.5 ms | 35.0 ms | 19.8 ms |\n\n*See full test methodology, PTY probe scripts, and 9-agent comparison tables in [docs/BENCHMARKS.md](docs/BENCHMARKS.md).*\n\n## Status\n\nImplemented:\n\n- Event bus architecture\n- Model-agnostic frontier provider router (Anthropic, OpenAI, Gemini, DeepSeek, Ollama)\n- Model routing by capability profile (`fast` / `coding` / `reasoning` / `review`)\n- Budget-aware model fallback\n- Tool bus: `read`, `write`, `edit`, `delete`, `shell`, `search`, `glob`, `git`, `inspect`, `memory`, `patch`, `todo`, `skill`, `subagent`\n- Codex-style multi-file `patch` tool (`*** Begin Patch` / `Add` / `Update` / `Delete File` sections) with context matching that tolerates whitespace drift\n- `edit` tool falls back to whitespace-insensitive matching (unique anchor required; ambiguity is refused rather than guessing)\n- Permission system (`safe` / `ask` / `auto`)\n- Adaptive context engine with token budget, compaction, project memory, and retrieval\n- Agent runtime loop: preflight → model → tools → verify → recover → pulse\n- Persistent goals and task DAG scheduler\n- Team orchestration with role-based agents\n- Agent profiles from `.mochi/agents/*.md`\n- Independent verifier and outcome judge\n- Budget engine with token, cost, time, tool, model, and agent limits\n- Hook pipeline (`before_*`, `after_*`, `on_*`)\n- Intelligent retrieval across files, symbols, references, imports, and git history\n- Speculative execution for difficult problems\n- Project memory and cross-session engineering facts\n- Local harness learning for successful recovery strategies\n- Git checkpoint / rollback\n- Interactive terminal UI with rounded input, transcript, command palette, and status bar\n- Multiple workspaces\n- Persistent daemon over HTTP: `start/status/jobs/send/approve/resume/cron/stop`\n- Durable run traces with deep redaction (`mochi trace [<goalId>]`)\n- Full-text session history in SQLite+FTS5 (`mochi session list` / `mochi session search`)\n- Recurring agent jobs on a schedule (`mochi daemon cron add|list|remove`)\n- Credential pools: multi-key rotation on 401/429/403\n- Shared client-side rate throttle: leaky-bucket RPM + concurrency cap so concurrent agents/sessions self-regulate a free-tier endpoint instead of tripping 429s in a burst (`MOCHI_RATE_LIMIT_RPM`, `MOCHI_RATE_LIMIT_CONCURRENCY`)\n- Instant per-file diagnostics (TS LanguageService + Python) after every edit\n- Background tasks: async shell (`shell` with `background:true`) + result delivery\n- Name-addressed whole-symbol edit (`replace_symbol` via the code symbol index)\n- Baseline + proportionate verification (pre-existing repo debt doesn\'t fail correct work)\n- Mid-stream cancellation: Ctrl-C aborts the model request on the wire\n- Structured stop reasons (`completed`/`aborted`/`runtime_limit`/`budget`/`model_error`/...) on every `AgentResult`\n- Warm-start resume: prior session transcript + failed attempts injected on restart\n- Unit and integration tests\n\n## Quick start\n\n```bash\n# Build\nnpm install\nnpm run build\n\n# Link globally (optional)\nln -s $(pwd)/dist/cli.js ~/.local/bin/mochi\n\n# Set an API key\nexport ANTHROPIC_API_KEY=sk-ant-...\n\n# Interactive mode\nmochi\n\n# One-shot task\nmochi -p "list all TypeScript files"\n\n# Plan only\nmochi plan "refactor authentication"\n\n# Autonomous goal\nmochi goal "fix all failing tests"\n\n# Team goal\nmochi team "build a REST API for users"\n\n# Inspect a symbol or subsystem\nmochi inspect "SessionManager"\n\n# Speculative reasoning\nmochi speculate "difficult TS2345 failure"\n\n# Own terminal window (black bg, monospace, 190x45)\nmochi term\nmochi term --geometry 100x30 -- goal "fix auth"\n\n# Shell completions (bash|zsh|fish)\neval "$(mochi completion bash)"\n\n# Skill sharing\nmochi skills pack my-skill --out ./pack     # bundle installed skills\nmochi skills unpack ./pack --force          # install a pack\n```\n\n> **Speculative preflight** (`model.speculative.preflight: true` in config): for hard\n> non-chat tasks, mochi runs a cheap speculative pass before the main loop call and\n> injects the chosen approach + alternatives as a system hint, so the model commits\n> to a better plan before firing tools (DeepSeek/Cline-style "think a cheap model\n> ahead"). `model.speculative.selfCritique: true` reinforces the loop\'s existing\n> failure-repair flow on the first verification miss. Both are opt-in and never block\n> the task — a failed/skipped preflight degrades to a normal run.\n\n## Configuration\n\nGlobal: `~/.config/mochi/config.json`\nProject: `.mochi/config.json`\n\n```json\n{\n  "model": {\n    "provider": "anthropic",\n    "apiKey": "sk-...",\n    "model": "claude-3-5-haiku",\n    "profiles": {\n      "fast": "claude-3-5-haiku",\n      "coding": "claude-3-5-haiku",\n      "reasoning": "claude-3-7-sonnet",\n      "review": "claude-3-7-sonnet"\n    },\n    "speculative": {\n      "preflight": true,\n      "selfCritique": true\n    }\n  },\n  "safety": {\n    "mode": "ask",\n    "maxIterations": 8,\n    "maxConcurrentAgents": 3,\n    "contextBudgetTokens": 32000,\n    "maxTokens": 150000,\n    "maxCostUsd": 2,\n    "maxModelCalls": 100,\n    "maxToolCalls": 200,\n    "sandbox": "off"\n  },\n  "permissions": {\n    "read": true,\n    "write": true,\n    "shell": true,\n    "network": true,\n    "gitDestructive": false\n  },\n  "mcpServers": {\n    "memory": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-memory"],\n      "env": {}\n    }\n  },\n  "planMode": false\n}\n```\n\n### Environment switches (no config file needed)\n\n```bash\nMOCHI_YOLO=1 mochi goal "..."        # auto-approve everything (same as --yolo)\nMOCHI_SANDBOX=auto mochi -p "..."    # bubblewrap isolation when available (off|auto|bubblewrap)\nMOCHI_SAFETY=auto mochi              # safety mode override (safe|ask|auto|uncensored)\n```\n\nModel auto-escalation: after 3 consecutive verification failures the harness\nhands the task one tier up (fast→coding→reasoning) to a *different configured*\nmodel, once per task — free models attempt first, stronger models rescue stuck\nwork. Configure distinct models per tier under `model.profiles` for it to bite.\n\n### MCP servers\n\n`mcpServers` entries are stdio MCP servers (spawned per run) or HTTP servers\n(`{ "url": "https://…", "headers": {...} }` for Streamable-HTTP endpoints).\nEach handshakes over JSON-RPC, and its tools are registered natively as\n`serverName__toolName` (e.g. `memory__create_entities`) with `network`\npermission, so the model calls them like any built-in tool. Failed servers are\nlogged and skipped; a crashed server rejects its pending calls instead of\nhanging the run. Servers that expose MCP **resources** additionally get\n`serverName__resources_list` and `serverName__resources_read` tools (read\npermission) so the model can pull server-provided context on demand.\nDiscover and install built-ins without hand-editing JSON:\n`mochi mcp search <keywords>` (also `/mcp search` in the TUI) and\n`mochi mcp add <server-id>` write `.mcp.json` for you. Servers needing\nbearer tokens use pre-registered OAuth client credentials (no browser flow):\n`{ "url": "https://…", "oauth": { "tokenUrl": "https://…", "clientId": "${CLIENT_ID}",\n"clientSecret": "${CLIENT_SECRET}", "scope": "…" } }` — `${ENV}` refs keep\nsecrets out of the file; tokens cache under `~/.mochi/mcp-oauth.json` (0600)\nand refresh automatically.\n\n### Plan-then-act mode\n\nSet `"planMode": true` in config or pass `--plan` on any run: every agent\nresearches with read-only tools and returns a plan (steps, files, risks,\nverification). Mutating tools (`write`/`edit`/`delete`/`shell`) are vetoed, the\nmodel is redirected to produce the plan, and no files are changed.\n\n### Subagent delegation\n\nThe `subagent` tool lets the model delegate a self-contained subtask to a fresh\nchild agent that shares the run\'s budget, read cache, and workspace, returning a\nsummary. Delegation is one level deep (children cannot spawn grandchildren) to\nbound runaway fan-out.\n\n### Client-side rate throttling (concurrent agents)\n\nEvery model call already retries transient failures (429/5xx/timeout) with\nexponential backoff honoring `Retry-After` and rotating pooled keys. But when\nseveral processes, sessions, or sub-agents share **one free-tier endpoint**, they\ncan trip rate limits *faster* than retry recovery can keep up. A lightweight\nleaky-bucket throttle placed ahead of the wire lets concurrent agents\nself-regulate the burst so they collectively land under the provider\'s RPM\nceiling instead of hammering it. Retries then absorb only the residual jitter.\n\nThe throttle is a single process-global token bucket that `withRetries` consults\nbefore each request. It is **opt-in** (a no-op by default, so single-agent runs\nkeep their current latency):\n\n```bash\n# Cap request rate at ~10 calls/minute\nMOCHI_RATE_LIMIT_RPM=10 mochi "..."\n\n# Also cap simultaneous in-flight requests to 2 (e.g. multiple Terminus sessions)\nMOCHI_RATE_LIMIT_CONCURRENCY=2 mochi "..."\n\n# Typical free-tier hardening when driving several agents at once:\nMOCHI_RATE_LIMIT_RPM=20 MOCHI_RATE_LIMIT_CONCURRENCY=3 mochi daemon start\n```\n\nThe bucket never blocks past the provider\'s own retry budget: it only delays up\nto the configured refill pace, and the whole throttle is bypassed when neither\nenv var is set.\n\n## Agent profiles\n\nCreate lightweight profiles in `.mochi/agents/`:\n\n```markdown\n---\nname: debugger\n\n// ... [File continues on GitHub repository] ...'
  },
  "LICENSE": {
    "path": "LICENSE",
    "name": "LICENSE",
    "dir": ".",
    "lang": "text",
    "size": "1.0 KB",
    "lines": 21,
    "desc": "Official MIT Open Source License",
    "code": 'MIT License\n\nCopyright (c) 2026 xanstomper\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n'
  }
};
const ALL_REPO_PATHS = [
  ".gitattributes",
  ".github/workflows/ci.yml",
  ".gitignore",
  ".mochi-audit/COMPETITOR-MATRIX.md",
  ".mochi-audit/speculation-bench.json",
  ".mochi-audit/tui-smoke/plain.txt",
  ".npmrc",
  ".nvmrc",
  "ARCHITECTURE.md",
  "CHANGELOG.md",
  "LICENSE",
  "MASTER-PROMPT.md",
  "MASTER_PROMPT.md",
  "MOCHI.md",
  "README.md",
  "TECHMAP.md",
  "bench/arena.mjs",
  "bench/efficiency.mjs",
  "bench/memory.mjs",
  "bench/speculation.mjs",
  "bench/startup.mjs",
  "bench/streaming.mjs",
  "bench/task.mjs",
  "bin/mochi",
  "examples/agents/architect.md",
  "examples/agents/coder.md",
  "examples/agents/debugger.md",
  "examples/agents/reviewer.md",
  "examples/agents/tester.md",
  "examples/memory/project.md",
  "native/README.md",
  "native/cpp/fuzzy.cpp",
  "native/mochi_core/Cargo.lock",
  "native/mochi_core/Cargo.toml",
  "native/mochi_core/src/acp.rs",
  "native/mochi_core/src/agent_loop.rs",
  "native/mochi_core/src/autopsy.rs",
  "native/mochi_core/src/budget.rs",
  "native/mochi_core/src/cmdprobe.rs",
  "native/mochi_core/src/codegraph.rs",
  "native/mochi_core/src/context.rs",
  "native/mochi_core/src/daemon.rs",
  "native/mochi_core/src/diff.rs",
  "native/mochi_core/src/fold.rs",
  "native/mochi_core/src/fuzzy.rs",
  "native/mochi_core/src/git.rs",
  "native/mochi_core/src/http_client.rs",
  "native/mochi_core/src/kv_cache.rs",
  "native/mochi_core/src/lib.rs",
  "native/mochi_core/src/main.rs",
  "native/mochi_core/src/mcp_gateway.rs",
  "native/mochi_core/src/memory_index.rs",
  "native/mochi_core/src/napi.rs",
  "native/mochi_core/src/patch_engine.rs",
  "native/mochi_core/src/planner.rs",
  "native/mochi_core/src/pty_manager.rs",
  "native/mochi_core/src/redact.rs",
  "native/mochi_core/src/repo.rs",
  "native/mochi_core/src/risk.rs",
  "native/mochi_core/src/search.rs",
  "native/mochi_core/src/skills.rs",
  "native/mochi_core/src/speculative_decoder.rs",
  "native/mochi_core/src/sqlite_engine.rs",
  "native/mochi_core/src/stream.rs",
  "native/mochi_core/src/symbol_analyzer.rs",
  "native/mochi_core/src/tokenizer.rs",
  "native/mochi_core/src/tokens.rs",
  "native/mochi_core/src/tui_renderer.rs",
  "native/mochi_core/src/tui_state.rs",
  "native/mochi_core/src/verification.rs",
  "native/rust/fuzzy.rs",
  "native/rust/search.rs",
  "package-lock.json",
  "package.json",
  "scripts/browser-driver.mjs",
  "scripts/check-skips.mjs",
  "scripts/release-check.mjs",
  "scripts/skip-baseline.txt",
  "scripts/sync-version.mjs",
  "scripts/tui-pty-smoke.ts",
  "scripts/tui-smoke.sh",
  "scripts/vitest-bun-test-shim.ts",
  "skills/README.md",
  "skills/acp-setup/SKILL.md",
  "skills/anthropic-research/SKILL.md",
  "skills/antigravity-cli/SKILL.md",
  "skills/api-design/SKILL.md",
  "skills/backend-architecture/SKILL.md",
  "skills/claude-design/SKILL.md",
  "skills/code-refactoring/SKILL.md",
  "skills/code-review/SKILL.md",
  "skills/cognitive-anchor/SKILL.md",
  "skills/cognitive-anchor/examples/checkpoint-recovery.md",
  "skills/cognitive-anchor/examples/epistemic-classification.md",
  "skills/cognitive-anchor/examples/object-continuity.md",
  "skills/cognitive-anchor/examples/recovery-discipline.md",
  "skills/cognitive-anchor/references/cheatsheet.md",
  "skills/cognitive-anchor/references/execution-continuity.md",
  "skills/cognitive-dox/SKILL.md",
  "skills/cognitive-dox/examples/child-agents.md",
  "skills/cognitive-dox/examples/root-agents.md",
  "skills/cognitive-dox/references/closeout-protocol.md",
  "skills/cognitive-dox/references/hierarchy-guide.md",
  "skills/cognitive-owl/.claude/settings.local.json",
  "skills/cognitive-owl/SKILL.md",
  "skills/cognitive-owl/adapters/.aider.conf.yml",
  "skills/cognitive-owl/adapters/.cursorrules",
  "skills/cognitive-owl/adapters/.windsurfrules",
  "skills/cognitive-owl/adapters/CLAUDE.md",
  "skills/cognitive-owl/adapters/continue-config.yaml",
  "skills/cognitive-owl/adapters/system-prompt.md",
  "skills/cognitive-owl/examples/epistemics-surfaces.md",
  "skills/cognitive-owl/examples/pressure-panic.md",
  "skills/cognitive-owl/examples/reality-triggers.md",
  "skills/cognitive-owl/examples/reset-recovery.md",
  "skills/cognitive-owl/examples/silent-execution.md",
  "skills/cognitive-owl/examples/sispis-integration.md",
  "skills/cognitive-owl/examples/sycophancy-resistance.md",
  "skills/cognitive-owl/examples/verification-triggers.md",
  "skills/cognitive-owl/references/cheatsheet.md",
  "skills/cognitive-owl/references/pressure-protocol.md",
  "skills/cognitive-owl/references/signal-schema.md",
  "skills/cognitive-sispis/SKILL.md",
  "skills/cognitive-sispis/adapters/.aider.conf.yml",
  "skills/cognitive-sispis/adapters/.cursorrules",
  "skills/cognitive-sispis/adapters/.windsurfrules",
  "skills/cognitive-sispis/adapters/CLAUDE.md",
  "skills/cognitive-sispis/adapters/continue-config.yaml",
  "skills/cognitive-sispis/adapters/system-prompt.md",
  "skills/cognitive-sispis/examples/high-entropy-hard-override.md",
  "skills/cognitive-sispis/examples/high-entropy-required.md",
  "skills/cognitive-sispis/examples/implicit-decision-detect.md",
  "skills/cognitive-sispis/examples/low-entropy-suppressed.md",
  "skills/cognitive-sispis/examples/medium-entropy-activation.md",
  "skills/cognitive-sispis/examples/no-decision-mode.md",
  "skills/cognitive-sispis/examples/schema-bypass.md",
  "skills/cognitive-sispis/examples/user-override.md",
  "skills/cognitive-sispis/examples/writing-task.md",
  "skills/cognitive-sispis/references/cheatsheet.md",
  "skills/cognitive-sispis/references/communication-framework.md",
  "skills/cognitive-sispis/references/response-schema.md",
  "skills/core-harness/SKILL.md",
  "skills/cursor-workflow/SKILL.md",
  "skills/database-design.md",
  "skills/database-optimizer/SKILL.md",
  "skills/debugging/SKILL.md",
  "skills/deep-research/SKILL.md",
  "skills/devin-mode/SKILL.md",
  "skills/devops-ci/SKILL.md",
  "skills/docker-containerization/SKILL.md",
  "skills/docker-deploy.md",
  "skills/eval-design/SKILL.md",
  "skills/frontend-craft/SKILL.md",
  "skills/fullstack-dev/SKILL.md",
  "skills/gemini-learning/SKILL.md",
  "skills/geospy-methodology/SKILL.md",
  "skills/git-wizard/SKILL.md",
  "skills/git-workflow/SKILL.md",
  "skills/github-copilot/SKILL.md",
  "skills/golang-pro/SKILL.md",
  "skills/gpt-5-agent/SKILL.md",
  "skills/hermes-workflow/SKILL.md",
  "skills/implementation/SKILL.md",
  "skills/jetplane-whisper/SKILL.md",
  "skills/lazy-chameleon/README.md",
  "skills/lazy-chameleon/SKILL.md",
  "skills/markdown-docs.md",
  "skills/mcp-setup/SKILL.md",
  "skills/memory-design/SKILL.md",
  "skills/mochi-architecture/SKILL.md",
  "skills/mochi-prompt-compiler.md",
  "skills/o3-reasoning/SKILL.md",
  "skills/openai-advanced-memory/SKILL.md",
  "skills/openai-canvas-canmore/SKILL.md",
  "skills/openai-python-repl/SKILL.md",
  "skills/performance-optimization.md",
  "skills/performance-profiling/SKILL.md",
  "skills/python-expert/SKILL.md",
  "skills/redteam-packs/SKILL.md",
  "skills/refactoring.md",
  "skills/release-management.md",
  "skills/replication-design/SKILL.md",
  "skills/research/SKILL.md",
  "skills/reverse-engineering/SKILL.md",
  "skills/rigorous-code-review/SKILL.md",
  "skills/rust-engineer/SKILL.md",
  "skills/security-audit/SKILL.md",
  "skills/security-review.md",
  "skills/skill-authoring/SKILL.md",
  "skills/tdd-workflow/SKILL.md",
  "skills/testing-strategy.md",
  "skills/testing/SKILL.md",
  "skills/tools-design/SKILL.md",
  "skills/tui-design/SKILL.md",
  "skills/tui-development.md",
  "skills/tui-primitives/00_COMPLETE_INDEX.md",
  "skills/tui-primitives/00_INDEX.md",
  "skills/tui-primitives/00_SUPPLEMENTARY_INDEX.md",
  "skills/tui-primitives/01_blessed_primitives.md",
  "skills/tui-primitives/01_bracket-lib_primitives.md",
  "skills/tui-primitives/02_chafa_primitives.md",
  "skills/tui-primitives/02_textual_primitives.md",
  "skills/tui-primitives/03_cmatrix_primitives.md",
  "skills/tui-primitives/03_urwid_primitives.md",
  "skills/tui-primitives/04_ctx-graphics_primitives.md",
  "skills/tui-primitives/04_kitty_wezterm_primitives.md",
  "skills/tui-primitives/05_dotgrid_primitives.md",
  "skills/tui-primitives/06_kitty-protocol_primitives.md",
  "skills/tui-primitives/07_SCROLLING_SYSTEMS.md",
  "skills/tui-primitives/07_libcaca_primitives.md",
  "skills/tui-primitives/08_libtcod_primitives.md",
  "skills/tui-primitives/09_notcurses_primitives.md",
  "skills/tui-primitives/10_objcurses_primitives.md",
  "skills/tui-primitives/11_rich_primitives.md",
  "skills/tui-primitives/12_ronin_primitives.md",
  "skills/tui-primitives/13_tcell_primitives.md",
  "skills/tui-primitives/14_termflix_primitives.md",
  "skills/tui-primitives/15_terminaltexteffects_primitives.md",
  "skills/tui-primitives/16_UnicodePlots_primitives.md",
  "skills/tui-primitives/17_NETWORKING.md",
  "skills/tui-primitives/17_charmbracelet_coding_agents.md",
  "skills/tui-primitives/18_animation_alive_patterns.md",
  "skills/tui-primitives/CANOPY_PRIMITIVES.md",
  "skills/tui-primitives/GUIDE_TO_TUI.md",
  "skills/tui-primitives/INDEX.md",
  "skills/tui-primitives/REPORTS/INTERESTING_FIRSTS.md",
  "skills/tui-primitives/REPORTS/REPORT_MACHINE_READABLE.md",
  "skills/tui-primitives/REPORTS/REPORT_NEW_CONCEPTS.md",
  "skills/tui-primitives/REPORTS/REPORT_PRIMITIVE_COMBINATIONS.md",
  "skills/tui-primitives/REPORTS/RICH_PRIMITIVES_ANALYSIS.md",
  "skills/tui-primitives/REPORTS/RONIN_ASSESSMENT.md",
  "skills/tui-primitives/REPORTS/STUDY_REPORT.md",
  "skills/tui-primitives/SKILL.md",
  "skills/tui-primitives/SUMMARY.md",
  "skills/tui-primitives/alacritty-primitives.md",
  "skills/tui-primitives/bubbles-primitives.md",
  "skills/tui-primitives/bubbletea-primitives.md",
  "skills/tui-primitives/charm-primitives.md",
  "skills/tui-primitives/colorprofile-primitives.md",
  "skills/tui-primitives/fang-primitives.md",
  "skills/tui-primitives/fig-primitives.md",
  "skills/tui-primitives/fterm-primitives.md",
  "skills/tui-primitives/glamour-primitives.md",
  "skills/tui-primitives/gum-primitives.md",
  "skills/tui-primitives/harmonica-primitives.md",
  "skills/tui-primitives/huh-primitives.md",
  "skills/tui-primitives/imgui-primitives.md",
  "skills/tui-primitives/lipgloss-primitives.md",
  "skills/tui-primitives/log-primitives.md",
  "skills/tui-primitives/pony-primitives.md",
  "skills/tui-primitives/pop-primitives.md",
  "skills/tui-primitives/raylib-primitives.md",
  "skills/tui-primitives/ultraviolet-primitives.md",
  "skills/tui-primitives/vhs-primitives.md",
  "skills/tui-primitives/wish-wishlist-primitives.md",
  "skills/tui-primitives/x-ansi-primitives.md",
  "skills/tui-primitives/x-cellbuf-primitives.md",
  "skills/tui-primitives/x-colors-primitives.md",
  "skills/tui-primitives/x-input-primitives.md",
  "skills/tui-primitives/x-term-primitives.md",
  "skills/tui-primitives/x-wcwidth-primitives.md",
  "skills/typescript-master/SKILL.md",
  "skills/vscode-copilot/SKILL.md",
  "skills/web-design/SKILL.md",
  "skills/webui-development.md",
  "src/acp.test.ts",
  "src/acp.ts",
  "src/agent/baseline.integration.test.ts",
  "src/agent/chaos.test.ts",
  "src/agent/compact-cutpoints.test.ts",
  "src/agent/contentonly.test.ts",
  "src/agent/error-diagnostics.test.ts",
  "src/agent/error-diagnostics.ts",
  "src/agent/failover.test.ts",
  "src/agent/hygiene.test.ts",
  "src/agent/kill9-resume.test.ts",
  "src/agent/loop-state.test.ts",
  "src/agent/loop-state.ts",
  "src/agent/loop.live.test.ts",
  "src/agent/loop.test.ts",
  "src/agent/loop.ts",
  "src/agent/speculative.test.ts",
  "src/agent/speculative.ts",
  "src/agent/warmstart.test.ts",
  "src/agents/profile.test.ts",
  "src/agents/profile.ts",
  "src/ambient.test.ts",
  "src/ambient.ts",
  "src/budget.test.ts",
  "src/budget.ts",
  "src/chameleon.test.ts",
  "src/chameleon.ts",
  "src/chameleon/adaptive-moe.ts",
  "src/chameleon/dense-dataset-synthesizer.ts",
  "src/chameleon/index.ts",
  "src/chameleon/task-classifier.ts",
  "src/chameleon/token-saver.ts",
  "src/circle.ts",
  "src/clarify.test.ts",
  "src/clarify.ts",
  "src/cli.ts",
  "src/codegraph.multilang.test.ts",
  "src/cognitive/anchor.ts",
  "src/cognitive/chameleon.ts",
  "src/cognitive/cognitive.test.ts",
  "src/cognitive/dox.ts",
  "src/cognitive/index.ts",
  "src/cognitive/integration.test.ts",
  "src/cognitive/owl.ts",
  "src/cognitive/sispis.ts",
  "src/completion.test.ts",
  "src/completion.ts",
  "src/config.test.ts",
  "src/config.ts",
  "src/context-compaction-fidelity.test.ts",
  "src/context.freshness.test.ts",
  "src/context.skills-relevance.test.ts",
  "src/context.test.ts",
  "src/context.ts",
  "src/contract.ts",
  "src/core/ast-guard.test.ts",
  "src/core/ast-guard.ts",
  "src/core/ast-slicer.test.ts",
  "src/core/ast-slicer.ts",
  "src/core/branch-racer.test.ts",
  "src/core/branch-racer.ts",
  "src/core/capability-registry.ts",
  "src/core/capability.test.ts",
  "src/core/capability.ts",
  "src/core/context-budget.ts",
  "src/core/diff-hygiene.test.ts",
  "src/core/diff-hygiene.ts",
  "src/core/env-profiler.test.ts",
  "src/core/env-profiler.ts",
  "src/core/execution-registry.test.ts",
  "src/core/execution-registry.ts",
  "src/core/git-plumbing.ts",
  "src/core/mutation.test.ts",
  "src/core/mutation.ts",
  "src/core/one-shot.test.ts",
  "src/core/one-shot.ts",
  "src/core/output-condenser.test.ts",
  "src/core/output-condenser.ts",
  "src/core/plan-cache.test.ts",
  "src/core/plan-cache.ts",
  "src/core/prefetch.test.ts",
  "src/core/prefetch.ts",
  "src/core/taskkind.test.ts",
  "src/core/taskkind.ts",
  "src/core/test-density.test.ts",
  "src/core/test-density.ts",
  "src/core/testdetect.test.ts",
  "src/core/testdetect.ts",
  "src/core/tool-dispatcher.test.ts",
  "src/core/tool-dispatcher.ts",
  "src/core/tool-output.test.ts",
  "src/core/tool-output.ts",
  "src/core/tool-sequence.test.ts",
  "src/core/tool-sequence.ts",
  "src/curate-auto-skills.test.ts",
  "src/daemon.live.test.ts",
  "src/daemon/background-tasks.test.ts",
  "src/daemon/background-tasks.ts",
  "src/daemon/cron.test.ts",
  "src/daemon/cron.ts",
  "src/daemon/daemon-server.ts",
  "src/daemon/daemon.test.ts",
  "src/daemon/daemon.ts",
  "src/daemon/scheduler.ts",
  "src/discord.test.ts",
  "src/discord.ts",
  "src/docgen.test.ts",
  "src/docgen.ts",
  "src/doctor.test.ts",
  "src/doctor.ts",
  "src/dox.test.ts",
  "src/dox.ts",
  "src/esm-hygiene.test.ts",
  "src/events.test.ts",
  "src/events.ts",
  "src/exec.test.ts",
  "src/exec.ts",
  "src/fact-attribution.test.ts",
  "src/features/skill-importer.test.ts",
  "src/features/skill-importer.ts",
  "src/features/skill-registry.test.ts",
  "src/features/skill-registry.ts",
  "src/goals/goal.test.ts",
  "src/goals/goal.ts",
  "src/goals/scheduler.test.ts",
  "src/goals/scheduler.ts",
  "src/goals/session.integration.test.ts",
  "src/goals/task.ts",
  "src/hooks.test.ts",
  "src/hooks.ts",
  "src/index.ts",
  "src/learning.test.ts",
  "src/learning.ts",
  "src/lessons.test.ts",
  "src/lessons.ts",
  "src/mcp/deepwiki-server.ts",
  "src/mcp/index.test.ts",
  "src/mcp/index.ts",
  "src/mcp/oauth.test.ts",
  "src/mcp/oauth.ts",
  "src/mcp/tools.test.ts",
  "src/mcp/tools.ts",
  "src/memory-recall.test.ts",
  "src/memory/consolidate.test.ts",
  "src/memory/consolidate.ts",
  "src/memory/memory-store.ts",
  "src/memory/memory.test.ts",
  "src/memory/memory.ts",
  "src/memory/project-memory.test.ts",
  "src/memory/project-memory.ts",
  "src/memory/relevance.test.ts",
  "src/memory/relevance.ts",
  "src/memory/retention.ts",
  "src/memory/retrieval.test.ts",
  "src/memory/retrieval.ts",
  "src/model/abort.test.ts",
  "src/model/anthropic.test.ts",
  "src/model/anthropic.ts",
  "src/model/capability.test.ts",
  "src/model/capability.ts",
  "src/model/credential-pool.test.ts",
  "src/model/credential-pool.ts",
  "src/model/dual-dispatch.ts",
  "src/model/failover.test.ts",
  "src/model/gemini.test.ts",
  "src/model/gemini.ts",
  "src/model/kv-cache.test.ts",
  "src/model/kv-cache.ts",
  "src/model/model-manager.test.ts",
  "src/model/model-manager.ts",
  "src/model/model-router.test.ts",
  "src/model/model-router.ts",
  "src/model/openai.midconv.test.ts",
  "src/model/openai.ts",
  "src/model/provider-failure.test.ts",
  "src/model/provider-failure.ts",
  "src/model/providers.test.ts",
  "src/model/providers.ts",
  "src/model/rate-limit.test.ts",
  "src/model/rate-limit.ts",
  "src/model/router.capability.test.ts",
  "src/model/router.ts",
  "src/model/select.test.ts",
  "src/model/usage.test.ts",
  "src/model/usage.ts",
  "src/modes.test.ts",
  "src/modes.ts",
  "src/native/agent-protocol.test.ts",
  "src/native/agent-protocol.ts",
  "src/native/core.test.ts",
  "src/native/core.ts",
  "src/observability/autopsy.test.ts",
  "src/observability/autopsy.ts",
  "src/observability/diagnosis.test.ts",
  "src/observability/diagnosis.ts",
  "src/observability/diagnostics.test.ts",
  "src/observability/diagnostics.ts",
  "src/observability/feedback.ts",
  "src/observability/perf.test.ts",
  "src/observability/perf.ts",
  "src/observability/performance-pipeline.test.ts",
  "src/observability/performance-pipeline.ts",
  "src/observability/trace.test.ts",
  "src/observability/trace.ts",
  "src/output-archive.test.ts",
  "src/pipeline.test.ts",
  "src/pipeline.ts",
  "src/plugins.test.ts",
  "src/plugins.ts",
  "src/pr.test.ts",
  "src/pr.ts",
  "src/prefetch-ledger.test.ts",
  "src/prompt-quality.test.ts",
  "src/prompt/prompt-compiler.test.ts",
  "src/prompt/prompt-compiler.ts",
  "src/prompt/prompt-expander.ts",
  "src/repo/codebase-sql.test.ts",
  "src/repo/codebase-sql.ts",
  "src/repo/codegraph.ts",
  "src/repo/git.test.ts",
  "src/repo/git.ts",
  "src/repo/repo-map.test.ts",
  "src/repo/repo-map.ts",
  "src/repo/repo.test.ts",
  "src/repo/repo.ts",
  "src/repo/worktree.test.ts",
  "src/repo/worktree.ts",
  "src/rules.test.ts",
  "src/rules.ts",
  "src/runtime.test.ts",
  "src/runtime.ts",
  "src/sdk-events.test.ts",
  "src/sdk.test.ts",
  "src/sdk.ts",
  "src/security/permission.ts",
  "src/security/security.test.ts",
  "src/security/security.ts",
  "src/skill-curator-dedup.test.ts",
  "src/skill-curator-doctor.test.ts",
  "src/skills.catalog.test.ts",
  "src/skills.search.test.ts",
  "src/skills/skill-curator.ts",
  "src/skills/skill-lint.test.ts",
  "src/skills/skill-lint.ts",
  "src/skills/skill-manager.test.ts",
  "src/skills/skill-manager.ts",
  "src/skills/skills.ts",
  "src/spec-exec.test.ts",
  "src/speculation-memory.test.ts",
  "src/speculative-predict.test.ts",
  "src/sqlite.test.ts",
  "src/sqlite.ts",
  "src/state/checkpoint-manager.test.ts",
  "src/state/checkpoint-manager.ts",
  "src/state/read-cache-store.test.ts",
  "src/state/read-cache-store.ts",
  "src/state/session-store.test.ts",
  "src/state/session-store.ts",
  "src/state/state-store.test.ts",
  "src/state/state-store.ts",
  "src/stream-degen.ts",
  "src/stream/fast-events.test.ts",
  "src/stream/fast-events.ts",
  "src/stream/sse-encode.test.ts",
  "src/stream/sse-encode.ts",
  "src/stream/stream-events.test.ts",
  "src/stream/stream-events.ts",
  "src/stream/stream-parser.test.ts",
  "src/stream/stream-parser.ts",
  "src/subagent-synthesis.test.ts",
  "src/summary/compact.ts",
  "src/summary/engine.test.ts",
  "src/summary/engine.ts",
  "src/teams/roles.test.ts",
  "src/teams/roles.ts",
  "src/teams/team.test.ts",
  "src/teams/team.ts",
  "src/testutil/fake-openai.ts",
  "src/tool-route-skill.test.ts",
  "src/tools/accept-plan.ts",
  "src/tools/analyze-code.test.ts",
  "src/tools/analyze-code.ts",
  "src/tools/ast-slice.test.ts",
  "src/tools/ast-slice.ts",
  "src/tools/benchmark.ts",
  "src/tools/bg-task.ts",
  "src/tools/blast-radius.test.ts",
  "src/tools/blast-radius.ts",
  "src/tools/browser.test.ts",
  "src/tools/browser.ts",
  "src/tools/chameleon.test.ts",
  "src/tools/chameleon.ts",
  "src/tools/clipboard.ts",
  "src/tools/code-similarity.test.ts",
  "src/tools/code-similarity.ts",
  "src/tools/codebase-map.test.ts",
  "src/tools/codebase-map.ts",
  "src/tools/codegraph.test.ts",
  "src/tools/color.ts",
  "src/tools/compile-prompt.test.ts",
  "src/tools/compile-prompt.ts",
  "src/tools/create-pr.test.ts",
  "src/tools/create-pr.ts",
  "src/tools/db-inspect.test.ts",
  "src/tools/db-inspect.ts",
  "src/tools/deepwiki.test.ts",
  "src/tools/deepwiki.ts",
  "src/tools/delete.test.ts",
  "src/tools/delete.ts",
  "src/tools/diagnostics-tool.test.ts",
  "src/tools/diagnostics-tool.ts",
  "src/tools/diff.test.ts",
  "src/tools/diff.ts",
  "src/tools/edit.test.ts",
  "src/tools/edit.ts",
  "src/tools/env.ts",
  "src/tools/fetch.test.ts",
  "src/tools/fetch.ts",
  "src/tools/file-ops.test.ts",
  "src/tools/file-ops.ts",
  "src/tools/find-references.test.ts",
  "src/tools/find-references.ts",
  "src/tools/format.ts",
  "src/tools/fs-signal.ts",
  "src/tools/fuzzy-match.test.ts",
  "src/tools/fuzzy-match.ts",
  "src/tools/git-blame.ts",
  "src/tools/git.ts",
  "src/tools/glob.test.ts",
  "src/tools/glob.ts",
  "src/tools/index.test.ts",
  "src/tools/index.ts",
  "src/tools/inspect.cache.test.ts",
  "src/tools/inspect.ts",
  "src/tools/lint.ts",
  "src/tools/markdown.test.ts",
  "src/tools/markdown.ts",
  "src/tools/mcp-manage.test.ts",
  "src/tools/mcp-manage.ts",
  "src/tools/mcp.ts",
  "src/tools/memory.ts",
  "src/tools/merge-conflict.test.ts",
  "src/tools/merge-conflict.ts",
  "src/tools/native-match.test.ts",
  "src/tools/native-match.ts",
  "src/tools/native-parity.test.ts",
  "src/tools/notes.test.ts",
  "src/tools/notes.ts",
  "src/tools/outline.test.ts",
  "src/tools/outline.ts",
  "src/tools/output-archive.ts",
  "src/tools/output-budget.test.ts",
  "src/tools/output-budget.ts",
  "src/tools/patch.test.ts",
  "src/tools/patch.ts",
  "src/tools/perf-tool.test.ts",
  "src/tools/perf-tool.ts",
  "src/tools/read.test.ts",
  "src/tools/read.ts",
  "src/tools/recall-output.ts",
  "src/tools/regex-replace.test.ts",
  "src/tools/regex-replace.ts",
  "src/tools/rename-symbol.test.ts",
  "src/tools/rename-symbol.ts",
  "src/tools/repl.test.ts",
  "src/tools/repl.ts",
  "src/tools/replace-symbol.test.ts",
  "src/tools/replace-symbol.ts",
  "src/tools/search-replace-multi.ts",
  "src/tools/search.test.ts",
  "src/tools/search.ts",
  "src/tools/security-audit.test.ts",
  "src/tools/security-audit.ts",
  "src/tools/session-recall.ts",
  "src/tools/shell.test.ts",
  "src/tools/shell.ts",
  "src/tools/skill.ts",
  "src/tools/skills.test.ts",
  "src/tools/subagent.test.ts",
  "src/tools/subagent.ts",
  "src/tools/symbol.ts",
  "src/tools/system-info.test.ts",
  "src/tools/system-info.ts",
  "src/tools/think.test.ts",
  "src/tools/think.ts",
  "src/tools/timer.test.ts",
  "src/tools/timer.ts",
  "src/tools/todo.test.ts",
  "src/tools/todo.ts",
  "src/tools/tool-factory.test.ts",
  "src/tools/tool-factory.ts",
  "src/tools/tool-usage.ts",
  "src/tools/tools.test.ts",
  "src/tools/tree.test.ts",
  "src/tools/tree.ts",
  "src/tools/tui-builder.test.ts",
  "src/tools/tui-builder.ts",
  "src/tools/types.ts",
  "src/tools/verify.test.ts",
  "src/tools/verify.ts",
  "src/tools/web-crawl.test.ts",
  "src/tools/web-crawl.ts",
  "src/tools/web-search.ts",
  "src/tools/write.ts",
  "src/tui/ansi-hygiene.test.ts",
  "src/tui/ansi-hygiene.ts",
  "src/tui/app.ts",
  "src/tui/cards.test.ts",
  "src/tui/cards.ts",
  "src/tui/chrome.test.ts",
  "src/tui/chrome.ts",
  "src/tui/pty-smoke.test.ts",
  "src/tui/renderer.ts",
  "src/tui/selection.test.ts",
  "src/tui/selection.ts",
  "src/tui/semantic.ts",
  "src/tui/state.test.ts",
  "src/tui/state.ts",
  "src/tui/summary-render.test.ts",
  "src/tui/summary-render.ts",
  "src/tui/tabs.test.ts",
  "src/tui/tabs.ts",
  "src/tui/termix.test.ts",
  "src/tui/termix.ts",
  "src/tui/themes.test.ts",
  "src/tui/themes.ts",
  "src/tui/view.test.ts",
  "src/tui/view.ts",
  "src/tui/width-harness.test.ts",
  "src/tui/wrap.test.ts",
  "src/tui/wrap.ts",
  "src/types.ts",
  "src/uncensored.test.ts",
  "src/util.test.ts",
  "src/util.ts",
  "src/utils/http-error.test.ts",
  "src/utils/http-error.ts",
  "src/utils/terminal-launch.test.ts",
  "src/utils/terminal-launch.ts",
  "src/verification.baseline.test.ts",
  "src/verification.test.ts",
  "src/verification.ts",
  "src/vnext-phases.test.ts",
  "src/wiki.test.ts",
  "src/wiki.ts",
  "src/workspace.test.ts",
  "src/workspace.ts",
  "tsconfig.json",
  "vitest.config.ts"
];
const REPO_URL = "https://github.com/xanstomper/mochi";
function categorizePaths(paths) {
  const groups = {};
  paths.forEach((p) => {
    let groupName = "Root Configs & Manifests";
    if (p.startsWith("src/agent/")) groupName = "src/agent — Turn Loop & Consensus";
    else if (p.startsWith("src/core/")) groupName = "src/core — AST Guards & Dispatcher";
    else if (p.startsWith("src/tools/")) groupName = "src/tools — Surgical Diff & Shell";
    else if (p.startsWith("src/model/")) groupName = "src/model — Model Router & Failover";
    else if (p.startsWith("src/tui/")) groupName = "src/tui — Multi-Tab Terminal Matrix";
    else if (p.startsWith("src/mcp/")) groupName = "src/mcp — Model Context Protocol";
    else if (p.startsWith("src/cognitive/")) groupName = "src/cognitive — Chameleon Swarms";
    else if (p.startsWith("src/observability/")) groupName = "src/observability — Autopsy & Traces";
    else if (p.startsWith("src/repo/")) groupName = "src/repo — CodeGraph & Git Plumbing";
    else if (p.startsWith("src/security/")) groupName = "src/security — Sandbox & Permissions";
    else if (p.startsWith("src/skills/")) groupName = "src/skills — Skill Curation Engine";
    else if (p.startsWith("src/state/")) groupName = "src/state — Checkpoint & Session Store";
    else if (p.startsWith("src/stream/")) groupName = "src/stream — Fast Events & SSE Parser";
    else if (p.startsWith("src/daemon/")) groupName = "src/daemon — Persistent Agent Service";
    else if (p.startsWith("src/")) groupName = "src — Entrypoint & Runtime Core";
    else if (p.startsWith("native/")) groupName = "native/mochi_core — Rust N-API Engine";
    else if (p.startsWith("bench/")) groupName = "bench — Empirical Telemetry Suites";
    else if (p.startsWith("examples/")) groupName = "examples — Agent Configurations";
    else if (p.startsWith(".github/")) groupName = ".github — CI/CD Workflows";
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(p);
  });
  return Object.keys(groups).map((name) => ({
    title: name,
    files: groups[name]
  }));
}
function RepoBrowser() {
  const [selectedPath, setSelectedPath] = reactExports.useState("src/agent/loop.ts");
  const [copied, setCopied] = reactExports.useState(false);
  const [search, setSearch] = reactExports.useState("");
  const [customFile, setCustomFile] = reactExports.useState(null);
  const [fetchingCustom, setFetchingCustom] = reactExports.useState(false);
  const [activeTabMode, setActiveTabMode] = reactExports.useState("curated");
  const allGroups = reactExports.useMemo(() => categorizePaths(ALL_REPO_PATHS), []);
  const currentFile = reactExports.useMemo(() => {
    if (customFile && customFile.path === selectedPath) {
      return customFile;
    }
    if (REAL_REPO_FILES[selectedPath]) {
      return REAL_REPO_FILES[selectedPath];
    }
    return {
      path: selectedPath,
      name: selectedPath.split("/").pop(),
      lang: selectedPath.endsWith(".rs") ? "rust" : selectedPath.endsWith(".json") ? "json" : selectedPath.endsWith(".md") ? "markdown" : "typescript",
      size: "Remote",
      lines: "...",
      desc: `Source file from GitHub repository: ${selectedPath}`,
      code: fetchingCustom ? "// Loading file from GitHub repository...\n// Please wait..." : "// Click or press Enter to fetch this file from GitHub."
    };
  }, [customFile, selectedPath, fetchingCustom]);
  const handleCopy = () => {
    if (navigator.clipboard && currentFile.code) {
      navigator.clipboard.writeText(currentFile.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    }
  };
  const handleSelectFile = async (path) => {
    setSelectedPath(path);
    if (REAL_REPO_FILES[path]) {
      return;
    }
    setFetchingCustom(true);
    try {
      const res = await fetch(`https://raw.githubusercontent.com/xanstomper/mochi/main/${path}`);
      if (res.ok) {
        const text = await res.text();
        const linesCount = text.split("\n").length;
        setCustomFile({
          path,
          name: path.split("/").pop(),
          lang: path.endsWith(".rs") ? "rust" : path.endsWith(".json") ? "json" : path.endsWith(".md") ? "markdown" : "typescript",
          size: `${(text.length / 1024).toFixed(1)} KB`,
          lines: linesCount,
          desc: `Fetched live from GitHub main branch: ${path}`,
          code: text
        });
      } else {
        setCustomFile({
          path,
          name: path.split("/").pop(),
          lang: "text",
          size: "0 KB",
          lines: 1,
          desc: `Could not fetch live content for ${path}`,
          code: `// Unable to fetch ${path} from GitHub (HTTP ${res.status}).
// You can view it directly on GitHub at:
// https://github.com/xanstomper/mochi/blob/main/${path}`
        });
      }
    } catch {
      setCustomFile({
        path,
        name: path.split("/").pop(),
        lang: "text",
        size: "0 KB",
        lines: 1,
        desc: `Fetch error for ${path}`,
        code: `// Network error fetching ${path}.
// View on GitHub: https://github.com/xanstomper/mochi/blob/main/${path}`
      });
    } finally {
      setFetchingCustom(false);
    }
  };
  const lines = (currentFile.code || "").split("\n");
  const highlightLine = (line) => {
    var _a, _b;
    const trimmed = line.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("//!")) {
      return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#8E879E", fontStyle: "italic" }, children: line });
    }
    if (trimmed.startsWith("#") && !trimmed.startsWith("#!")) {
      return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#8E879E", fontStyle: "italic" }, children: line });
    }
    if (trimmed.startsWith("import ") || trimmed.startsWith("export ") || trimmed.startsWith("from ")) {
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#7C3AED", fontWeight: 600 }, children: (_a = line.match(/^(import|export|from)/)) == null ? void 0 : _a[0] }),
        line.replace(/^(import|export|from)/, "")
      ] });
    }
    if (trimmed.startsWith("function ") || trimmed.startsWith("const ") || trimmed.startsWith("let ") || trimmed.startsWith("pub fn ") || trimmed.startsWith("fn ")) {
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#2563EB", fontWeight: 600 }, children: (_b = line.match(/^(function|const|let|pub fn|fn)/)) == null ? void 0 : _b[0] }),
        line.replace(/^(function|const|let|pub fn|fn)/, "")
      ] });
    }
    return line;
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "explorer-card", style: { maxWidth: 1560, margin: "0 auto", background: "#ffffff", borderRadius: 24, border: "1.5px solid rgba(138, 103, 246, 0.25)", boxShadow: "0 8px 32px rgba(138, 103, 246, 0.12)", overflow: "hidden" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "explorer-toolbar", style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid var(--line)", background: "#FAF8FC", flexWrap: "wrap", gap: 12 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 800, color: "#111116", display: "flex", alignItems: "center", gap: 6 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "#8A67F6", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" })
          ] }),
          "xanstomper/mochi"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontSize: 11.5, background: "#EDE8F8", color: "#8A67F6", padding: "3px 8px", borderRadius: 999, fontWeight: 700 }, children: [
          ALL_REPO_PATHS.length,
          " Files in Repository"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => setActiveTabMode("curated"),
            style: {
              padding: "6px 14px",
              borderRadius: 8,
              border: activeTabMode === "curated" ? "1.5px solid #8A67F6" : "1px solid var(--line)",
              background: activeTabMode === "curated" ? "#F4EFFE" : "#ffffff",
              color: activeTabMode === "curated" ? "#8A67F6" : "#111116",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer"
            },
            children: "Curated Core (35)"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "button",
          {
            onClick: () => setActiveTabMode("all"),
            style: {
              padding: "6px 14px",
              borderRadius: 8,
              border: activeTabMode === "all" ? "1.5px solid #8A67F6" : "1px solid var(--line)",
              background: activeTabMode === "all" ? "#F4EFFE" : "#ffffff",
              color: activeTabMode === "all" ? "#8A67F6" : "#111116",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer"
            },
            children: [
              "Full Repo Tree (",
              ALL_REPO_PATHS.length,
              ")"
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "a",
          {
            href: REPO_URL,
            target: "_blank",
            rel: "noopener",
            className: "btn btn-outline",
            style: { padding: "6px 14px", fontSize: 12, textDecoration: "none", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6 },
            children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "GitHub ↗" })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "explorer-grid", style: { minHeight: 740, display: "flex" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("aside", { className: "explorer-tree-side", style: { width: 340, flexShrink: 0, borderRight: "1px solid var(--line)", background: "#FAF8FC" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tree-search-bar", style: { position: "relative", padding: "12px 14px", borderBottom: "1px solid var(--line)" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(IconSearch, { size: 15, style: { position: "absolute", left: 24, top: 22, color: "var(--muted)" } }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "text",
              placeholder: `Search all ${ALL_REPO_PATHS.length} files in repo...`,
              value: search,
              onChange: (e) => setSearch(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter" && search.trim()) {
                  handleSelectFile(search.trim());
                }
              },
              className: "tree-filter-input",
              style: {
                width: "100%",
                padding: "8px 12px 8px 34px",
                borderRadius: 8,
                border: "1.5px solid var(--line)",
                fontSize: 12.5,
                fontFamily: "var(--font-mono)",
                background: "#ffffff",
                color: "#111116"
              }
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "tree-list", style: { padding: "10px", maxHeight: 680, overflowY: "auto" }, children: allGroups.map((group) => {
          const fileList = activeTabMode === "curated" && !search ? group.files.filter((f) => REAL_REPO_FILES[f]) : group.files;
          const matchingFiles = fileList.filter((filePath) => {
            if (!search) return true;
            const q = search.toLowerCase();
            return filePath.toLowerCase().includes(q) || group.title.toLowerCase().includes(q);
          });
          if (matchingFiles.length === 0) return null;
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tree-dir-group", style: { marginBottom: 14 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tree-dir-label", style: { display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, color: "var(--purple-dark)", textTransform: "uppercase", letterSpacing: ".06em" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2A1.75 1.75 0 004.98 1H1.75z" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: group.title }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { marginLeft: "auto", fontSize: 10, color: "var(--muted)" }, children: [
                "(",
                matchingFiles.length,
                ")"
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "tree-files", style: { paddingLeft: 10 }, children: matchingFiles.map((filePath) => {
              const isActive = selectedPath === filePath;
              const fileName = filePath.split("/").pop();
              const isPreIndexed = !!REAL_REPO_FILES[filePath];
              return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  className: "tree-file-btn" + (isActive ? " active" : ""),
                  onClick: () => handleSelectFile(filePath),
                  style: {
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: isActive ? "#EDE8F8" : "transparent",
                    color: isActive ? "#8A67F6" : "#111116",
                    fontWeight: isActive ? 750 : 500,
                    fontSize: 12.5,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s"
                  },
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "currentColor", style: { color: isActive ? "#8A67F6" : "var(--muted)" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.586a1.75 1.75 0 011.237.513l3.914 3.914c.328.328.513.774.513 1.237v8.586A1.75 1.75 0 0113.25 16H3.75A1.75 1.75 0 012 14.25V1.75z" }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: fileName }),
                    isPreIndexed ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 9, fontFamily: "var(--font-mono)", padding: "2px 5px", borderRadius: 4, background: "#ffffff", color: "#8A67F6", fontWeight: 700 }, children: "FAST" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 9, fontFamily: "var(--font-mono)", padding: "2px 5px", borderRadius: 4, background: "rgba(0,0,0,0.05)", color: "var(--muted)", fontWeight: 600 }, children: "RAW" })
                  ]
                },
                filePath
              );
            }) })
          ] }, group.title);
        }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "explorer-code-view", style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "code-view-header", style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", borderBottom: "1px solid var(--line)", background: "#FAF8FC" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "code-view-meta", style: { display: "flex", alignItems: "center", gap: 10 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontFamily: "var(--font-mono)", fontSize: 13.5, fontWeight: 800, color: "#111116" }, children: currentFile.path }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontSize: 12, color: "#8A67F6", background: "#F4EFFE", padding: "3px 10px", borderRadius: 999, fontWeight: 700 }, children: [
              currentFile.size,
              " · ",
              currentFile.lines,
              " lines"
            ] }),
            fetchingCustom && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 12, color: "#8A67F6", fontWeight: 600 }, children: "Fetching live from GitHub..." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "code-view-actions", style: { display: "flex", gap: 10 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: "code-copy-btn",
                onClick: handleCopy,
                style: { padding: "6px 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, cursor: "pointer", background: "#ffffff", border: "1.5px solid var(--line)", color: "#111116" },
                children: copied ? "✓ Copied" : "Copy Code"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "a",
              {
                href: `${REPO_URL}/blob/main/${currentFile.path}`,
                target: "_blank",
                rel: "noopener",
                className: "code-external-link",
                style: { display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, textDecoration: "none", background: "#111116", color: "#ffffff" },
                children: "Open on GitHub ↗"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "10px 24px", background: "rgba(138, 103, 246, 0.05)", borderBottom: "1px solid var(--line)", fontSize: 13, color: "#8A67F6", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 14 }, children: "ℹ" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: currentFile.desc })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "code-content-wrapper", style: { flex: 1, overflow: "auto", background: "#ffffff", maxHeight: 660 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("table", { style: { width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: "21px" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: lines.map((lineText, idx) => {
          const lineNum = idx + 1;
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { style: { verticalAlign: "top" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "td",
              {
                style: {
                  width: 48,
                  minWidth: 48,
                  textAlign: "right",
                  paddingRight: 16,
                  paddingLeft: 12,
                  userSelect: "none",
                  color: "#A29CAD",
                  fontSize: 12,
                  borderRight: "1px solid #ECE7F5",
                  background: "#FAF8FC"
                },
                children: lineNum
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { paddingLeft: 16, paddingRight: 16, whiteSpace: "pre", color: "#1B1726" }, children: highlightLine(lineText) })
          ] }, lineNum);
        }) }) }) })
      ] })
    ] })
  ] });
}
const FEATURES = [
  {
    icon: IconGlobe,
    title: "Open Source & Permissive",
    desc: "Transparent, community-driven, and released under the MIT license. Audit every line of Rust and TypeScript on GitHub.",
    link: "https://github.com/xanstomper/mochi"
  },
  {
    icon: IconUsers,
    title: "Contribution Guidelines",
    desc: "Help us improve Mochi with code, documentation, benchmarks, and community feedback. Strict CI/CD quality gates.",
    link: "https://github.com/xanstomper/mochi/blob/main/CONTRIBUTING.md"
  },
  {
    icon: IconMessageSquare,
    title: "Community Discussions",
    desc: "Get support, share workflows, propose skills, and connect with thousands of terminal agent developers.",
    link: "https://github.com/xanstomper/mochi/discussions"
  }
];
const TELEMETRY_BLOCKS = [
  { val: "727", label: "SOURCE FILES AUDITED", desc: "Zero dead code or dangling unused dependencies" },
  { val: "1,494", label: "TESTS PASSING", desc: "Vitest, unit, and headless integration tests passing (100%)" },
  { val: "0", label: "RUNTIME DEPENDENCIES", desc: "Single self-contained Bun executable with Rust core" },
  { val: "MIT", label: "OPEN SOURCE LICENSE", desc: "Free for personal, academic, and commercial use" }
];
function Source() {
  typeof window !== "undefined" && window.location.pathname.startsWith("/mochi") ? "/mochi" : "";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(EngineeringGridBackground, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pagehead", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "wrap", style: { maxWidth: 1560, width: "100%" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pagehead-row", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pagehead-col", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.06, distance: 40, blur: 12, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hero-eyebrow-clean", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sparkle-star", children: "✦" }),
            "OPEN SOURCE & TRANSPARENT"
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.14, distance: 48, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "hero-title", children: [
            "Open Source ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "accent-title", children: "and Always Free." })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.22, distance: 44, blur: 12, children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "hero-sub", style: { maxWidth: 640 }, children: "Mochi is 100% open source under the MIT license. Explore the live interactive repository tree, inspect our pure-Rust core tokenizer, or contribute pull requests to the project." }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "left", delay: 0.3, distance: 38, blur: 10, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hero-actions", style: { marginTop: 24 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "a",
              {
                href: "https://github.com/xanstomper/mochi",
                target: "_blank",
                rel: "noopener",
                className: "btn btn-primary",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" }) }),
                  "View on GitHub"
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "a",
              {
                href: "https://github.com/xanstomper/mochi/blob/main/CONTRIBUTING.md",
                target: "_blank",
                rel: "noopener",
                className: "btn btn-secondary",
                children: "Contribute →"
              }
            )
          ] }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "right", delay: 0.2, distance: 55, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "subpage-mascot-wrap", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "subpage-doodle", children: "built by the community ♡" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { position: "relative" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "heart-doodle", children: "♡" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Mochi, { variant: "source", size: 360 })
          ] })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid3", style: { marginTop: 44, marginBottom: 48 }, children: FEATURES.map((f, i) => {
        const IconComp = f.icon;
        return /* @__PURE__ */ jsxRuntimeExports.jsx(
          AnimatedContent,
          {
            direction: i === 0 ? "left" : i === 1 ? "bottom" : "right",
            delay: i * 0.08,
            distance: 44,
            blur: 12,
            children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "a",
              {
                href: f.link,
                target: "_blank",
                rel: "noopener",
                className: "card",
                style: { textDecoration: "none", color: "inherit" },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card-icon-box", children: /* @__PURE__ */ jsxRuntimeExports.jsx(IconComp, { size: 22 }) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { className: "card-title", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: f.title }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "card-arrow", children: "↗" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "card-desc", children: f.desc })
                ]
              }
            )
          },
          f.title
        );
      }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 52 }, children: TELEMETRY_BLOCKS.map((b, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: i * 0.06, distance: 38, blur: 10, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#ffffff", borderRadius: 20, padding: "24px 20px", border: "1.5px solid var(--line)", textAlign: "center", boxShadow: "var(--shadow-card)" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 36, fontWeight: 800, color: "var(--purple-dark)", marginBottom: 4 }, children: b.val }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }, children: b.label }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 13, color: "var(--ink-soft)" }, children: b.desc })
      ] }) }, b.label)) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedContent, { direction: "bottom", delay: 0.15, distance: 48, blur: 14, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: 80 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: 0 }, children: "Live Repository Explorer" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: 14, color: "var(--ink-soft)", margin: "4px 0 0" }, children: "Browse source files and explore core architecture directly from GitHub main." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "doc-search-badge", children: "xanstomper/mochi" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(RepoBrowser, {})
      ] }) })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Footer, {})
  ] });
}
const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(/* @__PURE__ */ jsxRuntimeExports.jsx(Source, {}));
}
