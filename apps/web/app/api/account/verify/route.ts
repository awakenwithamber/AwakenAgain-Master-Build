/**
 * POST /api/account/verify — complete account sign-in (Phase 3 Step 3).
 *
 * Verifies the 6-digit code (single use, attempt-capped — see
 * lib/accounts/otp.ts), then:
 * - a DELETED account is refused (403, honest) — the tombstone is
 *   terminal and no session is issued;
 * - a first-time email gets its account (one 'account.created' event);
 * - a signed session is created in the account store and returned as
 *   the HttpOnly aa_account_session cookie.
 *
 * NO entitlement check lives here, deliberately: an account is not a
 * Living Grimoire membership and this session grants no Grimoire
 * access (that gate keeps its own OTP + entitlement check).
 */
import { NextResponse } from 'next/server';
import {
  accountOtpStore,
  verifyAccountCode,
} from '../../../../lib/accounts/otp';
import {
  ACCOUNT_SESSION_COOKIE,
  ACCOUNT_SESSION_TTL_SECONDS,
  accountSessionCookieOptions,
  accountSessionsConfigured,
  createAccountSession,
} from '../../../../lib/accounts/session';
import {
  ensureAccountAsync,
  loadAccountAsync,
} from '../../../../lib/accounts/accounts';
import {
  accountFail,
  isRecordBody,
  readJsonBody,
  SIGNIN_UNAVAILABLE_MESSAGE,
} from '../../../../lib/accounts/http';
import { captureContentServerEventSoon } from '../../../../lib/analytics/content-posthog-server';
import { resolveServerDistinctId } from '../../../../lib/analytics/posthog-server';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

const REASON_MESSAGES: Record<string, string> = {
  not_found: 'That code request was not found. Request a new code.',
  expired: 'That code has expired. Request a new code.',
  consumed: 'That code was already used. Request a new code.',
  too_many_attempts: 'Too many attempts. Request a new code.',
  mismatch: 'That code does not match. Try again.',
};

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'account-auth');
  if (limited) return limited;

  if (!accountSessionsConfigured()) {
    return accountFail([SIGNIN_UNAVAILABLE_MESSAGE], 503);
  }

  const body = await readJsonBody(request);
  if (!isRecordBody(body)) {
    return accountFail(['Request body must be a JSON object.'], 400);
  }

  const verified = await verifyAccountCode(
    accountOtpStore,
    body.request_id,
    body.code,
  );
  if (!verified.ok) {
    return accountFail(
      [REASON_MESSAGES[verified.reason] ?? 'Verification failed.'],
      401,
    );
  }

  const email = verified.email;
  const before = await loadAccountAsync(email);
  if (before.deleted) {
    return accountFail(
      [
        'This account was deleted, so it can no longer sign in. ' +
          'If this was a mistake, reach out through the contact page.',
      ],
      403,
    );
  }
  const isNewAccount = !before.exists;
  if (isNewAccount) {
    await ensureAccountAsync(email);
  }

  const session = await createAccountSession(email);

  captureContentServerEventSoon(
    'account_signin_completed',
    { is_new_account: isNewAccount },
    resolveServerDistinctId(
      request.headers.get('cookie'),
      `account-session:${session.session_id.slice(0, 12)}`,
    ),
  );

  const response = NextResponse.json({
    ok: true,
    email,
    is_new_account: isNewAccount,
    expires_at: session.expires_at,
  });
  response.cookies.set(
    ACCOUNT_SESSION_COOKIE,
    session.token,
    accountSessionCookieOptions(ACCOUNT_SESSION_TTL_SECONDS),
  );
  return response;
}
