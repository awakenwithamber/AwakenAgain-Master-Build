/**
 * REGRESSION SUITE — contact Route Handler (G5).
 *
 * Laws under test:
 * - Valid submissions persist and return 200 + message_id + honest
 *   relay_status (webhook_unconfigured when no webhook is set).
 * - Validation failures → 422 with specific errors.
 * - Honeypot trips → 422 with the GENERIC message only — the trap is
 *   never revealed in the response.
 * - Malformed JSON → 400. No PII in analytics (covered by the analytics
 *   contract suite).
 */
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { POST } from '../app/api/contact/route';
import { CONTACT_HONEYPOT_FIELD } from '../lib/contact/contact';

const MESSAGES = join(
  mkdtempSync(join(tmpdir(), 'contact-route-')),
  'messages.jsonl',
);
process.env.CONTACT_MESSAGES_PATH = MESSAGES;

const VALID_BODY = {
  name: 'Test Customer',
  email: 'test@example.com',
  topic: 'order-question',
  message: 'Hello — I have a question about my recent order, please.',
};

async function postContact(body: unknown, raw?: string) {
  const res = await POST(
    new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw ?? JSON.stringify(body),
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe('contact route', () => {
  afterEach(() => {
    delete process.env.ZAPIER_CONTACT_WEBHOOK;
  });

  it('accepts a valid message, persists it, and reports relay status honestly', async () => {
    const { status, json } = await postContact(VALID_BODY);
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.message_id).toMatch(/^MSG-\d{8}-[A-Z0-9]{6}$/);
    // No webhook configured in tests → honest unconfigured status.
    expect(json.relay_status).toBe('webhook_unconfigured');

    const lines = readFileSync(MESSAGES, 'utf8').trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
    expect(last.message_id).toBe(json.message_id);
    expect(last.email).toBe('test@example.com');
    expect(last.topic).toBe('order-question');
  });

  it('rejects invalid submissions with 422 and specific errors', async () => {
    const { status, json } = await postContact({
      name: '',
      email: 'bad',
      topic: 'nope',
      message: 'hi',
    });
    expect(status).toBe(422);
    expect(json.ok).toBe(false);
    expect((json.errors as string[]).length).toBeGreaterThan(0);
  });

  it('rejects honeypot trips with the generic message — trap never revealed', async () => {
    const { status, json } = await postContact({
      ...VALID_BODY,
      [CONTACT_HONEYPOT_FIELD]: 'http://spam.example',
    });
    expect(status).toBe(422);
    expect(json.ok).toBe(false);
    const errors = (json.errors as string[]).join(' ').toLowerCase();
    expect(errors).not.toContain('honeypot');
    expect(errors).not.toContain('website');
    expect(errors).not.toContain('spam');

    // Spam never reaches the message store.
    let stored = '';
    try {
      stored = readFileSync(MESSAGES, 'utf8');
    } catch {
      stored = '';
    }
    expect(stored).not.toContain('spam.example');
  });

  it('rejects malformed JSON with 400', async () => {
    const { status, json } = await postContact(null, '{not json');
    expect(status).toBe(400);
    expect(json.ok).toBe(false);
  });
});
