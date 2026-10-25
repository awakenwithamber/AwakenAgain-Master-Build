/**
 * Checkout form — client component.
 * The browser sends the cart contents + customer details + its PREVIEW total.
 * The server Route Handler recomputes every total from canonical data and
 * rejects any mismatch (CLIENT=PREVIEW, SERVER=AUTHORITY).
 *
 * Payments (owner directive 2026-10-24, superseding the card flow of
 * 2026-10-19/21): the customer pays by EMAILED INVOICE (Bookipi) — the
 * invoice is paid by ACH bank transfer to Bluevine, Venmo
 * @AwakenwithAmber, or Cash App $AmberPatten347, with the order number
 * as the payment reference, and the order is prepared once payment is
 * confirmed — or sends Cash App / Venmo directly after ordering. The
 * customer picks the method here; the server records it on the order
 * and returns the matching payment instructions; this UI renders
 * exactly what the server returned. No card payment is offered: the
 * Stripe embedded checkout is PARKED DORMANT (its component, routes,
 * and webhook remain in the tree, unreachable from this UI).
 * No PII in analytics — order_completed carries order_id/total/item count only.
 */
'use client';

import { useState } from 'react';
import { formatPrice } from '../../lib/pricing/pricing';
import { CASH_APP_HANDLE, VENMO_HANDLE } from '../../lib/checkout/order';
import { track, trackOnce } from '../../lib/analytics/posthog';
import { ANALYTICS_EVENT_NAMES } from '../../lib/analytics/events';
import { useCart, cartItemTitle } from './cart-store';
import { previewCartTotals, FREE_SHIPPING_GENERAL_CENTS } from './cart-preview';
import type { CartItem } from '../../types';

type PaymentMethodChoice = 'bookipi_invoice' | 'cash_app_or_venmo';

/**
 * Payment instructions as returned by the server for the method recorded
 * on the order: handles plus the order id for the invoice and direct
 * handle methods. Rendered from the response, never from local state.
 */
interface PaymentInstructions {
  method: string;
  cash_app?: string;
  venmo?: string;
  order_id?: string;
  note: string;
}

interface OrderResponse {
  ok: boolean;
  order_id?: string;
  total_cents?: number;
  subtotal_cents?: number;
  subscriber_discount_cents?: number;
  coupon_code?: string | null;
  coupon_discount_cents?: number;
  coupon_message?: string;
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
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodChoice>('bookipi_invoice');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OrderResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (!loaded) return <p>Loading checkout…</p>;

  const preview = previewCartTotals(items, bundle, isSubscriber, appliedCoupon);
  const empty = items.length === 0 && !bundle;

  /**
   * Apply a coupon code to the PREVIEW. The server re-validates the
   * code + first-time eligibility authoritatively when the order is
   * placed — an unknown or ineligible code comes back as a friendly
   * error and no order is recorded.
   */
  const applyCoupon = () => {
    const normalized = couponInput.trim().toUpperCase();
    if (!normalized) {
      setCouponError('Enter a coupon code first.');
      return;
    }
    if (normalized !== 'FIRST10') {
      setAppliedCoupon(null);
      setCouponError(
        "That coupon code doesn't look right — please check the code and try again.",
      );
      return;
    }
    setCouponError(null);
    setAppliedCoupon(normalized);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

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
        ...(appliedCoupon ? { coupon_code: appliedCoupon } : {}),
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
    const method = result.payment?.method ?? result.payment_method;
    return (
      <main>
        <h1>Order received ✨</h1>
        <p>
          Thank you, {name.split(' ')[0] || 'friend'} — your order is recorded.
        </p>
        <section aria-label="Payment instructions">
          <h2>Complete your payment</h2>
          <p>{result.payment?.note}</p>
          {method === 'bookipi_invoice' ? (
            <>
              <p>
                Your invoice will arrive by email. You can pay it any of
                these ways — please use your order number as the payment
                reference:
              </p>
              <ul>
                <li>
                  <strong>ACH bank transfer</strong> — to our Bluevine
                  account (the invoice shows the details)
                </li>
                <li>
                  <strong>Venmo:</strong> {result.payment?.venmo}
                </li>
                <li>
                  <strong>Cash App:</strong> {result.payment?.cash_app}
                </li>
              </ul>
              <p>
                Your order is prepared once your payment is confirmed.
              </p>
            </>
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
          {(result.coupon_discount_cents ?? 0) > 0 ? (
            <p>
              Coupon {result.coupon_code ?? 'FIRST10'} discount (10%): −
              {formatPrice(result.coupon_discount_cents ?? 0)}
            </p>
          ) : null}
          {result.coupon_message ? <p>{result.coupon_message}</p> : null}
          <p>
            Amount: <strong>{formatPrice(result.total_cents ?? 0)}</strong>
          </p>
          <p>
            Order ID: <strong>{result.order_id}</strong>
            {' — please include this in your payment note or reference so we can match it to your order.'}
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
              {preview.couponDiscountCents > 0 ? (
                <p>
                  Coupon {preview.couponCode} discount (10%): −
                  {formatPrice(preview.couponDiscountCents)}{' '}
                  <small>
                    (first-time customers only — the server confirms
                    eligibility when you place your order)
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
            </section>

            <section
              aria-label="Coupon code"
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
                ✦ Coupon code
              </h2>
              {appliedCoupon ? (
                <>
                  <p style={{ margin: '0 0 0.5rem' }}>
                    <strong>{appliedCoupon}</strong> applied — 10% off your
                    products.{' '}
                    <small>
                      (First-time customers, once per customer. The server
                      confirms eligibility when you place your order;
                      shipping isn&apos;t discounted, and the coupon
                      can&apos;t be combined with the subscriber discount.)
                    </small>
                  </p>
                  <button type="button" onClick={removeCoupon}>
                    Remove coupon
                  </button>
                </>
              ) : (
                <>
                  <label>
                    Coupon code
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      autoComplete="off"
                      placeholder="FIRST10"
                    />
                  </label>{' '}
                  <button type="button" onClick={applyCoupon}>
                    Apply
                  </button>
                  <p style={{ margin: '0.5rem 0 0' }}>
                    <small>
                      First order? Use <strong>FIRST10</strong> for 10% off
                      your products — first-time customers only, once per
                      customer.
                    </small>
                  </p>
                </>
              )}
              {couponError ? (
                <p role="alert" style={{ margin: '0.5rem 0 0' }}>
                  {couponError}
                </p>
              ) : null}
              {appliedCoupon && isSubscriber ? (
                <p style={{ margin: '0.5rem 0 0' }}>
                  <small>
                    You&apos;ve also claimed the subscriber discount —
                    coupons can&apos;t be combined with it, so the server
                    will apply the larger single discount and let you know.
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
                  value="bookipi_invoice"
                  checked={paymentMethod === 'bookipi_invoice'}
                  onChange={() => setPaymentMethod('bookipi_invoice')}
                />
                <strong>Pay by invoice</strong> — place your order now and
                we&apos;ll email you an invoice. Pay it by ACH bank
                transfer to Bluevine, or with Venmo or Cash App, using
                your order number as the reference. Your order is
                prepared once payment is confirmed.
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
                Payment is by emailed invoice, or with Cash App or Venmo
                — you&apos;ll get the payment details for your chosen
                method, and your order ID, right after placing your
                order.
              </small>
            </p>
          </>
        )}
      </main>
    </>
  );
}
