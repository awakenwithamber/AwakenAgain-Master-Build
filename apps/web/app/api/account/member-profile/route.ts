/**
 * /api/account/member-profile — the Gaia member profile (2026-11-08).
 *
 * GET: the signed-in member's own full profile + feed (their own data,
 * private fields included — this route is session-gated; the PUBLIC
 * feed is a different composition with a different type, see
 * lib/accounts/member-feed.ts).
 *
 * POST: validate + save the profile (lib/accounts/member-profile.ts is
 * the authority: required fields, the 13+ age gate, EXIF-stripped
 * photo). On the FIRST successful save, the welcome email is invoked
 * through the one provider path and the outcome is reported honestly
 * (delivery 'preview' while no real provider is bound — invoked is
 * never dressed up as delivered).
 */
import { NextResponse } from 'next/server';
import {
  accountFail,
  isRecordBody,
  readJsonBody,
  requireAccountSession,
} from '../../../../lib/accounts/http';
import {
  saveMemberProfileAsync,
  type MemberProfileInput,
} from '../../../../lib/accounts/member-profile';
import { getOwnMemberFeedAsync } from '../../../../lib/accounts/member-feed';
import { sendProfileWelcomeEmailAsync } from '../../../../lib/jobs/profile-emails';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, 'account-read');
  if (limited) return limited;

  const session = await requireAccountSession(request);
  if (!session.ok) return session.response;

  const feed = await getOwnMemberFeedAsync(session.identity.email);
  if (!feed) {
    return NextResponse.json({ ok: true, feed: null });
  }
  return NextResponse.json({ ok: true, feed });
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'account-auth');
  if (limited) return limited;

  const session = await requireAccountSession(request);
  if (!session.ok) return session.response;
  const email = session.identity.email;

  const body = await readJsonBody(request);
  if (!isRecordBody(body)) {
    return accountFail(['Please send your profile as a form object.'], 400);
  }

  const saved = await saveMemberProfileAsync(email, body as MemberProfileInput);
  if (!saved.ok) {
    return accountFail(saved.errors, 422);
  }

  let welcome: { invoked: boolean; delivery: 'resend' | 'preview' | null } = {
    invoked: false,
    delivery: null,
  };
  if (saved.created) {
    const result = await sendProfileWelcomeEmailAsync(email);
    if (result.sent) {
      welcome = { invoked: true, delivery: result.outcome.delivery };
    }
  }

  const feed = await getOwnMemberFeedAsync(email);
  return NextResponse.json({ ok: true, created: saved.created, welcome, feed });
}
