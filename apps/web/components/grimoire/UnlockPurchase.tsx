'use client';

/**
 * PERMANENT_UNLOCK purchase panel (Stage 2) — CLIENT.
 *
 * Shows the unlock offer with its full pre-purchase terms (owner
 * decision 2026-10-21 §13(2)): $8.88 one-time, scope = the Living
 * Grimoire — 333-page edition plus all future chapters/revisions of
 * this edition (separate future editions/add-ons not included), no
 * renewal, and a refund/chargeback revokes access.
 *
 * Availability is decided by the SERVER (prop, from
 * grimoireUnlockCheckoutAvailable): when checkout is not configured,
 * the panel says so plainly and offers NO purchase button — never a
 * fake checkout. When available, the button POSTs the buyer's email
 * to /api/grimoire-unlock/checkout and follows Stripe's hosted
 * checkout URL. Paying grants nothing by itself: the entitlement is
 * written by the signature-verified webhook on completion.
 */
import { useCallback, useState } from 'react';
import {
  GRIMOIRE_EDITION_NAME,
  GRIMOIRE_UNLOCK_SCOPE,
} from '../../lib/grimoire/edition';

interface UnlockPurchaseProps {
  /** Server-decided: a real Stripe checkout can be created. */
  available: boolean;
}

export function UnlockPurchase({ available }: UnlockPurchaseProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onBuy = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch('/api/grimoire-unlock/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = (await response.json()) as {
          ok: boolean;
          errors?: string[];
          url?: string;
        };
        if (!response.ok || !data.ok || !data.url) {
          throw new Error(data.errors?.[0] ?? 'Could not start checkout.');
        }
        window.location.assign(data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start checkout.');
        setBusy(false);
      }
    },
    [busy, email],
  );

  return (
    <section aria-labelledby="grimoire-unlock-heading">
      <h2 id="grimoire-unlock-heading">
        Permanent unlock — $8.88 one-time ({GRIMOIRE_EDITION_NAME})
      </h2>
      <p>
        <strong>Price:</strong> $8.88, charged once. No renewal, no
        subscription.
      </p>
      <p>
        <strong>Scope:</strong> {GRIMOIRE_UNLOCK_SCOPE}
      </p>
      <p>
        <strong>Terms:</strong> access is tied to the email you check out
        with and is granted when Stripe confirms your payment. If the
        payment is refunded or charged back, the unlock is revoked.
        Permanent rights are yours even if you later subscribe and
        cancel — subscribing never removes them.
      </p>
      {available ? (
        <form onSubmit={onBuy} aria-label="Buy the permanent Grimoire unlock">
          <div>
            <label htmlFor="unlock-email">Email for your unlock</label>
            <input
              id="unlock-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" disabled={busy}>
            {busy ? 'Opening checkout…' : 'Unlock permanently — $8.88'}
          </button>
          {error ? <p role="alert">{error}</p> : null}
        </form>
      ) : (
        <p role="note">
          The permanent unlock is <strong>not yet purchasable</strong> —
          its checkout has not been switched on. The subscription below
          works today, and this panel will offer the real checkout as
          soon as it is live.
        </p>
      )}
    </section>
  );
}
