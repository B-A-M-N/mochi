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
        lines: 65,
        functions: 69,
        branches: 50,
        statements: 65,
      },
    },
  },
});
