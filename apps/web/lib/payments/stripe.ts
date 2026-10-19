/**
 * Stripe embedded checkout — server side (owner directive 2026-10-19).
 *
 * The PRIMARY card path: the customer pays by card inside an embedded
 * Stripe Checkout rendered on awakenagain.com. Bookipi invoice stays
 * selectable as the backup card path; Cash App / Venmo unchanged.
 *
 * Money-path laws:
 * - The order is created FIRST by the server-authoritative checkout
 *   (lib/checkout/order) and persisted UNPAID. Only then is a Checkout
 *   Session created, from the SERVER-computed order record — client
 *   amounts never reach Stripe.
 * - An order is marked paid ONLY here, from a signature-verified
 *   webhook event whose amount matches the persisted order total. The
 *   client-side return page can display status; it can never set it.
 * - Everything is env-gated: without STRIPE_SECRET_KEY +
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY the card option reports itself
 *   unavailable and the rest of checkout works untouched. Webhook
 *   handling additionally requires STRIPE_WEBHOOK_SECRET.
 *
 * Paid state lives in its own append-only JSONL ledger (the same
 * pattern as order tracking), keyed by order_id, written once per order.
 */
import Stripe from 'stripe';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { OrderRecord } from '../checkout/order';

/* ------------------------------------------------------------------ */
/* Configuration (env-gated)                                            */
/* ------------------------------------------------------------------ */

export interface StripeConfig {
  secretKey?: string;
  publishableKey?: string;
  webhookSecret?: string;
  /** Both keys present → the embedded card option can be offered. */
  cardAvailable: boolean;
  /** Secret + webhook secret present → the webhook can verify events. */
  webhookConfigured: boolean;
}

export function getStripeConfig(
  env: Record<string, string | undefined> = process.env,
): StripeConfig {
  const secretKey = env.STRIPE_SECRET_KEY?.trim() || undefined;
  const publishableKey =
    env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || undefined;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim() || undefined;
  return {
    secretKey,
    publishableKey,
    webhookSecret,
    cardAvailable: Boolean(secretKey && publishableKey),
    webhookConfigured: Boolean(secretKey && webhookSecret),
  };
}

/* ------------------------------------------------------------------ */
/* Client (structural interface so tests can inject a fake)           */
/* ------------------------------------------------------------------ */

export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface StripeClientLike {
  checkout: {
    sessions: {
      create(
        params: Record<string, unknown>,
      ): Promise<{ id: string; client_secret: string | null }>;
    };
  };
  coupons: {
    create(params: Record<string, unknown>): Promise<{ id: string }>;
  };
  webhooks: {
    constructEvent(
      body: string,
      signature: string,
      secret: string,
    ): StripeEventLike;
  };
}

/** Real client when the secret key is configured; otherwise null. */
export function createStripeClient(
  env: Record<string, string | undefined> = process.env,
): StripeClientLike | null {
  const { secretKey } = getStripeConfig(env);
  if (!secretKey) return null;
  return new Stripe(secretKey) as unknown as StripeClientLike;
}

/* ------------------------------------------------------------------ */
/* Checkout Session creation — from the SERVER order record only        */
/* ------------------------------------------------------------------ */

export interface CheckoutSessionLineItem {
  quantity: number;
  price_data: {
    currency: 'usd';
    unit_amount: number;
    product_data: { name: string };
  };
}

export function buildSessionLineItems(
  record: OrderRecord,
): CheckoutSessionLineItem[] {
  const lineItems: CheckoutSessionLineItem[] = record.items.map((line) => ({
    quantity: line.quantity,
    price_data: {
      currency: 'usd',
      unit_amount: line.unit_price_cents,
      product_data: { name: line.title },
    },
  }));
  if (record.bundle) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: record.bundle.price_cents,
        product_data: { name: 'The Alchemy Soap Collection (5 soaps)' },
      },
    });
  }
  if (record.shipping_cents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: record.shipping_cents,
        product_data: { name: 'Shipping' },
      },
    });
  }
  return lineItems;
}

/** The total the session MUST charge, recomputed from the record. */
export function expectedSessionTotalCents(record: OrderRecord): number {
  const lines = buildSessionLineItems(record).reduce(
    (sum, item) => sum + item.price_data.unit_amount * item.quantity,
    0,
  );
  return lines - record.subscriber_discount_cents;
}

export function buildEmbeddedSessionParams(
  record: OrderRecord,
  returnUrl: string,
  couponId?: string,
): Record<string, unknown> {
  if (expectedSessionTotalCents(record) !== record.total_cents) {
    throw new Error(
      `Order ${record.order_id} totals are internally inconsistent — refusing to create a payment session.`,
    );
  }
  return {
    mode: 'payment',
    ui_mode: 'embedded',
    return_url: returnUrl,
    customer_email: record.customer.email,
    client_reference_id: record.order_id,
    metadata: { order_id: record.order_id },
    payment_intent_data: { metadata: { order_id: record.order_id } },
    line_items: buildSessionLineItems(record),
    ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
  };
}

export async function createEmbeddedCheckoutSession(
  record: OrderRecord,
  client: StripeClientLike,
  returnUrl: string,
): Promise<{ id: string; client_secret: string }> {
  let couponId: string | undefined;
  if (record.subscriber_discount_cents > 0) {
    const coupon = await client.coupons.create({
      amount_off: record.subscriber_discount_cents,
      currency: 'usd',
      duration: 'once',
      name: `Living Grimoire subscriber discount — order ${record.order_id}`,
    });
    couponId = coupon.id;
  }
  const session = await client.checkout.sessions.create(
    buildEmbeddedSessionParams(record, returnUrl, couponId),
  );
  if (!session.client_secret) {
    throw new Error('Stripe did not return a client secret for the session.');
  }
  return { id: session.id, client_secret: session.client_secret };
}

/* ------------------------------------------------------------------ */
/* Paid ledger — written ONLY by the signature-verified webhook         */
/* ------------------------------------------------------------------ */

export interface StripePaymentRecord {
  order_id: string;
  stripe_session_id: string;
  payment_intent_id: string | null;
  amount_total_cents: number;
  currency: string;
  paid_at: string;
  source: 'stripe_webhook';
}

export function defaultStripePaymentsLedgerPath(): string {
  return (
    process.env.STRIPE_PAYMENTS_LEDGER_PATH ??
    join(process.cwd(), '.stripe-payments.jsonl')
  );
}

async function readStripePayments(): Promise<StripePaymentRecord[]> {
  let raw: string;
  try {
    raw = await readFile(defaultStripePaymentsLedgerPath(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const records: StripePaymentRecord[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = JSON.parse(trimmed) as StripePaymentRecord;
    if (parsed && typeof parsed.order_id === 'string') records.push(parsed);
  }
  return records;
}

/** The payment record for an order, or null if the webhook has not marked it paid. */
export async function findStripePayment(
  orderId: string,
): Promise<StripePaymentRecord | null> {
  const records = await readStripePayments();
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].order_id === orderId) return records[i];
  }
  return null;
}

/**
 * Mark an order paid from a verified webhook event. Idempotent: an
 * order already marked paid is returned as-is, never double-recorded.
 */
export async function recordStripePayment(
  record: StripePaymentRecord,
): Promise<StripePaymentRecord> {
  const existing = await findStripePayment(record.order_id);
  if (existing) return existing;
  const path = defaultStripePaymentsLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

/** Display status for an order: webhook-paid wins over the stored status. */
export function resolveOrderStatus(
  record: OrderRecord,
  payment: StripePaymentRecord | null,
): 'pending_payment' | 'paid' | 'cancelled' {
  if (payment) return 'paid';
  return record.status ?? 'pending_payment';
}
