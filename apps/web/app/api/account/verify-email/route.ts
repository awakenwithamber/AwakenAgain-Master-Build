/**
 * POST /api/account/verify-email — finish registration (Phase 2B).
 *
 * Verifies the 6-digit code sent at registration (purpose
 * 'email_verification', durable store, single use) against the email,
 * marks the account verified ('account.email_verified'), and signs the
 * customer in immediately — they land on their profile dashboard.
 * Expired/wrong codes answer with plain-language guidance and the
 * resend path (POST /api/account/resend-code) — never a dead end.
 */
import {
  loadAccountAsync,
  markAccountEmailVerifiedAsync,
} from '../../../../lib/accounts/accounts';
import {
  accountFail,
  isRecordBody,
  readJsonBody,
  SIGNIN_UNAVAILABLE_MESSAGE,
} from '../../../../lib/accounts/http';
import { getAccountOtpStore, verifyCodeForEmail } from '../../../../lib/accounts/otp';
import { accountSessionsConfigured } from '../../../../lib/accounts/session';
import {
  CODE_REASON_MESSAGES,
  signedInResponse,
} from '../../../../lib/accounts/session-response';
import { sanitizeEmail } from '../../../../lib/security/validation';
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

  const verified = await verifyCodeForEmail(
    getAccountOtpStore(),
    email,
    body.code,
    'email_verification',
  );
  if (!verified.ok) {
    return accountFail(
      [CODE_REASON_MESSAGES[verified.reason] ?? 'Verification failed.'],
      401,
    );
  }

  const state = await loadAccountAsync(verified.email);
  if (!state.exists || state.deleted) {
    return accountFail(
      ['We could not find that account. Please register first.'],
      401,
    );
  }

  await markAccountEmailVerifiedAsync(verified.email);
  return signedInResponse(verified.email);
}
