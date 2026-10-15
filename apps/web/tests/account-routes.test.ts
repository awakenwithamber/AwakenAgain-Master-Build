/**
 * Account routes — Phase 3 Step 3 (end-to-end over the route handlers).
 *
 * Covers: the fail-closed contract (no ACCOUNT_SESSION_SECRET → 503,
 * nothing issued), request-code honesty (delivery:'preview' while the
 * logging provider is bound; the code itself NEVER in a response), the
 * full sign-in flow (code captured from the EmailProvider job — the
 * one place it legitimately exists in-process), profile writes behind
 * the session, likes merge, export completeness over HTTP, sign-out
 * revocation, and deletion (tombstone: re-sign-in refused, export gone).
 */
import { mkdtempSync } from 'node:fs';
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
import { POST as requestCodePost } from '../app/api/account/request-code/route';
import { POST as verifyPost } from '../app/api/account/verify/route';
import { POST as signOutPost } from '../app/api/account/sign-out/route';
import { GET as meGet } from '../app/api/account/me/route';
import { POST as likesPost } from '../app/api/account/likes/route';
import { POST as searchesPost } from '../app/api/account/searches/route';
import { POST as quizResultPost } from '../app/api/account/quiz-result/route';
import { POST as progressPost } from '../app/api/account/progress/route';
import { GET as exportGet } from '../app/api/account/export/route';
import { POST as deletePost } from '../app/api/account/delete/route';

const EMAIL = 'friend@example.com';
const SECRET = 'route-test-secret-that-is-long-enough';
const ROSE = 'gaias-rose-soap';
const CHILL = 'chill-pill-capsules';

const ENVS = [
  'ACCOUNTS_LEDGER_PATH',
  'LEAD_STORE_DIR',
  'ORDERS_LEDGER_PATH',
  'ORDER_PAYMENTS_LEDGER_PATH',
  'ACCOUNT_SESSION_SECRET',
] as const;

const saved: Record<string, string | undefined> = {};
let sendSpy: MockInstance<(job: EmailJob) => Promise<SendResult>>;

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

function get(path: string, cookie?: string): Request {
  return new Request(`http://localhost${path}`, {
    method: 'GET',
    headers: { ...(cookie ? { cookie } : {}) },
  });
}

function sessionCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/aa_account_session=([^;]+)/);
  expect(match, 'session cookie set').not.toBeNull();
  return `aa_account_session=${match![1]}`;
}

/** Run request-code and pull the issued code out of the email job. */
async function requestCode(email: string): Promise<{ requestId: string }> {
  const res = await requestCodePost(post('/api/account/request-code', { email }));
  expect(res.status).toBe(200);
  const json = (await res.json()) as Record<string, unknown>;
  expect(json.delivery).toBe('preview');
  expect(JSON.stringify(json)).not.toMatch(/^\d{6}$/);
  const jobs = sendSpy.mock.calls.map(
    (call) => call[0] as unknown as EmailJob,
  );
  const job = jobs[jobs.length - 1];
  expect(job.template).toBe('account_signin_code');
  const code = (job.data as { code: string }).code;
  expect(code).toMatch(/^\d{6}$/);
  return { requestId: json.request_id as string };
}

async function signIn(email: string): Promise<{ cookie: string; isNew: boolean }> {
  const { requestId } = await requestCode(email);
  const jobs = sendSpy.mock.calls.map((call) => call[0] as unknown as EmailJob);
  const code = (jobs[jobs.length - 1].data as { code: string }).code;
  const res = await verifyPost(
    post('/api/account/verify', { request_id: requestId, code }),
  );
  expect(res.status).toBe(200);
  const json = (await res.json()) as Record<string, unknown>;
  return { cookie: sessionCookie(res), isNew: json.is_new_account === true };
}

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'aa-account-routes-'));
  for (const key of ENVS) saved[key] = process.env[key];
  process.env.ACCOUNTS_LEDGER_PATH = join(dir, 'accounts.jsonl');
  process.env.LEAD_STORE_DIR = join(dir, 'leads');
  process.env.ORDERS_LEDGER_PATH = join(dir, 'orders.jsonl');
  process.env.ORDER_PAYMENTS_LEDGER_PATH = join(dir, 'payments.jsonl');
  process.env.ACCOUNT_SESSION_SECRET = SECRET;
  delete process.env.DATABASE_URL;
  sendSpy = vi
    .spyOn(LoggingEmailProvider.prototype, 'send')
    .mockImplementation(async function (job: EmailJob) {
      return { ok: true, provider_message_id: `preview-${job.id}` };
    });
});

afterEach(() => {
  for (const key of ENVS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
});

describe('fail-closed without the session secret', () => {
  it('request-code and verify answer 503 and issue nothing', async () => {
    delete process.env.ACCOUNT_SESSION_SECRET;
    const req = await requestCodePost(
      post('/api/account/request-code', { email: EMAIL }),
    );
    expect(req.status).toBe(503);
    expect(sendSpy).not.toHaveBeenCalled();
    const ver = await verifyPost(
      post('/api/account/verify', { request_id: 'acct_x', code: '123456' }),
    );
    expect(ver.status).toBe(503);
    const me = await meGet(get('/api/account/me'));
    expect(me.status).toBe(503);
  });
});

describe('request-code', () => {
  it('rejects invalid emails with 422 and sends nothing', async () => {
    const res = await requestCodePost(
      post('/api/account/request-code', { email: 'not-an-email' }),
    );
    expect(res.status).toBe(422);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('never puts the code in the response body', async () => {
    const res = await requestCodePost(
      post('/api/account/request-code', { email: EMAIL }),
    );
    const text = await res.text();
    const job = sendSpy.mock.calls[0][0] as unknown as EmailJob;
    const code = (job.data as { code: string }).code;
    expect(text).not.toContain(code);
    expect(JSON.parse(text).delivery).toBe('preview');
  });
});

describe('full sign-in + profile flow', () => {
  it('signs in (creating the account), writes profile data, exports, signs out', async () => {
    const { cookie, isNew } = await signIn(EMAIL);
    expect(isNew).toBe(true);

    // Second sign-in for the same email is NOT a new account.
    const again = await signIn(EMAIL);
    expect(again.isNew).toBe(false);

    // /me starts empty.
    let res = await meGet(get('/api/account/me', cookie));
    expect(res.status).toBe(200);
    let json = (await res.json()) as { profile: Record<string, unknown> };
    expect(json.profile.email).toBe(EMAIL);
    expect(json.profile.likes).toEqual([]);

    // Likes: replace, then merge (first-sign-in sync semantics).
    res = await likesPost(
      post('/api/account/likes', { likes: [ROSE, 'bogus'] }, cookie),
    );
    expect(((await res.json()) as { likes: string[] }).likes).toEqual([ROSE]);
    res = await likesPost(
      post('/api/account/likes', { likes: [CHILL, ROSE], mode: 'merge' }, cookie),
    );
    expect(((await res.json()) as { likes: string[] }).likes).toEqual([ROSE, CHILL]);

    // Searches: save + remove.
    res = await searchesPost(
      post('/api/account/searches', { action: 'save', query: 'lavender', surface: 'catalog' }, cookie),
    );
    let searches = ((await res.json()) as { searches: { id: string }[] }).searches;
    expect(searches).toHaveLength(1);
    res = await searchesPost(
      post('/api/account/searches', { action: 'remove', search_id: searches[0].id }, cookie),
    );
    searches = ((await res.json()) as { searches: { id: string }[] }).searches;
    expect(searches).toHaveLength(0);

    // Quiz result: server-computed snapshot from ids.
    res = await quizResultPost(
      post('/api/account/quiz-result', { concernId: 'sleep', formId: 'tea' }, cookie),
    );
    const quizJson = (await res.json()) as {
      quiz_results: { result: { concernId: string }; via: string }[];
    };
    expect(quizJson.quiz_results).toHaveLength(1);
    expect(quizJson.quiz_results[0].result.concernId).toBe('sleep');
    expect(quizJson.quiz_results[0].via).toBe('quiz');

    // Progress: interest snapshot sync.
    res = await progressPost(
      post('/api/account/progress', { interests: { herbs: 4, quiz: 3 } }, cookie),
    );
    const progress = ((await res.json()) as { progress: { interests: { herbs: number }; quiz_completed_at: string } }).progress;
    expect(progress.interests.herbs).toBe(4);
    expect(progress.quiz_completed_at).toBeTruthy();

    // /me reflects everything, orders/leads empty but present.
    res = await meGet(get('/api/account/me', cookie));
    json = (await res.json()) as { profile: Record<string, unknown> };
    expect((json.profile.likes as { handle: string }[]).map((l) => l.handle)).toEqual([ROSE, CHILL]);
    expect(json.profile.orders).toEqual([]);

    // Export downloads the complete record.
    res = await exportGet(get('/api/account/export', cookie));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
    const exp = (await res.json()) as { account: { likes: string[] }; leads: unknown[] };
    expect(exp.account.likes).toEqual([ROSE, CHILL]);
    expect(exp.leads).toEqual([]);

    // Sign-out revokes: the same cookie stops resolving.
    res = await signOutPost(post('/api/account/sign-out', {}, cookie));
    expect(res.status).toBe(200);
    res = await meGet(get('/api/account/me', cookie));
    expect(res.status).toBe(401);
  });

  it('profile writes without a session are 401', async () => {
    for (const res of [
      await likesPost(post('/api/account/likes', { likes: [] })),
      await searchesPost(post('/api/account/searches', { action: 'save', query: 'lavender', surface: 'catalog' })),
      await quizResultPost(post('/api/account/quiz-result', { concernId: 'sleep', formId: 'tea' })),
      await exportGet(get('/api/account/export')),
    ]) {
      expect(res.status).toBe(401);
    }
  });

  it('a tampered cookie is 401, not a grant', async () => {
    const { cookie } = await signIn(EMAIL);
    const tampered = cookie.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
    const res = await meGet(get('/api/account/me', tampered));
    expect(res.status).toBe(401);
  });
});

describe('deletion', () => {
  it('requires the exact email, then tombstones: sign-in refused, session dead', async () => {
    const { cookie } = await signIn(EMAIL);

    // Wrong confirmation email → 422, account alive.
    let res = await deletePost(
      post('/api/account/delete', { confirm_email: 'other@example.com' }, cookie),
    );
    expect(res.status).toBe(422);
    res = await meGet(get('/api/account/me', cookie));
    expect(res.status).toBe(200);

    // Correct confirmation → deleted.
    res = await deletePost(
      post('/api/account/delete', { confirm_email: EMAIL }, cookie),
    );
    expect(res.status).toBe(200);

    // The old session no longer resolves.
    res = await meGet(get('/api/account/me', cookie));
    expect(res.status).toBe(401);

    // And the tombstoned email cannot sign in again (request-code 403).
    res = await requestCodePost(post('/api/account/request-code', { email: EMAIL }));
    expect(res.status).toBe(403);
  });
});
