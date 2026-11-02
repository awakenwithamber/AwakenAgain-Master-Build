/**
 * Admin gate wrapper — server component (real auth, staged 2026-10-31).
 *
 * Every /admin page renders inside <AdminGate>. Access resolves
 * server-side through lib/admin/auth.ts `resolveAdminAccess()`:
 * the account session cookie is verified against the account store
 * and only the allowlisted owner email is authorized.
 *
 * Unauthorized requests NEVER see operational data:
 * - unsigned → a sign-in prompt linking to /account (email-code flow)
 * - signed-in non-admin → an access-denied page
 * - ADMIN_PREVIEW_ENABLED=1 → the views render behind a persistent
 *   development-preview banner (NOT authentication; never deploy it)
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { resolveAdminAccess, ADMIN_AUTH_MARKER } from '../../lib/admin/auth';

export async function AdminGate({ children }: { children: ReactNode }) {
  const check = await resolveAdminAccess();

  if (!check.authorized) {
    return (
      <main aria-labelledby="admin-gate-title">
        <h1 id="admin-gate-title">
          {check.state === 'unsigned'
            ? 'Admin — sign in required'
            : 'Admin — access denied'}
        </h1>
        <p role="status">{check.reason}</p>
        <p>
          <strong>{ADMIN_AUTH_MARKER}</strong>
        </p>
        {check.state === 'unsigned' ? (
          <p>
            <Link href="/account">Sign in to your account →</Link> Signing
            in uses an email code — there is no admin password. Only the
            owner account can open these pages.
          </p>
        ) : (
          <p>
            You are signed in, just not with the owner account. If this is
            your shop, sign out on <Link href="/account">your account
            page</Link> and sign back in with the owner email.
          </p>
        )}
      </main>
    );
  }

  if (check.state === 'preview') {
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

  return <>{children}</>;
}
