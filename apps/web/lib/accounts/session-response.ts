/**
 * Shared "you are signed in" response tail for the account auth routes
 * (Phase 2B): creates the ledger-backed session and returns the JSON
 * response carrying the HttpOnly session cookie — the exact tail the
 * original verify route wrote by hand, factored so register-verify,
 * password sign-in, and password reset can never drift from it.
 * Session shape is UNCHANGED (spec item 9): same cookie, same token,
 * same 30-day TTL — existing signed-in users stay signed in.
 *
 * SERVER-ONLY.
 */
import { NextResponse } from 'next/server';
import {
  ACCOUNT_SESSION_COOKIE,
  ACCOUNT_SESSION_TTL_SECONDS,
  accountSessionCookieOptions,
  createAccountSession,
} from './session';

export async function signedInResponse(
  email: string,
  extra: Record<string, unknown> = {},
): Promise<NextResponse> {
  const session = await createAccountSession(email);
  const response = NextResponse.json({
    ok: true,
    email,
    expires_at: session.expires_at,
    ...extra,
  });
  response.cookies.set(
    ACCOUNT_SESSION_COOKIE,
    session.token,
    accountSessionCookieOptions(ACCOUNT_SESSION_TTL_SECONDS),
  );
  return response;
}


/**
 * The ONE forgot-password response (Phase 2B, spec item 5): returned
 * for every well-formed request whether or not the email has an
 * account — byte-identical, so the endpoint cannot be used to
 * enumerate accounts. (Lives here, not in the route: Next.js route
 * modules may only export handlers + config fields.)
 */
export const FORGOT_PASSWORD_OK = {
  ok: true,
  message:
    'If an account exists for that email, a password reset code is ' +
    'on its way. It expires in 10 minutes.',
} as const;

/** Plain-language code-failure messages shared by the code routes. */
export const CODE_REASON_MESSAGES: Record<string, string> = {
  not_found:
    'We could not find that code. Request a new one and try again.',
  expired:
    'That code has expired. Request a new one — we will send a fresh code right away.',
  consumed: 'That code was already used. Request a new code.',
  too_many_attempts: 'Too many attempts. Request a new code.',
  mismatch: 'That code does not match. Check it and try again.',
};
