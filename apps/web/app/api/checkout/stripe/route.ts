/**
 * Card checkout endpoint — DISABLED (set aside 2026-10-13, not deleted).
 * The original implementation is preserved under the repo-level
 * disabled/ directory. This stub fails closed so the checkout UI falls
 * back to Cash App / Venmo with a clear message.
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      errors: [
        'Card checkout is not available right now. Please use Cash App or Venmo.',
      ],
    },
    { status: 503 },
  );
}
