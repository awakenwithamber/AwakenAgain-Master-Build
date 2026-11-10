import { describe, expect, it } from 'vitest';
import { SITE_SEARCH_INDEX, searchSite } from './site-search';
import { PRODUCTS } from '../catalog/products';
import { isSupersededProduct } from '../catalog/status';
import { SERVICES } from '../content/services';
import { SERVICE_PAGES, servicePagePath } from '../content/service-pages';
import { JOURNAL_ARTICLES } from '../content/journal';
import { HERB_SEARCH_DATA } from './herb-search-data';
import { herbalRouteParams } from '../herbal-index/cards';

describe('SITE_SEARCH_INDEX composition', () => {
  it('indexes all five kinds: products, services, pages, articles, herbs', () => {
    const kinds = new Set(SITE_SEARCH_INDEX.map((e) => e.kind));
    expect(kinds).toEqual(
      new Set(['product', 'service', 'page', 'article', 'herb']),
    );
  });

  it('indexes every herb page route exactly once (owner: "add every herb")', () => {
    const routes = herbalRouteParams().map(({ herb }) => herb);
    const herbEntries = SITE_SEARCH_INDEX.filter((e) => e.kind === 'herb');
    expect(herbEntries.length).toBe(routes.length);
    expect(herbEntries.length).toBe(HERB_SEARCH_DATA.length);
    for (const slug of routes) {
      expect(
        herbEntries.filter((e) => e.href === `/herbal-library/${slug}`).length,
      ).toBe(1);
    }
  });

  it('herb entries carry the record’s own name and Latin name, never a price', () => {
    const lavender = SITE_SEARCH_INDEX.find(
      (e) => e.kind === 'herb' && e.href === '/herbal-library/lavender',
    );
    expect(lavender).toBeDefined();
    expect(lavender!.title).toBe('Lavender');
    expect(lavender!.blurb).toContain('Lavandula angustifolia');
    expect(lavender!.price).toBeNull();
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

describe('searchSite ranking — owner correction 2026-11-10 (herb names vs products)', () => {
  it('“lavender” returns the Lavender herb page FIRST — products follow below', () => {
    const results = searchSite('lavender');
    expect(results.length).toBeGreaterThan(1);
    expect(results[0].kind).toBe('herb');
    expect(results[0].href).toBe('/herbal-library/lavender');
    // Products that contain lavender still appear — never above the herb.
    const firstProduct = results.findIndex((r) => r.kind === 'product');
    expect(firstProduct).toBeGreaterThan(0);
  });

  it('“chamomile” returns the Chamomile herb page first', () => {
    const results = searchSite('chamomile');
    expect(results[0].kind).toBe('herb');
    expect(results[0].href).toBe('/herbal-library/chamomile');
  });

  it('“peppermint” returns the Peppermint herb page first', () => {
    const results = searchSite('peppermint');
    expect(results[0].kind).toBe('herb');
    expect(results[0].href).toBe('/herbal-library/peppermint');
  });

  it('“lemon balm” returns the Lemon Balm herb page first', () => {
    const results = searchSite('lemon balm');
    expect(results[0].kind).toBe('herb');
    expect(results[0].href).toBe('/herbal-library/lemon-balm');
  });

  it('“willow bark” finds the willow bark herb page (canonical index name)', () => {
    const results = searchSite('willow bark');
    expect(results[0].kind).toBe('herb');
    expect(results[0].href).toBe('/herbal-library/willow-bark');
  });

  it('“products” leads with the shop / product results — no herb on top', () => {
    const results = searchSite('products');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].kind).not.toBe('herb');
    expect(results[0].href).toBe('/shop');
    expect(results.some((r) => r.kind === 'herb')).toBe(false);
  });

  it('“product” likewise never tops with an herb', () => {
    const results = searchSite('product');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].kind).not.toBe('herb');
    expect(results[0].href).toBe('/shop');
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
