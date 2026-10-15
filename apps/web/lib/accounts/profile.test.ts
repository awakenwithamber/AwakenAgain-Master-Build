/**
 * Profile read model + export — Phase 3 Step 3 (JSONL driver).
 *
 * Locks in: quiz leads for the account email LINK into the profile
 * (with the same-sitting dedupe against profile saves), order history
 * is filtered to the account email with payment state composed like
 * the public order-status route, and the export is COMPLETE (profile +
 * every lead + every order) until deletion collapses it to the
 * tombstone.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteAccountAsync,
  ensureAccountAsync,
  saveQuizResultAsync,
  saveSearchAsync,
  setLikesAsync,
} from './accounts';
import {
  buildAccountExportAsync,
  composeQuizResults,
  getProfileViewAsync,
  listOrdersForEmailAsync,
} from './profile';
import { leadStore } from '../leads/lead-store';
import { foldAccountRecords } from './accounts';
import type { QuizResultSnapshot } from '../quiz/quiz';

const EMAIL = 'friend@example.com';
const OTHER = 'someone-else@example.com';
const ROSE = 'gaias-rose-soap';

const SNAPSHOT: QuizResultSnapshot = {
  concernId: 'sleep',
  concernLabel: 'Sleep & Rest',
  formId: 'capsules',
  formLabel: 'Capsules',
  allies: [
    {
      name: 'Valerian root',
      latin: 'Valeriana officinalis',
      evidence: 'traditional',
      note: 'Rest.',
    },
  ],
  productHandles: ['dreamease-capsules'],
  productReason: 'For sleep.',
};

const ENVS = [
  'ACCOUNTS_LEDGER_PATH',
  'LEAD_STORE_DIR',
  'ORDERS_LEDGER_PATH',
  'ORDER_PAYMENTS_LEDGER_PATH',
] as const;

let dir: string;
const saved: Record<string, string | undefined> = {};

function orderLine(
  orderId: string,
  email: string,
  total: number,
  createdAt = '2026-10-14T10:00:00.000Z',
): string {
  return JSON.stringify({
    order_id: orderId,
    created_at: createdAt,
    computed_by: 'server',
    ledger_version: 1,
    customer: { name: 'Friend', email },
    items: [
      {
        product_handle: ROSE,
        variant_id: 'rose-1',
        quantity: 2,
        unit_price_cents: total / 2,
        line_total_cents: total,
      },
    ],
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
    status: 'pending_payment',
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'aa-profile-'));
  for (const key of ENVS) saved[key] = process.env[key];
  process.env.ACCOUNTS_LEDGER_PATH = join(dir, 'accounts.jsonl');
  process.env.LEAD_STORE_DIR = join(dir, 'leads');
  process.env.ORDERS_LEDGER_PATH = join(dir, 'orders.jsonl');
  process.env.ORDER_PAYMENTS_LEDGER_PATH = join(dir, 'payments.jsonl');
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  for (const key of ENVS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('lead linking', () => {
  it('a quiz lead captured before the account existed appears in the profile', async () => {
    await leadStore.append({
      kind: 'quiz_lead',
      email: EMAIL,
      name: 'Fern',
      consent: true,
      consentAt: '2026-10-10T00:00:00.000Z',
      metadata: { concern_id: 'sleep', form_id: 'capsules' },
      quizResult: SNAPSHOT,
    });
    await ensureAccountAsync(EMAIL);
    const view = await getProfileViewAsync(EMAIL);
    expect(view).not.toBeNull();
    expect(view!.quiz_results).toHaveLength(1);
    expect(view!.quiz_results[0].via).toBe('lead');
    expect(view!.quiz_results[0].result.allies[0].name).toBe('Valerian root');
  });

  it('composeQuizResults dedupes a same-sitting lead against the profile save', async () => {
    const state = foldAccountRecords(EMAIL, [
      {
        email: EMAIL,
        type: 'account.quiz_result_saved',
        recorded_at: '2026-10-15T12:00:00.000Z',
        result: SNAPSHOT,
        via: 'quiz',
      },
    ]);
    const leads = [
      {
        id: 'lead-1',
        kind: 'quiz_lead' as const,
        email: EMAIL,
        name: 'Fern',
        consent: true as const,
        consentAt: '2026-10-15T12:02:00.000Z',
        metadata: {},
        quizResult: SNAPSHOT,
        capturedAt: '2026-10-15T12:02:00.000Z',
        source: 'nextjs' as const,
      },
      {
        id: 'lead-2',
        kind: 'quiz_lead' as const,
        email: EMAIL,
        name: null,
        consent: true as const,
        consentAt: '2026-09-01T12:00:00.000Z',
        metadata: {},
        quizResult: { ...SNAPSHOT, concernId: 'energy', concernLabel: 'Energy & Vitality' },
        capturedAt: '2026-09-01T12:00:00.000Z',
        source: 'nextjs' as const,
      },
    ];
    const composed = composeQuizResults(state, leads);
    // Same-sitting lead dropped; the older, different lead kept.
    expect(composed).toHaveLength(2);
    expect(composed[0].result.concernId).toBe('energy');
    expect(composed[1].via).toBe('quiz');
  });

  it('leads without a stored snapshot do not fabricate results', async () => {
    await leadStore.append({
      kind: 'quiz_lead',
      email: EMAIL,
      name: null,
      consent: true,
      consentAt: '2026-10-10T00:00:00.000Z',
      metadata: { concern_id: 'sleep', form_id: 'capsules' },
    });
    await ensureAccountAsync(EMAIL);
    const view = await getProfileViewAsync(EMAIL);
    expect(view!.quiz_results).toEqual([]);
  });
});

describe('order history', () => {
  it('filters to the account email and composes payment state', async () => {
    writeFileSync(
      process.env.ORDERS_LEDGER_PATH!,
      [
        orderLine('AWK-1', EMAIL, 2000, '2026-10-14T10:00:00.000Z'),
        orderLine('AWK-2', OTHER, 3000, '2026-10-14T10:30:00.000Z'),
        orderLine('AWK-3', ' Friend@Example.com ', 1554, '2026-10-14T11:00:00.000Z'),
      ].join('\n') + '\n',
      'utf8',
    );
    writeFileSync(
      process.env.ORDER_PAYMENTS_LEDGER_PATH!,
      JSON.stringify({
        event_id: 'PAY-1',
        order_id: 'AWK-1',
        method: 'cash_app_or_venmo',
        reference: null,
        note: null,
        recorded_at: '2026-10-14T12:00:00.000Z',
        recorded_by: 'owner',
        ledger_version: 1,
      }) + '\n',
      'utf8',
    );
    const orders = await listOrdersForEmailAsync(EMAIL);
    // Newest first (the orders store's own ordering), other email excluded.
    expect(orders.map((o) => o.order_id)).toEqual(['AWK-3', 'AWK-1']);
    expect(orders[0].status).toBe('pending_payment');
    expect(orders[1].status).toBe('paid');
    expect(orders[1].item_count).toBe(2);
  });
});

describe('export', () => {
  it('contains the profile, every lead, and every order for the email', async () => {
    await ensureAccountAsync(EMAIL, 'Fern');
    await setLikesAsync(EMAIL, [ROSE]);
    await saveSearchAsync(EMAIL, 'lavender', 'catalog');
    await saveQuizResultAsync(EMAIL, SNAPSHOT);
    await leadStore.append({
      kind: 'newsletter',
      email: EMAIL,
      name: 'Fern',
      consent: true,
      consentAt: '2026-10-01T00:00:00.000Z',
      metadata: { placement: 'footer' },
    });
    await leadStore.append({
      kind: 'newsletter',
      email: OTHER,
      name: null,
      consent: true,
      consentAt: '2026-10-01T00:00:00.000Z',
      metadata: {},
    });
    writeFileSync(
      process.env.ORDERS_LEDGER_PATH!,
      [orderLine('AWK-1', EMAIL, 2000), orderLine('AWK-2', OTHER, 3000)].join('\n') + '\n',
      'utf8',
    );
    const exp = await buildAccountExportAsync(EMAIL);
    expect(exp).not.toBeNull();
    expect(exp!.deleted).toBe(false);
    expect(exp!.account?.display_name).toBe('Fern');
    expect(exp!.account?.likes).toEqual([ROSE]);
    expect(exp!.account?.searches).toHaveLength(1);
    expect(exp!.account?.quiz_results).toHaveLength(1);
    expect(exp!.leads).toHaveLength(1);
    expect(exp!.leads[0].kind).toBe('newsletter');
    expect(exp!.orders.map((o) => o.order_id)).toEqual(['AWK-1']);
  });

  it('collapses to the tombstone after deletion', async () => {
    await ensureAccountAsync(EMAIL);
    await setLikesAsync(EMAIL, [ROSE]);
    await deleteAccountAsync(EMAIL);
    const exp = await buildAccountExportAsync(EMAIL);
    expect(exp!.deleted).toBe(true);
    expect(exp!.account).toBeNull();
    expect(exp!.leads).toEqual([]);
    expect(exp!.orders).toEqual([]);
    expect(await getProfileViewAsync(EMAIL)).toBeNull();
  });

  it('returns null for an email with no account', async () => {
    expect(await buildAccountExportAsync('nobody@example.com')).toBeNull();
    expect(await getProfileViewAsync('nobody@example.com')).toBeNull();
  });
});
