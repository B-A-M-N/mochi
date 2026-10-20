import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Nine test files are authored against `bun:test` (portable subset only:
    // describe/it/test/expect/hooks). Alias to a shim so `npm test` runs them
    // under vitest instead of failing collection on machines where vitest
    // drives the suite. Bun-only APIs are deliberately absent from the shim
    // so non-portable tests fail loudly at import.
    alias: [{ find: /^bun:test$/, replacement: resolve(root, 'scripts/vitest-bun-test-shim.ts') }],
  },
  test: {
    include: ['src/**/*.test.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    teardownTimeout: 30_000,
    // MCH-001: persist transform results between runs so `vitest run` stops
    // re-transforming the whole module graph from scratch (suite previously
    // exceeded the 120 s wall clock; transform step alone was ~11 s / 86%).
    fsModuleCache: true,
    // Pool: cap at 2 forks to bound RAM (each worker loads full TS compiler + Mochi app).
    pool: 'forks',
    minForks: 1,
    maxForks: 2,
    singleFork: false,
    // MCH-23: measure coverage of the shipped source tree only.
    coverage: {
      include: ['src/**'],
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        // RATCHET (2026-10-12, measured 66.49% stmt / 69.59% line /
        // 74.57% func / 57.56% branch after the coverage-test batch).
        // CI runs this gate on 3 OSes and has historically measured ~0.9
        // points below local (61.61 vs 62.48 statements on the last
        // pre-batch comparison), so every floor is set below that worst
        // projection: statements 65 binds (worst projection ~65.6), the
        // rest keep >=2.5 pts of platform margin. Raise when coverage
        // rises; never lower silently — a lower number means the gate
        // stopped meaning something.
        lines: 66,
        functions: 71,
        branches: 54,
        statements: 65,
      },
    },
  },
});
