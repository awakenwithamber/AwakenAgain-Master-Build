/**
 * POST /api/account/progress-checkin — add a before/after progress
 * check-in (Gaia profile build, Phase B).
 *
 * Session-required. The service enforces the owner's rules
 * server-side: a member profile must exist, the member must be 18+
 * (from the SAVED birthday — never a client value), and the photo is
 * EXIF/GPS-stripped before storage; a photo that cannot be cleaned is
 * rejected, never stored raw. Answers with the refreshed own feed so
 * the page re-renders from server truth (including the next due date
 * and reminder state).
 */
import { NextResponse } from 'next/server';
import {
  accountFail,
  isRecordBody,
  readJsonBody,
  requireAccountSession,
} from '../../../../lib/accounts/http';
import { submitProgressCheckinAsync } from '../../../../lib/accounts/member-profile';
import { getOwnMemberFeedAsync } from '../../../../lib/accounts/member-feed';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'account-auth');
  if (limited) return limited;

  const session = await requireAccountSession(request);
  if (!session.ok) return session.response;
  const email = session.identity.email;

  const body = await readJsonBody(request);
  if (!isRecordBody(body)) {
    return accountFail(['Please send your check-in as a form object.'], 400);
  }

  const result = await submitProgressCheckinAsync(email, {
    kind: body.kind,
    photo_data_url: body.photo_data_url,
    note: body.note,
  });
  if (!result.ok) {
    return accountFail(result.errors, result.status);
  }

  const feed = await getOwnMemberFeedAsync(email);
  return NextResponse.json({ ok: true, checkin: result.checkin, feed });
}
