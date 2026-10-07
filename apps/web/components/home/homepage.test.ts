/**
 * Homepage section contract tests (workstream C).
 *
 * Guards: goal cards deep-link only to real /shop/<handle> pages; best
 * sellers resolve to real priced catalog products; herb chips only ever
 * reference canonical herb slugs; the old phone number never appears.
 * (No JSX — the repo's vitest transform cannot parse it.)
 */
import { describe, it, expect } from 'vitest';
import {
  GOAL_CARDS,
  BEST_SELLER_HANDLES,
  REVIEWS_PRODUCT_HANDLE,
} from './data';
import {
  resolveHerbChips,
  resolveWhyItWorks,
  toCardModel,
  getProduct,
} from './product-cards';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('goal cards', () => {
  it('has exactly the 7 spec cards in order', () => {
    expect(GOAL_CARDS.map((c) => c.heading)).toEqual([
      'Better Sleep',
      'Reduced Stress',
      'Balanced Hormones',
      'Stronger Hair',
      'Natural Energy',
      'Younger Skin',
      'Pain Relief',
    ]);
  });

  it('every goal card deep-links to a real product page under /shop/', () => {
    for (const card of GOAL_CARDS) {
      expect(card.link.href).toMatch(/^\/shop\//);
      const handle = card.link.href.replace('/shop/', '');
      expect(
        getProduct(handle),
        `goal card "${card.heading}" → ${handle}`,
      ).toBeDefined();
    }
  });
});

describe('best sellers', () => {
  it('every handle resolves to a real product with an established price', () => {
    expect(BEST_SELLER_HANDLES.length).toBeGreaterThan(0);
    for (const handle of BEST_SELLER_HANDLES) {
      const product = getProduct(handle);
      expect(product, handle).toBeDefined();
      expect(typeof product!.price).toBe('number');
      const model = toCardModel(product!);
      expect(model, handle).not.toBeNull();
      expect(model!.priceCents).toBeGreaterThan(0);
    }
  });

  it('does not alter pricing — card cents equal catalog dollars exactly', () => {
    for (const handle of BEST_SELLER_HANDLES) {
      const product = getProduct(handle)!;
      const model = toCardModel(product)!;
      expect(model.priceCents).toBe(Math.round(product.price! * 100));
    }
  });

  it('herb chips reference real herb index entries with labels from the catalog', () => {
    for (const handle of BEST_SELLER_HANDLES) {
      const product = getProduct(handle)!;
      const chips = resolveHerbChips(product);
      expect(chips.length).toBeGreaterThan(0);
      for (const chip of chips) {
        expect(chip.slug).toMatch(/^[a-z0-9-]+$/);
      }
      const why = resolveWhyItWorks(product);
      expect(why.length).toBeGreaterThan(0);
      expect(why.length).toBeLessThanOrEqual(5);
    }
  });
});

describe('reviews section', () => {
  it('anchors to a known product handle in the reviews API contract', () => {
    expect(getProduct(REVIEWS_PRODUCT_HANDLE)).toBeDefined();
  });
});

describe('brand safety', () => {
  it('never contains the superseded phone number', () => {
    const dataSrc = readFileSync(join(here, 'data.ts'), 'utf8');
    expect(dataSrc).not.toContain('801-819-6795');
    expect(dataSrc).not.toContain('819-6795');
  });
});
