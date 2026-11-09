/**
 * Zodiac + age gates — pure computation (Gaia profile build).
 * Locks: every sign, both sides of every cusp, birthday parsing
 * strictness, and the shared age function's birthday boundaries
 * (the day before vs the day of — the gates' whole game).
 */
import { describe, expect, it } from 'vitest';
import {
  ageOn,
  parseBirthday,
  zodiacForBirthday,
  zodiacForMonthDay,
  ZODIAC_SIGNS,
} from './zodiac';

describe('sun signs', () => {
  it('has all twelve signs with element, modality, and qualities', () => {
    expect(ZODIAC_SIGNS).toHaveLength(12);
    for (const sign of ZODIAC_SIGNS) {
      expect(sign.element).toMatch(/^(Fire|Earth|Air|Water)$/);
      expect(sign.modality).toMatch(/^(Cardinal|Fixed|Mutable)$/);
      expect(sign.qualities.length).toBeGreaterThan(40);
    }
  });

  // [day before cusp → sign, cusp day → sign]
  const cusps: [string, string, string, string][] = [
    ['2026-03-20', 'Pisces', '2026-03-21', 'Aries'],
    ['2026-04-19', 'Aries', '2026-04-20', 'Taurus'],
    ['2026-05-20', 'Taurus', '2026-05-21', 'Gemini'],
    ['2026-06-20', 'Gemini', '2026-06-21', 'Cancer'],
    ['2026-07-22', 'Cancer', '2026-07-23', 'Leo'],
    ['2026-08-22', 'Leo', '2026-08-23', 'Virgo'],
    ['2026-09-22', 'Virgo', '2026-09-23', 'Libra'],
    ['2026-10-22', 'Libra', '2026-10-23', 'Scorpio'],
    ['2026-11-21', 'Scorpio', '2026-11-22', 'Sagittarius'],
    ['2026-12-21', 'Sagittarius', '2026-12-22', 'Capricorn'],
    ['2026-01-19', 'Capricorn', '2026-01-20', 'Aquarius'],
    ['2026-02-18', 'Aquarius', '2026-02-19', 'Pisces'],
  ];
  for (const [before, beforeSign, cusp, cuspSign] of cusps) {
    it(`${before} is ${beforeSign}; ${cusp} is ${cuspSign}`, () => {
      expect(zodiacForBirthday(before)?.name).toBe(beforeSign);
      expect(zodiacForBirthday(cusp)?.name).toBe(cuspSign);
    });
  }

  it('wraps the year: late December and early January are Capricorn', () => {
    expect(zodiacForMonthDay(12, 31)?.name).toBe('Capricorn');
    expect(zodiacForMonthDay(1, 1)?.name).toBe('Capricorn');
  });

  it('rejects impossible month/day input', () => {
    expect(zodiacForMonthDay(13, 1)).toBeNull();
    expect(zodiacForMonthDay(0, 10)).toBeNull();
    expect(zodiacForMonthDay(6, 0)).toBeNull();
  });
});

describe('birthday parsing', () => {
  it('parses strict YYYY-MM-DD only', () => {
    expect(parseBirthday('1992-11-17')).toEqual({ year: 1992, month: 11, day: 17 });
    expect(parseBirthday('17-11-1992')).toBeNull();
    expect(parseBirthday('1992/11/17')).toBeNull();
    expect(parseBirthday('')).toBeNull();
    expect(parseBirthday(null)).toBeNull();
  });

  it('rejects impossible dates', () => {
    expect(parseBirthday('2026-02-30')).toBeNull();
    expect(parseBirthday('2026-04-31')).toBeNull();
    expect(parseBirthday('2023-02-29')).toBeNull(); // not a leap year
    expect(parseBirthday('2024-02-29')).not.toBeNull(); // leap year
  });
});

describe('ageOn — the shared gate function', () => {
  const on = (iso: string) => new Date(`${iso}T12:00:00Z`);

  it('counts completed years, turning on the birthday itself', () => {
    expect(ageOn('2000-06-15', on('2013-06-14'))).toBe(12);
    expect(ageOn('2000-06-15', on('2013-06-15'))).toBe(13);
    expect(ageOn('2000-06-15', on('2018-06-14'))).toBe(17);
    expect(ageOn('2000-06-15', on('2018-06-15'))).toBe(18);
  });

  it('handles year boundaries', () => {
    expect(ageOn('2000-12-31', on('2013-01-01'))).toBe(12);
    expect(ageOn('2000-01-01', on('2013-01-01'))).toBe(13);
  });

  it('returns null for unparseable birthdays', () => {
    expect(ageOn('not-a-date', on('2026-01-01'))).toBeNull();
    expect(ageOn(undefined, on('2026-01-01'))).toBeNull();
  });
});
