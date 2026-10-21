/**
 * Order-confirmation trigger — regression suite (wired 2026-10-19).
 *
 * Law under test: every accepted order produces exactly one
 * purchase_confirmation job addressed to the customer, and its payment
 * content matches the method recorded on the order (handles for
 * Cash App / Venmo; NO handles for Bookipi card-by-invoice).
 */
import { describe, expect, it } from 'vitest';
import {
  buildOrderConfirmationJob,
  orderItemSummary,
  queueOrderConfirmation,
} from './order-confirmation';
import { LoggingEmailProvider, type PurchaseConfirmationData } from './email';
import type { OrderRecord } from '../checkout/order';

function record(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    order_id: 'AWK-20261019-TEST01',
    created_at: '2026-10-19T00:00:00.000Z',
    computed_by: 'server',
    ledger_version: 1,
    customer: { name: 'Test Customer', email: 'customer@example.com' },
    items: [
      {
        product_handle: 'gaias-rose-soap',
        title: "Gaia's Rose Soap",
        quantity: 2,
        unit_price_cents: 900,
      },
    ],
    bundle: null,
    subtotal_cents: 1800,
    subscriber_discount_cents: 0,
    shipping_cents: 0,
    shipping_status: 'FLAT',
    free_shipping_threshold_cents: 4500,
    total_cents: 1800,
    is_subscriber_asserted: false,
    is_subscriber_verified: false,
    payment_method: 'cash_app_or_venmo',
    ...overrides,
  };
}

describe('order confirmation trigger', () => {
  it('summarizes items and bundle for the email body', () => {
    expect(orderItemSummary(record())).toBe("Gaia's Rose Soap × 2");
    const withBundle = record({
      bundle: {
        bundle_id: 'soap-style-collection-5',
        slots: [],
        price_cents: 3577,
        savings_cents: 323,
      },
    });
    expect(orderItemSummary(withBundle)).toContain(
      'The Alchemy Soap Collection (5 soaps)',
    );
  });

  it('Cash App / Venmo orders carry the payment handles', () => {
    const job = buildOrderConfirmationJob(record());
    expect(job.template).toBe('purchase_confirmation');
    expect(job.to).toBe('customer@example.com');
    const data = job.data as { cash_app_handle?: string; venmo_handle?: string };
    expect(data.cash_app_handle).toBe('$AmberPatten347');
    expect(data.venmo_handle).toBe('@AwakenwithAmber');
  });

  it('Bookipi card orders carry NO handles — the invoice is the payment path', () => {
    const job = buildOrderConfirmationJob(
      record({ payment_method: 'bookipi_card_invoice' }),
    );
    const data = job.data as PurchaseConfirmationData;
    expect(data.payment_method).toBe('bookipi_card_invoice');
    expect(data.cash_app_handle).toBeUndefined();
    expect(data.venmo_handle).toBeUndefined();
  });

  it('queueing hands exactly one job to the provider', async () => {
    const provider = new LoggingEmailProvider();
    const job = await queueOrderConfirmation(record(), provider);
    expect(provider.sentJobs()).toHaveLength(1);
    expect(provider.sentJobs()[0].id).toBe(job.id);
  });
});
