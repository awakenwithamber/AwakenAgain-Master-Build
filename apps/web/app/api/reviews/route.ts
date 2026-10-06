/**
 * /api/reviews — review submission + public listing (G4).
 *
 * POST: validate → store as `pending` in the moderation queue → 201.
 *       Nothing is ever auto-approved: the public surface shows only
 *       explicitly approved reviews, so the queue starts EMPTY by design
 *       (no fabricated reviews, ever).
 * GET ?product=<handle>: approved reviews only, newest first. 400 for an
 *       unknown product handle, 404 never — an empty array is the honest
 *       answer for a product with no approved reviews.
 *
 * review_submitted is a client-owned interaction event (the browser
 * attests the gesture); there is no server-owned business transition here
 * — approval happens through moderation, not this endpoint.
 */
import { NextResponse } from 'next/server';
import { reviewStore, validateReview } from '../../../lib/reviews/reviews';
import { PRODUCTS } from '../../../lib/catalog/products';

const KNOWN_HANDLES = new Set(PRODUCTS.map((p) => p.handle));

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productHandle = (searchParams.get('product') ?? '').trim();
  if (!productHandle || !KNOWN_HANDLES.has(productHandle)) {
    return NextResponse.json(
      { ok: false, errors: ['Unknown product handle.'] },
      { status: 400 },
    );
  }
  const reviews = await reviewStore.listApproved(productHandle);
  return NextResponse.json({
    ok: true,
    productHandle,
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      name: r.name,
      title: r.title,
      body: r.body,
      createdAt: r.createdAt,
    })),
    // Honest empty state: no reviews sourced yet → not fabricated.
    note:
      reviews.length === 0
        ? 'No approved reviews yet — be the first to share your experience.'
        : undefined,
  });
}

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

  const validation = validateReview(body, KNOWN_HANDLES);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, errors: validation.errors },
      { status: 422 },
    );
  }

  const record = await reviewStore.submit(validation.value!);
  return NextResponse.json(
    {
      ok: true,
      id: record.id,
      status: record.status,
      message:
        'Thank you — your review is awaiting moderation and will appear once approved.',
    },
    { status: 201 },
  );
}
