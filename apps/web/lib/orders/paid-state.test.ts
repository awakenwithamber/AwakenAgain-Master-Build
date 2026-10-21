/**
 * Shared paid-state resolver — Stage 1 (audit G-5/G-4).
 *
 * Laws under test:
 * - An order is 'paid' when EITHER paid ledger proves payment — the
 *   Stripe webhook ledger OR the owner-confirmed manual ledger —
 *   regardless of the payment method recorded on the order (the
 *   read-path split this module exists to close).
 * - Unpaid when neither ledger has anything for the order.
 * - 'paid' via both ledgers reports paid_via 'both'.
 * - A Stripe refund/dispute transition supersedes 'paid'.
 * - The pure fold agrees with the async resolver on the same evidence.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveOrderPaidState,
  resolvePaidStateFromEvidence,
} from './paid-state';
import { appendPaymentEvent, buildPaymentEvent } from './payments';
import {
  recordStripeOrderStatus,
  recordStripePayment,
  type StripePaymentRecord,
} from '../payments/stripe';
import type { OrderRecord } from '../checkout/order';

const DIR = mkdtempSync(join(tmpdir(), 'paid-state-'));
const ENVS = [
  'STRIPE_PAYMENTS_LEDGER_PATH',
  'ORDER_PAYMENTS_LEDGER_PATH',
  'STRIPE_ORDER_STATUS_LEDGER_PATH',
  'STRIPE_WEBHOOK_EVENTS_LEDGER_PATH',
  'DATABASE_URL',
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENVS) saved[key] = process.env[key];
  process.env.STRIPE_PAYMENTS_LEDGER_PATH = join(DIR, 'stripe-payments.jsonl');
  process.env.ORDER_PAYMENTS_LEDGER_PATH = join(DIR, 'payments.jsonl');
  process.env.STRIPE_ORDER_STATUS_LEDGER_PATH = join(DIR, 'order-status.jsonl');
  process.env.STRIPE_WEBHOOK_EVENTS_LEDGER_PATH = join(DIR, 'webhook-events.jsonl');
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  for (const key of ENVS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

let seq = 0;
function order(overrides: Partial<OrderRecord> = {}): OrderRecord {
  seq += 1;
  return {
    order_id: `AWK-TEST-${seq}`,
    created_at: '2026-10-21T00:00:00.000Z',
    computed_by: 'server',
    ledger_version: 1,
    customer: { name: 'Test Customer', email: 'customer@example.com' },
    items: [],
    bundle: null,
    subtotal_cents: 1000,
    subscriber_discount_cents: 0,
    shipping_cents: 0,
    shipping_status: 'FREE',
    free_shipping_threshold_cents: 4500,
    total_cents: 1000,
    is_subscriber_asserted: false,
    is_subscriber_verified: false,
    payment_method: 'cash_app_or_venmo',
    ...overrides,
  };
}

function stripePayment(orderId: string): StripePaymentRecord {
  return {
    order_id: orderId,
    stripe_session_id: `cs_${orderId}`,
    payment_intent_id: `pi_${orderId}`,
    amount_total_cents: 1000,
    tax_cents: 0,
    currency: 'usd',
    paid_at: '2026-10-21T01:00:00.000Z',
    source: 'stripe_webhook',
  };
}

describe('resolveOrderPaidState', () => {
  it('unpaid when neither ledger has anything for the order', async () => {
    const state = await resolveOrderPaidState(order());
    expect(state.status).toBe('pending_payment');
    expect(state.is_paid).toBe(false);
    expect(state.paid_via).toBeNull();
    expect(state.payment_confirmed_at).toBeNull();
  });

  it('Stripe-paid: a webhook payment record resolves paid even for a manual-method order', async () => {
    const o = order({ payment_method: 'cash_app_or_venmo' });
    await recordStripePayment(stripePayment(o.order_id));
    const state = await resolveOrderPaidState(o);
    expect(state.status).toBe('paid');
    expect(state.is_paid).toBe(true);
    expect(state.paid_via).toBe('stripe');
    expect(state.payment_confirmed_at).toBe('2026-10-21T01:00:00.000Z');
    expect(state.stripe_payment?.order_id).toBe(o.order_id);
  });

  it('manual-paid: an owner confirmation resolves paid even for a card-method order', async () => {
    const o = order({ payment_method: 'stripe_card_embedded' });
    await appendPaymentEvent(
      buildPaymentEvent({
        order_id: o.order_id,
        method: 'cash_app_or_venmo',
        reference: 'ref-1',
        note: null,
      }),
    );
    const state = await resolveOrderPaidState(o);
    expect(state.status).toBe('paid');
    expect(state.is_paid).toBe(true);
    expect(state.paid_via).toBe('manual');
    expect(state.manual_payment?.order_id).toBe(o.order_id);
    expect(state.payment_confirmed_at).toBe(state.manual_payment?.recorded_at);
  });

  it('both ledgers → paid via both', async () => {
    const o = order();
    await recordStripePayment(stripePayment(o.order_id));
    await appendPaymentEvent(
      buildPaymentEvent({
        order_id: o.order_id,
        method: 'cash_app_or_venmo',
        reference: null,
        note: null,
      }),
    );
    const state = await resolveOrderPaidState(o);
    expect(state.status).toBe('paid');
    expect(state.is_paid).toBe(true);
    expect(state.paid_via).toBe('both');
    expect(state.stripe_payment).not.toBeNull();
    expect(state.manual_payment).not.toBeNull();
  });

  it('a refund transition supersedes paid', async () => {
    const o = order({ payment_method: 'stripe_card_embedded' });
    await recordStripePayment(stripePayment(o.order_id));
    await recordStripeOrderStatus({
      order_id: o.order_id,
      status: 'refunded',
      stripe_event_id: `evt_refund_${o.order_id}`,
      charge_id: 'ch_1',
      payment_intent_id: `pi_${o.order_id}`,
      recorded_at: '2026-10-21T02:00:00.000Z',
      source: 'stripe_webhook',
    });
    const state = await resolveOrderPaidState(o);
    expect(state.status).toBe('refunded');
    expect(state.is_paid).toBe(false);
    expect(state.status_event?.status).toBe('refunded');
  });

  it('a dispute transition supersedes paid', async () => {
    const o = order({ payment_method: 'stripe_card_embedded' });
    await recordStripePayment(stripePayment(o.order_id));
    await recordStripeOrderStatus({
      order_id: o.order_id,
      status: 'disputed',
      stripe_event_id: `evt_dispute_${o.order_id}`,
      charge_id: 'ch_1',
      payment_intent_id: `pi_${o.order_id}`,
      recorded_at: '2026-10-21T02:00:00.000Z',
      source: 'stripe_webhook',
    });
    const state = await resolveOrderPaidState(o);
    expect(state.status).toBe('disputed');
    expect(state.is_paid).toBe(false);
  });

  it('falls back to the order record status when no ledger evidence exists', async () => {
    const cancelled = await resolveOrderPaidState(order({ status: 'cancelled' }));
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.is_paid).toBe(false);
  });
});

describe('resolvePaidStateFromEvidence (pure fold)', () => {
  it('agrees with the async resolver on the same evidence', async () => {
    const o = order();
    const payment = stripePayment(o.order_id);
    await recordStripePayment(payment);
    const asyncState = await resolveOrderPaidState(o);
    const pureState = resolvePaidStateFromEvidence(o, {
      stripePayment: payment,
      manualPayment: null,
      statusEvent: null,
    });
    expect(pureState.status).toBe(asyncState.status);
    expect(pureState.is_paid).toBe(asyncState.is_paid);
    expect(pureState.paid_via).toBe(asyncState.paid_via);
    expect(pureState.payment_confirmed_at).toBe(
      asyncState.payment_confirmed_at,
    );
  });

  it('empty evidence → pending_payment', () => {
    const state = resolvePaidStateFromEvidence(order(), {
      stripePayment: null,
      manualPayment: null,
      statusEvent: null,
    });
    expect(state.status).toBe('pending_payment');
    expect(state.is_paid).toBe(false);
  });
});
