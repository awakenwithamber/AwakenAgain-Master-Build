/**
 * Product story sections — smoke render (repo pattern: renderToStaticMarkup,
 * React.createElement — this repo's vitest transform does not parse JSX
 * in test files).
 *
 * Laws under test (Phase 1 Batch 3):
 * - Sections render ONLY from the record's fields — a product without
 *   benefits / best_for / ritual_tip renders nothing (honest absence).
 * - Ingredient → herb links use the homepage cards' mechanism (slugify +
 *   HERB_ALIASES + getHerb): 'Valerian Root' resolves to the valerian
 *   library page; an unknown botanical never becomes a link.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getProductByHandle } from '../../lib/catalog/products';
import {
  BenefitsSection,
  BestForSection,
  IngredientName,
  RitualTipSection,
  herbSlugForIngredientName,
} from './ProductStorySections';

const dreamease = getProductByHandle('dreamease-capsules')!;
const chillPill = getProductByHandle('chill-pill-capsules')!;

describe('BenefitsSection', () => {
  it('renders the record benefits for a Batch 1 product', () => {
    const html = renderToStaticMarkup(
      createElement(BenefitsSection, { product: dreamease }),
    );
    expect(html).toContain('Benefits');
    expect(html).toContain('Promotes restful sleep');
  });

  it('renders nothing for a product without a benefits field', () => {
    const html = renderToStaticMarkup(
      createElement(BenefitsSection, { product: chillPill }),
    );
    expect(html).toBe('');
  });
});

describe('BestForSection + RitualTipSection', () => {
  it('renders best_for and goal labels for a Batch 1 product', () => {
    const html = renderToStaticMarkup(
      createElement(BestForSection, { product: dreamease }),
    );
    expect(html).toContain('Who It Is Best For');
    expect(html).toContain('Light, restless sleepers');
  });

  it('renders the ritual tip for a Batch 1 product', () => {
    const html = renderToStaticMarkup(
      createElement(RitualTipSection, { product: dreamease }),
    );
    expect(html).toContain('Ritual Tip');
    expect(html).toContain('chamomile-lavender tea');
  });

  it('renders nothing for a product without these fields', () => {
    expect(
      renderToStaticMarkup(createElement(RitualTipSection, { product: chillPill })),
    ).toBe('');
  });
});

describe('herbSlugForIngredientName (homepage chip mechanism)', () => {
  it('resolves via slugify + HERB_ALIASES + getHerb, like the home cards', () => {
    expect(herbSlugForIngredientName('Valerian Root')).toBe('valerian');
    expect(herbSlugForIngredientName('Lavender')).toBe('lavender');
    expect(herbSlugForIngredientName('Rose Petals')).toBe('rose');
  });

  it('returns null for unknown botanicals and non-strings', () => {
    expect(herbSlugForIngredientName('Unobtainium Root')).toBeNull();
    expect(herbSlugForIngredientName(null)).toBeNull();
    expect(herbSlugForIngredientName(42)).toBeNull();
    expect(herbSlugForIngredientName('')).toBeNull();
  });

  it('IngredientName links resolved herbs and leaves others as text', () => {
    const linked = renderToStaticMarkup(
      createElement(IngredientName, { name: 'Valerian Root' }),
    );
    expect(linked).toContain('href="/herbal-library/valerian"');
    const plain = renderToStaticMarkup(
      createElement(IngredientName, { name: 'Unobtainium Root' }),
    );
    expect(plain).not.toContain('href=');
    expect(plain).toContain('Unobtainium Root');
  });
});
