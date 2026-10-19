/**
 * Legacy card checkout endpoint — INACTIVE, fails closed.
 *
 * The ACTIVE embedded card checkout is bound by
 * app/api/stripe/checkout-session to an order created by
 * POST /api/checkout (owner directive 2026-10-19). This stub from the
 * set-aside 2026-10-13 implementation remains so stale callers fail
 * loudly with a pointer to the working paths.
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      errors: [
        'Card checkout has moved: place your order at checkout and pay by card on that page, or use Cash App, Venmo, or an emailed invoice.',
      ],
    },
    { status: 503 },
  );
}
