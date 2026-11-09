/**
 * Star chart computation — deterministic, honest scope (Gaia build).
 * Known anchors: the epoch new moon (2000-01-06) and the full moon of
 * 2000-01-21. No ephemeris claims: the moon's SIGN is never produced.
 */
import { describe, expect, it } from 'vitest';
import { computeStarChart, moonPhaseAt, starChartStale } from './star-chart';

describe('moonPhaseAt', () => {
  it('the epoch day reads as a new moon', () => {
    const phase = moonPhaseAt('2000-01-06', null);
    expect(phase?.name).toBe('New Moon');
    expect(phase!.illumination).toBeLessThan(0.05);
  });

  it('mid-cycle reads as a full moon', () => {
    const phase = moonPhaseAt('2000-01-21', null);
    expect(phase?.name).toBe('Full Moon');
    expect(phase!.illumination).toBeGreaterThan(0.95);
  });

  it('is deterministic — same inputs, same phase, every time', () => {
    expect(moonPhaseAt('1992-11-17', '07:30')).toEqual(moonPhaseAt('1992-11-17', '07:30'));
    expect(moonPhaseAt('1992-11-17', null)).not.toBeNull();
  });

  it('rejects unparseable birthdays', () => {
    expect(moonPhaseAt('Nov 17 1992', null)).toBeNull();
  });
});

describe('computeStarChart + staleness', () => {
  const base = { birthday: '1992-11-17', birth_time: null, birth_place: null };

  it('computes sun sign + moon phase from a bare birthday', () => {
    const chart = computeStarChart(base, new Date('2026-11-08T00:00:00Z'));
    expect(chart?.sun_sign_id).toBe('scorpio');
    expect(chart?.has_birth_details).toBe(false);
    expect(chart?.moon_phase.name.length).toBeGreaterThan(0);
  });

  it('marks full birth details when time + place are present', () => {
    const chart = computeStarChart(
      { birthday: '1992-11-17', birth_time: '07:30', birth_place: 'Provo, Utah' },
      new Date('2026-11-08T00:00:00Z'),
    );
    expect(chart?.has_birth_details).toBe(true);
  });

  it('staleness follows the birth inputs exactly', () => {
    const chart = computeStarChart(base, new Date('2026-11-08T00:00:00Z'))!;
    expect(starChartStale(chart, base)).toBe(false);
    expect(starChartStale(chart, { ...base, birth_time: '07:30' })).toBe(true);
    expect(starChartStale(chart, { ...base, birthday: '1992-11-18' })).toBe(true);
    expect(starChartStale(null, base)).toBe(true);
  });
});
