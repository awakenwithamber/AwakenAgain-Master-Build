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
 * routed through the EmailProvider abstraction. The only bound provider
 * today is the logging preview — NO REAL SENDS — so customer copy says
 * the results are SAVED, never that an email is on its way. Binding a
 * real provider (owner-gated) is a factory swap in lib/jobs/email.ts.
 */
import { NextResponse } from 'next/server';
import { leadStore } from '../../../lib/leads/lead-store';
import { validateQuizLead } from '../../../lib/leads/validation';
import { getQuizResult, toQuizResultSnapshot } from '../../../lib/quiz/quiz';
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
  const result = getQuizResult(v.concernId, v.formId, v.screening)!;
  const snapshot = toQuizResultSnapshot(result);
  const record = await leadStore.append({
    kind: 'quiz_lead',
    email: v.email,
    name: v.name,
    consent: true,
    consentAt: new Date().toISOString(),
    metadata: { concern_id: v.concernId, form_id: v.formId },
    quizResult: snapshot,
  });

  // Route the results email through the provider abstraction. With the
  // logging provider bound this only records the job (preview) — the
  // durable copy of the result is the lead record above, from which a
  // real send can always be produced once a provider is bound. A failure
  // in the email layer must never fail the lead capture itself.
  try {
    const job = buildQuizResultsJob(v.email, { name: v.name, result: snapshot });
    await createEmailProvider().send(job);
  } catch (err) {
    log.error('results email job failed (lead saved)', { error: err });
  }

  // Server-owned: the store is the authority; this records the fact.
  captureContentServerEventSoon(
    'quiz_lead_captured',
    { concern_id: v.concernId, form_id: v.formId },
    resolveServerDistinctId(req.headers.get('cookie'), `quiz-lead:${record.id}`),
  );

  return NextResponse.json({ ok: true, id: record.id }, { status: 201 });
}
