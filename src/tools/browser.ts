import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Tool } from './types.js';

// Cline-grade browser automation for Mochi WITHOUT a runtime dependency.
//
// Mochi is a Bun-compiled binary with zero runtime deps, so it can't bundle
// playwright/puppeteer. This tool shells out to `scripts/browser-driver.mjs`
// (a plain-node script that loads the GLOBALLY-installed playwright), enforcing
// a bounded SIGTERM→SIGKILL timeout per the freeze-class sentinel (every spawn
// that waits on output needs a kill timer — shell.ts is the reference).
//
// Commands map 1:1 to the driver's subcommands; `url` can be given as the
// first positional (navigate) or via `url:` for extract/act calls so a single
// invocation does "open X, then click/type/read".

const DEFAULT_TIMEOUT_MS = 45_000;

// Module dir, resolved LAZILY: bun-compiled Windows binaries report a
// non-file import.meta.url, and fileURLToPath throws at import time — which
// used to kill every command (even `acp --check`) on Windows before any tool
// ran. Unresolvable → cwd, and runDriver reports driver-unavailable.
let cachedHere: string | undefined;
function hereDir(): string {
  if (cachedHere === undefined) {
    try { cachedHere = resolve(dirname(fileURLToPath(import.meta.url))); }
    catch { cachedHere = process.cwd(); }
  }
  return cachedHere;
}
const driverScript = (): string => resolve(hereDir(), '../../scripts/browser-driver.mjs');

function runDriver(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [driverScript(), ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    let done = false;
    const finish = (code: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolvePromise(
        out.trim() ||
        (code !== 0 ? `[browser exit ${code}] ${err.trim().slice(0, 500)}` : ''),
      );
    };
    const timer = setTimeout(() => {
      if (done) return;
      try { child.kill('SIGTERM'); } catch { /* ignore */ }
      setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* ignore */ } }, 3000);
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; if (out.length > 60_000) out = out.slice(-60_000); });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', () => finish(1));
    child.on('close', (code) => finish(code));
  });
}

export const browserTool: Tool = {
  def: {
    name: 'browser',
    description:
      'Drive a real headless browser (navigate, read text/DOM/links, click, type/fill, eval JS, screenshot). ' +
      'For testing web apps, dynamic pages, and UI verification. ' +
      'Commands: navigate <url> | click <css> | type <css> <text> | fill <css> <text> | ' +
      'text [css] | links [css] | html [css] | inputs [css] | eval <js> | screenshot <path>. ' +
      'Prefix `url:` to open a page and act in one call.',
    parameters: [
      { name: 'command', type: 'string', description: 'Action: navigate|get|click|type|fill|text|links|html|inputs|eval|screenshot|snap', required: true },
      { name: 'selector', type: 'string', description: 'CSS selector for click/type/fill/text/links/html/inputs', required: false },
      { name: 'text', type: 'string', description: 'Text to type/fill (for type/fill)', required: false },
      { name: 'url', type: 'string', description: 'URL to navigate to (for navigate/get, or prefix before acting)', required: false },
      { name: 'path', type: 'string', description: 'Output path for screenshot', required: false },
      { name: 'js', type: 'string', description: 'JavaScript to eval (returns JSON result)', required: false },
      { name: 'waitMs', type: 'integer', description: 'Milliseconds to wait after navigating/clicking before returning', required: false },
      { name: 'timeoutMs', type: 'integer', description: 'Navigation timeout ms (default 30000)', required: false },
    ],
    permission: 'network',
  },
  async execute(args, ctx) {
    const command = String(args.command ?? '');
    if (!command) return 'browser: command required (navigate, click, type, fill, text, links, html, inputs, eval, screenshot)';
    const url = args.url ? String(args.url) : undefined;
    const sel = args.selector ? String(args.selector) : undefined;
    const text = args.text !== undefined ? String(args.text) : undefined;
    const js = args.js !== undefined ? String(args.js) : undefined;
    const pathArg = args.path ? String(args.path) : undefined;
    const waitMs = Number(args.waitMs ?? 0) || 0;

    const driverArgs: string[] = [];
    const timeoutMs = Number(args.timeoutMs ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

    // Build the driver argv: `cmd positionals... --flags`.
    if (command === 'navigate' || command === 'get') {
      driverArgs.push(command, url ?? '');
    } else if (command === 'screenshot') {
      driverArgs.push('screenshot', pathArg ?? '');
    } else if (command === 'eval') {
      driverArgs.push('eval', js ?? '');
    } else {
      // selector-based commands (click/type/fill/text/links/html/inputs/snap)
      if (command === 'type' || command === 'fill') {
        driverArgs.push(command, sel ?? '', text ?? '');
      } else {
        driverArgs.push(command, sel ?? '');
      }
    }
    if (url && command !== 'navigate' && command !== 'get') driverArgs.push('--url', url);
    if (waitMs > 0) driverArgs.push('--wait', String(waitMs));
    if (timeoutMs !== 30000) driverArgs.push('--timeout', String(timeoutMs));

    ctx.events.emit({
      type: 'tool:called', tool: 'browser', args: { command, url }, agentId: ctx.agentId,
    });

    const raw = await runDriver(driverArgs, timeoutMs + 4000).catch(() => '');
    const summary = summarizeResult(command, raw);
    ctx.events.emit({
      type: 'tool:completed', tool: 'browser', agentId: ctx.agentId,
      result: { toolCallId: '', name: 'browser', output: summary, durationMs: 0 },
    });
    return summary;
  },
};

/** Turn the driver's JSON into a compact, model-friendly text summary. */
export function summarizeResult(command: string, raw: string): string {
  if (!raw.trim()) return 'browser: no output (driver likely timed out).';
  let data: Record<string, unknown> | null = null;
  try { data = JSON.parse(raw); } catch { /* not JSON — pass through */ }
  if (!data) return raw.slice(0, 4000);
  if (data.ok === false) return `[browser ${command}] ERROR: ${data.error ?? 'unknown'}`;
  const parts: string[] = [`[browser ${command}] ok`];
  if (data.title) parts.push(`title: ${data.title}`);
  if (data.url) parts.push(`url: ${data.url}`);
  if (data.text) parts.push(`text: ${data.text}`);
  if (Array.isArray(data.links)) {
    parts.push(`links (${data.links.length}):`);
    for (const l of (data.links as Array<{ href?: string; text?: string; sel?: string }>).slice(0, 30)) {
      parts.push(`  ${l.sel ?? ''} ${l.href ?? ''} ${l.text ?? ''}`.trim());
    }
  }
  if (Array.isArray(data.inputs) && (data.inputs as unknown[]).length) {
    parts.push(`inputs (${(data.inputs as unknown[]).length}):`);
    for (const i of (data.inputs as Array<{ sel?: string; tag?: string; name?: string; type?: string; val?: string }>).slice(0, 30)) {
      parts.push(`  ${i.sel ?? ''} <${i.tag ?? ''}> name=${i.name ?? ''} type=${i.type ?? ''} val=${i.val ?? ''}`.trim());
    }
  }
  if (data.html) parts.push(`html: ${data.html}`);
  if (data.saved) parts.push(`saved: ${data.saved}`);
  if (data.action) parts.push(`action: ${data.action} target=${(data as { target?: string }).target ?? ''} text=${data.text ?? ''}`);
  if (data.result !== undefined) parts.push(`result: ${String(data.result)}`);
  return parts.join('\n');
}