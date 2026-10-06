/**
 * G12 — Admin orders list (read-only).
 * Renders the server-written order ledger exactly as persisted; prices are
 * displayed, never recomputed (SERVER=AUTHORITY — the ledger is the truth).
 */
import type { Metadata } from 'next';
import { AdminGate } from '../../../components/admin/AdminGate';
import { AdminViewTracker } from '../../../components/admin/AdminViewTracker';
import { defaultOrderStore, JsonlOrderStore } from '../../../lib/stores/order-store';
import { formatPrice } from '../../../lib/pricing/pricing';

export const metadata: Metadata = {
  title: 'Admin — Orders',
  description: 'Read-only order ledger for Amber\'s Alchemy Apothecary (internal).',
  robots: { index: false, follow: false },
};

export default async function AdminOrdersPage() {
  const store = defaultOrderStore();
  const orders = await store.listOrders({ limit: 100 });
  const issues = store instanceof JsonlOrderStore ? store.getParseIssues() : [];

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
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p>
          <a href="/admin">← Back to overview</a>
        </p>
      </main>
    </AdminGate>
  );
}
