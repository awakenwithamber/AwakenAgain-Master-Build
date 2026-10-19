'use client';

/**
 * Client manager for /admin/subscriptions (owner-only tooling).
 *
 * Renders the member list the server read from the subscription ledger
 * and performs the two owner actions:
 * - Confirm payment → POST /api/admin/subscriptions/confirm (the
 *   EXISTING endpoint — this component adds no second confirm path).
 * - Cancel membership → POST /api/admin/subscriptions/cancel.
 *
 * Both endpoints enforce the owner secret server-side on every call;
 * this component just presents it. SECRET HYGIENE (same rules as the
 * standalone confirm form, guard-tested): the key lives ONLY in this
 * component's React state while typed. It is never persisted (no
 * browser storage, no cookies, never in the URL) and never sent to
 * analytics or logged. It is cleared when the server rejects it (401).
 *
 * After a successful action the route refreshes (router.refresh) so the
 * list re-reads the append-only ledger server-side — the UI never
 * patches its own copy of the truth.
 */
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { SubscriptionMember } from '../../../lib/subscriptions/members';

type ActionKind = 'confirm' | 'cancel';

type Outcome = { kind: 'success' | 'error'; message: string };

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

const STATUS_LABEL: Record<SubscriptionMember['status'], string> = {
  pending_payment: 'Pending payment',
  active: 'Active',
  cancelled: 'Cancelled',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function SubscriberManager({
  members,
  configured,
}: {
  members: SubscriptionMember[];
  configured: boolean;
}) {
  const router = useRouter();
  const [ownerKey, setOwnerKey] = useState('');
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function runAction(member: SubscriptionMember, kind: ActionKind) {
    if (busyEmail) return;
    if (!ownerKey) {
      setOutcome({
        kind: 'error',
        message:
          'Enter your owner key above first — every change is checked against it on the server.',
      });
      return;
    }
    setBusyEmail(member.email);
    setOutcome(null);

    const path =
      kind === 'confirm'
        ? '/api/admin/subscriptions/confirm'
        : '/api/admin/subscriptions/cancel';

    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-owner-secret': ownerKey,
        },
        body: JSON.stringify({ email: member.email }),
      });
      const data = (await response
        .json()
        .catch(() => null)) as {
        ok?: boolean;
        status?: string;
        errors?: string[];
      } | null;
      const serverErrors = (data?.errors ?? []).filter(Boolean);

      if (response.ok && data?.ok) {
        setOutcome({
          kind: 'success',
          message:
            kind === 'confirm'
              ? `Done — ${member.email} is now an active Living Grimoire of Light & Magic member. Subscriber benefits apply at checkout right away.`
              : `Done — the membership for ${member.email} is cancelled. Subscriber benefits no longer apply to that email.`,
        });
        // Re-read the ledger server-side; the list is the truth.
        router.refresh();
      } else if (response.status === 401) {
        setOwnerKey('');
        setOutcome({
          kind: 'error',
          message:
            "That owner key wasn't accepted, so nothing was changed. Re-enter the key carefully and try again.",
        });
      } else if (response.status === 404) {
        if (!configured || serverErrors.includes('Not found.')) {
          setOutcome({
            kind: 'error',
            message:
              "Membership changes aren't switched on yet — the owner key hasn't been set up on the server (OWNER_ADMIN_SECRET).",
          });
        } else {
          setOutcome({
            kind: 'error',
            message:
              serverErrors[0] ??
              `No subscription found for ${member.email}. The list may have changed — it has been reloaded.`,
          });
          router.refresh();
        }
      } else if (response.status === 409) {
        setOutcome({
          kind: 'error',
          message:
            serverErrors[0] ??
            'That membership is cancelled and cannot be confirmed. If they want to rejoin, they will need to subscribe again.',
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
      setBusyEmail(null);
    }
  }

  function handleKeySubmit(event: FormEvent<HTMLFormElement>) {
    // The key form never submits anywhere — it only holds the key in
    // state for the action buttons. Prevent the default navigation.
    event.preventDefault();
  }

  return (
    <div>
      <form
        onSubmit={handleKeySubmit}
        aria-label="Owner key for membership actions"
        style={{ marginBottom: '1.5rem', maxWidth: '28rem' }}
      >
        <label htmlFor="subscriber-manager-owner-key" style={labelStyle}>
          Owner key
        </label>
        <input
          id="subscriber-manager-owner-key"
          name="owner-key"
          type="password"
          autoComplete="off"
          value={ownerKey}
          onChange={(event) => setOwnerKey(event.target.value)}
          style={inputStyle}
        />
        <p style={hintStyle}>
          Typed fresh each visit — it is never saved on this device. The
          Confirm and Cancel buttons send it to the server, which checks
          it on every action.
        </p>
      </form>

      {outcome && (
        <div
          role={outcome.kind === 'success' ? 'status' : 'alert'}
          style={{
            marginBottom: '1.25rem',
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

      {members.length === 0 ? (
        <p>No Living Grimoire of Light & Magic subscriptions in the ledger yet.</p>
      ) : (
        <table>
          <caption>
            Living Grimoire of Light & Magic members, from the subscription ledger (latest
            record per member wins)
          </caption>
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Status</th>
              <th scope="col">Signed up</th>
              <th scope="col">Confirmed</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.email}>
                <td>
                  {member.name}
                  <br />
                  <small>{member.email}</small>
                </td>
                <td>{STATUS_LABEL[member.status]}</td>
                <td>{formatDate(member.signed_up_at)}</td>
                <td>
                  {member.status === 'cancelled'
                    ? `Cancelled ${formatDate(member.cancelled_at)}`
                    : formatDate(member.confirmed_at)}
                </td>
                <td>
                  {member.status === 'pending_payment' && (
                    <button
                      type="button"
                      onClick={() => runAction(member, 'confirm')}
                      disabled={busyEmail !== null}
                      style={{ marginRight: '0.5rem', minHeight: '2.75rem' }}
                    >
                      {busyEmail === member.email
                        ? 'Working…'
                        : 'Confirm payment'}
                    </button>
                  )}
                  {member.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => runAction(member, 'cancel')}
                      disabled={busyEmail !== null}
                      style={{ minHeight: '2.75rem' }}
                    >
                      Cancel membership
                    </button>
                  )}
                  {member.status === 'cancelled' && (
                    <small>—</small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
