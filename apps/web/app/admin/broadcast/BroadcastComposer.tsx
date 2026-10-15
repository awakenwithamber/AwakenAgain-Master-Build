'use client';

/**
 * Client composer for /admin/broadcast (owner-only tooling).
 *
 * Compose → audience preview → RECORD. There is deliberately no "send"
 * anywhere in this component: no email provider is bound to this app
 * (Phase 3), and the button below posts to POST /api/admin/broadcast,
 * which appends the broadcast to the drafts ledger with the status
 * 'recorded_not_sent' and an audience snapshot. The UI copy says
 * exactly that — recording is not sending, and this component never
 * claims otherwise.
 *
 * The endpoint enforces the owner secret server-side on every call.
 * SECRET HYGIENE (same rules as the other owner tools, guard-tested):
 * the key lives ONLY in this component's React state while typed — never
 * persisted, never in the URL, never sent to analytics or logged — and
 * is cleared when the server rejects it (401).
 */
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { BroadcastAudience } from '../../../lib/broadcast/broadcast';

type Outcome = { kind: 'success' | 'error'; message: string };

interface RecordResponse {
  ok?: boolean;
  broadcast_id?: string;
  delivery_status?: string;
  audience?: {
    newsletter_recipients: number;
    active_subscribers: number;
    total_recipients: number;
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

const hintStyle: CSSProperties = {
  margin: '0.45rem 0 0',
  fontSize: '0.9rem',
  color: 'var(--text-muted)',
};

export function BroadcastComposer({
  audience,
  configured,
}: {
  audience: BroadcastAudience;
  configured: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [ownerKey, setOwnerKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setOutcome(null);

    try {
      const response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-owner-secret': ownerKey,
        },
        body: JSON.stringify({ subject, body }),
      });
      const data = (await response
        .json()
        .catch(() => null)) as RecordResponse | null;
      const serverErrors = (data?.errors ?? []).filter(Boolean);

      if (response.ok && data?.ok) {
        setOutcome({
          kind: 'success',
          message: `Recorded — NOT sent. “${subject}” is saved as broadcast ${data.broadcast_id ?? ''} with an audience snapshot of ${data.audience?.total_recipients ?? audience.total_recipients} recipients. Nothing was emailed: delivery starts when an email provider is connected.`,
        });
        setSubject('');
        setBody('');
        router.refresh();
      } else if (response.status === 401) {
        setOwnerKey('');
        setOutcome({
          kind: 'error',
          message:
            "That owner key wasn't accepted, so nothing was recorded. Re-enter the key carefully and try again.",
        });
      } else if (response.status === 404) {
        setOutcome({
          kind: 'error',
          message:
            "Recording isn't switched on yet — the owner key hasn't been set up on the server (OWNER_ADMIN_SECRET), so nothing was saved.",
        });
      } else if (response.status === 422) {
        setOutcome({
          kind: 'error',
          message:
            serverErrors[0] ??
            'The broadcast needs both a subject and a message — check them and try again.',
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
    <form onSubmit={handleSubmit} aria-label="Broadcast composer">
      <section
        aria-label="Audience preview"
        style={{
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          padding: '1rem 1.1rem',
          marginBottom: '1.25rem',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Audience</h2>
        <p style={{ margin: '0.5rem 0' }}>
          Counted live from the real lists — consented newsletter signups
          plus active Living Grimoire subscribers, deduplicated:
        </p>
        <dl>
          <div>
            <dt style={{ display: 'inline', fontWeight: 600 }}>
              Newsletter subscribers:{' '}
            </dt>
            <dd style={{ display: 'inline', margin: 0 }}>
              {audience.newsletter_recipients}
            </dd>
          </div>
          <div>
            <dt style={{ display: 'inline', fontWeight: 600 }}>
              Active Grimoire subscribers:{' '}
            </dt>
            <dd style={{ display: 'inline', margin: 0 }}>
              {audience.active_subscribers}
            </dd>
          </div>
          <div>
            <dt style={{ display: 'inline', fontWeight: 600 }}>
              Total recipients:{' '}
            </dt>
            <dd style={{ display: 'inline', margin: 0 }}>
              {audience.total_recipients}
            </dd>
          </div>
        </dl>
      </section>

      <div style={{ marginBottom: '1.25rem' }}>
        <label htmlFor="broadcast-subject" style={labelStyle}>
          Subject
        </label>
        <input
          id="broadcast-subject"
          name="subject"
          type="text"
          required
          maxLength={150}
          placeholder="October apothecary news"
          autoComplete="off"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label htmlFor="broadcast-body" style={labelStyle}>
          Message
        </label>
        <textarea
          id="broadcast-body"
          name="body"
          required
          rows={8}
          maxLength={5000}
          placeholder="Write the message here… (plain text — it is recorded exactly as written)"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          style={{ ...inputStyle, minHeight: '10rem', resize: 'vertical' }}
        />
      </div>

      <div style={{ marginBottom: '1.5rem', maxWidth: '28rem' }}>
        <label htmlFor="broadcast-owner-key" style={labelStyle}>
          Owner key
        </label>
        <input
          id="broadcast-owner-key"
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
          {!configured &&
            ' Note: the key has not been set up on the server yet, so recording will be refused until it is.'}
        </p>
      </div>

      <button
        type="submit"
        className="btn-primary"
        disabled={submitting}
        style={{ minHeight: '3.25rem', fontSize: '1rem', padding: '0 2rem' }}
      >
        {submitting ? 'Recording…' : 'Record broadcast (does not send)'}
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
