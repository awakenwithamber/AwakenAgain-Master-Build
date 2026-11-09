/**
 * Authorize.net webhook → paid-state chain, SHOP ORDERS ONLY
 * (card checkout build 2026-11-09; adapted from the unified build's
 * webhook suite to the shop-only processor and current main's
 * tax-inclusive totals).
 *
 * Against a fake Authorize.net client (no real gateway):
 * - a card order places UNPAID (audit: awaiting_payment) with NO
 *   confirmation email at placement;
 * - authcapture.created (verified signature, re-fetched amount equal
 *   to the stored total) marks it paid: payments ledger + audit
 *   'paid' + paid-state paid_via 'authorizenet' + the confirmation
 *   email queued exactly once, at payment;
 * - a duplicate delivery of the same notification is a no-op (the
 *   double-submit proof: one payment record, one email, one 'paid'
 *   audit row);
 * - a bad signature is rejected BEFORE anything is written;
 * - a tampered / mismatched amount fails loudly — nothing marked,
 *   event not recorded as processed, audit unchanged;
 * - a decline moves the order to 'failed' (audit, plain-language
 *   reason; status ledger 'payment_declined'), deletes nothing, and
 *   sends no email;
 * - a Utah order verifies at its TAX-INCLUSIVE total (charging the
 *   pre-tax figure is a mismatch);
 * - a refund moves the order to 'refunded' (audit + paid-state).
 */
import { createHmac } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const emailCalls: { order_id: string }[] = [];
vi.mock('../lib/jobs/order-confirmation', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../lib/jobs/order-confirmation')>();
  return {
    ...original,
    queueOrderConfirmation: async (record: { order_id: string }) => {
      emailCalls.push({ order_id: record.order_id });
      return { id: 'mock-email-job' };
    },
  };
});

import { POST as checkoutPOST } from '../app/api/checkout/route';
import {
  getAuthorizeNetConfig,
  hasProcessedAuthorizeNetEvent,
  readAuthorizeNetOrderAuditEvents,
  type AuthorizeNetClientLike,
  type AuthorizeNetTransactionDetails,
} from '../lib/payments/authorizenet';
import { processAuthorizeNetWebhook } from '../lib/payments/authorizenet-webhook';
import { resolveOrderPaidState } from '../lib/orders/paid-state';
import { createOrderStore } from '../lib/orders/store';
import { findAuthorizeNetPayment } from '../lib/payments/authorizenet';

const SIGNATURE_KEY_HEX = 'ab'.repeat(64); // test only
const API_ENV = {
  CARD_PAYMENTS_ENABLED: 'true',
  AUTHORIZENET_API_LOGIN_ID: 'test-login',
  AUTHORIZENET_TRANSACTION_KEY: 'test-key',
  AUTHORIZENET_SIGNATURE_KEY: SIGNATURE_KEY_HEX,
  AUTHORIZENET_ENV: 'sandbox',
};
const CONFIG = getAuthorizeNetConfig(API_ENV);

const ENV_KEYS = [
  'DATABASE_URL',
  'ORDERS_LEDGER_PATH',
  'SUBSCRIPTIONS_LEDGER_PATH',
  'ORDER_PAYMENTS_LEDGER_PATH',
  'STRIPE_PAYMENTS_LEDGER_PATH',
  'STRIPE_WEBHOOK_EVENTS_LEDGER_PATH',
  'STRIPE_ORDER_STATUS_LEDGER_PATH',
  'AUTHORIZENET_PAYMENTS_LEDGER_PATH',
  'AUTHORIZENET_WEBHOOK_EVENTS_LEDGER_PATH',
  'AUTHORIZENET_ORDER_STATUS_LEDGER_PATH',
  'AUTHORIZENET_ORDER_AUDIT_LEDGER_PATH',
  'RESEND_API_KEY',
  'AUTHORIZENET_API_LOGIN_ID',
  'AUTHORIZENET_TRANSACTION_KEY',
  'AUTHORIZENET_SIGNATURE_KEY',
  'AUTHORIZENET_ENV',
  'CARD_PAYMENTS_ENABLED',
] as const;
const savedEnv: Record<string, string | undefined> = {};
const DIR = mkdtempSync(join(tmpdir(), 'authorizenet-webhook-'));

beforeEach(() => {
  emailCalls.length = 0;
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  const run = join(DIR, `run-${Math.random().toString(36).slice(2)}`);
  process.env.ORDERS_LEDGER_PATH = join(run, 'orders.jsonl');
  process.env.SUBSCRIPTIONS_LEDGER_PATH = join(run, 'subscriptions.jsonl');
  process.env.ORDER_PAYMENTS_LEDGER_PATH = join(run, 'order-payments.jsonl');
  process.env.STRIPE_PAYMENTS_LEDGER_PATH = join(run, 'stripe-payments.jsonl');
  process.env.STRIPE_WEBHOOK_EVENTS_LEDGER_PATH = join(run, 'stripe-events.jsonl');
  process.env.STRIPE_ORDER_STATUS_LEDGER_PATH = join(run, 'stripe-status.jsonl');
  process.env.AUTHORIZENET_PAYMENTS_LEDGER_PATH = join(run, 'an-payments.jsonl');
  process.env.AUTHORIZENET_WEBHOOK_EVENTS_LEDGER_PATH = join(run, 'an-events.jsonl');
  process.env.AUTHORIZENET_ORDER_STATUS_LEDGER_PATH = join(run, 'an-status.jsonl');
  process.env.AUTHORIZENET_ORDER_AUDIT_LEDGER_PATH = join(run, 'an-audit.jsonl');
  delete process.env.DATABASE_URL;
  delete process.env.RESEND_API_KEY;
  for (const [k, v] of Object.entries(API_ENV)) process.env[k] = v;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

class FakeClient implements AuthorizeNetClientLike {
  details = new Map<string, AuthorizeNetTransactionDetails>();
  hostedRequests: { invoiceNumber: string; amountCents: number }[] = [];

  async getHostedPaymentPage(request: {
    invoiceNumber: string;
    amountCents: number;
  }) {
    this.hostedRequests.push(request);
    return { token: 'fake-token' };
  }
  async getTransactionDetails(transId: string) {
    const found = this.details.get(transId);
    if (!found) throw new Error(`no such transaction ${transId}`);
    return found;
  }
  async createSubscription(): Promise<{ subscriptionId: string }> {
    throw new Error('subscriptions are out of scope for the shop build');
  }
  async cancelSubscription() {
    throw new Error('subscriptions are out of scope for the shop build');
  }
}

function details(
  partial: Partial<AuthorizeNetTransactionDetails> & { transId: string },
): AuthorizeNetTransactionDetails {
  return {
    responseCode: 1,
    authAmountCents: null,
    invoiceNumber: null,
    customerEmail: null,
    customerProfileId: null,
    customerPaymentProfileId: null,
    subscriptionId: null,
    subscriptionPayNum: null,
    refTransId: null,
    ...partial,
  };
}

let notifCounter = 0;
function signedBody(
  eventType: string,
  entityId: string,
  opts: { notificationId?: string } = {},
) {
  const body = JSON.stringify({
    notificationId: opts.notificationId ?? `notif-${++notifCounter}`,
    eventType,
    eventDate: '2026-11-09T12:00:00.000Z',
    payload: { entityName: 'transaction', id: entityId },
  });
  const signature =
    'sha512=' +
    createHmac('sha512', Buffer.from(SIGNATURE_KEY_HEX, 'hex'))
      .update(body, 'utf8')
      .digest('hex');
  return { body, signature };
}

async function deliver(
  client: FakeClient,
  eventType: string,
  entityId: string,
  opts: { notificationId?: string; signature?: string } = {},
) {
  const { body, signature } = signedBody(eventType, entityId, opts);
  return processAuthorizeNetWebhook(body, opts.signature ?? signature, {
    config: CONFIG,
    client,
  });
}

const BASE_BODY = {
  items: [
    {
      product_handle: 'chill-pill-capsules',
      variant_id: 'chill-pill-capsules-2wk',
      quantity: 1,
      unit_price_cents: 1977,
    },
  ],
  customer: { name: 'Test Buyer', email: 'buyer@example.com' },
  shipping_address: {
    name: 'Test Buyer',
    street: '100 Main St',
    city: 'Denver',
    state: 'CO',
    postal_code: '80202',
    country: 'US',
  },
  payment_method: 'authorizenet_card_hosted',
};

async function placeCardOrder(
  extra: Record<string, unknown> = {},
  clientTotal = 2572,
): Promise<string> {
  const res = await checkoutPOST(
    new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...BASE_BODY,
        ...extra,
        client_total_cents: clientTotal,
      }),
    }),
  );
  const json = (await res.json()) as Record<string, unknown>;
  expect(res.status).toBe(200);
  expect(json.ok).toBe(true);
  return json.order_id as string;
}

async function auditStates(orderId: string) {
  const rows = await readAuthorizeNetOrderAuditEvents();
  return rows.filter((r) => r.order_id === orderId).map((r) => r.state);
}

describe('Authorize.net webhook — shop orders', () => {
  it('success: verified capture at the stored total marks paid once, audits, and emails at payment only', async () => {
    const orderId = await placeCardOrder();
    // Placement: unpaid, audit awaiting_payment, NO email yet.
    expect(emailCalls).toHaveLength(0);
    expect(await auditStates(orderId)).toEqual(['awaiting_payment']);
    const order = await createOrderStore().get(orderId);
    expect(order).not.toBeNull();
    let state = await resolveOrderPaidState(order!);
    expect(state.is_paid).toBe(false);
    expect(state.authorizenet_payment_status).toBe('awaiting_payment');

    const client = new FakeClient();
    client.details.set(
      'trans-1',
      details({
        transId: 'trans-1',
        invoiceNumber: orderId,
        authAmountCents: 2572,
        responseCode: 1,
      }),
    );
    const result = await deliver(
      client,
      'net.authorize.payment.authcapture.created',
      'trans-1',
      { notificationId: 'notif-success-1' },
    );
    expect(result.status).toBe(200);
    expect(result.outcome).toBe('paid');

    const payment = await findAuthorizeNetPayment(orderId);
    expect(payment?.amount_cents).toBe(2572);
    expect(await auditStates(orderId)).toEqual(['awaiting_payment', 'paid']);
    expect(emailCalls).toHaveLength(1);
    expect(emailCalls[0].order_id).toBe(orderId);

    state = await resolveOrderPaidState(order!);
    expect(state.is_paid).toBe(true);
    expect(state.paid_via).toBe('authorizenet');
    expect(state.authorizenet_payment_status).toBe('paid');

    // Double-submit: the SAME notification delivered again is a
    // no-op — one payment, one email, one 'paid' audit row.
    const dup = await deliver(
      client,
      'net.authorize.payment.authcapture.created',
      'trans-1',
      { notificationId: 'notif-success-1' },
    );
    expect(dup.status).toBe(200);
    expect(dup.outcome).toBe('duplicate');
    expect(emailCalls).toHaveLength(1);
    expect(await auditStates(orderId)).toEqual(['awaiting_payment', 'paid']);
  });

  it('decline: order moves to failed with a plain-language reason, nothing deleted, no email', async () => {
    const orderId = await placeCardOrder();
    const client = new FakeClient();
    client.details.set(
      'trans-decline',
      details({
        transId: 'trans-decline',
        invoiceNumber: orderId,
        authAmountCents: 2572,
        responseCode: 2,
      }),
    );
    const result = await deliver(
      client,
      'net.authorize.payment.authcapture.created',
      'trans-decline',
    );
    expect(result.status).toBe(200);
    expect(result.outcome).toBe('not_approved');
    expect(await findAuthorizeNetPayment(orderId)).toBeNull();
    expect(emailCalls).toHaveLength(0);
    const rows = (await readAuthorizeNetOrderAuditEvents()).filter(
      (r) => r.order_id === orderId,
    );
    expect(rows.map((r) => r.state)).toEqual(['awaiting_payment', 'failed']);
    expect(rows[1].reason).toContain('was not approved');
    expect(rows[1].reason).toContain('Your order is saved');
    // The order itself is untouched — the customer can retry.
    const order = await createOrderStore().get(orderId);
    expect(order).not.toBeNull();
    const state = await resolveOrderPaidState(order!);
    expect(state.is_paid).toBe(false);
    expect(state.authorizenet_payment_status).toBe('failed');
  });

  it('bad webhook signature is rejected and NOTHING is written', async () => {
    const orderId = await placeCardOrder();
    const client = new FakeClient();
    client.details.set(
      'trans-bad',
      details({
        transId: 'trans-bad',
        invoiceNumber: orderId,
        authAmountCents: 2572,
        responseCode: 1,
      }),
    );
    const { body } = signedBody(
      'net.authorize.payment.authcapture.created',
      'trans-bad',
      { notificationId: 'notif-bad-sig' },
    );
    const result = await processAuthorizeNetWebhook(
      body,
      'sha512=' + 'ff'.repeat(64),
      { config: CONFIG, client },
    );
    expect(result.status).toBe(400);
    expect(result.outcome).toBe('bad_signature');
    expect(await findAuthorizeNetPayment(orderId)).toBeNull();
    expect(await hasProcessedAuthorizeNetEvent('notif-bad-sig')).toBe(false);
    expect(await auditStates(orderId)).toEqual(['awaiting_payment']);
    expect(emailCalls).toHaveLength(0);
  });

  it('tampered amount: approved capture for the wrong amount fails loudly and marks nothing', async () => {
    const orderId = await placeCardOrder();
    const client = new FakeClient();
    client.details.set(
      'trans-tamper',
      details({
        transId: 'trans-tamper',
        invoiceNumber: orderId,
        authAmountCents: 100, // not the stored total
        responseCode: 1,
      }),
    );
    const { body, signature } = signedBody(
      'net.authorize.payment.authcapture.created',
      'trans-tamper',
      { notificationId: 'notif-tamper' },
    );
    await expect(
      processAuthorizeNetWebhook(body, signature, {
        config: CONFIG,
        client,
      }),
    ).rejects.toThrow(/amount mismatch/);
    expect(await findAuthorizeNetPayment(orderId)).toBeNull();
    expect(await hasProcessedAuthorizeNetEvent('notif-tamper')).toBe(false);
    expect(await auditStates(orderId)).toEqual(['awaiting_payment']);
    expect(emailCalls).toHaveLength(0);
  });

  it('Utah order verifies at its TAX-INCLUSIVE total; the pre-tax figure is a mismatch', async () => {
    // Salt Lake City delivery: 8.45% on $19.77 = $1.67 tax.
    const orderId = await placeCardOrder(
      {
        delivery_address: {
          line1: '100 Main St',
          city: 'Salt Lake City',
          state: 'UT',
          postal_code: '84104',
        },
        shipping_address: {
          name: 'Test Buyer',
          street: '100 Main St',
          city: 'Salt Lake City',
          state: 'UT',
          postal_code: '84104',
          country: 'US',
        },
      },
      2739,
    );
    const order = await createOrderStore().get(orderId);
    expect(order?.tax_cents).toBe(167);
    expect(order?.total_cents).toBe(2739);

    const client = new FakeClient();
    client.details.set(
      'trans-utah-low',
      details({
        transId: 'trans-utah-low',
        invoiceNumber: orderId,
        authAmountCents: 2572, // pre-tax — must NOT mark paid
        responseCode: 1,
      }),
    );
    const low = signedBody(
      'net.authorize.payment.authcapture.created',
      'trans-utah-low',
      { notificationId: 'notif-utah-low' },
    );
    await expect(
      processAuthorizeNetWebhook(low.body, low.signature, {
        config: CONFIG,
        client,
      }),
    ).rejects.toThrow(/amount mismatch/);
    expect(await findAuthorizeNetPayment(orderId)).toBeNull();

    client.details.set(
      'trans-utah',
      details({
        transId: 'trans-utah',
        invoiceNumber: orderId,
        authAmountCents: 2739,
        responseCode: 1,
      }),
    );
    const ok = await deliver(
      client,
      'net.authorize.payment.authcapture.created',
      'trans-utah',
    );
    expect(ok.outcome).toBe('paid');
    expect((await findAuthorizeNetPayment(orderId))?.amount_cents).toBe(2739);
  });

  it('refund: a verified refund moves the paid order to refunded (audit + paid-state)', async () => {
    const orderId = await placeCardOrder();
    const client = new FakeClient();
    client.details.set(
      'trans-pay',
      details({
        transId: 'trans-pay',
        invoiceNumber: orderId,
        authAmountCents: 2572,
        responseCode: 1,
      }),
    );
    await deliver(client, 'net.authorize.payment.authcapture.created', 'trans-pay');
    expect(await auditStates(orderId)).toEqual(['awaiting_payment', 'paid']);

    client.details.set(
      'trans-refund',
      details({
        transId: 'trans-refund',
        invoiceNumber: orderId,
        authAmountCents: 2572,
        responseCode: 1,
        refTransId: 'trans-pay',
      }),
    );
    const result = await deliver(
      client,
      'net.authorize.payment.refund.created',
      'trans-refund',
    );
    expect(result.outcome).toBe('refunded');
    expect(await auditStates(orderId)).toEqual([
      'awaiting_payment',
      'paid',
      'refunded',
    ]);
    const order = await createOrderStore().get(orderId);
    const state = await resolveOrderPaidState(order!);
    expect(state.status).toBe('refunded');
    expect(state.is_paid).toBe(false);
    expect(state.authorizenet_payment_status).toBe('refunded');
  });

  it('a non-shop invoice reference is acknowledged with no side effect (subscription/unlock not ported)', async () => {
    const client = new FakeClient();
    client.details.set(
      'trans-sub',
      details({
        transId: 'trans-sub',
        invoiceNumber: 'SUB-0000000000000001',
        authAmountCents: 777,
        responseCode: 1,
      }),
    );
    const result = await deliver(
      client,
      'net.authorize.payment.authcapture.created',
      'trans-sub',
    );
    expect(result.status).toBe(200);
    expect(result.outcome).toBe('unknown_order');
    expect(emailCalls).toHaveLength(0);
  });
});
