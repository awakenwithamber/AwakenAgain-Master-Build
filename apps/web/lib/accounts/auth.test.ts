/**
 * Account OTP + signed sessions — Phase 3 Step 3.
 *
 * Locks in: the OTP contract (hashed storage, single use, attempt cap,
 * expiry), signed-cookie sessions (sign/verify/tamper), revocation and
 * tombstone interplay through the store fold, and the FAIL-CLOSED
 * contract — with ACCOUNT_SESSION_SECRET unset, nothing can be created
 * and nothing verifies; with it set under a different value, tokens
 * from another secret never verify.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  InMemoryAccountOtpStore,
  requestAccountCode,
  verifyAccountCode,
} from './otp';
import {
  ACCOUNT_SESSION_COOKIE,
  accountSessionsConfigured,
  cookieValueFromHeader,
  createAccountSession,
  resolveAccountSession,
  revokeAccountSession,
  verifyAccountSessionToken,
} from './session';
import { deleteAccountAsync, ensureAccountAsync } from './accounts';

const EMAIL = 'friend@example.com';
const SECRET = 'test-secret-that-is-long-enough';

let savedSecret: string | undefined;
let savedLedger: string | undefined;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'aa-auth-'));
  savedSecret = process.env.ACCOUNT_SESSION_SECRET;
  savedLedger = process.env.ACCOUNTS_LEDGER_PATH;
  process.env.ACCOUNT_SESSION_SECRET = SECRET;
  process.env.ACCOUNTS_LEDGER_PATH = join(dir, 'accounts.jsonl');
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env.ACCOUNT_SESSION_SECRET;
  else process.env.ACCOUNT_SESSION_SECRET = savedSecret;
  if (savedLedger === undefined) delete process.env.ACCOUNTS_LEDGER_PATH;
  else process.env.ACCOUNTS_LEDGER_PATH = savedLedger;
});

describe('account OTP', () => {
  it('issues a 6-digit code, stores only its hash, verifies once', async () => {
    const store = new InMemoryAccountOtpStore();
    const { request, code } = await requestAccountCode(store, ' Friend@Example.com ');
    expect(code).toMatch(/^\d{6}$/);
    expect(request.purpose).toBe('account_signin');
    expect(request.expires_in_seconds).toBe(600);
    const persisted = await store.getCodeRequest(request.request_id);
    expect(persisted?.email).toBe(EMAIL);
    expect(persisted?.code_hash).not.toContain(code);
    expect(persisted?.code_hash).toContain('$');

    const wrong = await verifyAccountCode(store, request.request_id, '000000'.replace(code, '999999'));
    expect(wrong.ok).toBe(false);
    const verified = await verifyAccountCode(store, request.request_id, code);
    expect(verified).toEqual({ ok: true, email: EMAIL });
    // Single use: the same code cannot verify twice.
    const again = await verifyAccountCode(store, request.request_id, code);
    expect(again).toEqual({ ok: false, reason: 'not_found' });
  });

  it('rejects invalid emails at issuance and burns after 5 attempts', async () => {
    const store = new InMemoryAccountOtpStore();
    await expect(requestAccountCode(store, 'not-an-email')).rejects.toThrow(
      'valid email',
    );
    const { request, code } = await requestAccountCode(store, EMAIL);
    const wrongCode = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const res = await verifyAccountCode(store, request.request_id, wrongCode);
      expect(res).toEqual({ ok: false, reason: 'mismatch' });
    }
    const burned = await verifyAccountCode(store, request.request_id, code);
    expect(burned).toEqual({ ok: false, reason: 'too_many_attempts' });
  });
});

describe('signed sessions', () => {
  it('creates a token that verifies and resolves against the store', async () => {
    await ensureAccountAsync(EMAIL);
    expect(accountSessionsConfigured()).toBe(true);
    const { token, session_id } = await createAccountSession(EMAIL);
    expect(verifyAccountSessionToken(token)).toEqual({
      email: EMAIL,
      session_id,
    });
    await expect(resolveAccountSession(token)).resolves.toEqual({
      email: EMAIL,
      session_id,
    });
  });

  it('rejects tampered tokens (email, session id, signature)', async () => {
    await ensureAccountAsync(EMAIL);
    const { token } = await createAccountSession(EMAIL);
    const [encEmail, sessionId, sig] = token.split('.');
    // Forged email segment.
    const forgedEmail = Buffer.from('attacker@example.com').toString('base64url');
    expect(verifyAccountSessionToken(`${forgedEmail}.${sessionId}.${sig}`)).toBeNull();
    // Swapped session id.
    expect(verifyAccountSessionToken(`${encEmail}.${'f'.repeat(64)}.${sig}`)).toBeNull();
    // Truncated / extended signature.
    expect(verifyAccountSessionToken(`${encEmail}.${sessionId}.${sig.slice(0, -2)}`)).toBeNull();
    expect(verifyAccountSessionToken(`${encEmail}.${sessionId}.${sig}AA`)).toBeNull();
    // Garbage shapes.
    expect(verifyAccountSessionToken('')).toBeNull();
    expect(verifyAccountSessionToken('a.b')).toBeNull();
    expect(verifyAccountSessionToken(null)).toBeNull();
    expect(verifyAccountSessionToken(undefined)).toBeNull();
  });

  it('revocation and deletion both end resolution', async () => {
    await ensureAccountAsync(EMAIL);
    const one = await createAccountSession(EMAIL);
    const identity = await resolveAccountSession(one.token);
    expect(identity).not.toBeNull();
    await revokeAccountSession(identity!);
    await expect(resolveAccountSession(one.token)).resolves.toBeNull();

    const two = await createAccountSession(EMAIL);
    await expect(resolveAccountSession(two.token)).resolves.not.toBeNull();
    await deleteAccountAsync(EMAIL);
    await expect(resolveAccountSession(two.token)).resolves.toBeNull();
  });

  it('a session id that was never issued does not resolve, even well-signed', async () => {
    await ensureAccountAsync(EMAIL);
    // Hand-sign a token for a session the store never issued.
    const { createHmac } = await import('node:crypto');
    const sessionId = 'a'.repeat(64);
    const sig = createHmac('sha256', SECRET)
      .update(`${EMAIL}.${sessionId}`)
      .digest('base64url');
    const token = `${Buffer.from(EMAIL).toString('base64url')}.${sessionId}.${sig}`;
    expect(verifyAccountSessionToken(token)).not.toBeNull(); // signature is valid…
    await expect(resolveAccountSession(token)).resolves.toBeNull(); // …but the store says no.
  });
});

describe('fail-closed without the secret', () => {
  it('unset secret: not configured, creation throws, verification is null', async () => {
    delete process.env.ACCOUNT_SESSION_SECRET;
    expect(accountSessionsConfigured()).toBe(false);
    await expect(createAccountSession(EMAIL)).rejects.toThrow('not configured');
    expect(verifyAccountSessionToken('whatever.token.here')).toBeNull();
    await expect(resolveAccountSession('whatever.token.here')).resolves.toBeNull();
  });

  it('too-short secret counts as unconfigured', () => {
    process.env.ACCOUNT_SESSION_SECRET = 'short';
    expect(accountSessionsConfigured()).toBe(false);
  });

  it('tokens signed under a different secret never verify', async () => {
    await ensureAccountAsync(EMAIL);
    const { token } = await createAccountSession(EMAIL);
    process.env.ACCOUNT_SESSION_SECRET = 'a-completely-different-secret-value';
    expect(verifyAccountSessionToken(token)).toBeNull();
    await expect(resolveAccountSession(token)).resolves.toBeNull();
  });
});

describe('cookie parsing', () => {
  it('reads the session cookie out of a header', () => {
    const header = `other=1; ${ACCOUNT_SESSION_COOKIE}=abc.def.ghi; theme=dark`;
    expect(cookieValueFromHeader(header, ACCOUNT_SESSION_COOKIE)).toBe('abc.def.ghi');
    expect(cookieValueFromHeader(null, ACCOUNT_SESSION_COOKIE)).toBeNull();
    expect(cookieValueFromHeader('other=1', ACCOUNT_SESSION_COOKIE)).toBeNull();
  });
});
