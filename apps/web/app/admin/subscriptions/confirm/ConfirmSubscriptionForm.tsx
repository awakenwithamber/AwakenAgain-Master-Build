'use client';

/**
 * Client form for /admin/subscriptions/confirm (owner-only bridge UI).
 *
 * Exactly two fields — the member's email and the owner key. On submit it
 * POSTs { email } to /api/admin/subscriptions/confirm with the key in the
 * `x-owner-secret` header, matching that endpoint's contract exactly.
 *
 * SECRET HYGIENE: the key lives ONLY in this component's React state
 * while it is typed. It is never persisted (no browser storage, no
 * cookies, never in the URL) and never sent to analytics or logged.
 * Both fields are cleared after a successful confirmation; the key field
 * is also cleared when the server rejects it (401).
 */
import { useState, type CSSProperties, type FormEvent } from 'react';

type Outcome = { kind: 'success' | 'error'; message: string };

type ConfirmResponse = {
  ok?: boolean;
  email?: string;
  status?: string;
  errors?: string[];
};

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

const hintStyle: CSSProperties = {
  margin: '0.45rem 0 0',
  fontSize: '0.9rem',
  color: 'var(--text-muted)',
};

const outcomeBaseStyle: CSSProperties = {
  marginTop: '1.25rem',
  padding: '1rem 1.1rem',
  borderRadius: '0.5rem',
  lineHeight: 1.6,
};

export function ConfirmSubscriptionForm({
  configured,
}: {
  configured: boolean;
}) {
  const [email, setEmail] = useState('');
  const [ownerKey, setOwnerKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setOutcome(null);
    const submittedEmail = email.trim();

    try {
      const response = await fetch('/api/admin/subscriptions/confirm', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-owner-secret': ownerKey,
        },
        body: JSON.stringify({ email: submittedEmail }),
      });
      const data = (await response
        .json()
        .catch(() => null)) as ConfirmResponse | null;
      const serverErrors = (data?.errors ?? []).filter(Boolean);

      if (response.ok && data?.ok) {
        // The endpoint returns this same 200 shape for a fresh
        // confirmation and for an already-active member (idempotent),
        // so one message covers both truthfully.
        setOutcome({
          kind: 'success',
          message: `Done — ${data.email ?? submittedEmail} has an active Living Grimoire membership. Subscriber benefits (free shipping on every order and 10% off) apply at checkout right away.`,
        });
        setEmail('');
        setOwnerKey('');
      } else if (response.status === 401) {
        setOwnerKey('');
        setOutcome({
          kind: 'error',
          message:
            "That owner key wasn't accepted, so nothing was changed. Re-enter the key carefully and try again.",
        });
      } else if (response.status === 409) {
        setOutcome({
          kind: 'error',
          message:
            serverErrors[0] ??
            'That subscription is cancelled and cannot be confirmed. If they want to rejoin, they will need to subscribe again.',
        });
      } else if (response.status === 404) {
        // Two different 404s share this status: the endpoint's bare
        // "Not found." when no owner key is configured on the server,
        // and "No subscription found for …" for an unknown email.
        if (!configured || serverErrors.includes('Not found.')) {
          setOutcome({
            kind: 'error',
            message:
              "Confirmation isn't switched on yet — the owner key hasn't been set up on the server, so nothing can be confirmed right now.",
          });
        } else {
          setOutcome({
            kind: 'error',
            message: `No subscription found for ${submittedEmail}. Confirmation only works for an email that already signed up — check the address they subscribed with and try again.`,
          });
        }
      } else if (response.status === 422) {
        setOutcome({
          kind: 'error',
          message:
            serverErrors[0] ??
            "That email doesn't look right — check it and try again.",
        });
      } else {
        setOutcome({
          kind: 'error',
          message:
            'Something went wrong on the server. Nothing was changed — wait a moment and try again.',
        });
      }
    } catch {
      setOutcome({
        kind: 'error',
        message:
          "Couldn't reach the site — check your connection and try again. Nothing was changed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Confirm a Living Grimoire subscription"
    >
      <div style={{ marginBottom: '1.25rem' }}>
        <label htmlFor="confirm-member-email" style={labelStyle}>
          Member email
        </label>
        <input
          id="confirm-member-email"
          name="member-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="confirm-owner-key" style={labelStyle}>
          Owner key
        </label>
        <input
          id="confirm-owner-key"
          name="owner-key"
          type="password"
          autoComplete="off"
          required
          value={ownerKey}
          onChange={(event) => setOwnerKey(event.target.value)}
          style={inputStyle}
        />
        <p style={hintStyle}>
          Typed fresh each visit — it is never saved on this device.
        </p>
      </div>

      <button
        type="submit"
        className="btn-primary"
        disabled={submitting}
        style={{ width: '100%', minHeight: '3.25rem', fontSize: '1rem' }}
      >
        {submitting ? 'Confirming…' : 'Confirm subscription'}
      </button>

      {outcome && (
        <div
          role={outcome.kind === 'success' ? 'status' : 'alert'}
          style={{
            ...outcomeBaseStyle,
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
