/**
 * SUPERSEDED-PRODUCT PROTECTIONS — regression suite.
 *
 * The full-soap-collection record (retired 9-bar, $99.99) carries
 * verification_status: 'SUPERSEDED' + superseded_by in its data. Laws
 * under test:
 * - (a) Checkout REJECTS any order line for a superseded product — a
 *   crafted API line at the record's real price is refused with a
 *   "no longer available" validation error (422 at the route), exactly
 *   like unknown products and tampered prices.
 * - (b) A verified-subscriber claim changes nothing: rejection happens
 *   in pricing, before any subscriber benefit could apply.
 * - (c) The sitemap excludes superseded products and still emits every
 *   other product page.
 * - (d) Site search never returns a superseded product, while its
 *   replacement still ranks.
 * - (e) isSupersededProduct is an exact, case-sensitive match on the
 *   record's verification_status.
 *
 * The record itself is NOT deleted or edited — it stays in the catalog
 * for reference; these tests assert the protections read its flags.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '../app/api/checkout/route';
import { validateAndBuildOrder } from '../lib/checkout/order';
import { getProductByHandle, PRODUCTS } from '../lib/catalog/products';
import { isSupersededProduct } from '../lib/catalog/status';
import sitemap from '../app/sitemap';
import { CANONICAL_ROUTES } from '../lib/seo/routes';
import { JOURNAL_ARTICLES } from '../lib/content/journal';
import { herbalRouteParams } from '../lib/herbal-index/cards';
import { SERVICE_PAGES } from '../lib/content/service-pages';
import { searchProducts } from '../lib/search/search';
import type { Product } from '../types';

const DIR = mkdtempSync(join(tmpdir(), 'superseded-product-'));
const ORDERS_LEDGER = join(DIR, 'orders.jsonl');
const SUBS_LEDGER = join(DIR, 'subscriptions.jsonl');
process.env.ORDERS_LEDGER_PATH = ORDERS_LEDGER;
process.env.SUBSCRIPTIONS_LEDGER_PATH = SUBS_LEDGER;

// The crafted line from the audit: the UI blocks this purchase, and the
// price is the record's REAL price (9999¢) — only the superseded guard
// can refuse it.
const SUPERSEDED_ITEM = {
  product_handle: 'full-soap-collection',
  quantity: 1,
  unit_price_cents: 9999,
};

function subscriptionLine(email: string, status: string) {
  return JSON.stringify({
    subscription_id: 'SUB-TEST-0002',
    created_at: '2026-10-13T00:00:00.000Z',
    computed_by: 'server',
    plan_id: 'living-grimoire-monthly',
    plan_name: 'Living Grimoire',
    price_cents: 777,
    interval: 'month',
    status,
    customer: { name: 'Test Member', email },
    confirmed_at: status === 'active' ? '2026-10-13T01:00:00.000Z' : null,
    confirmed_by: status === 'active' ? 'owner' : null,
    recurring_mechanic: 'NEEDS_VERIFICATION',
    ledger_version: 1,
  });
}

function setSubscriptions(lines: string[]): void {
  writeFileSync(SUBS_LEDGER, lines.length ? lines.join('\n') + '\n' : '', 'utf8');
}

async function postCheckout(body: unknown) {
  const res = await POST(
    new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

function orderLedgerLineCount(): number {
  if (!existsSync(ORDERS_LEDGER)) return 0;
  const content = readFileSync(ORDERS_LEDGER, 'utf8').trim();
  return content ? content.split('\n').length : 0;
}

describe('isSupersededProduct', () => {
  const base: Product = {
    handle: 'some-product',
    title: 'Some Product',
    category: 'Soaps',
  };

  it('(e) matches the real record and only the exact flag', () => {
    const record = getProductByHandle('full-soap-collection');
    expect(record).toBeDefined();
    expect(isSupersededProduct(record as Product)).toBe(true);
    expect((record as Product).superseded_by).toBe('soap-style-collection-5');

    expect(isSupersededProduct({ ...base, verification_status: 'SUPERSEDED' })).toBe(true);
    expect(isSupersededProduct({ ...base, verification_status: 'superseded' })).toBe(false);
    expect(isSupersededProduct({ ...base, verification_status: 'CURRENT' })).toBe(false);
    expect(isSupersededProduct({ ...base, verification_status: null })).toBe(false);
    expect(isSupersededProduct(base)).toBe(false);
  });
});

describe('checkout rejects superseded products', () => {
  it('(a) core: a crafted line at the real price throws "no longer available"', () => {
    expect(() =>
      validateAndBuildOrder({
        items: [SUPERSEDED_ITEM],
        customer: { name: 'Crafted', email: 'crafted@example.com' },
        client_total_cents: 9999,
      }),
    ).toThrow(/no longer available/i);
  });

  it('(a) route: the crafted line is refused with 422 and nothing is recorded', async () => {
    setSubscriptions([]);
    const before = orderLedgerLineCount();
    const { status, json } = await postCheckout({
      items: [SUPERSEDED_ITEM],
      customer: { name: 'Crafted', email: 'crafted@example.com' },
      client_total_cents: 9999,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(
      /no longer available/i,
    );
    expect(orderLedgerLineCount()).toBe(before);
  });

  it('(b) a verified subscriber claim does not change the outcome', async () => {
    // Seed an ACTIVE (owner-confirmed, entitled) subscription for the
    // order email — the strongest possible claim — and claim the
    // subscriber-priced total (round(9999 * 0.9) = 8999). Still refused:
    // the guard fires during pricing, before benefits are computed.
    setSubscriptions([subscriptionLine('member@example.com', 'active')]);
    const before = orderLedgerLineCount();
    const { status, json } = await postCheckout({
      items: [SUPERSEDED_ITEM],
      customer: { name: 'Member', email: 'member@example.com' },
      is_subscriber: true,
      client_total_cents: 8999,
    });
    expect(status).toBe(422);
    expect(String((json.errors as string[]).join(' '))).toMatch(
      /no longer available/i,
    );
    expect(orderLedgerLineCount()).toBe(before);

    expect(() =>
      validateAndBuildOrder(
        {
          items: [SUPERSEDED_ITEM],
          customer: { name: 'Member', email: 'member@example.com' },
          is_subscriber: true,
          client_total_cents: 8999,
        },
        { isSubscriberVerified: true },
      ),
    ).toThrow(/no longer available/i);
  });
});

describe('sitemap excludes superseded products', () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  it('(c) omits the superseded handle, keeps its replacement, keeps the count honest', () => {
    expect(urls.some((u) => u.includes('/shop/full-soap-collection'))).toBe(false);
    expect(urls.some((u) => u.includes('/shop/soap-style-collection-5'))).toBe(true);

    const liveProducts = PRODUCTS.filter((p) => !isSupersededProduct(p));
    const productUrls = urls.filter((u) => u.includes('/shop/'));
    expect(productUrls.length).toBe(liveProducts.length);
    expect(entries.length).toBe(
      CANONICAL_ROUTES.length +
        liveProducts.length +
        JOURNAL_ARTICLES.length +
        // Herb detail routes (Stage 4, 2026-10-21): the sitemap emits
        // the Herbal Index workstream's full route set (310), not just
        // the 29 legacy HERB_INDEX slugs.
        herbalRouteParams().length +
        // Service landing pages (Phase 2, 2026-10-14) emit from their
        // content registry — part of the honest total.
        SERVICE_PAGES.length,
    );
  });
});

describe('search excludes superseded products', () => {
  it('(d) "soap collection" returns the Alchemy collection, never the superseded one', () => {
    const handles = searchProducts('soap collection').map((p) => p.handle);
    expect(handles).toContain('soap-style-collection-5');
    expect(handles).not.toContain('full-soap-collection');
  });
});
