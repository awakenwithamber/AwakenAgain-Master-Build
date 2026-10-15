/**
 * POST /api/account/searches — save/remove a profile search
 * (Phase 3 Step 3).
 *
 * Body: { action: 'save', query, surface: 'catalog' | 'herbs' }
 *     | { action: 'remove', search_id }
 * Saves are EXPLICIT only (the "Save this search" buttons on the
 * catalog search and the Herb Explorer) — searching itself records
 * nothing server-side. Analytics: the surface id only, never the query.
 */
import { NextResponse } from 'next/server';
import {
  cleanSearchQuery,
  removeSearchAsync,
  saveSearchAsync,
  type SavedSearch,
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
  if (!isRecordBody(body)) {
    return accountFail(['Request body must be a JSON object.'], 400);
  }

  if (body.action === 'remove') {
    if (typeof body.search_id !== 'string' || !body.search_id) {
      return accountFail(['search_id is required.']);
    }
    const state = await removeSearchAsync(email, body.search_id);
    return NextResponse.json({ ok: true, searches: state.searches });
  }

  if (body.action !== 'save') {
    return accountFail(["action must be 'save' or 'remove'."]);
  }
  const query = cleanSearchQuery(body.query);
  if (!query) {
    return accountFail(['Please enter a search of 2–120 characters to save.']);
  }
  const surface: SavedSearch['surface'] =
    body.surface === 'herbs' ? 'herbs' : 'catalog';
  const state = await saveSearchAsync(email, query, surface);

  captureContentServerEventSoon(
    'profile_search_saved',
    { surface },
    resolveServerDistinctId(
      request.headers.get('cookie'),
      `account-session:${session.identity.session_id.slice(0, 12)}`,
    ),
  );

  return NextResponse.json({ ok: true, searches: state.searches });
}
