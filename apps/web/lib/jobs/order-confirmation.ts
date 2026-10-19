/**
 * Order-confirmation trigger — the missing call site, wired 2026-10-19.
 *
 * Before this module, the purchase_confirmation email contract existed
 * (lib/jobs/email.ts) and was unit-tested, but NO route ever queued one:
 * a customer could place an order and the confirmation-email path simply
 * never fired. The checkout Route Handler now calls
 * queueOrderConfirmation() for every ACCEPTED order, after the order is
 * persisted.
 *
 * Delivery: createEmailProvider() binds Resend when RESEND_API_KEY is
 * set (real delivery; sender ORDERS_FROM_EMAIL, domain verified in the
 * owner's Resend account) and falls back to the logging provider when
 * it is not (no sends, no crash). Callers must never let email failures
 * affect the order: queueing is observational to the money path,
 * exactly like the PostHog order event.
 */
import {
  buildPurchaseConfirmationJob,
  createEmailProvider,
  type EmailJob,
  type EmailProvider,
  type PurchaseConfirmationData,
} from './email';
import {
  CASH_APP_HANDLE,
  VENMO_HANDLE,
  type OrderRecord,
} from '../checkout/order';

/** One-line human summary of what was ordered, for the email body. */
export function orderItemSummary(record: OrderRecord): string {
  const parts = record.items.map(
    (line) => `${line.title} × ${line.quantity}`,
  );
  if (record.bundle) parts.push('The Alchemy Soap Collection (5 soaps)');
  return parts.join('; ');
}

/**
 * Build the confirmation job for an accepted order. The data matches the
 * payment method recorded on the order: Cash App / Venmo jobs carry the
 * payment handles; Bookipi card jobs carry NO handles — the customer is
 * waiting for the emailed invoice, and the confirmation must say so.
 */
export function buildOrderConfirmationJob(record: OrderRecord): EmailJob {
  const items = record.items.map((line) => ({
    title: line.title,
    quantity: line.quantity,
    unit_price_cents: line.unit_price_cents,
  }));
  if (record.bundle) {
    items.push({
      title: 'The Alchemy Soap Collection (5 soaps)',
      quantity: 1,
      unit_price_cents: record.bundle.price_cents,
    });
  }
  const data: PurchaseConfirmationData = {
    order_id: record.order_id,
    total_cents: record.total_cents,
    item_summary: orderItemSummary(record),
    customer_name: record.customer.name,
    items,
    subtotal_cents: record.subtotal_cents,
    subscriber_discount_cents: record.subscriber_discount_cents,
    shipping_status: record.shipping_status,
    payment_method: record.payment_method,
    ...(record.payment_method === 'cash_app_or_venmo'
      ? { cash_app_handle: CASH_APP_HANDLE, venmo_handle: VENMO_HANDLE }
      : {}),
  };
  return buildPurchaseConfirmationJob(record.customer.email, data);
}

/**
 * Queue + hand the confirmation job to the bound provider. Awaitable for
 * tests; the checkout route calls it fire-and-forget with a catch, so a
 * provider failure can never fail or delay an accepted order.
 */
export async function queueOrderConfirmation(
  record: OrderRecord,
  provider: EmailProvider = createEmailProvider(),
): Promise<EmailJob> {
  const job = buildOrderConfirmationJob(record);
  await provider.send(job);
  return job;
}
