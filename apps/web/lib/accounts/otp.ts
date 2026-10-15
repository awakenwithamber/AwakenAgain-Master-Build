/**
 * Account sign-in OTP — Phase 3 Step 3.
 *
 * Deliberately the SAME shape as the Grimoire OTP contract
 * (lib/grimoire/otp.ts), with a different purpose and its own store:
 *
 *   requestAccountCode(email) → { request_id, expires_in_seconds } + code
 *   verifyAccountCode(request_id, code) → { email } (single use)
 *
 * Security properties (identical to the Grimoire gate's):
 * - 6-digit numeric codes, 10-minute TTL, single use, max 5 attempts
 *   per request (then the request is burned).
 * - Codes are stored hashed (scrypt + per-request salt) — never plaintext.
 * - Codes NEVER appear in responses, logs, or analytics.
 *
 * The store is in-memory BY DESIGN (codes are ephemeral — the same call
 * Step 1 made for the Grimoire OTP store). The durable state of an
 * account lives in lib/accounts/accounts.ts; if the process recycles,
 * a pending code is simply re-requested.
 *
 * DIFFERENCE FROM THE GRIMOIRE GATE — by design: there is NO
 * entitlement check here. An account is for every visitor; the Living
 * Grimoire keeps its own OTP + entitlement gate, and an account session
 * grants no Grimoire access. Delivery goes through the EmailProvider
 * abstraction (lib/jobs/email.ts) at the route layer.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { sanitizeEmail } from '../security/validation';

export const ACCOUNT_OTP_CODE_LENGTH = 6;
export const ACCOUNT_OTP_TTL_SECONDS = 10 * 60;
export const ACCOUNT_OTP_MAX_ATTEMPTS = 5;
export const ACCOUNT_OTP_PURPOSE = 'account_signin' as const;

export interface AccountCodeRequest {
  request_id: string;
  expires_at: number;
  expires_in_seconds: number;
  purpose: typeof ACCOUNT_OTP_PURPOSE;
}

export interface PersistedAccountCodeRequest {
  request_id: string;
  email: string;
  /** 'salt$hash' — the code is NEVER stored plaintext. */
  code_hash: string;
  expires_at: number;
  attempts: number;
  consumed: boolean;
}

export interface AccountOtpStore {
  saveCodeRequest(record: PersistedAccountCodeRequest): Promise<void>;
  getCodeRequest(requestId: string): Promise<PersistedAccountCodeRequest | null>;
  deleteCodeRequest(requestId: string): Promise<void>;
}

/** In-memory implementation (ephemeral by design — see header). */
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
}

/**
 * The one bound store instance, shared by the request-code and verify
 * routes (module-level singleton, like the Grimoire route's store).
 */
export const accountOtpStore = new InMemoryAccountOtpStore();

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
 * Issue a sign-in code. Returns the request descriptor; the plaintext
 * code is returned ONCE, for the delivery step (EmailProvider) — it is
 * never logged and never sent back to the client.
 */
export async function requestAccountCode(
  store: AccountOtpStore,
  emailInput: unknown,
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
  });
  return {
    request: {
      request_id,
      expires_at,
      expires_in_seconds: ACCOUNT_OTP_TTL_SECONDS,
      purpose: ACCOUNT_OTP_PURPOSE,
    },
    code,
  };
}

export type VerifyAccountCodeResult =
  | { ok: true; email: string }
  | {
      ok: false;
      reason: 'not_found' | 'expired' | 'consumed' | 'too_many_attempts' | 'mismatch';
    };

/**
 * Verify a code. Single use: success consumes the request. 5 failed
 * attempts burn it. Possession only — account existence/deletion is
 * the route's concern (resolved against the account store).
 */
export async function verifyAccountCode(
  store: AccountOtpStore,
  requestId: unknown,
  codeInput: unknown,
): Promise<VerifyAccountCodeResult> {
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
