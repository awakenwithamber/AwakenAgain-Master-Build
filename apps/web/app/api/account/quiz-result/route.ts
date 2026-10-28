/**
 * POST /api/account/quiz-result — save a quiz result to the signed-in
 * profile (Phase 3 Step 3).
 *
 * Body: { concernId, formId, screening? }. The snapshot is computed
 * SERVER-side from the ids (lib/quiz) — the client's copy of its own
 * result is never trusted as the stored record. The Stage 4 screening
 * answers are normalized server-side and stored on the snapshot.
 * Saving also stamps the profile's quiz-completion progress marker
 * (in the store's save path).
 */
import { NextResponse } from 'next/server';
import {
  getQuizResult,
  isValidConcernId,
  isValidFormId,
  normalizeQuizScreening,
  toQuizResultSnapshot,
} from '../../../../lib/quiz/quiz';
import {
  computeAdvisorSynthesis,
  normalizeAdvisorAnswers,
  toAdvisorResultSnapshot,
} from '../../../../lib/quiz/advisor';
import { saveQuizResultAsync } from '../../../../lib/accounts/accounts';
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
  if (!isValidConcernId(body.concernId) || !isValidFormId(body.formId)) {
    return accountFail(['Unknown quiz answers — please retake the quiz.']);
  }
  const screening = normalizeQuizScreening(body.screening);
  const result = getQuizResult(body.concernId, body.formId, screening);
  if (!result) {
    return accountFail(['Unknown quiz answers — please retake the quiz.']);
  }
  const snapshot = toQuizResultSnapshot(result);
  // Restored advisor flow (2026-10-22): when the guided-quiz answers
  // ride along, recompute the synthesis server-side and store the full
  // advisor block on the profile snapshot, exactly as the lead route.
  if (body.advisor !== undefined) {
    const answers = normalizeAdvisorAnswers(body.advisor);
    if (answers && answers.symptoms.length > 0) {
      snapshot.advisor = toAdvisorResultSnapshot(
        computeAdvisorSynthesis(answers, screening),
      );
    }
  }
  const state = await saveQuizResultAsync(session.identity.email, snapshot, 'quiz');

  captureContentServerEventSoon(
    'profile_quiz_result_saved',
    { via: 'quiz' },
    resolveServerDistinctId(
      request.headers.get('cookie'),
      `account-session:${session.identity.session_id.slice(0, 12)}`,
    ),
  );

  return NextResponse.json({ ok: true, quiz_results: state.quiz_results });
}
