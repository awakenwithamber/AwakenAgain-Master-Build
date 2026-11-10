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
 * Owner correction 2026-11-08 (refined 21:22 MST): the public
 * name/framing changed. The compilation is NOT "Amber's family
 * grimoire" and the product is the full compilation — counted
 * exactly, never rounded up — not a "333-page edition": the 333
 * pages are the one volume (The Grimoire of Remembered Light) at
 * its heart. GRIMOIRE_EDITION_ID is unchanged (the entitlement key
 * on existing records).
 *
 * Owner decision 2026-11-08 21:50 MST ("remove all copyrighted
 * conflicts"): the four rights-conflicted editions (Emerald Tablet
 * file, Book of Raziel, Albertus Magnus — Egyptian Secrets,
 * Grimorium Verum) were removed from the compilation and the book
 * recounted: 1,051 composed pages (1,033 digitized source pages).
 *
 * Owner decision 2026-11-02 (WS4, "do the larger edition"): for
 * wording and unlock scope, the edition is the FULL composed book —
 * the 333-page family edition together with the collected works
 * bound with it (1,051 pages in all). GRIMOIRE_EDITION_ID is
 * unchanged (it is the entitlement key on existing records); the
 * unlock scope below states the composed-edition coverage.
 *
 * Owner decision 2026-11-09 (supersedes the purchase framing of
 * §13(1)/(2) above): the $8.88 permanent unlock was eliminated as a
 * purchase option; full access now comes with the $7.77/month
 * subscription while it is active. The scope text below survives
 * only as the stored coverage statement on legacy unlock records.
 */
export const GRIMOIRE_EDITION_ID = 'living-grimoire-333' as const;
/*
 * Owner retitle 2026-11-09: the book is titled "The Living Grimoire —
 * The Collective Works of Light Magic & Lost Knowledge" (the title is
 * tooled into the cover art itself). The counted total (1,051 pages)
 * still lives in the unlock scope below and the page copy.
 */
export const GRIMOIRE_EDITION_NAME =
  'The Living Grimoire — The Collective Works of Light Magic & Lost Knowledge';
/*
 * LEGACY RECORD CONSTANTS — $8.88 ABOLITION (owner decision
 * 2026-11-09): the permanent unlock is NO LONGER SOLD. No offer,
 * panel, intake route, checkout, webhook arm, or admin action reads
 * these values to sell or grant anything anymore. They are retained
 * ONLY because preserved legacy code still names them: the scope
 * text below is what lib/grimoire/unlock.ts stamps onto a grant
 * record (the entitlement ledger's stored scope for the owner's own
 * preserved access), and the price is the historical amount carried
 * by the unlock-request ledger module and its owner-notification
 * builder. GRIMOIRE_EDITION_ID above is unchanged — it is the
 * entitlement key on existing records.
 */
export const GRIMOIRE_UNLOCK_PRICE_CENTS = 888;
export const GRIMOIRE_UNLOCK_SCOPE =
  'The Living Grimoire — composed edition (1,051 pages): The ' +
  'Grimoire of Ancient Teachings complete, together ' +
  'with the collected works bound with it, plus all future chapters ' +
  'and revisions of this composed edition. Future separate editions ' +
  'and add-on products are not included.';
