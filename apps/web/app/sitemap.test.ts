/**
 * REGRESSION SUITE — §19: sitemap + robots output.
 *
 * Legacy defect under test: the old sitemap.xml shipped 11 URLs with '#'
 * fragments (non-indexable). This suite fails loudly if any fragment URL
 * is ever emitted again, and if the sitemap drifts from the canonical
 * route registry.
 */
import { describe, expect, it } from 'vitest';
import sitemap from './sitemap';
import robots from './robots';
import { CANONICAL_ROUTES } from '../lib/seo/routes';
import { siteUrl } from '../lib/seo/config';

describe('sitemap output (legacy fragment defect regression)', () => {
  const entries = sitemap();

  it('covers every registered canonical route exactly once (plus catalog product pages)', () => {
    const base = siteUrl();
    const urls = entries.map((e) => e.url);
    for (const r of CANONICAL_ROUTES) {
      const matches = urls.filter((u) => u === `${base}${r.path}`);
      expect(matches, `route ${r.path}`).toHaveLength(1);
    }
    // Product pages are emitted beyond the static registry; full product
    // coverage is asserted in app/sitemap-routes.test.ts.
    expect(urls.some((u) => u.includes('/shop/'))).toBe(true);
  });

  it('emits NO # fragment URLs', () => {
    for (const e of entries) {
      expect(e.url, `fragment URL in sitemap: ${e.url}`).not.toContain('#');
    }
  });

  it('emits only absolute https URLs', () => {
    for (const e of entries) {
      expect(e.url).toMatch(/^https:\/\/[^/]+\/.*$/);
    }
  });

  it('priorities are valid and the home page is highest', () => {
    const home = entries.find((e) => e.url === `${siteUrl()}/`);
    expect(home).toBeDefined();
    for (const e of entries) {
      expect(e.priority).toBeGreaterThanOrEqual(0);
      expect(e.priority).toBeLessThanOrEqual(1);
      expect(e.priority as number).toBeLessThanOrEqual(home?.priority as number);
    }
  });
});

describe('robots output', () => {
  it('disallows API and internal routes, allows the storefront', () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    const rule = rules[0] as { allow?: string | string[]; disallow?: string | string[] };
    const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    expect(disallow).toContain('/api/');
    const allow = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
    expect(allow).toContain('/');
  });

  it('references the sitemap with an absolute URL', () => {
    const r = robots();
    expect(r.sitemap).toBe(`${siteUrl()}/sitemap.xml`);
  });
});
