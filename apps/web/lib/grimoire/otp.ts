/**
 * Grimoire OTP gating — provider-neutral contract (G8).
 *
 * The Living Grimoire's subscriber content needs a real gate (the legacy
 * `auth-check.js` stub always returned access:false — SUPERSEDED). This
 * module defines the contract:
 *
 *   requestCode(email) → { request_id, expires_in_seconds }
 *   verifyCode(request_id, code) → { session_token, expires_at }  (single use)
 *   getSession(session_token) → session | null
 *
 * IMPLEMENTED NOW: in-memory implementation (dev/preview only — no
 * durability, no multi-instance fan-out). SHIPPED CONTRACT: the OtpStore
 * interface, behind which a Supabase-backed store binds later. The Supabase
 * binding is NOT verified yet — `createSupabaseOtpStore` stays behind the
 * interface and is NOT imported anywhere; Supabase table names, policies,
 * and client wiring are NEEDS VERIFICATION.
 *
 * Security properties:
 * - 6-digit numeric codes, 10-minute TTL, single use, max 5 attempts per
 *   request (then the request is burned).
 * - Codes are stored hashed (SHA-256 + per-request salt) — never plaintext.
 * - Session tokens are 256-bit random, 24-hour TTL.
 * - OTP codes NEVER appear in analytics events (see grimoire-events).
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { isRecord, sanitizeEmail } from '../security/validation';

export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_SECONDS = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_SESSION_TTL_SECONDS = 24 * 60 * 60;
export const OTP_PURPOSE = 'grimoire_gate' as const;

/* ------------------------------------------------------------------ */
/* Contract (provider-neutral)                                          */
/* ------------------------------------------------------------------ */

export interface OtpCodeRequest {
  request_id: string;
  /** Unix seconds the code expires at. */
  expires_at: number;
  expires_in_seconds: number;
  purpose: typeof OTP_PURPOSE;
}

export interface OtpSession {
  session_token: string;
  email: string;
  issued_at: number;
  /** Unix seconds the session expires at. */
  expires_at: number;
  purpose: typeof OTP_PURPOSE;
}

export interface OtpStore {
  /** Persist a code request. Overwrites any existing request for the email. */
  saveCodeRequest(record: PersistedCodeRequest): Promise<void>;
  getCodeRequest(requestId: string): Promise<PersistedCodeRequest | null>;
  deleteCodeRequest(requestId: string): Promise<void>;
  saveSession(session: OtpSession): Promise<void>;
  getSession(sessionToken: string): Promise<OtpSession | null>;
  deleteSession(sessionToken: string): Promise<void>;
}

export interface PersistedCodeRequest {
  request_id: string;
  email: string;
  /** 'salt$hash' — the code is NEVER stored plaintext. */
  code_hash: string;
  expires_at: number;
  attempts: number;
  consumed: boolean;
}

/**
 * Supabase-shaped store contract (NOT bound yet).
 *
 * NEEDS VERIFICATION: Supabase project/table/RLS policy for OTP is not
 * verified. When it is, implement OtpStore against a `grimoire_otp`
 * table + `grimoire_sessions` table and swap the factory — no route or
 * component code changes. Until then this factory refuses to run so no
 * one can mistake the interface for a working backend.
 */
export function createSupabaseOtpStore(): OtpStore {
  throw new Error(
    'Supabase OTP store is not configured — NEEDS VERIFICATION of the ' +
      'Supabase project/table/RLS design. The in-memory store is the only ' +
      'bound implementation.',
  );
}

/* ------------------------------------------------------------------ */
/* In-memory implementation (dev/preview only)                          */
/* ------------------------------------------------------------------ */

export class InMemoryOtpStore implements OtpStore {
  private codes = new Map<string, PersistedCodeRequest>();
  private sessions = new Map<string, OtpSession>();

  async saveCodeRequest(record: PersistedCodeRequest): Promise<void> {
    this.codes.set(record.request_id, record);
  }
  async getCodeRequest(requestId: string): Promise<PersistedCodeRequest | null> {
    return this.codes.get(requestId) ?? null;
  }
  async deleteCodeRequest(requestId: string): Promise<void> {
    this.codes.delete(requestId);
  }
  async saveSession(session: OtpSession): Promise<void> {
    this.sessions.set(session.session_token, session);
  }
  async getSession(sessionToken: string): Promise<OtpSession | null> {
    return this.sessions.get(sessionToken) ?? null;
  }
  async deleteSession(sessionToken: string): Promise<void> {
    this.sessions.delete(sessionToken);
  }
}

/* ------------------------------------------------------------------ */
/* Core flows (store-agnostic)                                          */
/* ------------------------------------------------------------------ */

function newRequestId(): string {
  return `otp_${Date.now().toString(36)}_${randomBytes(8).toString('hex')}`;
}

function generateCode(): string {
  // Cryptographically random 6-digit code.
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(OTP_CODE_LENGTH, '0');
}

function hashCode(code: string, salt: string): string {
  return `${salt}$${scryptSync(code, salt, 32).toString('hex')}`;
}

function verifyCodeHash(code: string, stored: string): boolean {
  const [salt, expected] = stored.split('$');
  if (!salt || !expected) return false;
  const actual = scryptSync(code, salt, 32).toString('hex');
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Issue an OTP code for the Grimoire gate. Returns the request descriptor;
 * the plaintext code is returned once for the delivery step (email/SMS —
 * provider UNDECIDED; currently logged, never sent — see lib/jobs/email).
 */
export async function requestOtp(
  store: OtpStore,
  emailInput: unknown,
): Promise<{ request: OtpCodeRequest; code: string }> {
  const email = sanitizeEmail(emailInput);
  if (!email) throw new Error('A valid email address is required.');
  const code = generateCode();
  const salt = randomBytes(16).toString('hex');
  const request_id = newRequestId();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expires_at = nowSeconds + OTP_TTL_SECONDS;
  await store.saveCodeRequest({
    request_id,
    email,
    code_hash: hashCode(code, salt),
    expires_at,
    attempts: 0,
    consumed: false,
  });
  return {
    request: {
      request_id,
      expires_at,
      expires_in_seconds: OTP_TTL_SECONDS,
      purpose: OTP_PURPOSE,
    },
    code,
  };
}

export type VerifyOtpResult =
  | { ok: true; session: OtpSession }
  | { ok: false; reason: 'not_found' | 'expired' | 'consumed' | 'too_many_attempts' | 'mismatch' };

/**
 * Verify a code. Single use: success consumes the request and issues a
 * session; 5 failed attempts burn the request.
 */
export async function verifyOtp(
  store: OtpStore,
  requestId: unknown,
  codeInput: unknown,
): Promise<VerifyOtpResult> {
  if (typeof requestId !== 'string' || typeof codeInput !== 'string') {
    return { ok: false, reason: 'not_found' };
  }
  const record = await store.getCodeRequest(requestId);
  if (!record) return { ok: false, reason: 'not_found' };
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (record.consumed) return { ok: false, reason: 'consumed' };
  if (record.expires_at < nowSeconds) {
    await store.deleteCodeRequest(requestId);
    return { ok: false, reason: 'expired' };
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await store.deleteCodeRequest(requestId);
    return { ok: false, reason: 'too_many_attempts' };
  }
  const code = codeInput.trim();
  if (!/^\d{6}$/.test(code) || !verifyCodeHash(code, record.code_hash)) {
    await store.saveCodeRequest({ ...record, attempts: record.attempts + 1 });
    return { ok: false, reason: 'mismatch' };
  }
  await store.deleteCodeRequest(requestId);
  const session: OtpSession = {
    session_token: randomBytes(32).toString('hex'),
    email: record.email,
    issued_at: nowSeconds,
    expires_at: nowSeconds + OTP_SESSION_TTL_SECONDS,
    purpose: OTP_PURPOSE,
  };
  await store.saveSession(session);
  return { ok: true, session };
}

/** Read a session; returns null when missing or expired (expired ones are pruned). */
export async function getValidSession(
  store: OtpStore,
  token: unknown,
): Promise<OtpSession | null> {
  if (typeof token !== 'string' || token.length === 0) return null;
  const session = await store.getSession(token);
  if (!session) return null;
  if (session.expires_at < Math.floor(Date.now() / 1000)) {
    await store.deleteSession(token);
    return null;
  }
  return session;
}

/** Validate a raw JSON body for the OTP route: { action, ... }. */
export function parseOtpRequestBody(body: unknown): { action: string } & Record<string, unknown> {
  if (!isRecord(body)) throw new Error('Request body must be a JSON object.');
  const action = body.action;
  if (action !== 'request' && action !== 'verify') {
    throw new Error("action must be 'request' or 'verify'.");
  }
  return body as { action: string } & Record<string, unknown>;
}
