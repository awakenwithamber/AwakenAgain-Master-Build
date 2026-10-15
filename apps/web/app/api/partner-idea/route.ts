/**
 * POST /api/partner-idea — partnership / idea submission capture
 * (/partner, owner order 2026-10-15, audit fix #8).
 *
 * validate → persist via the provider-neutral LeadStore (kind
 * 'partner_idea') → record partner_idea_submitted as an observed fact
 * (server-owned event; the lead store is the authority, never the
 * event).
 *
 * Consent is a hard gate: no record without consent:true. Submissions
 * are reviewed by the owner personally — no response time and no
 * acceptance is promised, in copy or in this contract. Payloads never
 * carry PII or the idea text into analytics — contribution type only.
 */
import { NextResponse } from 'next/server';
import { leadStore } from '../../../lib/leads/lead-store';
import { validatePartnerIdea } from '../../../lib/leads/validation';
import { captureContentServerEventSoon } from '../../../lib/analytics/content-posthog-server';
import { resolveServerDistinctId } from '../../../lib/analytics/posthog-server';
import { enforceRateLimit } from '../../../lib/security/rate-limit';

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, 'partner-idea');
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

  const validation = validatePartnerIdea(body);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, errors: validation.errors },
      { status: 422 },
    );
  }

  const v = validation.value!;
  const metadata: Record<string, string | number | boolean> = {
    contribution_type: v.contributionType,
    idea: v.idea,
  };
  if (v.links) metadata.links = v.links;

  const record = await leadStore.append({
    kind: 'partner_idea',
    email: v.email,
    name: v.name,
    consent: true,
    consentAt: new Date().toISOString(),
    metadata,
  });

  // Server-owned: the store is the authority; this records the fact.
  captureContentServerEventSoon(
    'partner_idea_submitted',
    { contribution_type: v.contributionType },
    resolveServerDistinctId(req.headers.get('cookie'), `partner-idea:${record.id}`),
  );

  return NextResponse.json({ ok: true, id: record.id }, { status: 201 });
}
