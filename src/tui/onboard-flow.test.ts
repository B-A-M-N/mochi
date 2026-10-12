import { describe, it, expect, vi } from 'vitest';
import { runInteractiveOnboarding } from './onboard-flow.js';
import type { Runtime } from '../runtime.js';

describe('runInteractiveOnboarding', () => {
  it('handles cancellation gracefully and marks onboarded', async () => {
    const lines: string[] = [];
    const push = (_kind: any, text: string) => { lines.push(text); };
    const scheduleRender = vi.fn();
    const openMenu = vi.fn().mockResolvedValue(-1); // user hits Esc
    const mockRuntime = {
      cwd: '/tmp',
      config: { model: { model: 'glm-5.3-flash' } },
      useProvider: vi.fn(),
    } as unknown as Runtime;

    await runInteractiveOnboarding(mockRuntime, openMenu, push, scheduleRender);

    expect(openMenu).toHaveBeenCalledTimes(1);
    expect(lines.some((l) => l.includes('Setup skipped'))).toBe(true);
    expect(lines.some((l) => l.includes('welcome home'))).toBe(true);
  });

  it('runs express setup when option 0 is selected', async () => {
    const lines: string[] = [];
    const push = (_kind: any, text: string) => { lines.push(text); };
    const scheduleRender = vi.fn();
    const openMenu = vi.fn().mockResolvedValue(0); // option 0: Express Setup
    const mockRuntime = {
      cwd: '/tmp',
      config: { model: { model: 'glm-5.3-flash' } },
      useProvider: vi.fn(),
    } as unknown as Runtime;

    await runInteractiveOnboarding(mockRuntime, openMenu, push, scheduleRender);

    expect(openMenu).toHaveBeenCalledTimes(1);
    expect(lines.some((l) => l.includes('Running Express Setup'))).toBe(true);
    expect(lines.some((l) => l.includes('Setup complete'))).toBe(true);
  });

  it('runs step-by-step setup when option 1 is selected', async () => {
    const lines: string[] = [];
    const push = (_kind: any, text: string) => { lines.push(text); };
    const scheduleRender = vi.fn();
    // Step 0: Step-by-step (1), Step 1: Skip (2), Step 2: Option 0 (glm), Step 3: Skip (3), Step 4: Skip (3)
    const openMenu = vi.fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(3);

    const mockRuntime = {
      cwd: '/tmp',
      config: { model: { model: 'default' } },
      useProvider: vi.fn(),
    } as unknown as Runtime;

    await runInteractiveOnboarding(mockRuntime, openMenu, push, scheduleRender);

    expect(openMenu).toHaveBeenCalledTimes(5);
    expect(mockRuntime.useProvider).toHaveBeenCalledWith('freeinference', 'glm-5.3-flash');
    expect(lines.some((l) => l.includes('Setup complete'))).toBe(true);
  });
});
