/**
 * G12 — Admin overview (read-only operations dashboard).
 * Gated by <AdminGate>; real auth/RLS NEEDS VERIFICATION (lib/admin/auth.ts).
 */
import type { Metadata } from 'next';
import { AdminGate } from '../../components/admin/AdminGate';
import { AdminViewTracker } from '../../components/admin/AdminViewTracker';
import { defaultOrderStore, JsonlOrderStore } from '../../lib/stores/order-store';
import {
  PendingBindingQuizLeadStore,
  PendingBindingReviewStore,
  PendingBindingSubmissionStore,
  PendingBindingSubscriberStore,
} from '../../lib/stores/operational-stores';

export const metadata: Metadata = {
  title: 'Admin — Overview',
  description: 'Operations overview for Amber\'s Alchemy Apothecary (internal).',
  robots: { index: false, follow: false },
};

const SECTIONS = [
  { href: '/admin/orders', name: 'Orders', desc: 'Read-only order ledger (local JSONL until Supabase binding).' },
  { href: '/admin/leads', name: 'Leads', desc: 'Quiz lead capture — store binding pending.' },
  { href: '/admin/reviews', name: 'Reviews', desc: 'Moderation queue — store binding pending.' },
  { href: '/admin/broadcast', name: 'Broadcast', desc: 'Composer UI only — sending disabled.' },
];

export default async function AdminOverviewPage() {
  const store = defaultOrderStore();
  const orders = await store.listOrders({ limit: 1000 });
  const issues = store instanceof JsonlOrderStore ? store.getParseIssues() : [];

  const bindings = [
    { name: 'Orders', binding: { status: 'jsonl_ledger' as const, detail: 'Local JSONL ledger — read-only until the Supabase order pipeline (G3) binds.' } },
    { name: 'Quiz leads', binding: new PendingBindingQuizLeadStore().binding() },
    { name: 'Reviews', binding: new PendingBindingReviewStore().binding() },
    { name: 'Submissions', binding: new PendingBindingSubmissionStore().binding() },
    { name: 'Subscribers', binding: new PendingBindingSubscriberStore().binding() },
  ];

  return (
    <AdminGate>
      <AdminViewTracker section="overview" />
      <main aria-labelledby="admin-overview-title">
        <h1 id="admin-overview-title">Admin — Operations Overview</h1>
        <p>
          Read-only operations views for Amber&apos;s Alchemy Apothecary.
          The order ledger is the server-written JSONL until the Supabase
          pipeline binds; every other store is pending.
        </p>

        <section aria-label="Summary">
          <h2>Summary</h2>
          <dl>
            <div>
              <dt>Orders in local ledger</dt>
              <dd>{orders.length}</dd>
            </div>
            <div>
              <dt>Ledger parse issues</dt>
              <dd>{issues.length}</dd>
            </div>
          </dl>
          {issues.length > 0 && (
            <details>
              <summary>Ledger parse issues ({issues.length})</summary>
              <ul>
                {issues.map((i) => (
                  <li key={i.line}>
                    Line {i.line}: {i.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section aria-label="Sections">
          <h2>Sections</h2>
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a href={s.href}>{s.name}</a> — {s.desc}
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Store bindings">
          <h2>Store bindings</h2>
          <ul>
            {bindings.map((b) => (
              <li key={b.name}>
                <strong>{b.name}:</strong> {b.binding.status} — {b.binding.detail}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AdminGate>
  );
}
