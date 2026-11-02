/**
 * Phase 2, Workstream 1b/1c — order email evidence (route level).
 *
 * Proves, against the real route handlers with temp ledgers and the
 * LoggingEmailProvider captured in-process (the same seam the
 * account-route tests use):
 *
 *  - every placed order queues BOTH the customer confirmation and the
 *    owner notification to amber@awakenagain.com — through the single
 *    createEmailProvider() path the account emails also use (1d);
 *  - the confirmation renders the shipping address + the per-method
 *    payment instructions;
 *  - recording a payment in admin fires the payment-confirmed email
 *    exactly once (idempotent repeats fire nothing), only with the
 *    owner secret, and only when the recorded amount matches the
 *    order total when an amount is given;
 *  - the first tracking entry fires the shipped email; later tracking
 *    updates fire nothing;
 *  - the admin notification's failure channel is fire-and-forget: the
 *    checkout response does not depend on it (queue semantics are the
 *    codebase's; here we assert the jobs are attempted via the
 *    provider, and order placement succeeds with the provider bound).
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import {
  LoggingEmailProvider,
  renderEmailMessage,
  type EmailJob,
  type SendResult,
} from '../lib/jobs/email';
import { renderEmail } from '../lib/jobs/purchase-confirmation-email';
import type {
  AdminNewOrderData,
  PurchaseConfirmationData,
} from '../lib/jobs/email';
import { OWNER_NOTIFICATION_EMAIL } from '../lib/jobs/order-notifications';
import { findLatestPayment } from '../lib/orders/payments';

const DIR = mkdtempSync(join(tmpdir(), 'phase2-order-emails-'));
const ORDERS = join(DIR, 'orders.jsonl');
const PAYMENTS = join(DIR, 'payments.jsonl');
const TRACKING = join(DIR, 'tracking.jsonl');
const SECRET = 'phase2-owner-secret';

const ENVS = [
  'ORDERS_LEDGER_PATH',
  'ORDER_PAYMENTS_LEDGER_PATH',
  'ORDER_TRACKING_LEDGER_PATH',
  'OWNER_ADMIN_SECRET',
  'DATABASE_URL',
  'RESEND_API_KEY',
] as const;
const saved: Record<string, string | undefined> = {};

let jobs: EmailJob[];
let sendSpy: MockInstance<(job: EmailJob) => Promise<SendResult>>;

function jobOf(template: EmailJob['template']): EmailJob | undefined {
  return jobs.find((j) => j.template === template);
}
function dataOf<T>(template: EmailJob['template']): T | undefined {
  return jobOf(template)?.data as T | undefined;
}

const ADDRESS = {
  name: 'Jamie Rivera',
  street: '239 S 1200 W',
  city: 'Salt Lake City',
  state: 'UT',
  postal_code: '84104',
  country: 'US',
};

const SOAP_ITEM = {
  product_handle: 'gaias-rose-soap',
  quantity: 1,
  customization: {
    base: 'glycerin-castor',
    shape: 'wave-rectangle',
    scent: { type: 'signature', recipe_id: 'SCENT_RECIPE_01' },
    botanical: 'lavender',
    color: 'amber-gold',
  },
  unit_price_cents: 1177,
};

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function placeOrder(): Promise<string> {
  const { POST } = await import('../app/api/checkout/route');
  const res = await POST(
    post('/api/checkout', {
      items: [SOAP_ITEM],
      customer: { name: 'Jamie Rivera', email: 'jamie@example.com' },
      shipping_address: ADDRESS,
      payment_method: 'bookipi_invoice',
      client_total_cents: 1177 + 595,
    }),
  );
  expect(res.status).toBe(200);
  const json = (await res.json()) as { order_id: string };
  return json.order_id;
}

async function flush(): Promise<void> {
  // Fire-and-forget email fan-out settles on the microtask queue.
  await new Promise((resolve) => setTimeout(resolve, 25));
}

beforeEach(() => {
  for (const key of ENVS) saved[key] = process.env[key];
  process.env.ORDERS_LEDGER_PATH = ORDERS;
  process.env.ORDER_PAYMENTS_LEDGER_PATH = PAYMENTS;
  process.env.ORDER_TRACKING_LEDGER_PATH = TRACKING;
  process.env['OWNER_ADMIN_' + 'SECRET'] = SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.RESEND_API_KEY;
  jobs = [];
  sendSpy = vi
    .spyOn(LoggingEmailProvider.prototype, 'send')
    .mockImplementation(async (job: EmailJob) => {
      jobs.push(job);
      return { ok: true };
    });
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of ENVS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('order placement emails', () => {
  it('queues the customer confirmation AND the owner notification through the shared provider', async () => {
    const orderId = await placeOrder();
    await flush();

    const confirmation = dataOf<PurchaseConfirmationData>('purchase_confirmation');
    expect(jobOf('purchase_confirmation')?.to).toBe('jamie@example.com');
    expect(confirmation?.order_id).toBe(orderId);
    expect(confirmation?.shipping_address_lines?.join(' ')).toContain(
      '239 S 1200 W',
    );

    const admin = dataOf<AdminNewOrderData>('admin_new_order');
    expect(OWNER_NOTIFICATION_EMAIL).toBe('amber@awakenagain.com');
    expect(jobOf('admin_new_order')?.to).toBe('amber@awakenagain.com');
    expect(admin?.order_id).toBe(orderId);
    expect(admin?.customer_email).toBe('jamie@example.com');
    expect(admin?.total_cents).toBe(1772);
    expect(admin?.item_summary).toContain('Rose Soap');
    // Combined merge (2026-11-02): the order body above still sends
    // the legacy 'bookipi_invoice' value, which the canonical parser
    // normalizes to 'bluevine_invoice' (Amber's 2026-11-01 direction)
    // — so the admin label is the Bluevine one.
    expect(admin?.payment_method_label).toMatch(/Bluevine/);
    expect(admin?.shipping_address_lines?.join(' ')).toContain('84104');
    const adminRendered = renderEmailMessage(jobOf('admin_new_order')!);
    expect(adminRendered.subject).toContain('$17.72');
    expect(adminRendered.text).toContain('Payment status: awaiting payment');
    expect(adminRendered.text).toContain('Ship to:');
    // Both jobs went through the SAME provider send() seam.
    expect(sendSpy).toHaveBeenCalledTimes(2);
  });

  it('renders the confirmation with the ship-to block and per-method instructions', async () => {
    await placeOrder();
    await flush();
    const confirmation = jobOf('purchase_confirmation');
    expect(confirmation).toBeDefined();
    const rendered = renderEmail(confirmation!);
    expect(rendered.subject).toContain('order is placed');
    expect(rendered.text).toContain('Ship to:');
    expect(rendered.text).toContain('239 S 1200 W');
    expect(rendered.text).toContain('your Bluevine invoice will be emailed to you');
    expect(rendered.text).toContain('ACH bank transfer');
    expect(rendered.text).toContain('$17.72');
    expect(rendered.html).toContain('Ship to');
    expect(rendered.text.toLowerCase()).not.toContain('stripe');
  });

  it('a digital-only order queues both emails with no address block', async () => {
    const { POST } = await import('../app/api/checkout/route');
    const res = await POST(
      post('/api/checkout', {
        items: [
          {
            product_handle: 'grimoire-subscription',
            variant_id: 'Monthly membership',
            quantity: 1,
            unit_price_cents: 777,
          },
        ],
        customer: { name: 'Jamie Rivera', email: 'jamie@example.com' },
        payment_method: 'cash_app_or_venmo',
        client_total_cents: 777 + 595,
      }),
    );
    expect(res.status).toBe(200);
    await flush();
    const admin = dataOf<AdminNewOrderData>('admin_new_order');
    expect(admin).toBeDefined();
    expect(admin?.shipping_address_lines).toEqual([]);
    const rendered = renderEmailMessage(jobOf('admin_new_order')!);
    expect(rendered.text).toContain('Digital order');
    const confirmation = dataOf<PurchaseConfirmationData>('purchase_confirmation');
    expect(confirmation?.shipping_address_lines).toBeUndefined();
  });
});

describe('admin payment recording → payment-confirmed email', () => {
  async function recordPayment(body: unknown, secret?: string) {
    const { POST } = await import('../app/api/admin/orders/payment/route');
    return POST(
      post('/api/admin/orders/payment', body, {
        ...(secret !== undefined ? { 'x-owner-secret': secret } : {}),
      }),
    );
  }

  it('refuses without the owner secret and fires nothing', async () => {
    const orderId = await placeOrder();
    jobs = [];
    expect((await recordPayment({ order_id: orderId })).status).toBe(401);
    expect(
      (await recordPayment({ order_id: orderId }, 'wrong-secret')).status,
    ).toBe(401);
    await flush();
    expect(jobs.filter((j) => j.template === 'order_payment_confirmed')).toEqual([]);
    // ...and nothing was recorded either.
    expect(findLatestPayment(orderId, PAYMENTS)).toBeUndefined();
  });

  it('fails closed (404) when the secret is unconfigured', async () => {
    const orderId = await placeOrder();
    delete process.env.OWNER_ADMIN_SECRET;
    expect((await recordPayment({ order_id: orderId }, SECRET)).status).toBe(404);
  });

  it('fires exactly one payment-confirmed email; an identical repeat fires none', async () => {
    const orderId = await placeOrder();
    jobs = [];
    const payload = {
      order_id: orderId,
      method: 'cash_app_or_venmo',
      reference: orderId,
      amount_cents: 1772,
    };
    const first = await recordPayment(payload, SECRET);
    expect(first.status).toBe(201);
    await flush();
    let confirmed = jobs.filter((j) => j.template === 'order_payment_confirmed');
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].to).toBe('jamie@example.com');
    const rendered = renderEmailMessage(confirmed[0]);
    expect(rendered.subject).toContain('Payment confirmed');
    expect(rendered.text).toContain(orderId);

    const second = await recordPayment(payload, SECRET);
    expect(second.status).toBe(200);
    await flush();
    confirmed = jobs.filter((j) => j.template === 'order_payment_confirmed');
    expect(confirmed).toHaveLength(1);
  });

  it('rejects a mismatched amount and records nothing', async () => {
    const orderId = await placeOrder();
    jobs = [];
    const res = await recordPayment(
      { order_id: orderId, method: 'bookipi_invoice', reference: orderId, amount_cents: 100 },
      SECRET,
    );
    expect(res.status).toBe(422);
    await flush();
    const events = readPayments().filter((e) => e.order_id === orderId);
    expect(events).toEqual([]);
    expect(jobs.filter((j) => j.template === 'order_payment_confirmed')).toEqual([]);
  });
});

describe('admin tracking → shipped email', () => {
  async function postTracking(body: unknown) {
    const { POST } = await import('../app/api/admin/orders/tracking/route');
    return POST(
      post('/api/admin/orders/tracking', body, { 'x-owner-secret': SECRET }),
    );
  }

  it('fires the shipped email on the FIRST tracking entry only', async () => {
    const orderId = await placeOrder();
    jobs = [];
    const first = await postTracking({
      order_id: orderId,
      carrier: 'usps',
      tracking_number: '9400111899223856928499',
    });
    expect(first.status).toBe(201);
    await flush();
    const shipped = jobs.filter((j) => j.template === 'order_shipped');
    expect(shipped).toHaveLength(1);
    const rendered = renderEmailMessage(shipped[0]);
    expect(rendered.text).toContain('9400111899223856928499');
    expect(rendered.text).toContain('USPS');

    const second = await postTracking({
      order_id: orderId,
      carrier: 'usps',
      tracking_number: '9400111899223856928500',
      note: 'Label reprinted',
    });
    expect(second.status).toBe(201);
    await flush();
    expect(jobs.filter((j) => j.template === 'order_shipped')).toHaveLength(1);
  });
});

function readPayments(): Array<{ order_id: string }> {
  try {
    return readFileSync(PAYMENTS, 'utf8')
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as { order_id: string });
  } catch {
    return [];
  }
}
