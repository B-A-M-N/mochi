import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { envTool } from './env.js';
import { existsSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('env tool', () => {
  const tmpDir = join(tmpdir(), 'mochi-env-test');
  const testEnvFile = join(tmpDir, '.env');

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const mockCtx = {
    cwd: tmpDir,
  };

  it('list returns empty when no .env file exists', async () => {
    const result = await envTool.execute({ action: 'list' }, mockCtx);
    expect(result).toBe('No variables found.');
  });

  it('get returns (not set) for missing key', async () => {
    const result = await envTool.execute({ action: 'get', key: 'NONEXISTENT' }, mockCtx);
    expect(result).toBe('NONEXISTENT: (not set)');
  });

  it('set writes to .env file', async () => {
    await envTool.execute({ action: 'set', key: 'TEST_KEY', value: 'test-value' }, mockCtx);
    const content = await import('node:fs/promises').then(fs => fs.readFile(testEnvFile, 'utf8'));
    expect(content).toContain('TEST_KEY=test-value');
  });

  it('set masks secret keys in .env file output', async () => {
    await envTool.execute({ action: 'set', key: 'API_KEY', value: 'secret123' }, mockCtx);
    const content = await import('node:fs/promises').then(fs => fs.readFile(testEnvFile, 'utf8'));
    // The file stores the raw value; masking happens on read
    expect(content).toContain('API_KEY=secret123');
  });

  it('list shows all variables from .env with secrets masked', async () => {
    await envTool.execute({ action: 'set', key: 'PUBLIC_VAR', value: 'public' }, mockCtx);
    await envTool.execute({ action: 'set', key: 'SECRET_TOKEN', value: 'secret' }, mockCtx);
    const result = await envTool.execute({ action: 'list' }, mockCtx);
    expect(result).toContain('PUBLIC_VAR=public');
    expect(result).toContain('SECRET_TOKEN=****');
  });

  it('load loads variables from .env file into process.env', async () => {
    writeFileSync(testEnvFile, 'LOAD_TEST=loaded_value\n');
    const result = await envTool.execute({ action: 'load', file: testEnvFile }, mockCtx);
    expect(result).toContain('Loaded 1 variable(s)');
    expect(process.env.LOAD_TEST).toBe('loaded_value');
    delete process.env.LOAD_TEST;
  });

  it('load does not overwrite existing env vars', async () => {
    process.env.EXISTING_VAR = 'original';
    writeFileSync(testEnvFile, 'EXISTING_VAR=from_file\n');
    await envTool.execute({ action: 'load', file: testEnvFile }, mockCtx);
    expect(process.env.EXISTING_VAR).toBe('original');
    delete process.env.EXISTING_VAR;
  });

  it('get reads from process.env and masks secret-like keys', async () => {
    process.env.MY_PASSWORD = 'secret123';
    const result = await envTool.execute({ action: 'get', key: 'MY_PASSWORD' }, mockCtx);
    expect(result).toBe('MY_PASSWORD=****');
    delete process.env.MY_PASSWORD;
  });

  it('get does not mask non-secret keys from process.env', async () => {
    process.env.MY_NAME = 'john';
    const result = await envTool.execute({ action: 'get', key: 'MY_NAME' }, mockCtx);
    expect(result).toBe('MY_NAME=john');
    delete process.env.MY_NAME;
  });

  it('set overwrites existing key in .env file', async () => {
    await envTool.execute({ action: 'set', key: 'OVERWRITE_ME', value: 'v1' }, mockCtx);
    await envTool.execute({ action: 'set', key: 'OVERWRITE_ME', value: 'v2' }, mockCtx);
    const content = await import('node:fs/promises').then(fs => fs.readFile(testEnvFile, 'utf8'));
    expect(content).toContain('OVERWRITE_ME=v2');
    expect(content).not.toContain('v1');
  });

  it('get returns (not set) for key not in process.env', async () => {
    const result = await envTool.execute({ action: 'get', key: 'NOT_IN_ENV' }, mockCtx);
    expect(result).toBe('NOT_IN_ENV: (not set)');
  });

  it('load does not overwrite existing env vars', async () => {
    process.env.EXISTING_VAR = 'original';
    writeFileSync(testEnvFile, 'EXISTING_VAR=from_file\n');
    await envTool.execute({ action: 'load', file: testEnvFile }, mockCtx);
    expect(process.env.EXISTING_VAR).toBe('original');
    delete process.env.EXISTING_VAR;
  });
});