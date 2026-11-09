/**
 * Subscribe surfaces — copy truthfulness.
 *
 * Stage 3 pinned the Stripe-lifecycle copy. PHASE 2 (2026-10-30,
 * owner directive: Bluevine runs Stripe-free, Stripe cancelled)
 * SUPERSEDES that contract: subscriptions and the unlock are MANUAL —
 * the customer pays an emailed invoice or Venmo/Cash App, and Amber
 * confirms personally. This file now pins the Phase-2 truth:
 *
 * - the retired "being finalized" copy stays gone;
 * - pre-purchase terms are present before purchase ($7.77/month, paid
 *   manually each month, Amber confirms, cancel anytime by contacting
 *   Amber, access through the paid period, $8.88 unlock unaffected);
 * - NO surface promises card auto-renewal or a customer portal, and
 *   no card-checkout affordance remains on the form;
 * - the manual Cash App / Venmo path + owner-confirm explanation stay;
 * - the account surface keeps its status copy (lapsed, past-due with
 *   the 3-day grace facts) with "contact Amber" as the action — the
 *   Stripe portal action is gone.
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

describe('subscribe copy (Phase 2 manual rail)', () => {
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

  it('pre-purchase terms are present before purchase — the manual terms', () => {
    expect(FORM).toContain('$7.77/month');
    expect(FORM).toContain('Cancel anytime');
    expect(FORM).toContain('just contact Amber');
    expect(FORM).toContain('access continues through the paid period');
    expect(FORM).toContain('$8.88 permanent unlock');
    expect(FORM).toContain('unaffected by subscription cancellation');
    expect(FORM).toContain('Amber confirms every subscription personally');
    expect(PAGE).toContain('no automatic card charge');
    // Owner model update 2026-11-08: the page now protects pre-model
    // permanent-unlock holders in these words instead.
    expect(PAGE).toContain('never removed by subscribing or cancelling');
  });

  it('no surface promises card auto-renewal or a customer portal anymore', () => {
    for (const [name, src] of [
      ['SubscribeForm', FORM],
      ['subscribe page', PAGE],
      ['account profile', ACCOUNT],
    ] as const) {
      expect(src, name).not.toContain('auto-renews monthly by card');
      expect(src, name).not.toContain('Customer Portal');
      expect(src, name).not.toContain('/api/subscriptions/portal');
      expect(src, name).not.toContain('update your card');
    }
    // The form carries no card-checkout availability prop at all now.
    expect(FORM).not.toContain('stripeAvailable');
  });

  it('manual Cash App/Venmo path remains offered with its owner-confirm explanation', () => {
    expect(FORM).toContain('Cash App');
    expect(FORM).toContain('Venmo');
    expect(ROUTE).toContain('Amber confirms every manual subscription personally');
  });

  it('account surface: status copy present, action is contact-Amber, no portal', () => {
    expect(ACCOUNT).toContain('Membership lapsed');
    expect(ACCOUNT).toContain('Your payment failed');
    expect(ACCOUNT).toContain('access continues until');
    expect(ACCOUNT).toContain('contact Amber so she can help you keep access');
    expect(ACCOUNT).toContain('Amber@awakenagain.com');
    expect(ACCOUNT).not.toContain('Manage / cancel subscription');
  });
});
