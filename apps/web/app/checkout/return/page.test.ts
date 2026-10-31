/**
 * /checkout/return + order-status wording guards (post-launch fix,
 * 2026-10-30).
 *
 * The current flow is emailed-invoice payment (ACH bank transfer,
 * Venmo, Cash App) with Amber confirming payments by hand. These
 * source-level assertions keep Stripe-era customer-facing language
 * ("refunded through Stripe", "your card payment", paying "by card")
 * from returning to the two customer surfaces that report payment
 * state, while pinning the behavior that must NOT change: the shared
 * paid-state resolver still drives the page, and the refunded /
 * disputed / confirmed status branches still render.
 *
 * Source-level for the same reason as the Header suite: this repo's
 * tsconfig sets "jsx": "preserve", which vitest's transform cannot
 * parse, so no test imports a JSX component.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const returnSrc = readFileSync(join(root, 'app/checkout/return/page.tsx'), 'utf8');
const statusFormSrc = readFileSync(
  join(root, 'app/order-status/OrderStatusForm.tsx'),
  'utf8',
);

describe('/checkout/return wording (current invoice flow)', () => {
  it('carries no Stripe-era customer-facing language', () => {
    for (const banned of ['through Stripe', 'card payment', 'by card']) {
      expect(returnSrc).not.toContain(banned);
    }
  });

  it('describes how orders are actually paid today', () => {
    expect(returnSrc).toContain('emailed invoice');
    expect(returnSrc).toContain('ACH bank transfer');
    expect(returnSrc).toContain('Venmo');
    expect(returnSrc).toContain('Cash App');
    expect(returnSrc).toContain('order number as the');
  });

  it('still resolves state through the shared resolver and renders every status branch', () => {
    expect(returnSrc).toContain('resolveOrderPaidState');
    expect(returnSrc).toContain('Payment Refunded');
    expect(returnSrc).toContain('Payment Disputed');
    expect(returnSrc).toContain('Payment Confirmed');
    expect(returnSrc).toContain('Payment Being Confirmed');
    expect(returnSrc).toContain('href="/order-status"');
  });
});

describe('order-status form wording (related surface)', () => {
  it('reports refunds and disputes without naming the legacy processor', () => {
    expect(statusFormSrc).not.toContain('through Stripe');
    expect(statusFormSrc).toContain('This order was refunded.');
    expect(statusFormSrc).toContain('A payment dispute was opened on this order.');
  });
});
