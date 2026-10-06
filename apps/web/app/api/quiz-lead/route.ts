/**
 * POST /api/quiz-lead — Herbal Allies Quiz lead capture (G6).
 *
 * validate → persist via the provider-neutral LeadStore (local JSONL now)
 * → record quiz_lead_captured as an observed fact (server-owned event;
 * the lead store is the authority, never the event).
 *
 * Consent is a hard gate: no record without consent:true. Payloads never
 * carry PII into analytics — concern_id/form_id only.
 */
import { NextResponse } from 'next/server';
import { leadStore } from '../../../lib/leads/lead-store';
import { validateQuizLead } from '../../../lib/leads/validation';
import { captureContentServerEventSoon } from '../../../lib/analytics/content-posthog-server';
import { resolveServerDistinctId } from '../../../lib/analytics/posthog-server';

export async function POST(req: Request) {
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
  const record = await leadStore.append({
    kind: 'quiz_lead',
    email: v.email,
    name: v.name,
    consent: true,
    consentAt: new Date().toISOString(),
    metadata: { concern_id: v.concernId, form_id: v.formId },
  });

  // Server-owned: the store is the authority; this records the fact.
  captureContentServerEventSoon(
    'quiz_lead_captured',
    { concern_id: v.concernId, form_id: v.formId },
    resolveServerDistinctId(req.headers.get('cookie'), `quiz-lead:${record.id}`),
  );

  return NextResponse.json({ ok: true, id: record.id }, { status: 201 });
}
