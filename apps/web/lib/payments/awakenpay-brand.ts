/**
 * AwakenPay brand constants — CLIENT-SAFE (no imports, no env, no
 * server code). The server-side gating state lives in
 * lib/payments/awakenpay.ts; this module exists so client components
 * can carry the brand + disclosure without importing the Stripe
 * server stack.
 *
 * AwakenPay (owner directive 2026-11-07) is Amber's branded payment
 * layer over the rails this site runs — Bluevine invoice, Venmo,
 * Cash App, and card payment processed by Stripe underneath the
 * brand. It is an orchestration/brand layer, never a fake processor:
 * the disclosure below names Stripe wherever the card option appears.
 */

/** The customer-facing brand name for this site's payment layer. */
export const AWAKENPAY_BRAND = 'AwakenPay';

/**
 * The stored payment-method value of the AwakenPay card rail. The
 * rail was built as 'stripe_card_embedded' (the embedded Stripe
 * checkout) and historical order records carry it; the value is
 * unchanged so every stored record, webhook join, and paid-state
 * resolver keeps working. Customers never see the value — they see
 * the AwakenPay brand.
 */
export const AWAKENPAY_CARD_METHOD = 'stripe_card_embedded' as const;

/**
 * Small-print processor disclosure, rendered wherever the AwakenPay
 * card option is offered (owner rule: Stripe stays the disclosed
 * processor underneath the brand).
 */
export const AWAKENPAY_CARD_DISCLOSURE =
  'Card payments are processed securely by Stripe through AwakenPay. ' +
  'Your card details go directly to Stripe — they never touch this site.';

/** The visible indicator rendered on card surfaces in test mode. */
export const AWAKENPAY_TEST_MODE_LABEL = 'TEST MODE';
