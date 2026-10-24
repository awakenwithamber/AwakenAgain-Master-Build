/**
 * Legacy card checkout endpoint — INACTIVE, fails closed.
 *
 * Card checkout is PARKED DORMANT (owner directive 2026-10-24): no
 * customer flow offers card payment. This stub remains so stale
 * callers fail loudly with a pointer to the working paths (emailed
 * invoice, Cash App, Venmo).
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      errors: [
        'Card checkout is not offered. Place your order at checkout and pay by emailed invoice, Cash App, or Venmo.',
      ],
    },
    { status: 503 },
  );
}
