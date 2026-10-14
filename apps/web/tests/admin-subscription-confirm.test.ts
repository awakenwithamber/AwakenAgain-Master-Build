/**
 * Owner subscription confirmation — POST /api/admin/subscriptions/confirm.
 *
 * Laws under test:
 * - The route FAILS CLOSED: with OWNER_ADMIN_SECRET unset it answers 404
 *   and changes nothing; with a wrong/absent secret it answers 401 and
 *   changes nothing.
 * - With the correct secret, a pending_payment member becomes 'active'
 *   (the append-only ledger gains the owner-confirmed record) and the
 *   REAL entitlement lookup then verifies that email end-to-end.
 * - A cancelled subscription is never resurrected (409, still cancelled).
 * - An unknown email creates nothing (404, ledger byte-identical).
 * - Confirming an already-active member is a 200 no-op (idempotent).
 * - Malformed bodies are 422 in the codebase's { ok:false, errors } shape.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '../app/api/admin/subscriptions/confirm/route';
import { isEntitledSubscriber } from '../lib/subscriptions/entitlement';

const DIR = mkdtempSync(join(tmpdir(), 'admin-sub-confirm-'));
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

async function postConfirm(
  body: unknown,
  options: { secret?: string; rawBody?: string } = {},
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.secret !== undefined) headers['x-owner-secret'] = options.secret;
  const res = await POST(
    new Request('http://localhost/api/admin/subscriptions/confirm', {
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

describe('POST /api/admin/subscriptions/confirm', () => {
  it('fails closed when OWNER_ADMIN_SECRET is unset: 404, ledger unchanged', async () => {
    delete process.env.OWNER_ADMIN_SECRET;
    const before = setSubscriptions([
      record('member@example.com', 'pending_payment'),
    ]);

    const res = await postConfirm(
      { email: 'member@example.com' },
      { secret: SECRET },
    );
    expect(res.status).toBe(404);
    expect(ledgerContent()).toBe(before);
    expect(isEntitledSubscriber('member@example.com')).toBe(false);
  });

  it('rejects a wrong or absent secret: 401, ledger unchanged', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    const before = setSubscriptions([
      record('member@example.com', 'pending_payment'),
    ]);

    const wrong = await postConfirm(
      { email: 'member@example.com' },
      { secret: 'not-the-secret' },
    );
    expect(wrong.status).toBe(401);
    expect(wrong.json.ok).toBe(false);

    const absent = await postConfirm({ email: 'member@example.com' });
    expect(absent.status).toBe(401);

    expect(ledgerContent()).toBe(before);
    expect(isEntitledSubscriber('member@example.com')).toBe(false);
  });

  it('confirms a pending member: 200 active, and entitlement now verifies end-to-end', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    // Stored record carries mixed case; the confirm call uses padded,
    // differently-cased input — matching is trim + lowercase on both sides.
    setSubscriptions([record('Member@Example.com', 'pending_payment')]);
    expect(isEntitledSubscriber('member@example.com')).toBe(false);

    const res = await postConfirm(
      { email: '  member@example.com ' },
      { secret: SECRET },
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      ok: true,
      email: 'member@example.com',
      status: 'active',
    });

    // The confirmed record was appended (latest line wins), owner-stamped.
    const lines = ledgerContent().trim().split('\n');
    expect(lines).toHaveLength(2);
    const appended = JSON.parse(lines[1]) as Record<string, unknown>;
    expect(appended.status).toBe('active');
    expect(appended.confirmed_by).toBe('owner');
    expect(appended.confirmed_at).not.toBeNull();
    expect(appended.subscription_id).toBe('SUB-TEST-0001');

    // End-to-end: the real entitlement lookup now verifies this email.
    expect(isEntitledSubscriber('member@example.com')).toBe(true);
    expect(isEntitledSubscriber('MEMBER@EXAMPLE.COM')).toBe(true);
  });

  it('never resurrects a cancelled subscription: 409, still cancelled', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    const before = setSubscriptions([
      record('gone@example.com', 'pending_payment'),
      record('gone@example.com', 'cancelled'),
    ]);

    const res = await postConfirm(
      { email: 'gone@example.com' },
      { secret: SECRET },
    );
    expect(res.status).toBe(409);
    expect(res.json.ok).toBe(false);
    expect(res.json.status).toBe('cancelled');
    expect(ledgerContent()).toBe(before);
    expect(isEntitledSubscriber('gone@example.com')).toBe(false);
  });

  it('unknown email: 404 and no record is created', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    const before = setSubscriptions([
      record('someone@example.com', 'pending_payment'),
    ]);

    const res = await postConfirm(
      { email: 'nobody@example.com' },
      { secret: SECRET },
    );
    expect(res.status).toBe(404);
    expect(res.json.ok).toBe(false);
    expect(ledgerContent()).toBe(before);
    expect(isEntitledSubscriber('nobody@example.com')).toBe(false);
  });

  it('already-active member: 200 idempotent, no ledger write', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    const before = setSubscriptions([record('vip@example.com', 'active')]);

    const res = await postConfirm(
      { email: 'vip@example.com' },
      { secret: SECRET },
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      ok: true,
      email: 'vip@example.com',
      status: 'active',
    });
    expect(ledgerContent()).toBe(before);
    expect(isEntitledSubscriber('vip@example.com')).toBe(true);
  });

  it('malformed bodies are 422 and change nothing', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    const before = setSubscriptions([
      record('member@example.com', 'pending_payment'),
    ]);

    const notJson = await postConfirm(null, {
      secret: SECRET,
      rawBody: 'this is not json',
    });
    expect(notJson.status).toBe(422);
    expect(notJson.json.ok).toBe(false);
    expect(Array.isArray(notJson.json.errors)).toBe(true);

    const arrayBody = await postConfirm(['member@example.com'], {
      secret: SECRET,
    });
    expect(arrayBody.status).toBe(422);

    const missingEmail = await postConfirm({}, { secret: SECRET });
    expect(missingEmail.status).toBe(422);

    const badEmail = await postConfirm(
      { email: 'not-an-email' },
      { secret: SECRET },
    );
    expect(badEmail.status).toBe(422);

    expect(ledgerContent()).toBe(before);
    expect(isEntitledSubscriber('member@example.com')).toBe(false);
  });
});
