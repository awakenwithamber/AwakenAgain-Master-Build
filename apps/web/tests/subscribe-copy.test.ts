/**
 * Subscribe surfaces — copy truthfulness (Stage 3).
 *
 * Laws: the retired "Monthly renewal mechanics are being finalized…"
 * copy is gone from every subscribe surface now that the real Stripe
 * lifecycle exists; the pre-purchase terms are present before
 * purchase ($7.77/month, auto-renews monthly by card, cancel anytime
 * via account page / Customer Portal, access through the paid period
 * on cancellation, $8.88 unlock unaffected); and the Customer Portal
 * action exists only for Stripe subscriptions.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const FORM = read('components/grimoire/SubscribeForm.tsx');
const PAGE = read('app/grimoire/subscribe/page.tsx');
const ROUTE = read('app/api/subscriptions/route.ts');
const ACCOUNT = read('components/account/AccountProfile.tsx');

describe('subscribe copy (Stage 3)', () => {
  it('the finalized-mechanics copy is absent everywhere', () => {
    for (const [name, src] of [
      ['SubscribeForm', FORM],
      ['subscribe page', PAGE],
      ['subscriptions route', ROUTE],
    ] as const) {
      expect(src, name).not.toContain('Monthly renewal mechanics are being finalized');
      expect(src, name).not.toContain('being finalized');
      expect(src, name).not.toContain('will contact you directly before any renewal');
    }
  });

  it('pre-purchase terms are present before purchase', () => {
    expect(FORM).toContain('$7.77/month');
    expect(FORM).toContain('auto-renews monthly by card');
    expect(FORM).toContain('Cancel anytime');
    expect(FORM).toContain('Customer Portal');
    expect(FORM).toContain('access');
    expect(FORM).toContain('continues through the paid period');
    expect(FORM).toContain('$8.88 permanent unlock');
    expect(FORM).toContain('unaffected by subscription cancellation');
    expect(PAGE).toContain('auto-renews monthly by card');
    expect(PAGE).toContain('unaffected by subscription cancellation');
  });

  it('manual Cash App/Venmo path remains offered with its owner-confirm explanation', () => {
    expect(FORM).toContain('Cash App');
    expect(FORM).toContain('Venmo');
    expect(FORM).toContain('Amber confirms every manual subscription');
    expect(ROUTE).toContain('Amber confirms every manual subscription personally');
  });

  it('card subscribe degrades truthfully when unconfigured', () => {
    // The form renders the card button only when the server says the
    // checkout is available; otherwise a note, never a dead button.
    expect(FORM).toContain('stripeAvailable');
    expect(FORM).toContain('Card subscription is not switched on yet');
  });

  it('account surface: portal action only for Stripe subscriptions, past-due copy present', () => {
    expect(ACCOUNT).toContain('Manage / cancel subscription');
    expect(ACCOUNT).toContain('has_stripe_subscription');
    expect(ACCOUNT).toContain('/api/subscriptions/portal');
    expect(ACCOUNT).toContain('Your payment failed');
    expect(ACCOUNT).toContain('access continues until');
    expect(ACCOUNT).toContain('update your card to keep access');
    expect(ACCOUNT).toContain('Membership lapsed');
  });
});
