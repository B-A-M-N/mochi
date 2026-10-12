import { describe, it, expect } from 'vitest';
import { isNewer } from './update-check.js';

describe('update-check version compare', () => {
  it('detects newer releases', () => {
    expect(isNewer('0.24.0', '0.23.0')).toBe(true);
    expect(isNewer('0.23.0', '0.23.0')).toBe(false);
    expect(isNewer('0.22.9', '0.23.0')).toBe(false);
    expect(isNewer('1.0.0', '0.23.0')).toBe(true);
    expect(isNewer('v0.24.0', '0.23.0')).toBe(true);
  });
});
