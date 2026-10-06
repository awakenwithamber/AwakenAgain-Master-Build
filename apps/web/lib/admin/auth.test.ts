/**
 * Tests — admin auth gate (G12).
 * Laws: denied by default; preview switch grants dev-only access with an
 * explicit non-auth marker; the marker text is always present.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  ADMIN_AUTH_MARKER,
  ADMIN_AUTH_STATUS,
  checkAdmin,
} from './auth';

afterEach(() => {
  delete process.env.ADMIN_PREVIEW_ENABLED;
});

describe('admin auth gate', () => {
  it('denies by default', () => {
    const check = checkAdmin();
    expect(check.authorized).toBe(false);
    expect(check.reason.length).toBeGreaterThan(0);
    expect(check.via).toBeUndefined();
  });

  it('preview switch grants access but is labeled as NOT real auth', () => {
    process.env.ADMIN_PREVIEW_ENABLED = '1';
    const check = checkAdmin();
    expect(check.authorized).toBe(true);
    expect(check.via).toMatch(/NOT real authentication/);
  });

  it('status constant is NEEDS_VERIFICATION', () => {
    expect(ADMIN_AUTH_STATUS).toBe('NEEDS_VERIFICATION');
  });

  it('marker names the pending auth work', () => {
    expect(ADMIN_AUTH_MARKER).toMatch(/NEEDS VERIFICATION/);
    expect(ADMIN_AUTH_MARKER).toMatch(/RLS|Supabase/);
  });
});
