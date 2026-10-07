/**
 * REGRESSION — shop goal/pill mappings reference REAL catalog products.
 *
 * The Shop-by-Goal buttons and category pills must never point at handles
 * that don't exist in lib/catalog (a broken mapping is a broken promise).
 * This test pins that every handle in SHOP_GOALS resolves to a real product
 * and that no goal is empty.
 */
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../../lib/catalog/products';
import { SHOP_GOALS, goalLabelsForHandle } from './shop-goals';

const HANDLES = new Set(PRODUCTS.map((p) => p.handle));

describe('shop goal mappings', () => {
  it('has exactly 9 goals', () => {
    expect(SHOP_GOALS).toHaveLength(9);
  });

  it('every goal lists at least one real catalog handle', () => {
    for (const goal of SHOP_GOALS) {
      expect(goal.handles.length).toBeGreaterThan(0);
      const real = goal.handles.filter((h) => HANDLES.has(h));
      expect(real.length).toBeGreaterThan(0);
    }
  });

  it('every mapped handle exists in the catalog (no invented products)', () => {
    const bad: string[] = [];
    for (const goal of SHOP_GOALS) {
      for (const h of goal.handles) {
        if (!HANDLES.has(h)) bad.push(`${goal.id}:${h}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('goalLabelsForHandle returns icon+label strings for mapped products', () => {
    const labels = goalLabelsForHandle('dreamease-capsules');
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0]).toMatch(/^.{1,4} /);
  });

  it('goalLabelsForHandle returns an empty array for unmapped products', () => {
    expect(goalLabelsForHandle('tarot-readings')).toEqual([]);
  });
});
