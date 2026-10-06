/**
 * Admin access gate — NEEDS VERIFICATION (real auth/RLS pending Supabase binding).
 *
 * G12 lands the read-only operations views first. The legacy admin auth
 * (`api/admin.js`: ADMIN_PASSWORD + 12h JWT via `jsonwebtoken`) is classified
 * REBUILD → Web Crypto JWT + Supabase RLS (CONVERSION_MAP §11 rows 99–101),
 * and that replacement does NOT exist yet. This module is the explicit,
 * honest gate in front of every /admin page:
 *
 * - DEFAULT: DENIED. The check returns { authorized: false } with the reason
 *   spelled out, and every admin page renders the denial + the
 *   NEEDS VERIFICATION marker instead of any data.
 * - ADMIN_PREVIEW_ENABLED=1 (env): allows rendering the UI for development
 *   preview ONLY. This is NOT authentication — it is a preview switch, it
 *   must never be set in any deployed environment, and pages still carry the
 *   NEEDS VERIFICATION banner while it is on.
 *
 * Nothing here invents real auth: no passwords are read, no tokens minted,
 * no sessions created. Real auth arrives with the Supabase binding.
 */

/** Binding status of the real admin auth — single source of truth. */
export const ADMIN_AUTH_STATUS = 'NEEDS_VERIFICATION' as const;

export interface AdminCheck {
  authorized: boolean;
  /** Human-readable reason, rendered on the gate page. */
  reason: string;
  /** Present only when a non-auth bypass granted access. */
  via?: string;
}

/**
 * Evaluate admin access for the current request context.
 * Sync + env-based so Server Components can call it directly.
 */
export function checkAdmin(): AdminCheck {
  if (process.env.ADMIN_PREVIEW_ENABLED === '1') {
    return {
      authorized: true,
      via: 'ADMIN_PREVIEW_ENABLED=1 — development preview switch, NOT real authentication',
      reason:
        'Preview mode: admin views render for development only. Real authentication ' +
        '(Web Crypto JWT + Supabase RLS) is NEEDS VERIFICATION and must land before ' +
        'any deployed use.',
    };
  }
  return {
    authorized: false,
    reason:
      'Admin access is denied by default: real authentication + RLS are NEEDS VERIFICATION ' +
      '(pending Supabase binding). The legacy ADMIN_PASSWORD + jsonwebtoken scheme is ' +
      'classified REBUILD and is not carried into this app.',
  };
}

/** Label rendered on every admin surface while auth is unverified. */
export const ADMIN_AUTH_MARKER =
  'NEEDS VERIFICATION — admin auth/RLS pending Supabase binding. Views are read-only previews.' as const;
