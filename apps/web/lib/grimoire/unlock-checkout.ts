/**
 * Grimoire PERMANENT_UNLOCK checkout — SERVER (Stage 2).
 *
 * A real one-time Stripe Checkout flow for the $8.88 unlock (owner
 * decision 2026-10-21 §13(2): unlock sales ARE authorized to build).
 * Parallel to the embedded order checkout in lib/payments/stripe.ts,
 * but deliberately separate: an unlock session is NOT a product
 * order — it carries unlock metadata, creates no order record, and
 * the entitlement is granted ONLY by the signature-verified webhook
 * (app/api/stripe/webhook/route.ts), never by this creation path or
 * by the browser returning from Stripe.
 *
 * Price: env STRIPE_GRIMOIRE_UNLOCK_PRICE_ID (a Stripe Price ID is
 * not a secret; it stays env-driven and is never hard-coded). When
 * the env is unset — or Stripe keys are missing — the purchase is
 * UNAVAILABLE and the UI degrades truthfully ("not yet purchasable"),
 * with no fake checkout.
 *
 * SERVER-ONLY: uses the Stripe secret key. Never import client-side.
 */
import type { StripeClientLike } from '../payments/stripe';
import { getStripeConfig } from '../payments/stripe';
import { normalizeSubscriptionEmail } from '../subscriptions/entitlement';
import {
  GRIMOIRE_EDITION_ID,
  GRIMOIRE_UNLOCK_PRICE_CENTS,
} from './unlock';

/** Metadata marker routing a completed session into the unlock grant path. */
export const GRIMOIRE_UNLOCK_METADATA_FLAG = 'grimoire_permanent_unlock';

export function grimoireUnlockPriceId(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return env.STRIPE_GRIMOIRE_UNLOCK_PRICE_ID?.trim() || null;
}

/** True when a real unlock checkout can be created on this server. */
export function grimoireUnlockCheckoutAvailable(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    getStripeConfig(env).cardAvailable && grimoireUnlockPriceId(env) !== null
  );
}

export function isUnlockSessionMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata) return false;
  return (
    metadata.grimoire_unlock === GRIMOIRE_UNLOCK_METADATA_FLAG ||
    metadata.purpose === GRIMOIRE_UNLOCK_METADATA_FLAG
  );
}

export function buildUnlockSessionParams(input: {
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Record<string, unknown> {
  const email = normalizeSubscriptionEmail(input.email);
  const metadata = {
    grimoire_unlock: GRIMOIRE_UNLOCK_METADATA_FLAG,
    purpose: GRIMOIRE_UNLOCK_METADATA_FLAG,
    edition_id: GRIMOIRE_EDITION_ID,
    email,
  };
  return {
    mode: 'payment',
    customer_email: email,
    line_items: [{ price: input.priceId, quantity: 1 }],
    metadata,
    payment_intent_data: { metadata },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };
}

export async function createUnlockCheckoutSession(
  input: { email: unknown; origin: string },
  client: StripeClientLike,
  env: Record<string, string | undefined> = process.env,
): Promise<{ id: string; url: string }> {
  const email = normalizeSubscriptionEmail(input.email);
  if (!email) throw new Error('A valid email address is required.');
  const priceId = grimoireUnlockPriceId(env);
  if (!priceId) {
    throw new Error('The Grimoire unlock is not purchasable yet.');
  }
  const session = await client.checkout.sessions.create(
    buildUnlockSessionParams({
      email,
      priceId,
      successUrl: `${input.origin}/grimoire/subscribe?unlock=success`,
      cancelUrl: `${input.origin}/grimoire/subscribe?unlock=cancelled`,
    }),
  );
  const url = (session as { url?: string | null }).url;
  if (!url) {
    throw new Error('Stripe did not return a checkout URL for the unlock session.');
  }
  return { id: session.id, url };
}

/** The amount (cents) a completed unlock session must carry to grant. */
export const EXPECTED_UNLOCK_AMOUNT_CENTS = GRIMOIRE_UNLOCK_PRICE_CENTS;
