/**
 * On-device likes — the local half of profile likes (Phase 3 Step 3).
 *
 * A like is an EXPLICIT visitor action (tapping the heart on a product
 * page), so it is kept on the device — like other explicit on-device
 * state — without waiting for analytics consent. It lives in
 * localStorage under its own key,
 * in the personalization modules' storage-injectable style, and it is
 * synced to the visitor's profile when (and only when) they sign in:
 * merge at first sign-in, replace on every later toggle.
 *
 * Pure + storage-injectable for unit tests; the browser glue is in
 * lib/accounts/client.ts.
 */
import type { StorageLike } from '../personalization/consent';

export const LIKES_STORAGE_KEY = 'aa_likes_v1';

/** Read the device's liked product handles. Corrupt data reads as none. */
export function readLocalLikes(storage: StorageLike): string[] {
  try {
    const raw = storage.getItem(LIKES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const likes: string[] = [];
    for (const item of parsed) {
      if (typeof item === 'string' && item && !likes.includes(item)) {
        likes.push(item);
      }
    }
    return likes;
  } catch {
    return [];
  }
}

export function writeLocalLikes(storage: StorageLike, likes: string[]): void {
  try {
    storage.setItem(LIKES_STORAGE_KEY, JSON.stringify(likes));
  } catch {
    /* storage unavailable — likes simply stay unsaved on this device */
  }
}

/** Toggle one handle; returns the new set. */
export function toggleLocalLike(storage: StorageLike, handle: string): string[] {
  const likes = readLocalLikes(storage);
  const next = likes.includes(handle)
    ? likes.filter((h) => h !== handle)
    : [...likes, handle];
  writeLocalLikes(storage, next);
  return next;
}
