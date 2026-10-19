/**
 * Legacy payment webhook endpoint — INACTIVE, fails closed.
 *
 * The ACTIVE Stripe webhook is app/api/stripe/webhook (signature-
 * verified; the only path that marks an order paid — owner directive
 * 2026-10-19). Register THAT endpoint in Stripe, not this one. This
 * stub remains so a stale registration fails loudly instead of
 * silently swallowing events: no signature check, no order changes.
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      errors: [
        'This webhook endpoint is inactive. The active endpoint is /api/stripe/webhook.',
      ],
    },
    { status: 503 },
  );
}
