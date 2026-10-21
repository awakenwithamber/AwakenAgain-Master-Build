/**
 * Checkout form — client component.
 * The browser sends the cart contents + customer details + its PREVIEW total.
 * The server Route Handler recomputes every total from canonical data and
 * rejects any mismatch (CLIENT=PREVIEW, SERVER=AUTHORITY).
 *
 * Payments (owner decisions 2026-10-13 + 2026-10-19): card through the
 * embedded Stripe checkout on this page (primary card path — the order
 * is recorded first, unpaid; a session is bound to it; only the
 * signature-verified webhook marks it paid), card via an emailed Bookipi
 * invoice (backup), or Cash App $AmberPatten347 / Venmo @AwakenwithAmber.
 * The customer picks the method here; the server records it on the order
 * and returns the matching payment instructions; this UI renders exactly
 * what the server returned. When Stripe is not configured, the card
 * option says so and steers to invoice / Venmo / Cash App.
 * No PII in analytics — order_completed carries order_id/total/item count only.
 */
'use client';

import { useEffect, useState } from 'react';
import { formatPrice } from '../../lib/pricing/pricing';
import { CASH_APP_HANDLE, VENMO_HANDLE } from '../../lib/checkout/order';
import { track, trackOnce } from '../../lib/analytics/posthog';
import { ANALYTICS_EVENT_NAMES } from '../../lib/analytics/events';
import { useCart, cartItemTitle } from './cart-store';
import { StripeEmbeddedCheckout } from './StripeEmbeddedCheckout';
import { previewCartTotals, FREE_SHIPPING_GENERAL_CENTS } from './cart-preview';
import type { CartItem } from '../../types';

type PaymentMethodChoice =
  | 'cash_app_or_venmo'
  | 'bookipi_card_invoice'
  | 'stripe_card_embedded';

/**
 * Payment instructions as returned by the server for the method recorded
 * on the order: handles for Cash App / Venmo, invoice destination for
 * card-by-Bookipi. Rendered from the response, never from local state.
 */
interface PaymentInstructions {
  method: string;
  cash_app?: string;
  venmo?: string;
  invoice_email?: string;
  order_id?: string;
  note: string;
}

interface OrderResponse {
  ok: boolean;
  order_id?: string;
  total_cents?: number;
  subtotal_cents?: number;
  subscriber_discount_cents?: number;
  is_subscriber_verified?: boolean;
  shipping_status?: string;
  payment_method?: string;
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
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodChoice>('stripe_card_embedded');
  /** null = not checked yet; false = card unavailable (degrade + steer). */
  const [cardAvailable, setCardAvailable] = useState<boolean | null>(null);
  const [stripeSession, setStripeSession] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OrderResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Card availability is a server fact (env-gated): ask once on mount.
  // Unavailable → the card option explains itself and the selection
  // falls back to Cash App / Venmo so the rest of checkout just works.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/stripe/checkout-session');
        const data = (await res.json()) as { card_available?: boolean };
        if (cancelled) return;
        const available = data.card_available === true;
        setCardAvailable(available);
        if (!available) {
          setPaymentMethod((current) =>
            current === 'stripe_card_embedded'
              ? 'cash_app_or_venmo'
              : current,
          );
        }
      } catch {
        if (!cancelled) setCardAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        payment_method: paymentMethod,
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
        // Card orders: bind the embedded Stripe session to the order the
        // server just persisted (server totals only — no amounts here).
        if (paymentMethod === 'stripe_card_embedded' && data.order_id) {
          try {
            const sessionRes = await fetch('/api/stripe/checkout-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: data.order_id,
                email: email.trim(),
              }),
            });
            const sessionData = (await sessionRes.json()) as {
              ok?: boolean;
              client_secret?: string;
              publishable_key?: string;
              errors?: string[];
            };
            if (
              sessionRes.ok &&
              sessionData.ok &&
              sessionData.client_secret &&
              sessionData.publishable_key
            ) {
              setStripeSession({
                clientSecret: sessionData.client_secret,
                publishableKey: sessionData.publishable_key,
              });
            } else {
              setStripeError(
                sessionData.errors?.join(' ') ??
                  'Card payment could not be started. You can pay by invoice, Venmo, or Cash App instead.',
              );
            }
          } catch {
            setStripeError(
              'Card payment could not be started. You can pay by invoice, Venmo, or Cash App instead.',
            );
          }
        }
        // Client-side: the customer saw the confirmation + the payment
        // instructions for their chosen method. The authoritative order event (order_created) is
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
          {(result.payment?.method ?? result.payment_method) ===
          'stripe_card_embedded' ? (
            stripeSession ? (
              <StripeEmbeddedCheckout
                publishableKey={stripeSession.publishableKey}
                clientSecret={stripeSession.clientSecret}
              />
            ) : stripeError ? (
              <>
                <p role="alert">{stripeError}</p>
                <p>
                  Your order is saved. You can pay instead by emailed
                  Bookipi invoice (just contact Amber and mention your
                  order ID), or send your total now:
                </p>
                <ul>
                  <li>
                    <strong>Cash App:</strong> {CASH_APP_HANDLE}
                  </li>
                  <li>
                    <strong>Venmo:</strong> {VENMO_HANDLE}
                  </li>
                </ul>
              </>
            ) : (
              <p>Preparing your secure card payment…</p>
            )
          ) : (result.payment?.method ?? result.payment_method) ===
            'bookipi_card_invoice' ? (
            <p>
              Your Bookipi invoice will be sent to:{' '}
              <strong>{result.payment?.invoice_email}</strong>
            </p>
          ) : (
            <ul>
              <li>
                <strong>Cash App:</strong> {result.payment?.cash_app}
              </li>
              <li>
                <strong>Venmo:</strong> {result.payment?.venmo}
              </li>
            </ul>
          )}
          {(result.subscriber_discount_cents ?? 0) > 0 ? (
            <p>
              Living Grimoire of Light & Magic subscriber discount (10%): −
              {formatPrice(result.subscriber_discount_cents ?? 0)}
            </p>
          ) : null}
          <p>
            Amount: <strong>{formatPrice(result.total_cents ?? 0)}</strong>
            {(result.payment?.method ?? result.payment_method) ===
            'stripe_card_embedded' ? (
              <small>
                {' '}
                — plus sales tax, calculated from your shipping address in
                the card form below.
              </small>
            ) : null}
          </p>
          <p>
            Order ID: <strong>{result.order_id}</strong>
            {(result.payment?.method ?? result.payment_method) ===
            'bookipi_card_invoice'
              ? ' — it will appear on your invoice.'
              : (result.payment?.method ?? result.payment_method) ===
                  'stripe_card_embedded'
                ? ' — your payment confirmation will show here as soon as it is confirmed.'
                : ' — please include this in your payment note so we can match it to your order.'}
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
              {preview.subscriberDiscountCents > 0 ? (
                <p>
                  Living Grimoire of Light & Magic subscriber discount (10%): −
                  {formatPrice(preview.subscriberDiscountCents)}{' '}
                  <small>
                    (applied when your membership is confirmed — the server
                    verifies subscriber status when you place your order)
                  </small>
                </p>
              ) : null}
              <p>
                Shipping:{' '}
                {preview.shippingStatus === 'FREE'
                  ? isSubscriber
                    ? 'Free — Living Grimoire of Light & Magic subscribers always ship free.'
                    : `Free — shipping is free on orders of ${formatPrice(preview.freeShippingThresholdCents)} or more.`
                  : `${formatPrice(preview.shippingCents)} — flat standard shipping, included in the total below. Shipping is free on orders of ${formatPrice(FREE_SHIPPING_GENERAL_CENTS)} or more, and always free for Living Grimoire of Light & Magic subscribers.`}
              </p>
              <p>
                <strong>Total: {formatPrice(preview.totalCents)}</strong> (preview —
                the server recomputes this when you place your order)
              </p>
              {paymentMethod === 'stripe_card_embedded' ? (
                <p>
                  <small>
                    Paying by card: sales tax is calculated at payment from
                    your shipping address (via Stripe Tax) and added to
                    this total in the secure card form — it is not included
                    in the preview above.
                  </small>
                </p>
              ) : null}
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
                I&apos;m a Living Grimoire of Light & Magic subscriber (always free shipping)
              </label>
              <p>
                <small>
                  We verify subscriber status against our membership records
                  when you place your order. Free shipping and the 10%
                  subscriber discount apply once your membership payment has
                  been confirmed by Amber.
                </small>
              </p>
              <label>
                Notes for Amber (optional)
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </section>

            <section aria-label="Payment method">
              <h2>How you&apos;d like to pay</h2>
              <label>
                <input
                  type="radio"
                  name="payment-method"
                  value="stripe_card_embedded"
                  checked={paymentMethod === 'stripe_card_embedded'}
                  disabled={cardAvailable === false}
                  onChange={() => setPaymentMethod('stripe_card_embedded')}
                />
                <strong>Credit or debit card</strong> — pay securely right
                here on this page. Your order is placed first, then you
                complete payment without leaving the site.
              </label>
              {cardAvailable === false ? (
                <p>
                  <small>
                    Card checkout is not available right now — please pay
                    by invoice, Venmo, or Cash App below; those work as
                    always.
                  </small>
                </p>
              ) : null}
              <label>
                <input
                  type="radio"
                  name="payment-method"
                  value="bookipi_card_invoice"
                  checked={paymentMethod === 'bookipi_card_invoice'}
                  onChange={() => setPaymentMethod('bookipi_card_invoice')}
                />
                <strong>Pay by invoice instead</strong> — place your order
                now, and we&apos;ll email you a secure Bookipi invoice to
                pay by card. Your order is prepared once the invoice is
                paid.
              </label>
              <label>
                <input
                  type="radio"
                  name="payment-method"
                  value="cash_app_or_venmo"
                  checked={paymentMethod === 'cash_app_or_venmo'}
                  onChange={() => setPaymentMethod('cash_app_or_venmo')}
                />
                <strong>Cash App or Venmo</strong> — place your order now, and
                we&apos;ll show you the payment handles and your order ID
                right after.
              </label>
            </section>

            {formError ? <p role="alert">{formError}</p> : null}
            <button
              type="button"
              className="btn-primary"
              onClick={placeOrder}
              disabled={submitting || empty}
            >
              {submitting ? 'Placing your order…' : '✦ Place your order'}
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
                Payment is by card right here on this page, Cash App,
                Venmo, or card by emailed Bookipi invoice — you&apos;ll get
                the payment details for your chosen method, and your order
                ID, right after placing your order.
              </small>
            </p>
          </>
        )}
      </main>
    </>
  );
}
