/**
 * POST /api/quiz-lead — Herbal Allies Quiz lead capture (G6).
 *
 * validate → persist via the provider-neutral LeadStore → send the
 * results email → record quiz_lead_captured as an observed fact
 * (server-owned event; the lead store is the authority, never the
 * event).
 *
 * Consent model (owner spec 2026-11-07): the results email is
 * TRANSACTIONAL — the visitor asked for their results — so it is not
 * gated on marketing consent; the email field is required FOR THIS
 * ACTION (the name is optional). The quiz_lead record's consent:true
 * documents that explicit request (the LeadStore stores nothing
 * without an affirmative act). Newsletter signup is a SEPARATE,
 * unchecked-by-default checkbox: only newsletterConsent:true writes a
 * newsletter lead record (the existing consent-gated mechanism).
 * Payloads never carry PII into analytics — concern_id/form_id only.
 *
 * Results First (owner decision 2026-11-08): this endpoint now serves
 * ONLY the optional email panel on the results page — the results
 * themselves render on the client the moment the quiz completes and
 * never pass through here. And nothing in here may fail the visitor's
 * email action either: every store append is wrapped, so a store
 * failure degrades to `saved: false` in the response while the email
 * send is still attempted and honestly reported via emailStatus.
 *
 * Audit 2026-10-15 BROKEN-1: the lead now stores the FULL computed quiz
 * result (snapshot), and a quiz_results email job is built from it and
 * routed through the EmailProvider abstraction.
 *
 * Restore 2026-10-22: leads from the Guided Wellness Quiz carry the
 * advisor answers; the synthesis is recomputed HERE from those answers
 * (never trusted from the client) and stored on the snapshot's advisor
 * block, and the results email renders from it.
 *
 * Delivery (2026-11-07): sendQuizResultsEmail retries failures and
 * logs every send with its delivery status; the response carries
 * emailStatus ('sent' | 'preview' | 'failed') so the results screen
 * can be honest — a failed or preview send never fails the completion,
 * and the on-screen results never depend on the email.
 */
import { NextResponse } from 'next/server';
import { leadStore } from '../../../lib/leads/lead-store';
import { validateQuizLead } from '../../../lib/leads/validation';
import { getQuizResult, toQuizResultSnapshot } from '../../../lib/quiz/quiz';
import {
  advisorLegacyIds,
  computeAdvisorSynthesis,
  toAdvisorResultSnapshot,
} from '../../../lib/quiz/advisor';
import { sendQuizResultsEmail } from '../../../lib/jobs/quiz-results-send';
import { captureContentServerEventSoon } from '../../../lib/analytics/content-posthog-server';
import { resolveServerDistinctId } from '../../../lib/analytics/posthog-server';
import { enforceRateLimit } from '../../../lib/security/rate-limit';
import { createLogger } from '../../../lib/observability/logger';

const log = createLogger('api:quiz-lead');

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, 'quiz-lead');
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, errors: ['Request body must be valid JSON.'] },
      { status: 400 },
    );
  }

  const validation = validateQuizLead(body);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, errors: validation.errors },
      { status: 422 },
    );
  }

  const v = validation.value!;
  // Validation guarantees the ids resolve, so the result always exists.
  // The screening answers ride along so the stored snapshot is the
  // screened result the visitor actually saw (Stage 4, R-14).
  //
  // Advisor flow: recompute the synthesis server-side from the answers
  // and derive the legacy concern/form ids from IT (not from the
  // client's claim), then attach the full advisor block to the snapshot.
  let concernId = v.concernId;
  let formId = v.formId;
  let advisorSnapshot;
  if (v.advisorAnswers) {
    const synthesis = computeAdvisorSynthesis(v.advisorAnswers, v.screening);
    const legacy = advisorLegacyIds(synthesis);
    concernId = legacy.concernId;
    formId = legacy.formId;
    advisorSnapshot = toAdvisorResultSnapshot(synthesis);
  }
  const result = getQuizResult(concernId, formId, v.screening)!;
  const snapshot = toQuizResultSnapshot(result);
  if (advisorSnapshot) snapshot.advisor = advisorSnapshot;

  // Persist the completion — wrapped (Results First, 2026-11-08): a
  // store failure must never 500 this request or block the email the
  // visitor asked for. The response reports saved:false honestly.
  let recordId: string | null = null;
  let saved = true;
  try {
    const record = await leadStore.append({
      kind: 'quiz_lead',
      email: v.email,
      name: v.name,
      consent: true,
      consentAt: new Date().toISOString(),
      metadata: {
        concern_id: concernId,
        form_id: formId,
        newsletter_opt_in: v.newsletterConsent,
      },
      quizResult: snapshot,
    });
    recordId = record.id;
  } catch (err) {
    saved = false;
    log.error('quiz lead store append failed — continuing to the email send', {
      error: err,
    });
  }

  // Newsletter signup — only when the separate box was ticked. Uses
  // the same consent-gated lead mechanism as POST /api/newsletter.
  // Wrapped for the same reason: its failure changes nothing else.
  if (v.newsletterConsent) {
    try {
      await leadStore.append({
        kind: 'newsletter',
        email: v.email,
        name: v.name,
        consent: true,
        consentAt: new Date().toISOString(),
        metadata: { placement: 'quiz-results' },
      });
      captureContentServerEventSoon(
        'newsletter_subscribed',
        { placement: 'quiz-results' },
        resolveServerDistinctId(
          req.headers.get('cookie'),
          `newsletter:${recordId ?? v.email}`,
        ),
      );
    } catch (err) {
      log.error('newsletter lead append failed (results email unaffected)', {
        error: err,
      });
    }
  }

  // The results email — every completion, every time, exactly once.
  // The send service retries failures and logs the delivery status;
  // a failure in the email layer must never fail the lead capture
  // itself, and the response reports the outcome honestly.
  let emailStatus: 'sent' | 'preview' | 'failed' = 'failed';
  try {
    const outcome = await sendQuizResultsEmail(v.email, snapshot, v.name);
    emailStatus =
      outcome.status === 'failed'
        ? 'failed'
        : outcome.delivery === 'preview'
          ? 'preview'
          : 'sent';
    if (outcome.status === 'failed') {
      log.error('results email failed after retries', {
        attempts: outcome.attempts,
        error: outcome.last_error,
      });
    }
  } catch (err) {
    log.error('results email job failed', { error: err });
  }

  // Server-owned: the store is the authority; this records the fact
  // (only when the store actually holds the record).
  if (saved && recordId) {
    captureContentServerEventSoon(
      'quiz_lead_captured',
      { concern_id: concernId, form_id: formId },
      resolveServerDistinctId(req.headers.get('cookie'), `quiz-lead:${recordId}`),
    );
  }

  // Honest outcome for the email panel: what was saved, and what the
  // email did. The visitor's results never depended on any of it.
  return saved
    ? NextResponse.json({ ok: true, id: recordId, emailStatus }, { status: 201 })
    : NextResponse.json(
        { ok: true, id: null, saved: false, emailStatus },
        { status: 200 },
      );
}
