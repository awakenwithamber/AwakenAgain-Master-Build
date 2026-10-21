/**
 * Subscription checkout + Customer Portal helpers (Stage 3).
 *
 * Laws: the price is env-driven (STRIPE_GRIMOIRE_PRICE_ID); without
 * it, card subscription is truthfully unavailable; session params are
 * mode 'subscription' and link the member by email + metadata (on
 * both the session and the subscription) so webhook events resolve
 * the member record; the portal requires a Stripe customer.
 */
import { describe, expect, it } from 'vitest';
import {
  billingPortalAvailable,
  buildSubscriptionSessionParams,
  createBillingPortalSession,
  createSubscriptionCheckoutSession,
  grimoireSubscriptionCheckoutAvailable,
  grimoireSubscriptionPriceId,
  isSubscriptionSessionMetadata,
} from './subscription-checkout';
import { hasStripeSubscription } from './subscriptions';
import type { StripeClientLike } from '../payments/stripe';

const KEYS = {
  STRIPE_SECRET_KEY: 'sk_test_fake',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_fake',
};
const ENV = { ...KEYS, STRIPE_GRIMOIRE_PRICE_ID: 'price_sub_test' };

function fakeClient(capture: { params?: Record<string, unknown>; portal?: Record<string, unknown> }): StripeClientLike {
  return {
    checkout: {
      sessions: {
        create: async (params) => {
          capture.params = params;
          return {
            id: 'cs_sub_1',
            client_secret: null,
            url: 'https://checkout.stripe.com/c/cs_sub_1',
          };
        },
      },
    },
    coupons: { create: async () => ({ id: 'cpn_unused' }) },
    billingPortal: {
      sessions: {
        create: async (params) => {
          capture.portal = params;
          return { id: 'bps_1', url: 'https://billing.stripe.com/p/bps_1' };
        },
      },
    },
    webhooks: {
      constructEvent: () => {
        throw new Error('unused');
      },
    },
  };
}

describe('subscription checkout availability', () => {
  it('unavailable when STRIPE_GRIMOIRE_PRICE_ID is unset — even with keys', () => {
    expect(grimoireSubscriptionCheckoutAvailable({ ...KEYS })).toBe(false);
    expect(grimoireSubscriptionPriceId({ ...KEYS })).toBeNull();
  });

  it('unavailable when Stripe keys are missing — even with a price id', () => {
    expect(
      grimoireSubscriptionCheckoutAvailable({
        STRIPE_GRIMOIRE_PRICE_ID: 'price_sub_test',
      }),
    ).toBe(false);
  });

  it('available when keys + price id are configured', () => {
    expect(grimoireSubscriptionCheckoutAvailable(ENV)).toBe(true);
    expect(grimoireSubscriptionPriceId(ENV)).toBe('price_sub_test');
  });

  it('never falls back to a hard-coded price id', () => {
    // The test-mode dashboard price may be referenced in comments as
    // the value the owner sets in env — never as a code fallback.
    expect(grimoireSubscriptionPriceId({ ...KEYS })).toBeNull();
  });
});

describe('subscription session params', () => {
  it("mode 'subscription', env price, member linked by email + metadata", () => {
    const params = buildSubscriptionSessionParams({
      email: 'Member@Example.com',
      priceId: 'price_sub_test',
      successUrl: 'http://x/grimoire/subscribe?subscription=success',
      cancelUrl: 'http://x/grimoire/subscribe?subscription=cancelled',
    });
    expect(params.mode).toBe('subscription');
    expect(params.customer_email).toBe('member@example.com');
    expect(params.line_items).toEqual([{ price: 'price_sub_test', quantity: 1 }]);
    const metadata = params.metadata as Record<string, unknown>;
    expect(isSubscriptionSessionMetadata(metadata)).toBe(true);
    expect(metadata.email).toBe('member@example.com');
    expect(metadata.plan_id).toBe('living-grimoire-monthly');
    const subData = params.subscription_data as { metadata: Record<string, unknown> };
    expect(subData.metadata.email).toBe('member@example.com');
    expect(isSubscriptionSessionMetadata(subData.metadata)).toBe(true);
  });

  it('createSubscriptionCheckoutSession returns the hosted URL', async () => {
    const capture: { params?: Record<string, unknown> } = {};
    const session = await createSubscriptionCheckoutSession(
      { email: 'member@example.com', origin: 'http://localhost' },
      fakeClient(capture),
      ENV,
    );
    expect(session.id).toBe('cs_sub_1');
    expect(session.url).toContain('checkout.stripe.com');
    expect(capture.params?.mode).toBe('subscription');
  });
});

describe('customer portal', () => {
  it('portal availability needs only the secret key', () => {
    expect(billingPortalAvailable({})).toBe(false);
    expect(billingPortalAvailable({ STRIPE_SECRET_KEY: 'sk_test_fake' })).toBe(true);
  });

  it('creates a portal session bound to the Stripe customer', async () => {
    const capture: { portal?: Record<string, unknown> } = {};
    const session = await createBillingPortalSession(
      { stripeCustomerId: 'cus_123', origin: 'http://localhost' },
      fakeClient(capture),
    );
    expect(session.url).toContain('billing.stripe.com');
    expect(capture.portal?.customer).toBe('cus_123');
    expect(String(capture.portal?.return_url)).toContain('/account');
  });

  it('portal action is hidden without a Stripe subscription', () => {
    // The account surface renders Manage/cancel only when this is true.
    expect(
      hasStripeSubscription({
        stripe_subscription_id: null,
        stripe_customer_id: null,
        billing_source: 'manual',
      }),
    ).toBe(false);
    expect(
      hasStripeSubscription({
        stripe_subscription_id: 'sub_1',
        stripe_customer_id: 'cus_1',
        billing_source: 'stripe',
      }),
    ).toBe(true);
    expect(hasStripeSubscription(null)).toBe(false);
  });

  it('portal session refuses without a Stripe customer id', async () => {
    await expect(
      createBillingPortalSession(
        { stripeCustomerId: '', origin: 'http://localhost' },
        fakeClient({}),
      ),
    ).rejects.toThrow(/no Stripe customer/);
  });
});
