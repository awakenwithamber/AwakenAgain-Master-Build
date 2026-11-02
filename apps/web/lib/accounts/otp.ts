/**
 * Account verification codes — Phase 3 Step 3, generalized in Phase 2B
 * (owner registration-redesign directive 2026-10-30).
 *
 * Deliberately the SAME shape as the Grimoire OTP contract
 * (lib/grimoire/otp.ts):
 *
 *   requestCode(email, purpose) → { request_id, expires_in_seconds } + code
 *   verifyCode(request_id, code, purpose) → { email } (single use)
 *   verifyCodeForEmail(email, code, purpose) → same, resolved by email
 *
 * THREE purposes share this one contract and one store (Phase 2B):
 * 'account_signin' (the legacy passwordless sign-in), 'email_verification'
 * (registration), and 'password_reset' (forgot password). A code issued
 * for one purpose NEVER verifies for another.
 *
 * Security properties (identical to the Grimoire gate's):
 * - 6-digit numeric codes, 10-minute TTL, single use, max 5 attempts
 *   per request (then the request is burned).
 * - Codes are stored hashed (scrypt + per-request salt) — never plaintext.
 * - Codes NEVER appear in responses, logs, or analytics.
 *
 * PERSISTENCE (Phase 2B, replacing the in-memory-only store): the bound
 * store is the durable one from lib/accounts/otp-store.ts (Postgres
 * event store when DATABASE_URL is set; the JSONL code ledger
 * otherwise) — codes survive process restarts, mirroring how
 * orders/accounts persist. The in-memory implementation below remains
 * for tests only. Migration note: codes issued by the old in-memory
 * store were invalidated by the swap — they were 10-minute ephemeral
 * codes; requesting a new one is the recovery.
 *
 * DIFFERENCE FROM THE GRIMOIRE GATE — by design: there is NO
 * entitlement check here. An account is for every visitor; the Living
 * Grimoire keeps its own OTP + entitlement check, and an account session
 * grants no Grimoire access. Delivery goes through the EmailProvider
 * abstraction (lib/jobs/email.ts) at the route layer.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { sanitizeEmail } from '../security/validation';
import { getSharedAccountOtpStore } from './otp-store';

export const ACCOUNT_OTP_CODE_LENGTH = 6;
export const ACCOUNT_OTP_TTL_SECONDS = 10 * 60;
export const ACCOUNT_OTP_MAX_ATTEMPTS = 5;
export const ACCOUNT_OTP_PURPOSE = 'account_signin' as const;

/** Every purpose a code can be issued for (Phase 2B). */
export type AccountCodePurpose =
  | 'account_signin'
  | 'email_verification'
  | 'password_reset';

export interface AccountCodeRequest {
  request_id: string;
  expires_at: number;
  expires_in_seconds: number;
  purpose: AccountCodePurpose;
}

export interface PersistedAccountCodeRequest {
  request_id: string;
  email: string;
  /** 'salt$hash' — the code is NEVER stored plaintext. */
  code_hash: string;
  expires_at: number;
  attempts: number;
  consumed: boolean;
  /**
   * What this code is for (Phase 2B). Absent on records written before
   * purposes existed — readers treat absent as 'account_signin'.
   */
  purpose?: AccountCodePurpose;
}

export interface AccountOtpStore {
  saveCodeRequest(record: PersistedAccountCodeRequest): Promise<void>;
  getCodeRequest(requestId: string): Promise<PersistedAccountCodeRequest | null>;
  deleteCodeRequest(requestId: string): Promise<void>;
  /**
   * The newest unconsumed request for (email, purpose) — backs the
   * verify-by-email flows (registration verification, password reset),
   * where the client holds the email + code rather than a request id.
   */
  getLatestCodeRequestForEmail(
    email: string,
    purpose: AccountCodePurpose,
  ): Promise<PersistedAccountCodeRequest | null>;
}

/** In-memory implementation — TESTS ONLY since Phase 2B (see header). */
export class InMemoryAccountOtpStore implements AccountOtpStore {
  private codes = new Map<string, PersistedAccountCodeRequest>();

  async saveCodeRequest(record: PersistedAccountCodeRequest): Promise<void> {
    this.codes.set(record.request_id, record);
  }
  async getCodeRequest(
    requestId: string,
  ): Promise<PersistedAccountCodeRequest | null> {
    return this.codes.get(requestId) ?? null;
  }
  async deleteCodeRequest(requestId: string): Promise<void> {
    this.codes.delete(requestId);
  }
  async getLatestCodeRequestForEmail(
    email: string,
    purpose: AccountCodePurpose,
  ): Promise<PersistedAccountCodeRequest | null> {
    let latest: PersistedAccountCodeRequest | null = null;
    for (const record of this.codes.values()) {
      if (record.email !== email) continue;
      if ((record.purpose ?? 'account_signin') !== purpose) continue;
      if (record.consumed) continue;
      latest = record;
    }
    return latest;
  }
}

/**
 * The routes' bound store: the durable shared store
 * (lib/accounts/otp-store.ts), resolved at call time.
 */
export function getAccountOtpStore(): AccountOtpStore {
  return getSharedAccountOtpStore();
}

function newRequestId(): string {
  return `acct_${Date.now().toString(36)}_${randomBytes(8).toString('hex')}`;
}

function generateCode(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(ACCOUNT_OTP_CODE_LENGTH, '0');
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
 * Issue a code for a purpose. Returns the request descriptor; the
 * plaintext code is returned ONCE, for the delivery step
 * (EmailProvider) — it is never logged and never sent to the client
 * (the forgot-password route deliberately withholds even the
 * request_id; see that route).
 */
export async function requestCode(
  store: AccountOtpStore,
  emailInput: unknown,
  purpose: AccountCodePurpose,
): Promise<{ request: AccountCodeRequest; code: string }> {
  const email = sanitizeEmail(emailInput);
  if (!email) throw new Error('A valid email address is required.');
  const code = generateCode();
  const salt = randomBytes(16).toString('hex');
  const request_id = newRequestId();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expires_at = nowSeconds + ACCOUNT_OTP_TTL_SECONDS;
  await store.saveCodeRequest({
    request_id,
    email,
    code_hash: hashCode(code, salt),
    expires_at,
    attempts: 0,
    consumed: false,
    purpose,
  });
  return {
    request: {
      request_id,
      expires_at,
      expires_in_seconds: ACCOUNT_OTP_TTL_SECONDS,
      purpose,
    },
    code,
  };
}

/** Issue a legacy sign-in code (purpose 'account_signin'). */
export async function requestAccountCode(
  store: AccountOtpStore,
  emailInput: unknown,
): Promise<{ request: AccountCodeRequest; code: string }> {
  return requestCode(store, emailInput, ACCOUNT_OTP_PURPOSE);
}

export type VerifyAccountCodeResult =
  | { ok: true; email: string }
  | {
      ok: false;
      reason: 'not_found' | 'expired' | 'consumed' | 'too_many_attempts' | 'mismatch';
    };

/**
 * Verify a code for a purpose. Single use: success consumes the
 * request. 5 failed attempts burn it. A request whose stored purpose
 * differs from the expected one answers 'not_found' (and is NOT burned
 * by the probe). Possession only — account existence/deletion is the
 * route's concern (resolved against the account store).
 */
export async function verifyCode(
  store: AccountOtpStore,
  requestId: unknown,
  codeInput: unknown,
  purpose: AccountCodePurpose,
): Promise<VerifyAccountCodeResult> {
  if (typeof requestId !== 'string' || typeof codeInput !== 'string') {
    return { ok: false, reason: 'not_found' };
  }
  const record = await store.getCodeRequest(requestId);
  if (!record) return { ok: false, reason: 'not_found' };
  if ((record.purpose ?? 'account_signin') !== purpose) {
    return { ok: false, reason: 'not_found' };
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (record.consumed) return { ok: false, reason: 'consumed' };
  if (record.expires_at < nowSeconds) {
    await store.deleteCodeRequest(requestId);
    return { ok: false, reason: 'expired' };
  }
  if (record.attempts >= ACCOUNT_OTP_MAX_ATTEMPTS) {
    await store.deleteCodeRequest(requestId);
    return { ok: false, reason: 'too_many_attempts' };
  }
  const code = codeInput.trim();
  if (!/^\d{6}$/.test(code) || !verifyCodeHash(code, record.code_hash)) {
    await store.saveCodeRequest({ ...record, attempts: record.attempts + 1 });
    return { ok: false, reason: 'mismatch' };
  }
  await store.deleteCodeRequest(requestId);
  return { ok: true, email: record.email };
}

/** Verify a legacy sign-in code (purpose 'account_signin'). */
export async function verifyAccountCode(
  store: AccountOtpStore,
  requestId: unknown,
  codeInput: unknown,
): Promise<VerifyAccountCodeResult> {
  return verifyCode(store, requestId, codeInput, ACCOUNT_OTP_PURPOSE);
}

/**
 * Verify a code presented as (email, code) for a purpose — the shape
 * the registration-verification and password-reset forms use. Resolves
 * the email's newest live request for the purpose, then applies the
 * full verifyCode semantics to it.
 */
export async function verifyCodeForEmail(
  store: AccountOtpStore,
  emailInput: unknown,
  codeInput: unknown,
  purpose: AccountCodePurpose,
): Promise<VerifyAccountCodeResult> {
  const email = sanitizeEmail(emailInput);
  if (!email) return { ok: false, reason: 'not_found' };
  const latest = await store.getLatestCodeRequestForEmail(email, purpose);
  if (!latest) return { ok: false, reason: 'not_found' };
  return verifyCode(store, latest.request_id, codeInput, purpose);
}
