/**
 * Canonical route registry for Amber's Alchemy Apothecary.
 *
 * Every indexable page in the Next.js app must be registered here.
 * app/sitemap.ts, canonical-URL metadata, and the route-parity tests all
 * read this registry — a page that exists but is not registered is a
 * regression (it will be missing from the sitemap and canonical checks).
 *
 * RULES:
 * - Paths are exact, lowercase, no trailing slash (except root '/').
 * - No '#' fragments, ever. The legacy sitemap shipped 11 fragment URLs
 *   (non-indexable defect) — this registry must never reintroduce them.
 * - Pages that do not exist yet are NOT registered. When the product-page
 *   worker builds /shop and /shop/[handle], they register here and the
 *   sitemap picks them up automatically.
 */

export interface CanonicalRoute {
  /** App-router path, e.g. '/soap-shop'. */
  path: string;
  /** Relative importance for crawlers (0.0–1.0). */
  priority: number;
  /** Expected crawl cadence. */
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}

/**
 * All app routes that exist in this scaffold (2026-10-05).
 * EXTEND this list as pages are built — never invent entries for
 * pages that do not exist yet.
 */
export const CANONICAL_ROUTES: CanonicalRoute[] = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/shop', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/soap-shop', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/soap-builder', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/cart', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/checkout', priority: 0.3, changeFrequency: 'yearly' },
];

/** Absolute canonical URL for a registered path. */
export function canonicalUrl(path: string, base: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}
