// AST-accurate symbol definitions for TypeScript/JavaScript.
//
// The old find_definitions was a regex (`function sym|class sym|...`) — it
// matched the word inside comments and strings, and couldn't tell a
// declaration from a call site or a property access. This module parses real
// source with the TypeScript compiler and returns only true declaration
// nodes, each with its exact kind, location, and a one-line signature.
//
// Non-TS languages (Python, Go, Rust, …) keep the regex path in the tool —
// this module is the TS/JS upgrade layered on top. The compiler is lazily
// loaded (same pattern as ast-guard) so a build without `typescript` degrades
// to the regex path instead of crashing.

import { createRequire } from 'node:module';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep, extname } from 'node:path';
import type { Dirent } from 'node:fs';

let _ts: typeof import('typescript') | null = null;
function getTsCompiler(): typeof import('typescript') | null {
  try {
    if (!_ts) _ts = createRequire(import.meta.url)('typescript') as typeof import('typescript');
    return _ts;
  } catch {
    return null;
  }
}

/** Extensions this module can parse as real AST. */
const TS_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'target', '.mochi', '.next',
  '.venv', 'venv', '__pycache__', 'coverage', 'vendor', '.cache',
]);

// Bound the sync walk so a huge tree can't block the event loop (the
// search-tool freeze class). Env-tunable like the find-refs cap.
const MAX_FILES = Number(process.env.MOCHI_SYMBOL_DEFS_MAX_FILES) || 4000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface SymbolDefinition {
  /** Path relative to the search root, POSIX-style. */
  file: string;
  /** 1-based line of the declaration. */
  line: number;
  /** 1-based column of the declaration. */
  column: number;
  /** Declaration kind: function, class, interface, type, enum, const, method, … */
  kind: string;
  /** Single-line declaration signature (body stripped), capped for display. */
  signature: string;
}

function collectTsFiles(dir: string, root: string, out: string[], budget: { seen: number }): void {
  if (budget.seen >= MAX_FILES) return;
  let entries: Dirent[];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (budget.seen >= MAX_FILES) return;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORED_DIRS.has(e.name)) collectTsFiles(full, root, out, budget);
    } else if (TS_EXTS.has(extname(e.name).toLowerCase())) {
      try {
        if (statSync(full).size <= MAX_FILE_BYTES) { budget.seen++; out.push(full); }
      } catch { /* skip */ }
    }
  }
}

/** Names declared by a binding name (handles destructuring patterns). */
function bindingNames(nameNode: unknown, ts: typeof import('typescript')): string[] {
  const n = nameNode as import('typescript').BindingName | undefined;
  if (!n) return [];
  if (ts.isIdentifier(n)) return [n.text];
  if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) {
    const names: string[] = [];
    for (const el of n.elements) {
      if (ts.isBindingElement(el)) names.push(...bindingNames(el.name, ts));
    }
    return names;
  }
  return [];
}

interface Classified {
  names: string[];
  kind: string;
  node: import('typescript').Node;
}

/** Classify a node as a declaration if it declares symbol names. */
function classify(node: import('typescript').Node, ts: typeof import('typescript')): Classified[] {
  const k = node.kind;
  const named = (kind: string): Classified | null => {
    const nameNode = (node as unknown as { name?: import('typescript').Node }).name;
    const names = bindingNames(nameNode, ts);
    return names.length ? { names, kind, node } : null;
  };

  if (ts.isFunctionDeclaration(node)) return wrap(named('function'));
  if (ts.isClassDeclaration(node)) return wrap(named('class'));
  if (ts.isInterfaceDeclaration(node)) return wrap(named('interface'));
  if (ts.isTypeAliasDeclaration(node)) return wrap(named('type'));
  if (ts.isEnumDeclaration(node)) return wrap(named('enum'));
  if (ts.isModuleDeclaration(node)) return wrap(named('namespace'));
  if (ts.isMethodDeclaration(node)) return wrap(named('method'));
  if (ts.isPropertyDeclaration(node)) return wrap(named('property'));
  if (ts.isGetAccessor(node)) return wrap(named('getter'));
  if (ts.isSetAccessor(node)) return wrap(named('setter'));
  if (ts.isVariableStatement(node)) {
    const dl = node.declarationList;
    const kindText = (/^(const|let|var)/.exec(dl.getText(node.getSourceFile())) ?? [])[1] ?? 'var';
    const out: Classified[] = [];
    for (const decl of dl.declarations) {
      const names = bindingNames(decl.name, ts);
      if (names.length) out.push({ names, kind: kindText, node: decl });
    }
    return out;
  }
  // Suppress unused-var warning for the raw kind (kept for clarity above).
  void k;
  return [];

  function wrap(c: Classified | null): Classified[] { return c ? [c] : []; }
}

/** One-line signature: declaration text up to the body, whitespace-collapsed. */
function signatureOf(node: import('typescript').Node, source: import('typescript').SourceFile, max = 160): string {
  let sig: string;
  try {
    const body = (node as unknown as { body?: import('typescript').Node }).body;
    const end = body ? body.getStart(source) : node.getEnd();
    sig = source.text.slice(node.getStart(source), end);
  } catch {
    sig = '';
  }
  sig = sig.replace(/\s+/g, ' ').trim();
  const brace = sig.indexOf('{');
  if (brace > 0) sig = sig.slice(0, brace).trim();
  if (!sig) { try { sig = source.text.slice(node.getStart(source), node.getEnd()).replace(/\s+/g, ' ').trim(); } catch { sig = ''; } }
  return sig.length > max ? sig.slice(0, max - 3) + '...' : sig;
}

/** Find declarations of `symbol` in a single parsed source. Pure — used by
 *  the walker and directly by tests. Returns [] when the compiler is absent. */
export function definitionsInSource(relPath: string, content: string, symbol: string): SymbolDefinition[] {
  const ts = getTsCompiler();
  if (!ts) return [];
  const ext = extname(relPath).toLowerCase();
  const scriptKind = ext === '.tsx' || ext === '.jsx'
    ? ts.ScriptKind.TSX
    : ext === '.js' || ext === '.mjs' || ext === '.cjs'
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  let source: import('typescript').SourceFile;
  try {
    source = ts.createSourceFile(relPath, content, ts.ScriptTarget.Latest, true, scriptKind);
  } catch {
    return [];
  }

  const found: SymbolDefinition[] = [];
  const visit = (node: import('typescript').Node): void => {
    for (const c of classify(node, ts)) {
      if (!c.names.includes(symbol)) continue;
      let line = 0, column = 0;
      try {
        const pos = source.getLineAndCharacterOfPosition(c.node.getStart(source));
        line = pos.line + 1;
        column = pos.character + 1;
      } catch { /* position failure: report 0,0 rather than throw */ }
      found.push({ file: relPath, line, column, kind: c.kind, signature: signatureOf(c.node, source) });
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
}

/** Walk the scope for TS/JS files and collect every declaration of `symbol`.
 *  Returns null when the compiler is unavailable (caller falls back to regex). */
export function findTsDefinitions(root: string, scopeAbs: string, symbol: string): SymbolDefinition[] | null {
  const ts = getTsCompiler();
  if (!ts) return null;
  if (!existsSync(scopeAbs)) return [];

  const files: string[] = [];
  if (statSync(scopeAbs).isFile()) {
    if (TS_EXTS.has(extname(scopeAbs).toLowerCase())) files.push(scopeAbs);
  } else {
    collectTsFiles(scopeAbs, root, files, { seen: 0 });
  }

  const out: SymbolDefinition[] = [];
  for (const f of files) {
    let content: string;
    try { content = readFileSync(f, 'utf8'); } catch { continue; }
    const rel = relative(root, f).split(sep).join('/');
    out.push(...definitionsInSource(rel, content, symbol));
    if (out.length >= 200) break; // hard cap: enough for any real symbol
  }
  return out;
}

// ─── References (AST-accurate) ──────────────────────────────────────────────
// A reference is a real Identifier node whose text matches the symbol. String
// literals and comments are NOT Identifier nodes — they're trivia — so the
// AST walker excludes them for free (the whole point: the old regex matched
// the word inside `// computeTotal` and `"computeTotal"`). Each hit is tagged
// with its usage kind so the caller can tell a call from an import or a
// property access without needing the (expensive) type checker.

export interface SymbolReference {
  file: string;
  line: number;
  column: number;
  /** How the symbol is used here: declaration, call, import, property, type, or identifier. */
  usage: string;
  /** The source line, trimmed, capped for display context. */
  text: string;
}

/** Classify an Identifier's usage from its parent, without the type checker. */
function usageOf(ident: import('typescript').Node, ts: typeof import('typescript')): string {
  const p = ident.parent;
  if (!p) return 'identifier';
  if (ts.isCallExpression(p) && p.expression === ident) return 'call';
  if (ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p)) return 'import';
  if (ts.isExportSpecifier(p)) return 'export';
  if (ts.isPropertyAccessExpression(p) && p.name === ident) return 'property';
  if (ts.isPropertyAssignment(p) && p.name === ident) return 'property';
  if (ts.isNewExpression(p) && p.expression === ident) return 'constructor';
  if (ts.isTypeReferenceNode(p)) return 'type';
  // A declaration node that owns this identifier as its name.
  const k = p.kind;
  if (k === ts.SyntaxKind.FunctionDeclaration || k === ts.SyntaxKind.ClassDeclaration ||
      k === ts.SyntaxKind.InterfaceDeclaration || k === ts.SyntaxKind.TypeAliasDeclaration ||
      k === ts.SyntaxKind.EnumDeclaration || k === ts.SyntaxKind.MethodDeclaration ||
      k === ts.SyntaxKind.PropertyDeclaration || k === ts.SyntaxKind.VariableDeclaration) {
    return 'declaration';
  }
  return 'identifier';
}

/** Find every real Identifier reference to `symbol` in one parsed source.
 *  Pure — used by the walker and directly by tests. [] when compiler absent. */
export function referencesInSource(relPath: string, content: string, symbol: string): SymbolReference[] {
  const ts = getTsCompiler();
  if (!ts) return [];
  const ext = extname(relPath).toLowerCase();
  const scriptKind = ext === '.tsx' || ext === '.jsx'
    ? ts.ScriptKind.TSX
    : ext === '.js' || ext === '.mjs' || ext === '.cjs'
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  let source: import('typescript').SourceFile;
  try {
    source = ts.createSourceFile(relPath, content, ts.ScriptTarget.Latest, true, scriptKind);
  } catch {
    return [];
  }

  const lines = content.split('\n');
  const out: SymbolReference[] = [];
  const visit = (node: import('typescript').Node): void => {
    if (ts.isIdentifier(node) && node.text === symbol) {
      let line = 0, column = 0;
      try {
        const pos = source.getLineAndCharacterOfPosition(node.getStart(source));
        line = pos.line + 1;
        column = pos.character + 1;
      } catch { /* report 0,0 rather than throw */ }
      const rawLine = (lines[line - 1] ?? '').trim();
      out.push({ file: relPath, line, column, usage: usageOf(node, ts), text: rawLine.slice(0, 200) });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return out;
}

/** Walk the scope for TS/JS files and collect every reference to `symbol`.
 *  Returns null when the compiler is unavailable (caller falls back to rg). */
export function findTsReferences(root: string, scopeAbs: string, symbol: string): SymbolReference[] | null {
  const ts = getTsCompiler();
  if (!ts) return null;
  if (!existsSync(scopeAbs)) return [];

  const files: string[] = [];
  if (statSync(scopeAbs).isFile()) {
    if (TS_EXTS.has(extname(scopeAbs).toLowerCase())) files.push(scopeAbs);
  } else {
    collectTsFiles(scopeAbs, root, files, { seen: 0 });
  }

  const out: SymbolReference[] = [];
  for (const f of files) {
    let content: string;
    try { content = readFileSync(f, 'utf8'); } catch { continue; }
    const rel = relative(root, f).split(sep).join('/');
    out.push(...referencesInSource(rel, content, symbol));
    if (out.length >= 500) break; // hard cap: plenty for any real symbol
  }
  return out;
}

// ─── Exact identifier spans (for safe rename) ───────────────────────────────
// Rename needs byte offsets, not line:col. These are the start/end offsets of
// every REAL Identifier node named `symbol` — comments and string literals are
// trivia, so they never appear. A rename built from these spans can rewrite a
// symbol without ever touching `// oldName` or `"oldName"`.

export interface IdentifierSpan {
  start: number;
  end: number;
}

/** Exact spans of real Identifier nodes named `symbol` in one parsed source.
 *  Returns [] when the compiler is absent or the file can't be parsed. */
export function identifierSpansInSource(relPath: string, content: string, symbol: string): IdentifierSpan[] {
  const ts = getTsCompiler();
  if (!ts) return [];
  const ext = extname(relPath).toLowerCase();
  const scriptKind = ext === '.tsx' || ext === '.jsx'
    ? ts.ScriptKind.TSX
    : ext === '.js' || ext === '.mjs' || ext === '.cjs'
      ? ts.ScriptKind.JS
      : ext === '.ts' || ext === '.mts' || ext === '.cts'
        ? ts.ScriptKind.TS
        : ts.ScriptKind.TS;
  let source: import('typescript').SourceFile;
  try {
    source = ts.createSourceFile(relPath, content, ts.ScriptTarget.Latest, true, scriptKind);
  } catch {
    return [];
  }

  const spans: IdentifierSpan[] = [];
  const visit = (node: import('typescript').Node): void => {
    if (ts.isIdentifier(node) && node.text === symbol) {
      try {
        spans.push({ start: node.getStart(source), end: node.getEnd() });
      } catch { /* skip unpositionable node */ }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  // Apply edits right-to-left so earlier offsets stay valid.
  spans.sort((a, b) => b.start - a.start);
  return spans;
}

/** Rename every real Identifier named `oldName` to `newName` in one source,
 *  by exact span (never touching comments/strings). Returns the new content
 *  and how many identifiers were renamed. Returns null when the compiler is
 *  unavailable (caller falls back to word-boundary regex) or the file can't
 *  be parsed — never a silent partial write. */
export function renameSymbolInSource(
  relPath: string,
  content: string,
  oldName: string,
  newName: string,
): { content: string; count: number } | null {
  const ts = getTsCompiler();
  if (!ts) return null;
  const spans = identifierSpansInSource(relPath, content, oldName);
  if (spans.length === 0) return { content, count: 0 };
  let out = content;
  for (const s of spans) { // already sorted right-to-left
    out = out.slice(0, s.start) + newName + out.slice(s.end);
  }
  return { content: out, count: spans.length };
}
