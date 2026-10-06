/**
 * Review validation + moderation-queue store (G4).
 *
 * Honesty contract: this app ships NO fabricated reviews. The moderation
 * queue starts EMPTY; every review enters as `pending` and only an explicit
 * owner approval flips it to `approved`. The public list endpoint only ever
 * serves approved reviews — so until moderation exists, list responses are
 * empty by design, and components render honest empty states.
 *
 * Storage is provider-neutral behind `ReviewStore`; local JSONL now.
 * Server-only: uses node:fs. Never import from a client component.
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Review {
  id: string;
  productHandle: string;
  rating: number;
  name: string;
  title: string | null;
  body: string;
  status: ReviewStatus;
  createdAt: string;
  /** Migration source tag. */
  source: 'nextjs';
}

const MAX_NAME = 80;
const MAX_TITLE = 120;
const MAX_BODY = 2000;
const MIN_BODY = 10;

export interface ReviewInput {
  productHandle: string;
  rating: number;
  name: string;
  title: string | null;
  body: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  errors: string[];
  value?: T;
}

function cleanString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  if (t.length === 0 || t.length > max) return null;
  return t;
}

/**
 * Pure validation for a review submission. `knownHandles` is injected so
 * this stays testable without importing the whole catalog.
 */
export function validateReview(
  body: unknown,
  knownHandles: ReadonlySet<string>,
): ValidationResult<ReviewInput> {
  const errors: string[] = [];
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }
  const b = body as Record<string, unknown>;
  const productHandle = typeof b.productHandle === 'string' ? b.productHandle.trim() : '';
  if (!productHandle || !knownHandles.has(productHandle)) {
    errors.push('Unknown product — please submit from a real product page.');
  }
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.push('Rating must be a whole number from 1 to 5.');
  }
  const name = cleanString(b.name, MAX_NAME);
  if (!name) errors.push('Please share a display name (up to 80 characters).');
  const title =
    b.title === undefined || b.title === null || b.title === ''
      ? null
      : cleanString(b.title, MAX_TITLE);
  if (b.title && title === null)
    errors.push('Title must be 120 characters or fewer.');
  const bodyText =
    typeof b.body === 'string' ? b.body.trim().replace(/\s+/g, ' ') : '';
  if (bodyText.length < MIN_BODY)
    errors.push('Please write a few words about your experience (at least 10 characters).');
  if (bodyText.length > MAX_BODY)
    errors.push('Review is too long — 2000 characters maximum.');
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: { productHandle, rating, name: name!, title, body: bodyText },
  };
}

export interface ReviewStore {
  /** Append as `pending`. Returns the stored record. */
  submit(input: ReviewInput): Promise<Review>;
  /** Only `approved` reviews — the public surface. Empty until moderated. */
  listApproved(productHandle: string): Promise<Review[]>;
  /** Moderation queue (pending first). Owner-facing. */
  listQueue(): Promise<Review[]>;
}

function storeDir(): string {
  return process.env.REVIEW_STORE_DIR ?? join(process.cwd(), 'data', 'reviews');
}

const FILE = 'reviews.jsonl';

async function readAll(): Promise<Review[]> {
  try {
    const raw = await readFile(join(storeDir(), FILE), 'utf8');
    return raw
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as Review);
  } catch {
    return [];
  }
}

export class JsonlReviewStore implements ReviewStore {
  async submit(input: ReviewInput): Promise<Review> {
    const record: Review = {
      ...input,
      id: randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      source: 'nextjs',
    };
    const dir = storeDir();
    await mkdir(dir, { recursive: true });
    await appendFile(join(dir, FILE), JSON.stringify(record) + '\n', 'utf8');
    return record;
  }

  async listApproved(productHandle: string): Promise<Review[]> {
    const all = await readAll();
    return all
      .filter((r) => r.productHandle === productHandle && r.status === 'approved')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listQueue(): Promise<Review[]> {
    const all = await readAll();
    return all.sort((a, b) => {
      const rank = (s: ReviewStatus) =>
        s === 'pending' ? 0 : s === 'approved' ? 1 : 2;
      return rank(a.status) - rank(b.status) || b.createdAt.localeCompare(a.createdAt);
    });
  }
}

export const reviewStore: ReviewStore = new JsonlReviewStore();
