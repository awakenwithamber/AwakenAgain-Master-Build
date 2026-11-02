/**
 * Phase 2, Workstream 2B — registration & auth redesign, route level.
 *
 * Runs the real route handlers against temp JSONL ledgers with the
 * persistent code store in force. Codes are captured from the email
 * jobs the provider receives in-process (the legitimate seam used by
 * the pre-existing account-route tests — codes never appear in any
 * HTTP response).
 *
 * Spec coverage (owner's required list): register → verify →
 * dashboard; wrong code; expired code → resend → success; duplicate
 * email (verified-existing and passwordless-existing); password
 * sign-in correct + incorrect; legacy code sign-in → complete
 * profile → password sign-in; forgot-password full loop;
 * unverified sign-in blocked with resend; phone validation incl.
 * country code; password mismatch + weak rejections; no-enumeration
 * response equality; registration shipping address stored, editable
 * on the profile, and independent of any single order.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import {
  LoggingEmailProvider,
  type EmailJob,
  type SendResult,
} from '../lib/jobs/email';
import { POST as registerPost } from '../app/api/account/register/route';
import { POST as verifyEmailPost } from '../app/api/account/verify-email/route';
import { POST as resendPost } from '../app/api/account/resend-code/route';
import { POST as signInPost } from '../app/api/account/sign-in/route';
import { POST as forgotPost } from '../app/api/account/forgot-password/route';
import { POST as resetPost } from '../app/api/account/reset-password/route';
import { POST as completePost } from '../app/api/account/complete-profile/route';
import { POST as requestCodePost } from '../app/api/account/request-code/route';
import { POST as verifyPost } from '../app/api/account/verify/route';
import { POST as signOutPost } from '../app/api/account/sign-out/route';
import { GET as meGet } from '../app/api/account/me/route';
import { validateAndBuildOrder } from '../lib/checkout/order';

const DIR = mkdtempSync(join(tmpdir(), 'phase2-auth-'));
const ACCOUNTS = join(DIR, 'accounts.jsonl');
const CODES = join(DIR, 'codes.jsonl');
const SESSION_SECRET = 'phase2-auth-test-secret-that-is-long';

const ENVS = [
  'ACCOUNTS_LEDGER_PATH',
  'ACCOUNT_CODES_LEDGER_PATH',
  'ACCOUNT_SESSION_SECRET',
  'DATABASE_URL',
  'RESEND_API_KEY',
] as const;
const saved: Record<string, string | undefined> = {};

let jobs: EmailJob[];
let sendSpy: MockInstance<(job: EmailJob) => Promise<SendResult>>;

const ADDRESS = {
  name: 'Jamie Rivera',
  street: '239 S 1200 W',
  city: 'Salt Lake City',
  state: 'UT',
  postal_code: '84104',
  country: 'US',
};

function post(path: string, body: unknown, cookie?: string): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function sessionCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/aa_account_session=([^;]+)/);
  expect(match, 'session cookie set').not.toBeNull();
  return `aa_account_session=${match![1]}`;
}

function latestCode(kind: string, email: string): string {
  const job = [...jobs]
    .reverse()
    .find(
      (j) =>
        (j.template === 'account_verification_code' ||
          j.template === 'account_password_reset_code' ||
          j.template === 'account_signin_code') &&
        j.to === email,
    );
  expect(job, `a ${kind} code job for ${email}`).toBeDefined();
  return (job as { data: { code: string } }).data.code;
}

function registerBody(email: string, overrides: Record<string, unknown> = {}) {
  return {
    first_name: 'Jamie',
    last_name: 'Rivera',
    email,
    phone_country: 'US',
    phone: '(801) 555-0134',
    password: 'grimoire-garden-42',
    confirm_password: 'grimoire-garden-42',
    shipping_address: ADDRESS,
    ...overrides,
  };
}

async function register(email: string, overrides: Record<string, unknown> = {}) {
  return registerPost(post('/api/account/register', registerBody(email, overrides)));
}

async function registerAndVerify(email: string): Promise<string> {
  const res = await register(email);
  expect(res.status).toBe(201);
  const code = latestCode('account_verification_code', email);
  const verified = await verifyEmailPost(
    post('/api/account/verify-email', { email, code }),
  );
  expect(verified.status).toBe(200);
  return sessionCookie(verified);
}

async function me(cookie: string) {
  const res = await meGet(
    new Request('http://localhost/api/account/me', {
      headers: { cookie },
    }),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as {
    profile: {
      email: string;
      first_name: string | null;
      last_name: string | null;
      phone: string | null;
      has_password: boolean;
      email_verified: boolean;
      needs_profile_completion: boolean;
      shipping_address: typeof ADDRESS | null;
    };
  };
}

function accountCreatedCount(email: string): number {
  return readFileSync(ACCOUNTS, 'utf8')
    .split('\n')
    .filter((line) => line.includes('"account.created"') && line.includes(email))
    .length;
}

beforeEach(() => {
  for (const key of ENVS) saved[key] = process.env[key];
  process.env.ACCOUNTS_LEDGER_PATH = ACCOUNTS;
  process.env.ACCOUNT_CODES_LEDGER_PATH = CODES;
  process.env['ACCOUNT_SESSION_' + 'SECRET'] = SESSION_SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.RESEND_API_KEY;
  jobs = [];
  sendSpy = vi
    .spyOn(LoggingEmailProvider.prototype, 'send')
    .mockImplementation(async (job: EmailJob) => {
      jobs.push(job);
      return { ok: true };
    });
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of ENVS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('registration → verification → dashboard', () => {
  it('register (201) → wrong code (401) → correct code → session + full profile incl. address', async () => {
    const email = 'new-registrant@example.com';
    const res = await register(email);
    expect(res.status).toBe(201);
    expect(sendSpy).toHaveBeenCalled();

    const wrong = await verifyEmailPost(
      post('/api/account/verify-email', { email, code: '000000' }),
    );
    expect(wrong.status).toBe(401);

    const code = latestCode('account_verification_code', email);
    const verified = await verifyEmailPost(
      post('/api/account/verify-email', { email, code }),
    );
    expect(verified.status).toBe(200);
    const body = (await verified.json()) as { ok: boolean; email: string };
    expect(body.ok).toBe(true);
    expect(body.email).toBe(email);
    const cookie = sessionCookie(verified);

    const { profile } = await me(cookie);
    expect(profile.first_name).toBe('Jamie');
    expect(profile.last_name).toBe('Rivera');
    expect(profile.phone).toBe('+18015550134');
    expect(profile.has_password).toBe(true);
    expect(profile.email_verified).toBe(true);
    expect(profile.needs_profile_completion).toBe(false);
    expect(profile.shipping_address).toEqual(ADDRESS);
  });

  it('the code is single-use: verifying twice fails the second time', async () => {
    const email = 'single-use@example.com';
    await register(email);
    const code = latestCode('account_verification_code', email);
    expect(
      (await verifyEmailPost(post('/api/account/verify-email', { email, code })))
        .status,
    ).toBe(200);
    expect(
      (await verifyEmailPost(post('/api/account/verify-email', { email, code })))
        .status,
    ).toBe(401);
  });

  it('registration without an address is allowed only with the explicit digital-only opt-out', async () => {
    const email = 'digital-only@example.com';
    const noOptOut = await register(email, { shipping_address: undefined });
    expect(noOptOut.status).toBe(422);

    const withOptOut = await register(email, {
      shipping_address: undefined,
      no_shipping_address: true,
    });
    expect(withOptOut.status).toBe(201);
    const cookie = await (async () => {
      const code = latestCode('account_verification_code', email);
      const verified = await verifyEmailPost(
        post('/api/account/verify-email', { email, code }),
      );
      return sessionCookie(verified);
    })();
    const { profile } = await me(cookie);
    expect(profile.shipping_address).toBeNull();
    expect(profile.needs_profile_completion).toBe(false);
  });

  it('registration rejects a bad address, bad phone, mismatched and weak passwords', async () => {
    const email = 'rejects@example.com';
    expect(
      (await register(email, { shipping_address: { ...ADDRESS, postal_code: '8410' } }))
        .status,
    ).toBe(422);
    expect((await register(email, { phone: '555-0134' })).status).toBe(422);
    expect((await register(email, { phone_country: undefined })).status).toBe(422);
    expect(
      (await register(email, { confirm_password: 'different-42' })).status,
    ).toBe(422);
    expect(
      (
        await register(email, {
          password: 'short1',
          confirm_password: 'short1',
        })
      ).status,
    ).toBe(422);
    expect(accountCreatedCount(email)).toBe(0);
  });
});

describe('expired code → resend → success', () => {
  it('an expired verification code fails plainly; resend issues a working one', async () => {
    const email = 'expired@example.com';
    await register(email);

    // Hand-expire the stored record (same store the route reads):
    // a newest record for (email, purpose) whose code we know and
    // whose expiry is already in the past.
    const { JsonlAccountOtpStore } = await import('../lib/accounts/otp-store');
    const { randomBytes, scryptSync } = await import('node:crypto');
    const store = new JsonlAccountOtpStore();
    const known = '424242';
    const salt = randomBytes(16).toString('hex');
    await store.saveCodeRequest({
      request_id: 'expired-test-request',
      email,
      purpose: 'email_verification',
      code_hash: `${salt}$${scryptSync(known, salt, 32).toString('hex')}`,
      attempts: 0,
      consumed: false,
      // The store's expires_at is epoch SECONDS (otp.ts contract).
      expires_at: Math.floor(Date.now() / 1000) - 60,
    });
    const expired = await verifyEmailPost(
      post('/api/account/verify-email', { email, code: known }),
    );
    expect(expired.status).toBe(401);
    const expiredBody = (await expired.json()) as { errors: string[] };
    expect(expiredBody.errors.join(' ')).toMatch(/expired/i);

    const resent = await resendPost(
      post('/api/account/resend-code', { email, purpose: 'verification' }),
    );
    expect(resent.status).toBe(200);
    const fresh = latestCode('account_verification_code', email);
    expect(fresh).not.toBe(known);
    expect(
      (await verifyEmailPost(post('/api/account/verify-email', { email, code: fresh })))
        .status,
    ).toBe(200);
  });
});

describe('duplicates', () => {
  it('registering over a verified account → 409, no second account', async () => {
    const email = 'dupe-verified@example.com';
    await registerAndVerify(email);
    const again = await register(email);
    expect(again.status).toBe(409);
    const body = (await again.json()) as { code: string };
    expect(body.code).toBe('account_exists');
    expect(accountCreatedCount(email)).toBe(1);
  });

  it('registering over a passwordless (legacy) account → 409, no second account', async () => {
    const email = 'dupe-legacy@example.com';
    const requested = await requestCodePost(
      post('/api/account/request-code', { email }),
    );
    const { request_id } = (await requested.json()) as { request_id: string };
    const code = latestCode('account_signin_code', email);
    const verified = await verifyPost(
      post('/api/account/verify', { request_id, code }),
    );
    expect(verified.status).toBe(200);

    const again = await register(email);
    expect(again.status).toBe(409);
    expect(accountCreatedCount(email)).toBe(1);
  });
});

describe('password sign-in', () => {
  it('correct password signs in; wrong password gets the generic refusal', async () => {
    const email = 'signin@example.com';
    await registerAndVerify(email);
    const ok = await signInPost(
      post('/api/account/sign-in', { email, password: 'grimoire-garden-42' }),
    );
    expect(ok.status).toBe(200);
    sessionCookie(ok);

    const bad = await signInPost(
      post('/api/account/sign-in', { email, password: 'wrong-password-9' }),
    );
    expect(bad.status).toBe(401);
    const badBody = (await bad.json()) as { errors: string[] };
    expect(badBody.errors.join(' ')).toMatch(/match our records/i);
  });

  it('an unverified account cannot password-sign-in; the response re-offers verification and resend completes it', async () => {
    const email = 'unverified@example.com';
    await register(email);
    const blocked = await signInPost(
      post('/api/account/sign-in', { email, password: 'grimoire-garden-42' }),
    );
    expect(blocked.status).toBe(403);
    const body = (await blocked.json()) as { code: string };
    expect(body.code).toBe('email_unverified');

    const resent = await resendPost(
      post('/api/account/resend-code', { email, purpose: 'verification' }),
    );
    expect(resent.status).toBe(200);
    const code = latestCode('account_verification_code', email);
    expect(
      (await verifyEmailPost(post('/api/account/verify-email', { email, code })))
        .status,
    ).toBe(200);
    expect(
      (await signInPost(post('/api/account/sign-in', { email, password: 'grimoire-garden-42' })))
        .status,
    ).toBe(200);
  });

  it('a passwordless account gets pointed at the code path, not a dead end', async () => {
    const email = 'passwordless-signin@example.com';
    const requested = await requestCodePost(post('/api/account/request-code', { email }));
    const { request_id } = (await requested.json()) as { request_id: string };
    await verifyPost(post('/api/account/verify', { request_id, code: latestCode('account_signin_code', email) }));

    const res = await signInPost(post('/api/account/sign-in', { email, password: 'anything-123' }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string; errors: string[] };
    expect(body.code).toBe('no_password_set');
    expect(body.errors.join(' ')).toMatch(/sign-in code/i);
  });
});

describe('legacy account → complete profile → password sign-in', () => {
  it('code sign-in, completion (name/phone/password/address), then password sign-in works; the email key is unchanged', async () => {
    const email = 'legacy-complete@example.com';
    const requested = await requestCodePost(post('/api/account/request-code', { email }));
    const { request_id } = (await requested.json()) as { request_id: string };
    const verified = await verifyPost(
      post('/api/account/verify', { request_id, code: latestCode('account_signin_code', email) }),
    );
    const cookie = sessionCookie(verified);

    const before = await me(cookie);
    expect(before.profile.needs_profile_completion).toBe(true);
    expect(before.profile.has_password).toBe(false);
    expect(before.profile.email_verified).toBe(true); // legacy implicit verification

    const completed = await completePost(
      post(
        '/api/account/complete-profile',
        {
          first_name: 'Jamie',
          last_name: 'Rivera',
          phone_country: 'US',
          phone: '801 555 0134',
          password: 'new-password-77',
          confirm_password: 'new-password-77',
          shipping_address: ADDRESS,
        },
        cookie,
      ),
    );
    expect(completed.status).toBe(200);

    const after = await me(cookie);
    expect(after.profile.needs_profile_completion).toBe(false);
    expect(after.profile.has_password).toBe(true);
    expect(after.profile.shipping_address).toEqual(ADDRESS);
    expect(after.profile.email).toBe(email);

    // Setting ANOTHER password through complete-profile is refused
    // (the reset flow owns password changes once one exists).
    const again = await completePost(
      post(
        '/api/account/complete-profile',
        { password: 'another-pass-88', confirm_password: 'another-pass-88' },
        cookie,
      ),
    );
    expect(again.status).toBe(422);

    await signOutPost(post('/api/account/sign-out', {}, cookie));
    const signedIn = await signInPost(
      post('/api/account/sign-in', { email, password: 'new-password-77' }),
    );
    expect(signedIn.status).toBe(200);
  });
});

describe('forgot password', () => {
  it('full loop: request → weak password rejected without burning the code → reset → signed in → new password works, old does not', async () => {
    const email = 'forgot@example.com';
    await registerAndVerify(email);

    const requested = await forgotPost(post('/api/account/forgot-password', { email }));
    expect(requested.status).toBe(200);
    const code = latestCode('account_password_reset_code', email);

    const weak = await resetPost(
      post('/api/account/reset-password', {
        email,
        code,
        password: 'short1',
        confirm_password: 'short1',
      }),
    );
    expect(weak.status).toBe(422);

    const reset = await resetPost(
      post('/api/account/reset-password', {
        email,
        code,
        password: 'brand-new-pass-31',
        confirm_password: 'brand-new-pass-31',
      }),
    );
    expect(reset.status).toBe(200);
    sessionCookie(reset);

    expect(
      (await signInPost(post('/api/account/sign-in', { email, password: 'grimoire-garden-42' })))
        .status,
    ).toBe(401);
    expect(
      (await signInPost(post('/api/account/sign-in', { email, password: 'brand-new-pass-31' })))
        .status,
    ).toBe(200);
  });

  it('no enumeration: the response for a nonexistent email is identical, and no code is sent', async () => {
    const email = 'forgot-real@example.com';
    await registerAndVerify(email);
    jobs = [];

    const realRes = await forgotPost(post('/api/account/forgot-password', { email }));
    const realBody = await realRes.json();
    const ghostRes = await forgotPost(
      post('/api/account/forgot-password', { email: 'ghost@example.com' }),
    );
    const ghostBody = await ghostRes.json();

    expect(ghostRes.status).toBe(realRes.status);
    expect(ghostBody).toEqual(realBody);
    const resetJobs = jobs.filter((j) => j.template === 'account_password_reset_code');
    expect(resetJobs).toHaveLength(1);
    expect(resetJobs[0].to).toBe(email);
  });
});

describe('profile address ↔ checkout independence (2B + WS1 tie-in)', () => {
  it('profile address edits never rewrite an order; an order uses the address submitted with it', async () => {
    const email = 'address-flows@example.com';
    const cookie = await registerAndVerify(email);
    const { profile } = await me(cookie);
    expect(profile.shipping_address).toEqual(ADDRESS);

    // The order carries its own submitted address (a per-order edit).
    const orderAddress = { ...ADDRESS, street: '77 Different Lane', city: 'Provo' };
    const record = validateAndBuildOrder({
      items: [
        {
          product_handle: 'gaias-rose-soap',
          quantity: 1,
          customization: {
            base: 'glycerin-castor',
            shape: 'wave-rectangle',
            scent: { type: 'signature', recipe_id: 'SCENT_RECIPE_01' },
            botanical: 'lavender',
            color: 'amber-gold',
          },
          unit_price_cents: 1177,
        },
      ],
      customer: { name: 'Jamie Rivera', email },
      shipping_address: orderAddress,
      client_total_cents: 1177 + 595,
    });
    expect(record.shipping_address?.street).toBe('77 Different Lane');

    // Editing the profile afterwards leaves the order record untouched
    // and updates only the profile default.
    const edited = await completePost(
      post(
        '/api/account/complete-profile',
        { shipping_address: { ...ADDRESS, street: '900 New Home Road' } },
        cookie,
      ),
    );
    expect(edited.status).toBe(200);
    const after = await me(cookie);
    expect(after.profile.shipping_address?.street).toBe('900 New Home Road');
    expect(record.shipping_address?.street).toBe('77 Different Lane');
  });
});
