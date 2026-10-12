#!/usr/bin/env node
// CLI cold-start matrix: wall time + peak RSS for a trivial `--version`
// invocation across every coding-agent CLI installed on this machine.
//
// This is the honest, reproducible slice of the cross-harness comparison: it
// measures HARNESS OVERHEAD (process spawn → parse → init → answer → exit),
// not model quality. Same machine, same day, same command shape, N runs each,
// median + mean reported. Peak RSS comes from /usr/bin/time -v (kernel
// accounting, not sampling).
//
//   node bench/cli-matrix.mjs              # auto-discover installed CLIs
//   RUNS=20 node bench/cli-matrix.mjs      # more samples
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = Number(process.env.RUNS ?? 10);

const CANDIDATES = [
  { label: 'mochi (node)', cmd: process.execPath, args: [resolve(root, 'dist/cli.js'), '--version'] },
  { label: 'mochi (bin)', cmd: resolve(root, 'dist/mochi-bin'), args: ['--version'] },
  { label: 'opencode', cmd: 'opencode', args: ['--version'] },
  { label: 'claude', cmd: 'claude', args: ['--version'] },
  { label: 'codex', cmd: 'codex', args: ['--version'] },
  { label: 'jcode', cmd: 'jcode', args: ['--version'] },
  { label: 'pi', cmd: 'pi', args: ['--version'] },
  { label: 'agy', cmd: 'agy', args: ['--version'] },
  { label: 'crush', cmd: 'crush', args: ['--version'] },
];

const which = (cmd) =>
  spawnSync('sh', ['-c', `command -v ${JSON.stringify(cmd)}`], { encoding: 'utf8' }).stdout?.trim() || null;

const targets = CANDIDATES.filter((t) => {
  const abs = t.cmd.startsWith('/') || t.cmd.startsWith('.');
  if (abs) return existsSync(t.cmd);
  return which(t.cmd) !== null;
});

const hasTime = which('/usr/bin/time') !== null || existsSync('/usr/bin/time');
const TIME = existsSync('/usr/bin/time') ? '/usr/bin/time' : 'time';

function oneRun(t) {
  // GNU time in format mode: one final line. `-v`'s multi-line block was
  // observed truncating mid-stream for the bun binary under load, losing the
  // MaxRSS line. Status handling: accept on parsed stats/output rather than
  // trusting the wrapper's occasionally-nonzero code.
  const r = spawnSync(TIME, ['-f', 'MOCHI_MAXRSS_KB %M', t.cmd, ...t.args], {
    encoding: 'utf8',
    cwd: root,
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const kb = /MOCHI_MAXRSS_KB (\d+)/.exec(r.stderr ?? '')?.[1];
  const producedOutput = (r.stdout ?? '').trim().length > 0;
  if (!kb || (r.status !== 0 && !producedOutput)) {
    if (r.error) console.error(`  (${t.label}: spawn error ${r.error.code})`);
    return null;
  }
  return { rssKb: kb ? Number(kb) : null };
}

const rows = [];
for (const t of targets) {
  // warm-up (page cache, JIT caches of the runtime)
  spawnSync(t.cmd, [...t.args], { stdio: 'ignore', cwd: root, timeout: 60_000 });
  const times = [];
  let rss = null;
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    const ok = hasTime ? oneRun(t) : (() => {
      const r = spawnSync(t.cmd, [...t.args], { stdio: 'ignore', cwd: root, timeout: 60_000 });
      return r.status === 0 ? {} : null;
    })();
    const ms = performance.now() - start;
    if (ok === null) { times.length = 0; break; }
    times.push(ms);
    if (ok.rssKb) rss = Math.max(rss ?? 0, ok.rssKb);
  }
  if (!times.length) { rows.push({ label: t.label, err: true }); continue; }
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = sorted[Math.floor(sorted.length / 2)];
  rows.push({ label: t.label, avg, p50, rssMb: rss ? rss / 1024 : null, runs: times.length });
}

console.log(`cli cold-start matrix — ${RUNS} runs each, --version, cwd=repo\n`);
console.log('harness        p50 ms    mean ms   peak RSS MB');
for (const r of rows) {
  if (r.err) { console.log(`${r.label.padEnd(14)}   (failed / unavailable)`); continue; }
  console.log(
    `${r.label.padEnd(14)} ${r.p50.toFixed(0).padStart(7)} ${r.avg.toFixed(0).padStart(10)} ${r.rssMb ? r.rssMb.toFixed(0).padStart(11) : '        n/a'}`,
  );
}
