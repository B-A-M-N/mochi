// Compatibility shim: lets bun-authored tests (`import ... from 'bun:test'`)
// run under vitest/node so `npm test` stays green on machines without bun
// driving the suite. Only the portable subset is re-exported; bun-only APIs
// (mock, spyOn, jest, ...) are intentionally omitted so a test using them
// fails loudly at import time instead of half-passing.
export { describe, it, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
