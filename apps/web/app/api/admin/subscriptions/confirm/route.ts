/**
 * Owner subscription confirmation — POST /api/admin/subscriptions/confirm.
 *
 * BRIDGE AUTH — this route is protected by a dedicated server-side secret
 * (env `OWNER_ADMIN_SECRET`, presented in the `x-owner-secret` header and
 * compared in constant time) ONLY until Phase 2 real admin auth replaces
 * it. The existing admin gate (lib/admin/auth.ts) is a preview toggle
 * (ADMIN_PREVIEW_ENABLED), NOT authentication, so it is deliberately not
 * used here. When real admin auth lands, swap `ownerAuthorized()` for it
 * and retire the env secret.
 *
 * Fail-closed contract:
 * - `OWNER_ADMIN_SECRET` unset/empty → 404, nothing changes (the route is
 *   indistinguishable from a route that does not exist).
 * - Wrong/absent secret → 401, nothing changes.
 * - The secret and the header value are NEVER logged.
 *
 * Semantics: the ONLY transition performed here is pending_payment →
 * active, via `confirmSubscription()` (lib/subscriptions/subscriptions.ts)
 * — the same owner-confirmation step the entitlement lookup trusts.
 * Confirmation appends the confirmed record to the append-only JSONL
 * ledger (latest line per email wins), exactly like the subscribe route.
 * A `cancelled` subscription is NEVER resurrected (409). An unknown email
 * creates NOTHING (404). Confirming an already-`active` member is a 200
 * no-op (idempotent).
 *
 * SERVER-ONLY: reads a server env secret and the filesystem ledger.
 * Never import from a client component.
 */
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isRecord, sanitizeEmail } from '../../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../../lib/security/rate-limit';
import {
  findLatestSubscriptionRecord,
  subscriptionsLedgerPath,
} from '../../../../../lib/subscriptions/entitlement';
import {
  confirmSubscription,
  type SubscriptionRecord,
} from '../../../../../lib/subscriptions/subscriptions';

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

type OwnerAuth = 'unconfigured' | 'denied' | 'granted';

/**
 * Constant-time check of the `x-owner-secret` header against the
 * server-side `OWNER_ADMIN_SECRET`. The length guard runs first because
 * timingSafeEqual throws on unequal-length buffers; length itself is not
 * treated as secret. Nothing here logs either value.
 */
function ownerAuthorized(request: Request): OwnerAuth {
  const expected = process.env.OWNER_ADMIN_SECRET;
  if (!expected) return 'unconfigured';
  const presented = request.headers.get('x-owner-secret');
  if (!presented) return 'denied';
  const presentedBuf = Buffer.from(presented, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (presentedBuf.length !== expectedBuf.length) return 'denied';
  return timingSafeEqual(presentedBuf, expectedBuf) ? 'granted' : 'denied';
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
  const limited = enforceRateLimit(request, 'admin-confirm');
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
    // Never create a record here — confirmation only transitions an
    // existing signup.
    return fail([`No subscription found for ${email}.`], 404);
  }

  if (latest.status === 'cancelled') {
    // Never resurrect a cancelled subscription.
    return NextResponse.json(
      {
        ok: false,
        email,
        status: latest.status,
        errors: [
          `Subscription for ${email} is cancelled and cannot be confirmed.`,
        ],
      },
      { status: 409 },
    );
  }

  if (latest.status === 'active') {
    // Idempotent: already confirmed — no ledger write, no change.
    return NextResponse.json({ ok: true, email, status: 'active' });
  }

  // Only pending_payment remains. confirmSubscription() enforces the same
  // law (throws for anything else); guard above keeps that unreachable.
  let confirmed: SubscriptionRecord;
  try {
    confirmed = confirmSubscription(latest);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        email,
        status: latest.status,
        errors: [
          err instanceof Error ? err.message : 'Subscription cannot be confirmed.',
        ],
      },
      { status: 409 },
    );
  }

  try {
    persistSubscription(confirmed);
  } catch (err) {
    return fail(
      [
        `Confirmation could not be recorded: ${
          err instanceof Error ? err.message : 'ledger write failed'
        }.`,
      ],
      500,
    );
  }

  return NextResponse.json({ ok: true, email, status: confirmed.status });
}
