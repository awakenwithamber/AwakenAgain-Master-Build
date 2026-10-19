/**
 * Embedded Stripe Checkout — client component (owner directive
 * 2026-10-19). Renders Stripe's embedded payment form on this page with
 * the client secret of the session the server bound to the persisted
 * order. Card data only ever touches Stripe; completion returns the
 * customer to /checkout/return, and the order is marked paid ONLY by
 * the signature-verified webhook — never by this component.
 */
'use client';

import { useMemo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js';

export function StripeEmbeddedCheckout({
  publishableKey,
  clientSecret,
}: {
  publishableKey: string;
  clientSecret: string;
}) {
  const stripePromise = useMemo(
    () => loadStripe(publishableKey),
    [publishableKey],
  );
  return (
    <div id="stripe-embedded-checkout">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ clientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
