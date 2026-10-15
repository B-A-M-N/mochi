// Code comprehension tool: explain a symbol, file, or concept in plain language.
// Distinct from codebase_map (which maps structure) — this answers "how/why does
// this work?" for a specific target, using the symbol index + surrounding context.

import type { Tool } from './types.js';
import { detectRepo } from '../repo/repo.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const explainTool: Tool = {
  def: {
    name: 'explain',
    description:
      'Explain how a specific symbol, file, or concept works in plain language. ' +
      'Use for code review, onboarding into unfamiliar code, or understanding a dependency before changing it.',
    parameters: [
      { name: 'target', type: 'string', description: 'Symbol name, file path, or concept to explain (e.g. "AuthService", "src/auth.ts", "how retries work")', required: true },
      { name: 'depth', type: 'string', description: 'Explanation depth: "brief" (2-3 sentences), "detailed" (with examples and edge cases)', required: false },
    ],
    permission: 'read',
  },
  async execute(args, ctx) {
    const target = String(args.target ?? '').trim();
    const depth = String(args.depth ?? 'detailed');
    if (!target) return 'Usage: explain(target: "symbol or file", depth?: "brief"|"detailed")';

    const repo = detectRepo(ctx.cwd);
    const findings: string[] = [];

    // 1. If target is a file path, read and summarize it
    const asPath = resolve(ctx.cwd, target);
    if (existsSync(asPath) && asPath.endsWith('.ts') || asPath.endsWith('.js') || asPath.endsWith('.py') || asPath.endsWith('.rs') || asPath.endsWith('.go')) {
      try {
        const content = readFileSync(asPath, 'utf8');
        const lines = content.split('\n');
        findings.push(`File: ${target} (${lines.length} lines, ${repo.language ?? 'unknown'})`);
        // Extract exported symbols
        const exports = content.match(/export\s+(?:async\s+)?(?:function|class|const|interface|type|enum)\s+(\w+)/g) ?? [];
        if (exports.length) {
          findings.push(`Exports: ${exports.map((e) => e.replace(/export\s+(?:async\s+)?(?:function|class|const|interface|type|enum)\s+/, '')).join(', ')}`);
        }
        // First 30 lines as a preview
        findings.push(`\nPreview (first 30 lines):\n${lines.slice(0, 30).join('\n')}`);
      } catch {
        findings.push(`Could not read ${target}`);
      }
    } else {
      // 2. Treat as a symbol/concept — search for it
      findings.push(`Explaining "${target}" in this project (${repo.language ?? 'unknown'})`);
      findings.push('');
      findings.push('To get a precise explanation, use find_definitions or find_references first to locate the symbol, then read the relevant file section.');
      findings.push('For a structural overview, use codebase_map.');
    }

    if (depth === 'brief') {
      // Brief = summary lines only (file + exports), no preview dump.
      return findings.slice(0, 2).join('\n');
    }
    return findings.join('\n');
  },
};
