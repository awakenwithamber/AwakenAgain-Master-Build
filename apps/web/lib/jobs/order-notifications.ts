/**
 * Order lifecycle notification emails — Phase 2 (Workstream 1b/1c, WS3).
 *
 * Three owner/customer notifications join the order-confirmation email
 * (lib/jobs/order-confirmation.ts) on the SAME provider path
 * (lib/jobs/email.ts — Resend SDK transport when RESEND_API_KEY is set,
 * sender ORDERS_FROM_EMAIL; the logging preview otherwise):
 *
 * - ADMIN NEW-ORDER notification → the owner inbox, on every accepted
 *   order. Fire-and-forget from the checkout route: a notification
 *   failure is logged and can never fail or delay the order.
 * - PAYMENT-CONFIRMED → the customer, built ONLY by the owner-secret
 *   admin payment route, ONLY on the path that appends a NEW payment
 *   event (an idempotent re-record sends nothing). 'Paid' therefore
 *   stays reachable solely through owner verification — nothing here
 *   marks anything paid; this module only announces it.
 * - SHIPPED → the customer, built ONLY by the admin tracking route for
 *   an order's FIRST tracking event (later corrections send nothing).
 * - GRIMOIRE UNLOCK notifications (Workstream 3) ride the same rails:
 *   the owner hears about each unlock request; the customer hears when
 *   the owner grants it.
 *
 * SERVER-ONLY.
 */
import {
  buildEmailJob,
  createEmailProvider,
  type EmailJob,
  type EmailProvider,
} from './email';
import { orderItemSummary } from './order-confirmation';
import type { OrderRecord } from '../checkout/order';
import { formatShippingAddressLines } from '../checkout/shipping-address';
import {
  paymentMethodLabel,
  type OrderPaymentEvent,
} from '../orders/payments';
import {
  carrierLabel,
  carrierTrackingUrl,
  type OrderTrackingEvent,
} from '../orders/tracking';
import { GRIMOIRE_UNLOCK_PRICE_CENTS } from '../grimoire/edition';
import type { UnlockRequestRecord } from '../grimoire/unlock-requests';
import { createLogger } from '../observability/logger';

const log = createLogger('jobs:order-notifications');

/** The owner inbox every order/unlock notification goes to. */
export const OWNER_NOTIFICATION_EMAIL = 'amber@awakenagain.com';

/* ------------------------------------------------------------------ */
/* Builders                                                             */
/* ------------------------------------------------------------------ */

export function buildAdminOrderNotificationJob(record: OrderRecord): EmailJob {
  return buildEmailJob({
    to: OWNER_NOTIFICATION_EMAIL,
    template: 'admin_new_order',
    data: {
      order_id: record.order_id,
      customer_name: record.customer.name,
      customer_email: record.customer.email,
      customer_phone: record.customer.phone ?? null,
      item_summary: orderItemSummary(record),
      shipping_address_lines: formatShippingAddressLines(record.shipping_address),
      total_cents: record.total_cents,
      payment_method_label: paymentMethodLabel(record.payment_method),
    },
  });
}

export function buildPaymentConfirmedJob(
  record: OrderRecord,
  event: OrderPaymentEvent,
): EmailJob {
  return buildEmailJob({
    to: record.customer.email,
    template: 'order_payment_confirmed',
    data: {
      order_id: record.order_id,
      total_cents: record.total_cents,
      payment_method_label: paymentMethodLabel(event.method),
      reference: event.reference,
    },
  });
}

export function buildOrderShippedJob(
  record: OrderRecord,
  tracking: OrderTrackingEvent,
): EmailJob {
  return buildEmailJob({
    to: record.customer.email,
    template: 'order_shipped',
    data: {
      order_id: record.order_id,
      carrier_label: carrierLabel(tracking.carrier),
      tracking_number: tracking.tracking_number,
      tracking_url: carrierTrackingUrl(tracking.carrier, tracking.tracking_number),
    },
  });
}

export function buildUnlockRequestedJob(request: UnlockRequestRecord): EmailJob {
  return buildEmailJob({
    to: OWNER_NOTIFICATION_EMAIL,
    template: 'grimoire_unlock_requested',
    data: {
      request_id: request.request_id,
      customer_email: request.email,
      amount_cents: GRIMOIRE_UNLOCK_PRICE_CENTS,
      payment_method_label:
        request.payment_method === 'bookipi_invoice'
          ? 'Emailed Bookipi invoice (ACH / Venmo / Cash App)'
          : 'Venmo / Cash App directly',
    },
  });
}

export function buildUnlockActiveJob(
  email: string,
  requestId: string,
): EmailJob {
  return buildEmailJob({
    to: email,
    template: 'grimoire_unlock_active',
    data: { request_id: requestId },
  });
}

/* ------------------------------------------------------------------ */
/* Queue helpers (awaitable for tests; routes call fire-and-forget)     */
/* ------------------------------------------------------------------ */

async function send(
  job: EmailJob,
  provider: EmailProvider,
): Promise<EmailJob> {
  await provider.send(job);
  return job;
}

export function queueAdminOrderNotification(
  record: OrderRecord,
  provider: EmailProvider = createEmailProvider(),
): Promise<EmailJob> {
  return send(buildAdminOrderNotificationJob(record), provider);
}

export function queuePaymentConfirmedEmail(
  record: OrderRecord,
  event: OrderPaymentEvent,
  provider: EmailProvider = createEmailProvider(),
): Promise<EmailJob> {
  return send(buildPaymentConfirmedJob(record, event), provider);
}

export function queueOrderShippedEmail(
  record: OrderRecord,
  tracking: OrderTrackingEvent,
  provider: EmailProvider = createEmailProvider(),
): Promise<EmailJob> {
  return send(buildOrderShippedJob(record, tracking), provider);
}

export function queueUnlockRequestedNotification(
  request: UnlockRequestRecord,
  provider: EmailProvider = createEmailProvider(),
): Promise<EmailJob> {
  return send(buildUnlockRequestedJob(request), provider);
}

export function queueUnlockActiveEmail(
  email: string,
  requestId: string,
  provider: EmailProvider = createEmailProvider(),
): Promise<EmailJob> {
  return send(buildUnlockActiveJob(email, requestId), provider);
}

/**
 * Fire-and-forget wrapper for route handlers: runs the queue promise,
 * logs any failure with context, and never throws into the caller's
 * flow (an email failure must never fail an order, a payment record,
 * or a tracking record).
 */
export function fireAndForgetEmail(
  work: Promise<EmailJob>,
  context: Record<string, string>,
): void {
  void work.catch((err: unknown) => {
    log.error('notification email failed (primary action saved)', {
      ...context,
      error: err,
    });
  });
}
