/**
 * G12 — Admin leads view.
 * The quiz-lead store is NEEDS VERIFICATION (Supabase binding pending), so
 * this page renders the honest pending state — never fabricated lead rows.
 */
import type { Metadata } from 'next';
import { AdminGate } from '../../../components/admin/AdminGate';
import { AdminViewTracker } from '../../../components/admin/AdminViewTracker';
import { PendingBindingQuizLeadStore } from '../../../lib/stores/operational-stores';

export const metadata: Metadata = {
  title: 'Admin — Leads',
  description: 'Quiz lead list for Amber\'s Alchemy Apothecary (internal).',
  robots: { index: false, follow: false },
};

export default function AdminLeadsPage() {
  const binding = new PendingBindingQuizLeadStore().binding();

  return (
    <AdminGate>
      <AdminViewTracker section="leads" />
      <main aria-labelledby="admin-leads-title">
        <h1 id="admin-leads-title">Leads</h1>
        <div role="status">
          <p>
            <strong>{binding.status}</strong> — {binding.detail}
          </p>
          <p>
            Legacy source: <code>quiz-lead.mjs</code> → Netlify Blobs. The
            export has not been performed; no lead rows exist in this app yet.
            This page will list quiz leads (email, first name, SMS opt-in,
            quiz result, date) once the <code>quiz_leads</code> table binds.
          </p>
        </div>
        <p>
          <a href="/admin">← Back to overview</a>
        </p>
      </main>
    </AdminGate>
  );
}
