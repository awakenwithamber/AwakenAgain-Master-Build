/**
 * Browser glue for accounts (Phase 3 Step 3). Client-only.
 *
 * Binds the pure local modules (likes-local, personalization) to
 * window.localStorage and to the /api/account/* routes. Every network
 * call is best-effort: a failed sync never breaks the page — the
 * on-device copy remains the visitor's working set, and the profile
 * page offers an explicit "sync this device" action.
 */
import type { StorageLike } from '../personalization/consent';
import { readProfile } from '../personalization/interests';
import {
  readLocalLikes,
  toggleLocalLike,
  writeLocalLikes,
} from './likes-local';
import type { ProfileView } from './profile';

function local(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getLocalLikesNow(): string[] {
  const store = local();
  return store ? readLocalLikes(store) : [];
}

/** POST helper — resolves the JSON body, never throws. */
async function postJson(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok && json.ok === true, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: {} };
  }
}

/** The signed-in profile, or null (signed out / unavailable / offline). */
export async function fetchAccountProfile(): Promise<ProfileView | null> {
  try {
    const res = await fetch('/api/account/me', { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; profile?: ProfileView };
    return json.ok && json.profile ? json.profile : null;
  } catch {
    return null;
  }
}

/**
 * Toggle a like on this device, then — when signed in — replace the
 * profile's set with the device's (the toggle sync). Returns the new
 * local set immediately; the server sync is fire-and-forget.
 */
export function toggleLikeNow(handle: string): string[] {
  const store = local();
  if (!store) return [];
  const next = toggleLocalLike(store, handle);
  void postJson('/api/account/likes', { likes: next, mode: 'replace' });
  return next;
}

/**
 * First-sign-in / on-demand device sync: union the device's likes into
 * the profile (merge — nothing already saved is lost) and push the
 * on-device progress the site already tracks (interest snapshot; the
 * quiz stamp is set server-side when a result is saved). Resolves true
 * when the visitor is signed in and the calls landed.
 */
export async function syncDeviceToProfile(): Promise<boolean> {
  const profile = await fetchAccountProfile();
  if (!profile) return false;
  const likes = getLocalLikesNow();
  if (likes.length > 0) {
    await postJson('/api/account/likes', { likes, mode: 'merge' });
  }
  const store = local();
  if (store) {
    const interests = readProfile(store);
    await postJson('/api/account/progress', { interests });
  }
  return true;
}

/** Explicit "save this search" (signed-in only; resolves the outcome). */
export async function saveSearchToProfile(
  query: string,
  surface: 'catalog' | 'herbs',
): Promise<'saved' | 'signin' | 'error'> {
  const res = await postJson('/api/account/searches', {
    action: 'save',
    query,
    surface,
  });
  if (res.ok) return 'saved';
  if (res.status === 401 || res.status === 503) return 'signin';
  return 'error';
}

/** Adopt the server's like set locally (after a profile-page removal). */
export function adoptServerLikes(likes: string[]): void {
  const store = local();
  if (store) writeLocalLikes(store, likes);
}
