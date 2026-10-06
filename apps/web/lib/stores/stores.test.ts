/**
 * Tests — order store (G12) + operational store bindings.
 * Laws: JSONL store reads newest-first, skips AND reports corrupt lines,
 * returns [] for a missing ledger; planned stores refuse with
 * StoreNotBoundError and always report NEEDS_VERIFICATION binding.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonlOrderStore } from './order-store';
import {
  PendingBindingQuizLeadStore,
  PendingBindingReviewStore,
  PendingBindingSubmissionStore,
  PendingBindingSubscriberStore,
  StoreNotBoundError,
} from './operational-stores';

function fixtureLedger(): string {
  const dir = mkdtempSync(join(tmpdir(), 'admin-store-test-'));
  const path = join(dir, 'orders.jsonl');
  const rec = (id: string, date: string, total: number) =>
    JSON.stringify({
      order_id: id,
      created_at: date,
      computed_by: 'server',
      ledger_version: 1,
      customer: { name: 'Test', email: 'test@example.com' },
      items: [],
      bundle: null,
      subtotal_cents: total,
      shipping_cents: 0,
      shipping_status: 'FREE',
      free_shipping_threshold_cents: 10000,
      total_cents: total,
      is_subscriber_asserted: false,
      payment_method: 'cash_app_or_venmo',
    });
  writeFileSync(
    path,
    [
      rec('AWK-20261004-AAAAAA', '2026-10-04T10:00:00.000Z', 3577),
      'this is not json',
      rec('AWK-20261005-BBBBBB', '2026-10-05T10:00:00.000Z', 1977),
      JSON.stringify({ nope: 'not an order record' }),
      '',
    ].join('\n'),
    'utf8',
  );
  return path;
}

describe('JsonlOrderStore', () => {
  it('lists newest-first and skips corrupt lines', async () => {
    const store = new JsonlOrderStore(fixtureLedger());
    const orders = await store.listOrders();
    expect(orders.map((o) => o.order_id)).toEqual([
      'AWK-20261005-BBBBBB',
      'AWK-20261004-AAAAAA',
    ]);
  });

  it('reports parse issues instead of silently dropping', async () => {
    const store = new JsonlOrderStore(fixtureLedger());
    await store.listOrders();
    const issues = store.getParseIssues();
    expect(issues.length).toBe(2);
    expect(issues[0].line).toBe(2);
    expect(issues.every((i) => i.error.length > 0)).toBe(true);
  });

  it('respects limit', async () => {
    const store = new JsonlOrderStore(fixtureLedger());
    const orders = await store.listOrders({ limit: 1 });
    expect(orders.length).toBe(1);
    expect(orders[0].order_id).toBe('AWK-20261005-BBBBBB');
  });

  it('returns [] for a missing ledger', async () => {
    const store = new JsonlOrderStore(join(tmpdir(), 'no-such-ledger.jsonl'));
    expect(await store.listOrders()).toEqual([]);
    expect(store.getParseIssues()).toEqual([]);
  });

  it('records render as the server wrote them (AWK-* identity preserved)', async () => {
    const store = new JsonlOrderStore(fixtureLedger());
    const [o] = await store.listOrders({ limit: 1 });
    expect(o.order_id).toMatch(/^AWK-/);
    expect(o.computed_by).toBe('server');
    expect(o.payment_method).toBe('cash_app_or_venmo');
  });
});

describe('planned operational stores', () => {
  it('quiz leads: binding NEEDS_VERIFICATION, list throws', () => {
    const s = new PendingBindingQuizLeadStore();
    expect(s.binding().status).toBe('NEEDS_VERIFICATION');
    expect(() => s.listLeads()).toThrow(StoreNotBoundError);
  });

  it('reviews: binding NEEDS_VERIFICATION, queue throws', () => {
    const s = new PendingBindingReviewStore();
    expect(s.binding().status).toBe('NEEDS_VERIFICATION');
    expect(() => s.listModerationQueue()).toThrow(StoreNotBoundError);
    expect(() => s.listReviews()).toThrow(StoreNotBoundError);
  });

  it('submissions: binding NEEDS_VERIFICATION, list throws', () => {
    const s = new PendingBindingSubmissionStore();
    expect(s.binding().status).toBe('NEEDS_VERIFICATION');
    expect(() => s.listSubmissions()).toThrow(StoreNotBoundError);
  });

  it('subscribers: binding NEEDS_VERIFICATION, count throws', () => {
    const s = new PendingBindingSubscriberStore();
    expect(s.binding().status).toBe('NEEDS_VERIFICATION');
    expect(() => s.countSubscribers()).toThrow(StoreNotBoundError);
  });

  it('binding detail is non-empty and honest', () => {
    for (const s of [
      new PendingBindingQuizLeadStore(),
      new PendingBindingReviewStore(),
      new PendingBindingSubmissionStore(),
      new PendingBindingSubscriberStore(),
    ]) {
      expect(s.binding().detail.length).toBeGreaterThan(20);
    }
  });
});
