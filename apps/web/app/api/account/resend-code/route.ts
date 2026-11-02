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
 * delivery field describes the email SYSTEM (preview vs real sends),
 * never the existence of an account.
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

  const delivery: 'preview' | 'sent' = emailDeliveryIsPreview()
    ? 'preview'
    : 'sent';

  const state = await loadAccountAsync(email);
  const shouldSend =
    !state.deleted &&
    (purpose === 'account_signin'
      ? true
      : state.exists &&
        state.has_registration &&
        !accountEmailVerified(state));

  if (shouldSend) {
    try {
      const issued = await requestCode(getAccountOtpStore(), email, purpose);
      const data = {
        code: issued.code,
        expires_in_minutes: Math.floor(ACCOUNT_OTP_TTL_SECONDS / 60),
      };
      const job =
        purpose === 'account_signin'
          ? buildAccountSigninCodeJob(email, data)
          : buildAccountVerificationCodeJob(email, data);
      await createEmailProvider().send(job);
    } catch (err) {
      // A failed resend must not dead-end the visitor — they can retry;
      // the response stays the same honest shape.
      log.error('code resend delivery failed', { error: err });
    }
  }

  return NextResponse.json({
    ok: true,
    delivery,
    expires_in_seconds: ACCOUNT_OTP_TTL_SECONDS,
  });
}
