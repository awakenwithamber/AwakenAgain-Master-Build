/**
 * POST /api/account/reset-password — finish a password reset
 * (Phase 2B, spec item 5).
 *
 * Order of checks is deliberate: the new password's policy + match are
 * validated BEFORE the code is touched, so a weak-password rejection
 * never burns the code — the customer fixes the password and retries
 * with the same code. A proven code then: sets the new password
 * (scrypt hash), verifies the email if it was unverified (inbox
 * possession is proven by the code — an unverified registration that
 * resets is activated, never stranded), and signs the customer in.
 */
import {
  accountEmailVerified,
  loadAccountAsync,
  markAccountEmailVerifiedAsync,
  setAccountPasswordAsync,
} from '../../../../lib/accounts/accounts';
import {
  accountFail,
  isRecordBody,
  readJsonBody,
  SIGNIN_UNAVAILABLE_MESSAGE,
} from '../../../../lib/accounts/http';
import { getAccountOtpStore, verifyCodeForEmail } from '../../../../lib/accounts/otp';
import { hashPassword, passwordsMatch, validatePasswordPolicy } from '../../../../lib/accounts/password';
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

  const policy = validatePasswordPolicy(body.password);
  if (!policy.ok) {
    return accountFail(policy.errors);
  }
  if (!passwordsMatch(body.password, body.confirm_password)) {
    return accountFail(['Your passwords do not match. Please try again.']);
  }

  const verified = await verifyCodeForEmail(
    getAccountOtpStore(),
    email,
    body.code,
    'password_reset',
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

  await setAccountPasswordAsync(
    verified.email,
    hashPassword(body.password as string),
  );
  if (!accountEmailVerified(state)) {
    await markAccountEmailVerifiedAsync(verified.email);
  }
  return signedInResponse(verified.email);
}
