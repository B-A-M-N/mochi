import { describe, it, expect } from 'vitest';
import { colorTool } from './color.js';

// The color tool is pure string manipulation — call execute directly with a
// throwaway context (it never touches ctx).
const run = (args: Record<string, unknown>) => colorTool.execute(args, {} as never);

describe('color tool', () => {
  it('strips ANSI codes', async () => {
    expect(await run({ action: 'strip', input: '\x1b[31mred\x1b[0m and \x1b[1mbold\x1b[0m' })).toBe('red and bold');
    expect(await run({ action: 'strip', input: 'plain' })).toBe('plain');
    expect(await run({ action: 'strip' })).toBe('');
  });

  it('returns the palette as formatted JSON', async () => {
    const palette = JSON.parse(await run({ action: 'palette' }));
    expect(Array.isArray(palette)).toBe(true);
    expect(palette.some((e: { name: string }) => e.name === 'mochi-orange')).toBe(true);
    expect(palette.every((e: { name: string; hex: string; ansi: string }) => e.name && e.hex && e.ansi)).toBe(true);
  });

  it('renders a demo of every color except reset', async () => {
    const demo = await run({ action: 'demo' });
    expect(demo).toContain('mochi-violet');
    expect(demo).toContain('#cc0000');
    expect(demo.split('\n').length).toBeGreaterThan(15);
    // The reset row is filtered out of the demo.
    expect(demo).not.toMatch(/^\S*reset\s/m);
  });

  it('converts hex input to rgb, ansi, and hex', async () => {
    expect(await run({ action: 'convert', input: '#ff0000', format: 'rgb' })).toBe('rgb(255, 0, 0)');
    expect(await run({ action: 'convert', input: 'ff0000', format: 'ansi' })).toContain('\x1b[38;2;255;0;0m');
    expect(await run({ action: 'convert', input: '#aabbcc', format: 'hex' })).toBe('#aabbcc');
    expect(await run({ action: 'convert', input: 'aabbcc', format: 'hex' })).toBe('#aabbcc');
  });

  it('converts rgb() input to hex, ansi, and identity', async () => {
    expect(await run({ action: 'convert', input: 'rgb(1, 2, 3)', format: 'hex' })).toBe('#010203');
    expect(await run({ action: 'convert', input: 'rgb(1,2,3)', format: 'ansi' })).toContain('\x1b[38;2;1;2;3m');
    expect(await run({ action: 'convert', input: 'rgb(1,2,3)', format: 'rgb' })).toBe('rgb(1,2,3)');
  });

  it('resolves named palette colors to hex, rgb, and ansi', async () => {
    expect(await run({ action: 'convert', input: 'red', format: 'hex' })).toBe('#cc0000');
    expect(await run({ action: 'convert', input: 'red', format: 'rgb' })).toBe('rgb(204, 0, 0)');
    expect(await run({ action: 'convert', input: 'RED', format: 'ansi' })).toContain('\x1b[31m');
    // Unknown format on a named color falls through to the ansi rendering.
    expect(await run({ action: 'convert', input: 'mochi-teal', format: 'nope' })).toContain('mochi-teal');
  });

  it('rejects unknown actions and unparseable colors', async () => {
    await expect(run({ action: 'sparkle' })).rejects.toThrow(/Unknown color action/);
    await expect(run({ action: 'convert', input: '#zzzzzz' })).rejects.toThrow(/Invalid hex color/);
    await expect(run({ action: 'convert', input: 'chartreuse-ish' })).rejects.toThrow(/Cannot parse color/);
  });
});
