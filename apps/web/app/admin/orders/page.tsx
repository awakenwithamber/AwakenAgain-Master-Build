/**
 * G12 — Admin orders list (read-only) + Phase 2 tracking entry.
 * Renders the server-written order ledger exactly as persisted; prices are
 * displayed, never recomputed (SERVER=AUTHORITY — the ledger is the truth).
 * Shipment tracking renders from the separate append-only tracking ledger
 * and is recorded through the owner-secret endpoint
 * (POST /api/admin/orders/tracking) via the form at the bottom — order
 * records themselves are never edited here or anywhere.
 */
import type { Metadata } from 'next';
import { AdminGate } from '../../../components/admin/AdminGate';
import { AdminViewTracker } from '../../../components/admin/AdminViewTracker';
import { defaultOrderStore, JsonlOrderStore } from '../../../lib/stores/order-store';
import { ownerSecretConfigured } from '../../../lib/admin/owner-auth';
import { TrackingEntryForm } from './TrackingEntryForm';
import {
  carrierLabel,
  carrierTrackingUrl,
  readTrackingEvents,
  type OrderTrackingEvent,
} from '../../../lib/orders/tracking';
import { formatPrice } from '../../../lib/pricing/pricing';

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
  for (const event of readTrackingEvents()) {
    trackingByOrder.set(event.order_id, event);
  }

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
                  <td>{o.payment_method}</td>
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

        <section aria-label="Record shipment tracking" style={{ marginTop: '2.5rem' }}>
          <h2>Record shipment tracking</h2>
          <p>
            When you ship an order, record its tracking number here. The
            entry is appended to the tracking ledger (the order record is
            never edited), and the customer sees the number and its
            carrier link on the{' '}
            <a href="/order-status">order-status page</a>. Recording the
            same number again changes nothing; a corrected number simply
            supersedes the earlier entry.
          </p>
          <TrackingEntryForm configured={ownerSecretConfigured()} />
        </section>

        <p>
          <a href="/admin">← Back to overview</a>
        </p>
      </main>
    </AdminGate>
  );
}
