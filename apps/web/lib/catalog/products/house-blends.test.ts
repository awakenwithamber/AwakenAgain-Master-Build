/**
 * House-blend recipe adoption — owner approval 2026-10-30.
 *
 * The four blend-only teas (Golden Hearth, Moonlit Lavender Rose, Velvet
 * Hibiscus Berry, Wild Mint Meadow) had their staged recipes from
 * house-blend-recipes-2026-10-30.md adopted into their records after the
 * owner approved all five open decisions as recommended:
 *  1. Orange peel sourced for Golden Hearth (+ herb-library entry).
 *  2. Rose hip tea use confirmed (library entry updated).
 *  3. Herb-library entries added for lemongrass and star anise.
 *  4. Velvet berries: crushed + full 15-minute steep, one instruction.
 *  5. Per-blend brewing directions adopted (generic template retired
 *     on these four records only).
 *
 * These tests pin the adoption: full published formulas, the display-five
 * basis (first five botanicals in recipe order), internal recipe data
 * whose parts and grams sum exactly, per-blend directions, and the
 * untouched $9/$11 price variants.
 */
import { describe, expect, it } from 'vitest';
import { getProductByHandle } from './index';
import { getHerb, herbsForUse } from '../herbs';

function featuredNames(handle: string): string[] {
  const product = getProductByHandle(handle)!;
  const featured = (product.featured_ingredients ?? []) as Array<{ name: string }>;
  return featured.map((f) => f.name);
}

interface RecipeInternal {
  status: string;
  ingredients: Array<{
    name: string;
    parts: number;
    grams_per_1oz: number;
    grams_per_16oz_batch: number;
  }>;
}

const BLENDS = [
  {
    handle: 'golden-hearth-tea',
    featured: ['Cinnamon', 'Orange Peel', 'Ginger', 'Cardamom', 'Star Anise'],
    complete:
      'Cinnamon bark, orange peel, ginger root, cardamom pods, star anise, fennel seed, clove.',
    directionsMustContain: ['near-boiling', '212°F', '10-15 minutes'],
    formulaSize: 7,
  },
  {
    handle: 'moonlit-lavender-rose-tea',
    featured: ['Lavender', 'Rose', 'Chamomile', 'Lemon Balm', 'Linden'],
    complete:
      'Lavender buds, rose petals, chamomile flowers, lemon balm leaf, linden flower and bract, jasmine flowers.',
    directionsMustContain: ['195°F', '7-10 minutes', 'covered'],
    formulaSize: 6,
  },
  {
    handle: 'velvet-hibiscus-berry-tea',
    featured: ['Hibiscus', 'Rose Hips', 'Elderberry', 'Schisandra', 'Hawthorn'],
    complete:
      'Hibiscus calyces, crushed rose hips, dried elderberries, schisandra berries, crushed hawthorn berries, rose petals, cinnamon.',
    directionsMustContain: ['212°F', 'full 10-15 minutes', 'crushed berries'],
    formulaSize: 7,
  },
  {
    handle: 'wild-mint-meadow-tea',
    featured: ['Peppermint', 'Spearmint', 'Lemongrass', 'Lemon Balm', 'Lemon Verbena'],
    complete:
      'Peppermint leaf, spearmint leaf, lemongrass, lemon balm leaf, lemon verbena leaf, elderflower.',
    directionsMustContain: ['200°F', '7-10 minutes', 'covered'],
    formulaSize: 6,
  },
] as const;

describe('house-blend recipe adoption (2026-10-30)', () => {
  for (const blend of BLENDS) {
    describe(blend.handle, () => {
      const product = getProductByHandle(blend.handle)!;

      it('publishes the full adopted formula', () => {
        expect(product).toBeDefined();
        expect(product.complete_ingredients).toBe(blend.complete);
        expect(String(product.complete_ingredients)).not.toMatch(/proprietary/i);
      });

      it('displays the recipe leads — first five botanicals in recipe order', () => {
        expect(featuredNames(blend.handle)).toEqual([...blend.featured]);
      });

      it('carries internal recipe data whose parts and grams sum exactly', () => {
        const recipe = product.recipe_internal as unknown as RecipeInternal;
        expect(recipe).toBeDefined();
        expect(recipe.status).toMatch(/ADOPTED/);
        expect(recipe.ingredients).toHaveLength(blend.formulaSize);
        expect(recipe.ingredients.reduce((s, i) => s + i.parts, 0)).toBe(20);
        const grams = recipe.ingredients.reduce((s, i) => s + i.grams_per_1oz, 0);
        expect(grams).toBeCloseTo(28.35, 2);
        const batch = recipe.ingredients.reduce(
          (s, i) => s + i.grams_per_16oz_batch,
          0,
        );
        expect(batch).toBeCloseTo(453.6, 1);
      });

      it('brews by its own adopted directions, not the generic template', () => {
        const directions = String(product.directions);
        for (const fragment of blend.directionsMustContain) {
          expect(directions).toContain(fragment);
        }
        expect(directions).not.toContain('standard tea template');
      });

      it('keeps the owner-directed $9 loose / $11 bags variants', () => {
        const prices = (product.variants ?? []).map((v) => v.price);
        expect(prices).toEqual([9, 11]);
        expect(product.price).toBe(9);
      });
    });
  }

  it('retires the staged display botanicals that are not in the recipes', () => {
    expect(featuredNames('moonlit-lavender-rose-tea')).not.toContain(
      'Butterfly Pea Flower',
    );
    const velvetNames = featuredNames('velvet-hibiscus-berry-tea');
    expect(velvetNames).not.toContain('Blackberry');
    expect(velvetNames).not.toContain('Bilberry');
    expect(featuredNames('wild-mint-meadow-tea')).not.toContain('Mint');
  });

  it('adds the three owner-approved herb-library entries', () => {
    expect(getHerb('orange-peel')?.latin).toBe('Citrus sinensis');
    expect(getHerb('orange-peel')?.uses).toContain('tea');
    expect(getHerb('lemongrass')?.latin).toBe('Cymbopogon citratus');
    expect(getHerb('lemongrass')?.uses).toContain('tea');
    expect(getHerb('star-anise')?.latin).toBe('Illicium verum');
    expect(getHerb('star-anise')?.uses).toContain('tea');
    const teaIds = herbsForUse('tea').map((h) => h.id);
    expect(teaIds).toContain('orange-peel');
    expect(teaIds).toContain('lemongrass');
    expect(teaIds).toContain('star-anise');
  });

  it('confirms rose hip tea use alongside serum and balm', () => {
    expect(getHerb('rosehip')?.uses).toEqual(['serum', 'balm', 'tea']);
  });
});
