import { describe, expect, it } from 'vitest';
import { searchProducts } from './search';
import type { Product } from '../../types';

const FIXTURES: Product[] = [
  {
    handle: 'lavender-fairy-dream-soap',
    title: 'Lavender Fairy Dream Soap',
    category: 'Soap',
    subcategory: 'Signature',
    tags: ['sleep', 'calm'],
    short_description: 'A calming bedtime soap with lavender and chamomile.',
  },
  {
    handle: 'dreamease-capsules',
    title: 'DreamEase Capsules',
    category: 'Capsules',
    subcategory: 'Botanical',
    tags: ['sleep'],
    short_description: 'Botanical capsules for evening wind-down rituals.',
  },
  {
    handle: 'citrus-goddess-glow-soap',
    title: 'Citrus Goddess Glow Soap',
    category: 'Soap',
    subcategory: 'Signature',
    tags: ['energy', 'morning'],
    short_description: 'Bright citrus soap for morning rituals.',
  },
];

describe('searchProducts', () => {
  it('returns empty for empty/whitespace queries', () => {
    expect(searchProducts('')).toEqual([]);
    expect(searchProducts('   ')).toEqual([]);
    expect(searchProducts('a')).toEqual([]);
  });

  it('matches titles first', () => {
    const results = searchProducts('dream', FIXTURES);
    expect(results[0].handle).toBe('dreamease-capsules');
    expect(results.map((r) => r.handle)).toContain('lavender-fairy-dream-soap');
  });

  it('matches tags and descriptions', () => {
    const sleep = searchProducts('sleep', FIXTURES);
    expect(sleep).toHaveLength(2);
    const citrus = searchProducts('morning', FIXTURES);
    expect(citrus.map((r) => r.handle)).toEqual(['citrus-goddess-glow-soap']);
  });

  it('caps results and orders deterministically', () => {
    const many: Product[] = Array.from({ length: 30 }, (_, i) => ({
      handle: `soap-${i}`,
      title: `Soap ${i}`,
      category: 'Soap',
      short_description: 'lavender soap',
    }));
    const results = searchProducts('lavender soap', many);
    expect(results).toHaveLength(10);
  });

  it('returns [] when nothing matches', () => {
    expect(searchProducts('xylophone', FIXTURES)).toEqual([]);
  });

  it('finds real catalog products by keyword', () => {
    const results = searchProducts('tarot');
    expect(results.some((p) => p.handle === 'tarot-readings')).toBe(true);
  });
});
