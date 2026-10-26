/**
 * REGRESSION SUITE — §19: structured-data brand law.
 *
 * The exact business name "Amber's Alchemy Apothecary" must appear in
 * Organization, WebSite, and Product structured data — never shortened to
 * "Amber's Alchemy". Contact identity must match the verified values
 * (telephone "+1-801-819-6795", email Amber@awakenagain.com).
 *
 * Note: written with React.createElement (no JSX) because this repo's
 * vitest transform does not parse JSX in .tsx test files.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrganizationJsonLd, ProductJsonLd } from './JsonLd';
import { BRAND_NAME, BRAND_EMAIL, BRAND_PHONE_JSONLD, siteUrl } from '../../lib/seo/config';

const SHORTENED = /Amber's Alchemy(?! Apothecary)/;

function decodeEntities(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

describe('OrganizationJsonLd', () => {
  // Async server component since the CSP-nonce change (Aikido 845087258):
  // it reads the per-request nonce from headers(), so render it by
  // awaiting the component function rather than createElement.
  let html = '';
  beforeAll(async () => {
    html = decodeEntities(renderToStaticMarkup(await OrganizationJsonLd()));
  });

  it('emits the exact canonical brand name', () => {
    expect(html).toContain(BRAND_NAME);
    expect(BRAND_NAME).toBe("Amber's Alchemy Apothecary");
  });

  it('never shortens the brand name', () => {
    expect(html).not.toMatch(SHORTENED);
  });

  it('carries the verified telephone and email', () => {
    expect(html).toContain(BRAND_PHONE_JSONLD);
    expect(BRAND_PHONE_JSONLD).toBe('+1-801-819-6795');
    expect(html).toContain(BRAND_EMAIL);
  });

  it('emits Organization and WebSite types', () => {
    expect(html).toContain('"@type":"Organization"');
    expect(html).toContain('"@type":"WebSite"');
  });
});

describe('ProductJsonLd', () => {
  let html = '';
  beforeAll(async () => {
    html = decodeEntities(
      renderToStaticMarkup(
        await ProductJsonLd({
          product: {
            name: 'DreamEase Botanical Capsules',
            description: 'Compliant test description.',
            priceCents: 4777,
            path: '/shop/dreamease-capsules',
            sku: 'DREAMEASE-30D',
          },
        }),
      ),
    );
  });

  it('emits the exact brand name in the brand node and never shortens it', () => {
    expect(html).toContain(BRAND_NAME);
    expect(html).not.toMatch(SHORTENED);
  });

  it('derives the Offer price from integer cents (server-authoritative)', () => {
    expect(html).toContain('"price":"47.77"');
    expect(html).toContain('"priceCurrency":"USD"');
  });

  it('links the offer to the canonical product URL', () => {
    expect(html).toContain(`${siteUrl()}/shop/dreamease-capsules`);
  });
});
