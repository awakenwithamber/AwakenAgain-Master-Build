/**
 * Account sessions — signed, server-side, fail-closed (Phase 3 Step 3).
 *
 * Where the Grimoire gate keeps an opaque token in an in-memory store,
 * account sessions are built for durability across the store binding:
 *
 * - The session RECORD lives in the account store (an append-only
 *   'account.session_issued' event; revocation is another event), so a
 *   session survives deploys and can be revoked (sign-out, deletion).
 * - The COOKIE carries `${base64url(email)}.${session_id}.${signature}`
 *   where signature = base64url(HMAC-SHA256(secret, email.session_id)).
 *   A token resolves ONLY when the signature verifies AND the store
 *   fold says the session is issued, unrevoked, unexpired, and the
 *   account is not deleted.
 *
 * FAIL-CLOSED SECRET: the signing secret comes from the dedicated env
 * var ACCOUNT_SESSION_SECRET (never reused from another system — the
 * owner sets it in the wiring session). When it is unset or too short,
 * sign-in is UNAVAILABLE: session creation throws, verification
 * resolves null, and the routes answer an honest 503. There is NO
 * unsigned fallback.
 *
 * SERVER-ONLY: reads a server env secret. Never import from a client
 * component; the secret and token values are never logged.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  issueSessionRecordAsync,
  loadAccountAsync,
  normalizeAccountEmail,
  revokeSessionRecordAsync,
  sessionIsActive,
} from './accounts';

export const ACCOUNT_SESSION_COOKIE = 'aa_account_session';
export const ACCOUNT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 16;

/** The dedicated signing secret, or null when not (properly) configured. */
export function accountSessionSecret(): string | null {
  const secret = process.env.ACCOUNT_SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return secret;
}

/** True when account sign-in can run at all on this server. */
export function accountSessionsConfigured(): boolean {
  return accountSessionSecret() !== null;
}

function sign(secret: string, email: string, sessionId: string): string {
  return createHmac('sha256', secret)
    .update(`${email}.${sessionId}`)
    .digest('base64url');
}

function encodeEmail(email: string): string {
  return Buffer.from(email, 'utf8').toString('base64url');
}

function decodeEmail(encoded: string): string {
  try {
    return Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

export interface AccountSessionIdentity {
  email: string;
  session_id: string;
}

/**
 * Create a session: append the issued event to the account store and
 * return the signed cookie token. Throws when the secret is not
 * configured — callers must check accountSessionsConfigured() first and
 * answer 503 (fail closed) instead of ever reaching this.
 */
export async function createAccountSession(
  emailInput: unknown,
): Promise<{ token: string; session_id: string; expires_at: number }> {
  const secret = accountSessionSecret();
  if (!secret) {
    throw new Error('Account sessions are not configured on this server.');
  }
  const email = normalizeAccountEmail(emailInput);
  if (!email) throw new Error('A valid email address is required.');
  const session_id = randomBytes(32).toString('hex');
  const issued_at = Math.floor(Date.now() / 1000);
  const expires_at = issued_at + ACCOUNT_SESSION_TTL_SECONDS;
  await issueSessionRecordAsync(email, { session_id, issued_at, expires_at });
  const token = `${encodeEmail(email)}.${session_id}.${sign(secret, email, session_id)}`;
  return { token, session_id, expires_at };
}

/**
 * Verify the SIGNATURE half of a token (no store read): well-formed,
 * signed with the current secret, for the email it names. Store state
 * (issued / revoked / expired / deleted) is checked separately by
 * resolveAccountSession — a valid signature alone never grants access.
 */
export function verifyAccountSessionToken(
  token: unknown,
): AccountSessionIdentity | null {
  const secret = accountSessionSecret();
  if (!secret) return null;
  if (typeof token !== 'string' || token.length === 0) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedEmail, sessionId, presentedSig] = parts;
  const email = normalizeAccountEmail(decodeEmail(encodedEmail));
  if (!email || !sessionId) return null;
  const expectedSig = sign(secret, email, sessionId);
  const presented = Buffer.from(presentedSig, 'utf8');
  const expected = Buffer.from(expectedSig, 'utf8');
  if (presented.length !== expected.length) return null;
  if (!timingSafeEqual(presented, expected)) return null;
  return { email, session_id: sessionId };
}

/** Read one cookie value out of a raw Cookie header. */
export function cookieValueFromHeader(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

/**
 * Full session resolution for a raw token value: signature valid AND
 * the account-store fold confirms the session is live. Any failure —
 * including "secret not configured" — resolves null (fail closed).
 */
export async function resolveAccountSession(
  token: unknown,
): Promise<AccountSessionIdentity | null> {
  const identity = verifyAccountSessionToken(token);
  if (!identity) return null;
  const state = await loadAccountAsync(identity.email);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!sessionIsActive(state, identity.session_id, nowSeconds)) return null;
  return identity;
}

/** Session resolution straight from a request's Cookie header. */
export async function resolveAccountSessionFromHeaders(
  headers: Headers,
): Promise<AccountSessionIdentity | null> {
  const token = cookieValueFromHeader(
    headers.get('cookie'),
    ACCOUNT_SESSION_COOKIE,
  );
  return resolveAccountSession(token);
}

/** Revoke a session (sign-out): one appended event; the cookie is cleared by the route. */
export async function revokeAccountSession(
  identity: AccountSessionIdentity,
): Promise<void> {
  await revokeSessionRecordAsync(identity.email, identity.session_id);
}

/** Cookie attributes every account-session response shares. */
export function accountSessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeSeconds,
  };
}
