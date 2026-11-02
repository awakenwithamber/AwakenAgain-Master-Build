/**
 * Password policy — Phase 2B. PURE + CLIENT-SAFE (no node imports):
 * the registration / reset / complete-profile forms import this for
 * instant feedback, and the server routes import the same module as
 * the authority (CLIENT = PREVIEW, SERVER = AUTHORITY, one rule).
 *
 * POLICY (judgment call, flagged for the owner in the Phase-2 report):
 * at least 10 characters, at least one letter, at least one digit.
 * Hashing lives in lib/accounts/password.ts (server-only).
 */

export const PASSWORD_MIN_LENGTH = 10;

export interface PasswordPolicyResult {
  ok: boolean;
  errors: string[];
}

/** The one password policy — client preview and server authority. */
export function validatePasswordPolicy(password: unknown): PasswordPolicyResult {
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, errors: ['Please create a password.'] };
  }
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(
      `Your password needs at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
  }
  if (!/[A-Za-z]/.test(password)) {
    errors.push('Your password needs at least one letter.');
  }
  if (!/\d/.test(password)) {
    errors.push('Your password needs at least one number.');
  }
  return { ok: errors.length === 0, errors };
}

/** Confirm-password match — enforced on the client AND the server. */
export function passwordsMatch(password: unknown, confirm: unknown): boolean {
  return (
    typeof password === 'string' &&
    typeof confirm === 'string' &&
    password.length > 0 &&
    password === confirm
  );
}
