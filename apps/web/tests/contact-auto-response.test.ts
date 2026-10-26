/**
 * Contact auto-response — ROUTE-level laws (2026-10-25):
 * - An accepted message triggers exactly one auto-response email to the
 *   sender (Resend SDK mocked — zero real network).
 * - A validation failure (422) triggers NO auto-response.
 * - A provider that throws still leaves the request at 200 with the
 *   unchanged response shape { ok, message_id, relay_status }.
 *
 * The route fires the auto-response fire-and-forget after persistence,
 * so assertions wait for the mocked send to land (vi.waitFor).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const hoisted = vi.hoisted(() => ({
  calls: [] as Record<string, unknown>[],
  shouldThrow: false,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: async (args: Record<string, unknown>) => {
        hoisted.calls.push(args);
        if (hoisted.shouldThrow) throw new Error('resend is down');
        return { data: { id: 're_mock_1' }, error: null };
      },
    };
  },
}));

import { POST } from '../app/api/contact/route';

const MESSAGES = join(
  mkdtempSync(join(tmpdir(), 'contact-autoresponse-')),
  'messages.jsonl',
);

const VALID_BODY = {
  name: 'Test Customer',
  email: 'test@example.com',
  topic: 'something-else',
  message: 'Hello — I am new to herbs and not sure where to start.',
};

async function postContact(body: unknown) {
  const res = await POST(
    new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return {
    status: res.status,
    json: (await res.json()) as Record<string, unknown>,
  };
}

describe('contact route auto-response', () => {
  beforeEach(() => {
    process.env.CONTACT_MESSAGES_PATH = MESSAGES;
    process.env.RESEND_API_KEY = 're_mock_key_for_tests';
    hoisted.calls.length = 0;
    hoisted.shouldThrow = false;
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.ZAPIER_CONTACT_WEBHOOK;
  });

  it('sends exactly one auto-response on an accepted message', async () => {
    const { status, json } = await postContact(VALID_BODY);
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.relay_status).toBe('webhook_unconfigured');

    await vi.waitFor(() => expect(hoisted.calls).toHaveLength(1), {
      timeout: 3000,
    });
    const sent = hoisted.calls[0];
    expect(sent.to).toBe('test@example.com');
    expect(sent.subject).toBe(
      "We've received your message ✦ Amber's Alchemy Apothecary",
    );
    expect(String(sent.text)).toContain('Hello Test Customer,');
    expect(String(sent.text)).toContain('801-819-6795');
    // HTML part is rendered by the transport for non-purchase templates.
    expect(String(sent.html)).toContain('801-819-6795');
    expect(String(sent.html)).not.toContain('414-8984');
  });

  it('sends no auto-response when validation fails', async () => {
    const { status } = await postContact({
      name: '',
      email: 'not-an-email',
      topic: 'nope',
      message: 'hi',
    });
    expect(status).toBe(422);
    // Give the fire-and-forget path every chance to (not) fire.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(hoisted.calls).toHaveLength(0);
  });

  it('still returns 200 with the unchanged shape when the provider throws', async () => {
    hoisted.shouldThrow = true;
    const { status, json } = await postContact({
      ...VALID_BODY,
      email: 'second@example.com',
      message: 'A second message, long enough to pass validation.',
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.message_id).toMatch(/^MSG-\d{8}-[A-Z0-9]{6}$/);
    expect(json.relay_status).toBe('webhook_unconfigured');
    // The send was attempted (and failed) without breaking the request.
    await vi.waitFor(() => expect(hoisted.calls).toHaveLength(1), {
      timeout: 3000,
    });
  });
});
