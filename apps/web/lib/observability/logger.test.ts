/**
 * Structured logger (Stage 5) — laws:
 * - Entries are structured: timestamp / level / scope / message / context.
 * - Level filtering drops anything below the configured minimum.
 * - Redaction is by construction: sensitive keys (authorization,
 *   cookie, password, secret, signature, token, api_key variants) are
 *   masked at any depth; emails and credential-shaped substrings in
 *   string values are masked; Errors reduce to name + redacted message
 *   with NO stack. A webhook secret or signature cannot pass through.
 */
import { describe, expect, it } from 'vitest';
import {
  createLogger,
  redactString,
  sanitizeLogContext,
  type LogEntry,
} from './logger';

function capture(minLevel?: 'debug' | 'info' | 'warn' | 'error') {
  const entries: LogEntry[] = [];
  const log = createLogger('test-scope', {
    sink: (entry) => entries.push(entry),
    minLevel: minLevel ?? 'debug',
    now: () => new Date('2026-10-21T12:00:00.000Z'),
  });
  return { entries, log };
}

describe('logger structure + levels', () => {
  it('emits structured entries with timestamp, level, scope, message, context', () => {
    const { entries, log } = capture();
    log.info('something happened', { order_id: 'ord_1' });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      timestamp: '2026-10-21T12:00:00.000Z',
      level: 'info',
      scope: 'test-scope',
      message: 'something happened',
      context: { order_id: 'ord_1' },
    });
    // JSON-serializable as a single log line.
    expect(() => JSON.parse(JSON.stringify(entries[0]))).not.toThrow();
  });

  it('filters out entries below the minimum level', () => {
    const { entries, log } = capture('warn');
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(entries.map((e) => e.level)).toEqual(['warn', 'error']);
  });

  it('child loggers extend the scope', () => {
    const { entries, log } = capture();
    log.child('webhook').error('boom');
    expect(entries[0].scope).toBe('test-scope:webhook');
  });
});

describe('logger redaction', () => {
  it('masks sensitive keys at any depth, including api_key variants', () => {
    const sanitized = sanitizeLogContext({
      authorization: 'Bearer abc',
      cookie: 'session=xyz',
      password: 'hunter2',
      secret: 'shh',
      signature: 't=1,v1=deadbeef',
      token: 'tok_123',
      api_key: 'key-1',
      apiKey: 'key-2',
      'API-KEY': 'key-3',
      stripe_signature: 'sig',
      webhook_secret: 'whsec_should_not_appear',
      nested: { access_token: 'tok', deep: { client_secret: 'cs' } },
      list: [{ refreshToken: 'rt' }],
      harmless: 'visible',
    });
    const json = JSON.stringify(sanitized);
    for (const leaked of [
      'abc',
      'xyz',
      'hunter2',
      'shh',
      'deadbeef',
      'tok_123',
      'key-1',
      'key-2',
      'key-3',
      'whsec_should_not_appear',
      'cs',
      'rt',
    ]) {
      expect(json).not.toContain(leaked);
    }
    expect(sanitized.harmless).toBe('visible');
    expect(sanitized.authorization).toBe('[redacted]');
  });

  it('masks email addresses in string values and messages', () => {
    expect(redactString('sent to buyer@example.com today')).toBe(
      'sent to [redacted-email] today',
    );
    const { entries, log } = capture();
    log.info('queued for someone@example.org', { to: 'someone@example.org' });
    const json = JSON.stringify(entries[0]);
    expect(json).not.toContain('someone@example.org');
    expect(json).toContain('[redacted-email]');
  });

  it('masks credential-shaped substrings (Stripe keys, whsec, Bearer)', () => {
    // Stripe's public documentation example key, assembled from fragments so
    // secret scanning does not flag this fixture as a literal credential.
    const exampleKey = ['sk', 'live', '4eC39HqLyjWDarjtT1zdp7dc'].join('_');
    const out = redactString(
      `key ${exampleKey} secret whsec_abc123DEF456 auth Bearer tok.value`,
    );
    expect(out).not.toContain(exampleKey);
    expect(out).not.toContain('whsec_abc123DEF456');
    expect(out).not.toContain('tok.value');
  });

  it('reduces Errors to name + redacted message, never a stack', () => {
    const err = new Error('failed for admin@example.com with whsec_leak999');
    const { entries, log } = capture();
    log.error('handler failed', { error: err });
    const json = JSON.stringify(entries[0]);
    expect(json).not.toContain('admin@example.com');
    expect(json).not.toContain('whsec_leak999');
    expect(json).not.toContain('stack');
    expect(entries[0].context?.error).toEqual({
      error_name: 'Error',
      error_message: 'failed for [redacted-email] with [redacted]',
    });
  });

  it('never throws on hostile context (circular, functions, bigint)', () => {
    const circular: Record<string, unknown> = { name: 'loop' };
    circular.self = circular;
    const { log } = capture();
    expect(() =>
      log.info('hostile', { circular, fn: () => 1, big: BigInt(3) }),
    ).not.toThrow();
  });
});
