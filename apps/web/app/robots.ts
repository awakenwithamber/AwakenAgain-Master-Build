/**
 * robots.txt for Amber's Alchemy Apothecary (generated).
 *
 * Crawlers may index all storefront routes; API routes and internal
 * endpoints stay disallowed. The sitemap reference is absolute so it
 * resolves regardless of which host serves the app (provider-neutral).
 */
import type { MetadataRoute } from 'next';
import { siteUrl } from '../lib/seo/config';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
