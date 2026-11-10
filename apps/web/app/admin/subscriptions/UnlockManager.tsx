'use client';

/**
 * Owner tool for the Grimoire permanent-unlock LEGACY records
 * (Phase 2, Workstream 3; sales closed 2026-11-09): the request
 * history stays visible for the record, and revoke (refund /
 * chargeback on a past sale) still works via POST
 * /api/admin/grimoire/unlock. Granting is closed — the unlock is no
 * longer sold (owner decision 2026-11-09) and the admin route
 * refuses grant actions.
 *
 * SECRET HYGIENE (same rules as the other owner tools): the key lives
 * only in this component's state while typed — never persisted, never
 * in the URL, never logged — and is cleared on a 401.
 */
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { UnlockRequestRecord } from '../../../lib/grimoire/unlock-requests';

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

export function UnlockManager({
  requests,
  configured,
}: {
  requests: UnlockRequestRecord[];
  configured: boolean;
}) {
  const router = useRouter();
  const [requestId, setRequestId] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState<'refund' | 'chargeback'>('refund');
  const [ownerKey, setOwnerKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  const pending = requests.filter((r) => r.status === 'requested');
  const settled = requests.filter((r) => r.status !== 'requested');

  async function act(action: 'revoke') {
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    try {
      const res = await fetch('/api/admin/grimoire/unlock', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-owner-secret': ownerKey,
        },
        body: JSON.stringify({
          action,
          ...(requestId.trim() ? { request_id: requestId.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          reason,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        state?: string;
        errors?: string[];
      } | null;
      if (res.ok && data?.ok) {
        setOutcome({
          kind: 'success',
          message: 'Unlock revoked — the customer no longer has unlock access.',
        });
        router.refresh();
      } else if (res.status === 401) {
        setOwnerKey('');
        setOutcome({
          kind: 'error',
          message:
            'That owner key wasn\u2019t accepted, so nothing changed. Re-enter the key carefully and try again.',
        });
      } else if (res.status === 404 && !configured) {
        setOutcome({
          kind: 'error',
          message:
            'Unlock administration isn\u2019t switched on yet — the owner key hasn\u2019t been set up on the server (OWNER_ADMIN_SECRET).',
        });
      } else {
        setOutcome({
          kind: 'error',
          message:
            data?.errors?.[0] ?? 'That didn\u2019t go through — check the details and try again.',
        });
      }
    } catch {
      setOutcome({
        kind: 'error',
        message: 'Couldn\u2019t reach the site — nothing changed. Try again in a moment.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="admin-unlocks-title" style={{ marginTop: '2.5rem' }}>
      <h2 id="admin-unlocks-title">Permanent unlock — legacy requests (no longer sold)</h2>
      <p>
        The permanent unlock closed to new sales on 2026-11-09 — full
        Grimoire access now comes with the $7.77/month subscription
        while it is active. Requests recorded before the close are
        listed here for the record only; this tool now just revokes an
        unlock when a past sale is refunded or charged back.
      </p>

      {pending.length === 0 ? (
        <p>No unlock requests on record awaiting anything.</p>
      ) : (
        <table>
          <caption>Unlock requests recorded before sales closed</caption>
          <thead>
            <tr>
              <th scope="col">Request ID</th>
              <th scope="col">Customer</th>
              <th scope="col">Paying by</th>
              <th scope="col">Requested</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((r) => (
              <tr key={r.request_id}>
                <td>
                  <code>{r.request_id}</code>{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setRequestId(r.request_id);
                      setEmail(r.email);
                    }}
                  >
                    Use
                  </button>
                </td>
                <td>{r.email}</td>
                <td>
                  {r.payment_method === 'bookipi_invoice'
                    ? 'Bookipi invoice'
                    : 'Venmo / Cash App'}
                </td>
                <td>{r.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {settled.length > 0 ? (
        <p>
          <small>
            Settled:{' '}
            {settled
              .map((r) => `${r.request_id} (${r.email}) — ${r.status}`)
              .join(' · ')}
          </small>
        </p>
      ) : null}

      <form
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
        }}
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="unlock-request-id" style={labelStyle}>
            Request ID
          </label>
          <input
            id="unlock-request-id"
            type="text"
            autoComplete="off"
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            style={inputStyle}
            placeholder="UNLOCK-20261030-XXXXXX"
          />
        </div>
        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="unlock-email" style={labelStyle}>
            Customer email (if no request ID)
          </label>
          <input
            id="unlock-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="unlock-reason" style={labelStyle}>
            Revoke reason
          </label>
          <select
            id="unlock-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as 'refund' | 'chargeback')}
            style={inputStyle}
          >
            <option value="refund">Refund</option>
            <option value="chargeback">Chargeback</option>
          </select>
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="unlock-owner-key" style={labelStyle}>
            Owner key
          </label>
          <input
            id="unlock-owner-key"
            type="password"
            autoComplete="off"
            required
            value={ownerKey}
            onChange={(e) => setOwnerKey(e.target.value)}
            style={inputStyle}
          />
          <p style={{ margin: '0.45rem 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Typed fresh each visit — it is never saved on this device.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || !ownerKey}
            onClick={() => void act('revoke')}
            style={{ minHeight: '3.25rem', fontSize: '1rem', padding: '0 2rem' }}
          >
            {busy ? 'Working…' : 'Revoke unlock'}
          </button>
        </div>
      </form>

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
    </section>
  );
}
