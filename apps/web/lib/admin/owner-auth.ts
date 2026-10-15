/**
 * Owner bridge auth — SHARED by the Phase 2 admin tooling routes.
 *
 * BRIDGE AUTH — every route using this helper is protected by a dedicated
 * server-side secret (env `OWNER_ADMIN_SECRET`, presented in the
 * `x-owner-secret` header and compared in constant time) ONLY until real
 * admin auth replaces it. The admin gate (lib/admin/auth.ts) is a preview
 * toggle (ADMIN_PREVIEW_ENABLED), NOT authentication, so it is
 * deliberately not used for writes. When real admin auth lands, swap
 * `ownerAuthorized()` for it in every consumer and retire the env secret.
 *
 * Fail-closed contract (identical in every consumer):
 * - `OWNER_ADMIN_SECRET` unset/empty → 'unconfigured' → the route answers
 *   404, indistinguishable from a route that does not exist.
 * - Wrong/absent secret → 'denied' → the route answers 401.
 * - The secret and the header value are NEVER logged, by this helper or
 *   its consumers.
 *
 * History: POST /api/admin/subscriptions/confirm (the first owner-secret
 * route) carries this check inline in its route module; the Phase 2
 * tooling routes (order tracking, subscription cancel, broadcast) share
 * this module so the contract cannot drift between them.
 *
 * SERVER-ONLY: reads a server env secret. Never import from a client
 * component.
 */
import { timingSafeEqual } from 'node:crypto';

export type OwnerAuth = 'unconfigured' | 'denied' | 'granted';

/**
 * Constant-time check of the `x-owner-secret` header against the
 * server-side `OWNER_ADMIN_SECRET`. The length guard runs first because
 * timingSafeEqual throws on unequal-length buffers; length itself is not
 * treated as secret. Nothing here logs either value.
 */
export function ownerAuthorized(request: Request): OwnerAuth {
  const expected = process.env.OWNER_ADMIN_SECRET;
  if (!expected) return 'unconfigured';
  const presented = request.headers.get('x-owner-secret');
  if (!presented) return 'denied';
  const presentedBuf = Buffer.from(presented, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (presentedBuf.length !== expectedBuf.length) return 'denied';
  return timingSafeEqual(presentedBuf, expectedBuf) ? 'granted' : 'denied';
}

/** True when the owner secret exists on the server (value never exposed). */
export function ownerSecretConfigured(): boolean {
  return Boolean(process.env.OWNER_ADMIN_SECRET);
}
