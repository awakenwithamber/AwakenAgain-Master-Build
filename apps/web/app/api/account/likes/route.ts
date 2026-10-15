/**
 * POST /api/account/likes — save the profile's product likes
 * (Phase 3 Step 3).
 *
 * Body: { likes: string[], mode?: 'replace' | 'merge' }.
 * - 'replace' (default): the client's full local set IS the new set —
 *   this is what the like button's toggle sync sends.
 * - 'merge': union with the stored set — the first-sign-in sync, where
 *   likes collected on this device before the account existed join the
 *   profile without erasing anything already saved.
 * Handles are validated against the catalog at the store boundary
 * (unknown handles dropped, never stored). Analytics: count only.
 */
import { NextResponse } from 'next/server';
import {
  cleanLikes,
  loadAccountAsync,
  mergeLikes,
  setLikesAsync,
} from '../../../../lib/accounts/accounts';
import {
  accountFail,
  isRecordBody,
  readJsonBody,
  requireAccountSession,
} from '../../../../lib/accounts/http';
import { captureContentServerEventSoon } from '../../../../lib/analytics/content-posthog-server';
import { resolveServerDistinctId } from '../../../../lib/analytics/posthog-server';
import { enforceRateLimit } from '../../../../lib/security/rate-limit';

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'account');
  if (limited) return limited;

  const session = await requireAccountSession(request);
  if (!session.ok) return session.response;
  const email = session.identity.email;

  const body = await readJsonBody(request);
  if (!isRecordBody(body) || !Array.isArray(body.likes)) {
    return accountFail(['likes must be an array of product handles.'], 400);
  }
  const mode = body.mode === 'merge' ? 'merge' : 'replace';

  const current = await loadAccountAsync(email);
  const next =
    mode === 'merge'
      ? mergeLikes(current.likes, body.likes)
      : cleanLikes(body.likes);
  const state = await setLikesAsync(email, next);

  captureContentServerEventSoon(
    'profile_likes_updated',
    { like_count: state.likes.length },
    resolveServerDistinctId(
      request.headers.get('cookie'),
      `account-session:${session.identity.session_id.slice(0, 12)}`,
    ),
  );

  return NextResponse.json({ ok: true, likes: state.likes });
}
