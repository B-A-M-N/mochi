// Native tool: format
// Auto-detects and runs code formatters (prettier, biome, black, gofmt, rustfmt).

import type { Tool } from './types.js';
import { runArgv } from '../exec.js';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';

interface FormatterDef {
  label: string;
  configFiles: string[];
  extensions?: string[];
  buildArgv: (path: string, check: boolean) => string[];
}

const FORMATTERS: FormatterDef[] = [
  {
    label: 'biome',
    configFiles: ['biome.json', 'biome.jsonc'],
    buildArgv: (p, check) => ['npx', 'biome', 'format', check ? '--check' : '--write', p],
  },
  {
    label: 'prettier',
    configFiles: ['.prettierrc', '.prettierrc.js', '.prettierrc.json', 'prettier.config.js'],
    buildArgv: (p, check) => ['npx', 'prettier', check ? '--check' : '--write', p],
  },
  {
    label: 'black',
    configFiles: ['pyproject.toml', '.black'],
    extensions: ['.py'],
    buildArgv: (p, check) => (check ? ['black', '--check', p] : ['black', p]),
  },
  {
    label: 'gofmt',
    configFiles: ['go.mod'],
    extensions: ['.go'],
    buildArgv: (p, check) => ['gofmt', check ? '-l' : '-w', p],
  },
  {
    label: 'rustfmt',
    configFiles: ['Cargo.toml'],
    extensions: ['.rs'],
    buildArgv: (p, check) => ['rustfmt', ...(check ? ['--check'] : []), p],
  },
];

export const formatTool: Tool = {
  def: {
    name: 'format',
    description: 'Auto-detect and run code formatter. Supports prettier, biome, black, gofmt, rustfmt.',
    parameters: [
      { name: 'path', type: 'string', description: 'File or directory to format', required: true },
      { name: 'check', type: 'boolean', description: 'Dry-run: only check, do not write (default: false)', required: false },
    ],
    permission: 'shell',
  },
  async execute(args, ctx) {
    const path = String(args.path || '.');
    const check = Boolean(args.check);
    const ext = extname(path);

    const detected = FORMATTERS.filter(f => {
      const configMatch = f.configFiles.some(cf => existsSync(join(ctx.cwd, cf)));
      const extMatch = !f.extensions || !ext || f.extensions.includes(ext);
      return configMatch && extMatch;
    });

    if (!detected.length) {
      return 'No formatter configuration found. Supported: prettier, biome, black, gofmt, rustfmt.';
    }

    const results: string[] = [];
    for (const fmt of detected.slice(0, 1)) {
      const argv = fmt.buildArgv(path, check);
      try {
        const r = await runArgv(argv[0], argv.slice(1), { cwd: ctx.cwd, timeoutMs: 30000, maxOutput: 1_000_000 });
        if (r.code === 0) results.push(`[${fmt.label}] ${check ? 'Check' : 'Formatted'}: ${path}\n${(r.stdout || '').slice(0, 1000)}`);
        else results.push(`[${fmt.label}] ${check ? 'Not formatted' : 'Error'}:\n${((r.stdout || '') + (r.stderr || '')).trim().slice(0, 1000)}`);
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; message?: string };
        const output = ((err.stdout || '') + (err.stderr || '')).trim().slice(0, 1000);
        results.push(`[${fmt.label}] ${check ? 'Not formatted' : 'Error'}:\n${output || err.message}`);
      }
    }
    return results.join('\n');
  },
};
