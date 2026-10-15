/**
 * Grimoire OTP Route Handler (G8) — subscriber content gate.
 *
 * POST { action: 'request', email } → issues a 6-digit code (code delivery
 *  provider is UNDECIDED — the code is never logged and never sent in the
 *  response), emits server-owned `otp_requested`.
 * POST { action: 'verify', request_id, code } → single-use verification;
 *  on success issues a 24h session token, emits server-owned `otp_verified`.
 *  ENTITLEMENT (audit 2026-10-15 GAP-4): verification also resolves
 *  subscription entitlement (lib/subscriptions/entitlement — the latest
 *  record for the email must be 'active', fail-closed). A correct code
 *  for a non-member email is answered 403 with an honest explanation and
 *  grants NO session — a code proves inbox possession, not membership.
 * GET ?token= → session validity (for the GrimoireGate component).
 *
 * Bound store: InMemoryOtpStore (dev/preview). It does NOT survive
 * serverless instance recycling — the durable binding is a Supabase-backed
 * OtpStore, which stays behind the interface until the Supabase project /
 * table / RLS design is verified (NEEDS VERIFICATION; see lib/grimoire/otp).
 *
 * NOTE: only HTTP handlers and route config may be exported from a route
 * module — requestOtp/verifyOtp/getValidSession live in
 * lib/grimoire/otp.ts (imported here and by tests).
 */
import { NextResponse } from 'next/server';
import {
  captureGrimoireServerEvent,
  GRIMOIRE_ANALYTICS_EVENT_NAMES,
  resolveGrimoireServerDistinctId,
} from '../../../lib/analytics/grimoire-events';
import {
  InMemoryOtpStore,
  OTP_PURPOSE,
  getValidSession,
  parseOtpRequestBody,
  requestOtp,
  verifyOtp,
} from '../../../lib/grimoire/otp';
import { isEntitledSubscriberAsync } from '../../../lib/subscriptions/entitlement';
import { enforceRateLimit } from '../../../lib/security/rate-limit';

/** Bound store — in-memory until the Supabase binding is verified. */
const store = new InMemoryOtpStore();

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

function sessionDistinctId(request: Request, fallback: string): string {
  return resolveGrimoireServerDistinctId(request.headers.get('cookie'), fallback);
}

export async function POST(request: Request) {
  // Strict per-IP budget (lib/security/rate-limit): code issuance and
  // verification share it; the per-code attempt cap still applies inside.
  const limited = enforceRateLimit(request, 'grimoire-otp');
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(['Request body must be valid JSON.'], 400);
  }

  let parsed: ReturnType<typeof parseOtpRequestBody>;
  try {
    parsed = parseOtpRequestBody(body);
  } catch (err) {
    return fail([err instanceof Error ? err.message : 'Invalid request.']);
  }

  if (parsed.action === 'request') {
    let result: Awaited<ReturnType<typeof requestOtp>>;
    try {
      result = await requestOtp(store, parsed.email);
    } catch (err) {
      return fail([err instanceof Error ? err.message : 'Could not issue a code.']);
    }

    // The code is NEVER logged, NEVER returned in the response, and NEVER
    // included in analytics — only the fact of issuance is logged. No
    // delivery provider is bound yet (UNDECIDED), so until one is, an
    // issued code cannot reach the customer through any channel here.
    console.info(
      `[grimoire-otp] code issued for request ${result.request.request_id} ` +
        `(delivery provider not yet bound).`,
    );

    captureGrimoireServerEvent(
      GRIMOIRE_ANALYTICS_EVENT_NAMES.otpRequested,
      { request_id: result.request.request_id, purpose: OTP_PURPOSE },
      sessionDistinctId(request, `otp:${result.request.request_id}`),
    );

    return NextResponse.json({
      ok: true,
      request_id: result.request.request_id,
      expires_in_seconds: result.request.expires_in_seconds,
    });
  }

  // action === 'verify' — code possession AND active membership are both
  // required before a session exists (entitlement semantics live in
  // lib/subscriptions/entitlement; fail-closed).
  const verified = await verifyOtp(store, parsed.request_id, parsed.code, {
    entitlementCheck: isEntitledSubscriberAsync,
  });
  if (!verified.ok) {
    if (verified.reason === 'not_entitled') {
      // Honest, non-leaky: the code was right; there is simply no active
      // membership for that email.
      return fail(
        [
          "That email doesn't have an active Living Grimoire membership. " +
            'If you recently subscribed, sign in with the same email you subscribed with.',
        ],
        403,
      );
    }
    const reasons: Record<string, string> = {
      not_found: 'Code request not found. Request a new code.',
      expired: 'That code has expired. Request a new code.',
      consumed: 'That code was already used. Request a new code.',
      too_many_attempts: 'Too many attempts. Request a new code.',
      mismatch: 'That code does not match. Try again.',
    };
    return fail([reasons[verified.reason] ?? 'Verification failed.'], 401);
  }

  captureGrimoireServerEvent(
    GRIMOIRE_ANALYTICS_EVENT_NAMES.otpVerified,
    {
      request_id: typeof parsed.request_id === 'string' ? parsed.request_id : '',
      purpose: OTP_PURPOSE,
    },
    sessionDistinctId(request, `otp-session:${verified.session.session_token.slice(0, 12)}`),
  );

  return NextResponse.json({
    ok: true,
    session_token: verified.session.session_token,
    expires_at: verified.session.expires_at,
  });
}

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, 'grimoire-otp-session');
  if (limited) return limited;

  const token = new URL(request.url).searchParams.get('token');
  const session = await getValidSession(store, token);
  if (!session) {
    return NextResponse.json({ ok: true, valid: false }, { status: 200 });
  }
  return NextResponse.json({
    ok: true,
    valid: true,
    email: session.email,
    expires_at: session.expires_at,
  });
}
