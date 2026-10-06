/**
 * Review list for a product (G4) — client component.
 *
 * Fetches approved reviews from /api/reviews. Renders an honest empty
 * state when there are none (no fabricated reviews, ever). Fires
 * review_list_viewed with the approved count.
 */
'use client';

import { useEffect, useState } from 'react';
import Stars from './Stars';
import { trackContent } from '../../lib/analytics/content-posthog';

interface PublicReview {
  id: string;
  rating: number;
  name: string;
  title: string | null;
  body: string;
  createdAt: string;
}

export default function ReviewList({ productHandle }: { productHandle: string }) {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reviews?product=${encodeURIComponent(productHandle)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('failed');
        const json = await res.json();
        if (cancelled) return;
        const list: PublicReview[] = json.reviews ?? [];
        setReviews(list);
        trackContent('review_list_viewed', {
          product_handle: productHandle,
          approved_review_count: list.length,
        });
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [productHandle]);

  if (!loaded) {
    return <p className="reviews-loading">Loading reviews…</p>;
  }

  if (error) {
    return (
      <p className="reviews-error" role="alert">
        Reviews could not be loaded right now — please try again later.
      </p>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="reviews-empty">
        <p>🌿 No reviews yet — be the first to share your experience.</p>
      </div>
    );
  }

  return (
    <ul className="review-list">
      {reviews.map((r) => (
        <li key={r.id} className="review">
          <Stars value={r.rating} label={`${r.rating} out of 5 stars`} />
          {r.title && <h4>{r.title}</h4>}
          <p className="review-body">{r.body}</p>
          <p className="review-meta">
            — {r.name} · {new Date(r.createdAt).toLocaleDateString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
