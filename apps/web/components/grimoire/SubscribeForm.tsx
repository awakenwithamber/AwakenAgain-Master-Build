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
 * customer details → POST /api/subscriptions → Cash App/Venmo payment
 * instructions for the first month. The manual rail is the ONLY rail
 * (Phase 2, 2026-10-30; decision packet 2026-10-24): memberships are
 * confirmed personally by Amber, and members send each month's
 * payment to stay active. The parked card checkout is not offered,
 * described, or linked from this form.
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

export function SubscribeForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const startedTracked = useRef(false);

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
            <strong>$7.77/month.</strong> You send each month&apos;s
            payment yourself — there is no automatic card charge.
          </li>
          <li>
            <strong>Cancel anytime</strong> — just contact Amber. On
            cancellation, access continues through the paid period.
          </li>
          <li>
            Full access lasts while your subscription is active. If a
            month&apos;s payment isn&apos;t made, the book locks
            again — the first 17 pages always stay free to read.
          </li>
          <li>
            Amber confirms every subscription personally once your
            first payment arrives.
          </li>
        </ul>
      </div>
      <h3>Join with Cash App or Venmo</h3>
      <p>
        You can also ask for an emailed invoice instead — just email
        Amber after signing up, and pay the invoice by ACH bank
        transfer, Venmo, or Cash App.
      </p>
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
          How membership works: you pay with Cash App or Venmo (or an
          emailed invoice) after signup — Amber confirms every
          subscription personally, and you send $7.77 each month to stay
          active. Nothing is ever charged automatically.
        </small>
      </p>
    </section>
  );
}
