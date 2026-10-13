/**
 * Payment webhook endpoint — DISABLED (set aside 2026-10-13, not deleted).
 * The original implementation is preserved under the repo-level
 * disabled/ directory. Fails closed: no signature check, no order changes.
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { ok: false, errors: ['Webhook not configured.'] },
    { status: 503 },
  );
}
