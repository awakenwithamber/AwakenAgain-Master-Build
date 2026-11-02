/**
 * GET /api/grimoire-unlock/status?email= — "check my access" for the
 * manual unlock rail (Phase 2, Workstream 3).
 *
 * Read-only composition over the two unlock ledgers: the entitlement
 * ledger is the authority for ACTIVE (it also answers for historical
 * card-era grants); the request ledger adds PENDING. Answers one of:
 * 'active' | 'pending' | 'revoked' | 'none'. Reveals nothing beyond
 * the state of the email the caller supplies.
 */
import { NextResponse } from 'next/server';
import { sanitizeEmail } from '../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';
import { findLatestUnlock } from '../../../../lib/grimoire/unlock';
import { findPendingUnlockRequest } from '../../../../lib/grimoire/unlock-requests';

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, 'grimoire-otp-session');
  if (limited) return limited;

  const email = sanitizeEmail(new URL(request.url).searchParams.get('email'));
  if (!email) {
    return NextResponse.json(
      { ok: false, errors: ['Please provide a valid email address.'] },
      { status: 422 },
    );
  }

  const latest = await findLatestUnlock(email);
  if (latest && latest.state === 'active') {
    return NextResponse.json({ ok: true, email, state: 'active' });
  }
  const pending = await findPendingUnlockRequest(email);
  if (pending) {
    return NextResponse.json({
      ok: true,
      email,
      state: 'pending',
      request_id: pending.request_id,
    });
  }
  if (latest && latest.state === 'revoked') {
    return NextResponse.json({ ok: true, email, state: 'revoked' });
  }
  return NextResponse.json({ ok: true, email, state: 'none' });
}
