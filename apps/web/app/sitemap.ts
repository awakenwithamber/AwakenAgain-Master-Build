/**
 * Generated sitemap for Amber's Alchemy Apothecary.
 *
 * REGRESSION RULE (legacy defect, never re-created): the legacy sitemap.xml
 * shipped 11 URLs with '#' fragments, which are non-indexable. This module
 * emits only absolute canonical URLs from the CANONICAL_ROUTES registry —
 * see lib/seo/routes.ts. The test suite asserts '#' never appears.
 *
 * Superseded products are excluded: their records stay in the catalog for
 * reference (and /shop/full-soap-collection permanently redirects to its
 * replacement), but a retired product must not be offered to search
 * engines as a live page.
 */
import type { MetadataRoute } from 'next';
import { siteUrl } from '../lib/seo/config';
import { CANONICAL_ROUTES, canonicalUrl } from '../lib/seo/routes';
import { PRODUCTS } from '../lib/catalog/products';
import { isSupersededProduct } from '../lib/catalog/status';
import { JOURNAL_ARTICLES } from '../lib/content/journal';
import { herbalRouteParams } from '../lib/herbal-index/cards';
import {
  SERVICE_PAGES,
  servicePagePath,
} from '../lib/content/service-pages';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  const staticRoutes = CANONICAL_ROUTES.map((route) => ({
    url: canonicalUrl(route.path, base),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
  const productRoutes: MetadataRoute.Sitemap = PRODUCTS.filter(
    (p) => !isSupersededProduct(p),
  ).map((p) => ({
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
  // Herb detail routes come from the Herbal Index workstream's full
  // route set (every catalog record + the canonical HERB_INDEX alias
  // slugs = 310 routes), not just the 29 legacy index slugs.
  const herbRoutes: MetadataRoute.Sitemap = herbalRouteParams().map((p) => ({
    url: canonicalUrl(`/herbal-library/${p.herb}`, base),
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));
  // Service landing pages emit from their content registry, the same
  // pattern as journal articles and herb pages above (CANONICAL_ROUTES
  // holds static routes; content collections emit from their registries).
  const servicePageRoutes: MetadataRoute.Sitemap = SERVICE_PAGES.map((p) => ({
    url: canonicalUrl(servicePagePath(p.slug), base),
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));
  return [
    ...staticRoutes,
    ...productRoutes,
    ...journalRoutes,
    ...herbRoutes,
    ...servicePageRoutes,
  ];
}
