/**
 * Checkout form — client component.
 * The browser sends the cart contents + customer details + its PREVIEW total.
 * The server Route Handler recomputes every total from canonical data and
 * rejects any mismatch (CLIENT=PREVIEW, SERVER=AUTHORITY).
 *
 * Payments (owner directive 2026-11-01 — "Replace our checkout with
 * the bluevine set up", superseding the 2026-10-24 Bookipi flow):
 * the customer pays by EMAILED BLUEVINE INVOICE — the invoice is paid
 * by ACH bank transfer or check per the invoice, or Venmo
 * @AwakenwithAmber / Cash App $awakenagain333, with the order number
 * as the payment reference, and the order is prepared once payment is
 * confirmed — or sends Cash App / Venmo directly after ordering. A
 * card choice through Bluevine's hosted payment page renders ONLY
 * when the verified Bluevine payment link is configured
 * (bluevineCardConfigured); while it is not, no card wording appears
 * anywhere in this UI. The customer picks the method here; the server
 * records it on the order and returns the matching payment
 * instructions; this UI renders exactly what the server returned.
 * Sales tax + shipping (owner directive 2026-11-01): the form
 * collects a delivery address for every order; the preview's tax and
 * shipping lines come from the shared calculations (components/
 * checkout/cart-preview.ts, which imports the server's lib/tax
 * engine), and the amount due after ordering is the server's
 * tax-inclusive total.
 * Phase 2 (Workstreams 1a + 2B): that same address is ALSO the
 * order's shipping address — for a cart that ships something
 * physical it is validated with the shared validator
 * (lib/checkout/shipping-address) and submitted as shipping_address
 * alongside the delivery_address the tax calculation reads, and the
 * merged server stores it on the order as the fulfillment authority.
 * Digital-only carts are never asked for a shipping address (the
 * delivery address above is still collected, for tax). A signed-in
 * customer's saved profile address pre-fills the address fields —
 * and their name / email / phone — without ever overwriting anything
 * already typed.
 * Card payment (2026-11-09): 'Pay by card' through Authorize.net's
 * hosted page is offered ONLY when the server reports the rail
 * available (feature flag OFF by default — see the cardAvailable
 * state below); with the flag off this UI renders exactly the
 * invoice + Cash App/Venmo checkout above, with no card wording.
 * The older embedded card checkout remains PARKED DORMANT (its
 * component, routes, and webhook remain in the tree, unreachable
 * from this UI).
 * No PII in analytics — order_completed carries order_id/total/item count only.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '../../lib/pricing/pricing';
import {
  bluevineCardConfigured,
  CASH_APP_HANDLE,
  VENMO_HANDLE,
} from '../../lib/checkout/order';
import { getProductByHandle } from '../../lib/catalog/products';
import {
  US_STATES,
  mergeAddressPrefill,
  productRequiresShipping,
  validateShippingAddress,
  type ShippingAddress,
} from '../../lib/checkout/shipping-address';
import { track, trackOnce } from '../../lib/analytics/posthog';
import { ANALYTICS_EVENT_NAMES } from '../../lib/analytics/events';
import { useCart, cartItemTitle } from './cart-store';
import { previewCartTotals, FREE_SHIPPING_GENERAL_CENTS } from './cart-preview';
import type { CartItem } from '../../types';

type PaymentMethodChoice =
  | 'bluevine_invoice'
  | 'cash_app_or_venmo'
  | 'bluevine_card_link'
  | 'authorizenet_card_hosted';

/**
 * The "continue to card payment" step on the order-received screen
 * for the Authorize.net hosted method (2026-11-09): fetch a one-time
 * hosted token for the recorded order, then hand the browser to
 * Authorize.net's payment page with a real form POST (the token is
 * single-use and short-lived; CSP form-action allows exactly the
 * two gateway hosts). Payment confirmation comes only from the
 * verified webhook — returning from the gateway page proves nothing
 * by itself. A failure here is shown as a big, plain message and
 * changes nothing: the order stays saved as waiting-for-payment and
 * the customer can retry or choose another way to pay.
 */
function AuthorizeNetCardContinue({
  orderId,
  email,
}: {
  orderId: string;
  email: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continueToCardPayment = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/checkout/authorizenet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, email }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        token?: string;
        form_post_url?: string;
        errors?: string[];
      };
      if (!res.ok || !data.ok || !data.token || !data.form_post_url) {
        setError(
          data.errors?.join(' ') ??
            'Card payment could not be started. Your order is saved — please try again, or pay with the Bluevine invoice, Cash App, or Venmo.',
        );
        return;
      }
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.form_post_url;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'token';
      input.value = data.token;
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    } catch {
      setError(
        'Card payment could not be started. Your order is saved — please try again, or pay with the Bluevine invoice, Cash App, or Venmo.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p>
        Your order is saved, but it is <strong>not paid yet</strong>.
        Continue to the secure card payment page to pay by card — your
        card details are entered on that secure page, never on this
        site.
      </p>
      {error ? (
        <p
          role="alert"
          style={{
            border: '2px solid #b00020',
            borderRadius: '0.5rem',
            padding: '1rem',
            fontWeight: 600,
          }}
        >
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn-primary"
        onClick={continueToCardPayment}
        disabled={busy}
      >
        {busy ? 'Opening secure payment…' : '✦ Continue to card payment'}
      </button>
    </>
  );
}

/**
 * The Bluevine card choice exists only while the verified Bluevine
 * payment link is configured in this build's environment — evaluated
 * once at bundle time from the same public config the server checks.
 * Unset (the default): the choice never renders and the server
 * rejects the method, so no card payment is offered or implied.
 */
const BLUEVINE_CARD_AVAILABLE = bluevineCardConfigured();

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
  /** Bluevine hosted payment-page link (card choice only, when configured). */
  payment_link?: string;
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
  shipping_cents?: number;
  shipping_status?: string;
  /** Sales tax as computed + recorded by the server (lib/tax). */
  tax_cents?: number;
  tax_breakdown?: {
    ratePercent: string;
    rateBps: number;
    collected: boolean;
    jurisdiction: string;
    taxableBaseCents: number;
    provenance: string;
    notes: string[];
  } | null;
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
  // Delivery / shipping address — ONE address section with two jobs:
  // - Delivery address (owner directive 2026-11-01): collected for
  //   EVERY order; its state drives the sales-tax preview + the
  //   server's tax figure, and it is submitted as delivery_address.
  // - Shipping address (Phase 2, Workstream 1a + 2B prefill): the
  //   same fields, in the shared ShippingAddress shape. When the cart
  //   ships something physical the address is validated with the
  //   shared validator and ALSO submitted as shipping_address, which
  //   the server stores on the order for fulfillment.
  // A signed-in customer's saved default address pre-fills it;
  // anything typed here wins, and the order records exactly what is
  // submitted. Country stays 'US': the delivery/tax parser ships
  // within the United States only (see lib/checkout/order).
  const [ship, setShip] = useState({
    name: '',
    street: '',
    street2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
  });
  const prefillTried = useRef(false);

  useEffect(() => {
    if (prefillTried.current) return;
    prefillTried.current = true;
    void (async () => {
      try {
        const res = await fetch('/api/account/me');
        if (!res.ok) return;
        const json = (await res.json()) as {
          profile?: {
            email?: string;
            first_name?: string | null;
            last_name?: string | null;
            phone?: string | null;
            shipping_address?: ShippingAddress | null;
          };
        };
        const profile = json.profile;
        if (!profile) return;
        if (profile.shipping_address) {
          setShip((prev) => mergeAddressPrefill(prev, profile.shipping_address));
        }
        const fullName = [profile.first_name, profile.last_name]
          .filter(Boolean)
          .join(' ');
        if (fullName) setName((prev) => prev || fullName);
        if (profile.email) setEmail((prev) => prev || (profile.email as string));
        if (profile.phone) setPhone((prev) => prev || (profile.phone as string));
      } catch {
        // Prefill is a convenience — guests and failures just type.
      }
    })();
  }, []);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodChoice>('bluevine_invoice');
  // Authorize.net card availability, from the server (fail closed:
  // the 'Pay by card' option renders ONLY when the server reports
  // the rail available — flag ON + credentials present. With the
  // flag OFF this stays false forever and checkout renders exactly
  // as it did before the card build: invoice + Cash App/Venmo only,
  // with no card wording.)
  const [cardAvailable, setCardAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/checkout/authorizenet')
      .then((res) => res.json())
      .then((data: { card_available?: boolean }) => {
        if (!cancelled && data.card_available) setCardAvailable(true);
      })
      .catch(() => {
        /* unavailable — the card option simply stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OrderResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Server HTML renders this loading state (the cart hydrates from
  // client storage), so it must carry the page H1 — /checkout previously
  // shipped no H1 in server HTML (2026-11-08 audit Fail #27). The loaded
  // and success branches render their own single H1, so exactly one H1
  // exists in every state.
  if (!loaded)
    return (
      <main>
        <h1>Checkout</h1>
        <p>Loading checkout…</p>
      </main>
    );

  const preview = previewCartTotals(items, bundle, isSubscriber, appliedCoupon, {
    state: ship.state,
  });
  const empty = items.length === 0 && !bundle;
  // Mirrors the server's rule (lib/checkout/order): a bundle always
  // ships; a line ships when it carries a customization/formula or its
  // catalog record is physical. Digital-only carts never need a
  // shipping address (they still give a delivery address, for tax).
  const needsShipping =
    Boolean(bundle) ||
    items.some(
      (item) =>
        Boolean(item.customization) ||
        Boolean(item.formula) ||
        productRequiresShipping(getProductByHandle(item.product_handle)),
    );

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
    if (
      !ship.street.trim() ||
      !ship.city.trim() ||
      !/^[A-Za-z]{2}$/.test(ship.state.trim()) ||
      !/^\d{5}(-\d{4})?$/.test(ship.postal_code.trim())
    ) {
      setFormError(
        'Please provide your full delivery address (street, city, state, and ZIP) — we need it to ship your order and to calculate sales tax.',
      );
      return;
    }
    // Shipping validation mirrors the server (same shared validator);
    // the server re-checks authoritatively either way. Only physical
    // carts submit a shipping address — digital-only carts never do.
    let shippingAddress: ShippingAddress | undefined;
    if (needsShipping) {
      const validated = validateShippingAddress({
        ...ship,
        name: ship.name.trim() || name.trim(),
      });
      if (!validated.ok) {
        setFormError(
          `Shipping address needs attention: ${validated.errors.join(' ')}`,
        );
        return;
      }
      shippingAddress = validated.address;
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
        delivery_address: {
          line1: ship.street.trim(),
          ...(ship.street2.trim() ? { line2: ship.street2.trim() } : {}),
          city: ship.city.trim(),
          state: ship.state.trim().toUpperCase(),
          postal_code: ship.postal_code.trim(),
        },
        ...(shippingAddress ? { shipping_address: shippingAddress } : {}),
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
        // Card orders keep their cart until payment succeeds: if the
        // card attempt fails or is declined, nothing the customer
        // picked is lost — they can retry or choose another way to
        // pay without rebuilding the cart. Other methods clear here
        // exactly as before.
        if (paymentMethod !== 'authorizenet_card_hosted') clear();
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
          {method === 'authorizenet_card_hosted' ? (
            <AuthorizeNetCardContinue
              orderId={result.order_id ?? ''}
              email={email.trim()}
            />
          ) : method === 'bluevine_invoice' ? (
            <>
              <p>
                Your Bluevine invoice will arrive by email. You can pay
                it any of these ways — please use your order number as
                the payment reference:
              </p>
              <ul>
                <li>
                  <strong>ACH bank transfer or check</strong> — per the
                  details on your Bluevine invoice
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
          ) : method === 'bluevine_card_link' ? (
            <>
              <p>
                Finish paying on Bluevine&apos;s secure hosted payment
                page — enter your order total there and use your order
                number as the reference:
              </p>
              {result.payment?.payment_link ? (
                <p>
                  <a
                    href={result.payment.payment_link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Pay by card through Bluevine →
                  </a>
                </p>
              ) : null}
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
          {typeof result.shipping_cents === 'number' ? (
            <p>
              Shipping:{' '}
              {result.shipping_cents === 0
                ? 'Free'
                : formatPrice(result.shipping_cents)}
            </p>
          ) : null}
          {typeof result.tax_cents === 'number' ? (
            <p>
              {result.tax_breakdown?.collected
                ? `Utah sales tax (${result.tax_breakdown.ratePercent} — Salt Lake City rate): `
                : 'Sales tax: '}
              {formatPrice(result.tax_cents)}
              {result.tax_breakdown && !result.tax_breakdown.collected
                ? ' — no sales tax is collected on orders delivered outside Utah.'
                : ''}
            </p>
          ) : null}
          <p>
            Amount due: <strong>{formatPrice(result.total_cents ?? 0)}</strong>
            {' — this total includes the tax and shipping above.'}
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
                    {cartItemTitle(item.product_handle, item.variant_id, item.formula)} — {formatPrice(item.unit_price_cents)} ×{' '}
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
              {preview.taxDeliveryState === 'UT' ? (
                <p>
                  Utah sales tax ({preview.taxRatePercent} — the Salt Lake
                  City rate, which Utah law applies to Utah orders from
                  our Salt Lake City shop): {formatPrice(preview.taxCents)}{' '}
                  <small>
                    (on your products after any discount; shipping is
                    never taxed)
                  </small>
                </p>
              ) : preview.taxDeliveryState ? (
                <p>
                  Sales tax: {formatPrice(0)} — no sales tax is collected
                  on orders delivered outside Utah.{' '}
                  <small>
                    (This follows our current no-nexus posture for
                    out-of-state orders — an assumption we&apos;ve
                    recorded for review, not tax advice.)
                  </small>
                </p>
              ) : (
                <p>
                  Sales tax: calculated from your delivery address below —
                  Utah orders are taxed at the Salt Lake City rate
                  (8.45%); orders delivered to other states currently
                  collect no sales tax.
                </p>
              )}
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

            <section aria-label="Delivery address">
              <h2>Delivery address</h2>
              <p>
                <small>
                  Where your order will be shipped. Sales tax is
                  calculated from this address: Utah deliveries are
                  taxed at our Salt Lake City rate (8.45%); deliveries
                  to other states currently collect no sales tax. If
                  you&apos;re signed in, this starts from the address
                  saved on your profile — change anything that&apos;s
                  different for this order; the order keeps the address
                  you submit here.
                </small>
              </p>
              <label>
                Name for delivery
                <input
                  type="text"
                  value={ship.name}
                  onChange={(e) => setShip({ ...ship, name: e.target.value })}
                  autoComplete="shipping name"
                  placeholder={name}
                />
              </label>
              <label>
                Street address
                <input
                  type="text"
                  value={ship.street}
                  onChange={(e) => setShip({ ...ship, street: e.target.value })}
                  autoComplete="street-address"
                />
              </label>
              <label>
                Apartment, suite, etc. (optional)
                <input
                  type="text"
                  value={ship.street2}
                  onChange={(e) => setShip({ ...ship, street2: e.target.value })}
                  autoComplete="address-line2"
                />
              </label>
              <label>
                City
                <input
                  type="text"
                  value={ship.city}
                  onChange={(e) => setShip({ ...ship, city: e.target.value })}
                  autoComplete="address-level2"
                />
              </label>
              <label>
                State
                <select
                  value={ship.state}
                  onChange={(e) => setShip({ ...ship, state: e.target.value })}
                  autoComplete="address-level1"
                >
                  <option value="">Choose a state…</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ZIP code
                <input
                  type="text"
                  value={ship.postal_code}
                  onChange={(e) =>
                    setShip({ ...ship, postal_code: e.target.value })
                  }
                  autoComplete="postal-code"
                  placeholder="84104"
                />
              </label>
            </section>

            <section aria-label="Payment method">
              <h2>How you&apos;d like to pay</h2>
              <label>
                <input
                  type="radio"
                  name="payment-method"
                  value="bluevine_invoice"
                  checked={paymentMethod === 'bluevine_invoice'}
                  onChange={() => setPaymentMethod('bluevine_invoice')}
                />
                <strong>Pay by Bluevine invoice</strong> — place your
                order now and we&apos;ll email you an invoice from
                Bluevine. Pay it by ACH bank transfer or check, or with
                Venmo or Cash App, using your order number as the
                reference. Your order is prepared once payment is
                confirmed.
              </label>
              {BLUEVINE_CARD_AVAILABLE ? (
                <label>
                  <input
                    type="radio"
                    name="payment-method"
                    value="bluevine_card_link"
                    checked={paymentMethod === 'bluevine_card_link'}
                    onChange={() => setPaymentMethod('bluevine_card_link')}
                  />
                  <strong>Pay by card — through Bluevine</strong> — place
                  your order now, then finish on Bluevine&apos;s secure
                  hosted payment page, entering your order total there
                  with your order number as the reference.
                </label>
              ) : null}
              {cardAvailable ? (
                <label>
                  <input
                    type="radio"
                    name="payment-method"
                    value="authorizenet_card_hosted"
                    checked={paymentMethod === 'authorizenet_card_hosted'}
                    onChange={() =>
                      setPaymentMethod('authorizenet_card_hosted')
                    }
                  />
                  <strong>Pay by card</strong> — place your order now,
                  then pay on a secure card payment page. Your card
                  details are entered on that secure page, never on
                  this site. Your order is prepared once your payment
                  is confirmed.
                </label>
              ) : null}
              <label>
                <input
                  type="radio"
                  name="payment-method"
                  value="cash_app_or_venmo"
                  checked={paymentMethod === 'cash_app_or_venmo'}
                  onChange={() => setPaymentMethod('cash_app_or_venmo')}
                />
                <strong>Or pay directly with Cash App or Venmo</strong> —
                place your order now, and we&apos;ll show you the payment
                handles and your order ID right after.
              </label>
            </section>

            {formError ? (
              paymentMethod === 'authorizenet_card_hosted' ? (
                // Card attempts (flag ON only): the failure is a big,
                // plain banner where the action happens, and it says
                // the cart survived (visible-notices rule, 2026-11-09).
                <p
                  role="alert"
                  style={{
                    border: '2px solid #b00020',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    fontWeight: 600,
                  }}
                >
                  {formError} Your cart is still here — nothing you
                  picked was removed.
                </p>
              ) : (
                <p role="alert">{formError}</p>
              )
            ) : null}
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
                {cardAvailable
                  ? 'Payment is by card on our secure payment page, by emailed Bluevine invoice, or with Cash App or Venmo — you’ll get the payment details for your chosen method, and your order ID, right after placing your order.'
                  : 'Payment is by emailed Bluevine invoice, or with Cash App or Venmo — you’ll get the payment details for your chosen method, and your order ID, right after placing your order.'}
              </small>
            </p>
          </>
        )}
      </main>
    </>
  );
}
