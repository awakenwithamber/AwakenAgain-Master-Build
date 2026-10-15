/**
 * POST /api/account/sign-out — revoke the current session (Phase 3 Step 3).
 *
 * Revocation is an appended event in the account store, so the session
 * stops resolving immediately and everywhere. The cookie is cleared
 * either way; signing out while not signed in is a calm no-op.
 */
import { NextResponse } from 'next/server';
import {
  ACCOUNT_SESSION_COOKIE,
  accountSessionCookieOptions,
  resolveAccountSessionFromHeaders,
  revokeAccountSession,
} from '../../../../lib/accounts/session';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'account');
  if (limited) return limited;

  const identity = await resolveAccountSessionFromHeaders(request.headers);
  if (identity) {
    await revokeAccountSession(identity);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCOUNT_SESSION_COOKIE, '', {
    ...accountSessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
