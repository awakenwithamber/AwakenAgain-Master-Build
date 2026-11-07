/**
 * Grimoire subscription Stripe Checkout + Customer Portal — SERVER
 * (Stage 3, owner decision 2026-10-21 §13(3): Stripe is the
 * subscription processor).
 *
 * Parallel to the unlock checkout (lib/grimoire/unlock-checkout.ts),
 * but for the recurring $7.77/month plan: a hosted Stripe Checkout
 * Session in mode 'subscription'. The entitlement is granted ONLY by
 * the signature-verified webhook lifecycle
 * (lib/subscriptions/stripe-lifecycle.ts) — creating a session here
 * grants nothing.
 *
 * Price: env STRIPE_GRIMOIRE_PRICE_ID (a Stripe Price ID is not a
 * secret; it stays env-driven and is never hard-coded). The owner
 * will set the TEST-mode dashboard price created 2026-10-20,
 * price_1USkXbExytHoVi8X4wi8gzZP, as the value of that env var in the
 * test environment — it appears here in this comment only, never as
 * a code fallback. When the env is unset — or Stripe keys are
 * missing — card subscription is UNAVAILABLE and the UI degrades
 * truthfully to the manual Cash App/Venmo path (no dead button).
 *
 * SERVER-ONLY: uses the Stripe secret key. Never import client-side.
 */
import type { StripeClientLike } from '../payments/stripe';
import { getStripeConfig } from '../payments/stripe';
import { normalizeSubscriptionEmail } from './entitlement';
import { GRIMOIRE_PLAN } from './subscriptions';

/** Metadata marker routing subscription events to the lifecycle. */
export const GRIMOIRE_SUBSCRIPTION_METADATA_FLAG = 'grimoire_subscription';

export function grimoireSubscriptionPriceId(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return env.STRIPE_GRIMOIRE_PRICE_ID?.trim() || null;
}

/** True when a real subscription checkout can be created here. */
export function grimoireSubscriptionCheckoutAvailable(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    getStripeConfig(env).cardAvailable &&
    grimoireSubscriptionPriceId(env) !== null
  );
}

export function isSubscriptionSessionMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata) return false;
  return (
    metadata.grimoire_subscription === GRIMOIRE_SUBSCRIPTION_METADATA_FLAG ||
    metadata.purpose === GRIMOIRE_SUBSCRIPTION_METADATA_FLAG
  );
}

/** True for any object carrying the subscription routing metadata. */
export function hasSubscriptionMetadata(
  value: unknown,
): boolean {
  if (typeof value !== 'object' || value === null) return false;
  return isSubscriptionSessionMetadata(value as Record<string, unknown>);
}

export function buildSubscriptionSessionParams(input: {
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Record<string, unknown> {
  const email = normalizeSubscriptionEmail(input.email);
  const metadata = {
    grimoire_subscription: GRIMOIRE_SUBSCRIPTION_METADATA_FLAG,
    purpose: GRIMOIRE_SUBSCRIPTION_METADATA_FLAG,
    plan_id: GRIMOIRE_PLAN.id,
    email,
  };
  return {
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: input.priceId, quantity: 1 }],
    metadata,
    // The metadata rides onto the subscription itself so invoice and
    // subscription webhook events can resolve the member record even
    // when they carry no email.
    subscription_data: { metadata },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };
}

export async function createSubscriptionCheckoutSession(
  input: { email: unknown; origin: string },
  client: StripeClientLike,
  env: Record<string, string | undefined> = process.env,
): Promise<{ id: string; url: string }> {
  const email = normalizeSubscriptionEmail(input.email);
  if (!email) throw new Error('A valid email address is required.');
  const priceId = grimoireSubscriptionPriceId(env);
  if (!priceId) {
    throw new Error('Card subscription is not available yet.');
  }
  const session = await client.checkout.sessions.create(
    buildSubscriptionSessionParams({
      email,
      priceId,
      successUrl: `${input.origin}/grimoire/subscribe?subscription=success`,
      cancelUrl: `${input.origin}/grimoire/subscribe?subscription=cancelled`,
    }),
  );
  const url = (session as { url?: string | null }).url;
  if (!url) {
    throw new Error(
      'Stripe did not return a checkout URL for the subscription session.',
    );
  }
  return { id: session.id, url };
}

/* ------------------------------------------------------------------ */
/* Customer Portal                                                     */
/* ------------------------------------------------------------------ */

/** True when a billing-portal session could be created at all. */
export function billingPortalAvailable(
  env: Record<string, string | undefined> = process.env,
): boolean {
  // The portal needs only the secret key; whether it is enabled in
  // the Stripe dashboard is Stripe-side configuration — a failure to
  // create a session surfaces as an honest error at call time.
  return Boolean(getStripeConfig(env).secretKey);
}

export async function createBillingPortalSession(
  input: { stripeCustomerId: string; origin: string },
  client: StripeClientLike,
): Promise<{ id: string; url: string }> {
  if (!input.stripeCustomerId) {
    throw new Error('This membership has no Stripe customer to manage.');
  }
  if (!client.billingPortal) {
    throw new Error('The Stripe Customer Portal is not available right now.');
  }
  const session = await client.billingPortal.sessions.create({
    customer: input.stripeCustomerId,
    return_url: `${input.origin}/account`,
  });
  if (!session.url) {
    throw new Error('Stripe did not return a portal URL.');
  }
  return { id: session.id, url: session.url };
}
