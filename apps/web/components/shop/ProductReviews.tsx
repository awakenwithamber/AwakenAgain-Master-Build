/**
 * Per-product reviews block — Phase 1 Batch 3 (client component).
 *
 * Wraps the real reviews system (ReviewList + ReviewForm) for one product
 * handle, copying the interaction pattern of the homepage ReviewsSection:
 * ReviewList shows genuinely approved reviews with its own honest empty
 * state (no fabricated reviews, ever), and a toggle reveals ReviewForm,
 * which POSTs to /api/reviews and enters moderation as pending.
 */
'use client';

import { useState } from 'react';
import ReviewList from '../reviews/ReviewList';
import ReviewForm from '../reviews/ReviewForm';

export function ProductReviews({
  productHandle,
  productTitle,
}: {
  productHandle: string;
  productTitle: string;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const formId = `review-form-${productHandle}`;

  return (
    <section aria-label="Customer reviews">
      <h2>Customer Reviews</h2>
      <p>
        Already walked this path with Amber? Your words guide the next
        seeker.
      </p>
      <p>
        <button
          type="button"
          onClick={() => setFormOpen((open) => !open)}
          aria-expanded={formOpen}
          aria-controls={formId}
        >
          ✦ {formOpen ? 'Close Review Form' : 'Leave a Review Here'}
        </button>
      </p>
      {formOpen ? (
        <div id={formId}>
          <h3>Share your experience with {productTitle}</h3>
          <ReviewForm productHandle={productHandle} />
        </div>
      ) : null}
      <ReviewList productHandle={productHandle} />
    </section>
  );
}
