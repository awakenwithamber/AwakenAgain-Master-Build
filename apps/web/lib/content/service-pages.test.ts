/**
 * Service landing pages — registry coverage tests (Phase 2, 2026-10-14).
 *
 * Guards the contract for the nine /services/<slug> landing pages:
 * every slug has a complete record, a sitemap-registry entry, and a
 * sitemap emission; mapped pages resolve to real catalog records;
 * prices come ONLY from the catalog (no landing copy may state one);
 * unpriced services stay unpriced; illustrations follow the existing
 * per-service file convention; and the honesty guardrails for
 * healing-adjacent copy are present in the copy itself.
 */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  SERVICE_PAGES,
  getServicePage,
  getServicePageRecord,
  servicePagePath,
} from './service-pages';
import { getProductByHandle } from '../catalog/products';
import sitemap from '../../app/sitemap';

const EXPECTED_SLUGS = [
  'astrology',
  'tarot',
  'house-cleansing',
  'aura-cleansing',
  'spirit-resolution',
  'past-life-regression',
  'inner-healing',
  'business-setup',
  'web-development',
];

function allCopy(e: (typeof SERVICE_PAGES)[number]): string {
  return [
    e.title,
    e.eyebrow,
    e.metaDescription,
    e.deliveryNote,
    ...e.intro,
    ...e.includes,
    ...e.process,
    ...e.goodToKnow,
  ].join('\n');
}

describe('service landing page registry', () => {
  it('has exactly the nine planned pages, uniquely slugged', () => {
    expect(SERVICE_PAGES.map((p) => p.slug).sort()).toEqual(
      [...EXPECTED_SLUGS].sort(),
    );
    expect(new Set(SERVICE_PAGES.map((p) => p.slug)).size).toBe(9);
  });

  it('every page has complete content sections', () => {
    for (const page of SERVICE_PAGES) {
      expect(page.title.length, page.slug).toBeGreaterThan(0);
      expect(page.metaDescription.length, page.slug).toBeGreaterThan(40);
      expect(page.intro.length, page.slug).toBeGreaterThanOrEqual(2);
      expect(page.includes.length, page.slug).toBeGreaterThanOrEqual(3);
      expect(page.process.length, page.slug).toBeGreaterThanOrEqual(3);
      expect(page.goodToKnow.length, page.slug).toBeGreaterThanOrEqual(1);
      expect(page.deliveryNote.length, page.slug).toBeGreaterThan(0);
    }
  });

  it('every related slug resolves to a real page', () => {
    for (const page of SERVICE_PAGES) {
      for (const rel of page.relatedSlugs) {
        expect(getServicePage(rel), `${page.slug} → ${rel}`).toBeDefined();
      }
    }
  });

  it('mapped pages resolve to real catalog records', () => {
    for (const page of SERVICE_PAGES) {
      if (page.catalogHandle === null) continue;
      expect(
        getProductByHandle(page.catalogHandle),
        `${page.slug} → ${page.catalogHandle}`,
      ).toBeDefined();
      expect(getServicePageRecord(page)?.handle).toBe(page.catalogHandle);
    }
  });

  it('tarot is the one priced mapping, at the catalog prices', () => {
    const tarot = getServicePage('tarot');
    const record = tarot ? getServicePageRecord(tarot) : undefined;
    expect(record?.handle).toBe('tarot-readings');
    expect(record?.price).toBe(11.11);
    const variantPrices = (record?.variants ?? []).map((v) => v.price);
    expect(variantPrices).toContain(11.11);
    expect(variantPrices).toContain(33.33);
  });

  it('every other mapped record is unpriced (inquiry path, never invented)', () => {
    for (const page of SERVICE_PAGES) {
      if (page.slug === 'tarot' || page.catalogHandle === null) continue;
      const record = getServicePageRecord(page);
      expect(record?.price, page.slug).toBeNull();
    }
  });

  it('no landing copy ever states a price (prices come from the catalog only)', () => {
    for (const page of SERVICE_PAGES) {
      expect(allCopy(page), page.slug).not.toMatch(/\$\s?\d/);
    }
  });

  it('images follow the per-service illustration convention and exist on disk', () => {
    for (const page of SERVICE_PAGES) {
      if (page.image === null) continue;
      // A page with an illustration uses the mapped service's own file.
      expect(page.image, page.slug).toBe(`${page.catalogHandle}.webp`);
      const file = join(
        process.cwd(),
        'public',
        'images',
        'services',
        page.image,
      );
      expect(existsSync(file), `${page.slug} image ${page.image}`).toBe(true);
    }
  });

  it('pages without a genuine illustration use the placeholder (image null)', () => {
    for (const slug of [
      'astrology',
      'spirit-resolution',
      'business-setup',
      'web-development',
    ]) {
      expect(getServicePage(slug)?.image, slug).toBeNull();
    }
  });

  it('every page is emitted by the sitemap exactly once (content-registry pattern)', () => {
    // CANONICAL_ROUTES holds static routes only, and the header nav test
    // requires every registered route to appear in the nav — detail
    // pages from content registries (journal articles, herb pages, and
    // these service pages) emit through app/sitemap.ts instead.
    const urls = sitemap().map((e) => e.url);
    for (const page of SERVICE_PAGES) {
      const path = servicePagePath(page.slug);
      expect(
        urls.filter((u) => u.endsWith(path)).length,
        `sitemap ${path}`,
      ).toBe(1);
    }
  });

  it('local framing is Salt Lake City — never the SEO plan’s Kansas City error', () => {
    for (const page of SERVICE_PAGES) {
      expect(allCopy(page), page.slug).not.toContain('Kansas City');
    }
    expect(getServicePage('house-cleansing')?.eyebrow).toContain(
      'Salt Lake City',
    );
    expect(getServicePage('house-cleansing')?.metaDescription).toContain(
      'Salt Lake City',
    );
  });

  it('inner-healing copy carries the alongside-licensed-care guardrail', () => {
    const copy = allCopy(getServicePage('inner-healing')!);
    expect(copy).toContain('not therapy');
    expect(copy).toContain('alongside licensed care');
    expect(copy).toContain('never a substitute');
  });

  it('past-life copy carries the not-verified-memories guardrail', () => {
    const copy = allCopy(getServicePage('past-life-regression')!);
    expect(copy).toContain('not presented as verified historical memories');
  });

  it('spirit-resolution copy makes no entity-removal claim', () => {
    const copy = allCopy(getServicePage('spirit-resolution')!);
    expect(copy).toContain('no claim is made');
    expect(copy).toContain('outcomes are not guaranteed');
  });
});
