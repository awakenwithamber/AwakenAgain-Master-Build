/**
 * Owner subscription cancellation — POST /api/admin/subscriptions/cancel.
 *
 * The mirror of POST /api/admin/subscriptions/confirm: same bridge auth
 * (shared check in lib/admin/owner-auth.ts), same fail-closed contract,
 * same append-only ledger discipline — the ONLY transition performed
 * here is → cancelled, via `cancelSubscription()`
 * (lib/subscriptions/subscriptions.ts). Cancellation appends a new ledger
 * line (stamped cancelled_at / cancelled_by: 'owner'); history is never
 * edited, and entitlement (latest line wins) stops verifying the member
 * immediately.
 *
 * Fail-closed contract:
 * - `OWNER_ADMIN_SECRET` unset/empty → 404, nothing changes.
 * - Wrong/absent secret → 401, nothing changes.
 * - The secret and the header value are NEVER logged.
 *
 * Semantics: an unknown email creates NOTHING (404). Cancelling an
 * already-`cancelled` member is a 200 no-op (idempotent — the pure
 * transition is too, this just avoids a redundant ledger line).
 * `pending_payment` and `active` members can both be cancelled.
 *
 * SERVER-ONLY: reads a server env secret and the filesystem ledger.
 * Never import from a client component.
 */
import { NextResponse } from 'next/server';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isRecord, sanitizeEmail } from '../../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../../lib/security/rate-limit';
import { ownerAuthorized } from '../../../../../lib/admin/owner-auth';
import {
  findLatestSubscriptionRecord,
  subscriptionsLedgerPath,
} from '../../../../../lib/subscriptions/entitlement';
import {
  cancelSubscription,
  type SubscriptionRecord,
} from '../../../../../lib/subscriptions/subscriptions';

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

/** Append-only ledger write — same pattern as POST /api/subscriptions. */
function persistSubscription(record: SubscriptionRecord): void {
  const path = subscriptionsLedgerPath();
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
  // sanitizeEmail validates AND normalizes (trim + lowercase) exactly as
  // entitlement matching expects; null → malformed.
  const email = sanitizeEmail(body.email);
  if (!email) {
    return fail(['A valid email address is required.']);
  }

  const latest = findLatestSubscriptionRecord(email);
  if (!latest) {
    // Never create a record here — cancellation only transitions an
    // existing subscription.
    return fail([`No subscription found for ${email}.`], 404);
  }

  if (latest.status === 'cancelled') {
    // Idempotent: already cancelled — no ledger write, no change.
    return NextResponse.json({ ok: true, email, status: 'cancelled' });
  }

  // pending_payment or active. cancelSubscription() is the pure
  // transition; the appended line also carries the cancellation stamp
  // (the base record shape leaves stamping to the writer, mirroring how
  // confirmSubscription stamps confirmed_at / confirmed_by).
  const cancelled: SubscriptionRecord & {
    cancelled_at: string;
    cancelled_by: 'owner';
  } = {
    ...cancelSubscription(latest),
    cancelled_at: new Date().toISOString(),
    cancelled_by: 'owner',
  };

  try {
    persistSubscription(cancelled);
  } catch (err) {
    return fail(
      [
        `Cancellation could not be recorded: ${
          err instanceof Error ? err.message : 'ledger write failed'
        }.`,
      ],
      500,
    );
  }

  return NextResponse.json({ ok: true, email, status: cancelled.status });
}
