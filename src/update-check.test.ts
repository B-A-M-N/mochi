import { describe, expect, it } from 'vitest';
import { compareSemver, detectInstallStyle, updateNoticeText, type UpdateInfo } from './update-check.js';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('compareSemver', () => {
  it('orders major/minor/patch and tolerates v-prefix', () => {
    expect(compareSemver('1.0.0', '0.27.0')).toBeGreaterThan(0);
    expect(compareSemver('0.27.0', '0.27.1')).toBeLessThan(0);
    expect(compareSemver('v0.27.0', '0.27.0')).toBe(0);
    expect(compareSemver('0.27.0-rc1', '0.27.0')).toBe(0); // prerelease suffix ignored
    expect(compareSemver('1.0', '1.0.0')).toBe(0);
  });
});

describe('updateNoticeText', () => {
  it('returns the /update suggestion when a release is available', () => {
    const info: UpdateInfo = { available: true, current: '0.27.0', latest: '0.28.0', source: 'network', checkedAt: 0 };
    const notice = updateNoticeText(info);
    expect(notice).toContain('/update');
    expect(notice).toContain('0.28.0');
    expect(notice).toContain('0.27.0');
  });
  it('returns null when up to date (no nag)', () => {
    const info: UpdateInfo = { available: false, current: '0.27.0', latest: '0.27.0', source: 'network', checkedAt: 0 };
    expect(updateNoticeText(info)).toBeNull();
  });
});

describe('detectInstallStyle', () => {
  it('git checkout vs installer install', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mochi-upd-'));
    try {
      expect(detectInstallStyle(dir)).toBe('install');
      writeFileSync(resolve(dir, '.git'), 'gitdir: elsewhere', 'utf8');
      expect(detectInstallStyle(dir)).toBe('git');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
