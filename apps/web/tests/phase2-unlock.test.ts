/**
 * The Grimoire unlock after the $8.88 ABOLITION (owner decision
 * 2026-11-09) — supersedes the Phase 2 Workstream 3 full-loop pins.
 *
 * Laws under test now:
 * - INTAKE IS CLOSED: POST /api/grimoire-unlock/request answers 410,
 *   records NOTHING in the request ledger, sends NO owner
 *   notification, and grants nothing. (The audit's §G.4 gate —
 *   disposition pending requests before closing — was resolved by
 *   the owner's 2026-11-09 ruling that nobody has paid the $8.88.)
 * - ADMIN GRANT IS CLOSED: the owner route refuses 'grant' with 410
 *   even with the correct secret and an existing recorded request;
 *   the request stays 'requested', no entitlement appears, no
 *   activation email fires. Auth still fails closed (401 / 404).
 * - LEGACY RECORDS STILL RESOLVE: an unlock record written to the
 *   preserved ledger (lib/grimoire/unlock.ts) still entitles its
 *   holder through resolveGrimoireEntitlement (the PERMANENT_UNLOCK
 *   arm is preserved — it carries the owner's own access), the
 *   read-only status route still reports it, and admin REVOKE still
 *   closes it (refund/chargeback on a past sale).
 * - Subscribers are untouched: an Active subscription record still
 *   entitles, exactly as before.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
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
import { POST as requestPost, GET as requestGet } from '../app/api/grimoire-unlock/request/route';
import { GET as statusGet } from '../app/api/grimoire-unlock/status/route';
import { POST as adminPost } from '../app/api/admin/grimoire/unlock/route';
import {
  isGrimoireEntitled,
  resolveGrimoireEntitlement,
} from '../lib/grimoire/entitlement';
import { grantUnlock } from '../lib/grimoire/unlock';
import {
  createUnlockRequest,
  findPendingUnlockRequest,
  findUnlockRequest,
} from '../lib/grimoire/unlock-requests';
import { GRIMOIRE_UNLOCK_PRICE_CENTS } from '../lib/grimoire/edition';

const DIR = mkdtempSync(join(tmpdir(), 'unlock-abolition-'));
const UNLOCKS = join(DIR, 'unlocks.jsonl');
const REQUESTS = join(DIR, 'requests.jsonl');
const SUBSCRIPTIONS = join(DIR, 'subscriptions.jsonl');
const SECRET = 'unlock-abolition-owner-secret';
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

describe('intake is closed (410, nothing recorded, no email)', () => {
  it('POST and GET both refuse, and the legacy price constant stays the historical 888', async () => {
    expect(GRIMOIRE_UNLOCK_PRICE_CENTS).toBe(888);

    const res = await requestPost(
      post('/api/grimoire-unlock/request', { email: EMAIL, payment_method: 'venmo' }),
    );
    expect(res.status).toBe(410);
    const body = (await res.json()) as { ok: boolean; state: string; errors: string[] };
    expect(body.ok).toBe(false);
    expect(body.state).toBe('closed');
    expect(body.errors[0]).toContain('no longer offered');

    const getRes = await requestGet(
      new Request('http://localhost/api/grimoire-unlock/request'),
    );
    expect(getRes.status).toBe(410);

    // Nothing was recorded and nobody was notified.
    expect(await findPendingUnlockRequest(EMAIL)).toBeNull();
    expect((await status(EMAIL)).state).toBe('none');
    expect(await isGrimoireEntitled(EMAIL)).toBe(false);
    await flush();
    expect(jobs).toHaveLength(0);
    expect(sendSpy).not.toHaveBeenCalled();
  });
});

describe('admin grant is closed; auth still fails closed', () => {
  it('grant is refused (410) even for a recorded request with the right secret', async () => {
    const seeded = await createUnlockRequest({
      email: EMAIL,
      payment_method: 'cash_app_or_venmo',
    });

    const res = await adminPost(
      post(
        '/api/admin/grimoire/unlock',
        { action: 'grant', email: EMAIL, request_id: seeded.request_id },
        SECRET,
      ),
    );
    expect(res.status).toBe(410);
    const body = (await res.json()) as { ok: boolean; errors: string[] };
    expect(body.ok).toBe(false);
    expect(body.errors[0]).toContain('no longer sold');

    // The request is untouched, no entitlement appeared, no email.
    expect((await findUnlockRequest(seeded.request_id))?.status).toBe('requested');
    expect(await isGrimoireEntitled(EMAIL)).toBe(false);
    expect((await status(EMAIL)).state).toBe('pending');
    await flush();
    expect(jobs.filter((j) => j.template === 'grimoire_unlock_active')).toHaveLength(0);
  });

  it('grant by bare email is refused too', async () => {
    const res = await adminPost(
      post(
        '/api/admin/grimoire/unlock',
        { action: 'grant', email: 'walkin@example.com', reference: 'venmo-note-123' },
        SECRET,
      ),
    );
    expect(res.status).toBe(410);
    expect(await isGrimoireEntitled('walkin@example.com')).toBe(false);
  });

  it('refuses without the secret (401) and fails closed unconfigured (404)', async () => {
    expect(
      (await adminPost(post('/api/admin/grimoire/unlock', { action: 'grant', email: EMAIL })))
        .status,
    ).toBe(401);
    expect(
      (
        await adminPost(
          post('/api/admin/grimoire/unlock', { action: 'revoke', email: EMAIL }, 'wrong'),
        )
      ).status,
    ).toBe(401);

    delete process.env.OWNER_ADMIN_SECRET;
    const res = await adminPost(
      post('/api/admin/grimoire/unlock', { action: 'revoke', email: EMAIL }, SECRET),
    );
    expect(res.status).toBe(404);
  });
});

describe('legacy records still resolve; revoke still works; subscribers unchanged', () => {
  it('a preserved PERMANENT_UNLOCK record entitles, status reports it, admin revoke closes it', async () => {
    // A legacy record written straight to the preserved ledger —
    // the same write the owner's own access resolves through. (A
    // dedicated email: the status route reports a pending request
    // ahead of a revoked record, and the grant-closure test above
    // seeded one for EMAIL in this shared temp ledger.)
    const LEGACY = 'legacy@example.com';
    await grantUnlock({
      email: LEGACY,
      transaction_ref: 'legacy-record-1',
      source: 'owner_manual',
    });
    const resolved = await resolveGrimoireEntitlement(LEGACY);
    expect(resolved.entitled).toBe(true);
    expect(resolved.has_permanent_unlock).toBe(true);
    expect((await status(LEGACY)).state).toBe('active');

    const revoked = await adminPost(
      post(
        '/api/admin/grimoire/unlock',
        { action: 'revoke', email: LEGACY, reason: 'refund' },
        SECRET,
      ),
    );
    expect(revoked.status).toBe(200);
    expect(await isGrimoireEntitled(LEGACY)).toBe(false);
    expect((await status(LEGACY)).state).toBe('revoked');
  });

  it('an Active subscription record still entitles exactly as before', async () => {
    writeFileSync(
      SUBSCRIPTIONS,
      JSON.stringify({
        subscription_id: 'SUB-TEST-0001',
        created_at: '2026-10-21T00:00:00.000Z',
        computed_by: 'server',
        plan_id: 'living-grimoire-monthly',
        plan_name: 'Living Grimoire',
        price_cents: 777,
        interval: 'month',
        status: 'active',
        customer: { name: 'Test Member', email: 'member@example.com' },
        confirmed_at: '2026-10-21T01:00:00.000Z',
        confirmed_by: 'owner',
        recurring_mechanic: 'NEEDS_VERIFICATION',
        ledger_version: 1,
      }) + '\n',
      'utf8',
    );
    const resolved = await resolveGrimoireEntitlement('member@example.com');
    expect(resolved.entitled).toBe(true);
    expect(resolved.is_subscriber).toBe(true);
    expect(resolved.has_permanent_unlock).toBe(false);
  });
});
