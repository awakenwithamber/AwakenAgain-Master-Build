/**
 * POST /api/account/progress — sync on-device progress to the profile
 * (Phase 3 Step 3).
 *
 * Body: { interests?: object, quiz_completed?: boolean }.
 * Persists ONLY what the site already tracks on this device (surveyed
 * 2026-10-15): the interest-profile snapshot (validated + clamped by
 * the store to the personalization module's own rules) and the
 * quiz-completion stamp. No new tracking is introduced here — the
 * client sends what its local profile already holds, when its owner
 * signs in and on demand from the profile page.
 */
import { NextResponse } from 'next/server';
import {
  cleanInterestSnapshot,
  updateProgressAsync,
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

  const body = await readJsonBody(request);
  if (!isRecordBody(body)) {
    return accountFail(['Request body must be a JSON object.'], 400);
  }

  const interests =
    body.interests !== undefined ? cleanInterestSnapshot(body.interests) : undefined;
  const state = await updateProgressAsync(session.identity.email, {
    interests: interests ?? undefined,
    quiz_completed_at:
      body.quiz_completed === true ? new Date().toISOString() : undefined,
  });

  captureContentServerEventSoon(
    'profile_progress_synced',
    { has_interests: Boolean(state.progress?.interests) },
    resolveServerDistinctId(
      request.headers.get('cookie'),
      `account-session:${session.identity.session_id.slice(0, 12)}`,
    ),
  );

  return NextResponse.json({ ok: true, progress: state.progress });
}
