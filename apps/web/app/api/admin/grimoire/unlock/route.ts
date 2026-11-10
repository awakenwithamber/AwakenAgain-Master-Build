/**
 * Owner Grimoire unlock administration — POST /api/admin/grimoire/unlock
 * (Phase 2, Workstream 3; grant arm closed 2026-11-09).
 *
 * $8.88 ABOLITION (owner decision 2026-11-09): the permanent unlock
 * is no longer sold, and this route no longer grants unlocks —
 * { action: 'grant' } is refused with HTTP 410 and records NOTHING.
 * Full Living Grimoire access now comes with the $7.77/month
 * subscription while it is active. Existing unlock records are a
 * preserved legacy ledger: the read path and the entitlement
 * resolver are untouched, and revocation stays available here for
 * refunds and chargebacks on past sales.
 *
 * Actions:
 * - { action: 'grant', ... } — CLOSED. Refused (410); no grant is
 *   appended, no request is transitioned, no email is sent.
 * - { action: 'revoke', request_id | email, reason: 'refund' |
 *   'chargeback' } — canon (owner decision 2026-10-21 §13(2)): a
 *   refund or chargeback REVOKES the unlock.
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
  revokeLatestUnlockForEmail,
  type UnlockRevokeReason,
} from '../../../../../lib/grimoire/unlock';
import { findUnlockRequest } from '../../../../../lib/grimoire/unlock-requests';

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

  if (action === 'grant') {
    return fail(
      [
        'Unlock grants are closed: the permanent unlock is no longer ' +
          'sold (owner decision 2026-11-09), so no new unlock can be ' +
          'granted here and nothing was recorded. Full Grimoire ' +
          'access now comes with the $7.77/month subscription while ' +
          'it is active. Existing unlock records are unchanged, and ' +
          'revoke remains available for refunds and chargebacks on ' +
          'past sales.',
      ],
      410,
    );
  }

  // action === 'revoke'. Resolve the target: a request_id (it
  // carries the email) or a bare email.
  const requestIdInput = sanitizePlainText(body.request_id, 64);
  const emailInput = normalizeSubscriptionEmail(
    sanitizePlainText(body.email, 254),
  );
  let email = emailInput;
  const requestRecord = requestIdInput
    ? await findUnlockRequest(requestIdInput)
    : null;
  if (requestIdInput && !requestRecord) {
    return fail([`No unlock request found with ID ${requestIdInput}.`], 404);
  }
  if (requestRecord) {
    email = requestRecord.email;
  }
  if (!email) {
    return fail(['Provide a request_id or the customer email.']);
  }

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
