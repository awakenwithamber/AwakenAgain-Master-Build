/**
 * Stage 5 — webhook failure visibility floor.
 *
 * Laws: every Stripe webhook failure path emits ONE structured error
 * log (via lib/observability/logger, captured here at its console sink)
 * carrying the event id + type where an event exists:
 * - signature failure (invalid + missing signature),
 * - amount mismatch (the strict paid gate throws),
 * - handler error (unlock amount mismatch throws inside its handler).
 * A successful delivery emits NO error log. Responses and ledger
 * behavior are unchanged from Stages 1–3 (failed deliveries are still
 * not event-ledger recorded).
 *
 * Harness mirrors tests/stripe-webhook-route.test.ts (same mocked
 * Stripe client, same tmp ledgers) — additive only; that suite is
 * unmodified.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const hoisted = vi.hoisted(() => {
  const client = {
    checkout: {
      sessions: {
        create: async () => ({ id: 'cs_unused', client_secret: 'x' }),
      },
    },
    coupons: { create: async () => ({ id: 'cpn_unused' }) },
    webhooks: {
      constructEvent: (body: string, signature: string) => {
        if (signature !== 'valid-signature') {
          throw new Error('signature verification failed');
        }
        return JSON.parse(body) as Record<string, unknown>;
      },
    },
  };
  return { client };
});

vi.mock('../lib/payments/stripe', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/payments/stripe')>();
  return { ...actual, createStripeClient: () => hoisted.client };
});

import { POST } from '../app/api/stripe/webhook/route';
import { POST as postCheckout } from '../app/api/checkout/route';
import { findStripeWebhookEvent } from '../lib/payments/stripe';

const DIR = mkdtempSync(join(tmpdir(), 'stage5-webhook-logging-'));
const CUSTOMER = { name: 'Test Customer', email: 'test@example.com' };
const CAPSULE_ITEM = {
  product_handle: 'chill-pill-capsules',
  variant_id: 'chill-pill-capsules-2wk',
  quantity: 1,
  unit_price_cents: 1977,
};
const ORDER_TOTAL_CENTS = 1977 + 595;
const TAX_CENTS = 187;

const ENV_KEYS = [
  'ORDERS_LEDGER_PATH',
  'SUBSCRIPTIONS_LEDGER_PATH',
  'STRIPE_PAYMENTS_LEDGER_PATH',
  'STRIPE_WEBHOOK_EVENTS_LEDGER_PATH',
  'STRIPE_ORDER_STATUS_LEDGER_PATH',
  'ORDER_PAYMENTS_LEDGER_PATH',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'RESEND_API_KEY',
  'DATABASE_URL',
] as const;
const savedEnv: Record<string, string | undefined> = {};

interface CapturedLog {
  level: string;
  scope: string;
  context?: Record<string, unknown>;
}
let errorLogs: CapturedLog[] = [];
let consoleSpies: ReturnType<typeof vi.spyOn>[] = [];

function captureConsole() {
  errorLogs = [];
  const make = (level: string) =>
    vi.spyOn(console, level as 'error').mockImplementation((...args: unknown[]) => {
      if (level !== 'error') return;
      for (const arg of args) {
        if (typeof arg !== 'string') continue;
        try {
          const parsed = JSON.parse(arg) as CapturedLog;
          if (parsed.scope === 'stripe-webhook') errorLogs.push(parsed);
        } catch {
          /* not a logger line */
        }
      }
    });
  consoleSpies = [make('error'), make('warn'), make('info')];
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.ORDERS_LEDGER_PATH = join(DIR, 'orders.jsonl');
  process.env.SUBSCRIPTIONS_LEDGER_PATH = join(DIR, 'subscriptions.jsonl');
  process.env.STRIPE_PAYMENTS_LEDGER_PATH = join(DIR, 'stripe-payments.jsonl');
  process.env.STRIPE_WEBHOOK_EVENTS_LEDGER_PATH = join(
    DIR,
    'stripe-webhook-events.jsonl',
  );
  process.env.STRIPE_ORDER_STATUS_LEDGER_PATH = join(
    DIR,
    'stripe-order-status.jsonl',
  );
  process.env.ORDER_PAYMENTS_LEDGER_PATH = join(DIR, 'order-payments.jsonl');
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';
  delete process.env.RESEND_API_KEY;
  delete process.env.DATABASE_URL;
  captureConsole();
});

afterEach(() => {
  for (const spy of consoleSpies) spy.mockRestore();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

async function seedOrder(): Promise<string> {
  const res = await postCheckout(
    new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [CAPSULE_ITEM],
        customer: CUSTOMER,
        payment_method: 'stripe_card_embedded',
        client_total_cents: ORDER_TOTAL_CENTS,
      }),
    }),
  );
  const json = (await res.json()) as { ok: boolean; order_id: string };
  expect(res.status).toBe(200);
  return json.order_id;
}

async function postWebhook(event: unknown, signature: string | null = 'valid-signature') {
  const headers: Record<string, string> = {};
  if (signature !== null) headers['stripe-signature'] = signature;
  const res = await POST(
    new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe('Stage 5 webhook failure logging', () => {
  it('invalid signature → 400 + structured error log (signature failure)', async () => {
    const { status } = await postWebhook({ id: 'evt_x', type: 'x' }, 'bad-signature');
    expect(status).toBe(400);
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].context?.failure).toBe('invalid_signature');
  });

  it('missing signature → 400 + structured error log', async () => {
    const { status } = await postWebhook({ id: 'evt_x', type: 'x' }, null);
    expect(status).toBe(400);
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].context?.failure).toBe('missing_signature');
  });

  it('amount mismatch → 400 + error log with event id + type, and no event-ledger record', async () => {
    const orderId = await seedOrder();
    errorLogs = [];
    const event = {
      id: 'evt_bad_amount',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_bad',
          payment_status: 'paid',
          amount_total: ORDER_TOTAL_CENTS + TAX_CENTS + 1, // one cent off
          currency: 'usd',
          payment_intent: 'pi_test_bad',
          client_reference_id: orderId,
          metadata: { order_id: orderId },
          total_details: { amount_tax: TAX_CENTS },
        },
      },
    };
    const { status } = await postWebhook(event);
    expect(status).toBe(400);
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].context?.failure).toBe('processing_failed');
    expect(errorLogs[0].context?.event_id).toBe('evt_bad_amount');
    expect(errorLogs[0].context?.event_type).toBe('checkout.session.completed');
    // Stage 1 law preserved: the failed delivery is NOT recorded.
    expect(await findStripeWebhookEvent('evt_bad_amount')).toBeNull();
  });

  it('handler error (unlock amount mismatch) → 400 + error log with event id + type', async () => {
    errorLogs = [];
    const event = {
      id: 'evt_unlock_bad_amount',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_unlock_bad',
          payment_status: 'paid',
          amount_total: 999, // unlock price is 888
          currency: 'usd',
          payment_intent: 'pi_unlock_bad',
          metadata: { purpose: 'grimoire_permanent_unlock', email: 'buyer@example.com' },
        },
      },
    };
    const { status } = await postWebhook(event);
    expect(status).toBe(400);
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].context?.event_id).toBe('evt_unlock_bad_amount');
    expect(errorLogs[0].context?.event_type).toBe('checkout.session.completed');
    const serialized = JSON.stringify(errorLogs[0]);
    expect(serialized).not.toContain('buyer@example.com');
    expect(serialized).not.toContain('whsec_fake');
  });

  it('a successful delivery emits no error log', async () => {
    const orderId = await seedOrder();
    errorLogs = [];
    const event = {
      id: `evt_ok_${orderId}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_ok',
          payment_status: 'paid',
          amount_total: ORDER_TOTAL_CENTS + TAX_CENTS,
          currency: 'usd',
          payment_intent: 'pi_test_ok',
          client_reference_id: orderId,
          metadata: { order_id: orderId },
          total_details: { amount_tax: TAX_CENTS },
        },
      },
    };
    const { status, json } = await postWebhook(event);
    expect(status).toBe(200);
    expect(json.marked_paid).toBe(true);
    expect(errorLogs).toHaveLength(0);
  });
});
