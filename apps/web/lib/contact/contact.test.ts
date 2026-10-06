/**
 * REGRESSION SUITE — contact pipeline validation + store (G5).
 *
 * Laws under test:
 * - Valid submissions validate, sanitize (HTML/control chars stripped),
 *   and normalize (email lowercased, phone digit-normalized).
 * - Missing/invalid fields → specific errors; bad topic rejected by the
 *   server-side whitelist; short messages rejected.
 * - Honeypot trip → spam flag with a GENERIC message only — the trap is
 *   never revealed in the response, and no record is produced.
 * - The contact store round-trips through the provider-neutral
 *   RecordStore interface (same contract as orders).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CONTACT_HONEYPOT_FIELD,
  CONTACT_TOPICS,
  createContactStore,
  spamRejectionMessage,
  toContactReviewEntry,
  validateContactMessage,
  type ContactRecord,
  type ContactReviewEntry,
} from './contact';
import {
  JsonlRecordStore,
  type RecordStore,
} from '../orders/store';

const MESSAGES = join(mkdtempSync(join(tmpdir(), 'contact-test-')), 'messages.jsonl');
process.env.CONTACT_MESSAGES_PATH = MESSAGES;

const VALID_INPUT = {
  name: 'Test Customer',
  email: 'Test@Example.COM',
  phone: '(801) 414-8984',
  topic: 'order-question',
  message: 'Hello — I have a question about my recent order, please.',
};

describe('validateContactMessage', () => {
  it('accepts a valid message and sanitizes + normalizes fields', () => {
    const result = validateContactMessage(VALID_INPUT);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    const record = result.record;
    expect(record).toBeDefined();
    if (!record) return;
    expect(record.message_id).toMatch(/^MSG-\d{8}-[A-Z0-9]{6}$/);
    expect(record.record_version).toBe(1);
    expect(record.email).toBe('test@example.com');
    expect(record.phone).toBe('8014148984'); // no '+' in input → digits only
    expect(record.topic).toBe('order-question');
    expect(record.topic_label).toBe(
      CONTACT_TOPICS.find((t) => t.id === 'order-question')?.label,
    );
    expect(record.relay.form_type).toBe('contact');
    expect(record.relay.status).toBe('queued');
  });

  it('strips HTML and control characters from name and message', () => {
    const result = validateContactMessage({
      ...VALID_INPUT,
      name: '<b>Test</b>\u0000 Customer',
      message: 'Hello <script>alert(1)</script> world, this is a real message.',
    });
    expect(result.valid).toBe(true);
    const record = result.record;
    expect(record).toBeDefined();
    if (!record) return;
    expect(record.name).not.toContain('<');
    expect(record.message).not.toContain('<script>');
    expect(record.message).toContain('real message');
  });

  it('requires name, email, topic, and a sufficiently long message', () => {
    const result = validateContactMessage({
      name: '',
      email: 'not-an-email',
      topic: 'made-up-topic',
      message: 'hi',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
    const joined = result.errors.join(' ');
    expect(joined).toMatch(/name/);
    expect(joined).toMatch(/email/);
    expect(joined).toMatch(/topic/);
    expect(joined).toMatch(/short/);
  });

  it('rejects topics outside the server-side whitelist', () => {
    const result = validateContactMessage({
      ...VALID_INPUT,
      topic: 'free-stuff-please',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/topic/);
    expect(result.record).toBeUndefined();
  });

  it('accepts every whitelisted topic', () => {
    for (const topic of CONTACT_TOPICS) {
      const result = validateContactMessage({ ...VALID_INPUT, topic: topic.id });
      expect(result.valid).toBe(true);
    }
  });

  it('treats phone as optional and validates it when present', () => {
    const noPhone = validateContactMessage({ ...VALID_INPUT, phone: '' });
    expect(noPhone.valid).toBe(true);
    expect(noPhone.record?.phone).toBeUndefined();

    const badPhone = validateContactMessage({ ...VALID_INPUT, phone: 'abc' });
    expect(badPhone.valid).toBe(false);
    expect(badPhone.errors.join(' ')).toMatch(/phone/i);
  });

  it('flags a filled honeypot as spam with a generic message — never revealed', () => {
    const result = validateContactMessage({
      ...VALID_INPUT,
      [CONTACT_HONEYPOT_FIELD]: 'http://spam.example',
    });
    expect(result.valid).toBe(false);
    expect(result.spam).toBe(true);
    expect(result.record).toBeUndefined();
    expect(result.errors).toEqual([spamRejectionMessage()]);
    // The response must not reveal the trap.
    const joined = result.errors.join(' ').toLowerCase();
    expect(joined).not.toContain('honeypot');
    expect(joined).not.toContain('website');
    expect(joined).not.toContain('spam');
  });

  it('an empty honeypot passes through to normal validation', () => {
    const result = validateContactMessage({
      ...VALID_INPUT,
      [CONTACT_HONEYPOT_FIELD]: '',
    });
    expect(result.valid).toBe(true);
    expect(result.spam).toBeUndefined();
  });

  it('rejects non-object bodies', () => {
    expect(validateContactMessage(null).valid).toBe(false);
    expect(validateContactMessage('text').valid).toBe(false);
    expect(validateContactMessage([]).valid).toBe(false);
  });
});

describe('contact store round-trip', () => {
  let dir: string;
  let store: RecordStore<ContactRecord, ContactReviewEntry>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'contact-rt-'));
    store = new JsonlRecordStore<ContactRecord, ContactReviewEntry>({
      path: join(dir, 'messages.jsonl'),
      getId: (r) => r.message_id,
      toSummary: toContactReviewEntry,
    });
  });

  it('persists and reads back a validated message', async () => {
    const validation = validateContactMessage(VALID_INPUT);
    expect(validation.valid).toBe(true);
    if (!validation.record) return;

    const receipt = await store.append(validation.record);
    expect(receipt.backend).toBe('jsonl');
    expect(receipt.id).toBe(validation.record.message_id);

    const fetched = await store.get(validation.record.message_id);
    expect(fetched?.email).toBe('test@example.com');
    expect(fetched?.message).toContain('recent order');
  });

  it('review queue returns message summaries newest-first with capped preview', async () => {
    for (const topic of ['order-question', 'something-else'] as const) {
      const v = validateContactMessage({ ...VALID_INPUT, topic });
      if (v.record) await store.append(v.record);
    }
    const queue = await store.reviewQueue();
    expect(queue).toHaveLength(2);
    expect(queue[0]?.topic).toBe('something-else');
    expect(queue[0]?.message_preview.length).toBeLessThanOrEqual(160);
    expect(queue[0]?.relay_status).toBe('queued');
  });

  it('createContactStore honors CONTACT_MESSAGES_PATH', async () => {
    const validation = validateContactMessage(VALID_INPUT);
    if (!validation.record) return;
    await createContactStore().append(validation.record);
    const fetched = await createContactStore().get(validation.record.message_id);
    expect(fetched?.message_id).toBe(validation.record.message_id);
  });
});
