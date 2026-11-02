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
 *
 * Owner decision 2026-11-02 (WS4, "do the larger edition"): for
 * wording and unlock scope, the edition is the FULL composed book —
 * the 333-page family edition together with the collected works
 * bound with it (1,389 pages in all). GRIMOIRE_EDITION_ID is
 * unchanged (it is the entitlement key on existing records); the
 * unlock scope below states the composed-edition coverage.
 */
export const GRIMOIRE_EDITION_ID = 'living-grimoire-333' as const;
export const GRIMOIRE_EDITION_NAME = 'Living Grimoire — 333-page edition';
export const GRIMOIRE_UNLOCK_PRICE_CENTS = 888;
export const GRIMOIRE_UNLOCK_SCOPE =
  'Living Grimoire — composed edition (1,389 pages): the complete ' +
  '333-page edition together with the collected works bound with ' +
  'it, plus all future chapters and revisions of this composed ' +
  'edition. Future separate editions and add-on products are not ' +
  'included.';
