/**
 * Account password hashing — Phase 2B (owner registration-redesign
 * directive 2026-10-30). SERVER-ONLY (node:crypto).
 *
 * SCHEME (documented per spec item 1): scrypt — the codebase's
 * established strong hash, the same construction the verification
 * codes use (lib/accounts/otp.ts): a per-password random 16-byte salt,
 * scryptSync(password, salt, 32), stored as 'salt$hash' (hex). The
 * plaintext password is NEVER stored, logged, or returned; only this
 * salted hash lands on the account ledger ('account.password_set'),
 * and the profile/export read models never expose it.
 * Verification recomputes and compares with timingSafeEqual.
 *
 * The POLICY (length/letter/digit + confirm match) is pure and lives
 * in lib/accounts/password-policy.ts so client forms share it.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export {
  PASSWORD_MIN_LENGTH,
  passwordsMatch,
  validatePasswordPolicy,
  type PasswordPolicyResult,
} from './password-policy';

/** Hash a password for storage: 'salt$hash' (scrypt, 32-byte output). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}$${hash}`;
}

/** Timing-safe check of a candidate against a stored 'salt$hash'. */
export function verifyPassword(password: unknown, stored: unknown): boolean {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const [salt, expected] = stored.split('$');
  if (!salt || !expected) return false;
  let actual: string;
  try {
    actual = scryptSync(password, salt, 32).toString('hex');
  } catch {
    return false;
  }
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
