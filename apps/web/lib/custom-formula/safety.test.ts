/**
 * Safety module tests — lib/custom-formula/safety.ts.
 *
 * Laws under test:
 * - Every evaluation carries the universal review flags.
 * - Curated per-herb notes come FROM DATA (sourced provenance) — the table
 *   is sparse by design; nothing is invented.
 * - Unknown herb PAIRS are flagged NEEDS REVIEW — never silently allowed.
 * - Category cautions derive from herb data via the rules table.
 */
import { describe, expect, it } from 'vitest';
import {
  evaluateFormula,
  maxSeverity,
  pairKey,
} from './safety';

describe('evaluateFormula — universal flags', () => {
  it('every formula carries the universal review flags', () => {
    const ev = evaluateFormula(['lavender']);
    const universal = ev.flags.filter((f) => f.kind === 'universal');
    expect(universal.length).toBe(2);
    expect(universal.every((f) => f.severity === 'review')).toBe(true);
    expect(ev.flags.some((f) => f.detail.includes('healthcare professional'))).toBe(true);
  });

  it('a single herb produces no pair flags', () => {
    const ev = evaluateFormula(['lavender']);
    expect(ev.unknownPairCount).toBe(0);
    expect(ev.knownPairCount).toBe(0);
    expect(ev.flags.some((f) => f.kind === 'pair')).toBe(false);
    expect(ev.allHerbsKnown).toBe(true);
  });

  it('duplicate herb ids are evaluated once', () => {
    const ev = evaluateFormula(['lavender', 'lavender', 'chamomile']);
    expect(ev.herbCount).toBe(2);
    expect(ev.unknownPairCount).toBe(1);
  });

  it('unknown herb ids are reported, not silently evaluated', () => {
    const ev = evaluateFormula(['lavender', 'not-a-herb']);
    expect(ev.allHerbsKnown).toBe(false);
    expect(ev.herbCount).toBe(1);
  });
});

describe('per-herb curated notes come from data', () => {
  it("st-johns-wort carries its sourced medication-interaction caution", () => {
    const ev = evaluateFormula(['st-johns-wort']);
    const flag = ev.flags.find((f) => f.herbIds.includes('st-johns-wort') && f.kind === 'herb');
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe('caution');
    expect(flag?.title).toMatch(/interacts with many medications/i);
    expect(flag?.source).toBe('data');
    expect(flag?.detail).toMatch(/SOURCED/);
  });

  it('herbs with no curated note get no herb-level flag (never invented)', () => {
    const ev = evaluateFormula(['lavender']);
    expect(ev.flags.some((f) => f.kind === 'herb')).toBe(false);
  });
});

describe('unknown pairs are flagged NEEDS REVIEW — never silently allowed', () => {
  it('two herbs with no curated pair note produce one aggregated NEEDS REVIEW flag', () => {
    const ev = evaluateFormula(['lavender', 'chamomile']);
    expect(ev.unknownPairCount).toBe(1);
    const flag = ev.flags.find(
      (f) => f.kind === 'pair' && f.title.includes('NEEDS REVIEW'),
    );
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe('review');
    expect(flag?.detail).toMatch(/Lavender \+ Chamomile/);
    expect(flag?.detail).toMatch(/Amber reviews every custom formula/);
  });

  it('three herbs produce exactly three unknown pairs (n·(n−1)/2)', () => {
    const ev = evaluateFormula(['lavender', 'chamomile', 'peppermint']);
    expect(ev.unknownPairCount).toBe(3);
    const flags = ev.flags.filter((f) => f.kind === 'pair' && f.title.includes('NEEDS REVIEW'));
    // Aggregated into ONE flag listing all unknown pairs.
    expect(flags.length).toBe(1);
    expect(flags[0]?.detail).toMatch(/Lavender \+ Chamomile/);
    expect(flags[0]?.detail).toMatch(/Lavender \+ Peppermint/);
    expect(flags[0]?.detail).toMatch(/Chamomile \+ Peppermint/);
  });
});

describe('category cautions derive from herb data', () => {
  it('two sleep-category botanicals trigger the calming caution', () => {
    const ev = evaluateFormula(['lavender', 'chamomile']);
    const flag = ev.flags.find((f) => f.title === 'Multiple calming botanicals');
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe('caution');
    expect(flag?.source).toBe('rule');
    expect(flag?.herbIds).toEqual(expect.arrayContaining(['lavender', 'chamomile']));
  });

  it('one sleep botanical does not trigger it (threshold = 2)', () => {
    const ev = evaluateFormula(['lavender']);
    expect(ev.flags.some((f) => f.title === 'Multiple calming botanicals')).toBe(false);
  });

  it('three energy-category botanicals trigger the stimulating caution', () => {
    const ev = evaluateFormula(['ashwagandha', 'rhodiola', 'maca']);
    const flag = ev.flags.find((f) => f.title === 'Multiple stimulating botanicals');
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe('caution');
  });

  it('two energy botanicals do not trigger it (threshold = 3)', () => {
    const ev = evaluateFormula(['ashwagandha', 'rhodiola']);
    expect(ev.flags.some((f) => f.title === 'Multiple stimulating botanicals')).toBe(false);
  });
});

describe('pairKey + maxSeverity helpers', () => {
  it('pairKey is order-independent', () => {
    expect(pairKey('b', 'a')).toBe(pairKey('a', 'b'));
    expect(pairKey('lavender', 'chamomile')).toBe('chamomile~lavender');
  });

  it('maxSeverity returns the highest severity present', () => {
    const ev = evaluateFormula(['st-johns-wort', 'lavender', 'chamomile']);
    expect(maxSeverity(ev.flags)).toBe('caution');
    const calm = evaluateFormula(['peppermint']);
    expect(maxSeverity(calm.flags)).toBe('review');
    expect(maxSeverity([])).toBe('info');
  });
});
