/**
 * Generated sitemap for Amber's Alchemy Apothecary.
 *
 * REGRESSION RULE (legacy defect, never re-created): the legacy sitemap.xml
 * shipped 11 URLs with '#' fragments, which are non-indexable. This module
 * emits only absolute canonical URLs from the CANONICAL_ROUTES registry —
 * see lib/seo/routes.ts. The test suite asserts '#' never appears.
 */
import type { MetadataRoute } from 'next';
import { siteUrl } from '../lib/seo/config';
import { CANONICAL_ROUTES, canonicalUrl } from '../lib/seo/routes';
import { PRODUCTS } from '../lib/catalog/products';
import { JOURNAL_ARTICLES } from '../lib/content/journal';
import { HERB_INDEX } from '../lib/content/herbs';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  const staticRoutes = CANONICAL_ROUTES.map((route) => ({
    url: canonicalUrl(route.path, base),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
  const productRoutes: MetadataRoute.Sitemap = PRODUCTS.map((p) => ({
    url: canonicalUrl(`/shop/${p.handle}`, base),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));
  const journalRoutes: MetadataRoute.Sitemap = JOURNAL_ARTICLES.map((a) => ({
    url: canonicalUrl(`/journal/${a.slug}`, base),
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));
  const herbRoutes: MetadataRoute.Sitemap = HERB_INDEX.map((h) => ({
    url: canonicalUrl(`/herbal-library/${h.slug}`, base),
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));
  return [...staticRoutes, ...productRoutes, ...journalRoutes, ...herbRoutes];
}
