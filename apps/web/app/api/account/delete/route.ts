/**
 * POST /api/account/delete — delete the signed-in account
 * (Phase 3 Step 3).
 *
 * Body: { confirm_email } — must match the session's email, so a stray
 * or scripted call without deliberate intent cannot delete anything.
 * Deletion appends the tombstone event: sessions stop resolving at
 * once, sign-in fails closed afterwards, and the profile view/export
 * collapse to the tombstone. The session cookie is cleared here.
 */
import { NextResponse } from 'next/server';
import {
  ACCOUNT_SESSION_COOKIE,
  accountSessionCookieOptions,
} from '../../../../lib/accounts/session';
import {
  deleteAccountAsync,
  normalizeAccountEmail,
} from '../../../../lib/accounts/accounts';
import {
  accountFail,
  isRecordBody,
  readJsonBody,
  requireAccountSession,
} from '../../../../lib/accounts/http';
import { captureContentServerEventSoon } from '../../../../lib/analytics/content-posthog-server';
import { resolveServerDistinctId } from '../../../../lib/analytics/posthog-server';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'account');
  if (limited) return limited;

  const session = await requireAccountSession(request);
  if (!session.ok) return session.response;
  const email = session.identity.email;

  const body = await readJsonBody(request);
  if (!isRecordBody(body)) {
    return accountFail(['Request body must be a JSON object.'], 400);
  }
  if (normalizeAccountEmail(body.confirm_email) !== email) {
    return accountFail(
      ['Type your account email exactly to confirm deletion.'],
      422,
    );
  }

  await deleteAccountAsync(email);

  captureContentServerEventSoon(
    'account_deleted',
    {},
    resolveServerDistinctId(
      request.headers.get('cookie'),
      `account-session:${session.identity.session_id.slice(0, 12)}`,
    ),
  );

  const response = NextResponse.json({ ok: true, deleted: true });
  response.cookies.set(ACCOUNT_SESSION_COOKIE, '', {
    ...accountSessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
