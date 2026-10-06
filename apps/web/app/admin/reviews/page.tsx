/**
 * G12 — Admin review moderation queue.
 * Store binding is NEEDS VERIFICATION; this page documents the planned
 * moderation contract (list / approve / reject / export — read-only here)
 * and renders the honest pending state.
 */
import type { Metadata } from 'next';
import { AdminGate } from '../../../components/admin/AdminGate';
import { AdminViewTracker } from '../../../components/admin/AdminViewTracker';
import { PendingBindingReviewStore } from '../../../lib/stores/operational-stores';

export const metadata: Metadata = {
  title: 'Admin — Reviews',
  description: 'Review moderation queue for Amber\'s Alchemy Apothecary (internal).',
  robots: { index: false, follow: false },
};

export default function AdminReviewsPage() {
  const binding = new PendingBindingReviewStore().binding();

  return (
    <AdminGate>
      <AdminViewTracker section="reviews" />
      <main aria-labelledby="admin-reviews-title">
        <h1 id="admin-reviews-title">Reviews — moderation queue</h1>
        <div role="status">
          <p>
            <strong>{binding.status}</strong> — {binding.detail}
          </p>
          <p>
            Legacy source: <code>reviews.mjs</code> → Netlify Blobs
            (list/stats/featured/create/helpful + admin list/update/delete/export).
            The queue will show pending reviews first, then newest — with
            approve / reject / export actions — once the store binds.
            Moderation actions stay behind the admin auth gate (rows 82–83).
          </p>
        </div>
        <section aria-label="Planned moderation contract">
          <h2>Planned contract (not wired)</h2>
          <ul>
            <li>
              <code>listModerationQueue()</code> — pending first, newest after
            </li>
            <li>approve / reject — admin-gated, audit-logged</li>
            <li>export — CSV of approved reviews for social proof</li>
          </ul>
          <p>No review is ever fabricated; empty queues render as empty.</p>
        </section>
        <p>
          <a href="/admin">← Back to overview</a>
        </p>
      </main>
    </AdminGate>
  );
}
