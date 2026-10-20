/**
 * Owner subscription confirmation — /admin/subscriptions/confirm.
 *
 * OWNER-ONLY BRIDGE UI until Phase 2 real admin auth replaces it. The
 * credential is the owner key itself: the form sends it as the
 * `x-owner-secret` header to POST /api/admin/subscriptions/confirm,
 * which verifies it server-side against OWNER_ADMIN_SECRET and fails
 * closed when that is unset. Never persist the key client-side — it
 * exists only in the form's state while typed (see the form component).
 *
 * Deliberately NOT wrapped in <AdminGate>: that gate is a development
 * preview toggle (ADMIN_PREVIEW_ENABLED), not authentication — the
 * endpoint's own header comment rejects it for the same reason — and it
 * would lock the owner out in production. This page renders no
 * operational data; it is only a form, and the endpoint enforces the
 * secret on every submission.
 *
 * Reachable only by typing the URL directly: it is linked from no
 * navigation, footer, or admin index, carries noindex/nofollow
 * metadata, and is absent from the sitemap (the sitemap is built from
 * the CANONICAL_ROUTES registry, which has no /admin entries).
 *
 * SERVER COMPONENT: reads only WHETHER OWNER_ADMIN_SECRET is set (a
 * boolean, never the value) so it can warn when confirmation is not
 * switched on. The form renders either way.
 */
import type { Metadata } from 'next';
import { ConfirmSubscriptionForm } from './ConfirmSubscriptionForm';

export const metadata: Metadata = {
  title: 'Admin — Confirm subscription',
  description:
    'Owner tool: activate a paid Living Grimoire of Light & Magic subscription (internal).',
  robots: { index: false, follow: false },
};

// The configured check must be evaluated per request, not baked in at
// build time, so the notice tracks the live server env.
export const dynamic = 'force-dynamic';

export default function ConfirmSubscriptionPage() {
  const configured = Boolean(process.env.OWNER_ADMIN_SECRET);

  return (
    <main
      aria-labelledby="confirm-subscription-title"
      style={{
        maxWidth: '36rem',
        margin: '0 auto',
        padding: '2rem 1.25rem 3rem',
      }}
    >
      <h1 id="confirm-subscription-title">Confirm a subscription</h1>
      <p>
        Use this after a member has paid for their Living Grimoire of Light & Magic
        subscription outside the site (for example, by an emailed
        invoice). Enter the email they subscribed with and your owner
        key — their membership switches to active, and subscriber
        benefits apply at checkout from then on.
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
          <strong>Confirmation isn&apos;t switched on yet.</strong>
          <p style={{ margin: '0.5rem 0 0' }}>
            The owner key hasn&apos;t been set up on the server
            (OWNER_ADMIN_SECRET), so submissions will be refused until it
            is. The form below will work the moment the key exists.
          </p>
        </div>
      )}

      <section
        aria-label="Confirmation form"
        style={{
          backgroundColor: 'var(--plum-mid)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
        }}
      >
        <ConfirmSubscriptionForm configured={configured} />
      </section>
    </main>
  );
}
