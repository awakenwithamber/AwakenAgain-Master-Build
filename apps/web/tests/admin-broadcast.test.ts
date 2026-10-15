/**
 * Owner broadcast record — POST /api/admin/broadcast (Phase 2).
 *
 * Laws under test:
 * - The route FAILS CLOSED like every owner-secret route: secret unset →
 *   404 + nothing recorded; wrong/absent secret → 401 + nothing recorded.
 * - A valid POST appends ONE draft with delivery_status
 *   'recorded_not_sent' — there is no path by which a broadcast can be
 *   recorded as sent, because no email provider exists in this app.
 * - The audience snapshot is REAL: consented newsletter signups (lead
 *   store) + subscribers whose LATEST status is 'active', deduplicated
 *   across both lists. Quiz leads never join the broadcast audience.
 * - Malformed bodies are 422 and record nothing.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '../app/api/admin/broadcast/route';
import {
  computeBroadcastAudience,
  readBroadcastDrafts,
} from '../lib/broadcast/broadcast';

const DIR = mkdtempSync(join(tmpdir(), 'admin-broadcast-'));
const SUBS_LEDGER = join(DIR, 'subscriptions.jsonl');
const BCAST_LEDGER = join(DIR, 'broadcasts.jsonl');
const LEADS_DIR = join(DIR, 'leads');
process.env.SUBSCRIPTIONS_LEDGER_PATH = SUBS_LEDGER;
process.env.BROADCAST_LEDGER_PATH = BCAST_LEDGER;
process.env.LEAD_STORE_DIR = LEADS_DIR;

const SECRET = 'test-owner-secret-not-a-real-one';
const ORIGINAL_SECRET = process.env.OWNER_ADMIN_SECRET;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.OWNER_ADMIN_SECRET;
  else process.env.OWNER_ADMIN_SECRET = ORIGINAL_SECRET;
});

function lead(email: string, consent: boolean, kind = 'newsletter') {
  return {
    id: `lead-${email}-${kind}`,
    kind,
    email,
    name: null,
    consent,
    consentAt: '2026-10-13T00:00:00.000Z',
    metadata: {},
    capturedAt: '2026-10-13T00:00:00.000Z',
    source: 'nextjs',
  };
}

function subRecord(email: string, status: string) {
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

/**
 * Audience fixture — expected math:
 * - newsletter (consented, unique): anna@, ben@ → 2 (anna twice counts once;
 *   cara@ has consent:false and never counts)
 * - active subscribers (latest line): ben@, elsa@ → 2 (finn@ latest is
 *   cancelled; elsa@ activated on her second line)
 * - union deduped: anna@, ben@, elsa@ → 3 (ben@ is in both lists)
 * - quiz leads (gus@) are a different store file and never count.
 */
function seedStores(): void {
  mkdirSync(LEADS_DIR, { recursive: true });
  writeFileSync(
    join(LEADS_DIR, 'newsletter.jsonl'),
    [
      lead('anna@example.com', true),
      lead('ben@example.com', true),
      lead('anna@example.com', true),
      lead('cara@example.com', false),
    ]
      .map((l) => JSON.stringify(l))
      .join('\n') + '\n',
    'utf8',
  );
  writeFileSync(
    join(LEADS_DIR, 'quiz_lead.jsonl'),
    `${JSON.stringify(lead('gus@example.com', true, 'quiz_lead'))}\n`,
    'utf8',
  );
  writeFileSync(
    SUBS_LEDGER,
    [
      subRecord('ben@example.com', 'active'),
      subRecord('elsa@example.com', 'pending_payment'),
      subRecord('elsa@example.com', 'active'),
      subRecord('finn@example.com', 'active'),
      subRecord('finn@example.com', 'cancelled'),
    ]
      .map((l) => JSON.stringify(l))
      .join('\n') + '\n',
    'utf8',
  );
  writeFileSync(BCAST_LEDGER, '', 'utf8');
}

function broadcastContent(): string {
  return readFileSync(BCAST_LEDGER, 'utf8');
}

async function postBroadcast(
  body: unknown,
  options: { secret?: string; rawBody?: string } = {},
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.secret !== undefined) headers['x-owner-secret'] = options.secret;
  const res = await POST(
    new Request('http://localhost/api/admin/broadcast', {
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

describe('computeBroadcastAudience', () => {
  it('counts real stores, deduped, latest-status aware', () => {
    seedStores();
    expect(computeBroadcastAudience()).toEqual({
      newsletter_recipients: 2,
      active_subscribers: 2,
      total_recipients: 3,
    });
  });

  it('missing stores → an honest zero audience', () => {
    const empty = join(DIR, 'empty');
    expect(
      computeBroadcastAudience({
        newsletterFile: join(empty, 'newsletter.jsonl'),
        subscriptionsLedger: join(empty, 'subscriptions.jsonl'),
      }),
    ).toEqual({
      newsletter_recipients: 0,
      active_subscribers: 0,
      total_recipients: 0,
    });
  });
});

describe('POST /api/admin/broadcast', () => {
  it('fails closed when OWNER_ADMIN_SECRET is unset: 404, nothing recorded', async () => {
    delete process.env.OWNER_ADMIN_SECRET;
    seedStores();

    const res = await postBroadcast(
      { subject: 'News', body: 'Hello circle.' },
      { secret: SECRET },
    );
    expect(res.status).toBe(404);
    expect(broadcastContent()).toBe('');
  });

  it('rejects a wrong or absent secret: 401, nothing recorded', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    seedStores();

    const wrong = await postBroadcast(
      { subject: 'News', body: 'Hello circle.' },
      { secret: 'not-the-secret' },
    );
    expect(wrong.status).toBe(401);

    const absent = await postBroadcast({ subject: 'News', body: 'Hello.' });
    expect(absent.status).toBe(401);

    expect(broadcastContent()).toBe('');
  });

  it('records a draft: 201 recorded_not_sent with the true audience snapshot', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    seedStores();

    const res = await postBroadcast(
      { subject: 'October apothecary news', body: 'Hello circle — new soaps.' },
      { secret: SECRET },
    );
    expect(res.status).toBe(201);
    expect(res.json.ok).toBe(true);
    expect(res.json.delivery_status).toBe('recorded_not_sent');
    expect(res.json.audience).toEqual({
      newsletter_recipients: 2,
      active_subscribers: 2,
      total_recipients: 3,
    });

    const drafts = readBroadcastDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].subject).toBe('October apothecary news');
    expect(drafts[0].delivery_status).toBe('recorded_not_sent');
    expect(drafts[0].delivery_note).toContain('nothing was sent');
    expect(drafts[0].created_by).toBe('owner');
    // The word "sent" appears in the ledger ONLY inside the not-sent truth.
    expect(broadcastContent()).not.toMatch(/"delivery_status":\s*"sent"/);
  });

  it('malformed bodies are 422 and record nothing', async () => {
    process.env.OWNER_ADMIN_SECRET = SECRET;
    seedStores();

    const notJson = await postBroadcast(null, {
      secret: SECRET,
      rawBody: 'this is not json',
    });
    expect(notJson.status).toBe(422);

    const noSubject = await postBroadcast(
      { body: 'Hello circle.' },
      { secret: SECRET },
    );
    expect(noSubject.status).toBe(422);

    const noBody = await postBroadcast(
      { subject: 'News' },
      { secret: SECRET },
    );
    expect(noBody.status).toBe(422);

    const htmlOnly = await postBroadcast(
      { subject: '<br>', body: 'Hello.' },
      { secret: SECRET },
    );
    expect(htmlOnly.status).toBe(422); // subject sanitizes to empty

    expect(broadcastContent()).toBe('');
  });
});
