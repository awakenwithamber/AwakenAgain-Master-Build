/**
 * Admin — Analytics (staged build, 2026-10-31).
 *
 * Real state only, composed by lib/admin/analytics.ts from the stores
 * this app actually holds. Anything unbound or unreadable reads
 * UNKNOWN — no metric is fabricated, mirrored, or estimated, and no
 * PII or payment data appears here (counts and statuses only).
 *
 * PostHog is the live analytics system: this page states whether its
 * receipt can be confirmed from this server and links out to PostHog
 * for live events and funnels. Payment-rail status is stated exactly
 * as current canon: Bluevine Stripe-free invoicing is live; there is
 * NO live card rail.
 *
 * Gated by <AdminGate> (account-session allowlist) like every
 * other /admin page.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminGate } from '../../../components/admin/AdminGate';
import { AdminViewTracker } from '../../../components/admin/AdminViewTracker';
import { defaultOrderStore, JsonlOrderStore } from '../../../lib/stores/order-store';
import {
  PendingBindingQuizLeadStore,
  PendingBindingReviewStore,
  PendingBindingSubmissionStore,
  PendingBindingSubscriberStore,
} from '../../../lib/stores/operational-stores';
import { listSubscriptionMembersAsync } from '../../../lib/subscriptions/members';
import { readBroadcastDraftsAsync } from '../../../lib/broadcast/broadcast';
import {
  buildAdminAnalyticsSummary,
  posthogConfigured,
} from '../../../lib/admin/analytics';

export const metadata: Metadata = {
  alternates: { canonical: '/admin/analytics' },
  title: 'Admin — Analytics',
  description: 'Real-state analytics summary for Amber\'s Alchemy Apothecary (internal).',
  robots: { index: false, follow: false },
};

// Counts render from the live stores at request time, never a
// build-time snapshot.
export const dynamic = 'force-dynamic';

async function loadSummary() {
  let ordersCount: number | null = null;
  let orderParseIssues: number | null = null;
  try {
    const store = defaultOrderStore();
    const orders = await store.listOrders({ limit: 1000 });
    ordersCount = orders.length;
    orderParseIssues = store instanceof JsonlOrderStore ? store.getParseIssues().length : null;
  } catch {
    ordersCount = null;
  }

  let memberCount: number | null = null;
  try {
    memberCount = (await listSubscriptionMembersAsync()).length;
  } catch {
    memberCount = null;
  }

  let broadcastCount: number | null = null;
  try {
    broadcastCount = (await readBroadcastDraftsAsync()).length;
  } catch {
    broadcastCount = null;
  }

  return buildAdminAnalyticsSummary({
    ordersCount,
    orderParseIssues,
    subscriptionMemberCount: memberCount,
    broadcastRecordedCount: broadcastCount,
    leadsBindingDetail: new PendingBindingQuizLeadStore().binding().detail,
    reviewsBindingDetail: new PendingBindingReviewStore().binding().detail,
    submissionsBindingDetail: new PendingBindingSubmissionStore().binding().detail,
    subscribersBindingDetail: new PendingBindingSubscriberStore().binding().detail,
    posthogConfigured: posthogConfigured(),
  });
}

export default async function AdminAnalyticsPage() {
  const summary = await loadSummary();

  return (
    <AdminGate>
      <AdminViewTracker section="analytics" />
      <main aria-labelledby="admin-analytics-title">
        <h1 id="admin-analytics-title">Analytics — real state only</h1>
        <p>
          Counts below come from this site&apos;s own stores at the moment
          this page loaded. Anything that could not be checked reads
          UNKNOWN. Visitor analytics (live events, funnels, journeys)
          live in PostHog — this page never mirrors or invents them.
        </p>

        <section aria-label="Store counts">
          <h2>Stores</h2>
          <dl>
            <div>
              <dt>Orders in ledger</dt>
              <dd>
                {summary.orders.status === 'KNOWN'
                  ? summary.orders.count
                  : 'UNKNOWN'}
                {summary.orders.status === 'KNOWN' &&
                summary.orders.parseIssues !== null
                  ? ` (ledger parse issues: ${summary.orders.parseIssues})`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Living Grimoire members (subscription ledger)</dt>
              <dd>
                {summary.subscriptions.status === 'KNOWN'
                  ? summary.subscriptions.memberCount
                  : 'UNKNOWN'}
              </dd>
            </div>
            <div>
              <dt>Quiz leads</dt>
              <dd>UNKNOWN — {summary.leads.detail}</dd>
            </div>
            <div>
              <dt>Reviews moderation queue</dt>
              <dd>UNKNOWN — {summary.reviews.detail}</dd>
            </div>
            <div>
              <dt>Form submissions</dt>
              <dd>UNKNOWN — {summary.submissions.detail}</dd>
            </div>
            <div>
              <dt>Subscribers store</dt>
              <dd>UNKNOWN — {summary.subscribersStore.detail}</dd>
            </div>
            <div>
              <dt>Broadcasts recorded (never sent from this site)</dt>
              <dd>
                {summary.broadcasts.status === 'KNOWN'
                  ? `${summary.broadcasts.recordedCount} — delivery status: ${summary.broadcasts.deliveryStatus}`
                  : 'UNKNOWN'}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-label="Payment rail status">
          <h2>Payment rail</h2>
          <p>{summary.paymentRail.live}</p>
          <p>
            <strong>{summary.paymentRail.cardRail}</strong>
          </p>
        </section>

        <section aria-label="PostHog status">
          <h2>PostHog</h2>
          <p>
            Status: <strong>{summary.posthog.status}</strong> —{' '}
            {summary.posthog.detail}
          </p>
          <p>
            <a href={summary.posthog.dashboardUrl} target="_blank" rel="noreferrer">
              Open PostHog (live events &amp; funnels) →
            </a>
          </p>
        </section>

        <p>
          <Link href="/admin">← Back to overview</Link>
        </p>
      </main>
    </AdminGate>
  );
}
