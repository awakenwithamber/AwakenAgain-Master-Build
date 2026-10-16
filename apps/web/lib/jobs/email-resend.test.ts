/**
 * Resend provider binding — Phase 3 Step 2.
 *
 * Laws under test:
 * - The factory binds Resend ONLY when RESEND_API_KEY is set and
 *   non-empty; unset/empty/whitespace keeps the logging preview, and
 *   emailDeliveryIsPreview() tracks the binding.
 * - ResendEmailProvider posts the rendered message to the Resend API
 *   with the bearer key, the configured/default From, and the job's
 *   recipient — for every template, including the sign-in code in the
 *   account_signin_code body (delivery is that template's purpose).
 * - The sign-in code NEVER appears in logs or in a returned result.
 * - Delivery failures surface as { ok: false, error } (never thrown,
 *   never ok), mirroring the logging provider's contract exactly, and
 *   failed jobs are not recorded as sent.
 * - Zero real network: every send runs against an injected fake fetch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_EMAIL_FROM,
  RESEND_API_URL,
  ResendEmailProvider,
  buildAccountSigninCodeJob,
  buildEmailJob,
  buildPurchaseConfirmationJob,
  buildQuizResultsJob,
  createEmailProvider,
  emailDeliveryIsPreview,
} from './email';
import { getQuizResult, toQuizResultSnapshot } from '../quiz/quiz';

const TEST_CODE = '483920';

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function capturingFetch(
  handler: (call: CapturedCall) => Promise<Response> | Response,
) {
  const calls: CapturedCall[] = [];
  const fetchFn = (async (url: unknown, init?: RequestInit) => {
    const call: CapturedCall = { url: String(url), init: init ?? {} };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

function sentPayload(call: CapturedCall): Record<string, unknown> {
  return JSON.parse(String(call.init.body)) as Record<string, unknown>;
}

function purchaseJob() {
  return buildPurchaseConfirmationJob('customer@example.com', {
    order_id: 'AWK-20261005-ABC123',
    total_cents: 3577,
    item_summary: 'The Alchemy Soap Collection',
    cash_app_handle: '$AmberPatten347',
    venmo_handle: '@AwakenwithAmber',
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('createEmailProvider — Resend binding (Phase 3 Step 2)', () => {
  it('binds Resend only when RESEND_API_KEY is set and non-empty', () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    expect(createEmailProvider().name).toBe('resend');
    expect(emailDeliveryIsPreview()).toBe(false);
  });

  it('keeps the logging preview when the key is unset, empty, or whitespace', () => {
    vi.stubEnv('RESEND_API_KEY', '');
    expect(createEmailProvider().name).toBe('logging');
    expect(emailDeliveryIsPreview()).toBe(true);

    vi.stubEnv('RESEND_API_KEY', '   ');
    expect(createEmailProvider().name).toBe('logging');
    expect(emailDeliveryIsPreview()).toBe(true);
  });
});

describe('ResendEmailProvider — request shape', () => {
  it('posts a rendered purchase confirmation to the Resend API', async () => {
    const { fetchFn, calls } = capturingFetch(async () =>
      jsonResponse(200, { id: 'msg-123' }),
    );
    const provider = new ResendEmailProvider({
      apiKey: 're_test_key',
      fetchFn,
    });
    const result = await provider.send(purchaseJob());

    expect(result).toEqual({ ok: true, provider_message_id: 'msg-123' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(RESEND_API_URL);
    expect(calls[0].init.method).toBe('POST');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_test_key');
    expect(headers['Content-Type']).toBe('application/json');

    const payload = sentPayload(calls[0]);
    expect(payload.from).toBe(DEFAULT_EMAIL_FROM);
    expect(payload.to).toEqual(['customer@example.com']);
    expect(payload.subject).toContain('AWK-20261005-ABC123');
    expect(String(payload.text)).toContain('The Alchemy Soap Collection');
    expect(String(payload.text)).toContain('$35.77');

    expect(provider.sentJobs()).toHaveLength(1);
    expect(provider.sentJobs()[0].status).toBe('sent');
    expect(provider.sentJobs()[0].attempts).toBe(1);
  });

  it('renders the sign-in code into the email body — and nowhere else', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchFn, calls } = capturingFetch(async () =>
      jsonResponse(200, { id: 'msg-code' }),
    );
    const provider = new ResendEmailProvider({
      apiKey: 're_test_key',
      fetchFn,
    });
    const job = buildAccountSigninCodeJob('visitor@example.com', {
      code: TEST_CODE,
      expires_in_minutes: 10,
    });
    const result = await provider.send(job);

    expect(result.ok).toBe(true);
    const payload = sentPayload(calls[0]);
    expect(payload.to).toEqual(['visitor@example.com']);
    expect(String(payload.text)).toContain(TEST_CODE);
    expect(String(payload.text)).toContain('10 minutes');
    // The code is the payload's secret: never in the result, never logged.
    expect(JSON.stringify(result)).not.toContain(TEST_CODE);
    for (const spy of [infoSpy, errorSpy]) {
      for (const args of spy.mock.calls) {
        expect(JSON.stringify(args)).not.toContain(TEST_CODE);
      }
    }
  });

  it('renders every remaining template with its subject and body content', async () => {
    const { fetchFn, calls } = capturingFetch(async () =>
      jsonResponse(200, { id: 'msg-x' }),
    );
    const provider = new ResendEmailProvider({
      apiKey: 're_test_key',
      fetchFn,
    });

    await provider.send(
      buildEmailJob({
        to: 'a@b.com',
        template: 'weekly_promo',
        data: {
          subject: 'Autumn apothecary notes',
          headline: 'Fall blends are here',
          body: 'Warm cinnamon comfort, bottled.',
          cta_url: 'https://www.awakenagain.com/shop',
        },
      }),
    );
    await provider.send(
      buildEmailJob({
        to: 'a@b.com',
        template: 'unsubscribe_confirmation',
        data: { suppressed_at: '2026-10-15T00:00:00.000Z' },
      }),
    );
    await provider.send(
      buildEmailJob({
        to: 'a@b.com',
        template: 'review_reminder',
        data: {
          order_id: 'AWK-1',
          product_summary: 'Lavender Alchemy Soap',
          review_url: 'https://awakenagain.com/reviews',
        },
      }),
    );
    const snapshot = toQuizResultSnapshot(getQuizResult('energy', 'capsule')!);
    await provider.send(
      buildQuizResultsJob('a@b.com', { name: 'Friend', result: snapshot }),
    );

    const payloads = calls.map(sentPayload);
    expect(payloads[0].subject).toBe('Autumn apothecary notes');
    expect(String(payloads[0].text)).toContain('Fall blends are here');
    expect(String(payloads[1].subject)).toMatch(/unsubscribed/i);
    expect(String(payloads[2].subject)).toContain('Lavender Alchemy Soap');
    expect(String(payloads[2].text)).toContain('https://awakenagain.com/reviews');
    expect(String(payloads[3].text)).toContain('Ashwagandha');
    expect(String(payloads[3].text)).toContain('/shop/');
    expect(provider.sentJobs()).toHaveLength(4);
  });

  it('honors an explicit From and the EMAIL_FROM env override', async () => {
    const { fetchFn, calls } = capturingFetch(async () =>
      jsonResponse(200, { id: 'msg-f' }),
    );
    const explicit = new ResendEmailProvider({
      apiKey: 're_test_key',
      from: 'Custom <hello@awakenagain.com>',
      fetchFn,
    });
    await explicit.send(purchaseJob());
    expect(sentPayload(calls[0]).from).toBe('Custom <hello@awakenagain.com>');

    vi.stubEnv('EMAIL_FROM', 'Env Sender <env@awakenagain.com>');
    const fromEnv = new ResendEmailProvider({
      apiKey: 're_test_key',
      fetchFn,
    });
    await fromEnv.send(purchaseJob());
    expect(sentPayload(calls[1]).from).toBe('Env Sender <env@awakenagain.com>');
  });
});

describe('ResendEmailProvider — failure propagation', () => {
  it('returns { ok: false } with the API error and records nothing sent', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchFn, calls } = capturingFetch(async () =>
      jsonResponse(422, {
        name: 'validation_error',
        message: 'The from address is not verified.',
      }),
    );
    const provider = new ResendEmailProvider({
      apiKey: 're_test_key',
      fetchFn,
    });
    const result = await provider.send(purchaseJob());
    expect(result.ok).toBe(false);
    expect(result.error).toContain('422');
    expect(result.error).toContain('validation_error');
    expect(calls).toHaveLength(1);
    expect(provider.sentJobs()).toHaveLength(0);
  });

  it('returns { ok: false } on a network throw instead of throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchFn } = capturingFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const provider = new ResendEmailProvider({
      apiKey: 're_test_key',
      fetchFn,
    });
    const result = await provider.send(purchaseJob());
    expect(result.ok).toBe(false);
    expect(result.error).toContain('fetch failed');
    expect(provider.sentJobs()).toHaveLength(0);
  });

  it('never leaks the sign-in code into an error or a log line', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchFn } = capturingFetch(async () =>
      jsonResponse(500, { name: 'internal_error', message: 'boom' }),
    );
    const provider = new ResendEmailProvider({
      apiKey: 're_test_key',
      fetchFn,
    });
    const job = buildAccountSigninCodeJob('visitor@example.com', {
      code: TEST_CODE,
      expires_in_minutes: 10,
    });
    const result = await provider.send(job);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(TEST_CODE);
    for (const args of errorSpy.mock.calls) {
      expect(JSON.stringify(args)).not.toContain(TEST_CODE);
    }
  });

  it('refuses a non-queued job without calling the API (logging parity)', async () => {
    const { fetchFn, calls } = capturingFetch(async () =>
      jsonResponse(200, { id: 'msg-never' }),
    );
    const provider = new ResendEmailProvider({
      apiKey: 're_test_key',
      fetchFn,
    });
    const job = purchaseJob();
    const result = await provider.send({ ...job, status: 'sent' });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
