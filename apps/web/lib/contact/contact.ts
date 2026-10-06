/**
 * Contact message validation + record shape (G5).
 *
 * Server-side validation for POST /api/contact. Mirrors the legacy
 * contact.html fields (name/email/phone/topic/message) minus the legacy
 * Netlify form wiring — the new pipeline is:
 *   validate → sanitize → persist (provider-neutral store) → form-relay
 *   job (Zapier/email handoff, provider-neutral contract).
 *
 * All customer fields are sanitized before they enter the record: HTML
 * tags + control characters are stripped, email is normalized, phone is
 * normalized to a digit string. The message store is server-side only and
 * NEVER flows into PostHog (see lib/analytics — contact events carry
 * message_id/topic only, never names, emails, or message text).
 */
import {
  isRecord,
  sanitizeEmail,
  sanitizePhone,
  sanitizePlainText,
} from '../security/validation';
import type { RecordStore } from '../orders/store';
import { JsonlRecordStore } from '../orders/store';
import { join } from 'node:path';
import {
  CONTACT_HONEYPOT_FIELD,
  CONTACT_TOPICS,
  contactTopicLabel,
  type ContactTopicId,
} from './topics';

/** Re-exported so existing imports keep working (single source of truth). */
export {
  CONTACT_HONEYPOT_FIELD,
  CONTACT_TOPICS,
  contactTopicLabel,
  type ContactTopicId,
};

/** Raw client input shape for the contact form. */
export interface ContactMessageInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  topic?: unknown;
  message?: unknown;
  /** Honeypot — any non-empty value marks the submission as spam. */
  website?: unknown;
}

/** Durable contact record — what the store persists. */
export interface ContactRecord {
  message_id: string;
  created_at: string;
  record_version: 1;
  name: string;
  email: string;
  phone?: string;
  topic: ContactTopicId;
  topic_label: string;
  message: string;
  /** Form-relay handoff state (Zapier/email) — see lib/jobs/form-relay.ts. */
  relay: {
    form_type: 'contact';
    status: 'queued';
  };
}

/** Fulfillment-adjacent summary for the message review queue. */
export interface ContactReviewEntry {
  message_id: string;
  created_at: string;
  name: string;
  topic: ContactTopicId;
  topic_label: string;
  message_preview: string;
  relay_status: 'queued';
}

export function toContactReviewEntry(record: ContactRecord): ContactReviewEntry {
  return {
    message_id: record.message_id,
    created_at: record.created_at,
    name: record.name,
    topic: record.topic,
    topic_label: record.topic_label,
    message_preview: record.message.slice(0, 160),
    relay_status: 'queued',
  };
}

/** Env override for tests/preview; default is the local JSONL message log. */
export function defaultContactMessagesPath(): string {
  return (
    process.env.CONTACT_MESSAGES_PATH ??
    join(process.cwd(), '.contact-messages.jsonl')
  );
}

/** Contact store wired to its own JSONL file (env-overridable). */
export function createContactStore(): RecordStore<
  ContactRecord,
  ContactReviewEntry
> {
  return new JsonlRecordStore<ContactRecord, ContactReviewEntry>({
    path: defaultContactMessagesPath,
    getId: (record) => record.message_id,
    toSummary: toContactReviewEntry,
  });
}

function generateMessageId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MSG-${date}-${rand}`;
}

export interface ContactValidation {
  valid: boolean;
  errors: string[];
  /** Present only when valid AND not spam. */
  record?: ContactRecord;
  /** Honeypot tripped — caller returns a generic error, never reveals this. */
  spam?: boolean;
}

const GENERIC_SPAM_ERROR =
  'Something went wrong sending your message. Please try again.';

/**
 * Validate + sanitize a contact submission. Returns a spam flag instead of
 * an error when the honeypot is filled — the Route Handler must respond
 * with the generic message so bots learn nothing.
 */
export function validateContactMessage(body: unknown): ContactValidation {
  if (!isRecord(body)) {
    return { valid: false, errors: ['Request body must be a JSON object.'] };
  }
  const input = body as ContactMessageInput;

  // Honeypot first: a filled trap field is spam, full stop. No further
  // validation, no detail in the response.
  if (
    typeof input.website === 'string' &&
    input.website.trim().length > 0
  ) {
    return { valid: false, errors: [GENERIC_SPAM_ERROR], spam: true };
  }

  const errors: string[] = [];

  const name = sanitizePlainText(input.name, 120);
  if (!name) errors.push('Please tell us your name.');

  const email = sanitizeEmail(input.email);
  if (!email) errors.push('Please provide a valid email address.');

  const topic =
    typeof input.topic === 'string' ? input.topic.trim() : '';
  const topicLabel = contactTopicLabel(topic);
  if (!topicLabel) errors.push('Please choose a topic for your message.');

  const message = sanitizePlainText(input.message, 5000);
  if (message.length < 10) {
    errors.push('Your message is a little short — please add a bit more detail.');
  }

  let phone: string | undefined;
  const phoneRaw =
    typeof input.phone === 'string' ? input.phone.trim() : '';
  if (phoneRaw) {
    const normalized = sanitizePhone(phoneRaw);
    if (!normalized) {
      errors.push('Please provide a valid phone number, or leave it blank.');
    } else {
      phone = normalized;
    }
  }

  if (errors.length > 0 || !email || !topicLabel) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    record: {
      message_id: generateMessageId(),
      created_at: new Date().toISOString(),
      record_version: 1,
      name,
      email,
      ...(phone ? { phone } : {}),
      topic: topic as ContactTopicId,
      topic_label: topicLabel,
      message,
      relay: { form_type: 'contact', status: 'queued' },
    },
  };
}

/** The generic, non-revealing response for spam-filtered submissions. */
export function spamRejectionMessage(): string {
  return GENERIC_SPAM_ERROR;
}
