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
import { formatPrice } from '../../../lib/pricing/pricing';
import Link from 'next/link';

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
                  </td>
                  <td>
                    {o.items.reduce((n, l) => n + l.quantity, 0)}
                    {o.bundle ? ' + bundle(5)' : ''}
                  </td>
                  <td>{formatPrice(o.total_cents)}</td>
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
            When an order&apos;s payment lands — the Cash App / Venmo
            payment arrives — confirm it here. The confirmation is
            appended to the payment ledger (the order record is never
            edited), the table above marks the order paid, and the
            customer sees it as paid on the{' '}
            <Link href="/order-status">order-status page</Link> and in
            their account order history. Manual payments send no
            automatic signal, so this step is what moves an order out of
            “awaiting payment”. Card orders paid through the on-site
            Stripe checkout need no confirmation here — the verified
            Stripe webhook marks them paid automatically, and a Stripe
            refund or dispute moves them to “Refunded” / “Disputed”
            above. (Orders placed before 2026-10-21 via the removed
            emailed-invoice path are confirmed the same way, under the
            method recorded on the order.)
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
