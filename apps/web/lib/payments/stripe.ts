/**
 * Stripe embedded checkout — server side (owner directive 2026-10-19).
 *
 * The card path: the customer pays by card inside an embedded
 * Stripe Checkout rendered on awakenagain.com. Cash App / Venmo
 * unchanged. (The former Bookipi invoice backup path was removed by
 * owner directive 2026-10-21.)
 *
 * Money-path laws:
 * - The order is created FIRST by the server-authoritative checkout
 *   (lib/checkout/order) and persisted UNPAID. Only then is a Checkout
 *   Session created, from the SERVER-computed order record — client
 *   amounts never reach Stripe.
 * - Shipping + tax (owner decision 2026-10-20): the order total is
 *   PRE-TAX (items − discount + flat/free shipping from the record).
 *   Shipping reaches Stripe as a session shipping_option matching the
 *   record — never as a line item — and Stripe Tax (automatic_tax)
 *   computes sales tax from the collected US shipping address.
 * - An order is marked paid ONLY here, from a signature-verified
 *   webhook event whose amount equals the persisted order total PLUS
 *   the tax Stripe reports (session total_details.amount_tax). The
 *   client-side return page can display status; it can never set it.
 * - Everything is env-gated: without STRIPE_SECRET_KEY +
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY the card option reports itself
 *   unavailable and the rest of checkout works untouched. Webhook
 *   handling additionally requires STRIPE_WEBHOOK_SECRET.
 *
 * Paid state lives in its own append-only ledger (the same pattern as
 * order tracking), keyed by order_id, written once per order. Driver
 * selection is the codebase standard (Phase 3 Step 1): DATABASE_URL set
 * → the Postgres event store ('stripe_payments' stream); unset → the
 * local JSONL file, byte-identical to before. (2026-10-19 durable-
 * stores fix: this ledger originally shipped file-only, which on
 * Vercel's read-only filesystem meant the webhook could never durably
 * mark an order paid in production.)
 *
 * Stage 1 (audit G-6/G-7/G-4): the same driver selection also backs two
 * sibling ledgers in this module — the webhook EVENT ledger
 * ('stripe_events' stream / .stripe-webhook-events.jsonl), which
 * records every successfully processed event by its Stripe event id
 * so webhook idempotency is by event id, not only by order id; and
 * the order-STATUS ledger ('stripe_order_status' stream /
 * .stripe-order-status.jsonl), which records refund/dispute
 * transitions ('refunded' | 'disputed') written by the verified
 * webhook's charge.refunded / charge.dispute.created handlers.
 */
import Stripe from 'stripe';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { OrderRecord, OrderStatus } from '../checkout/order';
import {
  EVENT_STREAMS,
  appendEvent,
  postgresEnabled,
  readStreamEvents,
} from '../events/event-store';

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
  /** Unix seconds the event was created (monotonic guard, Stage 3). */
  created?: number;
  /** Test vs live mode flag on the event (Stage 3, audit G-9 log-only). */
  livemode?: boolean;
  data: { object: Record<string, unknown> };
}

export interface StripeClientLike {
  checkout: {
    sessions: {
      create(
        params: Record<string, unknown>,
      ): Promise<{
        id: string;
        client_secret: string | null;
        url?: string | null;
      }>;
    };
  };
  coupons: {
    create(params: Record<string, unknown>): Promise<{ id: string }>;
  };
  /** Billing Portal — optional so existing test fakes stay valid. */
  billingPortal?: {
    sessions: {
      create(
        params: Record<string, unknown>,
      ): Promise<{ id: string; url: string }>;
    };
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

/**
 * Stripe Tax code applied to every line item (owner decision
 * 2026-10-20): 'txcd_99999999' is Stripe's general / tangible-goods
 * code. Prices are tax-EXCLUSIVE — Stripe Tax adds tax on top, computed
 * from the shipping address collected in the session.
 */
export const STRIPE_TAX_CODE_GENERAL = 'txcd_99999999';

export interface CheckoutSessionLineItem {
  quantity: number;
  price_data: {
    currency: 'usd';
    unit_amount: number;
    tax_behavior: 'exclusive';
    // Stripe API: the tax code belongs on product_data (it becomes the
    // Product's tax code) — tax_code is NOT a price_data parameter and
    // Stripe rejects the session when it is sent there (found by the
    // 2026-10-22 live E2E test order).
    product_data: { name: string; tax_code: string };
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
      tax_behavior: 'exclusive',
      product_data: { name: line.title, tax_code: STRIPE_TAX_CODE_GENERAL },
    },
  }));
  if (record.bundle) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: record.bundle.price_cents,
        tax_behavior: 'exclusive',
        product_data: {
          name: 'The Alchemy Soap Collection (5 soaps)',
          tax_code: STRIPE_TAX_CODE_GENERAL,
        },
      },
    });
  }
  // NOTE: shipping is deliberately NOT a line item — it is charged via
  // shipping_options (below) so Stripe Tax treats it as a delivery
  // charge and the session total composition stays verifiable.
  return lineItems;
}

/**
 * The single shipping option offered in the session, matching the
 * order record exactly: FREE (0¢, 'Free shipping') when the record
 * ships free, otherwise the record's flat charge ('Standard shipping').
 */
export function buildShippingOptions(record: OrderRecord) {
  return [
    {
      shipping_rate_data: {
        type: 'fixed_amount' as const,
        fixed_amount: { amount: record.shipping_cents, currency: 'usd' },
        display_name:
          record.shipping_cents === 0 ? 'Free shipping' : 'Standard shipping',
      },
    },
  ];
}

/**
 * The PRE-TAX total the session must charge, recomputed from the
 * record: line items − subscriber discount + shipping. Stripe Tax adds
 * tax on top of this inside the session; the webhook verifies
 * amount_total == this figure + the reported tax.
 */
export function expectedSessionTotalCents(record: OrderRecord): number {
  const lines = buildSessionLineItems(record).reduce(
    (sum, item) => sum + item.price_data.unit_amount * item.quantity,
    0,
  );
  return lines - record.subscriber_discount_cents + record.shipping_cents;
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
    // Stripe Tax (owner decision 2026-10-20): tax is calculated from
    // the collected US shipping address; requires Stripe Tax to be
    // activated in the Stripe Dashboard (with a tax registration) or
    // session creation fails — see the go-live checklist.
    automatic_tax: { enabled: true },
    shipping_address_collection: { allowed_countries: ['US'] },
    shipping_options: buildShippingOptions(record),
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
  /**
   * The Stripe charge id, when the session event carried one
   * (latest_charge / charge). Optional: sessions usually expose only
   * the payment intent, which is the primary refund/dispute linkage.
   */
  charge_id?: string | null;
  /**
   * The Stripe event id (evt_…) of the checkout.session.completed
   * delivery that recorded this payment (Stage 1, audit G-7).
   * Optional for backward compatibility with records written before
   * event ids were stored.
   */
  stripe_event_id?: string;
  /** Full amount Stripe charged: order total (pre-tax) + tax. */
  amount_total_cents: number;
  /** The Stripe Tax portion of the charge (session total_details.amount_tax). */
  tax_cents: number;
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

function isStripePaymentRecord(v: unknown): v is StripePaymentRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.order_id === 'string' && typeof r.stripe_session_id === 'string';
}

async function readStripePayments(): Promise<StripePaymentRecord[]> {
  if (postgresEnabled()) {
    const events = await readStreamEvents<StripePaymentRecord>(
      EVENT_STREAMS.stripePayments,
    );
    const records: StripePaymentRecord[] = [];
    for (const event of events) {
      if (isStripePaymentRecord(event.payload)) records.push(event.payload);
    }
    return records;
  }
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
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isStripePaymentRecord(parsed)) records.push(parsed);
    } catch {
      // skip malformed line — same tolerance as the other ledger readers
    }
  }
  return records;
}

/** Every recorded Stripe payment, in append order (bulk read for admin joins). */
export async function readStripePaymentsAsync(): Promise<StripePaymentRecord[]> {
  return readStripePayments();
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
 * The payment record carrying a payment_intent id, or null. This is
 * the linkage the refund/dispute webhook handlers resolve through:
 * charge.refunded and charge.dispute.created carry the charge's
 * payment_intent, which was recorded here at payment time.
 */
export async function findStripePaymentByPaymentIntent(
  paymentIntentId: string,
): Promise<StripePaymentRecord | null> {
  if (!paymentIntentId) return null;
  const records = await readStripePayments();
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].payment_intent_id === paymentIntentId) return records[i];
  }
  return null;
}

/** The payment record carrying a charge id, or null (see above). */
export async function findStripePaymentByChargeId(
  chargeId: string,
): Promise<StripePaymentRecord | null> {
  if (!chargeId) return null;
  const records = await readStripePayments();
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].charge_id && records[i].charge_id === chargeId) {
      return records[i];
    }
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
  if (postgresEnabled()) {
    await appendEvent(
      EVENT_STREAMS.stripePayments,
      record.order_id,
      'stripe_payment.recorded',
      record,
      record.paid_at,
    );
    return record;
  }
  const path = defaultStripePaymentsLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

/** Display status for an order: webhook-paid wins over the stored status. */
export function resolveOrderStatus(
  record: OrderRecord,
  payment: StripePaymentRecord | null,
): OrderStatus {
  if (payment) return 'paid';
  return record.status ?? 'pending_payment';
}

/* ------------------------------------------------------------------ */
/* Webhook event ledger — idempotency by Stripe event id (G-7)          */
/* ------------------------------------------------------------------ */

export interface StripeWebhookEventRecord {
  /** Stripe event id (evt_…) — the idempotency key. */
  stripe_event_id: string;
  event_type: string;
  /** The order the event resolved to, when it bound one. */
  order_id: string | null;
  /**
   * What processing did: 'marked_paid' | 'already_paid' |
   * 'status_refunded' | 'status_disputed' | 'acknowledged' (verified
   * but no state change — unknown types, payment_intent.succeeded,
   * unresolvable refund/dispute linkage).
   */
  outcome: string;
  recorded_at: string;
  /** Event livemode when Stripe sent it (Stage 3, audit G-9 log-only). */
  livemode?: boolean | null;
}

export function defaultStripeWebhookEventsLedgerPath(): string {
  return (
    process.env.STRIPE_WEBHOOK_EVENTS_LEDGER_PATH ??
    join(process.cwd(), '.stripe-webhook-events.jsonl')
  );
}

function isWebhookEventRecord(v: unknown): v is StripeWebhookEventRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.stripe_event_id === 'string' &&
    typeof r.event_type === 'string' &&
    typeof r.recorded_at === 'string'
  );
}

export async function readStripeWebhookEvents(): Promise<
  StripeWebhookEventRecord[]
> {
  if (postgresEnabled()) {
    const events = await readStreamEvents<StripeWebhookEventRecord>(
      EVENT_STREAMS.stripeEvents,
    );
    const records: StripeWebhookEventRecord[] = [];
    for (const event of events) {
      if (isWebhookEventRecord(event.payload)) records.push(event.payload);
    }
    return records;
  }
  let raw: string;
  try {
    raw = await readFile(defaultStripeWebhookEventsLedgerPath(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const records: StripeWebhookEventRecord[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isWebhookEventRecord(parsed)) records.push(parsed);
    } catch {
      // skip malformed line — same tolerance as the other ledger readers
    }
  }
  return records;
}

/** The recorded outcome for a Stripe event id, or null if never processed. */
export async function findStripeWebhookEvent(
  eventId: string,
): Promise<StripeWebhookEventRecord | null> {
  if (!eventId) return null;
  const records = await readStripeWebhookEvents();
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].stripe_event_id === eventId) return records[i];
  }
  return null;
}

/** True when this Stripe event id was already successfully processed. */
export async function hasProcessedStripeEvent(eventId: string): Promise<boolean> {
  return (await findStripeWebhookEvent(eventId)) !== null;
}

/**
 * Record one successfully processed webhook event. Idempotent by
 * event id: an already-recorded id is returned as-is, never
 * double-recorded. Failed processing (the route answers 400) is
 * deliberately NOT recorded, so Stripe's redelivery is processed —
 * and fails loudly — again instead of being swallowed as a duplicate.
 */
export async function recordStripeWebhookEvent(
  record: StripeWebhookEventRecord,
): Promise<StripeWebhookEventRecord> {
  const existing = await findStripeWebhookEvent(record.stripe_event_id);
  if (existing) return existing;
  if (postgresEnabled()) {
    await appendEvent(
      EVENT_STREAMS.stripeEvents,
      record.stripe_event_id,
      'stripe_event.processed',
      record,
      record.recorded_at,
    );
    return record;
  }
  const path = defaultStripeWebhookEventsLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

/* ------------------------------------------------------------------ */
/* Order-status ledger — refund / dispute transitions (G-4)             */
/* ------------------------------------------------------------------ */

export type StripeOrderStatus = 'refunded' | 'disputed';

export interface StripeOrderStatusEvent {
  order_id: string;
  status: StripeOrderStatus;
  /** Stripe event id (evt_…) of the delivery that caused the transition. */
  stripe_event_id: string;
  charge_id: string | null;
  payment_intent_id: string | null;
  recorded_at: string;
  source: 'stripe_webhook';
}

export function defaultStripeOrderStatusLedgerPath(): string {
  return (
    process.env.STRIPE_ORDER_STATUS_LEDGER_PATH ??
    join(process.cwd(), '.stripe-order-status.jsonl')
  );
}

function isOrderStatusEvent(v: unknown): v is StripeOrderStatusEvent {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.order_id === 'string' &&
    (r.status === 'refunded' || r.status === 'disputed') &&
    typeof r.recorded_at === 'string'
  );
}

export async function readStripeOrderStatusEvents(): Promise<
  StripeOrderStatusEvent[]
> {
  if (postgresEnabled()) {
    const events = await readStreamEvents<StripeOrderStatusEvent>(
      EVENT_STREAMS.stripeOrderStatus,
    );
    const records: StripeOrderStatusEvent[] = [];
    for (const event of events) {
      if (isOrderStatusEvent(event.payload)) records.push(event.payload);
    }
    return records;
  }
  let raw: string;
  try {
    raw = await readFile(defaultStripeOrderStatusLedgerPath(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const records: StripeOrderStatusEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isOrderStatusEvent(parsed)) records.push(parsed);
    } catch {
      // skip malformed line — same tolerance as the other ledger readers
    }
  }
  return records;
}

/** The latest refund/dispute transition for an order, or null. */
export async function findLatestStripeOrderStatus(
  orderId: string,
): Promise<StripeOrderStatusEvent | null> {
  const records = await readStripeOrderStatusEvents();
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].order_id === orderId) return records[i];
  }
  return null;
}

/**
 * Append one refund/dispute transition. Append-only, latest-wins —
 * mirroring the payment ledgers; history is never edited.
 */
export async function recordStripeOrderStatus(
  event: StripeOrderStatusEvent,
): Promise<StripeOrderStatusEvent> {
  if (postgresEnabled()) {
    await appendEvent(
      EVENT_STREAMS.stripeOrderStatus,
      event.order_id,
      `stripe_order.${event.status}`,
      event,
      event.recorded_at,
    );
    return event;
  }
  const path = defaultStripeOrderStatusLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(event)}\n`, 'utf8');
  return event;
}
