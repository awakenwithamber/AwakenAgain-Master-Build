/**
 * POST /api/newsletter — newsletter signup contract (G15).
 *
 * validate → persist via the provider-neutral LeadStore (local JSONL now)
 * → record newsletter_subscribed as an observed fact (server-owned event;
 * the lead store is the authority, never the event).
 *
 * Consent is a hard gate: no record without consent:true.
 */
import { NextResponse } from 'next/server';
import { leadStore } from '../../../lib/leads/lead-store';
import { validateNewsletter } from '../../../lib/leads/validation';
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

  const validation = validateNewsletter(body);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, errors: validation.errors },
      { status: 422 },
    );
  }

  const v = validation.value!;
  const record = await leadStore.append({
    kind: 'newsletter',
    email: v.email,
    name: null,
    consent: true,
    consentAt: new Date().toISOString(),
    metadata: { placement: v.placement },
  });

  captureContentServerEventSoon(
    'newsletter_subscribed',
    { placement: v.placement },
    resolveServerDistinctId(req.headers.get('cookie'), `newsletter:${record.id}`),
  );

  return NextResponse.json({ ok: true, id: record.id }, { status: 201 });
}
