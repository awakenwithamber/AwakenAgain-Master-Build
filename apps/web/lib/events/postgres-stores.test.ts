/**
 * Postgres store equivalence — Phase 3 Step 1 (store binding).
 *
 * The SAME assertions the JSONL suites make, run against the Postgres
 * implementations with DATABASE_URL pointed at a scratch database:
 * latest-line-wins, fail-closed entitlement, newest-first queues,
 * consent-gated audience. If the two drivers ever disagree, this file
 * fails — that is the proof the binding preserved semantics.
 *
 * Gated on AWAKEN_PG_TEST_URL (a scratch database the run may TRUNCATE):
 *   AWAKEN_PG_TEST_URL=postgres://… npx vitest run lib/events
 * Without it the whole file skips, so the default suite stays green on
 * machines with no Postgres.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import {
  appendEvent,
  closeAllEventPools,
  readStreamEvents,
  EVENT_STREAMS,
} from './event-store';
import {
  appendSubscriptionRecord,
  findLatestSubscriptionRecordAsync,
  isEntitledSubscriberAsync,
  readSubscriptionLedgerAsync,
} from '../subscriptions/entitlement';
import { listSubscriptionMembersAsync } from '../subscriptions/members';
import type {
  SubscriptionRecord,
  SubscriptionStatus,
} from '../subscriptions/subscriptions';
import { createOrderStore } from '../orders/store';
import { defaultOrderStore, PgOrderStore } from '../stores/order-store';
import type { OrderRecord } from '../checkout/order';
import { createContactStore, type ContactRecord } from '../contact/contact';
import {
  appendTrackingEvent,
  buildTrackingEvent,
  findLatestTrackingAsync,
  readTrackingEventsAsync,
} from '../orders/tracking';
import {
  appendPaymentEvent,
  buildPaymentEvent,
  findLatestPaymentAsync,
  readPaymentEventsAsync,
} from '../orders/payments';
import {
  appendBroadcastDraftRecord,
  buildBroadcastDraft,
  computeBroadcastAudienceAsync,
  readBroadcastDraftsAsync,
} from '../broadcast/broadcast';
import { leadStore } from '../leads/lead-store';
import { reviewStore } from '../reviews/reviews';

const PG_URL = process.env.AWAKEN_PG_TEST_URL;
const describePg = PG_URL ? describe : describe.skip;

let admin: Pool;
let previousDatabaseUrl: string | undefined;

beforeAll(async () => {
  if (!PG_URL) return;
  previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = PG_URL;
  admin = new Pool({ connectionString: PG_URL });
  const schema = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      'db',
      'migrations',
      '001_events.sql',
    ),
    'utf8',
  );
  await admin.query(schema);
});

beforeEach(async () => {
  if (!PG_URL) return;
  await admin.query('TRUNCATE events, migration_markers');
});

afterAll(async () => {
  if (!PG_URL) return;
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
  await closeAllEventPools();
  await admin.end();
});

/* ------------------------------------------------------------------ */
/* Fixtures (the JSONL suites' shapes)                                 */
/* ------------------------------------------------------------------ */

function subscriptionRecord(
  email: string,
  status: SubscriptionStatus,
  extra: Record<string, unknown> = {},
): SubscriptionRecord {
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
    ...extra,
  } as SubscriptionRecord;
}

function orderRecord(id: string, createdAt: string, total: number): OrderRecord {
  return {
    order_id: id,
    created_at: createdAt,
    computed_by: 'server',
    ledger_version: 1,
    customer: { name: 'Test', email: 'test@example.com' },
    items: [],
    bundle: null,
    subtotal_cents: total,
    subscriber_discount_cents: 0,
    shipping_cents: 0,
    shipping_status: 'FREE',
    free_shipping_threshold_cents: 4500,
    total_cents: total,
    is_subscriber_asserted: false,
    is_subscriber_verified: false,
    payment_method: 'cash_app_or_venmo',
  };
}

/* ------------------------------------------------------------------ */
/* Subscriptions / entitlement — mirrors entitlement.test.ts           */
/* ------------------------------------------------------------------ */

describePg('pg subscriptions + entitlement (equivalence)', () => {
  it('grants for an active record; denies pending and cancelled', async () => {
    await appendSubscriptionRecord(subscriptionRecord('a@example.com', 'active'));
    expect(await isEntitledSubscriberAsync('a@example.com')).toBe(true);

    await appendSubscriptionRecord(subscriptionRecord('b@example.com', 'pending_payment'));
    expect(await isEntitledSubscriberAsync('b@example.com')).toBe(false);

    await appendSubscriptionRecord(subscriptionRecord('c@example.com', 'cancelled'));
    expect(await isEntitledSubscriberAsync('c@example.com')).toBe(false);
  });

  it('the latest record for an email wins (append-only)', async () => {
    await appendSubscriptionRecord(subscriptionRecord('a@example.com', 'pending_payment'));
    await appendSubscriptionRecord(subscriptionRecord('a@example.com', 'active'));
    expect(await isEntitledSubscriberAsync('a@example.com')).toBe(true);

    await appendSubscriptionRecord(subscriptionRecord('a@example.com', 'cancelled'));
    expect(await isEntitledSubscriberAsync('a@example.com')).toBe(false);
  });

  it('matches case-insensitively and trims, on both sides', async () => {
    await appendSubscriptionRecord(subscriptionRecord('Member@Example.com', 'active'));
    expect(await isEntitledSubscriberAsync('member@example.com')).toBe(true);
    expect(await isEntitledSubscriberAsync('  MEMBER@EXAMPLE.COM ')).toBe(true);
    expect(await isEntitledSubscriberAsync('other@example.com')).toBe(false);
  });

  it('fails closed: no state, empty email, undefined email', async () => {
    expect(await isEntitledSubscriberAsync('ghost@example.com')).toBe(false);
    expect(await isEntitledSubscriberAsync('')).toBe(false);
    expect(await isEntitledSubscriberAsync(undefined)).toBe(false);
    expect(await findLatestSubscriptionRecordAsync('ghost@example.com')).toBeUndefined();
  });

  it('findLatest returns the newest full record; ledger reads in append order', async () => {
    await appendSubscriptionRecord(subscriptionRecord('a@example.com', 'pending_payment'));
    const confirmed = subscriptionRecord('a@example.com', 'active');
    await appendSubscriptionRecord(confirmed);
    const latest = await findLatestSubscriptionRecordAsync('a@example.com');
    expect(latest?.status).toBe('active');
    expect(latest?.confirmed_at).toBe('2026-10-13T01:00:00.000Z');

    const entries = await readSubscriptionLedgerAsync();
    expect(entries.map((e) => e.status)).toEqual(['pending_payment', 'active']);
  });
});

/* ------------------------------------------------------------------ */
/* Members — mirrors members.test.ts                                   */
/* ------------------------------------------------------------------ */

describePg('pg subscription members (equivalence)', () => {
  it('resolves latest line per email and sorts for triage', async () => {
    await appendSubscriptionRecord(subscriptionRecord('zoe@example.com', 'pending_payment'));
    await appendSubscriptionRecord(subscriptionRecord('amy@example.com', 'active'));
    await appendSubscriptionRecord(subscriptionRecord('kim@example.com', 'pending_payment'));
    await appendSubscriptionRecord(subscriptionRecord('kim@example.com', 'active'));
    await appendSubscriptionRecord(subscriptionRecord('max@example.com', 'active'));
    await appendSubscriptionRecord(
      subscriptionRecord('max@example.com', 'cancelled', {
        cancelled_at: '2026-10-14T09:30:00.000Z',
        cancelled_by: 'owner',
      }),
    );

    const members = await listSubscriptionMembersAsync();
    expect(members.map((m) => m.email)).toEqual([
      'zoe@example.com',
      'amy@example.com',
      'kim@example.com',
      'max@example.com',
    ]);
    const kim = members.find((m) => m.email === 'kim@example.com');
    expect(kim?.status).toBe('active');
    expect(kim?.confirmed_at).toBe('2026-10-13T01:00:00.000Z');
    const max = members.find((m) => m.email === 'max@example.com');
    expect(max?.status).toBe('cancelled');
    expect(max?.cancelled_at).toBe('2026-10-14T09:30:00.000Z');
    const zoe = members.find((m) => m.email === 'zoe@example.com');
    expect(zoe?.price_cents).toBe(777);
    expect(zoe?.plan_name).toBe('Living Grimoire');
  });

  it('normalizes mixed-case emails to one member row', async () => {
    await appendSubscriptionRecord(subscriptionRecord('Member@Example.com', 'pending_payment'));
    await appendSubscriptionRecord(subscriptionRecord('member@example.com', 'active'));
    const members = await listSubscriptionMembersAsync();
    expect(members).toHaveLength(1);
    expect(members[0].email).toBe('member@example.com');
    expect(members[0].status).toBe('active');
  });

  it('no events → no members', async () => {
    expect(await listSubscriptionMembersAsync()).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Orders — RecordStore + admin OrderStore                             */
/* ------------------------------------------------------------------ */

describePg('pg order stores (equivalence)', () => {
  it('RecordStore round-trips: receipt proves the postgres backend', async () => {
    const store = createOrderStore();
    const record = orderRecord('AWK-20261015-AAAAAA', '2026-10-15T10:00:00.000Z', 3577);
    const receipt = await store.append(record);
    expect(receipt.backend).toBe('postgres');
    expect(receipt.id).toBe('AWK-20261015-AAAAAA');
    expect(await store.get('AWK-20261015-AAAAAA')).toEqual(record);
    expect(await store.get('AWK-00000000-NOPE')).toBeNull();
  });

  it('reviewQueue is newest-append-first with the review projection', async () => {
    const store = createOrderStore();
    await store.append(orderRecord('AWK-20261015-AAAAAA', '2026-10-15T10:00:00.000Z', 100));
    await store.append(orderRecord('AWK-20261015-BBBBBB', '2026-10-15T09:00:00.000Z', 200));
    const queue = await store.reviewQueue();
    // Append order reversed — NOT created_at order (mirrors JSONL readAll).
    expect(queue.map((q) => q.order_id)).toEqual([
      'AWK-20261015-BBBBBB',
      'AWK-20261015-AAAAAA',
    ]);
    expect(queue[0].review_status).toBe('pending_review');
    expect(queue[0].customer_email).toBe('test@example.com');
    expect((await store.reviewQueue({ limit: 1 })).length).toBe(1);
  });

  it('admin OrderStore lists newest created_at first and reports bad payloads', async () => {
    const store = createOrderStore();
    await store.append(orderRecord('AWK-20261004-AAAAAA', '2026-10-04T10:00:00.000Z', 3577));
    await store.append(orderRecord('AWK-20261005-BBBBBB', '2026-10-05T10:00:00.000Z', 1977));
    await appendEvent(EVENT_STREAMS.orders, 'bogus', 'order.recorded', {
      nope: 'not an order record',
    });

    const admin = defaultOrderStore();
    expect(admin).toBeInstanceOf(PgOrderStore);
    const orders = await admin.listOrders();
    expect(orders.map((o) => o.order_id)).toEqual([
      'AWK-20261005-BBBBBB',
      'AWK-20261004-AAAAAA',
    ]);
    const issues = (admin as PgOrderStore).getParseIssues();
    expect(issues.length).toBe(1);
    expect(issues[0].error.length).toBeGreaterThan(0);
    expect((await admin.listOrders({ limit: 1 }))[0].order_id).toBe(
      'AWK-20261005-BBBBBB',
    );
  });
});

/* ------------------------------------------------------------------ */
/* Contact — RecordStore over the contact_messages stream              */
/* ------------------------------------------------------------------ */

describePg('pg contact store (equivalence)', () => {
  it('appends, reads back, and projects the review summary', async () => {
    const store = createContactStore();
    const record: ContactRecord = {
      message_id: 'MSG-20261015-AAAAAA',
      created_at: '2026-10-15T10:00:00.000Z',
      record_version: 1,
      name: 'Test Person',
      email: 'person@example.com',
      topic: 'order-question',
      topic_label: 'A question about my order',
      message: 'x'.repeat(200),
      relay: { form_type: 'contact', status: 'queued' },
    };
    const receipt = await store.append(record);
    expect(receipt.backend).toBe('postgres');
    expect(await store.get('MSG-20261015-AAAAAA')).toEqual(record);
    const queue = await store.reviewQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].message_preview).toBe('x'.repeat(160));
    expect(queue[0].relay_status).toBe('queued');
  });
});

/* ------------------------------------------------------------------ */
/* Tracking — mirrors tracking.test.ts semantics                       */
/* ------------------------------------------------------------------ */

describePg('pg order tracking (equivalence)', () => {
  it('latest event per order wins; append order preserved', async () => {
    const first = buildTrackingEvent({
      order_id: 'AWK-20261015-AAAAAA',
      carrier: 'usps',
      tracking_number: '9400111111111111111111',
    });
    const corrected = buildTrackingEvent({
      order_id: 'AWK-20261015-AAAAAA',
      carrier: 'ups',
      tracking_number: '1Z999AA10123456784',
    });
    const other = buildTrackingEvent({
      order_id: 'AWK-20261015-BBBBBB',
      carrier: 'usps',
      tracking_number: '9400222222222222222222',
    });
    await appendTrackingEvent(first);
    await appendTrackingEvent(corrected);
    await appendTrackingEvent(other);

    const events = await readTrackingEventsAsync();
    expect(events.map((e) => e.event_id)).toEqual([
      first.event_id,
      corrected.event_id,
      other.event_id,
    ]);
    const latest = await findLatestTrackingAsync('AWK-20261015-AAAAAA');
    expect(latest?.tracking_number).toBe('1Z999AA10123456784');
    expect(latest?.carrier).toBe('ups');
    expect(await findLatestTrackingAsync('AWK-00000000-NOPE')).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Payments — mirrors payments.test.ts semantics (audit GAP-1)        */
/* ------------------------------------------------------------------ */

describePg('pg order payments (equivalence)', () => {
  it('latest event per order wins; append order preserved', async () => {
    const first = buildPaymentEvent({
      order_id: 'AWK-20261015-PAY001',
      method: 'cash_app_or_venmo',
      reference: null,
      note: null,
    });
    const corrected = buildPaymentEvent({
      order_id: 'AWK-20261015-PAY001',
      method: 'bookipi_card_invoice',
      reference: 'INV-1042',
      note: null,
    });
    const other = buildPaymentEvent({
      order_id: 'AWK-20261015-PAY002',
      method: 'cash_app_or_venmo',
      reference: '$cashtag receipt',
      note: null,
    });
    await appendPaymentEvent(first);
    await appendPaymentEvent(corrected);
    await appendPaymentEvent(other);

    const events = await readPaymentEventsAsync();
    expect(events.map((e) => e.event_id)).toEqual([
      first.event_id,
      corrected.event_id,
      other.event_id,
    ]);
    const latest = await findLatestPaymentAsync('AWK-20261015-PAY001');
    expect(latest?.method).toBe('bookipi_card_invoice');
    expect(latest?.reference).toBe('INV-1042');
    expect(await findLatestPaymentAsync('AWK-00000000-NOPE')).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Broadcasts + audience                                               */
/* ------------------------------------------------------------------ */

describePg('pg broadcasts + audience (equivalence)', () => {
  it('drafts read newest-first; delivery status stays recorded_not_sent', async () => {
    const audience = {
      newsletter_recipients: 0,
      active_subscribers: 0,
      total_recipients: 0,
    };
    const one = buildBroadcastDraft({ subject: 'One', body: 'First', audience });
    const two = buildBroadcastDraft({ subject: 'Two', body: 'Second', audience });
    await appendBroadcastDraftRecord(one);
    await appendBroadcastDraftRecord(two);
    const drafts = await readBroadcastDraftsAsync();
    expect(drafts.map((d) => d.broadcast_id)).toEqual([
      two.broadcast_id,
      one.broadcast_id,
    ]);
    expect(drafts[0].delivery_status).toBe('recorded_not_sent');
  });

  it('audience = consented newsletter leads ∪ active subscribers, deduped', async () => {
    await leadStore.append({
      kind: 'newsletter',
      email: 'News@Example.com',
      name: null,
      consent: true,
      consentAt: '2026-10-15T00:00:00.000Z',
      metadata: {},
    });
    await leadStore.append({
      kind: 'newsletter',
      email: 'news@example.com', // same person, second capture
      name: null,
      consent: true,
      consentAt: '2026-10-15T00:00:00.000Z',
      metadata: {},
    });
    await leadStore.append({
      kind: 'quiz_lead', // not a newsletter signup — never in the audience
      email: 'quiz@example.com',
      name: null,
      consent: true,
      consentAt: '2026-10-15T00:00:00.000Z',
      metadata: {},
    });
    await appendSubscriptionRecord(subscriptionRecord('news@example.com', 'active'));
    await appendSubscriptionRecord(subscriptionRecord('member@example.com', 'active'));
    await appendSubscriptionRecord(subscriptionRecord('pending@example.com', 'pending_payment'));

    const audience = await computeBroadcastAudienceAsync();
    expect(audience.newsletter_recipients).toBe(1);
    expect(audience.active_subscribers).toBe(2);
    expect(audience.total_recipients).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/* Leads + reviews dispatchers                                         */
/* ------------------------------------------------------------------ */

describePg('pg leads + reviews (equivalence)', () => {
  it('leadStore append returns the full record and stores one event', async () => {
    const record = await leadStore.append({
      kind: 'quiz_lead',
      email: 'lead@example.com',
      name: 'Lead',
      consent: true,
      consentAt: '2026-10-15T00:00:00.000Z',
      metadata: { quiz_result: 'rose' },
    });
    expect(record.id).toBeTruthy();
    expect(record.source).toBe('nextjs');
    expect(record.capturedAt).toBeTruthy();
    const events = await readStreamEvents(EVENT_STREAMS.leads);
    expect(events).toHaveLength(1);
    expect(events[0].stream_key).toBe('lead@example.com');
    expect(events[0].event_type).toBe('lead.quiz_lead');
  });

  it('reviews submit as pending; a later event for the id supersedes', async () => {
    const submitted = await reviewStore.submit({
      productHandle: 'gaias-rose-soap',
      rating: 5,
      name: 'Tester',
      title: null,
      body: 'Lovely soap, would buy again.',
    });
    expect(submitted.status).toBe('pending');
    expect(await reviewStore.listApproved('gaias-rose-soap')).toEqual([]);
    const queue = await reviewStore.listQueue();
    expect(queue.map((r) => r.id)).toEqual([submitted.id]);

    // A moderation decision is a NEW event for the same review id —
    // history is never edited; the latest state wins.
    await appendEvent(
      EVENT_STREAMS.reviews,
      submitted.id,
      'review.recorded',
      { ...submitted, status: 'approved' },
      submitted.createdAt,
    );
    const approved = await reviewStore.listApproved('gaias-rose-soap');
    expect(approved.map((r) => r.id)).toEqual([submitted.id]);
  });
});

/* ------------------------------------------------------------------ */
/* Append-only enforcement                                             */
/* ------------------------------------------------------------------ */

describePg('pg events table is append-only', () => {
  it('UPDATE and DELETE are refused by the database', async () => {
    await appendEvent(EVENT_STREAMS.orders, 'k1', 'order.recorded', { a: 1 });
    await expect(
      admin.query("UPDATE events SET event_type = 'x'"),
    ).rejects.toThrow(/append-only/);
    await expect(admin.query('DELETE FROM events')).rejects.toThrow(
      /append-only/,
    );
    const { rows } = await admin.query('SELECT count(*)::int AS n FROM events');
    expect(rows[0].n).toBe(1);
  });
});
