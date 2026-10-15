'use client';

/**
 * Client form for recording shipment tracking from /admin/orders.
 *
 * Posts { order_id, carrier, tracking_number } to
 * POST /api/admin/orders/tracking, which appends an event to the
 * tracking ledger (the order record is never edited) and enforces the
 * owner secret server-side on every call.
 *
 * SECRET HYGIENE (same rules as the other owner tools, guard-tested):
 * the key lives ONLY in this component's React state while typed —
 * never persisted, never in the URL, never sent to analytics or logged —
 * and is cleared when the server rejects it (401). After a successful
 * entry the route refreshes so the orders table re-reads the ledgers
 * server-side.
 */
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Outcome = { kind: 'success' | 'error'; message: string };

interface TrackingResponse {
  ok?: boolean;
  order_id?: string;
  already_recorded?: boolean;
  tracking?: {
    carrier_label: string;
    tracking_number: string;
    tracking_url: string | null;
  };
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

export function TrackingEntryForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [orderId, setOrderId] = useState('');
  const [carrier, setCarrier] = useState('usps');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [ownerKey, setOwnerKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setOutcome(null);

    try {
      const response = await fetch('/api/admin/orders/tracking', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-owner-secret': ownerKey,
        },
        body: JSON.stringify({
          order_id: orderId.trim(),
          carrier,
          tracking_number: trackingNumber.trim(),
        }),
      });
      const data = (await response
        .json()
        .catch(() => null)) as TrackingResponse | null;
      const serverErrors = (data?.errors ?? []).filter(Boolean);

      if (response.ok && data?.ok) {
        setOutcome({
          kind: 'success',
          message: data.already_recorded
            ? `That tracking was already the latest on record for ${data.order_id} — nothing new was added. The customer sees it on the order-status page.`
            : `Recorded — ${data.tracking?.carrier_label ?? ''} ${data.tracking?.tracking_number ?? ''} is now the tracking for ${data.order_id}. The customer can see it on the order-status page.`,
        });
        setTrackingNumber('');
        router.refresh();
      } else if (response.status === 401) {
        setOwnerKey('');
        setOutcome({
          kind: 'error',
          message:
            "That owner key wasn't accepted, so nothing was recorded. Re-enter the key carefully and try again.",
        });
      } else if (response.status === 404) {
        if (!configured || serverErrors.includes('Not found.')) {
          setOutcome({
            kind: 'error',
            message:
              "Tracking entry isn't switched on yet — the owner key hasn't been set up on the server (OWNER_ADMIN_SECRET).",
          });
        } else {
          setOutcome({
            kind: 'error',
            message:
              serverErrors[0] ??
              'No order with that ID exists in the ledger — check the ID and try again.',
          });
        }
      } else if (response.status === 422) {
        setOutcome({
          kind: 'error',
          message:
            serverErrors[0] ??
            "That tracking entry doesn't look right — check it and try again.",
        });
      } else {
        setOutcome({
          kind: 'error',
          message:
            'Something went wrong on the server. Nothing was recorded — wait a moment and try again.',
        });
      }
    } catch {
      setOutcome({
        kind: 'error',
        message:
          "Couldn't reach the site — check your connection and try again. Nothing was recorded.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Record shipment tracking">
      <div style={{ marginBottom: '1.25rem' }}>
        <label htmlFor="tracking-order-id" style={labelStyle}>
          Order ID
        </label>
        <input
          id="tracking-order-id"
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
      <div style={{ marginBottom: '1.25rem' }}>
        <label htmlFor="tracking-carrier" style={labelStyle}>
          Carrier
        </label>
        <select
          id="tracking-carrier"
          name="carrier"
          value={carrier}
          onChange={(event) => setCarrier(event.target.value)}
          style={inputStyle}
        >
          <option value="usps">USPS</option>
          <option value="ups">UPS</option>
          <option value="fedex">FedEx</option>
          <option value="dhl">DHL</option>
        </select>
      </div>
      <div style={{ marginBottom: '1.25rem' }}>
        <label htmlFor="tracking-number" style={labelStyle}>
          Tracking number
        </label>
        <input
          id="tracking-number"
          name="tracking-number"
          type="text"
          autoComplete="off"
          required
          value={trackingNumber}
          onChange={(event) => setTrackingNumber(event.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="tracking-owner-key" style={labelStyle}>
          Owner key
        </label>
        <input
          id="tracking-owner-key"
          name="owner-key"
          type="password"
          autoComplete="off"
          required
          value={ownerKey}
          onChange={(event) => setOwnerKey(event.target.value)}
          style={inputStyle}
        />
        <p
          style={{
            margin: '0.45rem 0 0',
            fontSize: '0.9rem',
            color: 'var(--text-muted)',
          }}
        >
          Typed fresh each visit — it is never saved on this device.
        </p>
      </div>
      <button
        type="submit"
        className="btn-primary"
        disabled={submitting}
        style={{ minHeight: '3.25rem', fontSize: '1rem', padding: '0 2rem' }}
      >
        {submitting ? 'Recording…' : 'Record tracking'}
      </button>

      {outcome && (
        <div
          role={outcome.kind === 'success' ? 'status' : 'alert'}
          style={{
            marginTop: '1.25rem',
            padding: '1rem 1.1rem',
            borderRadius: '0.5rem',
            lineHeight: 1.6,
            border:
              outcome.kind === 'success'
                ? '1px solid var(--brass)'
                : '1px solid #c46a6a',
            backgroundColor:
              outcome.kind === 'success'
                ? 'rgba(212, 175, 55, 0.1)'
                : 'rgba(196, 106, 106, 0.08)',
          }}
        >
          {outcome.kind === 'success' ? '✓ ' : '⚠ '}
          {outcome.message}
        </div>
      )}
    </form>
  );
}
