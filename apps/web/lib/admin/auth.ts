/**
 * Admin access — REAL authentication (staged build, 2026-10-31).
 *
 * Replaces the G12 placeholder gate (denied-by-default + a dev preview
 * switch, with real auth listed as NEEDS VERIFICATION / pending a
 * Supabase binding that will never land — Supabase is dropped).
 *
 * The real mechanism reuses the existing customer account system:
 * - Identity comes from the account session cookie
 *   (`aa_account_session`), resolved server-side by
 *   lib/accounts/session.ts `resolveAccountSession` — HMAC-signed with
 *   ACCOUNT_SESSION_SECRET and confirmed against the account store.
 *   A valid signature alone never grants access; the store fold must
 *   say the session is issued, unrevoked, unexpired, and the account
 *   is not deleted.
 * - Authorization is a single-email allowlist: ONLY the normalized
 *   owner email (ADMIN_EMAIL) may see admin data. There is no
 *   password for admin, and none is created by this module — the
 *   owner signs in through the existing /account email-code flow.
 * - Every other outcome fails closed with NO admin data rendered:
 *   unsigned → sign-in prompt; signed-in non-admin → access denied.
 *
 * ADMIN_PREVIEW_ENABLED=1 remains available as a DEVELOPMENT PREVIEW
 * ONLY: it renders the views behind a persistent banner, is not
 * authentication, and must never be set in a deployed environment.
 *
 * SERVER-ONLY: reads cookies + server env. Never import from a
 * client component.
 */
import { cookies } from 'next/headers';
import { normalizeAccountEmail } from '../accounts/accounts';
import {
  ACCOUNT_SESSION_COOKIE,
  resolveAccountSession,
  type AccountSessionIdentity,
} from '../accounts/session';

/** The one email allowed into /admin (already in normalized form). */
export const ADMIN_EMAIL = 'dare2be4ree@gmail.com';

/** Binding status of admin auth — single source of truth. */
export const ADMIN_AUTH_STATUS = 'ACCOUNT_SESSION_ALLOWLIST' as const;

export type AdminAccessState =
  | 'admin'
  | 'signed_in_non_admin'
  | 'unsigned'
  | 'preview';

export interface AdminCheck {
  authorized: boolean;
  /** Discriminator for the gate UI (which denial/prompt to render). */
  state: AdminAccessState;
  /** Human-readable reason, rendered on the gate page. */
  reason: string;
  /** Present only when a non-auth bypass granted access. */
  via?: string;
  /** The resolved account email, when a session exists. */
  email?: string;
}

/** True when the (un-normalized) input is the allowlisted admin email. */
export function isAdminEmail(email: unknown): boolean {
  return normalizeAccountEmail(email) === ADMIN_EMAIL;
}

/**
 * Pure access evaluation for a resolved session identity (or null).
 * Exported separately from the cookie/session plumbing so the
 * allowlist law is unit-testable without a request context.
 */
export function evaluateAdminAccess(
  identity: Pick<AccountSessionIdentity, 'email'> | null,
): AdminCheck {
  if (!identity) {
    return {
      authorized: false,
      state: 'unsigned',
      reason:
        'Admin is owner-only. Sign in with an email code first — ' +
        'no admin data is shown before sign-in.',
    };
  }
  const email = normalizeAccountEmail(identity.email);
  if (isAdminEmail(email)) {
    return {
      authorized: true,
      state: 'admin',
      email,
      via: 'account session (email-code sign-in) for the allowlisted owner email',
      reason: 'Signed in as the allowlisted owner.',
    };
  }
  return {
    authorized: false,
    state: 'signed_in_non_admin',
    email,
    reason:
      'This account is signed in, but it is not the owner account. ' +
      'Admin data is only shown to the allowlisted owner email.',
  };
}

/** The dev-preview check, kept explicit and separate from real auth. */
export function checkAdminPreview(): AdminCheck | null {
  if (process.env.ADMIN_PREVIEW_ENABLED !== '1') return null;
  return {
    authorized: true,
    state: 'preview',
    via: 'ADMIN_PREVIEW_ENABLED=1 — development preview switch, NOT real authentication',
    reason:
      'Preview mode: admin views render for development only. Real ' +
      'authentication is the account-session allowlist (lib/admin/auth.ts); ' +
      'never deploy with ADMIN_PREVIEW_ENABLED set.',
  };
}

/**
 * Legacy sync helper retained for callers that only need the preview
 * answer. It NEVER grants real access on its own: without the preview
 * switch it reports unsigned/denied, and real authorization flows
 * through resolveAdminAccess().
 */
export function checkAdmin(): AdminCheck {
  return (
    checkAdminPreview() ?? {
      authorized: false,
      state: 'unsigned',
      reason:
        'No admin session was evaluated by this sync check. Real admin ' +
        'access requires resolveAdminAccess() with a live account session.',
    }
  );
}

/**
 * Full server-side admin resolution for a request: dev preview first
 * (explicit, bannered), otherwise the account session cookie resolved
 * against the account store, then the allowlist evaluation.
 * Fail-closed: any error resolving the session reads as unsigned.
 */
export async function resolveAdminAccess(): Promise<AdminCheck> {
  const preview = checkAdminPreview();
  if (preview) return preview;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value;
    const identity = token ? await resolveAccountSession(token) : null;
    return evaluateAdminAccess(identity);
  } catch {
    return evaluateAdminAccess(null);
  }
}

/** Label rendered on admin surfaces describing how access is granted. */
export const ADMIN_AUTH_MARKER =
  'Owner-only — access requires an account session for the allowlisted owner email. Development preview (ADMIN_PREVIEW_ENABLED) is not authentication and must never be deployed.' as const;
