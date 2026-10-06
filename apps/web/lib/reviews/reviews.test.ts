import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonlReviewStore, validateReview } from './reviews';

const HANDLES = new Set(['dreamease-capsules', 'soap-style-collection-5']);

describe('validateReview', () => {
  const good = {
    productHandle: 'dreamease-capsules',
    rating: 5,
    name: '  Maya R. ',
    title: 'Lovely evening ritual',
    body: 'This became part of my wind-down routine. Beautifully made.',
  };

  it('accepts a valid review and normalizes it', () => {
    const r = validateReview(good, HANDLES);
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({
      productHandle: 'dreamease-capsules',
      rating: 5,
      name: 'Maya R.',
      title: 'Lovely evening ritual',
    });
  });

  it('allows missing title', () => {
    const r = validateReview({ ...good, title: undefined }, HANDLES);
    expect(r.ok).toBe(true);
    expect(r.value?.title).toBeNull();
  });

  it('rejects unknown products, bad ratings, short bodies', () => {
    expect(
      validateReview({ ...good, productHandle: 'not-real' }, HANDLES).ok,
    ).toBe(false);
    expect(validateReview({ ...good, rating: 0 }, HANDLES).ok).toBe(false);
    expect(validateReview({ ...good, rating: 6 }, HANDLES).ok).toBe(false);
    expect(validateReview({ ...good, rating: 4.5 }, HANDLES).ok).toBe(false);
    expect(validateReview({ ...good, body: 'too short' }, HANDLES).ok).toBe(false);
  });

  it('rejects non-object bodies', () => {
    expect(validateReview(null, HANDLES).ok).toBe(false);
  });
});

describe('JsonlReviewStore', () => {
  let dir = '';
  afterEach(() => {
    delete process.env.REVIEW_STORE_DIR;
  });

  it('starts empty (no fabricated reviews) and queues new ones as pending', async () => {
    dir = mkdtempSync(join(tmpdir(), 'reviews-'));
    process.env.REVIEW_STORE_DIR = dir;
    const store = new JsonlReviewStore();

    expect(await store.listApproved('dreamease-capsules')).toEqual([]);
    expect(await store.listQueue()).toEqual([]);

    const submitted = await store.submit({
      productHandle: 'dreamease-capsules',
      rating: 5,
      name: 'Maya R.',
      title: null,
      body: 'Beautiful product, will repurchase.',
    });
    expect(submitted.status).toBe('pending');
    expect(submitted.id).toBeTruthy();

    // Still not publicly listed — pending is not approved.
    expect(await store.listApproved('dreamease-capsules')).toEqual([]);
    const queue = await store.listQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(submitted.id);
  });
});
