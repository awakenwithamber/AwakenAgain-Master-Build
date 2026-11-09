/**
 * POST /api/grimoire-unlock/request — ask for the $8.88 PERMANENT_UNLOCK
 * on the manual payment rail (Phase 2, Workstream 3; decision packet
 * 2026-10-24).
 *
 * Creates a PENDING unlock request (lib/grimoire/unlock-requests) and
 * answers with the payment instructions for exactly $8.88: an emailed
 * Bookipi invoice (Amber sends it; the owner is notified of the
 * request by email), or Venmo / Cash App with the REQUEST ID as the
 * payment reference. The request grants NOTHING — access exists only
 * after the owner verifies the payment and grants it (POST
 * /api/admin/grimoire/unlock); the customer then gets the "unlock is
 * active" email.
 *
 * Idempotent-ish by design: an email with an active unlock hears so;
 * an email with a pending request gets that same request back (with
 * fresh instructions), never a duplicate.
 */
import { NextResponse } from 'next/server';
import { isRecord, sanitizeEmail } from '../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';
import {
  CASH_APP_HANDLE,
  VENMO_HANDLE,
} from '../../../../lib/checkout/order';
import { GRIMOIRE_UNLOCK_PRICE_CENTS } from '../../../../lib/grimoire/edition';
import { isUnlockEntitled } from '../../../../lib/grimoire/unlock';
import {
  createUnlockRequest,
  findPendingUnlockRequest,
  type UnlockPaymentMethod,
  type UnlockRequestRecord,
} from '../../../../lib/grimoire/unlock-requests';
import {
  fireAndForgetEmail,
  queueUnlockRequestedNotification,
} from '../../../../lib/jobs/order-notifications';

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

function instructionsFor(record: UnlockRequestRecord) {
  return {
    request_id: record.request_id,
    amount_cents: GRIMOIRE_UNLOCK_PRICE_CENTS,
    amount: '$8.88',
    payment_method: record.payment_method,
    cash_app: CASH_APP_HANDLE,
    venmo: VENMO_HANDLE,
    reference: record.request_id,
    note:
      record.payment_method === 'bookipi_invoice'
        ? 'Your invoice will be emailed to you — pay it by ACH bank ' +
          'transfer to Bluevine, or with Venmo or Cash App, using your ' +
          'request ID as the payment reference. Your unlock activates ' +
          'as soon as Amber confirms your payment.'
        : 'Send $8.88 with Venmo or Cash App, using your request ID as ' +
          'the payment note/reference. Your unlock activates as soon ' +
          'as Amber confirms your payment.',
  };
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'checkout');
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(['Request body must be valid JSON.'], 400);
  }
  if (!isRecord(body)) {
    return fail(['Request body must be a JSON object.']);
  }
  const email = sanitizeEmail(body.email);
  if (!email) {
    return fail(['Please provide a valid email address.']);
  }
  const paymentMethod: UnlockPaymentMethod =
    body.payment_method === 'cash_app_or_venmo'
      ? 'cash_app_or_venmo'
      : 'bookipi_invoice';

  if (await isUnlockEntitled(email)) {
    return NextResponse.json({
      ok: true,
      state: 'already_unlocked',
      email,
      message:
        'This email already holds the permanent unlock — the full ' +
        'composed Living Grimoire (The Grimoire of Ancient ' +
        'Teachings complete, together with the collected works) is open ' +
        'to you.',
    });
  }

  const pending = await findPendingUnlockRequest(email);
  if (pending) {
    return NextResponse.json({
      ok: true,
      state: 'pending',
      email,
      payment: instructionsFor(pending),
      message:
        'Your unlock request is already recorded and waiting for ' +
        'payment — here are the instructions again.',
    });
  }

  const record = await createUnlockRequest({
    email,
    payment_method: paymentMethod,
  });

  // Owner notification — same fire-and-forget rule as order emails:
  // Amber hears about the request (so she can send the invoice)
  // without the customer's request ever depending on email delivery.
  fireAndForgetEmail(queueUnlockRequestedNotification(record), {
    request_id: record.request_id,
    template: 'grimoire_unlock_requested',
  });

  return NextResponse.json(
    {
      ok: true,
      state: 'pending',
      email,
      payment: instructionsFor(record),
      message:
        'Your unlock request is recorded. Pay $8.88 as shown, and your ' +
        'permanent unlock activates as soon as Amber confirms the ' +
        'payment — you\u2019ll get an email the moment it\u2019s active.',
    },
    { status: 201 },
  );
}
