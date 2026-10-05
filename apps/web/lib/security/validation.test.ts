/**
 * REGRESSION SUITE — §19: server-side input sanitizers.
 *
 * Laws under test:
 * - Sanitizers never throw on garbage input — they return cleaned values or null.
 * - HTML/script content is stripped from plain-text fields (XSS gate).
 * - Email/phone/int/id validators reject malformed values and type confusion.
 */
import { describe, expect, it } from 'vitest';
import {
  isRecord,
  sanitizeEmail,
  sanitizeId,
  sanitizeInt,
  sanitizePhone,
  sanitizePlainText,
} from './validation';

describe('sanitizePlainText', () => {
  it('strips HTML tags and control characters', () => {
    expect(sanitizePlainText('<script>alert(1)</script>hello')).toBe('alert(1)hello');
    expect(sanitizePlainText('a\u0000b\u001fc')).toBe('abc');
  });

  it('trims and caps length', () => {
    expect(sanitizePlainText('  hi  ')).toBe('hi');
    expect(sanitizePlainText('x'.repeat(600), 500)).toHaveLength(500);
  });

  it('returns empty string for non-string input (never throws)', () => {
    for (const bad of [null, undefined, 42, {}, [], true]) {
      expect(sanitizePlainText(bad)).toBe('');
    }
  });
});

describe('sanitizeEmail', () => {
  it('accepts valid addresses, normalized to lowercase', () => {
    expect(sanitizeEmail('Amber@Consultant.COM')).toBe('amber@consultant.com');
    expect(sanitizeEmail('  user+tag@example.org  ')).toBe('user+tag@example.org');
  });

  it('rejects malformed addresses', () => {
    for (const bad of [
      'not-an-email',
      'a@b',
      '@example.com',
      'user@',
      'user..dots@example.com',
      '.lead@example.com',
      'user@example',
      'user @example.com',
      '',
    ]) {
      expect(sanitizeEmail(bad), bad).toBeNull();
    }
  });

  it('rejects non-strings and overlong input (never throws)', () => {
    expect(sanitizeEmail(null)).toBeNull();
    expect(sanitizeEmail(123)).toBeNull();
    expect(sanitizeEmail('a'.repeat(250) + '@example.com')).toBeNull();
  });
});

describe('sanitizePhone', () => {
  it('normalizes common formatting, keeps leading +', () => {
    expect(sanitizePhone('(801) 414-8984')).toBe('8014148984');
    expect(sanitizePhone('+1 801-414-8984')).toBe('+18014148984');
    expect(sanitizePhone('801.414.8984')).toBe('8014148984');
  });

  it('rejects too-short, too-long, and non-numeric input', () => {
    expect(sanitizePhone('123456')).toBeNull();
    expect(sanitizePhone('1'.repeat(16))).toBeNull();
    expect(sanitizePhone('call me')).toBeNull();
    expect(sanitizePhone('')).toBeNull();
    expect(sanitizePhone(null)).toBeNull();
  });
});

describe('sanitizeInt', () => {
  it('accepts in-range integers (number or numeric string)', () => {
    expect(sanitizeInt(3, { min: 1, max: 10 })).toBe(3);
    expect(sanitizeInt('7', { min: 1, max: 10 })).toBe(7);
  });

  it('rejects floats, non-numeric strings, out-of-range, and type confusion', () => {
    for (const bad of [1.5, '3.5', 'abc', '', '  ', NaN, Infinity, null, undefined, {}, [3]]) {
      expect(sanitizeInt(bad, { min: 1, max: 10 }), String(bad)).toBeNull();
    }
    expect(sanitizeInt(0, { min: 1, max: 10 })).toBeNull();
    expect(sanitizeInt(11, { min: 1, max: 10 })).toBeNull();
  });
});

describe('sanitizeId', () => {
  it('accepts slug-safe catalog IDs', () => {
    expect(sanitizeId('dreamease-capsules')).toBe('dreamease-capsules');
    expect(sanitizeId('SCENT_RECIPE_01')).toBe('scent_recipe_01');
  });

  it('rejects paths, queries, scripts, and overlong input', () => {
    for (const bad of [
      '../etc/passwd',
      'a?b=c',
      '<script>',
      'has space',
      '',
      'x'.repeat(81),
      42,
      null,
    ]) {
      expect(sanitizeId(bad), String(bad)).toBeNull();
    }
  });
});

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    for (const bad of [null, undefined, [], [1], 'x', 42, true]) {
      expect(isRecord(bad)).toBe(false);
    }
  });
});
