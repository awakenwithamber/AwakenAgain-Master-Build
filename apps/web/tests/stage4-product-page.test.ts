/**
 * Product page safety surface (Stage 4, R-07/R-18) — rendered-output tests.
 *
 * The product page delegates its Stage 4 sections to
 * components/shop/ProductSafetySections (createElement-style, per the
 * repo's vitest constraint — the JSX page itself cannot be imported by
 * vitest), and this suite renders those sections for real catalog
 * records. A source-level assertion ties the sections to the page
 * template so they cannot silently detach.
 *
 * Laws: the FULL record ingredients render; a real allergen
 * determination renders; a NEEDS_VERIFICATION / "None listed" record
 * renders NO allergen claim; the FDA sentence renders on ingestible
 * product pages and not on topical ones.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ProductDisclaimerSections,
  ProductIngredientsSections,
} from '../components/shop/ProductSafetySections';
import { getProductByHandle } from '../lib/catalog/products';
import { FDA_STATEMENT } from '../lib/safety/product-safety';

function renderSections(slug: string): string {
  const product = getProductByHandle(slug)!;
  const ingredients = renderToStaticMarkup(
    createElement(ProductIngredientsSections, { product }),
  );
  const disclaimers = renderToStaticMarkup(
    createElement(ProductDisclaimerSections, { product }),
  );
  return ingredients + disclaimers;
}

describe('product page wiring (Stage 4)', () => {
  it('the page template renders both Stage 4 section components', () => {
    const page = readFileSync(
      join(resolve(__dirname, '..'), 'app/shop/[slug]/page.tsx'),
      'utf8',
    );
    expect(page).toContain('<ProductIngredientsSections product={product} />');
    expect(page).toContain('<ProductDisclaimerSections product={product} />');
    // The featured-ingredients section the page already had is intact.
    expect(page).toContain('Featured ingredients');
    expect(page).toContain('Safety');
  });
});

describe('product sections — ingredients + allergen + FDA (Stage 4)', () => {
  it('renders the FULL ingredient data, not only featured ingredients', () => {
    const html = renderSections('seasonal-gut-reset');
    const record = getProductByHandle('seasonal-gut-reset')!;
    expect(html).toContain('Ingredients');
    expect(html).toContain(String(record.complete_ingredients));
  });

  it('renders a real allergen determination (fish oil)', () => {
    const html = renderSections('wild-caught-omega-3-fish-oil');
    expect(html).toContain('Allergen information');
    expect(html).toContain('Contains fish');
  });

  it('renders a real allergen determination (goat milk soap)', () => {
    const html = renderSections('gaias-rose-soap');
    expect(html).toContain('Allergen information');
    expect(html).toContain('Contains goat milk (milk) and shea butter');
  });

  it('a "None listed in source materials" record renders NO allergen claim', () => {
    const html = renderSections('seasonal-gut-reset');
    expect(html).not.toContain('Allergen information');
    expect(html).not.toContain('None listed in source materials');
  });

  it('a NEEDS_VERIFICATION record renders NO allergen claim', () => {
    const html = renderSections('alchemy-tea-blend');
    expect(html).not.toContain('Allergen information');
  });

  it('the FDA sentence renders for an ingestible product (capsules)', () => {
    const html = renderSections('seasonal-gut-reset');
    expect(html).toContain(FDA_STATEMENT);
  });

  it('the FDA sentence renders for a bundle containing ingestibles whose own disclaimer is the short educational text', () => {
    const html = renderSections('gentle-detox-ritual');
    const record = getProductByHandle('gentle-detox-ritual')!;
    expect(String(record.disclaimer)).not.toContain(
      'evaluated by the Food and Drug Administration',
    );
    expect(html).toContain(FDA_STATEMENT);
    // The record's own disclaimer still renders alongside it.
    expect(html).toContain('For educational, spiritual, or informational purposes only');
  });

  it('the FDA sentence does NOT render for a topical product', () => {
    const html = renderSections('soothe-restore-botanical-balm');
    expect(html).not.toContain(FDA_STATEMENT);
  });
});
