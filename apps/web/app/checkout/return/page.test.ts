/**
 * /checkout/return + order-status wording guards (post-launch fix,
 * 2026-10-30; NARROWED 2026-11-01).
 *
 * The current flow is emailed-invoice payment (ACH bank transfer,
 * Venmo, Cash App) with Amber confirming payments by hand. These
 * source-level assertions keep Stripe-era customer-facing language
 * from returning to the two customer surfaces that report payment
 * state, while pinning the behavior that must NOT change: the shared
 * paid-state resolver still drives the page, and the refunded /
 * disputed / confirmed status branches still render.
 *
 * NARROWING (2026-11-01, deliberate): card payment is real again —
 * through Bluevine's secure payment page only (owner direction
 * 2026-10-31). The old blanket bans on "card payment" / "by card"
 * would ban the honest new copy, so the ban list now targets the
 * DORMANT processor's phrasing specifically (its name, embedded
 * checkout claims), and the Bluevine-card phrasing is PINNED as
 * required copy instead. What stays banned in spirit: any claim that
 * card payment happens on this site or through the dormant rail.
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
  it('carries no dormant-processor customer-facing language', () => {
    for (const banned of ['through Stripe', 'Stripe', 'embedded checkout']) {
      expect(returnSrc).not.toContain(banned);
    }
  });

  it('pins the Bluevine-card branch copy as required (2026-11-01; method name adapted to the admin tree in the combined merge, 2026-11-02)', () => {
    // The card tree's method was 'bluevine_card'; the canonical admin
    // method is 'bluevine_card_link'. The branch renders ONLY for an
    // order already recorded with that method (accepted only while
    // the payment link is configured), so the copy promises card
    // payment to no one new.
    expect(returnSrc).toContain('bluevine_card_link');
    expect(returnSrc).toContain("Bluevine's secure");
    expect(returnSrc).toContain('payment page');
    expect(returnSrc).toContain('the payment link is in your confirmation');
    // The confirmed branch honors merchant-recorded (manual ledger)
    // payments, not only dormant-rail sessions (Rule-4 fix).
    expect(returnSrc).toContain('manual_payment');
    // Legacy Bookipi wording never returns to this customer surface.
    expect(returnSrc).not.toContain('Bookipi');
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
