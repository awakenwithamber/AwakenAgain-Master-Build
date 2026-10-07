/**
 * Homepage reviews section — wired to the real reviews system.
 *
 * ReviewList shows genuinely approved reviews for the featured product
 * (honest empty state when none exist yet); the "Leave a Review Here"
 * toggle reveals ReviewForm, which POSTs to /api/reviews and enters
 * moderation as pending. No fabricated reviews, ever.
 */
'use client';

import { useState } from 'react';
import ReviewList from '../reviews/ReviewList';
import ReviewForm from '../reviews/ReviewForm';
import styles from './home.module.css';
import { REVIEWS_PRODUCT_HANDLE } from './data';

export function ReviewsSection() {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <section
      className={`${styles.section} ${styles.paneBg} ${styles.reviewsSection}`}
      aria-labelledby="reviews-heading"
    >
      <div className={`${styles.paneInner} ${styles.container}`}>
        <div className={styles.ornament} aria-hidden="true">
          ✦ ─────────────── ✦
        </div>
        <h2 id="reviews-heading" className={styles.sectionTitle}>
          Reviews
        </h2>
        <p className={styles.sectionSub}>
          Already walked this path with Amber? Your words guide the next
          seeker.
        </p>
        <div className={styles.reviewsCtas}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setFormOpen((open) => !open)}
            aria-expanded={formOpen}
            aria-controls="home-review-form"
          >
            ✦ {formOpen ? 'Close Review Form' : 'Leave a Review Here'}
          </button>
          <a className={styles.btnSecondary} href="/contact">
            Leave a Review on Google ↗
          </a>
        </div>
        {formOpen ? (
          <div id="home-review-form" className={styles.reviewFormWrap}>
            <h3 className={styles.reviewFormTitle}>
              Share your experience with DreamEase Capsules
            </h3>
            <ReviewForm productHandle={REVIEWS_PRODUCT_HANDLE} />
          </div>
        ) : null}
        <div className={styles.reviewsList}>
          <ReviewList productHandle={REVIEWS_PRODUCT_HANDLE} />
        </div>
      </div>
    </section>
  );
}
