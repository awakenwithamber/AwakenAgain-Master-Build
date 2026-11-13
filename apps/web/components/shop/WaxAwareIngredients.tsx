/**
 * Finish-aware ingredients for the balm product pages (directive
 * 2026-11-13): the ingredient declaration follows the SELECTED wax
 * finish. The standard (soy wax) list is the record's own text; the
 * beeswax list is that same text with exactly the replacement the
 * record itself documents ("in that version beeswax replaces the soy
 * wax") — see lib/wax/wax.ts. Rendered only for products that offer a
 * wax choice; every other product keeps the static
 * ProductIngredientsSections. Display only — the charged price and
 * the order's recorded variant are untouched.
 */
'use client';

import type { Product } from '../../types';
import {
  allergenStatement,
  completeIngredients,
} from '../../lib/safety/product-safety';
import {
  ingredientsForWaxFinish,
  variantWaxFinish,
  waxOption,
} from '../../lib/wax/wax';
import { useSelectedVariant } from './VariantPrice';

export function WaxAwareIngredients({ product }: { product: Product }) {
  const idx = useSelectedVariant(product);
  const raw = completeIngredients(product);
  const allergen = allergenStatement(product);
  if (!raw && !allergen) return null;
  const variant = (product.variants ?? [])[idx];
  const finish = variantWaxFinish(variant);
  const ingredients = raw
    ? finish
      ? ingredientsForWaxFinish(raw, finish)
      : raw
    : null;
  const finishLabel = finish ? waxOption(finish)?.label : undefined;
  return (
    <div>
      {ingredients ? (
        <section aria-label="Ingredients">
          <h2>Ingredients</h2>
          {finishLabel ? (
            <p>
              <em>For your selected finish: {finishLabel}.</em>
            </p>
          ) : null}
          <p>{ingredients}</p>
        </section>
      ) : null}
      {allergen ? (
        <section aria-label="Allergen information">
          <h2>Allergen information</h2>
          <p>{allergen}</p>
        </section>
      ) : null}
    </div>
  );
}
