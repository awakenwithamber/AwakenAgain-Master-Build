/**
 * Tests — admin analytics summary (2026-10-31).
 * Laws: real counts render KNOWN; unreadable/unbound stores render
 * UNKNOWN, never a fabricated number; the payment rail is stated
 * exactly as canon (Stripe-free Bluevine invoicing, no live card
 * rail); PostHog is UNKNOWN without a usable token.
 */
import { describe, expect, it } from 'vitest';
import {
  PAYMENT_RAIL_CARD,
  PAYMENT_RAIL_LIVE,
  buildAdminAnalyticsSummary,
  posthogConfigured,
  type AnalyticsInputs,
} from './analytics';

const BASE: AnalyticsInputs = {
  ordersCount: 3,
  orderParseIssues: 0,
  subscriptionMemberCount: 2,
  broadcastRecordedCount: 1,
  leadsBindingDetail: 'leads pending',
  reviewsBindingDetail: 'reviews pending',
  submissionsBindingDetail: 'submissions pending',
  subscribersBindingDetail: 'subscribers pending',
  posthogConfigured: false,
};

describe('buildAdminAnalyticsSummary', () => {
  it('real store counts are KNOWN', () => {
    const s = buildAdminAnalyticsSummary(BASE);
    expect(s.orders).toEqual({ status: 'KNOWN', count: 3, parseIssues: 0 });
    expect(s.subscriptions).toEqual({ status: 'KNOWN', memberCount: 2 });
    expect(s.broadcasts.recordedCount).toBe(1);
    expect(s.broadcasts.deliveryStatus).toBe('recorded_not_sent');
  });

  it('unreadable stores are UNKNOWN with null counts — never zero-filled', () => {
    const s = buildAdminAnalyticsSummary({
      ...BASE,
      ordersCount: null,
      subscriptionMemberCount: null,
      broadcastRecordedCount: null,
    });
    expect(s.orders.status).toBe('UNKNOWN');
    expect(s.orders.count).toBeNull();
    expect(s.subscriptions.status).toBe('UNKNOWN');
    expect(s.subscriptions.memberCount).toBeNull();
    expect(s.broadcasts.status).toBe('UNKNOWN');
    expect(s.broadcasts.recordedCount).toBeNull();
  });

  it('pending-binding stores always read UNKNOWN', () => {
    const s = buildAdminAnalyticsSummary(BASE);
    for (const section of [s.leads, s.reviews, s.submissions, s.subscribersStore]) {
      expect(section.status).toBe('UNKNOWN');
    }
  });

  it('payment rail states Stripe-free invoicing and no live card rail', () => {
    const s = buildAdminAnalyticsSummary(BASE);
    expect(s.paymentRail.live).toBe(PAYMENT_RAIL_LIVE);
    expect(s.paymentRail.live).toMatch(/Stripe-free/);
    expect(s.paymentRail.cardRail).toBe(PAYMENT_RAIL_CARD);
    expect(s.paymentRail.cardRail).toMatch(/No live card rail/);
  });

  it('PostHog is UNKNOWN until configured, KNOWN after', () => {
    expect(buildAdminAnalyticsSummary(BASE).posthog.status).toBe('UNKNOWN');
    const known = buildAdminAnalyticsSummary({ ...BASE, posthogConfigured: true });
    expect(known.posthog.status).toBe('KNOWN');
  });
});

describe('posthogConfigured', () => {
  it('requires a real token, not a placeholder', () => {
    expect(posthogConfigured({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(
      posthogConfigured({
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'POSTHOG_KEY_PLACEHOLDER',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      posthogConfigured({
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'REPLACE_ME',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      posthogConfigured({
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_exampletokenvalue',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });
});
