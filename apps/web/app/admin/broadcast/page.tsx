/**
 * G12 — Broadcast composer (UI ONLY).
 *
 * Legacy: admin.html email broadcast panel (weekly promo: gatherRecipients,
 * sendBulk, stats, unsubscribe tokens) → classified REBUILD as an
 * admin-triggered, audit-logged "promo broadcast job" (row 102).
 *
 * This page is the composer UI shell only. Sending is disabled behind TWO
 * layers, and neither can be bypassed from here:
 *  1. The send control is rendered permanently disabled — there is no code
 *     path in this app that sends bulk email (no provider selected:
 *     NEEDS VERIFICATION, G9 email jobs are a later contract).
 *  2. Even viewing the composer requires BROADCAST_COMPOSER_ENABLED=1;
 *     otherwise the page explains the UI-only status.
 *
 * No real email is sent by this page, ever.
 */
import type { Metadata } from 'next';
import { AdminGate } from '../../../components/admin/AdminGate';
import { AdminViewTracker } from '../../../components/admin/AdminViewTracker';

export const metadata: Metadata = {
  title: 'Admin — Broadcast',
  description: 'Promotional broadcast composer (UI only, sending disabled) — internal.',
  robots: { index: false, follow: false },
};

export default function AdminBroadcastPage() {
  const composerEnabled = process.env.BROADCAST_COMPOSER_ENABLED === '1';

  return (
    <AdminGate>
      <AdminViewTracker section="broadcast" />
      <main aria-labelledby="admin-broadcast-title">
        <h1 id="admin-broadcast-title">Broadcast — promo email composer</h1>
        <p>
          <strong>UI only. Sending is disabled.</strong> No email provider is
          selected (NEEDS VERIFICATION — see G9 email jobs). There is no code
          path in this app that sends bulk email.
        </p>

        {!composerEnabled ? (
          <div role="status">
            <p>
              The composer is hidden: set{' '}
              <code>BROADCAST_COMPOSER_ENABLED=1</code> to preview the composer
              UI in development. The send control stays disabled regardless —
              it is wired to nothing.
            </p>
          </div>
        ) : (
          <form aria-label="Broadcast composer (sending disabled)">
            <div>
              <label htmlFor="broadcast-subject">Subject</label>
              <input
                id="broadcast-subject"
                name="subject"
                type="text"
                placeholder="October apothecary news"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="broadcast-body">Message</label>
              <textarea
                id="broadcast-body"
                name="body"
                rows={8}
                placeholder="Write the promo message here…"
              />
            </div>
            <p>
              <small>
                Recipient list: subscriber store binding is NEEDS VERIFICATION —
                no list is loaded and no audience is assumed.
              </small>
            </p>
            <button type="submit" disabled aria-disabled="true" title="Sending is disabled: no email provider selected (NEEDS VERIFICATION).">
              Send broadcast (disabled)
            </button>
          </form>
        )}

        <section aria-label="Planned broadcast contract">
          <h2>Planned contract (not wired)</h2>
          <ul>
            <li>Admin-triggered only; every send audit-logged</li>
            <li>Unsubscribe tokens honored (legacy: unsubscribe flow)</li>
            <li>Unauthorized trigger rejected (contract test when wired)</li>
          </ul>
        </section>
        <p>
          <a href="/admin">← Back to overview</a>
        </p>
      </main>
    </AdminGate>
  );
}
