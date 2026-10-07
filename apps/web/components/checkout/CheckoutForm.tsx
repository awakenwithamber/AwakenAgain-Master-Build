/**
 * Checkout form — client component.
 * The browser sends the cart contents + customer details + its PREVIEW total.
 * The server Route Handler recomputes every total from canonical data and
 * rejects any mismatch (CLIENT=PREVIEW, SERVER=AUTHORITY).
 *
 * Payments: Cash App $AmberPatten347 + Venmo @AwakenwithAmber ONLY. The
 * server returns the payment instructions; this UI renders exactly them.
 * No PII in analytics — order_completed carries order_id/total/item count only.
 */
'use client';

import { useState } from 'react';
import { formatPrice } from '../../lib/pricing/pricing';
import { CASH_APP_HANDLE, VENMO_HANDLE } from '../../lib/checkout/order';
import { track, trackOnce } from '../../lib/analytics/posthog';
import { ANALYTICS_EVENT_NAMES } from '../../lib/analytics/events';
import { SiteHeader } from '../shop/SiteHeader';
import { useCart, cartItemTitle } from './cart-store';
import { previewCartTotals } from './cart-preview';
import type { CartItem } from '../../types';

interface PaymentInstructions {
  cash_app: string;
  venmo: string;
  note: string;
}

interface OrderResponse {
  ok: boolean;
  order_id?: string;
  total_cents?: number;
  subtotal_cents?: number;
  shipping_status?: string;
  payment?: PaymentInstructions;
  message?: string;
  errors?: string[];
}

export function CheckoutForm() {
  const { items, bundle, loaded, clear } = useCart();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OrderResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (!loaded) return <p>Loading checkout…</p>;

  const preview = previewCartTotals(items, bundle, isSubscriber);
  const empty = items.length === 0 && !bundle;

  const placeOrder = async () => {
    setFormError(null);
    setResult(null);
    if (!name.trim() || !email.trim()) {
      setFormError('Please provide your name and email so we can confirm your order.');
      return;
    }
    setSubmitting(true);
    track(ANALYTICS_EVENT_NAMES.checkoutInitiated, {});
    try {
      const payload = {
        items: items.map((item: CartItem) => ({
          product_handle: item.product_handle,
          variant_id: item.variant_id,
          quantity: item.quantity,
          customization: item.customization,
          formula: item.formula,
          unit_price_cents: item.unit_price_cents,
        })),
        bundle,
        customer: { name: name.trim(), email: email.trim(), phone: phone.trim(), notes: notes.trim() },
        is_subscriber: isSubscriber,
        client_total_cents: preview.totalCents,
      };
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as OrderResponse;
      if (res.ok && data.ok) {
        setResult(data);
        clear();
        // Client-side: the customer saw the confirmation + Cash App/Venmo
        // instructions. The authoritative order event (order_created) is
        // emitted server-side by the checkout Route Handler — this client
        // event answers "instructions were shown", not "order was accepted".
        track(ANALYTICS_EVENT_NAMES.orderCompleted, {
          order_id: data.order_id ?? 'unknown',
          total_cents: data.total_cents ?? 0,
          item_count: items.length + (bundle ? 5 : 0),
        });
        trackOnce(
          `payment_instructions_viewed_${data.order_id ?? 'unknown'}`,
          ANALYTICS_EVENT_NAMES.paymentInstructionsViewed,
          { order_id: data.order_id ?? 'unknown' },
        );
      } else {
        setFormError(
          data.errors?.join(' ') ??
            data.message ??
            'Something went wrong placing your order. Please try again.',
        );
      }
    } catch {
      setFormError('Could not reach the checkout server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result?.ok) {
    return (
      <main>
        <h1>Order received ✨</h1>
        <p>
          Thank you, {name.split(' ')[0] || 'friend'} — your order is recorded.
        </p>
        <section aria-label="Payment instructions">
          <h2>Complete your payment</h2>
          <p>{result.payment?.note}</p>
          <ul>
            <li>
              <strong>Cash App:</strong> {result.payment?.cash_app}
            </li>
            <li>
              <strong>Venmo:</strong> {result.payment?.venmo}
            </li>
          </ul>
          <p>
            Amount: <strong>{formatPrice(result.total_cents ?? 0)}</strong>
          </p>
          <p>
            Order ID: <strong>{result.order_id}</strong> — please include this
            in your payment note so we can match it to your order.
          </p>
          <p>
            <small>
              Amber confirms every order personally before fulfillment — watch
              your email for confirmation.
            </small>
          </p>
        </section>
        <p>
          <a href="/shop">Continue shopping</a>
        </p>
      </main>
    );
  }

  return (
    <>
      <SiteHeader />
      <main>
        <h1>Checkout</h1>
        {empty ? (
          <p>
            Your cart is empty. <a href="/shop">Browse the shop</a>
          </p>
        ) : (
          <>
            <section aria-label="Order preview">
              <h2>Your order (preview)</h2>
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    {cartItemTitle(item.product_handle, item.variant_id)} — {formatPrice(item.unit_price_cents)} ×{' '}
                    {item.quantity} = {formatPrice(item.unit_price_cents * item.quantity)}
                  </li>
                ))}
                {bundle ? <li>The Alchemy Soap Collection (5 soaps)</li> : null}
              </ul>
              <p>Subtotal: {formatPrice(preview.subtotalCents)}</p>
              <p>
                Shipping:{' '}
                {preview.shippingStatus === 'FREE'
                  ? `Free (over ${formatPrice(preview.freeShippingThresholdCents)})`
                  : 'To be confirmed — no shipping charge added to this order; we confirm with you before fulfillment.'}
              </p>
              <p>
                <strong>Total: {formatPrice(preview.totalCents)}</strong> (preview —
                the server recomputes this when you place your order)
              </p>
            </section>

            <section aria-label="Your details">
              <h2>Your details</h2>
              <label>
                Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label>
                Phone (optional)
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={isSubscriber}
                  onChange={(e) => setIsSubscriber(e.target.checked)}
                />
                I&apos;m a Living Grimoire subscriber ($75 free-shipping threshold)
              </label>
              <p>
                <small>
                  Subscriber status is self-reported at checkout; membership
                  verification is not yet built (NEEDS_VERIFICATION). Subscriber
                  discount pricing is applied after membership is confirmed.
                </small>
              </p>
              <label>
                Notes for Amber (optional)
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </section>

            {formError ? <p role="alert">{formError}</p> : null}
            <button
              type="button"
              className="btn-primary"
              onClick={placeOrder}
              disabled={submitting}
            >
              {submitting ? 'Placing your order…' : '✦ Proceed to Secure Checkout'}
            </button>
            <section
              aria-label="Pay directly with Venmo or Cash App"
              style={{
                border: '1px solid var(--brass)',
                borderRadius: '0.75rem',
                padding: '1.25rem 1.5rem',
                marginTop: '1.75rem',
                background: 'rgba(42, 26, 64, 0.55)',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--brass-lt)',
                  fontSize: '1.1rem',
                  margin: '0 0 0.5rem',
                }}
              >
                ✦ Or Pay Directly
              </h2>
              <p style={{ margin: '0 0 0.75rem' }}>
                Prefer to pay first and have us match your order? Send your
                order total to either of these:
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.75rem' }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  <strong>Venmo:</strong> {VENMO_HANDLE}
                </li>
                <li>
                  <strong>Cash App:</strong> {CASH_APP_HANDLE}
                </li>
              </ul>
              <p style={{ margin: 0 }}>
                <small>
                  After payment, Amber will confirm your order via email.
                  Please include your name (and order ID if you have one) in
                  your payment note so we can match it.
                </small>
              </p>
            </section>
            <p>
              <small>
                Payment is by Cash App or Venmo — you&apos;ll get the payment
                details and your order ID right after placing your order.
              </small>
            </p>
          </>
        )}
      </main>
    </>
  );
}
