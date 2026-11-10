import { describe, expect, it } from 'vitest';
import { SITE_SEARCH_INDEX, searchSite } from './site-search';
import { PRODUCTS } from '../catalog/products';
import { isSupersededProduct } from '../catalog/status';
import { SERVICES } from '../content/services';
import { SERVICE_PAGES, servicePagePath } from '../content/service-pages';
import { JOURNAL_ARTICLES } from '../content/journal';

describe('SITE_SEARCH_INDEX composition', () => {
  it('indexes all four kinds: products, services, pages, articles', () => {
    const kinds = new Set(SITE_SEARCH_INDEX.map((e) => e.kind));
    expect(kinds).toEqual(new Set(['product', 'service', 'page', 'article']));
  });

  it('indexes every non-superseded, non-service catalog product', () => {
    const serviceHandles = new Set(SERVICES.map((s) => s.handle));
    const expected = PRODUCTS.filter(
      (p) => !isSupersededProduct(p) && !serviceHandles.has(p.handle),
    );
    const productEntries = SITE_SEARCH_INDEX.filter((e) => e.kind === 'product');
    expect(productEntries.length).toBe(expected.length);
    for (const p of expected) {
      expect(productEntries.some((e) => e.href === `/shop/${p.handle}`)).toBe(true);
    }
  });

  it('never indexes a superseded product, under any kind', () => {
    const supersededHrefs = new Set(
      PRODUCTS.filter(isSupersededProduct).map((p) => `/shop/${p.handle}`),
    );
    expect(supersededHrefs.size).toBeGreaterThan(0);
    for (const e of SITE_SEARCH_INDEX) {
      expect(supersededHrefs.has(e.href)).toBe(false);
    }
  });

  it('indexes every service landing page and every live bookable service', () => {
    const serviceHrefs = SITE_SEARCH_INDEX.filter((e) => e.kind === 'service').map(
      (e) => e.href,
    );
    for (const sp of SERVICE_PAGES) {
      expect(serviceHrefs).toContain(servicePagePath(sp.slug));
    }
    expect(serviceHrefs).toContain('/shop/hypnotherapy-guided-relaxation');
    expect(serviceHrefs).toContain('/shop/tarot-readings');
  });

  it('indexes the key content pages a visitor looks for', () => {
    const pageHrefs = SITE_SEARCH_INDEX.filter((e) => e.kind === 'page').map(
      (e) => e.href,
    );
    for (const href of [
      '/',
      '/shop',
      '/soap-builder',
      '/grimoire',
      '/grimoire/subscribe',
      '/quiz',
      '/services',
      '/journal',
      '/herb-index',
      '/faqs',
      '/about',
      '/contact',
      '/support',
    ]) {
      expect(pageHrefs, `page index is missing ${href}`).toContain(href);
    }
  });

  it('indexes every journal article', () => {
    const articleHrefs = SITE_SEARCH_INDEX.filter((e) => e.kind === 'article').map(
      (e) => e.href,
    );
    expect(articleHrefs.length).toBe(JOURNAL_ARTICLES.length);
    for (const a of JOURNAL_ARTICLES) {
      expect(articleHrefs).toContain(`/journal/${a.slug}`);
    }
  });

  it('has no duplicate (kind, href) pairs', () => {
    const keys = SITE_SEARCH_INDEX.map((e) => `${e.kind}:${e.href}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('searchSite ranking — the owner’s example searches', () => {
  it('“tarot” finds the tarot service, ranked first', () => {
    const results = searchSite('tarot');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].kind).toBe('service');
    expect(results.some((r) => r.href === '/services/tarot')).toBe(true);
  });

  it('“hypnotherapy” finds the hypnotherapy service page first', () => {
    const results = searchSite('hypnotherapy');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].kind).toBe('service');
    expect(results[0].href).toBe('/shop/hypnotherapy-guided-relaxation');
  });

  it('“free consultation” finds the contact page first', () => {
    const results = searchSite('free consultation');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].kind).toBe('page');
    expect(results[0].href).toBe('/contact');
  });

  it('“lavender” finds a product', () => {
    const results = searchSite('lavender');
    expect(results.some((r) => r.kind === 'product')).toBe(true);
    expect(
      results.some((r) => r.kind === 'product' && r.href.startsWith('/shop/')),
    ).toBe(true);
  });

  it('“grimoire” finds the Living Grimoire page', () => {
    const results = searchSite('grimoire');
    expect(results.some((r) => r.href === '/grimoire')).toBe(true);
  });

  it('“quiz” finds the Herbal Allies quiz', () => {
    const results = searchSite('quiz');
    expect(results.some((r) => r.href === '/quiz')).toBe(true);
  });
});

describe('searchSite behavior', () => {
  it('returns [] for empty, whitespace, and single-character queries', () => {
    expect(searchSite('')).toEqual([]);
    expect(searchSite('   ')).toEqual([]);
    expect(searchSite('a')).toEqual([]);
  });

  it('returns [] when nothing matches', () => {
    expect(searchSite('xylophone')).toEqual([]);
  });

  it('respects the result limit', () => {
    expect(searchSite('soap', 3)).toHaveLength(3);
    expect(searchSite('soap').length).toBeLessThanOrEqual(10);
  });

  it('is deterministic — the same query returns the same order twice', () => {
    const a = searchSite('soap').map((r) => `${r.kind}:${r.href}`);
    const b = searchSite('soap').map((r) => `${r.kind}:${r.href}`);
    expect(a).toEqual(b);
  });
});
