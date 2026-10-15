/**
 * POST /api/account/request-code — begin account sign-in (Phase 3 Step 3).
 *
 * Issues a 6-digit code for the email and routes it through the
 * EmailProvider abstraction — the ONLY delivery channel. While the
 * logging preview provider is bound (no real sends), the response says
 * delivery:'preview' so the UI can be honest that the code cannot reach
 * an inbox yet; it never claims a send happened.
 *
 * Fail-closed: when ACCOUNT_SESSION_SECRET is not configured on this
 * server, sign-in is unavailable (503) and NO code is issued — a code
 * nobody can exchange for a session would only confuse. Deleted
 * (tombstoned) accounts get an honest 403: they cannot sign in again.
 *
 * The code is never logged, never returned, never in analytics.
 */
import { NextResponse } from 'next/server';
import {
  accountOtpStore,
  requestAccountCode,
  ACCOUNT_OTP_TTL_SECONDS,
} from '../../../../lib/accounts/otp';
import {
  accountSessionsConfigured,
} from '../../../../lib/accounts/session';
import {
  loadAccountAsync,
  normalizeAccountEmail,
} from '../../../../lib/accounts/accounts';
import {
  accountFail,
  isRecordBody,
  readJsonBody,
  SIGNIN_UNAVAILABLE_MESSAGE,
} from '../../../../lib/accounts/http';
import { sanitizeEmail } from '../../../../lib/security/validation';
import {
  buildAccountSigninCodeJob,
  createEmailProvider,
  emailDeliveryIsPreview,
} from '../../../../lib/jobs/email';
import { captureContentServerEventSoon } from '../../../../lib/analytics/content-posthog-server';
import { resolveServerDistinctId } from '../../../../lib/analytics/posthog-server';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

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
  const email = sanitizeEmail(body.email);
  if (!email) {
    return accountFail(['Please provide a valid email address.']);
  }

  const state = await loadAccountAsync(email);
  if (state.deleted) {
    return accountFail(
      [
        'This account was deleted, so it can no longer sign in. ' +
          'If this was a mistake, reach out through the contact page.',
      ],
      403,
    );
  }

  let issued: Awaited<ReturnType<typeof requestAccountCode>>;
  try {
    issued = await requestAccountCode(accountOtpStore, email);
  } catch (err) {
    return accountFail([
      err instanceof Error ? err.message : 'Could not issue a code.',
    ]);
  }

  // Delivery — through the provider abstraction ONLY. A failure in the
  // email layer must not leak the code or pretend a send happened; the
  // request still stands (the visitor can retry), and the mode is
  // reported honestly below.
  let delivery: 'preview' | 'sent' = emailDeliveryIsPreview() ? 'preview' : 'sent';
  try {
    const job = buildAccountSigninCodeJob(email, {
      code: issued.code,
      expires_in_minutes: Math.floor(ACCOUNT_OTP_TTL_SECONDS / 60),
    });
    const result = await createEmailProvider().send(job);
    if (!result.ok) delivery = 'preview';
  } catch (err) {
    console.error('[account] sign-in code delivery failed:', err);
    delivery = 'preview';
  }

  captureContentServerEventSoon(
    'account_code_requested',
    { delivery },
    resolveServerDistinctId(
      request.headers.get('cookie'),
      `account-code:${issued.request.request_id}`,
    ),
  );

  return NextResponse.json({
    ok: true,
    request_id: issued.request.request_id,
    expires_in_seconds: issued.request.expires_in_seconds,
    delivery,
    email: normalizeAccountEmail(email),
  });
}
