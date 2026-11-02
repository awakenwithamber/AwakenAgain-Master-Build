/**
 * POST /api/account/forgot-password — begin a password reset
 * (Phase 2B, spec item 5).
 *
 * NO ACCOUNT ENUMERATION: the response is byte-identical whether or
 * not the email has an account — same status, same body. A reset code
 * (purpose 'password_reset', durable store) is actually sent ONLY to a
 * live account; for any other email the route does nothing and says
 * the same thing. (Delivery failures are logged, and the response
 * still does not change.)
 *
 * Any live account may reset — including a legacy passwordless one:
 * completing the reset sets its first password (and proves inbox
 * possession, which also verifies an unverified registration; see
 * POST /api/account/reset-password).
 */
import { NextResponse } from 'next/server';
import { loadAccountAsync } from '../../../../lib/accounts/accounts';
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
} from '../../../../lib/accounts/otp';
import { accountSessionsConfigured } from '../../../../lib/accounts/session';
import { FORGOT_PASSWORD_OK } from '../../../../lib/accounts/session-response';
import {
  buildAccountPasswordResetCodeJob,
  createEmailProvider,
} from '../../../../lib/jobs/email';
import { sanitizeEmail } from '../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';
import { createLogger } from '../../../../lib/observability/logger';

const log = createLogger('api:account-forgot-password');

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
  if (state.exists && !state.deleted) {
    try {
      const issued = await requestCode(
        getAccountOtpStore(),
        email,
        'password_reset',
      );
      const job = buildAccountPasswordResetCodeJob(email, {
        code: issued.code,
        expires_in_minutes: Math.floor(ACCOUNT_OTP_TTL_SECONDS / 60),
      });
      await createEmailProvider().send(job);
    } catch (err) {
      log.error('password reset code delivery failed', { error: err });
    }
  }

  return NextResponse.json({ ...FORGOT_PASSWORD_OK });
}
