/**
 * Template 1 renderer — regression suite (owner-selected 2026-10-19).
 *
 * Laws under test: the rendered order-placed email carries ALL of the
 * owner's required copy (placed + in review; handmade by Amber with
 * love and care, 100% natural and organic ingredients; ships within
 * 3 to 5 business days; notified when it ships), the actual items and
 * totals from the order, and the payment block for the recorded method
 * (Venmo/Cash App = handles; embedded card = no handles either).
 */
import { describe, expect, it } from 'vitest';
import {
  ORDER_CONFIRMATION_SUBJECT,
  renderPurchaseConfirmation,
} from './purchase-confirmation-email';
import type { PurchaseConfirmationData } from './email';

function data(
  overrides: Partial<PurchaseConfirmationData> = {},
): PurchaseConfirmationData {
  return {
    order_id: 'AWK-20261019-TEST01',
    total_cents: 5377,
    item_summary: "Gaia's Rose Soap × 2; The Alchemy Soap Collection (5 soaps)",
    customer_name: 'Test Customer',
    items: [
      { title: "Gaia's Rose Soap", quantity: 2, unit_price_cents: 900 },
      {
        title: 'The Alchemy Soap Collection (5 soaps)',
        quantity: 1,
        unit_price_cents: 3577,
      },
    ],
    subtotal_cents: 5377,
    subscriber_discount_cents: 0,
    shipping_status: 'FLAT',
    payment_method: 'cash_app_or_venmo',
    cash_app_handle: '$AmberPatten347',
    venmo_handle: '@AwakenwithAmber',
    ...overrides,
  };
}

describe('purchase confirmation renderer (Template 1)', () => {
  it('subject is the owner-selected placed / in-review line', () => {
    const rendered = renderPurchaseConfirmation(data());
    expect(rendered.subject).toBe(ORDER_CONFIRMATION_SUBJECT);
    expect(rendered.subject).toContain('order is placed — in review');
  });

  it('carries every required copy element', () => {
    const { text } = renderPurchaseConfirmation(data());
    expect(text).toContain('is placed and is now in review');
    expect(text).toContain(
      'handmade by Amber herself, with love and care, using 100% natural and organic ingredients',
    );
    expect(text).toContain('ship within 3 to 5 business days');
    expect(text).toContain('notify you when it ships');
    expect(text).toContain('Hello Test,');
    expect(text).toContain('AWK-20261019-TEST01');
  });

  it('renders the actual items and totals from the order', () => {
    const { text, html } = renderPurchaseConfirmation(data());
    expect(text).toContain("Gaia's Rose Soap × 2 — $18.00");
    expect(text).toContain('The Alchemy Soap Collection (5 soaps) × 1 — $35.77');
    expect(text).toContain('Subtotal: $53.77');
    expect(text).toContain('Total: $53.77');
    expect(html).toContain("Gaia&#39;s Rose Soap");
    expect(html).toContain('$53.77');
  });

  it('shows the subscriber discount line only when there is one', () => {
    const withDiscount = renderPurchaseConfirmation(
      data({ subscriber_discount_cents: 198, total_cents: 5179 }),
    );
    expect(withDiscount.text).toContain('subscriber discount');
    expect(withDiscount.text).toContain('−$1.98');
    const without = renderPurchaseConfirmation(data());
    expect(without.text).not.toContain('subscriber discount');
  });

  it('Venmo / Cash App orders show both handles', () => {
    const { text } = renderPurchaseConfirmation(data());
    expect(text).toContain('Venmo: @AwakenwithAmber');
    expect(text).toContain('Cash App: $AmberPatten347');
  });

  it('embedded-card orders show the card block and NO handles', () => {
    const { text } = renderPurchaseConfirmation(
      data({
        payment_method: 'stripe_card_embedded',
        cash_app_handle: undefined,
        venmo_handle: undefined,
      }),
    );
    expect(text).toContain('pay by card on our website');
    expect(text).not.toContain('@AwakenwithAmber');
    expect(text).not.toContain('$AmberPatten347');
  });

  it('HTML is branded (dark purple + gold) and escapes item titles', () => {
    const { html } = renderPurchaseConfirmation(
      data({
        items: [
          { title: '<script>alert(1)</script>', quantity: 1, unit_price_cents: 100 },
        ],
        total_cents: 100,
        subtotal_cents: 100,
      }),
    );
    expect(html).toContain('#2a1a40');
    expect(html).toContain('#d4af37');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('falls back to the item summary for older jobs without line items', () => {
    const legacy = data();
    delete legacy.items;
    const { text } = renderPurchaseConfirmation(legacy);
    expect(text).toContain('Gaia\'s Rose Soap × 2; The Alchemy Soap Collection (5 soaps)');
  });
});
