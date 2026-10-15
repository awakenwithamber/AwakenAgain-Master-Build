/**
 * Sitemap regression tests.
 *
 * Guards: no '#' fragments (legacy defect), every CANONICAL_ROUTES entry is
 * emitted, every NON-SUPERSEDED catalog product page is emitted (and every
 * superseded one is excluded — intentional behavior change, 2026-10-13
 * superseded-product protections), no duplicate URLs.
 */
import { describe, expect, it } from 'vitest';
import sitemap from './sitemap';
import { CANONICAL_ROUTES } from '../lib/seo/routes';
import { PRODUCTS } from '../lib/catalog/products';
import { isSupersededProduct } from '../lib/catalog/status';

describe('sitemap', () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  it('emits no fragment URLs', () => {
    for (const url of urls) {
      expect(url).not.toContain('#');
    }
  });

  it('emits every registered canonical route', () => {
    for (const route of CANONICAL_ROUTES) {
      expect(urls.some((u) => u.endsWith(route.path === '/' ? '.com/' : route.path))).toBe(true);
    }
  });

  it('emits all catalog product pages', () => {
    expect(PRODUCTS.length).toBeGreaterThan(0);
    for (const p of PRODUCTS) {
      // Superseded products are intentionally NOT emitted (see the
      // exclusion test below); every other product page must appear.
      if (isSupersededProduct(p)) continue;
      expect(urls.some((u) => u.includes(`/shop/${p.handle}`))).toBe(true);
    }
  });

  it('excludes superseded product pages', () => {
    const superseded = PRODUCTS.filter(isSupersededProduct);
    expect(superseded.length).toBeGreaterThan(0);
    for (const p of superseded) {
      expect(urls.some((u) => u.includes(`/shop/${p.handle}`))).toBe(false);
    }
  });

  it('emits no duplicate URLs', () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('uses absolute canonical URLs', () => {
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\//);
    }
  });
});
