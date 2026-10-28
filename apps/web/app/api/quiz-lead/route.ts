/**
 * POST /api/quiz-lead — Herbal Allies Quiz lead capture (G6).
 *
 * validate → persist via the provider-neutral LeadStore → record
 * quiz_lead_captured as an observed fact (server-owned event; the lead
 * store is the authority, never the event).
 *
 * Consent is a hard gate: no record without consent:true. Payloads never
 * carry PII into analytics — concern_id/form_id only.
 *
 * Audit 2026-10-15 BROKEN-1: the lead now stores the FULL computed quiz
 * result (snapshot), and a quiz_results email job is built from it and
 * routed through the EmailProvider abstraction.
 *
 * Restore 2026-10-22: leads from the Guided Wellness Quiz carry the
 * advisor answers; the synthesis is recomputed HERE from those answers
 * (never trusted from the client) and stored on the snapshot's advisor
 * block, and the results email renders from it. The provider factory
 * binds Resend when RESEND_API_KEY is set (lib/jobs/email.ts), so the
 * results email is a real send in production and a logged preview
 * otherwise — customer copy keys off emailDeliveryIsPreview().
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
import { buildQuizResultsJob, createEmailProvider } from '../../../lib/jobs/email';
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
  const record = await leadStore.append({
    kind: 'quiz_lead',
    email: v.email,
    name: v.name,
    consent: true,
    consentAt: new Date().toISOString(),
    metadata: { concern_id: concernId, form_id: formId },
    quizResult: snapshot,
  });

  // Route the results email through the provider abstraction. The
  // factory binds Resend when RESEND_API_KEY is set and the logging
  // preview otherwise — either way a failure in the email layer must
  // never fail the lead capture itself.
  try {
    const job = buildQuizResultsJob(v.email, { name: v.name, result: snapshot });
    await createEmailProvider().send(job);
  } catch (err) {
    log.error('results email job failed (lead saved)', { error: err });
  }

  // Server-owned: the store is the authority; this records the fact.
  captureContentServerEventSoon(
    'quiz_lead_captured',
    { concern_id: concernId, form_id: formId },
    resolveServerDistinctId(req.headers.get('cookie'), `quiz-lead:${record.id}`),
  );

  return NextResponse.json({ ok: true, id: record.id }, { status: 201 });
}
