/**
 * Admin — Living Grimoire subscribers (Phase 2 management view).
 *
 * Lists every member from the subscription ledger with their latest-line
 * status (lib/subscriptions/members.ts — the same append-only ledger the
 * entitlement lookup trusts), and wires the two owner actions:
 * - Confirm payment → the EXISTING POST /api/admin/subscriptions/confirm.
 * - Cancel membership → POST /api/admin/subscriptions/cancel.
 * Both endpoints enforce the owner secret server-side; this page only
 * presents it (typed fresh, kept in client state only — see
 * SubscriberManager).
 *
 * VIEWING is behind <AdminGate> like the other operations views. Note
 * the asymmetry, and why it is safe: the standalone confirmation page
 * (/admin/subscriptions/confirm) deliberately skips the gate because it
 * renders no data and the endpoint is the real lock; this page DOES
 * render member data, so it takes the gate for viewing — while every
 * WRITE still requires the owner key, gate or no gate.
 */
import type { Metadata } from 'next';
import { AdminGate } from '../../../components/admin/AdminGate';
import { AdminViewTracker } from '../../../components/admin/AdminViewTracker';
import { ownerSecretConfigured } from '../../../lib/admin/owner-auth';
import { listSubscriptionMembersAsync } from '../../../lib/subscriptions/members';
import { SubscriberManager } from './SubscriberManager';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Admin — Subscriptions',
  description:
    'Living Grimoire of Light & Magic member management for Amber\'s Alchemy Apothecary (internal).',
  robots: { index: false, follow: false },
};

// The member list must reflect the ledger at request time, never a
// build-time snapshot.
export const dynamic = 'force-dynamic';

export default async function AdminSubscriptionsPage() {
  const members = await listSubscriptionMembersAsync();
  const configured = ownerSecretConfigured();

  return (
    <AdminGate>
      <AdminViewTracker section="subscriptions" />
      <main aria-labelledby="admin-subscriptions-title">
        <h1 id="admin-subscriptions-title">Subscriptions — Living Grimoire of Light & Magic</h1>
        <p>
          Every member who signed up for the Living Grimoire of Light & Magic, resolved
          from the subscription ledger ({members.length} shown). A member
          becomes <strong>active</strong> only when you confirm their
          first payment; subscriber benefits (free shipping on every
          order + 10% off) apply at checkout only while the latest record
          is active.
        </p>

        {!configured && (
          <div
            role="note"
            style={{
              border: '2px dashed #d9a93c',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
            }}
          >
            <strong>Membership changes aren&apos;t switched on yet.</strong>
            <p style={{ margin: '0.5rem 0 0' }}>
              The owner key hasn&apos;t been set up on the server
              (OWNER_ADMIN_SECRET), so Confirm and Cancel will be refused
              until it is. The list above is unaffected.
            </p>
          </div>
        )}

        <SubscriberManager members={members} configured={configured} />

        <p>
          Prefer the single-purpose tool?{' '}
          <Link href="/admin/subscriptions/confirm">
            Confirm a subscription by email →
          </Link>
        </p>
        <p>
          <Link href="/admin">← Back to overview</Link>
        </p>
      </main>
    </AdminGate>
  );
}
