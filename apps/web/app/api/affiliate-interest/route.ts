/**
 * POST /api/affiliate-interest — affiliate-program interest capture
 * (/network, owner order 2026-10-15, audit fix #8).
 *
 * validate → persist via the provider-neutral LeadStore (kind
 * 'affiliate_interest') → record affiliate_interest_registered as an
 * observed fact (server-owned event; the lead store is the authority,
 * never the event).
 *
 * Consent is a hard gate: no record without consent:true. The program
 * is still forming — this registers interest only; nothing about it is
 * promised to the visitor, in copy or in this contract. Payloads never
 * carry PII into analytics — project slugs only.
 */
import { NextResponse } from 'next/server';
import { leadStore } from '../../../lib/leads/lead-store';
import { validateAffiliateInterest } from '../../../lib/leads/validation';
import { captureContentServerEventSoon } from '../../../lib/analytics/content-posthog-server';
import { resolveServerDistinctId } from '../../../lib/analytics/posthog-server';
import { enforceRateLimit } from '../../../lib/security/rate-limit';

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, 'affiliate-interest');
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

  const validation = validateAffiliateInterest(body);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, errors: validation.errors },
      { status: 422 },
    );
  }

  const v = validation.value!;
  const metadata: Record<string, string | number | boolean> = {
    projects: v.projectSlugs.join(','),
    project_count: v.projectSlugs.length,
  };
  if (v.note) metadata.note = v.note;

  const record = await leadStore.append({
    kind: 'affiliate_interest',
    email: v.email,
    name: v.name,
    consent: true,
    consentAt: new Date().toISOString(),
    metadata,
  });

  // Server-owned: the store is the authority; this records the fact.
  captureContentServerEventSoon(
    'affiliate_interest_registered',
    { project_slugs: v.projectSlugs.join(',') },
    resolveServerDistinctId(req.headers.get('cookie'), `affiliate-interest:${record.id}`),
  );

  return NextResponse.json({ ok: true, id: record.id }, { status: 201 });
}
