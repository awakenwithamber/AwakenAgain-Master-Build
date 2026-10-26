/**
 * Product story sections — Phase 1 Batch 3.
 *
 * Renders the narrative sections of the product page template from the
 * canonical record's Batch 1 fields: `benefits`, `best_for`, `ritual_tip`.
 * Records are typed Product with [key: string]: unknown, so every field is
 * read defensively. A section returns NULL when its data is absent or the
 * wrong shape — honest absence for the products that do not carry these
 * fields yet, never placeholder copy.
 *
 * Written with React.createElement (no JSX), matching the sibling
 * ProductSafetySections and the repo pattern that lets vitest import the
 * module directly (the vitest transform does not parse JSX).
 *
 * Herb linking reuses the homepage cards' exact mechanism
 * (components/home/product-cards.ts): slugify the ingredient name, apply
 * HERB_ALIASES, and link only when getHerb(slug) resolves in
 * lib/catalog/herbs — the same verification that gates the home HerbChips.
 * Unlike the home chips (capped at 5), every featured ingredient is checked.
 */
import { createElement } from 'react';
import Link from 'next/link';
import type { Product } from '../../types';
import { HERB_ALIASES, slugify } from '../home/product-cards';
import { getHerb } from '../../lib/catalog/herbs';
import { goalLabelsForHandle } from './shop-goals';

/**
 * Resolve a featured-ingredient display name to its /herbal-library slug,
 * exactly as resolveHerbChips does for the homepage cards. Returns null
 * when the herb is not in the botanical index — the ingredient then
 * renders as plain text, never a guessed link.
 */
export function herbSlugForIngredientName(name: unknown): string | null {
  if (typeof name !== 'string' || name.trim().length === 0) return null;
  const candidate = slugify(name);
  const slug = HERB_ALIASES[candidate] ?? candidate;
  return getHerb(slug) ? slug : null;
}

function stringArrayField(product: Product, key: string): string[] {
  const raw = (product as Record<string, unknown>)[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );
}

function stringField(product: Product, key: string): string | null {
  const raw = (product as Record<string, unknown>)[key];
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : null;
}

export function BenefitsSection({ product }: { product: Product }) {
  const benefits = stringArrayField(product, 'benefits');
  if (benefits.length === 0) return null;
  return createElement(
    'section',
    { 'aria-label': 'Benefits' },
    createElement('h2', null, 'Benefits'),
    createElement(
      'ul',
      null,
      benefits.map((b) => createElement('li', { key: b }, b)),
    ),
  );
}

export function BestForSection({ product }: { product: Product }) {
  const bestFor = stringField(product, 'best_for');
  const goalLabels = goalLabelsForHandle(product.handle);
  if (!bestFor && goalLabels.length === 0) return null;
  return createElement(
    'section',
    { 'aria-label': 'Who it is best for' },
    createElement('h2', null, 'Who It Is Best For'),
    bestFor ? createElement('p', null, bestFor) : null,
    goalLabels.length > 0
      ? createElement(
          'ul',
          { 'aria-label': 'Wellness goals' },
          goalLabels.map((label) => createElement('li', { key: label }, label)),
        )
      : null,
  );
}

export function RitualTipSection({ product }: { product: Product }) {
  const tip = stringField(product, 'ritual_tip');
  if (!tip) return null;
  return createElement(
    'section',
    { 'aria-label': 'Ritual tip' },
    createElement('h2', null, 'Ritual Tip'),
    createElement('p', null, tip),
  );
}

/**
 * Ingredient name for the Featured ingredients list: a link to the herb's
 * /herbal-library page when herbSlugForIngredientName resolves it, plain
 * text otherwise (exactly the pre-Batch-3 rendering for unresolved herbs).
 */
export function IngredientName({ name }: { name: unknown }) {
  const label = typeof name === 'string' ? name : String(name ?? '');
  const slug = herbSlugForIngredientName(name);
  if (!slug) return createElement('span', null, label);
  return createElement(Link, { href: `/herbal-library/${slug}` }, label);
}
