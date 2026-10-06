/**
 * Herb catalog integrity tests — lib/catalog/herbs.ts (G2/G10 data).
 *
 * Laws under test:
 * - 306 botanicals ported; ids unique; every entry well-formed.
 * - Prices are positive integer cents (no floats).
 * - Ritual-bundle pseudo-entries excluded (not botanicals).
 * - Capsule and tea builders each have a non-empty, form-usable herb list.
 * - Legacy cure/treatment claim language was neutralized at port time.
 */
import { describe, expect, it } from 'vitest';
import { HERBS, getHerb, herbPriceCents, herbsForUse } from './herbs';

const FORBIDDEN = [
  /\bcures?\b/i,
  /\bcured\b/i,
  /\btreats\b/i,
  /\bdiagnos\w*\b/i,
  /nature'?s valium/i,
  /nature'?s antibiotic/i,
  /\bcancer\b/i,
  /\btumor/i,
  /\bdiabetes\b/i,
];

describe('herb catalog integrity', () => {
  it('ports 306 botanicals with unique ids', () => {
    expect(HERBS.length).toBe(306);
    const ids = HERBS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every herb is well-formed', () => {
    for (const h of HERBS) {
      expect(h.id, 'id').toMatch(/^[a-z0-9-]+$/);
      expect(h.name.length, `${h.id} name`).toBeGreaterThan(0);
      expect(h.categories.length, `${h.id} categories`).toBeGreaterThan(0);
      expect(h.uses.length, `${h.id} uses`).toBeGreaterThan(0);
      expect(h.traditionalNote.length, `${h.id} note`).toBeGreaterThan(0);
      expect(
        h.uses.every((u) => ['tea', 'capsule', 'balm', 'serum'].includes(u)),
        `${h.id} uses valid`,
      ).toBe(true);
    }
  });

  it('prices are positive integer cents — no floats', () => {
    for (const h of HERBS) {
      expect(Number.isInteger(h.priceCents), `${h.id} priceCents integer`).toBe(true);
      expect(h.priceCents, `${h.id} priceCents positive`).toBeGreaterThan(0);
    }
    // Legacy tiers preserved: 17 / 23 / 29 / 39.
    const tiers = [...new Set(HERBS.map((h) => h.priceCents))].sort((a, b) => a - b);
    expect(tiers).toEqual([17, 23, 29, 39]);
  });

  it('ritual-bundle pseudo-entries are excluded', () => {
    expect(HERBS.some((h) => h.categories.includes('bundle' as never))).toBe(false);
    expect(getHerb('gentle-detox-ritual')).toBeUndefined();
  });

  it('capsule and tea builders each have a non-empty herb list', () => {
    const capsule = herbsForUse('capsule');
    const tea = herbsForUse('tea');
    expect(capsule.length).toBeGreaterThan(50);
    expect(tea.length).toBeGreaterThan(50);
    expect(capsule.every((h) => h.uses.includes('capsule'))).toBe(true);
    expect(tea.every((h) => h.uses.includes('tea'))).toBe(true);
  });

  it('getHerb / herbPriceCents lookups', () => {
    expect(getHerb('ashwagandha')?.name).toBe('Ashwagandha');
    expect(getHerb('nope')).toBeUndefined();
    expect(herbPriceCents('ashwagandha')).toBe(39);
    expect(() => herbPriceCents('nope')).toThrow(/Unknown herb id/);
  });

  it('no cure/treatment claim language in ported copy', () => {
    const offenders: string[] = [];
    for (const h of HERBS) {
      const text = [h.traditionalNote, ...h.traditionalBenefits].join(' | ');
      for (const p of FORBIDDEN) {
        if (p.test(text)) {
          offenders.push(`${h.id}: ${p}`);
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the six rewritten legacy entries carry neutral framing', () => {
    expect(getHerb('valerian')?.traditionalNote).not.toMatch(/valium/i);
    expect(getHerb('garlic')?.traditionalNote).not.toMatch(/antibiotic/i);
    expect(getHerb('black-seed')?.traditionalNote).not.toMatch(/\bcure\b/i);
    expect(getHerb('neem-oil')?.traditionalNote).not.toMatch(/\btreats\b/i);
    expect(
      getHerb('st-johns-wort')?.traditionalBenefits.join(' '),
    ).not.toMatch(/depression/i);
  });
});
