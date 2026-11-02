/**
 * POST /api/account/sign-in — email + password sign-in (Phase 2B).
 *
 * The password path for registered users. The legacy email-code path
 * (POST /api/account/request-code + /verify) stays untouched alongside
 * it for passwordless accounts — nobody is locked out (spec item 4).
 *
 * Rules (spec items 6–7):
 * - No password on the account → a clear pointer to the code path
 *   (those users then add a password from "Complete your profile").
 * - Wrong password → one generic message, whatever else is true.
 * - Correct password but the registration never verified its email →
 *   403 { code: 'email_unverified' }: sign-in is blocked, WITH the
 *   resend path offered by the UI — never a dead end.
 * - Deleted accounts are refused (403), like every account route.
 * Legacy accounts count as verified (see accountEmailVerified), so
 * this gate can only ever hold a 2B registration that skipped its code.
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
import { verifyPassword } from '../../../../lib/accounts/password';
import { accountSessionsConfigured } from '../../../../lib/accounts/session';
import { signedInResponse } from '../../../../lib/accounts/session-response';
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
  if (!email || typeof body.password !== 'string' || body.password === '') {
    return accountFail(['Please enter your email and password.']);
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
  if (!state.exists || !state.password_hash) {
    return NextResponse.json(
      {
        ok: false,
        code: 'no_password_set',
        errors: [
          'No password is set for this email yet. Use "Email me a ' +
            'sign-in code" below to sign in — you can add a password ' +
            'from your profile afterwards.',
        ],
      },
      { status: 401 },
    );
  }
  if (!verifyPassword(body.password, state.password_hash)) {
    return accountFail(
      [
        'That email and password don\u2019t match our records. Please ' +
          'try again, or use the sign-in code below.',
      ],
      401,
    );
  }
  if (!accountEmailVerified(state)) {
    return NextResponse.json(
      {
        ok: false,
        code: 'email_unverified',
        errors: [
          'Your email isn\u2019t verified yet, so password sign-in is ' +
            'paused. We can send you a fresh verification code below — ' +
            'once your email is verified, you\u2019re signed in.',
        ],
      },
      { status: 403 },
    );
  }

  return signedInResponse(email);
}
