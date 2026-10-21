'use client';

/**
 * Living Grimoire subscription signup form (G1) — CLIENT.
 *
 * CLIENT = PREVIEW: this form shows the plan price from the canonical
 * price table (imported from lib/pricing — the same source the server
 * prices from) but the price displayed here never determines the
 * subscription record; the server rebuilds it authoritatively.
 *
 * Flow: plan summary (plan selection is the single $7.77/mo plan) →
 * customer details → either subscribe by card (Stripe Checkout in
 * subscription mode, when the server says it is available — Stage 3)
 * or POST /api/subscriptions → Cash App/Venmo payment instructions
 * for the first month (the manual fallback, owner-confirmed).
 *
 * Emits the client-owned event grimoire_subscribe_started exactly once per
 * form mount (user gesture-initiated; not on render). No PII in analytics.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GRIMOIRE_ANALYTICS_EVENT_NAMES,
  trackGrimoireEvent,
} from '../../lib/analytics/grimoire-events';
import { GRIMOIRE_PLAN, grimoirePlanPriceLabel } from '../../lib/subscriptions/subscriptions';

interface PaymentInstructions {
  cash_app: string;
  venmo: string;
  amount: string;
  note: string;
}

interface SuccessState {
  subscription_id: string;
  payment: PaymentInstructions;
}

interface SubscribeFormProps {
  /**
   * Server-decided: a real Stripe subscription checkout can be
   * created (Stripe keys + STRIPE_GRIMOIRE_PRICE_ID configured).
   * When false the card option is not offered at all — the manual
   * Cash App/Venmo path below is the way in, with no dead button.
   */
  stripeAvailable?: boolean;
}

export function SubscribeForm({ stripeAvailable = false }: SubscribeFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const startedTracked = useRef(false);

  const onSubscribeByCard = useCallback(async () => {
    if (cardBusy) return;
    setCardError(null);
    if (!email.trim()) {
      setCardError('Enter your email above first — your membership is tied to it.');
      return;
    }
    setCardBusy(true);
    try {
      const response = await fetch('/api/subscriptions/stripe-checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        errors?: string[];
        url?: string;
      };
      if (!response.ok || !payload.ok || !payload.url) {
        throw new Error(payload.errors?.[0] ?? 'Could not start card checkout.');
      }
      window.location.assign(payload.url);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Could not start card checkout.');
      setCardBusy(false);
    }
  }, [cardBusy, email]);

  // Track form engagement once per mount — the user arrived at the signup
  // form (a real engagement signal), not on render spam.
  useEffect(() => {
    if (startedTracked.current) return;
    startedTracked.current = true;
    trackGrimoireEvent(GRIMOIRE_ANALYTICS_EVENT_NAMES.grimoireSubscribeStarted, {
      plan_id: GRIMOIRE_PLAN.id,
      price_cents: GRIMOIRE_PLAN.priceCents,
    });
  }, []);

  const onSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (status === 'submitting') return;
      setStatus('submitting');
      setError(null);
      try {
        const response = await fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
          }),
        });
        const payload = (await response.json()) as {
          ok: boolean;
          errors?: string[];
          subscription_id?: string;
          payment?: PaymentInstructions;
        };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.errors?.[0] ?? 'Signup could not be completed.');
        }
        setSuccess({
          subscription_id: payload.subscription_id ?? '',
          payment: payload.payment as PaymentInstructions,
        });
        setStatus('success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Signup could not be completed.');
        setStatus('error');
      }
    },
    [name, email, phone, status],
  );

  if (status === 'success' && success) {
    return (
      <section aria-labelledby="subscribe-success" aria-live="polite">
        <h2 id="subscribe-success">Welcome to the Living Grimoire of Light & Magic 🌿</h2>
        <p>
          Your subscription request is recorded as <strong>pending payment</strong>. Send your
          first month of <strong>{success.payment.amount}</strong> to complete it:
        </p>
        <ul>
          <li>
            <strong>Cash App:</strong> {success.payment.cash_app}
          </li>
          <li>
            <strong>Venmo:</strong> {success.payment.venmo}
          </li>
        </ul>
        <p>{success.payment.note}</p>
        <p>
          Reference: <code>{success.subscription_id}</code> — include it in your payment note so
          Amber can confirm your subscription.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="subscribe-heading">
      <h2 id="subscribe-heading">
        {GRIMOIRE_PLAN.name} — {grimoirePlanPriceLabel()}
      </h2>
      <p>One plan, everything included:</p>
      <ul>
        {GRIMOIRE_PLAN.benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      <div aria-label="Subscription terms">
        <h3>Before you subscribe</h3>
        <ul>
          <li>
            <strong>$7.77/month.</strong> By card, your subscription
            auto-renews monthly by card until you cancel.
          </li>
          <li>
            <strong>Cancel anytime</strong> — from your account page or
            the Stripe Customer Portal. On cancellation, access
            continues through the paid period.
          </li>
          <li>
            The separate <strong>$8.88 permanent unlock</strong> is
            unaffected by subscription cancellation — cancelling a
            subscription never removes an unlock you hold.
          </li>
          <li>
            Prefer not to use a card? Join manually with Cash App or
            Venmo below — Amber confirms every manual subscription
            personally, and manual members send each month&apos;s
            payment to stay active.
          </li>
        </ul>
      </div>
      {stripeAvailable ? (
        <div>
          <h3>Subscribe by card</h3>
          <p>
            Enter your email above, then continue to Stripe to subscribe
            by card — $7.77/month, auto-renews monthly by card, cancel
            anytime.
          </p>
          <button type="button" onClick={onSubscribeByCard} disabled={cardBusy}>
            {cardBusy ? 'Opening checkout…' : 'Subscribe by card — $7.77/month'}
          </button>
          {cardError ? <p role="alert">{cardError}</p> : null}
        </div>
      ) : (
        <p role="note">
          Card subscription is not switched on yet — join with Cash App
          or Venmo below today, and Amber will confirm your membership
          personally.
        </p>
      )}
      <h3>Join with Cash App or Venmo</h3>
      <form onSubmit={onSubmit} aria-label="Living Grimoire of Light & Magic signup">
        <div>
          <label htmlFor="sub-name">Name</label>
          <input
            id="sub-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="sub-email">Email</label>
          <input
            id="sub-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="sub-phone">Phone (optional — for payment confirmation)</label>
          <input
            id="sub-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        {status === 'error' && error ? (
          <p role="alert">{error}</p>
        ) : null}
        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Recording…' : `Start my subscription — ${grimoirePlanPriceLabel()}`}
        </button>
      </form>
      <p>
        <small>
          Manual path: you pay with Cash App or Venmo after signup — Amber
          confirms every manual subscription personally, and you send
          $7.77 each month to renew. Card subscriptions (above, when
          switched on) renew automatically instead.
        </small>
      </p>
    </section>
  );
}
