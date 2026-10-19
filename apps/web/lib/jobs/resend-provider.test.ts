/**
 * Resend provider binding — regression suite (owner directive 2026-10-19).
 *
 * Laws under test:
 * - createEmailProvider() binds Resend when RESEND_API_KEY is present
 *   and the logging provider when it is absent (never crashes).
 * - The Resend provider sends the rendered Template 1 through its
 *   transport and reports the provider message id.
 * - Transport errors surface as { ok: false } — never a throw.
 * - A placed order produces a sendable job through the REAL provider
 *   path (fake transport — no real email is ever sent in tests).
 */
import { describe, expect, it } from 'vitest';
import {
  createEmailProvider,
  ordersFromEmail,
  ResendEmailProvider,
  type ResendSendArgs,
} from './email';
import { queueOrderConfirmation } from './order-confirmation';
import { ORDER_CONFIRMATION_SUBJECT } from './purchase-confirmation-email';
import type { OrderRecord } from '../checkout/order';

describe('createEmailProvider', () => {
  it('binds Resend when RESEND_API_KEY is present', () => {
    const provider = createEmailProvider({ RESEND_API_KEY: 're_test_key' });
    expect(provider.name).toBe('resend');
  });

  it('falls back to the logging provider when the key is absent', () => {
    expect(createEmailProvider({}).name).toBe('logging');
    expect(createEmailProvider({ RESEND_API_KEY: '  ' }).name).toBe(
      'logging',
    );
  });

  it('sender defaults to the awakenagain.com orders address', () => {
    expect(ordersFromEmail({})).toContain('orders@awakenagain.com');
    expect(
      ordersFromEmail({ ORDERS_FROM_EMAIL: 'Shop <shop@example.com>' }),
    ).toBe('Shop <shop@example.com>');
  });
});

function record(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    order_id: 'AWK-20261019-TEST02',
    created_at: '2026-10-19T00:00:00.000Z',
    computed_by: 'server',
    ledger_version: 1,
    customer: { name: 'Test Customer', email: 'customer@example.com' },
    items: [
      {
        product_handle: 'gaias-rose-soap',
        title: "Gaia's Rose Soap",
        quantity: 1,
        unit_price_cents: 1177,
      },
    ],
    bundle: null,
    subtotal_cents: 1177,
    subscriber_discount_cents: 0,
    shipping_cents: 0,
    shipping_status: 'TO_BE_CONFIRMED',
    free_shipping_threshold_cents: 4500,
    total_cents: 1177,
    is_subscriber_asserted: false,
    is_subscriber_verified: false,
    payment_method: 'cash_app_or_venmo',
    ...overrides,
  };
}

describe('ResendEmailProvider', () => {
  it('sends the rendered Template 1 through the transport', async () => {
    const sent: ResendSendArgs[] = [];
    const provider = new ResendEmailProvider(
      async (args) => {
        sent.push(args);
        return { id: 'msg_test_1', error: null };
      },
      "Amber's Alchemy Apothecary <orders@awakenagain.com>",
    );
    const job = await queueOrderConfirmation(record(), provider);
    expect(job.template).toBe('purchase_confirmation');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('customer@example.com');
    expect(sent[0].from).toContain('orders@awakenagain.com');
    expect(sent[0].subject).toBe(ORDER_CONFIRMATION_SUBJECT);
    expect(sent[0].text).toContain(
      'handmade by Amber herself, with love and care',
    );
    expect(sent[0].text).toContain('Venmo: @AwakenwithAmber');
    expect(sent[0].html).toContain('#2a1a40');
  });

  it('a placed Bookipi order produces a sendable job with NO handles', async () => {
    const sent: ResendSendArgs[] = [];
    const provider = new ResendEmailProvider(
      async (args) => {
        sent.push(args);
        return { id: 'msg_test_2', error: null };
      },
      'orders@awakenagain.com',
    );
    await queueOrderConfirmation(
      record({ payment_method: 'bookipi_card_invoice' }),
      provider,
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('secure Bookipi invoice');
    expect(sent[0].text).not.toContain('@AwakenwithAmber');
    expect(sent[0].text).not.toContain('$AmberPatten347');
  });

  it('reports transport errors as ok:false instead of throwing', async () => {
    const provider = new ResendEmailProvider(
      async () => ({ id: null, error: 'domain not verified' }),
      'orders@awakenagain.com',
    );
    const job = await queueOrderConfirmation(record(), provider).catch(
      () => null,
    );
    // queueOrderConfirmation awaits provider.send; send itself must not throw.
    expect(job).not.toBeNull();
    const failing = new ResendEmailProvider(
      async () => {
        throw new Error('network down');
      },
      'orders@awakenagain.com',
    );
    const { buildOrderConfirmationJob } = await import('./order-confirmation');
    const result = await failing.send(
      buildOrderConfirmationJob(record()),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('network down');
  });
});
