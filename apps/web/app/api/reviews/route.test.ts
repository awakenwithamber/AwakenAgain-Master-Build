import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from './route';

function post(body: unknown): Request {
  return new Request('http://localhost/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('reviews route', () => {
  beforeEach(() => {
    process.env.REVIEW_STORE_DIR = mkdtempSync(join(tmpdir(), 'reviews-'));
  });
  afterEach(() => {
    delete process.env.REVIEW_STORE_DIR;
  });

  it('GET returns empty list with honest note for a real product', async () => {
    const res = await GET(
      new Request('http://localhost/api/reviews?product=dreamease-capsules'),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.reviews).toEqual([]);
    expect(json.note).toContain('No approved reviews yet');
  });

  it('GET rejects unknown products → 400', async () => {
    const res = await GET(
      new Request('http://localhost/api/reviews?product=nope'),
    );
    expect(res.status).toBe(400);
  });

  it('POST queues a valid review as pending (never public) → 201', async () => {
    const res = await POST(
      post({
        productHandle: 'dreamease-capsules',
        rating: 5,
        name: 'Maya R.',
        title: 'Lovely ritual',
        body: 'Beautifully made — this is now part of my evening routine.',
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe('pending');

    // Still not publicly listed.
    const list = await GET(
      new Request('http://localhost/api/reviews?product=dreamease-capsules'),
    );
    expect((await list.json()).reviews).toEqual([]);
  });

  it('POST rejects invalid ratings → 422', async () => {
    const res = await POST(
      post({
        productHandle: 'dreamease-capsules',
        rating: 9,
        name: 'Maya',
        body: 'Way too many stars.',
      }),
    );
    expect(res.status).toBe(422);
  });
});
