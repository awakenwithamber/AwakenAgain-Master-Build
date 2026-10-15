/**
 * Owner subscription cancellation — POST /api/admin/subscriptions/cancel.
 *
 * Laws under test (mirroring the confirmation endpoint's contract):
 * - The route FAILS CLOSED: with OWNER_ADMIN_SECRET unset it answers 404
 *   and changes nothing; with a wrong/absent secret it answers 401 and
 *   changes nothing.
 * - With the correct secret, an active (or pending) member becomes
 *   'cancelled' via an APPENDED ledger line stamped cancelled_at /
 *   cancelled_by — history is preserved, and the REAL entitlement lookup
 *   stops verifying that email immediately.
 * - An unknown email creates nothing (404, ledger byte-identical).
 * - Cancelling an already-cancelled member is a 200 no-op (idempotent).
 * - Malformed bodies are 422 in the codebase's { ok:false, errors } shape.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '../app/api/admin/subscriptions/cancel/route';
import { isEntitledSubscriber } from '../lib/subscriptions/entitlement';
import { listSubscriptionMembers } from '../lib/subscriptions/members';

const DIR = mkdtempSync(join(tmpdir(), 'admin-sub-cancel-'));
const SUBS_LEDGER = join(DIR, 'subscriptions.jsonl');
process.env.SUBSCRIPTIONS_LEDGER_PATH = SUBS_LEDGER;

const SECRET = 'test-owner-secret-not-a-real-one';
const ORIGINAL_SECRET = process.env.OWNER_ADMIN_SECRET;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.OWNER_ADMIN_SECRET;
  else process.env.OWNER_ADMIN_SECRET = ORIGINAL_SECRET;
});

function record(email: string, status: string) {
  return {
    subscription_id: 'SUB-TEST-0001',
    created_at: '2026-10-13T00:00:00.000Z',
    computed_by: 'server',
    plan_id: 'living-grimoire-monthly',
    plan_name: 'Living Grimoire',
    price_cents: 777,
    interval: 'month',
    status,
    customer: { name: 'Test Member', email },
    confirmed_at: status === 'active' ? '2026-10-13T01:00:00.000Z' : null,
    confirmed_by: status === 'active' ? 'owner' : null,
    recurring_mechanic: 'NEEDS_VERIFICATION',
    ledger_version: 1,
  };
}

function setSubscriptions(lines: unknown[]): string {
  const content = lines.length
    ? lines
        .map((l) => (typeof l === 'string' ? l : JSON.stringify(l)))
        .join('\n') + '\n'
    : '';
  writeFileSync(SUBS_LEDGER, content, 'utf8');
  return content;
}

function ledgerContent(): string {
  return readFileSync(SUBS_LEDGER, 'utf8');
}

async function postCancel(
  body: unknown,
  options: { secret?: string; rawBody?: string } = {},
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.secret !== undefined) headers['x-owner-secret'] = options.secret;
  const res = await POST(
    new Request('http://localhost/api/admin/subscriptions/cancel', {
      method: 'POST',
      headers,
      body: options.rawBody ?? JSON.stringify(body),
    }),
  );
  return {
    status: res.status,
    json: (await res.json()) as Record<string, unknown>,
  };
}

describe('POST /api/admin/subscriptions/cancel', () => {
  it('fails closed when OWNER_ADMIN_SECRET is unset: 404, ledger unchanged', async () => {
    delete process.env.OWNER_ADMIN_SECRET;
    const before = setSubscriptions([record('member@example.com', 'active')]);

    const res = await postCancel(
      { email: 'member@example.com' },
      { secret: SECRET },
    );
    expect(res.status).toBe(404);
    expect(ledgerContent()).toBe(before);
    expect(isEntitledSubscriber('member@example.com')).toBe(true);
  });

  it('rejects a wrong or absent secret: 401, ledger unchanged', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    const before = setSubscriptions([record('member@example.com', 'active')]);

    const wrong = await postCancel(
      { email: 'member@example.com' },
      { secret: 'not-the-secret' },
    );
    expect(wrong.status).toBe(401);

    const absent = await postCancel({ email: 'member@example.com' });
    expect(absent.status).toBe(401);

    expect(ledgerContent()).toBe(before);
    expect(isEntitledSubscriber('member@example.com')).toBe(true);
  });

  it('cancels an active member: appended stamped line, entitlement ends at once', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    setSubscriptions([record('member@example.com', 'active')]);
    expect(isEntitledSubscriber('member@example.com')).toBe(true);

    const res = await postCancel(
      { email: '  Member@Example.com ' },
      { secret: SECRET },
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      ok: true,
      email: 'member@example.com',
      status: 'cancelled',
    });

    // History preserved: original line plus the appended cancellation.
    const lines = ledgerContent().trim().split('\n');
    expect(lines).toHaveLength(2);
    const appended = JSON.parse(lines[1]) as Record<string, unknown>;
    expect(appended.status).toBe('cancelled');
    expect(appended.subscription_id).toBe('SUB-TEST-0001');
    expect(appended.cancelled_by).toBe('owner');
    expect(typeof appended.cancelled_at).toBe('string');

    // End-to-end: entitlement no longer verifies; the member list shows
    // the cancellation with its stamp.
    expect(isEntitledSubscriber('member@example.com')).toBe(false);
    const members = listSubscriptionMembers();
    expect(members).toHaveLength(1);
    expect(members[0].status).toBe('cancelled');
    expect(members[0].cancelled_at).toBe(appended.cancelled_at);
  });

  it('cancels a pending_payment member too', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    setSubscriptions([record('waiting@example.com', 'pending_payment')]);

    const res = await postCancel(
      { email: 'waiting@example.com' },
      { secret: SECRET },
    );
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('cancelled');
    expect(listSubscriptionMembers()[0].status).toBe('cancelled');
  });

  it('already-cancelled member: 200 idempotent, no ledger write', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    const before = setSubscriptions([
      record('gone@example.com', 'active'),
      record('gone@example.com', 'cancelled'),
    ]);

    const res = await postCancel(
      { email: 'gone@example.com' },
      { secret: SECRET },
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      ok: true,
      email: 'gone@example.com',
      status: 'cancelled',
    });
    expect(ledgerContent()).toBe(before);
  });

  it('unknown email: 404 and no record is created', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    const before = setSubscriptions([record('someone@example.com', 'active')]);

    const res = await postCancel(
      { email: 'nobody@example.com' },
      { secret: SECRET },
    );
    expect(res.status).toBe(404);
    expect(res.json.ok).toBe(false);
    expect(ledgerContent()).toBe(before);
  });

  it('malformed bodies are 422 and change nothing', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    const before = setSubscriptions([record('member@example.com', 'active')]);

    const notJson = await postCancel(null, {
      secret: SECRET,
      rawBody: 'this is not json',
    });
    expect(notJson.status).toBe(422);

    const arrayBody = await postCancel(['member@example.com'], {
      secret: SECRET,
    });
    expect(arrayBody.status).toBe(422);

    const missingEmail = await postCancel({}, { secret: SECRET });
    expect(missingEmail.status).toBe(422);

    const badEmail = await postCancel(
      { email: 'not-an-email' },
      { secret: SECRET },
    );
    expect(badEmail.status).toBe(422);

    expect(ledgerContent()).toBe(before);
    expect(isEntitledSubscriber('member@example.com')).toBe(true);
  });
});
