/**
 * POST /api/account/resend-code — resend a verification or sign-in
 * code (Phase 2B).
 *
 * Rate-limited on the same strict 'account-auth' budget as every other
 * code route (that budget IS the resend limiter the spec asks for).
 * A fresh code is issued only when there is something legitimate to
 * send it for:
 * - purpose 'email_verification': a live registration that has not
 *   verified yet;
 * - purpose 'account_signin': any non-deleted email (parity with
 *   POST /api/account/request-code, which this complements for the
 *   verify screen's Resend button).
 * Password-reset codes are re-issued through POST
 * /api/account/forgot-password itself (the forgot form is its resend).
 *
 * The response is the same shape whether or not a code was sent; the
 * delivery field honestly reports the send outcome ('sent' /
 * 'preview' / 'failed'), never the existence of an account. Resends
 * are cooldown-limited per (email, purpose) — see
 * ACCOUNT_CODE_RESEND_COOLDOWN_SECONDS in lib/accounts/otp.ts.
 */
import { NextResponse } from 'next/server';
import {
  accountEmailVerified,
  loadAccountAsync,
} from '../../../../lib/accounts/accounts';
import {
  accountFail,
  isRecordBody,
  readJsonBody,
  SIGNIN_UNAVAILABLE_MESSAGE,
} from '../../../../lib/accounts/http';
import {
  ACCOUNT_OTP_TTL_SECONDS,
  getAccountOtpStore,
  requestCode,
  resendCooldownRemainingSeconds,
  type AccountCodePurpose,
} from '../../../../lib/accounts/otp';
import { accountSessionsConfigured } from '../../../../lib/accounts/session';
import {
  buildAccountSigninCodeJob,
  buildAccountVerificationCodeJob,
  createEmailProvider,
  emailDeliveryIsPreview,
} from '../../../../lib/jobs/email';
import { sanitizeEmail } from '../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';
import { createLogger } from '../../../../lib/observability/logger';

const log = createLogger('api:account-resend-code');

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
  const purpose: AccountCodePurpose =
    body.purpose === 'account_signin' ? 'account_signin' : 'email_verification';

  const state = await loadAccountAsync(email);
  const shouldSend =
    !state.deleted &&
    (purpose === 'account_signin'
      ? true
      : state.exists &&
        state.has_registration &&
        !accountEmailVerified(state));

  // Resend cooldown (owner requirement 2026-11-02, item 5): one code
  // per (email, purpose) per cooldown window. The answer names the
  // address and the wait, so a customer is never left guessing whether
  // anything was sent. Cooldown applies only when a code would
  // otherwise be sent, and never when the last code already expired.
  if (shouldSend) {
    const cooldown = await resendCooldownRemainingSeconds(
      getAccountOtpStore(),
      email,
      purpose,
    );
    if (cooldown > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: 'resend_cooldown',
          retry_after_seconds: cooldown,
          errors: [
            `A code was just sent to ${email}. Please check that inbox ` +
              `(and its spam folder) — you can ask for another code in ${cooldown} seconds.`,
          ],
        },
        { status: 429, headers: { 'Retry-After': String(cooldown) } },
      );
    }
  }

  // Three honest delivery states (2026-11-02): 'sent', 'preview' (no
  // mailer bound), 'failed' (send attempted and refused) — the send
  // RESULT is checked, never assumed.
  let delivery: 'preview' | 'sent' | 'failed' = emailDeliveryIsPreview()
    ? 'preview'
    : 'sent';
  let requestId: string | null = null;

  if (shouldSend) {
    try {
      const issued = await requestCode(getAccountOtpStore(), email, purpose);
      requestId = issued.request.request_id;
      const data = {
        code: issued.code,
        expires_in_minutes: Math.floor(ACCOUNT_OTP_TTL_SECONDS / 60),
      };
      const job =
        purpose === 'account_signin'
          ? buildAccountSigninCodeJob(email, data)
          : buildAccountVerificationCodeJob(email, data);
      const result = await createEmailProvider().send(job);
      if (!result.ok) delivery = 'failed';
    } catch (err) {
      // A failed resend must not dead-end the visitor — they can retry;
      // the failure is reported honestly as 'failed', never as a send.
      log.error('code resend delivery failed', { error: err });
      delivery = 'failed';
    }
  }

  return NextResponse.json({
    ok: true,
    delivery,
    email,
    expires_in_seconds: ACCOUNT_OTP_TTL_SECONDS,
    // Sign-in codes verify by request_id (POST /api/account/verify), so
    // a resent sign-in code must hand the client its request_id — until
    // 2026-11-02 this response omitted it and a resent sign-in code
    // could never be entered. Verification codes verify by email and
    // need no request_id.
    ...(purpose === 'account_signin' && requestId
      ? { request_id: requestId }
      : {}),
  });
}
