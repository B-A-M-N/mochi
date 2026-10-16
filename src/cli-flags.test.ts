import { describe, it, expect } from 'vitest';
import { parseArgs, configFromFlags } from './cli-flags.js';

describe('parseArgs', () => {
  it('parses a space-separated value flag under its literal key', () => {
    const { flags, positional } = parseArgs(['--base-url', 'http://127.0.0.1:9/v1', 'do', 'a', 'thing']);
    expect(flags['base-url']).toBe('http://127.0.0.1:9/v1');
    expect(positional).toEqual(['do', 'a', 'thing']);
  });

  it('parses --key=value form', () => {
    const { flags } = parseArgs(['--model=foo/bar']);
    expect(flags.model).toBe('foo/bar');
  });

  it('treats known boolean flags as flags, not values', () => {
    const { flags, positional } = parseArgs(['--plan', 'task']);
    expect(flags.plan).toBe(true);
    expect(positional).toEqual(['task']);
  });
});

describe('configFromFlags', () => {
  it('applies --base-url (regression: was read as flags.baseUrl and dropped)', () => {
    const { flags } = parseArgs(['--base-url', 'http://127.0.0.1:9/v1', '--provider', 'openai', '--api-key', 'sk-x']);
    const overrides = configFromFlags(flags);
    expect(overrides.model?.baseUrl).toBe('http://127.0.0.1:9/v1');
    expect(overrides.model?.provider).toBe('openai');
    expect(overrides.model?.apiKey).toBe('sk-x');
  });

  it('applies --model to every tier profile (regression: profile overrode model.model)', () => {
    const { flags } = parseArgs(['--model', 'my-model']);
    const overrides = configFromFlags(flags);
    expect(overrides.model?.model).toBe('my-model');
    expect(overrides.model?.profiles).toEqual({
      fast: 'my-model', coding: 'my-model', reasoning: 'my-model', review: 'my-model',
    });
  });

  it('maps the documented `med` reasoning alias to `medium`', () => {
    const overrides = configFromFlags({ reasoning: 'med' });
    expect(overrides.reasoning).toBe('medium');
  });
});
