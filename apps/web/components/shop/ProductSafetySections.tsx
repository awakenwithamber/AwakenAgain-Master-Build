/**
 * Product safety surface sections (Fix-All Stage 4, R-07/R-18).
 *
 * Written with React.createElement per the repo's documented vitest
 * constraint (same pattern as components/herbs/HerbalIndexCard.tsx),
 * so the rendered output is directly testable. All content comes from
 * the record via lib/safety/product-safety — nothing is invented:
 *
 * - ProductIngredientsSections: the record's FULL ingredients, plus
 *   its allergen statement ONLY when the record carries a real
 *   determination (provenance states render no allergen claim).
 * - ProductDisclaimerSections: the record's own disclaimer, plus the
 *   shared FDA statement on ingestible products (R-07).
 */
import { createElement, type ReactElement } from 'react';
import type { Product } from '../../types';
import {
  FDA_STATEMENT,
  allergenStatement,
  completeIngredients,
  isIngestibleProduct,
} from '../../lib/safety/product-safety';

export function ProductIngredientsSections({
  product,
}: {
  product: Product;
}): ReactElement | null {
  const ingredients = completeIngredients(product);
  const allergen = allergenStatement(product);
  if (!ingredients && !allergen) return null;
  return createElement(
    'div',
    null,
    ingredients
      ? createElement(
          'section',
          { 'aria-label': 'Ingredients' },
          createElement('h2', null, 'Ingredients'),
          createElement('p', null, ingredients),
        )
      : null,
    allergen
      ? createElement(
          'section',
          { 'aria-label': 'Allergen information' },
          createElement('h2', null, 'Allergen information'),
          createElement('p', null, allergen),
        )
      : null,
  );
}

export function ProductDisclaimerSections({
  product,
}: {
  product: Product;
}): ReactElement | null {
  const disclaimer =
    typeof product.disclaimer === 'string' && product.disclaimer.trim() !== ''
      ? product.disclaimer
      : null;
  const ingestible = isIngestibleProduct(product);
  if (!disclaimer && !ingestible) return null;
  return createElement(
    'div',
    null,
    disclaimer
      ? createElement(
          'p',
          null,
          createElement('small', null, disclaimer),
        )
      : null,
    ingestible
      ? createElement(
          'p',
          null,
          createElement('small', null, FDA_STATEMENT),
        )
      : null,
  );
}
