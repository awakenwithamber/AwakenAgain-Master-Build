/**
 * Contact Route Handler (G5) — the durable contact pipeline.
 *
 * POST /api/contact:
 *   validate → sanitize → persist (provider-neutral store) →
 *   form-relay job (webhook handoff, provider-neutral contract).
 *
 * This replaces the legacy contact.html → form-relay → Zapier flow
 * (CONVERSION_MAP §§84–86) as an explicit, typed pipeline:
 *   - Validation/sanitization: lib/contact/contact.ts (honeypot spam
 *     filter, email/phone normalization, topic whitelist).
 *   - Persistence: RecordStore (lib/orders/store.ts) — local JSONL today,
 *     so a message is never lost when no webhook is configured.
 *   - Handoff: lib/jobs/form-relay.ts — the Zapier/email handoff
 *     described as a provider-neutral job. Attempted fire-and-forget
 *     after persistence; the response stays honest about relay status.
 *
 * Response (always 200 on accepted input): { ok, message_id, relay_status }
 * where relay_status is 'relayed' | 'webhook_unconfigured' |
 * 'relay_failed' — the message itself is always durably stored first.
 * Validation failures → 422. Persistence failures → 500. Spam-filtered
 * submissions get the same generic error shape as other 422s (the
 * honeypot is never revealed).
 *
 * Analytics (server-owned, fire-and-forget, inert without the phc_ key):
 * contact_submitted / contact_accepted / contact_rejected. No PII in any
 * payload — message_id/topic only. The message store is the authority.
 */
import { NextResponse } from 'next/server';
import {
  createContactStore,
  spamRejectionMessage,
  validateContactMessage,
  type ContactRecord,
} from '../../../lib/contact/contact';
import {
  attemptFormRelay,
  buildFormRelayJob,
} from '../../../lib/jobs/form-relay';
import {
  captureServerEventSoon,
  resolveServerDistinctId,
} from '../../../lib/analytics/posthog-server';
import { ANALYTICS_EVENT_NAMES } from '../../../lib/analytics/events';

export type ContactRelayStatus =
  | 'relayed'
  | 'webhook_unconfigured'
  | 'relay_failed';

function generateAttemptId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `att_${Date.now().toString(36)}_${rand}`;
}

function distinctIdFor(request: Request, scope: string): string {
  return resolveServerDistinctId(
    request.headers.get('cookie'),
    `contact:${scope}`,
  );
}

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

/** Payload the relay job carries — sanitized record fields only. */
function relayPayload(record: ContactRecord): Record<string, unknown> {
  return {
    message_id: record.message_id,
    name: record.name,
    email: record.email,
    ...(record.phone ? { phone: record.phone } : {}),
    topic: record.topic,
    topic_label: record.topic_label,
    message: record.message,
    created_at: record.created_at,
  };
}

export async function POST(request: Request) {
  const attemptId = generateAttemptId();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    captureServerEventSoon(
      ANALYTICS_EVENT_NAMES.contactRejected,
      { attempt_id: attemptId, stage: 'validation', error_count: 1 },
      distinctIdFor(request, attemptId),
    );
    return fail(['Request body must be valid JSON.'], 400);
  }

  captureServerEventSoon(
    ANALYTICS_EVENT_NAMES.contactSubmitted,
    { attempt_id: attemptId },
    distinctIdFor(request, attemptId),
  );

  const validation = validateContactMessage(body);
  if (!validation.valid) {
    captureServerEventSoon(
      ANALYTICS_EVENT_NAMES.contactRejected,
      {
        attempt_id: attemptId,
        stage: validation.spam ? 'spam_filtered' : 'validation',
        error_count: validation.errors.length,
      },
      distinctIdFor(request, attemptId),
    );
    // Spam and ordinary validation failures share the generic shape —
    // the honeypot's existence is never revealed to the submitter.
    const errors = validation.spam
      ? [spamRejectionMessage()]
      : validation.errors;
    return fail(errors, 422);
  }

  const record = validation.record;
  if (!record) {
    return fail(['Something went wrong. Please try again.'], 500);
  }

  // Persist FIRST — the message is durable even if the webhook handoff
  // fails or is unconfigured. Amber's messages are never lost.
  const store = createContactStore();
  try {
    await store.append(record);
  } catch (err) {
    captureServerEventSoon(
      ANALYTICS_EVENT_NAMES.contactRejected,
      { attempt_id: attemptId, stage: 'persistence', error_count: 1 },
      distinctIdFor(request, attemptId),
    );
    return fail(
      [
        `Your message could not be saved: ${
          err instanceof Error ? err.message : 'store write failed'
        }. Please email Amber directly at awaken@consultant.com.`,
      ],
      500,
    );
  }

  // Relay SECOND — fire-and-forget handoff to the configured webhook.
  // The response is honest about the outcome; nothing here can un-save
  // the message.
  let relayStatus: ContactRelayStatus = 'webhook_unconfigured';
  try {
    const job = buildFormRelayJob({
      form_type: 'contact',
      record_id: record.message_id,
      payload: relayPayload(record),
      received_at: record.created_at,
    });
    const attempt = await attemptFormRelay(job);
    relayStatus = attempt.ok
      ? 'relayed'
      : attempt.error === 'webhook_unconfigured'
        ? 'webhook_unconfigured'
        : 'relay_failed';
  } catch {
    relayStatus = 'relay_failed';
  }

  captureServerEventSoon(
    ANALYTICS_EVENT_NAMES.contactAccepted,
    { message_id: record.message_id, topic: record.topic },
    distinctIdFor(request, record.message_id),
  );

  return NextResponse.json({
    ok: true,
    message_id: record.message_id,
    relay_status: relayStatus,
  });
}
