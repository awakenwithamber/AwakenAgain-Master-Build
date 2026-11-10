/**
 * /api/grimoire-unlock/request — CLOSED (owner decision 2026-11-09:
 * the $8.88 permanent unlock was eliminated as a purchase option;
 * full Living Grimoire access comes with the $7.77/month
 * subscription while it is active).
 *
 * This route used to record pending unlock requests on the manual
 * payment rail. It now refuses every request with HTTP 410 and
 * records NOTHING — no request is written to the unlock-request
 * ledger (lib/grimoire/unlock-requests), no owner notification is
 * sent, and no entitlement can begin here. The closure gate in the
 * redesign audit (§G.4: disposition pending requests before closing
 * intake) was resolved by the owner's 2026-11-09 ruling that nobody
 * has paid the $8.88 — there are no paid or granted unlocks to honor
 * or refund, and an unpaid request was never a purchase.
 *
 * Existing unlock RECORDS are untouched: the entitlement resolver
 * (lib/grimoire/entitlement.ts) and the unlock ledger read path
 * (lib/grimoire/unlock.ts) are preserved exactly, and the read-only
 * status route (../status) still answers for any email.
 */
import { NextResponse } from 'next/server';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

const CLOSED_MESSAGE =
  'The permanent unlock is no longer offered, so unlock requests ' +
  'are closed and nothing was recorded. Full Living Grimoire access ' +
  'now comes with the $7.77/month subscription while it is active — ' +
  'see the membership options on this page. If you already sent a ' +
  'payment for an unlock, contact Amber at Amber@awakenagain.com ' +
  'and she will make it right.';

function closed(request: Request) {
  const limited = enforceRateLimit(request, 'checkout');
  if (limited) return limited;
  return NextResponse.json(
    { ok: false, state: 'closed', errors: [CLOSED_MESSAGE] },
    { status: 410 },
  );
}

export async function POST(request: Request) {
  return closed(request);
}

export async function GET(request: Request) {
  return closed(request);
}
