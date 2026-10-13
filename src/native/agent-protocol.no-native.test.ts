// MOCHI_NO_NATIVE short-circuit: agentPath() bails before touching the
// filesystem, so every op must fall back to null (the TS implementations)
// without ever spawning the Rust binary. Runs in its own file so the env
// gate is closed before the first call — the shared worker state of the
// parity test file cannot express "never spawned".
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  isRustRuntimeAvailable,
  rustRuntimeVersion,
  nativePlanCompaction,
  nativeTokensCount,
  nativeAssembleStream,
  closeRustRuntime,
} from './agent-protocol.js';

describe('agent-protocol with MOCHI_NO_NATIVE=1', () => {
  beforeAll(() => { process.env.MOCHI_NO_NATIVE = '1'; });
  afterAll(() => {
    delete process.env.MOCHI_NO_NATIVE;
    closeRustRuntime();
  });

  it('reports unavailable and every op falls back to null', async () => {
    expect(isRustRuntimeAvailable()).toBe(false);
    expect(await rustRuntimeVersion()).toBeNull();
    expect(await nativePlanCompaction([{ role: 'user', content: 'hi' }])).toBeNull();
    expect(await nativeTokensCount([{ role: 'user', content: 'hi' }])).toBeNull();
    expect(await nativeAssembleStream([{ content: 'x' }])).toBeNull();
    // Repeated calls stay null (no spawn attempt, no state corruption).
    expect(await rustRuntimeVersion()).toBeNull();
  });
});
