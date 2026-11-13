/**
 * G12 — Admin orders list (read-only) + Phase 2 tracking entry +
 * payment confirmation (audit 2026-10-15 GAP-1).
 * Renders the server-written order ledger exactly as persisted; prices are
 * displayed, never recomputed (SERVER=AUTHORITY — the ledger is the truth).
 * Shipment tracking renders from the separate append-only tracking ledger
 * and is recorded through the owner-secret endpoint
 * (POST /api/admin/orders/tracking) via the form at the bottom — order
 * records themselves are never edited here or anywhere. Payment
 * confirmation works the same way: an append-only payment ledger
 * (lib/orders/payments.ts) recorded through
 * POST /api/admin/orders/payment; an order shows as paid when a
 * confirmation event exists for it. Payment methods render as human
 * labels, never the raw enum (audit POLISH-1).
 *
 * Stage 1 (audit G-5): payment state here resolves through the ONE
 * shared resolver (lib/orders/paid-state.ts) fed by bulk ledger
 * reads — the manual confirmation ledger AND the Stripe webhook
 * paid ledger, plus Stripe refund/dispute transitions. Card orders
 * paid by the verified webhook show as paid here without any manual
 * confirmation, and a refunded/disputed order shows that state
 * instead of paid — the same answer the customer surfaces give.
 */
import type { Metadata } from 'next';
import { AdminGate } from '../../../components/admin/AdminGate';
import { AdminViewTracker } from '../../../components/admin/AdminViewTracker';
import { defaultOrderStore, JsonlOrderStore } from '../../../lib/stores/order-store';
import { ownerSecretConfigured } from '../../../lib/admin/owner-auth';
import { TrackingEntryForm } from './TrackingEntryForm';
import { PaymentConfirmForm } from './PaymentConfirmForm';
import {
  carrierLabel,
  carrierTrackingUrl,
  readTrackingEventsAsync,
  type OrderTrackingEvent,
} from '../../../lib/orders/tracking';
import {
  paymentMethodLabel,
  readPaymentEventsAsync,
  type OrderPaymentEvent,
} from '../../../lib/orders/payments';
import {
  readStripeOrderStatusEvents,
  readStripePaymentsAsync,
  readStripeWebhookEvents,
  type StripeOrderStatusEvent,
  type StripePaymentRecord,
} from '../../../lib/payments/stripe';
import { resolvePaidStateFromEvidence } from '../../../lib/orders/paid-state';
import {
  bluevineCardConfigured,
  type OrderDeliveryAddress,
} from '../../../lib/checkout/order';
import {
  formatShippingAddressLines,
  type ShippingAddress,
} from '../../../lib/checkout/shipping-address';
import { formatPrice } from '../../../lib/pricing/pricing';
import { orderLineDisplayTitle } from '../../../lib/wax/wax';
import {
  BALM_SCENT_UNSENTED,
  getBalmPurpose,
} from '../../../lib/custom-formula/balm';
import {
  getScentRecipe,
  scentSelectionLabel,
} from '../../../lib/catalog/scents';
import { getHerb } from '../../../lib/catalog/herbs';
import { getShape } from '../../../lib/catalog/shapes';
import type { OrderLine } from '../../../lib/checkout/order';
import Link from 'next/link';

/**
 * Production detail for one order line (directive 2026-11-13): what
 * to make, exactly as the customer configured it — for a custom
 * formula, the botanical count plus any purpose/scent/creation notes
 * the customer supplied; the wax finish itself rides the display
 * title (orderLineDisplayTitle). Before this, the list showed only a
 * line COUNT and the maker had to read the raw ledger to produce an
 * order.
 */
function productionDetail(line: OrderLine): string | null {
  const parts: string[] = [];
  if (line.formula) {
    parts.push(
      `botanicals: ${line.formula.herb_ids
        .map((id) => getHerb(id)?.name ?? id)
        .join(', ')}`,
    );
    if (line.formula.purpose_id) {
      const purpose = getBalmPurpose(line.formula.purpose_id);
      if (purpose) parts.push(`purpose: ${purpose.label}`);
    }
    if (line.formula.scent_id) {
      parts.push(
        line.formula.scent_id === BALM_SCENT_UNSENTED
          ? 'scent: unscented'
          : `scent: ${getScentRecipe(line.formula.scent_id)?.name ?? line.formula.scent_id}`,
      );
    }
    if (line.formula.creation_name) {
      parts.push(`creation: ${line.formula.creation_name}`);
    }
    if (line.formula.intention) {
      parts.push(`intention: ${line.formula.intention}`);
    }
    if (line.formula.notes) {
      parts.push(`notes: ${line.formula.notes}`);
    }
  }
  if (line.customization) {
    const c = line.customization;
    parts.push(
      [
        getShape(c.shape)?.name ?? c.shape,
        c.base,
        scentSelectionLabel(c.scent),
        c.botanical,
        c.color,
      ]
        .filter(Boolean)
        .join(' · '),
    );
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Ship-to lines for the customer cell (Phase 2, from the card build,
 * adapted to the admin build's records): orders written by the
 * Phase-2 checkout carry `shipping_address`; orders written by the
 * tax build carry the delivery address it taxed on
 * (`delivery_address`, a TaxAddress). Either renders — an order with
 * neither simply shows no Ship-to line.
 */
function shipToLines(o: {
  shipping_address?: ShippingAddress | null;
  delivery_address?: OrderDeliveryAddress;
}): string[] {
  if (o.shipping_address) {
    return formatShippingAddressLines(o.shipping_address);
  }
  const d = o.delivery_address;
  if (!d) return [];
  return [
    d.line1,
    d.line2,
    `${d.city}, ${d.state} ${d.postalCode}`,
    d.country,
  ].filter(
    (line): line is string =>
      typeof line === 'string' && line.trim() !== '',
  );
}

export const metadata: Metadata = {
  title: 'Admin — Orders',
  description: 'Read-only order ledger for Amber\'s Alchemy Apothecary (internal).',
  robots: { index: false, follow: false },
};

// Orders + tracking render from the live ledgers at request time — a
// static snapshot would hide new orders and freshly recorded tracking
// until the next deploy. (Phase 2: the sibling tooling pages —
// subscriptions, broadcast, confirm — are force-dynamic for the same
// reason.)
export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const store = defaultOrderStore();
  const orders = await store.listOrders({ limit: 100 });
  const issues = store instanceof JsonlOrderStore ? store.getParseIssues() : [];

  // Latest tracking event per order (the tracking ledger is append-only,
  // so a later line supersedes an earlier one). Tracking is recorded via
  // POST /api/admin/orders/tracking and shown to the customer on
  // /order-status; the order records themselves are never mutated.
  const trackingByOrder = new Map<string, OrderTrackingEvent>();
  for (const event of await readTrackingEventsAsync()) {
    trackingByOrder.set(event.order_id, event);
  }

  // Latest payment confirmation per order (same append-only, latest-wins
  // join). An order with an entry here is paid.
  const paymentByOrder = new Map<string, OrderPaymentEvent>();
  for (const event of await readPaymentEventsAsync()) {
    paymentByOrder.set(event.order_id, event);
  }

  // Stripe webhook evidence, same latest-wins bulk join: the paid
  // ledger (card orders the verified webhook marked paid) and the
  // refund/dispute transition ledger. Together with the manual
  // confirmations above these feed the shared paid-state resolver,
  // so this table answers exactly like the customer surfaces.
  const stripePaymentByOrder = new Map<string, StripePaymentRecord>();
  for (const payment of await readStripePaymentsAsync()) {
    stripePaymentByOrder.set(payment.order_id, payment);
  }
  const stripeStatusByOrder = new Map<string, StripeOrderStatusEvent>();
  for (const event of await readStripeOrderStatusEvents()) {
    stripeStatusByOrder.set(event.order_id, event);
  }

  // Stage 5 (admin visibility): the Stage 1 webhook event ledger,
  // newest first, capped — read-only, and only the ledger's summary
  // fields (event id, type, outcome, timestamp). Payload bodies are
  // never stored in that ledger and never rendered here.
  const webhookEvents = (await readStripeWebhookEvents()).slice(-25).reverse();

  return (
    <AdminGate>
      <AdminViewTracker section="orders" />
      <main aria-labelledby="admin-orders-title">
        <h1 id="admin-orders-title">Orders</h1>
        <p>
          Read-only view of the order ledger ({orders.length} shown, newest
          first). Records render exactly as the checkout server persisted
          them — totals are displayed, never recomputed here.
        </p>
        <p>
          Payment rails: the emailed-invoice flow (ACH bank transfer to
          Bluevine, Venmo, Cash App) and Cash App / Venmo direct are
          live.{' '}
          {bluevineCardConfigured()
            ? 'Card through Bluevine\u2019s secure payment page: a payment link is set in this deployment — it counts as live only once the Bluevine connection and link verification on the go-live checklist are done.'
            : 'No live card rail: card through Bluevine is not configured (no verified payment link is set), so checkout does not offer it.'}
        </p>

        {issues.length > 0 && (
          <div role="alert">
            <strong>{issues.length} ledger line(s) could not be parsed</strong>{' '}
            — surfaced here instead of silently dropped:
            <ul>
              {issues.map((i) => (
                <li key={i.line}>
                  Line {i.line}: {i.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {orders.length === 0 ? (
          <p>No orders in the ledger yet.</p>
        ) : (
          <table>
            <caption>Orders, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Date</th>
                <th scope="col">Customer</th>
                <th scope="col">Lines</th>
                <th scope="col">Total</th>
                <th scope="col">Tax</th>
                <th scope="col">Shipping</th>
                <th scope="col">Payment</th>
                <th scope="col">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_id}>
                  <td>
                    <code>{o.order_id}</code>
                  </td>
                  <td>{o.created_at}</td>
                  <td>
                    {o.customer.name}
                    <br />
                    <small>{o.customer.email}</small>
                    {shipToLines(o).length > 0 ? (
                      <>
                        <br />
                        <small>
                          Ship to: {shipToLines(o).join(' · ')}
                        </small>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {o.items.reduce((n, l) => n + l.quantity, 0)}
                    {o.bundle ? ' + bundle(5)' : ''}
                    <ul>
                      {o.items.map((l, i) => (
                        <li key={i}>
                          <small>
                            {orderLineDisplayTitle(l)} × {l.quantity}
                            {productionDetail(l) ? (
                              <>
                                <br />
                                {productionDetail(l)}
                              </>
                            ) : null}
                          </small>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>{formatPrice(o.total_cents)}</td>
                  <td>
                    {typeof o.tax_cents === 'number'
                      ? formatPrice(o.tax_cents)
                      : '—'}
                  </td>
                  <td>{o.shipping_status}</td>
                  <td>
                    {paymentMethodLabel(o.payment_method)}
                    <br />
                    {(() => {
                      const state = resolvePaidStateFromEvidence(o, {
                        stripePayment:
                          stripePaymentByOrder.get(o.order_id) ?? null,
                        manualPayment:
                          paymentByOrder.get(o.order_id) ?? null,
                        statusEvent:
                          stripeStatusByOrder.get(o.order_id) ?? null,
                      });
                      if (state.status === 'refunded') {
                        return (
                          <small>
                            ↩ Refunded — Stripe refund recorded{' '}
                            {state.status_event?.recorded_at.slice(0, 10)}
                          </small>
                        );
                      }
                      if (state.status === 'disputed') {
                        return (
                          <small>
                            ⚠ Disputed — Stripe dispute opened{' '}
                            {state.status_event?.recorded_at.slice(0, 10)}
                          </small>
                        );
                      }
                      if (state.status === 'cancelled') {
                        return <small>Cancelled</small>;
                      }
                      if (state.is_paid) {
                        const manual = state.manual_payment;
                        if (manual) {
                          return (
                            <small>
                              ✓ Paid — confirmed{' '}
                              {manual.recorded_at.slice(0, 10)}
                              {manual.reference
                                ? ` · ref ${manual.reference}`
                                : ''}
                            </small>
                          );
                        }
                        return (
                          <small>
                            ✓ Paid — card payment confirmed by Stripe{' '}
                            {state.stripe_payment?.paid_at.slice(0, 10)}
                          </small>
                        );
                      }
                      return <small>Awaiting payment</small>;
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const tracking = trackingByOrder.get(o.order_id);
                      if (!tracking) return '—';
                      const url = carrierTrackingUrl(
                        tracking.carrier,
                        tracking.tracking_number,
                      );
                      return (
                        <>
                          {carrierLabel(tracking.carrier)}{' '}
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              {tracking.tracking_number}
                            </a>
                          ) : (
                            tracking.tracking_number
                          )}
                        </>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <section aria-label="Stripe webhook events" style={{ marginTop: '2.5rem' }}>
          <h2>Stripe webhook events</h2>
          <p>
            The most recent events the verified Stripe webhook processed
            (Stage 1 event ledger) — event id, type, outcome, and when it
            was recorded. Deliveries that fail verification or processing
            are not recorded here; they appear in the server logs instead.
          </p>
          {webhookEvents.length === 0 ? (
            <p>No webhook events recorded yet.</p>
          ) : (
            <table>
              <caption>Stripe webhook events, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Type</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {webhookEvents.map((event) => (
                  <tr key={event.stripe_event_id}>
                    <td>
                      <code>{event.stripe_event_id}</code>
                    </td>
                    <td>{event.event_type}</td>
                    <td>{event.outcome}</td>
                    <td>{event.recorded_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section aria-label="Confirm payment received" style={{ marginTop: '2.5rem' }}>
          <h2>Confirm payment received</h2>
          <p>
            When an order&apos;s payment lands, confirm it here. The
            confirmation is appended to the payment ledger (the order
            record is never edited), the table above marks the order
            paid, and the customer sees it as paid on the{' '}
            <Link href="/order-status">order-status page</Link> and in
            their account order history. No payment on any current rail
            confirms itself: this recording is what moves an order out
            of “awaiting payment”. The evidence per rail: a Cash App /
            Venmo payment in the account, an ACH transfer for an emailed
            invoice, or — for a card order — the payment showing in
            Bluevine against the order number the customer used as the
            payment reference. Record a Bluevine card payment with
            method “Card — Bluevine (hosted payment page)” and the
            Bluevine payment reference, and only when the amount matches
            the order total. Historical card orders paid through the
            former on-site card checkout were marked paid by that
            system&apos;s verified webhook, and its refund or dispute
            records are what move those orders to “Refunded” /
            “Disputed” above. (Orders placed before 2026-10-21 via the
            removed emailed-invoice path are confirmed the same way,
            under the method recorded on the order.)
          </p>
          <PaymentConfirmForm configured={ownerSecretConfigured()} />
        </section>

        <section aria-label="Record shipment tracking" style={{ marginTop: '2.5rem' }}>
          <h2>Record shipment tracking</h2>
          <p>
            When you ship an order, record its tracking number here. The
            entry is appended to the tracking ledger (the order record is
            never edited), and the customer sees the number and its
            carrier link on the{' '}
            <Link href="/order-status">order-status page</Link>. Recording the
            same number again changes nothing; a corrected number simply
            supersedes the earlier entry.
          </p>
          <TrackingEntryForm configured={ownerSecretConfigured()} />
        </section>

        <p>
          <Link href="/admin">← Back to overview</Link>
        </p>
      </main>
    </AdminGate>
  );
}
