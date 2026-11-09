/**
 * GUARD TEST — payment provider purity.
 * Original guard (owner directive 2026-10-04): Cash App + Venmo only.
 * AMENDED by the owner 2026-10-19: Stripe is now AUTHORIZED — the
 * embedded Stripe checkout is the primary card path (and Stripe also
 * backs the Living Grimoire subscription). Shopify, PayPal, and Square
 * remain forbidden: this test fails the suite if any of them appear
 * anywhere in the app, lib, or component sources — including comments
 * suggesting them as alternatives.
 *
 * AMENDED AGAIN by the owner 2026-11-09 (card checkout build; Stripe
 * itself was taken OFF THE TABLE 2026-11-07 — she will not repeat its
 * ID check): Authorize.net is now the ONLY approved card processor,
 * and only for shop orders at /checkout, behind the
 * CARD_PAYMENTS_ENABLED flag (default OFF). Every other ban stands:
 * the scan below still fails the suite on Shopify / PayPal / Square
 * anywhere in shipped code, and the new tests at the bottom pin the
 * card-rail law — the dormant embedded-card method stays rejected
 * for new orders, the Authorize.net method stays rejected while its
 * flag gate is closed, and the checkout form wires no other card
 * component. (The dormant legacy card code remains in the tree for
 * historical records only; it is not an approved or reachable rail,
 * which is why this guard pins reachability rather than deleting
 * history the stored records still reference.)
 *
 * Scope: shipped source directories (app/, lib/, components/), excluding
 * test files themselves — a test asserting the absence of these providers
 * (even a skipped one) is documentation of the guard, not a violation.
 * Documentation in docs/ and the historical ledger may discuss the
 * superseded providers; this test guards shipped code, not the archive.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'lib', 'components'].map((d) => join(ROOT, d));
const SKIP = new Set(['node_modules', '.next', '.vitest']);

const FORBIDDEN = ['shopify', 'paypal', 'square'];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (
      /\.(ts|tsx|js|jsx|mjs|json)$/.test(entry) &&
      !/\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/.test(entry)
    )
      yield full;
  }
}

describe('payment provider purity', () => {
  it('no forbidden provider appears in app/lib/components sources', () => {
    const hits: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(dir)) {
        const content = readFileSync(file, 'utf8').toLowerCase();
        const found = FORBIDDEN.filter((word) =>
          new RegExp(`\\b${word}\\b`).test(content),
        );
        if (found.length > 0) {
          hits.push(`${file.slice(ROOT.length + 1)}: ${found.join(', ')}`);
        }
      }
    }
    expect(hits, 'forbidden payment provider references in shipped code').toEqual(
      [],
    );
  });

  it('Authorize.net is the ONLY card processor a new order can select (2026-11-09)', async () => {
    const { parsePaymentMethod } = await import('../lib/checkout/order');
    const saved = { ...process.env };
    try {
      // Flag gate closed (the default): the card method is rejected
      // even with credentials present — credentials alone never open it.
      delete process.env.CARD_PAYMENTS_ENABLED;
      process.env.AUTHORIZENET_API_LOGIN_ID = 'test-login';
      process.env.AUTHORIZENET_TRANSACTION_KEY = 'test-key';
      expect(() => parsePaymentMethod('authorizenet_card_hosted')).toThrow();
      // The dormant embedded-card method is rejected for new orders
      // in every configuration — it is not an approved rail.
      expect(() => parsePaymentMethod('stripe_card_embedded')).toThrow();
      // Flag ON + credentials: Authorize.net — and only Authorize.net —
      // becomes selectable.
      process.env.CARD_PAYMENTS_ENABLED = 'true';
      expect(parsePaymentMethod('authorizenet_card_hosted')).toBe(
        'authorizenet_card_hosted',
      );
      expect(() => parsePaymentMethod('stripe_card_embedded')).toThrow();
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in saved)) delete process.env[key];
      }
      Object.assign(process.env, saved);
    }
  });

  it('the checkout form wires the Authorize.net card option and no other card component', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, resolve } = await import('node:path');
    const form = readFileSync(
      join(resolve(__dirname, '..'), 'components/checkout/CheckoutForm.tsx'),
      'utf8',
    );
    expect(form).toContain('authorizenet_card_hosted');
    expect(form).toContain('Pay by card');
    expect(form).not.toContain('StripeEmbeddedCheckout');
  });

  it('checkout declares the Cash App + Venmo handles', async () => {
    const { CASH_APP_HANDLE, VENMO_HANDLE } = await import(
      '../lib/checkout/order'
    );
    expect(CASH_APP_HANDLE).toBe('$AmberPatten347');
    expect(VENMO_HANDLE).toBe('@AwakenwithAmber');
  });
});
