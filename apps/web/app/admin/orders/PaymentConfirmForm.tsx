'use client';

/**
 * Client form for confirming an order's payment from /admin/orders.
 *
 * Posts { order_id, method?, reference?, note? } to
 * POST /api/admin/orders/payment, which appends a confirmation event to
 * the payment ledger (the order record is never edited) and enforces the
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

interface PaymentResponse {
  ok?: boolean;
  order_id?: string;
  already_recorded?: boolean;
  payment?: {
    method_label: string;
    reference: string | null;
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

export function PaymentConfirmForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [orderId, setOrderId] = useState('');
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [ownerKey, setOwnerKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setOutcome(null);

    try {
      const response = await fetch('/api/admin/orders/payment', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-owner-secret': ownerKey,
        },
        body: JSON.stringify({
          order_id: orderId.trim(),
          ...(method ? { method } : {}),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const data = (await response
        .json()
        .catch(() => null)) as PaymentResponse | null;
      const serverErrors = (data?.errors ?? []).filter(Boolean);

      if (response.ok && data?.ok) {
        setOutcome({
          kind: 'success',
          message: data.already_recorded
            ? `That payment was already confirmed for ${data.order_id} — nothing new was added. The customer sees it as paid on the order-status page.`
            : `Confirmed — ${data.order_id} is now marked paid (${data.payment?.method_label ?? 'payment recorded'}). The customer sees “Payment confirmed” on the order-status page.`,
        });
        setReference('');
        setNote('');
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
              "Payment confirmation isn't switched on yet — the owner key hasn't been set up on the server (OWNER_ADMIN_SECRET).",
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
            "That confirmation doesn't look right — check it and try again.",
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
    <form onSubmit={handleSubmit} aria-label="Confirm order payment">
      <div style={{ marginBottom: '1.25rem' }}>
        <label htmlFor="payment-order-id" style={labelStyle}>
          Order ID
        </label>
        <input
          id="payment-order-id"
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
        <label htmlFor="payment-method" style={labelStyle}>
          Payment arrived via
        </label>
        <select
          id="payment-method"
          name="payment-method"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          style={inputStyle}
        >
          <option value="">As recorded on the order</option>
          <option value="cash_app_or_venmo">Cash App / Venmo</option>
          <option value="bookipi_card_invoice">Card — Bookipi invoice</option>
        </select>
      </div>
      <div style={{ marginBottom: '1.25rem' }}>
        <label htmlFor="payment-reference" style={labelStyle}>
          Reference (optional)
        </label>
        <input
          id="payment-reference"
          name="payment-reference"
          type="text"
          autoComplete="off"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          style={inputStyle}
          placeholder="Bookipi invoice # or Cash App / Venmo reference"
        />
      </div>
      <div style={{ marginBottom: '1.25rem' }}>
        <label htmlFor="payment-note" style={labelStyle}>
          Note (optional)
        </label>
        <input
          id="payment-note"
          name="payment-note"
          type="text"
          autoComplete="off"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="payment-owner-key" style={labelStyle}>
          Owner key
        </label>
        <input
          id="payment-owner-key"
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
        {submitting ? 'Confirming…' : 'Confirm payment received'}
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
