/**
 * AwakenPay — the branded payment layer for AwakenAgain.com
 * (owner directive 2026-11-07: "everywhere my checkout works on
 * awakenagain.com finish creating the copy of Stripe in my brand so
 * I may use it").
 *
 * AwakenPay is Amber's brand over the payment rails this site already
 * runs: the emailed Bluevine invoice (ACH bank transfer or check),
 * Venmo, and Cash App — plus, as of this directive, CARD payment
 * through the site's embedded Stripe checkout (lib/payments/
 * stripe.ts), completed and presented under the AwakenPay brand.
 *
 * AwakenPay is a BRANDED ORCHESTRATION layer, never a fake
 * processor: card payments are processed by Stripe, the disclosed
 * licensed processor underneath (the disclosure copy lives in
 * AWAKENPAY_CARD_DISCLOSURE and is rendered wherever the card option
 * appears). Underwriting and custody stay with the providers; card
 * data only ever touches Stripe (hosted / embedded Stripe surfaces),
 * never this site's code or database.
 *
 * FAIL-CLOSED GATING (mirrors the AwakenFlow stripe.js provider
 * pattern): the card option exists ONLY when the Stripe keys are
 * present, well-shaped (sk_/pk_ prefixes), and mode-consistent (a
 * test secret with a live publishable key — or vice versa — is a
 * misconfiguration, not a mode). Absent, partial, or malformed
 * configuration is identically "not available": every AwakenPay card
 * surface reports itself unavailable and the invoice / Venmo /
 * Cash App rails work untouched. The MODE (test vs live) is derived
 * from the secret key's prefix only — never stored, never set by
 * hand — and surfaces render a visible TEST MODE indicator whenever
 * the configured keys are test keys.
 *
 * This module reads key VALUES only to classify their shape/prefix;
 * values are never returned, logged, serialized, or stored. The
 * publishable key is exposed to clients only through the existing
 * session route (it is a public key by design).
 */
import { getStripeConfig } from './stripe';

export {
  AWAKENPAY_BRAND,
  AWAKENPAY_CARD_METHOD,
  AWAKENPAY_CARD_DISCLOSURE,
  AWAKENPAY_TEST_MODE_LABEL,
} from './awakenpay-brand';

export type AwakenPayMode = 'test' | 'live';

export interface AwakenPayState {
  /**
   * True only when the card rail may be offered: secret + publishable
   * keys present, well-shaped, and mode-consistent (fail closed).
   */
  cardAvailable: boolean;
  /** Derived from the secret key prefix; null when not available. */
  mode: AwakenPayMode | null;
  /** True when the configured keys are Stripe test keys. */
  testMode: boolean;
  /** 'TEST MODE' | 'LIVE MODE' | null — safe to render/log. */
  modeLabel: string | null;
  /** The webhook can verify events (secret + webhook secret shaped). */
  webhookConfigured: boolean;
}

function keyMode(key: string | undefined, prefix: 'sk' | 'pk'): AwakenPayMode | null {
  if (!key) return null;
  if (key.startsWith(`${prefix}_test_`)) return 'test';
  if (key.startsWith(`${prefix}_live_`)) return 'live';
  return null;
}

/**
 * The AwakenPay state for an environment. Pure and synchronous; the
 * single gate every card surface (checkout UI availability, order
 * parser, session route, Grimoire flows) consults.
 */
export function getAwakenPayState(
  env: Record<string, string | undefined> = process.env,
): AwakenPayState {
  const config = getStripeConfig(env);
  const secretMode = keyMode(config.secretKey, 'sk');
  const publishableMode = keyMode(config.publishableKey, 'pk');
  const webhookShaped =
    typeof config.webhookSecret === 'string' &&
    config.webhookSecret.startsWith('whsec_');
  // Mode consistency is part of "configured": a test secret beside a
  // live publishable key (or the reverse) fails closed, identically
  // to missing keys.
  const cardAvailable =
    config.cardAvailable &&
    secretMode !== null &&
    publishableMode !== null &&
    secretMode === publishableMode;
  const mode = cardAvailable ? secretMode : null;
  return {
    cardAvailable,
    mode,
    testMode: mode === 'test',
    modeLabel: mode === 'live' ? 'LIVE MODE' : mode === 'test' ? 'TEST MODE' : null,
    webhookConfigured: Boolean(config.secretKey) && secretMode !== null && webhookShaped,
  };
}
