/**
 * Grimoire edition constants — CLIENT-SAFE (pure strings/numbers, no
 * server imports). The server-only ledger in lib/grimoire/unlock.ts
 * re-exports these; client components import them from HERE so no
 * server module ever enters the client bundle.
 *
 * Owner decision 2026-10-21 (§13(1) + §13(2)): the canonical edition
 * is the 333-page edition; there is NO 117-page edition. The $8.88
 * PERMANENT_UNLOCK covers this edition plus all future
 * chapters/revisions of it — not separate future editions/add-ons.
 */
export const GRIMOIRE_EDITION_ID = 'living-grimoire-333' as const;
export const GRIMOIRE_EDITION_NAME = 'Living Grimoire — 333-page edition';
export const GRIMOIRE_UNLOCK_PRICE_CENTS = 888;
export const GRIMOIRE_UNLOCK_SCOPE =
  'Living Grimoire — 333-page edition: the current edition plus all ' +
  'future chapters and revisions of this edition. Future separate ' +
  'editions and add-on products are not included.';
