/**
 * Client-side catalog search (G16).
 *
 * Pure function over the typed product modules — no network, no index to
 * maintain. Small catalog (45 products), so a scored substring match is
 * fast and honest: field-weighted scoring, deterministic ordering, max 10
 * results. UI lives in components/ui/Search.tsx.
 */
import { PRODUCTS } from '../catalog/products';
import type { Product } from '../../types';

export interface SearchResult {
  product: Product;
  score: number;
}

const MAX_RESULTS = 10;

function textOf(p: Product): { title: string; handle: string; meta: string; desc: string } {
  const tags = Array.isArray(p.tags) ? p.tags.join(' ') : '';
  const fi = Array.isArray(p.featured_ingredients)
    ? p.featured_ingredients.join(' ')
    : '';
  return {
    title: (p.title ?? '').toLowerCase(),
    handle: (p.handle ?? '').toLowerCase(),
    meta: `${p.category ?? ''} ${p.subcategory ?? ''} ${tags} ${fi}`.toLowerCase(),
    desc: `${p.short_description ?? ''} ${p.extended_description ?? ''}`.toLowerCase(),
  };
}

function scoreProduct(tokens: string[], p: Product): number {
  const t = textOf(p);
  let score = 0;
  for (const tok of tokens) {
    if (t.title.includes(tok)) score += 10;
    if (t.handle.replace(/-/g, ' ').includes(tok)) score += 8;
    if (t.meta.includes(tok)) score += 4;
    if (t.desc.includes(tok)) score += 2;
  }
  return score;
}

/**
 * Ranked product search. Empty/whitespace query → []. Deterministic —
 * ties break by title so UI order is stable.
 */
export function searchProducts(
  query: string,
  products: readonly Product[] = PRODUCTS,
): Product[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];
  const scored: SearchResult[] = [];
  for (const p of products) {
    const score = scoreProduct(tokens, p);
    if (score > 0) scored.push({ product: p, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title),
  );
  return scored.slice(0, MAX_RESULTS).map((s) => s.product);
}
