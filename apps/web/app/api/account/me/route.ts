/**
 * GET /api/account/me — the signed-in account's profile view
 * (Phase 3 Step 3). 401 without a live session; 503 while sign-in is
 * unconfigured on this server (fail closed, honest).
 *
 * The view composes the account fold + linked quiz leads + order
 * history (lib/accounts/profile.ts) — display data only.
 */
import { NextResponse } from 'next/server';
import { requireAccountSession } from '../../../../lib/accounts/http';
import { getProfileViewAsync } from '../../../../lib/accounts/profile';
import { accountFail } from '../../../../lib/accounts/http';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, 'account-read');
  if (limited) return limited;

  const session = await requireAccountSession(request);
  if (!session.ok) return session.response;

  const profile = await getProfileViewAsync(session.identity.email);
  if (!profile) {
    return accountFail(['Please sign in to continue.'], 401);
  }
  return NextResponse.json({ ok: true, profile });
}
