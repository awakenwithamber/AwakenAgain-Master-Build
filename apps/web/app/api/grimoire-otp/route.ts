/**
 * Grimoire OTP Route Handler (G8) — subscriber content gate.
 *
 * POST { action: 'request', email } → issues a 6-digit code (code delivery
 *  provider is UNDECIDED — currently the code is logged server-side for
 *  preview only; NEVER sent in the response), emits server-owned
 *  `otp_requested`.
 * POST { action: 'verify', request_id, code } → single-use verification;
 *  on success issues a 24h session token, emits server-owned `otp_verified`.
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

/** Bound store — in-memory until the Supabase binding is verified. */
const store = new InMemoryOtpStore();

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

function sessionDistinctId(request: Request, fallback: string): string {
  return resolveGrimoireServerDistinctId(request.headers.get('cookie'), fallback);
}

export async function POST(request: Request) {
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

    // DEV/PREVIEW ONLY: no delivery provider is bound yet, so the code is
    // logged server-side for manual verification. The code is NEVER
    // returned in the response and NEVER included in analytics.
    console.info(
      `[grimoire-otp] PREVIEW code for request ${result.request.request_id} ` +
        `(deliver via email provider once bound): ${result.code}`,
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

  // action === 'verify'
  const verified = await verifyOtp(store, parsed.request_id, parsed.code);
  if (!verified.ok) {
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
