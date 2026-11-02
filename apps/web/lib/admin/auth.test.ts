/**
 * Tests — admin auth (real account-session allowlist, 2026-10-31).
 * Laws: only the normalized owner email is authorized; normalization
 * is case/whitespace-insensitive exactly like account emails; a
 * signed-in non-admin is denied; an unsigned visitor is denied with
 * the unsigned state; the preview switch still grants dev-only
 * access explicitly labelled as NOT real authentication.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  ADMIN_AUTH_MARKER,
  ADMIN_AUTH_STATUS,
  ADMIN_EMAIL,
  checkAdmin,
  evaluateAdminAccess,
  isAdminEmail,
} from './auth';

afterEach(() => {
  delete process.env.ADMIN_PREVIEW_ENABLED;
});

describe('admin allowlist normalization', () => {
  it('the allowlist constant is the owner email, already normalized', () => {
    expect(ADMIN_EMAIL).toBe('dare2be4ree@gmail.com');
    expect(isAdminEmail(ADMIN_EMAIL)).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(isAdminEmail('Dare2Be4Ree@Gmail.COM')).toBe(true);
    expect(isAdminEmail('DARE2BE4REE@GMAIL.COM')).toBe(true);
  });

  it('matches with surrounding whitespace', () => {
    expect(isAdminEmail('  dare2be4ree@gmail.com  ')).toBe(true);
    expect(isAdminEmail('\tdare2be4ree@gmail.com\n')).toBe(true);
  });

  it('rejects every other email, lookalikes, and non-strings', () => {
    expect(isAdminEmail('amber@awakenagain.com')).toBe(false);
    expect(isAdminEmail('dare2be4ree@gmail.com.evil.example')).toBe(false);
    expect(isAdminEmail('dare2be4ree@googlemail.com')).toBe(false);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail(42)).toBe(false);
  });
});

describe('evaluateAdminAccess', () => {
  it('authorizes the owner session, even un-normalized', () => {
    const check = evaluateAdminAccess({ email: ' Dare2Be4Ree@Gmail.com ' });
    expect(check.authorized).toBe(true);
    expect(check.state).toBe('admin');
    expect(check.email).toBe('dare2be4ree@gmail.com');
  });

  it('denies a signed-in non-admin (no admin data state)', () => {
    const check = evaluateAdminAccess({ email: 'customer@example.com' });
    expect(check.authorized).toBe(false);
    expect(check.state).toBe('signed_in_non_admin');
    expect(check.reason.length).toBeGreaterThan(0);
  });

  it('denies an unsigned visitor with the unsigned state', () => {
    const check = evaluateAdminAccess(null);
    expect(check.authorized).toBe(false);
    expect(check.state).toBe('unsigned');
    expect(check.email).toBeUndefined();
  });
});

describe('sync check + preview switch', () => {
  it('denies by default (no session evaluated synchronously)', () => {
    const check = checkAdmin();
    expect(check.authorized).toBe(false);
    expect(check.state).toBe('unsigned');
    expect(check.via).toBeUndefined();
  });

  it('preview switch grants access but is labeled as NOT real auth', () => {
    process.env.ADMIN_PREVIEW_ENABLED = '1';
    const check = checkAdmin();
    expect(check.authorized).toBe(true);
    expect(check.state).toBe('preview');
    expect(check.via).toMatch(/NOT real authentication/);
  });

  it('status constant names the real mechanism', () => {
    expect(ADMIN_AUTH_STATUS).toBe('ACCOUNT_SESSION_ALLOWLIST');
  });

  it('marker states the owner-only law and the preview warning', () => {
    expect(ADMIN_AUTH_MARKER).toMatch(/allowlisted owner email/);
    expect(ADMIN_AUTH_MARKER).toMatch(/never be deployed/);
  });
});
