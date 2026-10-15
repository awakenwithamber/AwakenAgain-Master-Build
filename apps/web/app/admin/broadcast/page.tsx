/**
 * Admin — Broadcast composer + recorded drafts (Phase 2).
 *
 * Legacy: admin.html email broadcast panel (weekly promo: gatherRecipients,
 * sendBulk, stats, unsubscribe tokens) → classified REBUILD as an
 * admin-triggered, audit-logged "promo broadcast job" (row 102).
 *
 * HONEST STATUS — read before trusting anything on this page:
 * - NO email provider is bound to this app (Phase 3 decision). There is
 *   no send path anywhere in the codebase, and nothing on this page
 *   sends email.
 * - What the composer DOES: records a composed broadcast, with an
 *   audience snapshot computed from the real stores (consented
 *   newsletter signups + active Living Grimoire subscribers,
 *   deduplicated), into the append-only broadcasts ledger via
 *   POST /api/admin/broadcast — status 'recorded_not_sent'. When a
 *   provider is bound, delivery consumes these drafts.
 * - Recording requires the owner secret server-side (the endpoint fails
 *   closed when OWNER_ADMIN_SECRET is unset); viewing takes the admin
 *   gate like the other operations pages.
 *
 * History: this page previously hid the composer behind
 * BROADCAST_COMPOSER_ENABLED and disabled its submit control outright.
 * That double-disable existed because there was no protected action to
 * offer; the record action now exists and is owner-secret protected, so
 * the env view-gate was retired with this build (2026-10-14). The
 * delivery disable is unchanged and remains absolute.
 */
import type { Metadata } from 'next';
import { AdminGate } from '../../../components/admin/AdminGate';
import { AdminViewTracker } from '../../../components/admin/AdminViewTracker';
import { ownerSecretConfigured } from '../../../lib/admin/owner-auth';
import {
  computeBroadcastAudience,
  readBroadcastDrafts,
} from '../../../lib/broadcast/broadcast';
import { BroadcastComposer } from './BroadcastComposer';

export const metadata: Metadata = {
  title: 'Admin — Broadcast',
  description:
    'Promotional broadcast composer — records drafts; delivery activates when an email provider is connected (internal).',
  robots: { index: false, follow: false },
};

// Audience counts + draft history must reflect the stores at request time.
export const dynamic = 'force-dynamic';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminBroadcastPage() {
  const audience = computeBroadcastAudience();
  const drafts = readBroadcastDrafts();
  const configured = ownerSecretConfigured();

  return (
    <AdminGate>
      <AdminViewTracker section="broadcast" />
      <main aria-labelledby="admin-broadcast-title">
        <h1 id="admin-broadcast-title">Broadcast — promo email</h1>
        <div
          role="note"
          style={{
            border: '2px dashed #d9a93c',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
          }}
        >
          <strong>Recording only — nothing on this page sends email.</strong>
          <p style={{ margin: '0.5rem 0 0' }}>
            No email provider is connected to this site yet. Composing and
            recording a broadcast below saves it, with its audience
            snapshot, for delivery later; delivery activates when an email
            provider is connected (Phase 3). A recorded broadcast has NOT
            been sent, and the history below labels it that way.
          </p>
        </div>

        <BroadcastComposer audience={audience} configured={configured} />

        <section aria-label="Recorded broadcasts" style={{ marginTop: '2.5rem' }}>
          <h2>Recorded broadcasts</h2>
          {drafts.length === 0 ? (
            <p>No broadcasts recorded yet.</p>
          ) : (
            <table>
              <caption>Recorded broadcasts, newest first — none have been sent</caption>
              <thead>
                <tr>
                  <th scope="col">Recorded</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Audience snapshot</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr key={draft.broadcast_id}>
                    <td>{formatDate(draft.created_at)}</td>
                    <td>{draft.subject}</td>
                    <td>{draft.audience_total} recipients</td>
                    <td>Recorded — not sent</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section aria-label="Delivery contract" style={{ marginTop: '2rem' }}>
          <h2>When delivery activates (Phase 3)</h2>
          <ul>
            <li>An email provider is bound — a provider decision, not a code default</li>
            <li>Recorded drafts above become sendable, oldest first, only by an explicit owner action</li>
            <li>Every send is audit-logged against its broadcast record</li>
            <li>Unsubscribe links honored in every message (legacy: unsubscribe flow)</li>
          </ul>
        </section>

        <p>
          <a href="/admin">← Back to overview</a>
        </p>
      </main>
    </AdminGate>
  );
}
