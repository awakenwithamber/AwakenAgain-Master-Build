/**
 * Grimoire PERMANENT_UNLOCK checkout — POST /api/grimoire-unlock/checkout.
 *
 * Creates a one-time Stripe Checkout Session for the $8.88 unlock of
 * the Living Grimoire — 333-page edition. This route grants NOTHING:
 * the entitlement is written only by the signature-verified webhook
 * when the session completes. GET reports availability so the UI can
 * degrade truthfully when STRIPE_GRIMOIRE_UNLOCK_PRICE_ID (or the
 * Stripe keys) are not configured — no fake checkout is ever offered.
 */
import { NextResponse } from 'next/server';
import { createStripeClient } from '../../../../lib/payments/stripe';
import {
  createUnlockCheckoutSession,
  grimoireUnlockCheckoutAvailable,
} from '../../../../lib/grimoire/unlock-checkout';
import { isUnlockEntitled } from '../../../../lib/grimoire/unlock';
import { GRIMOIRE_UNLOCK_PRICE_CENTS } from '../../../../lib/grimoire/unlock';
import { isRecord, sanitizeEmail } from '../../../../lib/security/validation';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

function fail(errors: string[], status = 422) {
  return NextResponse.json({ ok: false, errors }, { status });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    available: grimoireUnlockCheckoutAvailable(),
    price_cents: GRIMOIRE_UNLOCK_PRICE_CENTS,
    edition_id: 'living-grimoire-333',
  });
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'checkout');
  if (limited) return limited;

  if (!grimoireUnlockCheckoutAvailable()) {
    return fail(
      [
        'The permanent unlock is not purchasable yet — checkout for it ' +
          'has not been switched on. The subscription option below works today.',
      ],
      503,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(['Request body must be valid JSON.'], 400);
  }
  if (!isRecord(body)) return fail(['Request body must be a JSON object.']);
  const email = sanitizeEmail(body.email);
  if (!email) return fail(['A valid email address is required.']);

  if (await isUnlockEntitled(email)) {
    return fail(
      ['That email already holds the permanent unlock for this edition.'],
      409,
    );
  }

  const client = createStripeClient();
  if (!client) return fail(['Card checkout is not available right now.'], 503);

  try {
    const session = await createUnlockCheckoutSession(
      { email, origin: new URL(request.url).origin },
      client,
    );
    return NextResponse.json({
      ok: true,
      session_id: session.id,
      url: session.url,
    });
  } catch (err) {
    return fail(
      [
        `Could not start the unlock checkout: ${
          err instanceof Error ? err.message : 'unknown error'
        }.`,
      ],
      502,
    );
  }
}
