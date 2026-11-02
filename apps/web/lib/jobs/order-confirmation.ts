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
  bluevinePaymentLinkUrl,
  CASH_APP_HANDLE,
  VENMO_HANDLE,
  type OrderRecord,
} from '../checkout/order';
import { formatShippingAddressLines } from '../checkout/shipping-address';

/** One-line human summary of what was ordered, for the email body. */
export function orderItemSummary(record: OrderRecord): string {
  const parts = record.items.map(
    (line) => `${line.title} × ${line.quantity}`,
  );
  if (record.bundle) parts.push('The Alchemy Soap Collection (5 soaps)');
  return parts.join('; ');
}

/**
 * Ship-to lines (Phase 2, Workstream 1a — ADAPTED to this tree's
 * address shape). The card tree formatted its ShippingAddress
 * (record.shipping_address: name/street/postal_code) through
 * a shipping-address helper module this tree does not have;
 * here the order record carries delivery_address, a TaxAddress
 * ({ line1, line2?, city, state, postalCode, country }), so the same
 * ship-to block is formatted from that shape, headed by the customer
 * name (the recipient named on the order record). Empty when the
 * order carries no delivery address (digital-only / historical).
 */
export function deliveryAddressLines(record: OrderRecord): string[] {
  // Combined merge 2026-11-02: the fulfillment (shipping) address is
  // the authoritative ship-to — prefer it when the order carries one;
  // fall back to the delivery (tax) address, which the checkout form
  // collects for every order.
  if (record.shipping_address) {
    return formatShippingAddressLines(record.shipping_address);
  }
  const address = record.delivery_address;
  if (!address) return [];
  const lines = [
    record.customer.name,
    address.line1,
    ...(address.line2 ? [address.line2] : []),
    `${address.city}, ${address.state} ${address.postalCode}`,
    address.country,
  ];
  return lines.filter(
    (line) => typeof line === 'string' && line.trim() !== '',
  );
}

/**
 * Build the confirmation job for an accepted order. The data matches the
 * payment method recorded on the order: Cash App / Venmo and Bluevine
 * invoice (2026-11-01; Bookipi invoice before that) jobs carry the
 * payment handles — the Bluevine invoice is also paid by ACH bank
 * transfer or check per the invoice; Bluevine card-link jobs carry
 * the hosted payment-page link instead; dormant embedded-card jobs
 * carry NO handles. When the order carries a delivery address, the
 * ship-to lines ride the job as well (Phase 2, Workstream 1a).
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
  const shipToLines = deliveryAddressLines(record);
  const data: PurchaseConfirmationData = {
    order_id: record.order_id,
    total_cents: record.total_cents,
    item_summary: orderItemSummary(record),
    customer_name: record.customer.name,
    items,
    subtotal_cents: record.subtotal_cents,
    subscriber_discount_cents: record.subscriber_discount_cents,
    coupon_code: record.coupon_code ?? null,
    coupon_discount_cents: record.coupon_discount_cents ?? 0,
    shipping_cents: record.shipping_cents,
    shipping_status: record.shipping_status,
    // Sales tax (2026-11-01): present only when the order carries a
    // tax breakdown (live rails with a delivery address); the email
    // shows the same tax-inclusive total as the checkout result.
    ...(typeof record.tax_cents === 'number'
      ? {
          tax_cents: record.tax_cents,
          ...(record.tax_breakdown
            ? { tax_rate_percent: record.tax_breakdown.ratePercent }
            : {}),
        }
      : {}),
    // Phase 2 (Workstream 1a): the ship-to block rides the job only
    // when the order actually carries a delivery address — orders
    // without one keep their exact pre-Phase-2 data shape.
    ...(shipToLines.length > 0
      ? { shipping_address_lines: shipToLines }
      : {}),
    payment_method: record.payment_method,
    ...(record.payment_method === 'cash_app_or_venmo' ||
    record.payment_method === 'bluevine_invoice' ||
    record.payment_method === 'bookipi_invoice'
      ? { cash_app_handle: CASH_APP_HANDLE, venmo_handle: VENMO_HANDLE }
      : {}),
    ...(record.payment_method === 'bluevine_card_link' &&
    bluevinePaymentLinkUrl()
      ? { payment_link_url: bluevinePaymentLinkUrl() as string }
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
