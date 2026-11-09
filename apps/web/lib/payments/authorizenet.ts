/**
 * Authorize.net hosted card checkout — server side (owner decisions
 * 2026-10-29: Authorize.net All-in-One, TSYS (Vital) platform, is the
 * settled card rail; build direction 2026-10-28: Stripe-like automated
 * experience, but the card charge runs through Authorize.net's HOSTED
 * payment form and webhooks drive the automation).
 *
 * Money-path laws (mirroring lib/payments/stripe.ts):
 * - The order is created FIRST by the server-authoritative checkout
 *   (lib/checkout/order) and persisted UNPAID with payment_method
 *   'authorizenet_card_hosted'. Only then is a hosted-form token
 *   created, from the SERVER-computed order record — client amounts
 *   never reach Authorize.net. The browser POSTs the token to
 *   Authorize.net's hosted page; the card is entered THERE, never on
 *   this site (SAQ-A posture).
 * - The amount sent for a shop order is the order record's
 *   total_cents EXACTLY (card checkout build 2026-11-09, adapted to
 *   current main a9f8fba7: since the 2026-11-01 tax build, total_cents
 *   on this tree is TAX-INCLUSIVE — sales tax computed from the
 *   customer's delivery address by lib/tax is already inside it; the
 *   Oct 29 unified build's "total PLUS tax" law applied to its older
 *   pre-tax-total tree and must NOT be applied here or tax would be
 *   charged twice. See buildOrderHostedPaymentInput.) SCOPE LIMIT
 *   (2026-11-09): this module serves SHOP ORDERS ONLY in this build.
 *   The Grimoire subscription / $8.88 unlock Authorize.net wiring of
 *   the unified build is deliberately NOT ported (membership-model
 *   decisions are still pending with the owner); the generic client
 *   surface below is retained only where the shop flow uses it.
 *   The hosted transaction carries invoiceNumber = order_id (Authorize
 *   invoice numbers cap at 20 chars; order ids are 19) so the verified
 *   webhook can resolve the order.
 * - An order is marked paid ONLY here, from a signature-verified
 *   webhook event (X-ANET-Signature = HMAC-SHA512 of the raw body,
 *   keyed by the Signature Key) whose transaction amount equals the
 *   persisted order total. The browser return page is display-only.
 * - Everything is dual-gated (unified build, porting the Oct 28
 *   build's flag law onto this module): the card option reports
 *   itself available ONLY when CARD_PAYMENTS_ENABLED is exactly
 *   'true' AND AUTHORIZENET_API_LOGIN_ID + AUTHORIZENET_TRANSACTION_KEY
 *   are present (fail closed, the site's not_configured pattern);
 *   otherwise the rest of checkout works untouched. Webhook handling
 *   additionally requires the flag AND AUTHORIZENET_SIGNATURE_KEY.
 * - Bookipi invoice / Cash App / Venmo rails are untouched: this ADDS
 *   a method; it never replaces one.
 *
 * Ledgers (same append-only pattern + driver selection as the Stripe
 * rail): payments ('authorizenet_payments' stream / local JSONL),
 * webhook events by notification id (idempotency), and order-status
 * transitions ('refunded' | 'cancelled' | 'fraud_hold' |
 * 'fraud_released') joined at read time by lib/orders/paid-state.ts.
 *
 * SERVER-ONLY: uses node:fs / pg. Never import from a client component.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { OrderRecord } from '../checkout/order';
import {
  EVENT_STREAMS,
  appendEvent,
  postgresEnabled,
  readStreamEvents,
} from '../events/event-store';

/* ------------------------------------------------------------------ */
/* Configuration (env-gated)                                            */
/* ------------------------------------------------------------------ */

export type AuthorizeNetEnvironment = 'sandbox' | 'production';

export interface AuthorizeNetConfig {
  apiLoginId?: string;
  transactionKey?: string;
  signatureKey?: string;
  environment: AuthorizeNetEnvironment;
  webhookUrl?: string;
  /** CARD_PAYMENTS_ENABLED is exactly 'true' (the owner's flip switch). */
  flagEnabled: boolean;
  /**
   * Flag on AND API Login ID + Transaction Key present → the card
   * option can be offered (BOTH gates, unified build).
   */
  cardAvailable: boolean;
  /** Flag on AND Signature Key present → the webhook can verify deliveries. */
  webhookConfigured: boolean;
  /** JSON API host for this environment. */
  apiHost: string;
  /** Hosted payment form POST URL for this environment. */
  hostedPaymentUrl: string;
}

export function getAuthorizeNetConfig(
  env: Record<string, string | undefined> = process.env,
): AuthorizeNetConfig {
  const apiLoginId = env.AUTHORIZENET_API_LOGIN_ID?.trim() || undefined;
  const transactionKey = env.AUTHORIZENET_TRANSACTION_KEY?.trim() || undefined;
  const signatureKey = env.AUTHORIZENET_SIGNATURE_KEY?.trim() || undefined;
  const environment: AuthorizeNetEnvironment =
    env.AUTHORIZENET_ENV?.trim().toLowerCase() === 'production'
      ? 'production'
      : 'sandbox';
  const webhookUrl = env.AUTHORIZENET_WEBHOOK_URL?.trim() || undefined;
  const production = environment === 'production';
  // The flag gate (Oct 28 build's law): exactly 'true' — an unset,
  // misspelled, or '1' value keeps every Authorize.net surface dark.
  const flagEnabled = env.CARD_PAYMENTS_ENABLED?.trim() === 'true';
  return {
    apiLoginId,
    transactionKey,
    signatureKey,
    environment,
    webhookUrl,
    flagEnabled,
    cardAvailable: Boolean(flagEnabled && apiLoginId && transactionKey),
    webhookConfigured: Boolean(flagEnabled && signatureKey),
    apiHost: production ? 'api.authorize.net' : 'apitest.authorize.net',
    hostedPaymentUrl: production
      ? 'https://accept.authorize.net/payment/payment'
      : 'https://test.authorize.net/payment/payment',
  };
}

/* ------------------------------------------------------------------ */
/* Hosted token input — from the SERVER order record only               */
/* ------------------------------------------------------------------ */

/**
 * The hosted-payment request for a persisted shop order (ported from
 * the Oct 28 build's buildOrderHostedPaymentInput, adapted to this
 * module's request shape and the Oct 29 routes' return URLs): the
 * amount is the order record's server-computed total PLUS the sales
 * tax recorded on it (owner decision 2026-10-28 — tax from the
 * shipping address, lib/tax; total_cents stays pre-tax), the invoice
 * number IS the order id (the webhook's resolution key), and the
 * customer returns to the display-only /checkout/return page. The
 * record is verified for internal consistency exactly like the
 * Oct 28 builder — a mismatched record is refused, never charged,
 * and a record whose tax fields disagree with each other is refused
 * too. (Records with NO tax fields charge the bare total here; the
 * ROUTES refuse to mint for those while the card path is live, and
 * the webhook fails loudly on them.)
 */
export function buildOrderHostedPaymentInput(
  record: OrderRecord,
  origin: string,
): HostedPaymentPageRequest {
  const linesTotal =
    record.items.reduce(
      (sum, line) => sum + line.unit_price_cents * line.quantity,
      0,
    ) + (record.bundle ? record.bundle.price_cents : 0);
  // Current-main law (2026-11-01): total_cents is TAX-INCLUSIVE —
  // lines - discounts + shipping + recorded tax must equal it exactly.
  const expected =
    linesTotal -
    record.subscriber_discount_cents -
    (record.coupon_discount_cents ?? 0) +
    record.shipping_cents +
    (record.tax_cents ?? 0);
  if (expected !== record.total_cents) {
    throw new Error(
      `Order ${record.order_id} totals are internally inconsistent — refusing to create a payment token.`,
    );
  }
  const taxCents = record.tax_cents ?? 0;
  if (record.tax_breakdown && record.tax_breakdown.taxCents !== taxCents) {
    throw new Error(
      `Order ${record.order_id} tax fields are internally inconsistent — refusing to create a payment token.`,
    );
  }
  const nameParts = record.customer.name.trim().split(/\s+/);
  // Ship-to prefill comes from the order's delivery (tax) address —
  // the TaxAddress the current checkout collects for every order —
  // when present. (The unified build read its older shipping_address
  // shape; on current main that field is the Phase-2 fulfillment
  // address with a different shape, so it is not used here.)
  const addr = record.delivery_address;
  return {
    amountCents: record.total_cents,
    // Idempotency key for charge creation: the invoice number IS the
    // order id — deterministic per order, so a double-submit /
    // double-click can only ever mint hosted tokens for the SAME
    // single order and amount; the webhook's notification claim
    // (claimAuthorizeNetEvent) then guarantees the order is marked
    // paid at most once. There is no second order to charge.
    invoiceNumber: record.order_id,
    description: `AwakenAgain order ${record.order_id}`,
    customerEmail: record.customer.email,
    returnUrl:
      `${origin}/checkout/return?authorizenet=1` +
      `&order_id=${encodeURIComponent(record.order_id)}`,
    cancelUrl:
      `${origin}/checkout/return?authorizenet=cancelled` +
      `&order_id=${encodeURIComponent(record.order_id)}`,
    ...(record.tax_breakdown && taxCents > 0
      ? {
          taxCents,
          taxDescription: `Sales tax — ${record.tax_breakdown.jurisdiction}`,
        }
      : {}),
    ...(addr
      ? {
          shipTo: {
            firstName: nameParts[0] ?? '',
            lastName: nameParts.slice(1).join(' '),
            address: addr.line2 ? `${addr.line1}, ${addr.line2}` : addr.line1,
            city: addr.city,
            state: addr.state,
            zip: addr.postalCode,
            country: addr.country,
          },
        }
      : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Client (structural interface so tests can inject a fake)             */
/* ------------------------------------------------------------------ */

export interface HostedPaymentPageRequest {
  /** Charge amount in cents — always the server order total. */
  amountCents: number;
  /** Linkage value carried on the transaction (order id / SUB-… / UNL-…). */
  invoiceNumber: string;
  /** Short description shown on the hosted form (no marketing claims). */
  description?: string;
  customerEmail?: string;
  returnUrl: string;
  cancelUrl: string;
  /** Ask the hosted form to create a CIM customer profile (ARB subscribe). */
  createCustomerProfile?: boolean;
  /**
   * Sales tax included in amountCents, when the server computed it
   * (shop orders — lib/tax via the order record's tax breakdown).
   * Sent to the gateway as its own tax line so the hosted page shows
   * the tax portion of the charge. Absent for the Grimoire flows,
   * which charge their canonical prices untaxed.
   */
  taxCents?: number;
  /** Short label for the gateway tax line (e.g. the jurisdiction). */
  taxDescription?: string;
  /** Shipping address to prefill on the hosted page (shop orders). */
  shipTo?: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface AuthorizeNetTransactionDetails {
  transId: string;
  /** 1 = approved, 2 = declined, 3 = error, 4 = held for review. */
  responseCode: number | null;
  /** The amount Authorize.net actually authorized, in cents. */
  authAmountCents: number | null;
  invoiceNumber: string | null;
  customerEmail: string | null;
  customerProfileId: string | null;
  customerPaymentProfileId: string | null;
  /** Set when the transaction belongs to an ARB subscription. */
  subscriptionId: string | null;
  subscriptionPayNum: number | null;
  /** For refund/void transactions: the original transaction they act on. */
  refTransId: string | null;
}

export interface CreateSubscriptionRequest {
  customerProfileId: string;
  customerPaymentProfileId: string;
  /** Monthly amount in cents (the canonical Grimoire price). */
  amountCents: number;
  /** ISO date (YYYY-MM-DD) of the first ARB charge. */
  startDate: string;
  invoiceNumber: string;
  customerEmail?: string;
}

export interface AuthorizeNetClientLike {
  getHostedPaymentPage(
    request: HostedPaymentPageRequest,
  ): Promise<{ token: string }>;
  getTransactionDetails(
    transId: string,
  ): Promise<AuthorizeNetTransactionDetails>;
  createSubscription(
    request: CreateSubscriptionRequest,
  ): Promise<{ subscriptionId: string }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
}

/** Format cents as the decimal string the Authorize.net API expects. */
export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

/**
 * Build the getHostedPaymentPageRequest body from a server record.
 * Pure — exported for tests. The transaction is authCapture; the
 * hosted settings hide Authorize.net's own receipt (the site shows
 * its own confirmation) and wire the return/cancel URLs.
 */
export function buildHostedPaymentPageBody(
  config: AuthorizeNetConfig,
  request: HostedPaymentPageRequest,
): Record<string, unknown> {
  return {
    getHostedPaymentPageRequest: {
      merchantAuthentication: {
        name: config.apiLoginId,
        transactionKey: config.transactionKey,
      },
      transactionRequest: {
        transactionType: 'authCaptureTransaction',
        amount: centsToDecimal(request.amountCents),
        order: {
          invoiceNumber: request.invoiceNumber,
          ...(request.description
            ? { description: request.description }
            : {}),
        },
        ...(request.taxCents !== undefined && request.taxCents > 0
          ? {
              tax: {
                amount: centsToDecimal(request.taxCents),
                name: 'Sales tax',
                description: request.taxDescription ?? 'Sales tax',
              },
            }
          : {}),
        ...(request.customerEmail
          ? { customer: { email: request.customerEmail } }
          : {}),
        ...(request.shipTo ? { shipTo: request.shipTo } : {}),
        ...(request.createCustomerProfile
          ? {
              profile: { createProfile: true },
            }
          : {}),
      },
      hostedPaymentSettings: {
        setting: [
          {
            settingName: 'hostedPaymentReturnOptions',
            settingValue: JSON.stringify({
              showReceipt: false,
              url: request.returnUrl,
              cancelUrl: request.cancelUrl,
            }),
          },
          {
            settingName: 'hostedPaymentCustomerOptions',
            settingValue: JSON.stringify({
              showEmail: false,
              addPaymentProfile: Boolean(request.createCustomerProfile),
            }),
          },
        ],
      },
    },
  };
}

function parseTransactionDetails(raw: unknown): AuthorizeNetTransactionDetails {
  const root = asRecord(raw);
  const response = asRecord(root?.getTransactionDetailsResponse);
  const transaction = asRecord(response?.transaction);
  if (!transaction) {
    throw new Error('Authorize.net returned no transaction details.');
  }
  const order = asRecord(transaction.order);
  const customer = asRecord(transaction.customer);
  const profile = asRecord(transaction.profile);
  const subscription = asRecord(transaction.subscription);
  const authAmount = transaction.authAmount;
  const authAmountCents =
    typeof authAmount === 'number'
      ? Math.round(authAmount * 100)
      : typeof authAmount === 'string' && authAmount.trim()
        ? Math.round(Number(authAmount) * 100)
        : null;
  const responseCodeRaw = transaction.responseCode;
  return {
    transId: asString(transaction.transId) ?? '',
    responseCode:
      typeof responseCodeRaw === 'number'
        ? responseCodeRaw
        : typeof responseCodeRaw === 'string'
          ? Number(responseCodeRaw) || null
          : null,
    authAmountCents:
      authAmountCents !== null && Number.isFinite(authAmountCents)
        ? authAmountCents
        : null,
    invoiceNumber: asString(order?.invoiceNumber),
    customerEmail: asString(customer?.email),
    customerProfileId: asString(profile?.customerProfileId),
    customerPaymentProfileId: asString(profile?.customerPaymentProfileId),
    subscriptionId: subscription ? asString(subscription.id) : null,
    subscriptionPayNum:
      subscription && typeof subscription.payNum === 'number'
        ? subscription.payNum
        : null,
    refTransId: asString(transaction.refTransId),
  };
}

async function postToGateway(
  config: AuthorizeNetConfig,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const res = await fetchImpl(`https://${config.apiHost}/xml/v1/request.api`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Authorize.net API HTTP ${res.status}.`);
  }
  // The JSON API prefixes responses with a BOM — strip before parsing.
  const text = (await res.text()).replace(/^\uFEFF/, '');
  return JSON.parse(text) as unknown;
}

function gatewayResultCode(raw: unknown): string | null {
  const messages = asRecord(asRecord(raw)?.messages);
  return asString(messages?.resultCode);
}

function gatewayErrorText(raw: unknown): string {
  const messages = asRecord(asRecord(raw)?.messages);
  const list = messages?.message;
  if (Array.isArray(list) && list.length > 0) {
    const first = asRecord(list[0]);
    return asString(first?.text) ?? 'unknown gateway error';
  }
  return 'unknown gateway error';
}

/** Real client when the API credentials are configured; otherwise null. */
export function createAuthorizeNetClient(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): AuthorizeNetClientLike | null {
  const config = getAuthorizeNetConfig(env);
  if (!config.cardAvailable) return null;
  const auth = {
    name: config.apiLoginId,
    transactionKey: config.transactionKey,
  };
  return {
    async getHostedPaymentPage(request) {
      const body = buildHostedPaymentPageBody(config, request);
      const raw = await postToGateway(config, body, fetchImpl);
      const token = asString(
        asRecord(asRecord(raw)?.getHostedPaymentPageResponse)?.token,
      );
      if (gatewayResultCode(raw) !== 'Ok' || !token) {
        throw new Error(
          `Authorize.net hosted page request failed: ${gatewayErrorText(raw)}`,
        );
      }
      return { token };
    },
    async getTransactionDetails(transId) {
      const raw = await postToGateway(
        config,
        {
          getTransactionDetailsRequest: {
            merchantAuthentication: auth,
            transId,
          },
        },
        fetchImpl,
      );
      if (gatewayResultCode(raw) !== 'Ok') {
        throw new Error(
          `Authorize.net transaction lookup failed: ${gatewayErrorText(raw)}`,
        );
      }
      return parseTransactionDetails(raw);
    },
    async createSubscription(request) {
      const raw = await postToGateway(
        config,
        {
          ARBCreateSubscriptionRequest: {
            merchantAuthentication: auth,
            subscription: {
              name: 'Living Grimoire',
              paymentSchedule: {
                interval: { length: 1, unit: 'months' },
                startDate: request.startDate,
                totalOccurrences: 9999,
              },
              amount: centsToDecimal(request.amountCents),
              order: { invoiceNumber: request.invoiceNumber },
              profile: {
                customerProfileId: request.customerProfileId,
                customerPaymentProfileId: request.customerPaymentProfileId,
              },
            },
          },
        },
        fetchImpl,
      );
      const subscriptionId = asString(
        asRecord(asRecord(raw)?.ARBCreateSubscriptionResponse)
          ?.subscriptionId,
      );
      if (gatewayResultCode(raw) !== 'Ok' || !subscriptionId) {
        throw new Error(
          `Authorize.net subscription creation failed: ${gatewayErrorText(raw)}`,
        );
      }
      return { subscriptionId };
    },
    async cancelSubscription(subscriptionId) {
      const raw = await postToGateway(
        config,
        {
          ARBCancelSubscriptionRequest: {
            merchantAuthentication: auth,
            subscriptionId,
          },
        },
        fetchImpl,
      );
      if (gatewayResultCode(raw) !== 'Ok') {
        throw new Error(
          `Authorize.net subscription cancel failed: ${gatewayErrorText(raw)}`,
        );
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Webhook verification + parsing                                       */
/* ------------------------------------------------------------------ */

/**
 * Verify an Authorize.net webhook delivery: the X-ANET-Signature
 * header is `sha512=<hex>` — HMAC-SHA512 of the RAW request body,
 * keyed by the Signature Key (the Merchant Interface key is hex; it
 * is converted to binary before use). Constant-time comparison.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  signatureKeyHex: string | undefined,
): boolean {
  if (!signatureHeader || !signatureKeyHex) return false;
  const match = /^sha512=([0-9a-fA-F]+)$/.exec(signatureHeader.trim());
  if (!match) return false;
  let key: Buffer;
  try {
    key = Buffer.from(signatureKeyHex.trim(), 'hex');
  } catch {
    return false;
  }
  if (key.length === 0) return false;
  const expected = createHmac('sha512', key).update(rawBody, 'utf8').digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(match[1], 'hex');
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export interface AuthorizeNetWebhookEvent {
  notificationId: string;
  eventType: string;
  eventDate: string | null;
  entityName: string | null;
  /** transId / subscriptionId / customerProfileId, by entity. */
  entityId: string;
  payload: Record<string, unknown>;
}

export function parseWebhookEvent(rawBody: string): AuthorizeNetWebhookEvent {
  const parsed: unknown = JSON.parse(rawBody);
  const root = asRecord(parsed);
  if (!root) throw new Error('Webhook body must be a JSON object.');
  const payload = asRecord(root.payload) ?? {};
  const notificationId = asString(root.notificationId);
  const eventType = asString(root.eventType);
  const entityId = asString(payload.id);
  if (!notificationId || !eventType || !entityId) {
    throw new Error('Webhook body is missing notificationId, eventType, or payload.id.');
  }
  return {
    notificationId,
    eventType,
    eventDate: asString(root.eventDate),
    entityName: asString(payload.entityName),
    entityId,
    payload,
  };
}

/* ------------------------------------------------------------------ */
/* Paid ledger — written ONLY by the signature-verified webhook         */
/* ------------------------------------------------------------------ */

export interface AuthorizeNetPaymentRecord {
  order_id: string;
  /** Authorize.net transaction id — the refund/void linkage. */
  trans_id: string;
  /** Webhook notification id of the delivery that recorded this. */
  notification_id?: string;
  /** Amount Authorize.net actually authorized, in cents. */
  amount_cents: number;
  currency: 'USD';
  paid_at: string;
  source: 'authorizenet_webhook';
}

export function defaultAuthorizeNetPaymentsLedgerPath(): string {
  return (
    process.env.AUTHORIZENET_PAYMENTS_LEDGER_PATH ??
    join(process.cwd(), '.authorizenet-payments.jsonl')
  );
}

function isPaymentRecord(v: unknown): v is AuthorizeNetPaymentRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.order_id === 'string' && typeof r.trans_id === 'string';
}

async function readPayments(): Promise<AuthorizeNetPaymentRecord[]> {
  if (postgresEnabled()) {
    const events = await readStreamEvents<AuthorizeNetPaymentRecord>(
      EVENT_STREAMS.authorizenetPayments,
    );
    const records: AuthorizeNetPaymentRecord[] = [];
    for (const event of events) {
      if (isPaymentRecord(event.payload)) records.push(event.payload);
    }
    return records;
  }
  let raw: string;
  try {
    raw = await readFile(defaultAuthorizeNetPaymentsLedgerPath(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const records: AuthorizeNetPaymentRecord[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isPaymentRecord(parsed)) records.push(parsed);
    } catch {
      // skip malformed line — same tolerance as the other ledger readers
    }
  }
  return records;
}

export async function readAuthorizeNetPayments(): Promise<
  AuthorizeNetPaymentRecord[]
> {
  return readPayments();
}

export async function findAuthorizeNetPayment(
  orderId: string,
): Promise<AuthorizeNetPaymentRecord | null> {
  const records = await readPayments();
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].order_id === orderId) return records[i];
  }
  return null;
}

/** The payment record carrying a transaction id (refund/void linkage). */
export async function findAuthorizeNetPaymentByTransId(
  transId: string,
): Promise<AuthorizeNetPaymentRecord | null> {
  if (!transId) return null;
  const records = await readPayments();
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].trans_id === transId) return records[i];
  }
  return null;
}

/** Mark an order paid from a verified webhook event. Idempotent by order. */
export async function recordAuthorizeNetPayment(
  record: AuthorizeNetPaymentRecord,
): Promise<AuthorizeNetPaymentRecord> {
  const existing = await findAuthorizeNetPayment(record.order_id);
  if (existing) return existing;
  if (postgresEnabled()) {
    await appendEvent(
      EVENT_STREAMS.authorizenetPayments,
      record.order_id,
      'authorizenet_payment.recorded',
      record,
      record.paid_at,
    );
    return record;
  }
  const path = defaultAuthorizeNetPaymentsLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

/* ------------------------------------------------------------------ */
/* Webhook event ledger — idempotency by notification id                */
/* ------------------------------------------------------------------ */

export type AuthorizeNetWebhookEventStatus =
  | 'processing'
  | 'processed'
  | 'failed';

export interface AuthorizeNetWebhookEventRecord {
  notification_id: string;
  event_type: string;
  order_id: string | null;
  /** ARB subscription id the event concerned, when applicable. */
  subscription_id?: string | null;
  /** Processing outcome label (see the webhook route). */
  outcome: string;
  recorded_at: string;
  /**
   * Claim lifecycle (Phase B2, Gate 2): a delivery is CLAIMED
   * (status 'processing', with a unique claim_id) BEFORE any side
   * effect runs; the claim resolves to 'processed' on success or
   * 'failed' on a processing error. Records written before the
   * claim mechanism carry no status and are treated as 'processed'
   * (they were only ever written after successful processing).
   */
  status?: AuthorizeNetWebhookEventStatus;
  /** Unique id of the claim attempt this record belongs to. */
  claim_id?: string | null;
  /** When the claim attempt started (ISO). */
  claimed_at?: string | null;
}

export function defaultAuthorizeNetWebhookEventsLedgerPath(): string {
  return (
    process.env.AUTHORIZENET_WEBHOOK_EVENTS_LEDGER_PATH ??
    join(process.cwd(), '.authorizenet-webhook-events.jsonl')
  );
}

function isWebhookEventRecord(
  v: unknown,
): v is AuthorizeNetWebhookEventRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.notification_id === 'string' &&
    typeof r.event_type === 'string' &&
    typeof r.recorded_at === 'string'
  );
}

export async function readAuthorizeNetWebhookEvents(): Promise<
  AuthorizeNetWebhookEventRecord[]
> {
  if (postgresEnabled()) {
    const events = await readStreamEvents<AuthorizeNetWebhookEventRecord>(
      EVENT_STREAMS.authorizenetEvents,
    );
    const records: AuthorizeNetWebhookEventRecord[] = [];
    for (const event of events) {
      if (isWebhookEventRecord(event.payload)) records.push(event.payload);
    }
    return records;
  }
  let raw: string;
  try {
    raw = await readFile(
      defaultAuthorizeNetWebhookEventsLedgerPath(),
      'utf8',
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const records: AuthorizeNetWebhookEventRecord[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isWebhookEventRecord(parsed)) records.push(parsed);
    } catch {
      // skip malformed line
    }
  }
  return records;
}

/** The effective claim status of one ledger record (legacy = processed). */
function webhookEventRecordStatus(
  record: AuthorizeNetWebhookEventRecord,
): AuthorizeNetWebhookEventStatus {
  return record.status ?? 'processed';
}

/** The record that proves a notification was fully processed, if any. */
export function processedAuthorizeNetEventRecord(
  records: AuthorizeNetWebhookEventRecord[],
  notificationId: string,
): AuthorizeNetWebhookEventRecord | null {
  for (const record of records) {
    if (
      record.notification_id === notificationId &&
      webhookEventRecordStatus(record) === 'processed'
    ) {
      return record;
    }
  }
  return null;
}

export async function hasProcessedAuthorizeNetEvent(
  notificationId: string,
): Promise<boolean> {
  if (!notificationId) return false;
  const records = await readAuthorizeNetWebhookEvents();
  return processedAuthorizeNetEventRecord(records, notificationId) !== null;
}

/** The processed record for a notification id, or null. */
export async function findProcessedAuthorizeNetEvent(
  notificationId: string,
): Promise<AuthorizeNetWebhookEventRecord | null> {
  if (!notificationId) return null;
  const records = await readAuthorizeNetWebhookEvents();
  return processedAuthorizeNetEventRecord(records, notificationId);
}

async function appendAuthorizeNetWebhookEventRecord(
  record: AuthorizeNetWebhookEventRecord,
  eventType: string,
): Promise<AuthorizeNetWebhookEventRecord> {
  if (postgresEnabled()) {
    await appendEvent(
      EVENT_STREAMS.authorizenetEvents,
      record.notification_id,
      eventType,
      record,
      record.recorded_at,
    );
    return record;
  }
  const path = defaultAuthorizeNetWebhookEventsLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

/**
 * Record one successfully processed webhook event. Idempotent by
 * notification id: an already-processed notification returns its
 * processed record unchanged. When the record carries a claim_id it
 * resolves that claim (a 'processing' record for the same
 * notification does NOT count as existing — it is superseded by
 * this 'processed' record). A direct call with no claim behaves
 * exactly as the pre-claim code did.
 */
export async function recordAuthorizeNetWebhookEvent(
  record: AuthorizeNetWebhookEventRecord,
): Promise<AuthorizeNetWebhookEventRecord> {
  const records = await readAuthorizeNetWebhookEvents();
  const existing = processedAuthorizeNetEventRecord(
    records,
    record.notification_id,
  );
  if (existing) {
    inFlightAuthorizeNetClaims.delete(record.notification_id);
    return existing;
  }
  const stored: AuthorizeNetWebhookEventRecord = {
    ...record,
    status: 'processed',
  };
  await appendAuthorizeNetWebhookEventRecord(
    stored,
    'authorizenet_event.processed',
  );
  inFlightAuthorizeNetClaims.delete(record.notification_id);
  return stored;
}

/* ------------------------------------------------------------------ */
/* Webhook claim — atomic-before-side-effects idempotency (Gate 2)      */
/* ------------------------------------------------------------------ */

/**
 * How long a 'processing' claim is treated as live. A claim older
 * than this with no resolution is presumed crashed (the claiming
 * process died mid-processing) and may be re-claimed by a redelivery.
 * Deliberately longer than any plausible handler run, shorter than
 * Authorize.net's overall redelivery window.
 */
export const AUTHORIZENET_WEBHOOK_CLAIM_STALE_MS = 15 * 60 * 1000;

/**
 * In-process claim reservations. The check-and-set in
 * claimAuthorizeNetEvent runs synchronously (before its first
 * await), which — JavaScript being single-threaded per process —
 * makes it atomic for concurrent deliveries handled by one process.
 * The ledger append-then-reread below covers the cross-process case
 * as strongly as the dual-driver ledger pattern allows (see the
 * B2 report for the residual-risk note: Postgres has no unique
 * constraint on (stream, stream_key) in migration 001, and JSONL
 * has no compare-and-swap; the earliest appended ACTIVE claim in
 * ledger order wins, and every claimant re-reads after appending,
 * so a loser always sees the winner's earlier claim before it runs
 * any side effect).
 */
const inFlightAuthorizeNetClaims = new Map<
  string,
  { claimId: string; claimedAtMs: number }
>();

export type AuthorizeNetEventClaim =
  | {
      kind: 'claimed';
      claimId: string;
      notificationId: string;
      claimedAt: string;
    }
  | {
      kind: 'already_processed';
      record: AuthorizeNetWebhookEventRecord;
    }
  | {
      kind: 'in_flight';
      record: AuthorizeNetWebhookEventRecord | null;
    };

interface ActiveClaimSummary {
  claimKey: string;
  claimId: string | null;
  firstIndex: number;
  latest: AuthorizeNetWebhookEventRecord;
  status: AuthorizeNetWebhookEventStatus;
}

/**
 * Fold a notification's ledger records into its ACTIVE claims: one
 * summary per claim_id (legacy records are their own processed
 * claim), where a claim is active when its LATEST record is
 * 'processed', or 'processing' and still fresh.
 */
function activeAuthorizeNetClaims(
  records: AuthorizeNetWebhookEventRecord[],
  notificationId: string,
  nowMs: number,
  staleMs: number,
): ActiveClaimSummary[] {
  const byClaim = new Map<string, ActiveClaimSummary>();
  records.forEach((record, index) => {
    if (record.notification_id !== notificationId) return;
    const claimKey = record.claim_id ?? `legacy:${index}`;
    const status = webhookEventRecordStatus(record);
    const existing = byClaim.get(claimKey);
    if (existing) {
      existing.latest = record;
      existing.status = status;
    } else {
      byClaim.set(claimKey, {
        claimKey,
        claimId: record.claim_id ?? null,
        firstIndex: index,
        latest: record,
        status,
      });
    }
  });
  return [...byClaim.values()].filter((summary) => {
    if (summary.status === 'processed') return true;
    if (summary.status !== 'processing') return false;
    const claimedMs = Date.parse(
      summary.latest.claimed_at ?? summary.latest.recorded_at,
    );
    return Number.isNaN(claimedMs) || nowMs - claimedMs < staleMs;
  });
}

/**
 * Atomically claim a webhook notification BEFORE any side effect.
 *
 * Outcomes:
 * - 'claimed' — the caller owns the delivery and may process it; it
 *   MUST resolve the claim via recordAuthorizeNetWebhookEvent
 *   (success) or failAuthorizeNetEventClaim (failure, so a gateway
 *   redelivery can re-claim and retry).
 * - 'already_processed' — a prior delivery completed; ack as a
 *   duplicate without side effects.
 * - 'in_flight' — another delivery is processing right now; answer
 *   retryably, never run side effects.
 */
export async function claimAuthorizeNetEvent(
  notificationId: string,
  eventType: string,
  options: { now?: Date; staleMs?: number } = {},
): Promise<AuthorizeNetEventClaim> {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const staleMs = options.staleMs ?? AUTHORIZENET_WEBHOOK_CLAIM_STALE_MS;

  // Synchronous in-process reservation — no await before this point.
  const reserved = inFlightAuthorizeNetClaims.get(notificationId);
  if (reserved && nowMs - reserved.claimedAtMs < staleMs) {
    return { kind: 'in_flight', record: null };
  }
  const claimId = randomUUID();
  const claimedAt = now.toISOString();
  inFlightAuthorizeNetClaims.set(notificationId, {
    claimId,
    claimedAtMs: nowMs,
  });

  try {
    const before = await readAuthorizeNetWebhookEvents();
    const processed = processedAuthorizeNetEventRecord(before, notificationId);
    if (processed) {
      inFlightAuthorizeNetClaims.delete(notificationId);
      return { kind: 'already_processed', record: processed };
    }
    const activeBefore = activeAuthorizeNetClaims(
      before,
      notificationId,
      nowMs,
      staleMs,
    );
    if (activeBefore.length > 0) {
      // Another process holds a fresh claim (or finished between our
      // processed check and here — either way it owns the delivery).
      inFlightAuthorizeNetClaims.delete(notificationId);
      return { kind: 'in_flight', record: activeBefore[0].latest };
    }

    const claimRecord: AuthorizeNetWebhookEventRecord = {
      notification_id: notificationId,
      event_type: eventType,
      order_id: null,
      subscription_id: null,
      outcome: 'processing',
      recorded_at: claimedAt,
      status: 'processing',
      claim_id: claimId,
      claimed_at: claimedAt,
    };
    await appendAuthorizeNetWebhookEventRecord(
      claimRecord,
      'authorizenet_event.claimed',
    );

    // Append-then-reread: ledger append order is the cross-process
    // arbiter. If an earlier ACTIVE claim exists, it wins and this
    // claim aborts (resolving itself 'failed' so it never blocks a
    // later legitimate retry).
    const after = await readAuthorizeNetWebhookEvents();
    const activeAfter = activeAuthorizeNetClaims(
      after,
      notificationId,
      nowMs,
      staleMs,
    );
    const winner = activeAfter.sort((a, b) => a.firstIndex - b.firstIndex)[0];
    if (winner && winner.claimId !== claimId) {
      await appendAuthorizeNetWebhookEventRecord(
        {
          ...claimRecord,
          outcome: 'claim_superseded',
          recorded_at: new Date().toISOString(),
          status: 'failed',
        },
        'authorizenet_event.claim_superseded',
      );
      inFlightAuthorizeNetClaims.delete(notificationId);
      return winner.status === 'processed'
        ? { kind: 'already_processed', record: winner.latest }
        : { kind: 'in_flight', record: winner.latest };
    }
    return { kind: 'claimed', claimId, notificationId, claimedAt };
  } catch (err) {
    inFlightAuthorizeNetClaims.delete(notificationId);
    throw err;
  }
}

/**
 * Resolve a claim as FAILED after a processing error: appends the
 * failure record for the claim so a gateway redelivery can re-claim
 * and retry (a failed claim never reads as processed). Best-effort
 * by design — the caller rethrows the original processing error
 * either way; a failure here is surfaced by its own throw only when
 * the caller chooses to await it inside its error path.
 */
export async function failAuthorizeNetEventClaim(
  claim: { claimId: string; notificationId: string },
  eventType: string,
): Promise<void> {
  const failedAt = new Date().toISOString();
  await appendAuthorizeNetWebhookEventRecord(
    {
      notification_id: claim.notificationId,
      event_type: eventType,
      order_id: null,
      subscription_id: null,
      outcome: 'processing_failed',
      recorded_at: failedAt,
      status: 'failed',
      claim_id: claim.claimId,
      claimed_at: failedAt,
    },
    'authorizenet_event.processing_failed',
  );
  inFlightAuthorizeNetClaims.delete(claim.notificationId);
}

/* ------------------------------------------------------------------ */
/* ARB creation guard (Gate 2)                                          */
/* ------------------------------------------------------------------ */

/**
 * The "exactly one ARB per subscription record" guard, as a pure
 * helper: the ARB subscription id already bound to a subscription
 * record, or null when none exists yet and one may be created. The
 * webhook's first-payment handler consults the subscription ledger
 * through this before calling createSubscription — a record that
 * already carries an ARB id is NEVER given a second one; the
 * handler re-uses the existing id and lets activation complete.
 */
export function existingArbSubscriptionId(
  record:
    | { authorizenet_subscription_id?: string | null }
    | null
    | undefined,
): string | null {
  const id = record?.authorizenet_subscription_id;
  return typeof id === 'string' && id.trim() ? id : null;
}

/* ------------------------------------------------------------------ */
/* Order-status ledger — refund / void / fraud transitions              */
/* ------------------------------------------------------------------ */

export type AuthorizeNetOrderStatusKind =
  | 'refunded'
  | 'cancelled'
  | 'fraud_hold'
  | 'fraud_released'
  /**
   * A capture for the order was NOT approved (declined / error) —
   * recorded by the webhook (Phase B2, Gate 8) so a failed card
   * payment is distinguishable in admin from one merely pending.
   * NOT terminal: a later approved capture for the order still
   * marks it paid (the payment record supersedes this status).
   */
  | 'payment_declined';

export interface AuthorizeNetOrderStatusEvent {
  order_id: string;
  status: AuthorizeNetOrderStatusKind;
  trans_id: string | null;
  notification_id: string | null;
  recorded_at: string;
  source: 'authorizenet_webhook';
}

export function defaultAuthorizeNetOrderStatusLedgerPath(): string {
  return (
    process.env.AUTHORIZENET_ORDER_STATUS_LEDGER_PATH ??
    join(process.cwd(), '.authorizenet-order-status.jsonl')
  );
}

function isOrderStatusEvent(
  v: unknown,
): v is AuthorizeNetOrderStatusEvent {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.order_id === 'string' &&
    (r.status === 'refunded' ||
      r.status === 'cancelled' ||
      r.status === 'fraud_hold' ||
      r.status === 'fraud_released' ||
      r.status === 'payment_declined')
  );
}

export async function readAuthorizeNetOrderStatusEvents(): Promise<
  AuthorizeNetOrderStatusEvent[]
> {
  if (postgresEnabled()) {
    const events = await readStreamEvents<AuthorizeNetOrderStatusEvent>(
      EVENT_STREAMS.authorizenetOrderStatus,
    );
    const records: AuthorizeNetOrderStatusEvent[] = [];
    for (const event of events) {
      if (isOrderStatusEvent(event.payload)) records.push(event.payload);
    }
    return records;
  }
  let raw: string;
  try {
    raw = await readFile(
      defaultAuthorizeNetOrderStatusLedgerPath(),
      'utf8',
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const records: AuthorizeNetOrderStatusEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isOrderStatusEvent(parsed)) records.push(parsed);
    } catch {
      // skip malformed line
    }
  }
  return records;
}

/** The latest status transition for an order, or null. */
export async function findLatestAuthorizeNetOrderStatus(
  orderId: string,
): Promise<AuthorizeNetOrderStatusEvent | null> {
  const records = await readAuthorizeNetOrderStatusEvents();
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].order_id === orderId) return records[i];
  }
  return null;
}

export async function recordAuthorizeNetOrderStatus(
  record: AuthorizeNetOrderStatusEvent,
): Promise<AuthorizeNetOrderStatusEvent> {
  if (postgresEnabled()) {
    await appendEvent(
      EVENT_STREAMS.authorizenetOrderStatus,
      record.order_id,
      `authorizenet_order_status.${record.status}`,
      record,
      record.recorded_at,
    );
    return record;
  }
  const path = defaultAuthorizeNetOrderStatusLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

/* ------------------------------------------------------------------ */
/* Card-order lifecycle audit — one row per state change (2026-11-09)  */
/* Stream: EVENT_STREAMS.authorizenetOrderAudit                        */
/* ('authorizenet_order_audit'); local JSONL fallback beside the       */
/* other Authorize.net ledgers. States (owner spec):                   */
/* awaiting_payment -> paid | failed | refunded.                       */
/* ------------------------------------------------------------------ */

export type AuthorizeNetOrderAuditState =
  | 'awaiting_payment'
  | 'paid'
  | 'failed'
  | 'refunded';

export interface AuthorizeNetOrderAuditEvent {
  order_id: string;
  state: AuthorizeNetOrderAuditState;
  /** Plain-language reason for a failure; null otherwise. */
  reason: string | null;
  trans_id: string | null;
  notification_id: string | null;
  recorded_at: string;
  source: 'checkout_route' | 'authorizenet_webhook';
}

export function defaultAuthorizeNetOrderAuditLedgerPath(): string {
  return (
    process.env.AUTHORIZENET_ORDER_AUDIT_LEDGER_PATH ??
    join(process.cwd(), '.authorizenet-order-audit.jsonl')
  );
}

function isOrderAuditEvent(v: unknown): v is AuthorizeNetOrderAuditEvent {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.order_id === 'string' &&
    (r.state === 'awaiting_payment' ||
      r.state === 'paid' ||
      r.state === 'failed' ||
      r.state === 'refunded')
  );
}

export async function readAuthorizeNetOrderAuditEvents(): Promise<
  AuthorizeNetOrderAuditEvent[]
> {
  if (postgresEnabled()) {
    const events = await readStreamEvents<AuthorizeNetOrderAuditEvent>(
      EVENT_STREAMS.authorizenetOrderAudit,
    );
    const records: AuthorizeNetOrderAuditEvent[] = [];
    for (const event of events) {
      if (isOrderAuditEvent(event.payload)) records.push(event.payload);
    }
    return records;
  }
  let raw: string;
  try {
    raw = await readFile(defaultAuthorizeNetOrderAuditLedgerPath(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const records: AuthorizeNetOrderAuditEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isOrderAuditEvent(parsed)) records.push(parsed);
    } catch {
      // skip malformed line
    }
  }
  return records;
}

export async function recordAuthorizeNetOrderAudit(
  record: AuthorizeNetOrderAuditEvent,
): Promise<AuthorizeNetOrderAuditEvent> {
  if (postgresEnabled()) {
    await appendEvent(
      EVENT_STREAMS.authorizenetOrderAudit,
      record.order_id,
      `authorizenet_order_audit.${record.state}`,
      record,
      record.recorded_at,
    );
    return record;
  }
  const path = defaultAuthorizeNetOrderAuditLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}
