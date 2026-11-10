/**
 * Authorize.net webhook processing — SHOP ORDERS ONLY
 * (card checkout build 2026-11-09, ported semantically from the
 * Oct 29 unified build's processor onto current main a9f8fba7).
 *
 * SCOPE LIMIT: this processor handles shop orders placed at
 * /checkout with payment_method 'authorizenet_card_hosted' ONLY.
 * The unified build's Grimoire subscription (ARB lifecycle) and
 * unlock handling is deliberately NOT ported — and the $8.88 unlock
 * itself was abolished by owner decision 2026-11-09. A webhook event that
 * does not resolve to a shop order is acknowledged without any
 * entitlement side effect (see handleAuthCapture).
 *
 * Order of operations:
 *  1. Configuration gate — 503 outcome when the webhook is not
 *     configured (flag + Signature Key).
 *  2. HMAC-SHA512 signature verification over the RAW body →
 *     400 'bad_signature' on any mismatch. NOTHING is written
 *     before this check passes (no claim, no ledger row).
 *  3. Idempotency — the notificationId is CLAIMED atomically
 *     (claimAuthorizeNetEvent) before any side effect: a duplicate
 *     delivery is acknowledged without re-running side effects
 *     (this is also the double-submit proof: the same payment can
 *     never be recorded — or emailed — twice).
 *  4. Amount verification — amounts are NEVER trusted from the
 *     webhook payload (the parser carries only the entity id);
 *     every money-moving handler re-fetches the transaction via
 *     getTransactionDetails and compares against the STORED order
 *     total before any state change. On current main total_cents
 *     is TAX-INCLUSIVE (2026-11-01 tax build), so the expected
 *     amount is exactly total_cents — the tax portion recorded on
 *     the order (tax_cents / tax_breakdown) must be internally
 *     consistent or the handler fails loudly. A mismatch throws →
 *     the claim resolves 'failed', the route answers 400, and NO
 *     payment/audit state is written.
 *
 * Lifecycle + audit (owner spec 2026-11-09): card orders move
 * awaiting_payment → paid / failed / refunded. EVERY change writes
 * an audit row to the 'authorizenet_order_audit' stream
 * (recordAuthorizeNetOrderAudit): placement writes
 * 'awaiting_payment' (checkout route), this processor writes
 * 'paid' (approved capture), 'failed' (declined / not approved,
 * with a plain-language reason), and 'refunded' (refund/void).
 * The read-time paid state (lib/orders/paid-state) joins the
 * payments ledger + the order-status ledger as before.
 *
 * Confirmation email: queued HERE, at payment, for card orders
 * only (the checkout route deliberately skips placement-time
 * queueing for this method). It contains no card details — the
 * email builder never receives any (card data never touches this
 * server; the hosted page holds it).
 *
 * SERVER-ONLY.
 */
import type { OrderRecord } from '../checkout/order';
import { createOrderStore } from '../orders/store';
import { queueOrderConfirmation } from '../jobs/order-confirmation';
import { createLogger } from '../observability/logger';

const log = createLogger('authorizenet-webhook');

/** Minimal order-store surface this processor needs (tests inject a fake). */
export interface OrderStoreLike {
  get(id: string): Promise<OrderRecord | null>;
}

import {
  claimAuthorizeNetEvent,
  failAuthorizeNetEventClaim,
  findAuthorizeNetPayment,
  findAuthorizeNetPaymentByTransId,
  findLatestAuthorizeNetOrderStatus,
  parseWebhookEvent,
  recordAuthorizeNetOrderAudit,
  recordAuthorizeNetOrderStatus,
  recordAuthorizeNetPayment,
  recordAuthorizeNetWebhookEvent,
  verifyWebhookSignature,
  type AuthorizeNetClientLike,
  type AuthorizeNetConfig,
  type AuthorizeNetOrderStatusKind,
  type AuthorizeNetTransactionDetails,
  type AuthorizeNetWebhookEvent,
} from './authorizenet';

export interface AuthorizeNetWebhookDeps {
  config: AuthorizeNetConfig;
  client: AuthorizeNetClientLike;
  /** Order-store override (tests). Defaults to the canonical store. */
  orderStore?: OrderStoreLike;
}

export interface AuthorizeNetWebhookResult {
  status: number;
  outcome: string;
  eventType: string | null;
  orderId: string | null;
  subscriptionId: string | null;
}

function acknowledgement(
  eventType: string,
  outcome: string,
  extra: Partial<AuthorizeNetWebhookResult> = {},
): AuthorizeNetWebhookResult {
  return {
    status: 200,
    outcome,
    eventType,
    orderId: null,
    subscriptionId: null,
    ...extra,
  };
}

const TERMINAL_ORDER_STATUSES: ReadonlySet<AuthorizeNetOrderStatusKind> =
  new Set(['refunded', 'cancelled']);

async function orderInTerminalAuthorizeNetState(
  orderId: string,
): Promise<boolean> {
  const latest = await findLatestAuthorizeNetOrderStatus(orderId);
  return latest !== null && TERMINAL_ORDER_STATUSES.has(latest.status);
}

/** Plain-language failure reasons (visible-notices rule: no jargon). */
export const DECLINED_REASON =
  'Your card payment was not approved. Your order is saved — please try again or pay with the Bluevine invoice, Cash App, or Venmo.';
export const FRAUD_DECLINED_REASON =
  'Your card payment could not be completed. Your order is saved — please try again or pay with the Bluevine invoice, Cash App, or Venmo.';

async function audit(
  event: AuthorizeNetWebhookEvent,
  orderId: string,
  state: 'paid' | 'failed' | 'refunded',
  reason: string | null,
  transId: string | null,
): Promise<void> {
  await recordAuthorizeNetOrderAudit({
    order_id: orderId,
    state,
    reason,
    trans_id: transId,
    notification_id: event.notificationId,
    recorded_at: new Date().toISOString(),
    source: 'authorizenet_webhook',
  });
}

async function recordStatus(
  event: AuthorizeNetWebhookEvent,
  orderId: string,
  status: AuthorizeNetOrderStatusKind,
  transId: string | null,
): Promise<void> {
  const latest = await findLatestAuthorizeNetOrderStatus(orderId);
  if (latest?.status === status) return;
  if (latest && TERMINAL_ORDER_STATUSES.has(latest.status)) return;
  await recordAuthorizeNetOrderStatus({
    order_id: orderId,
    status,
    trans_id: transId,
    notification_id: event.notificationId,
    recorded_at: new Date().toISOString(),
    source: 'authorizenet_webhook',
  });
}

/**
 * The amount a shop order must have been charged: the stored
 * total_cents EXACTLY (tax-inclusive on current main). The recorded
 * tax fields must agree with each other; disagreement fails loudly.
 */
function expectedOrderAmountCents(order: OrderRecord): number {
  if (
    order.tax_breakdown &&
    typeof order.tax_cents === 'number' &&
    order.tax_breakdown.taxCents !== order.tax_cents
  ) {
    throw new Error(
      `Order ${order.order_id} tax fields are internally inconsistent — refusing to mark it paid from an Authorize.net payment.`,
    );
  }
  return order.total_cents;
}

async function markPaid(
  event: AuthorizeNetWebhookEvent,
  orderId: string,
  details: AuthorizeNetTransactionDetails,
  order?: OrderRecord | null,
): Promise<{ already: boolean; blocked?: boolean }> {
  const existing = await findAuthorizeNetPayment(orderId);
  if (existing) return { already: true };
  if (await orderInTerminalAuthorizeNetState(orderId)) {
    return { already: false, blocked: true };
  }
  await recordAuthorizeNetPayment({
    order_id: orderId,
    trans_id: details.transId,
    notification_id: event.notificationId,
    amount_cents: details.authAmountCents ?? 0,
    currency: 'USD',
    paid_at: event.eventDate ?? new Date().toISOString(),
    source: 'authorizenet_webhook',
  });
  await audit(event, orderId, 'paid', null, details.transId);
  // Confirmation email fires at PAYMENT for this rail. Fire-and-forget
  // with a logged catch: email can never fail the money path.
  if (order) {
    void queueOrderConfirmation(order).catch((err: unknown) => {
      log.error('order confirmation email failed (order marked paid)', {
        order_id: orderId,
        error: err,
      });
    });
  }
  return { already: false };
}

async function markFailed(
  event: AuthorizeNetWebhookEvent,
  orderId: string,
  transId: string | null,
  reason: string,
): Promise<void> {
  await recordStatus(event, orderId, 'payment_declined', transId);
  await audit(event, orderId, 'failed', reason, transId);
}

/* ------------------------------------------------------------------ */
/* authcapture.created                                                 */
/* ------------------------------------------------------------------ */

async function handleAuthCapture(
  event: AuthorizeNetWebhookEvent,
  deps: AuthorizeNetWebhookDeps,
  orderStore: OrderStoreLike,
): Promise<AuthorizeNetWebhookResult> {
  const details = await deps.client.getTransactionDetails(event.entityId);
  const invoice = details.invoiceNumber;
  // Shop orders only (2026-11-09 scope): anything that does not
  // resolve to a stored shop order — including the unified build's
  // subscription ('SUB-…') and unlock ('UNL-…') invoice references,
  // which this build deliberately does not port — is acknowledged
  // with NO side effect.
  if (!invoice) {
    return acknowledgement(event.eventType, 'unknown_order');
  }
  const order = await orderStore.get(invoice);
  if (!order || order.payment_method !== 'authorizenet_card_hosted') {
    return acknowledgement(event.eventType, 'unknown_order');
  }
  const orderId = order.order_id;

  if (details.responseCode === 4) {
    // Held for review by the fraud filter: not paid, not failed.
    await recordStatus(event, orderId, 'fraud_hold', details.transId);
    return acknowledgement(event.eventType, 'fraud_hold', { orderId });
  }
  if (details.responseCode !== 1) {
    // Declined / error — the order moves to 'failed' (audit) with a
    // plain-language reason; nothing is deleted, the cart/order the
    // customer placed stays on record for a retry or another method.
    await markFailed(event, orderId, details.transId, DECLINED_REASON);
    return acknowledgement(event.eventType, 'not_approved', { orderId });
  }
  const expected = expectedOrderAmountCents(order);
  if (details.authAmountCents !== expected) {
    // Loud failure: no state change, claim resolves failed, route 400.
    throw new Error(
      `Authorize.net amount mismatch for order ${orderId}: gateway reports ${String(details.authAmountCents)}, order total is ${expected}. Refusing to mark paid.`,
    );
  }
  if (await orderInTerminalAuthorizeNetState(orderId)) {
    return acknowledgement(event.eventType, 'terminal_state_ignored', {
      orderId,
    });
  }
  const paid = await markPaid(event, orderId, details, order);
  if (paid.blocked) {
    return acknowledgement(event.eventType, 'terminal_state_ignored', {
      orderId,
    });
  }
  return acknowledgement(
    event.eventType,
    paid.already ? 'already_paid' : 'paid',
    { orderId },
  );
}

/* ------------------------------------------------------------------ */
/* fraud.*                                                             */
/* ------------------------------------------------------------------ */

async function resolveOrderForTransaction(
  deps: AuthorizeNetWebhookDeps,
  orderStore: OrderStoreLike,
  transId: string,
): Promise<{ order: OrderRecord; details: AuthorizeNetTransactionDetails } | null> {
  const details = await deps.client.getTransactionDetails(transId);
  const invoice = details.invoiceNumber;
  if (!invoice) return null;
  const order = await orderStore.get(invoice);
  if (!order || order.payment_method !== 'authorizenet_card_hosted') {
    return null;
  }
  return { order, details };
}

async function handleFraud(
  event: AuthorizeNetWebhookEvent,
  deps: AuthorizeNetWebhookDeps,
  orderStore: OrderStoreLike,
): Promise<AuthorizeNetWebhookResult> {
  const resolved = await resolveOrderForTransaction(
    deps,
    orderStore,
    event.entityId,
  );
  if (!resolved) return acknowledgement(event.eventType, 'unknown_order');
  const { order, details } = resolved;
  const orderId = order.order_id;
  if (await orderInTerminalAuthorizeNetState(orderId)) {
    return acknowledgement(event.eventType, 'terminal_state_ignored', {
      orderId,
    });
  }
  if (event.eventType === 'net.authorize.payment.fraud.held') {
    await recordStatus(event, orderId, 'fraud_hold', details.transId);
    return acknowledgement(event.eventType, 'fraud_hold', { orderId });
  }
  if (event.eventType === 'net.authorize.payment.fraud.declined') {
    await recordStatus(event, orderId, 'cancelled', details.transId);
    await audit(event, orderId, 'failed', FRAUD_DECLINED_REASON, details.transId);
    return acknowledgement(event.eventType, 'fraud_declined_cancelled', {
      orderId,
    });
  }
  // fraud.approved: complete the payment exactly like an authcapture,
  // with the same re-fetched amount verification.
  const expected = expectedOrderAmountCents(order);
  if (details.responseCode !== 1 || details.authAmountCents !== expected) {
    throw new Error(
      `Authorize.net fraud-approved amount mismatch for order ${orderId}: gateway reports ${String(details.authAmountCents)}, order total is ${expected}. Refusing to mark paid.`,
    );
  }
  await recordStatus(event, orderId, 'fraud_released', details.transId);
  const paid = await markPaid(event, orderId, details, order);
  return acknowledgement(
    event.eventType,
    paid.already ? 'already_paid' : 'fraud_released_paid',
    { orderId },
  );
}

/* ------------------------------------------------------------------ */
/* refund.created / void.created                                       */
/* ------------------------------------------------------------------ */

async function handleRefundOrVoid(
  event: AuthorizeNetWebhookEvent,
  deps: AuthorizeNetWebhookDeps,
  orderStore: OrderStoreLike,
): Promise<AuthorizeNetWebhookResult> {
  const details = await deps.client.getTransactionDetails(event.entityId);
  // Resolve the original order: prefer the refund transaction's own
  // invoice number, else follow refTransId to the original payment.
  let order: OrderRecord | null = null;
  if (details.invoiceNumber) {
    const found = await orderStore.get(details.invoiceNumber);
    if (found && found.payment_method === 'authorizenet_card_hosted') {
      order = found;
    }
  }
  if (!order && details.refTransId) {
    const original = await findAuthorizeNetPaymentByTransId(details.refTransId);
    if (original) {
      const found = await orderStore.get(original.order_id);
      if (found && found.payment_method === 'authorizenet_card_hosted') {
        order = found;
      }
    }
  }
  if (!order) return acknowledgement(event.eventType, 'unknown_order');
  const orderId = order.order_id;
  const isRefund = event.eventType === 'net.authorize.payment.refund.created';
  await recordStatus(
    event,
    orderId,
    isRefund ? 'refunded' : 'cancelled',
    details.transId,
  );
  if (isRefund) {
    await audit(event, orderId, 'refunded', null, details.transId);
  }
  return acknowledgement(
    event.eventType,
    isRefund ? 'refunded' : 'voided_cancelled',
    { orderId },
  );
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function processAuthorizeNetWebhook(
  rawBody: string,
  signatureHeader: string | null,
  deps: AuthorizeNetWebhookDeps,
): Promise<AuthorizeNetWebhookResult> {
  const { config } = deps;
  if (!config.webhookConfigured) {
    return {
      status: 503,
      outcome: 'not_configured',
      eventType: null,
      orderId: null,
      subscriptionId: null,
    };
  }
  // Signature BEFORE anything is parsed for action or written.
  if (!verifyWebhookSignature(rawBody, signatureHeader, config.signatureKey)) {
    return {
      status: 400,
      outcome: 'bad_signature',
      eventType: null,
      orderId: null,
      subscriptionId: null,
    };
  }
  let event: AuthorizeNetWebhookEvent;
  try {
    event = parseWebhookEvent(rawBody);
  } catch {
    return {
      status: 400,
      outcome: 'unparseable',
      eventType: null,
      orderId: null,
      subscriptionId: null,
    };
  }

  const claim = await claimAuthorizeNetEvent(
    event.notificationId,
    event.eventType,
  );
  if (claim.kind === 'already_processed') {
    const prior = claim.record;
    return {
      status: 200,
      outcome: 'duplicate',
      eventType: event.eventType,
      orderId: prior.order_id ?? null,
      subscriptionId: null,
    };
  }
  if (claim.kind === 'in_flight') {
    return {
      status: 503,
      outcome: 'duplicate_in_flight',
      eventType: event.eventType,
      orderId: null,
      subscriptionId: null,
    };
  }

  const orderStore: OrderStoreLike = deps.orderStore ?? {
    get: (id: string) => createOrderStore().get(id),
  };

  try {
    let result: AuthorizeNetWebhookResult;
    switch (event.eventType) {
      case 'net.authorize.payment.authcapture.created':
        result = await handleAuthCapture(event, deps, orderStore);
        break;
      case 'net.authorize.payment.fraud.held':
      case 'net.authorize.payment.fraud.approved':
      case 'net.authorize.payment.fraud.declined':
        result = await handleFraud(event, deps, orderStore);
        break;
      case 'net.authorize.payment.refund.created':
      case 'net.authorize.payment.void.created':
        result = await handleRefundOrVoid(event, deps, orderStore);
        break;
      default:
        result = acknowledgement(event.eventType, 'acknowledged');
        break;
    }
    await recordAuthorizeNetWebhookEvent({
      notification_id: event.notificationId,
      event_type: event.eventType,
      order_id: result.orderId,
      subscription_id: null,
      outcome: result.outcome,
      recorded_at: new Date().toISOString(),
      claim_id: claim.claimId,
    });
    return result;
  } catch (err) {
    await failAuthorizeNetEventClaim(claim, event.eventType).catch(
      (claimErr: unknown) => {
        log.error('webhook claim failure-resolution failed', {
          notification_id: event.notificationId,
          error: claimErr,
        });
      },
    );
    throw err;
  }
}
