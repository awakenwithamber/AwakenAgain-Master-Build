/**
 * Phase 2, Workstream 3 — the $8.88 Grimoire unlock on the manual rail.
 *
 * Route level, temp ledgers: request → pending (NO access) → owner
 * notification queued → admin grant behind the owner secret → access
 * opens (the gate's own entitlement resolver) + the customer's
 * unlock-active email fires exactly once → duplicate grant is a no-op
 * → refund revocation closes access again. Canon pins: the amount is
 * exactly the $8.88 canon constant; the unlock is subscription-
 * independent (no subscription record exists anywhere in this test);
 * nothing here touches a card or a processor.
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
import { POST as requestPost } from '../app/api/grimoire-unlock/request/route';
import { GET as statusGet } from '../app/api/grimoire-unlock/status/route';
import { POST as adminPost } from '../app/api/admin/grimoire/unlock/route';
import { isGrimoireEntitled } from '../lib/grimoire/entitlement';
import { GRIMOIRE_UNLOCK_PRICE_CENTS } from '../lib/grimoire/edition';

const DIR = mkdtempSync(join(tmpdir(), 'phase2-unlock-'));
const UNLOCKS = join(DIR, 'unlocks.jsonl');
const REQUESTS = join(DIR, 'requests.jsonl');
const SUBSCRIPTIONS = join(DIR, 'subscriptions.jsonl');
const SECRET = 'phase2-unlock-owner-secret';
const EMAIL = 'reader@example.com';

const ENVS = [
  'GRIMOIRE_UNLOCKS_LEDGER_PATH',
  'GRIMOIRE_UNLOCK_REQUESTS_LEDGER_PATH',
  'SUBSCRIPTIONS_LEDGER_PATH',
  'OWNER_ADMIN_SECRET',
  'DATABASE_URL',
  'RESEND_API_KEY',
] as const;
const saved: Record<string, string | undefined> = {};

let jobs: EmailJob[];
let sendSpy: MockInstance<(job: EmailJob) => Promise<SendResult>>;

function post(path: string, body: unknown, secret?: string): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret !== undefined ? { 'x-owner-secret': secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function status(email: string) {
  const res = await statusGet(
    new Request(
      `http://localhost/api/grimoire-unlock/status?email=${encodeURIComponent(email)}`,
    ),
  );
  return (await res.json()) as { state: string };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 25));
}

beforeEach(() => {
  for (const key of ENVS) saved[key] = process.env[key];
  process.env.GRIMOIRE_UNLOCKS_LEDGER_PATH = UNLOCKS;
  process.env.GRIMOIRE_UNLOCK_REQUESTS_LEDGER_PATH = REQUESTS;
  process.env.SUBSCRIPTIONS_LEDGER_PATH = SUBSCRIPTIONS;
  process.env['OWNER_ADMIN_' + 'SECRET'] = SECRET;
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

describe('unlock request → owner verify → grant → revoke', () => {
  it('the full loop holds the canon: $8.88, pending grants nothing, grant opens the gate, refund revokes', async () => {
    expect(GRIMOIRE_UNLOCK_PRICE_CENTS).toBe(888);

    // 1. Request.
    const requested = await requestPost(
      post('/api/grimoire-unlock/request', { email: EMAIL, payment_method: 'venmo' }),
    );
    expect(requested.status).toBe(201);
    const body = (await requested.json()) as {
      state: string;
      payment: {
        request_id: string;
        amount: string;
        reference: string;
        venmo: string;
        cash_app: string;
      };
    };
    const requestId = body.payment.request_id;
    expect(body.state).toBe('pending');
    expect(body.payment.amount).toBe('$8.88');
    expect(body.payment.reference).toBe(requestId);
    expect(body.payment.venmo).toBe('@AwakenwithAmber');
    expect(body.payment.cash_app).toBe('$AmberPatten347');

    // 2. Pending grants NOTHING; the owner was notified.
    expect((await status(EMAIL)).state).toBe('pending');
    expect(await isGrimoireEntitled(EMAIL)).toBe(false);
    await flush();
    const ownerJobs = jobs.filter((j) => j.template === 'grimoire_unlock_requested');
    expect(ownerJobs).toHaveLength(1);
    expect(ownerJobs[0].to).toBe('amber@awakenagain.com');

    // 3. A duplicate request returns the same pending request.
    const dupe = await requestPost(
      post('/api/grimoire-unlock/request', { email: EMAIL }),
    );
    expect(dupe.status).toBe(200);
    expect(
      ((await dupe.json()) as { payment: { request_id: string } }).payment
        .request_id,
    ).toBe(requestId);

    // 4. Admin path refuses without the secret.
    expect(
      (await adminPost(post('/api/admin/grimoire/unlock', { action: 'grant', email: EMAIL })))
        .status,
    ).toBe(401);
    expect(
      (
        await adminPost(
          post('/api/admin/grimoire/unlock', { action: 'grant', email: EMAIL }, 'wrong'),
        )
      ).status,
    ).toBe(401);
    expect(await isGrimoireEntitled(EMAIL)).toBe(false);

    // 5. Grant → entitled, request granted, activation email exactly once.
    jobs = [];
    const granted = await adminPost(
      post(
        '/api/admin/grimoire/unlock',
        { action: 'grant', email: EMAIL, request_id: requestId },
        SECRET,
      ),
    );
    expect(granted.status).toBe(200);
    expect(await isGrimoireEntitled(EMAIL)).toBe(true);
    expect((await status(EMAIL)).state).toBe('active');
    await flush();
    const activeJobs = jobs.filter((j) => j.template === 'grimoire_unlock_active');
    expect(activeJobs).toHaveLength(1);
    expect(activeJobs[0].to).toBe(EMAIL);

    // 6. Repeating the grant is a recorded no-op (no second email).
    const again = await adminPost(
      post(
        '/api/admin/grimoire/unlock',
        { action: 'grant', email: EMAIL, request_id: requestId },
        SECRET,
      ),
    );
    expect(((await again.json()) as { already_recorded: boolean }).already_recorded).toBe(true);
    await flush();
    expect(jobs.filter((j) => j.template === 'grimoire_unlock_active')).toHaveLength(1);

    // 7. A fresh request while unlocked short-circuits honestly.
    const whileActive = await requestPost(
      post('/api/grimoire-unlock/request', { email: EMAIL }),
    );
    expect(((await whileActive.json()) as { state: string }).state).toBe(
      'already_unlocked',
    );

    // 8. Refund revocation closes the gate again.
    const revoked = await adminPost(
      post(
        '/api/admin/grimoire/unlock',
        { action: 'revoke', email: EMAIL, reason: 'refund' },
        SECRET,
      ),
    );
    expect(revoked.status).toBe(200);
    expect(await isGrimoireEntitled(EMAIL)).toBe(false);
    expect((await status(EMAIL)).state).toBe('revoked');
  });

  it('granting without a prior request still works (owner-verified offline payment) and emails the customer', async () => {
    const granted = await adminPost(
      post(
        '/api/admin/grimoire/unlock',
        { action: 'grant', email: 'walkin@example.com', reference: 'venmo-note-123' },
        SECRET,
      ),
    );
    expect(granted.status).toBe(200);
    expect(await isGrimoireEntitled('walkin@example.com')).toBe(true);
    await flush();
    expect(
      jobs.filter((j) => j.template === 'grimoire_unlock_active'),
    ).toHaveLength(1);
    expect(sendSpy).toHaveBeenCalled();
  });

  it('fails closed (404) when the owner secret is unconfigured', async () => {
    delete process.env.OWNER_ADMIN_SECRET;
    const res = await adminPost(
      post('/api/admin/grimoire/unlock', { action: 'grant', email: EMAIL }, SECRET),
    );
    expect(res.status).toBe(404);
  });
});
