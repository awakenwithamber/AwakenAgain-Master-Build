/**
 * Owner Grimoire unlock administration — POST /api/admin/grimoire/unlock
 * (Phase 2, Workstream 3). The "extend the existing admin entitlement
 * path" endpoint for the manual unlock rail: the same owner-secret
 * bridge auth as the order payment/tracking routes.
 *
 * Actions:
 * - { action: 'grant', request_id | email, reference? } — after the
 *   owner verifies the $8.88 payment arrived: appends the entitlement
 *   (lib/grimoire/unlock.ts, source 'owner_manual', transaction_ref =
 *   the verified payment reference, else the request ID), transitions
 *   the request to 'granted', and emails the customer that their
 *   unlock is active. Granting is idempotent.
 * - { action: 'revoke', request_id | email, reason: 'refund' |
 *   'chargeback' } — canon (owner decision 2026-10-21 §13(2)): a
 *   refund or chargeback REVOKES the unlock; permanent rights
 *   otherwise survive, including subscription cancellation (which
 *   never touches this ledger at all).
 *
 * Auth contract, identical to the other admin routes:
 * OWNER_ADMIN_SECRET unset → 404; wrong/absent secret → 401; the
 * secret is never logged. Rate-limited first on the strict 'admin'
 * group.
 *
 * SERVER-ONLY.
 */
import { NextResponse } from 'next/server';
import { isRecord, sanitizePlainText } from '../../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../../lib/security/rate-limit';
import { ownerAuthorized } from '../../../../../lib/admin/owner-auth';
import { normalizeSubscriptionEmail } from '../../../../../lib/subscriptions/entitlement';
import {
  findLatestUnlock,
  grantUnlock,
  revokeLatestUnlockForEmail,
  type UnlockRevokeReason,
} from '../../../../../lib/grimoire/unlock';
import {
  findPendingUnlockRequest,
  findUnlockRequest,
  transitionUnlockRequest,
} from '../../../../../lib/grimoire/unlock-requests';
import {
  fireAndForgetEmail,
  queueUnlockActiveEmail,
} from '../../../../../lib/jobs/order-notifications';

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'admin');
  if (limited) return limited;

  const auth = ownerAuthorized(request);
  if (auth === 'unconfigured') {
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

  const action = body.action;
  if (action !== 'grant' && action !== 'revoke') {
    return fail(['Action must be "grant" or "revoke".']);
  }

  // Resolve the target: a request_id (preferred — it carries the
  // email and is the payment reference) or a bare email.
  const requestIdInput = sanitizePlainText(body.request_id, 64);
  const emailInput = normalizeSubscriptionEmail(
    sanitizePlainText(body.email, 254),
  );
  let email = emailInput;
  let requestRecord = requestIdInput
    ? await findUnlockRequest(requestIdInput)
    : null;
  if (requestIdInput && !requestRecord) {
    return fail([`No unlock request found with ID ${requestIdInput}.`], 404);
  }
  if (requestRecord) {
    email = requestRecord.email;
  }
  if (!email) {
    // Last resort for grant-by-email: the newest pending request.
    return fail(['Provide a request_id or the customer email.']);
  }
  if (!requestRecord && action === 'grant') {
    requestRecord = await findPendingUnlockRequest(email);
  }

  if (action === 'grant') {
    const reference =
      sanitizePlainText(body.reference, 120) ||
      requestRecord?.request_id ||
      null;
    if (!reference) {
      return fail([
        'A payment reference (or request_id) is required to grant an unlock.',
      ]);
    }
    // Idempotency is read from the ledger BEFORE granting: an active
    // grant for this exact reference means this call is a re-record —
    // grantUnlock will no-op, and no second confirmation email goes.
    const before = await findLatestUnlock(email);
    const already =
      before !== null &&
      before.state === 'active' &&
      before.transaction_ref === reference;
    const record = await grantUnlock({
      email,
      transaction_ref: reference,
      source: 'owner_manual',
    });
    if (requestRecord) {
      await transitionUnlockRequest(requestRecord.request_id, 'granted', reference);
    }
    if (!already) {
      fireAndForgetEmail(
        queueUnlockActiveEmail(
          email,
          requestRecord?.request_id ?? reference,
        ),
        { request_id: requestRecord?.request_id ?? reference, template: 'grimoire_unlock_active' },
      );
    }
    return NextResponse.json({
      ok: true,
      action: 'grant',
      email,
      state: record.state,
      transaction_ref: record.transaction_ref,
      already_recorded: already,
    });
  }

  // action === 'revoke'
  const reason: UnlockRevokeReason =
    body.reason === 'chargeback' ? 'chargeback' : 'refund';
  const revoked = await revokeLatestUnlockForEmail(email, reason);
  if (!revoked) {
    return fail([`No unlock found for ${email}.`], 404);
  }
  return NextResponse.json({
    ok: true,
    action: 'revoke',
    email,
    state: revoked.state,
    reason: revoked.revoked_reason,
  });
}
