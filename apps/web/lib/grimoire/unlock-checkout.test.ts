/**
 * Unlock checkout availability + session params (Stage 2).
 *
 * Laws: the price is env-driven (STRIPE_GRIMOIRE_UNLOCK_PRICE_ID);
 * without it the unlock is truthfully NOT purchasable; session params
 * carry the unlock routing metadata and the buyer's normalized email,
 * and never an order id.
 */
import { describe, expect, it } from 'vitest';
import {
  buildUnlockSessionParams,
  createUnlockCheckoutSession,
  grimoireUnlockCheckoutAvailable,
  grimoireUnlockPriceId,
  isUnlockSessionMetadata,
} from './unlock-checkout';
import type { StripeClientLike } from '../payments/stripe';

const KEYS = {
  STRIPE_SECRET_KEY: 'sk_test_fake',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_fake',
};

describe('unlock checkout availability', () => {
  it('unavailable when the price env is unset — even with Stripe keys', () => {
    expect(grimoireUnlockCheckoutAvailable({ ...KEYS })).toBe(false);
    expect(grimoireUnlockPriceId({ ...KEYS })).toBeNull();
  });

  it('unavailable when Stripe keys are missing — even with a price id', () => {
    expect(
      grimoireUnlockCheckoutAvailable({
        STRIPE_GRIMOIRE_UNLOCK_PRICE_ID: 'price_123',
      }),
    ).toBe(false);
  });

  it('available when keys + price id are configured', () => {
    const env = { ...KEYS, STRIPE_GRIMOIRE_UNLOCK_PRICE_ID: 'price_123' };
    expect(grimoireUnlockCheckoutAvailable(env)).toBe(true);
    expect(grimoireUnlockPriceId(env)).toBe('price_123');
  });
});

describe('unlock session params', () => {
  it('carries routing metadata, the price id, and no order reference', () => {
    const params = buildUnlockSessionParams({
      email: 'Buyer@Example.com',
      priceId: 'price_123',
      successUrl: 'http://x/grimoire/subscribe?unlock=success',
      cancelUrl: 'http://x/grimoire/subscribe?unlock=cancelled',
    });
    expect(params.mode).toBe('payment');
    expect(params.customer_email).toBe('buyer@example.com');
    expect(params.line_items).toEqual([{ price: 'price_123', quantity: 1 }]);
    const metadata = params.metadata as Record<string, unknown>;
    expect(isUnlockSessionMetadata(metadata)).toBe(true);
    expect(metadata.edition_id).toBe('living-grimoire-333');
    expect(metadata.email).toBe('buyer@example.com');
    expect(JSON.stringify(params)).not.toContain('order_id');
  });

  it('createUnlockCheckoutSession returns the hosted checkout URL', async () => {
    let seen: Record<string, unknown> | null = null;
    const client: StripeClientLike = {
      checkout: {
        sessions: {
          create: async (params) => {
            seen = params;
            return {
              id: 'cs_unlock_x',
              client_secret: null,
              url: 'https://checkout.stripe.com/c/cs_unlock_x',
            } as { id: string; client_secret: string | null };
          },
        },
      },
      coupons: { create: async () => ({ id: 'cpn_unused' }) },
      webhooks: {
        constructEvent: () => {
          throw new Error('unused');
        },
      },
    };
    const session = await createUnlockCheckoutSession(
      { email: 'buyer@example.com', origin: 'http://localhost' },
      client,
      { ...KEYS, STRIPE_GRIMOIRE_UNLOCK_PRICE_ID: 'price_123' },
    );
    expect(session.id).toBe('cs_unlock_x');
    expect(session.url).toContain('checkout.stripe.com');
    expect(seen).not.toBeNull();
  });
});
