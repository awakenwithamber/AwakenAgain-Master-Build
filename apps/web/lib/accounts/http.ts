/**
 * Shared HTTP helpers for the /api/account/* routes (Phase 3 Step 3).
 *
 * The session requirement lives here so it cannot drift between routes:
 * a route either gets the verified AccountSessionIdentity or an honest
 * error response — 503 when sign-in is not configured on this server
 * (fail closed), 401 when there is no live session.
 *
 * SERVER-ONLY.
 */
import { NextResponse } from 'next/server';
import {
  accountSessionsConfigured,
  resolveAccountSessionFromHeaders,
  type AccountSessionIdentity,
} from './session';

export function accountFail(errors: string[], status = 422): NextResponse {
  return NextResponse.json({ ok: false, errors }, { status });
}

export const SIGNIN_UNAVAILABLE_MESSAGE =
  'Account sign-in is not available yet. Profiles open when email ' +
  'delivery is switched on — nothing about your visit is lost until then.';

export type SessionRequirement =
  | { ok: true; identity: AccountSessionIdentity }
  | { ok: false; response: NextResponse };

/** Resolve the caller's account session, or the response to send back. */
export async function requireAccountSession(
  request: Request,
): Promise<SessionRequirement> {
  if (!accountSessionsConfigured()) {
    return {
      ok: false,
      response: accountFail([SIGNIN_UNAVAILABLE_MESSAGE], 503),
    };
  }
  const identity = await resolveAccountSessionFromHeaders(request.headers);
  if (!identity) {
    return {
      ok: false,
      response: accountFail(['Please sign in to continue.'], 401),
    };
  }
  return { ok: true, identity };
}

/** Parse a JSON request body; null when it is not valid JSON. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function isRecordBody(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
