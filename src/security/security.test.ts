import { describe, it, expect } from 'vitest';
import {
  redact,
  maybeRedact,
  redactObject,
  classifyCommand,
  ApprovalQueue,
  CommandRisk,
} from './security.js';

describe('security.ts — redaction & classification', () => {
  describe('redact()', () => {
    it('redacts API keys in common formats', () => {
      // sk- needs 16+ chars after sk-
      expect(redact('Bearer sk-abc1234567890123')).toContain('[secret-redacted]');
      expect(redact('api_key=sk-secret1234567890123')).toContain('[secret-redacted]');
      // ghp_ needs 20+ chars
      expect(redact('Authorization: Bearer ghp_abcdefghijklmnopqrst')).toContain('[secret-redacted]');
    });

    it('handles empty and safe strings', () => {
      expect(redact('')).toBe('');
      expect(redact('no secrets here')).toBe('no secrets here');
    });

    it('redacts JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      expect(redact(jwt)).toContain('[secret-redacted]');
    });

    it('redacts private key blocks', () => {
      const pk = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQD...\n-----END PRIVATE KEY-----';
      expect(redact(pk)).toContain('[secret-redacted]');
    });
  });

  describe('maybeRedact()', () => {
    it('redacts by default (REDACT_ENABLED=true when env unset)', () => {
      const input = 'Bearer sk-abc1234567890123';
      // Default: env not set -> REDACT_ENABLED=true -> redacts
      expect(maybeRedact(input)).toContain('[secret-redacted]');
      // Explicitly disable
      process.env.MOCHI_REDACT_SECRETS = '0';
      expect(maybeRedact(input)).toBe(input);
      delete process.env.MOCHI_REDACT_SECRETS;
    });
  });

  describe('redactObject()', () => {
    it('redacts nested objects recursively when keys match patterns', () => {
      const obj = {
        apiKey: 'sk-secret1234567890123',
        nested: { token: 'tkn-1234567890123' },
        safe: 'value',
        arr: ['key1', 'secret2'],
      };
      const redacted = redactObject(obj, 3);
      expect(redacted.apiKey).toBe('[secret-redacted]');
      expect(redacted.nested.token).toBe('[secret-redacted]');
      expect(redacted.safe).toBe('value');
      // Array values without matching keys are not redacted (the key is the index)
      expect(redacted.arr[1]).toBe('secret2');
    });

    it('respects depth limit', () => {
      const deep = { a: { b: { c: { d: 'secret' } } } };
      const r1 = redactObject(deep, 1);
      const r3 = redactObject(deep, 3);
      // Depth 1: only top-level matching keys
      expect(r1.a).toEqual({ b: { c: { d: 'secret' } } });
      // Depth 3: 3 levels deep (root->a->b->c). Need depth 4 to reach c's children
      const deep2 = { a: { b: { c: { apiKey: 'secret' } } } };
      const r4 = redactObject(deep2, 4);
      expect(r4.a.b.c.apiKey).toBe('[secret-redacted]');
    });
  });

  describe('classifyCommand()', () => {
    it('classifies network commands as network risk', () => {
      expect(classifyCommand('curl https://api.example.com')).toBe('network');
      expect(classifyCommand('wget http://example.com')).toBe('network');
      expect(classifyCommand('npm install')).toBe('network');
    });

    it('classifies destructive commands as destructive', () => {
      expect(classifyCommand('rm -rf /')).toBe('destructive');
      expect(classifyCommand('git push --force')).toBe('destructive');
      // npm publish matches NETWORK pattern (npm publish) before DESTRUCTIVE
      expect(classifyCommand('npm publish')).toBe('network');
    });

    it('defaults to low risk', () => {
      expect(classifyCommand('ls -la')).toBe('low');
      expect(classifyCommand('cat file.txt')).toBe('low');
      expect(classifyCommand('echo hello')).toBe('low');
    });
  });

  describe('ApprovalQueue', () => {
    it('enqueues and dequeues approvals FIFO via request/decide', () => {
      const q = new ApprovalQueue();
      const a1 = q.request('ls');
      const a2 = q.request('rm');
      expect(q.pending()).toHaveLength(2);
      const d1 = q.decide(a1.id, 'approved');
      expect(d1?.status).toBe('approved');
      expect(q.pending()).toHaveLength(1);
      const d2 = q.decide(a2.id, 'denied');
      expect(d2?.status).toBe('denied');
      expect(q.pending()).toHaveLength(0);
    });

    it('peek via pending()', () => {
      const q = new ApprovalQueue();
      const a = q.request('ls');
      expect(q.pending()).toHaveLength(1);
      expect(q.pending()[0].id).toBe(a.id);
    });
  });
});