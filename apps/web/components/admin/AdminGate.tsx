/**
 * Admin gate wrapper (G12) — server component.
 *
 * Every /admin page renders inside <AdminGate>. While real auth/RLS is
 * NEEDS VERIFICATION, unauthorized requests see the denial + marker and
 * NEVER any operational data. With ADMIN_PREVIEW_ENABLED=1 the views render
 * for development preview behind a persistent NEEDS VERIFICATION banner.
 */
import type { ReactNode } from 'react';
import { checkAdmin, ADMIN_AUTH_MARKER } from '../../lib/admin/auth';

export function AdminGate({ children }: { children: ReactNode }) {
  const check = checkAdmin();

  if (!check.authorized) {
    return (
      <main aria-labelledby="admin-gate-title">
        <h1 id="admin-gate-title">Admin — access denied</h1>
        <p role="status">{check.reason}</p>
        <p>
          <strong>{ADMIN_AUTH_MARKER}</strong>
        </p>
        <p>
          Legacy admin credentials were not migrated: the old
          ADMIN_PASSWORD + JWT scheme is classified REBUILD and stays in the
          legacy system until Web Crypto JWT + Supabase RLS lands.
        </p>
      </main>
    );
  }

  return (
    <>
      <div
        role="note"
        aria-label="Admin auth verification status"
        style={{
          border: '2px dashed #d9a93c',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
        }}
      >
        <strong>{ADMIN_AUTH_MARKER}</strong>
        <p style={{ margin: '0.5rem 0 0' }}>
          Access granted via: {check.via}. This is a development preview —
          never deploy with ADMIN_PREVIEW_ENABLED set.
        </p>
      </div>
      {children}
    </>
  );
}
