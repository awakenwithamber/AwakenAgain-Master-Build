/**
 * Homepage personalization rules (owner spec 2026-10-14): section
 * reordering, Grimoire emphasis, and "Picked for you" selection.
 */
import { describe, expect, it } from 'vitest';
import type { Product } from '../../types';
import { PRODUCTS } from '../catalog/products';
import {
  DEFAULT_HOME_ORDER,
  emphasizeGrimoire,
  orderHomeSections,
  pickHandlesForInterest,
} from './home-personalization';

describe('orderHomeSections', () => {
  it('returns the default order with no top interest', () => {
    expect(orderHomeSections(null)).toEqual([...DEFAULT_HOME_ORDER]);
  });

  it('moves the matching section first and keeps the rest stable', () => {
    expect(orderHomeSections('soaps')).toEqual([
      'best-sellers',
      'goal-cards',
      'how-made',
      'trust-stats',
      'reviews',
      'learn',
    ]);
    expect(orderHomeSections('herbs')).toEqual([
      'learn',
      'goal-cards',
      'best-sellers',
      'how-made',
      'trust-stats',
      'reviews',
    ]);
    expect(orderHomeSections('quiz')[0]).toBe('goal-cards');
    // Every reorder is a permutation of the default — nothing lost/added.
    for (const interest of ['soaps', 'herbs', 'articles', 'quiz'] as const) {
      expect([...orderHomeSections(interest)].sort()).toEqual(
        [...DEFAULT_HOME_ORDER].sort(),
      );
    }
  });

  it('readings and grimoire never reorder sections', () => {
    expect(orderHomeSections('readings')).toEqual([...DEFAULT_HOME_ORDER]);
    expect(orderHomeSections('grimoire')).toEqual([...DEFAULT_HOME_ORDER]);
  });

  it('only a grimoire top interest emphasizes the Grimoire promotion', () => {
    expect(emphasizeGrimoire('grimoire')).toBe(true);
    expect(emphasizeGrimoire('soaps')).toBe(false);
    expect(emphasizeGrimoire(null)).toBe(false);
  });
});

describe('pickHandlesForInterest', () => {
  it('returns nothing without a top interest', () => {
    expect(pickHandlesForInterest(null, PRODUCTS)).toEqual([]);
  });

  it('picks up to 3 in-category products in catalog order', () => {
    const soaps = pickHandlesForInterest('soaps', PRODUCTS);
    expect(soaps).toHaveLength(3);
    for (const handle of soaps) {
      const product = PRODUCTS.find((p) => p.handle === handle);
      expect(product?.category).toBe('Soaps');
    }
    const readings = pickHandlesForInterest('readings', PRODUCTS);
    expect(readings.length).toBeGreaterThan(0);
    for (const handle of readings) {
      expect(
        PRODUCTS.find((p) => p.handle === handle)?.category,
      ).toBe('Services');
    }
  });

  it('never picks the superseded full soap collection', () => {
    const soaps = pickHandlesForInterest('soaps', PRODUCTS, 45);
    expect(soaps).not.toContain('full-soap-collection');
  });

  it('quiz picks are the goal formulas, all real products', () => {
    const picks = pickHandlesForInterest('quiz', PRODUCTS);
    expect(picks).toEqual([
      'dreamease-capsules',
      'chill-pill-capsules',
      'sacred-balance-capsules',
    ]);
  });

  it('articles have no product picks (the row links journal articles)', () => {
    expect(pickHandlesForInterest('articles', PRODUCTS)).toEqual([]);
  });

  it('respects the limit and tolerates an empty catalog', () => {
    expect(pickHandlesForInterest('soaps', PRODUCTS, 1)).toHaveLength(1);
    expect(pickHandlesForInterest('soaps', [] as Product[])).toEqual([]);
  });
});
