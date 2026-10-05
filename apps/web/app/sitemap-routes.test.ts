/**
 * Sitemap regression tests.
 *
 * Guards: no '#' fragments (legacy defect), every CANONICAL_ROUTES entry is
 * emitted, all 45 catalog product pages are emitted, no duplicate URLs.
 */
import { describe, expect, it } from 'vitest';
import sitemap from './sitemap';
import { CANONICAL_ROUTES } from '../lib/seo/routes';
import { PRODUCTS } from '../lib/catalog/products';

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
      expect(urls.some((u) => u.includes(`/shop/${p.handle}`))).toBe(true);
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
