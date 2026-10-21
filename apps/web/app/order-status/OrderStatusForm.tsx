'use client';

/**
 * Client form for /order-status — customer order lookup.
 *
 * Sends { order_id, email } to POST /api/orders/status. That endpoint
 * answers only when BOTH match the order record and returns one generic
 * message for every miss; this form mirrors that honesty — it never
 * hints at which half was wrong. Nothing entered here is persisted,
 * stored, or sent to analytics.
 */
import { useState, type CSSProperties, type FormEvent } from 'react';
import { formatPrice } from '../../lib/pricing/pricing';

interface OrderSummary {
  order_id: string;
  created_at: string;
  customer_name: string;
  status: 'pending_payment' | 'paid' | 'cancelled';
  shipping_status: 'FREE' | 'FLAT';
  payment_method:
    | 'cash_app_or_venmo'
    | 'bookipi_card_invoice'
    | 'stripe_card_embedded';
  item_count: number;
  total_cents: number;
}

interface TrackingSummary {
  carrier: string;
  carrier_label: string;
  tracking_number: string;
  tracking_url: string | null;
  recorded_at: string;
}

interface StatusResponse {
  ok?: boolean;
  order?: OrderSummary;
  tracking?: TrackingSummary | null;
  errors?: string[];
}

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: '0.4rem',
  fontSize: '1.05rem',
  fontWeight: 600,
  color: 'var(--brass)',
};

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '3.25rem',
  padding: '0.9rem 1rem',
  backgroundColor: '#1a0f2e',
  border: '1px solid rgba(212, 175, 55, 0.35)',
  borderRadius: '0.5rem',
  color: '#d4af37',
  fontSize: '1rem',
};

function statusLine(order: OrderSummary): string {
  switch (order.status) {
    case 'paid':
      return 'Payment confirmed — Amber is preparing your order.';
    case 'cancelled':
      return 'This order was cancelled. If that is unexpected, please contact Amber.';
    default:
      return 'Received — Amber confirms every order personally, and yours is awaiting her confirmation. If you chose to pay by card, your Bookipi invoice arrives by email.';
  }
}

export function OrderStatusForm() {
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/orders/status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId.trim(),
          email: email.trim(),
        }),
      });
      const data = (await response
        .json()
        .catch(() => null)) as StatusResponse | null;

      if (response.ok && data?.ok && data.order) {
        setResult(data);
      } else if (response.status === 404) {
        setError(
          'No order matches that order ID and email. Check the order ID on your confirmation and the email you ordered with, then try again.',
        );
      } else if (response.status === 429) {
        setError('Too many lookups just now — wait a moment and try again.');
      } else {
        setError(
          data?.errors?.[0] ??
            'Something went wrong looking that up — wait a moment and try again.',
        );
      }
    } catch {
      setError(
        "Couldn't reach the site — check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const order = result?.order;
  const tracking = result?.tracking;

  return (
    <div>
      <form onSubmit={handleSubmit} aria-label="Look up your order status">
        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="order-status-id" style={labelStyle}>
            Order ID
          </label>
          <input
            id="order-status-id"
            name="order-id"
            type="text"
            autoComplete="off"
            required
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            style={inputStyle}
            placeholder="AWK-20261014-XXXXXX"
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="order-status-email" style={labelStyle}>
            Email you ordered with
          </label>
          <input
            id="order-status-email"
            name="order-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={inputStyle}
          />
        </div>
        <button
          type="submit"
          className="btn-primary"
          disabled={submitting}
          style={{ width: '100%', minHeight: '3.25rem', fontSize: '1rem' }}
        >
          {submitting ? 'Looking up…' : 'Check order status'}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: '1.25rem',
            padding: '1rem 1.1rem',
            borderRadius: '0.5rem',
            lineHeight: 1.6,
            border: '1px solid #c46a6a',
            backgroundColor: 'rgba(196, 106, 106, 0.08)',
          }}
        >
          ⚠ {error}
        </div>
      )}

      {order && (
        <section
          aria-label="Order status result"
          style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--brass)',
            backgroundColor: 'rgba(212, 175, 55, 0.08)',
            lineHeight: 1.7,
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            Order <code>{order.order_id}</code>
          </h2>
          <p>{statusLine(order)}</p>
          <dl>
            <div>
              <dt style={{ display: 'inline', fontWeight: 600 }}>Placed: </dt>
              <dd style={{ display: 'inline', margin: 0 }}>
                {new Date(order.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </dd>
            </div>
            <div>
              <dt style={{ display: 'inline', fontWeight: 600 }}>Items: </dt>
              <dd style={{ display: 'inline', margin: 0 }}>
                {order.item_count}
              </dd>
            </div>
            <div>
              <dt style={{ display: 'inline', fontWeight: 600 }}>Total: </dt>
              <dd style={{ display: 'inline', margin: 0 }}>
                {formatPrice(order.total_cents)}
              </dd>
            </div>
          </dl>

          {tracking ? (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                borderRadius: '0.5rem',
                backgroundColor: '#1a0f2e',
                border: '1px solid rgba(212, 175, 55, 0.35)',
              }}
            >
              <h3 style={{ marginTop: 0 }}>📦 Your order has shipped</h3>
              <p style={{ margin: '0.5rem 0' }}>
                {tracking.carrier_label} tracking number:{' '}
                <strong>{tracking.tracking_number}</strong>
              </p>
              {tracking.tracking_url && (
                <p style={{ margin: '0.5rem 0 0' }}>
                  <a
                    href={tracking.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Track your package with {tracking.carrier_label} →
                  </a>
                </p>
              )}
            </div>
          ) : (
            <p style={{ marginBottom: 0 }}>
              No tracking number yet — once Amber ships your order, its
              tracking will appear here.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
