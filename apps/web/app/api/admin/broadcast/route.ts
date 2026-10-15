/**
 * Owner broadcast record — POST /api/admin/broadcast.
 *
 * Records a composed broadcast as an append-only DRAFT in the broadcasts
 * ledger (lib/broadcast/broadcast.ts), with an audience snapshot computed
 * at record time from the real stores (consented newsletter signups +
 * active Living Grimoire subscribers, deduplicated).
 *
 * THIS ROUTE DOES NOT SEND EMAIL. No email provider is bound to this app
 * (Phase 3 decision), there is no send path anywhere in the codebase,
 * and the recorded status is literally 'recorded_not_sent' — the
 * response says so, the ledger says so, and the admin UI says so. When a
 * provider is bound, delivery will consume these drafts; nothing here
 * may ever report a send that did not happen.
 *
 * BRIDGE AUTH — the shared owner-secret check (lib/admin/owner-auth.ts),
 * identical contract to POST /api/admin/subscriptions/confirm:
 * - `OWNER_ADMIN_SECRET` unset/empty → 404, nothing changes.
 * - Wrong/absent secret → 401, nothing changes.
 * - The secret and the header value are NEVER logged.
 * Rate-limited first, on the STRICT 'admin' group.
 *
 * SERVER-ONLY: reads a server env secret and the filesystem ledgers.
 * Never import from a client component.
 */
import { NextResponse } from 'next/server';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isRecord, sanitizePlainText } from '../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';
import { ownerAuthorized } from '../../../../lib/admin/owner-auth';
import {
  broadcastsLedgerPath,
  buildBroadcastDraft,
  computeBroadcastAudience,
  type BroadcastDraftRecord,
} from '../../../../lib/broadcast/broadcast';

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

/** Append-only ledger write — same pattern as the other owner routes. */
function persistBroadcast(record: BroadcastDraftRecord): void {
  const path = broadcastsLedgerPath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf8');
}

/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  // Strict per-IP budget (lib/security/rate-limit): caps failed-auth
  // guessing against the owner secret before any auth work happens.
  const limited = enforceRateLimit(request, 'admin');
  if (limited) return limited;

  const auth = ownerAuthorized(request);
  if (auth === 'unconfigured') {
    // Fail closed: with no secret configured this route does not exist.
    return fail(['Not found.'], 404);
  }
  if (auth === 'denied') {
    return fail(['Unauthorized.'], 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(['Request body must be valid JSON.']);
  }
  if (!isRecord(body)) {
    return fail(['Request body must be a JSON object.']);
  }

  // Plain-text only: with no provider bound there is no HTML rendering
  // pipeline to sanitize for, and the draft must be truthful about the
  // format that will eventually be sent.
  const subject = sanitizePlainText(body.subject, 150);
  if (!subject) {
    return fail(['A broadcast subject is required (150 characters max).']);
  }
  const message = sanitizePlainText(body.body, 5000);
  if (!message) {
    return fail(['A broadcast message is required (5000 characters max).']);
  }

  const audience = computeBroadcastAudience();
  const draft = buildBroadcastDraft({ subject, body: message, audience });

  try {
    persistBroadcast(draft);
  } catch (err) {
    return fail(
      [
        `Broadcast could not be recorded: ${
          err instanceof Error ? err.message : 'ledger write failed'
        }.`,
      ],
      500,
    );
  }

  return NextResponse.json(
    {
      ok: true,
      broadcast_id: draft.broadcast_id,
      delivery_status: draft.delivery_status,
      audience: {
        newsletter_recipients: draft.audience_newsletter,
        active_subscribers: draft.audience_active_subscribers,
        total_recipients: draft.audience_total,
      },
    },
    { status: 201 },
  );
}
