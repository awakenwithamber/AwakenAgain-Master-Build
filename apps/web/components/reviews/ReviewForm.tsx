/**
 * Review submission form (G4) — client component.
 *
 * POSTs to /api/reviews. New reviews enter moderation as `pending` — the
 * form says so honestly. Fires review_submitted (client interaction event).
 */
'use client';

import { useState } from 'react';
import { trackContent } from '../../lib/analytics/content-posthog';

export default function ReviewForm({ productHandle }: { productHandle: string }) {
  const [rating, setRating] = useState(0);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [errors, setErrors] = useState<string[]>([]);

  const submit = async () => {
    setStatus('sending');
    setErrors([]);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productHandle, rating, name, title, body }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErrors(json.errors ?? ['Something went wrong — please try again.']);
        setStatus('error');
        return;
      }
      trackContent('review_submitted', { product_handle: productHandle, rating });
      setStatus('done');
    } catch {
      setErrors(['Something went wrong — please try again.']);
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <p className="review-thanks">
        ✨ Thank you — your review is awaiting moderation and will appear once
        approved.
      </p>
    );
  }

  return (
    <form
      className="review-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h3>Share your experience</h3>
      <fieldset>
        <legend>Your rating</legend>
        <div className="rating-input" role="radiogroup" aria-label="Star rating">
          {[5, 4, 3, 2, 1].map((v) => (
            <button
              key={v}
              type="button"
              className={v <= rating ? 'star-filled' : 'star-empty'}
              aria-label={`${v} star${v === 1 ? '' : 's'}`}
              aria-pressed={rating === v}
              onClick={() => setRating(v)}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        Display name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoComplete="nickname"
          required
        />
      </label>
      <label>
        Title <span className="optional">(optional)</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
      </label>
      <label>
        Your review
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={4}
          required
        />
      </label>
      {errors.length > 0 && (
        <ul className="form-errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <button className="btn-primary" type="submit" disabled={status === 'sending' || rating === 0}>
        {status === 'sending' ? 'Submitting…' : 'Submit Review'}
      </button>
      <p className="review-moderation-note">
        Reviews are moderated before they appear. Please share honest, personal
        experience — no medical claims, please.
      </p>
    </form>
  );
}
