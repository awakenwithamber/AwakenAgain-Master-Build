/**
 * /grimoire — the Living Grimoire book experience (WORKSTREAM D).
 *
 * SERVER component (Stage 2 + ingestion follow-on 2026-10-21): the
 * viewer's OTP session cookie is read here, entitlements are
 * resolved server-side (subscription ∪ PERMANENT_UNLOCK ∪ keeper —
 * lib/grimoire/entitlement), and ONLY the pages the viewer is
 * entitled to are passed to the client reader: pages 1–16 (free
 * preview) in full for everyone, locked placeholders (page number /
 * kind / label only) for pages 17+ unless entitled. Gated body text
 * never reaches a locked viewer's payload.
 *
 * The edition is the "Living Grimoire — 333-page edition" (owner
 * decision 2026-10-21, §13(1)). The reader now renders the FULL
 * composed book (1,389 pages): the 333-page family edition complete,
 * the original sigil lesson, and the collected works in full. The
 * held Black Books of Elverum (© 1999 Mary S. Rustad) contributes no
 * content — a rights-pending TOC/index entry only.
 */
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { GrimoireBook } from '../../components/grimoire/GrimoireBook';
import { GrimoireGate } from '../../components/grimoire/GrimoireGate';
import { InterestTracker } from '../../components/personalization/InterestTracker';
import {
  buildGrimoirePages,
  displayPagesFor,
} from '../../components/grimoire/grimoireContent';
import { getEditionManifest } from '../../lib/grimoire/manifest';
import { getBookContent } from '../../lib/grimoire/book-content';
import {
  GRIMOIRE_SESSION_COOKIE,
  getSharedOtpStore,
  getValidSession,
} from '../../lib/grimoire/otp';
import { resolveGrimoireEntitlement } from '../../lib/grimoire/entitlement';

export const metadata: Metadata = {
  title: 'Living Grimoire of Light & Magic — 333-page edition',
  description:
    "Open the Living Grimoire — 333-page edition: Amber's family grimoire, a handmade-style book of true magic, recipes, spells, and herbal wisdom, and botanical illustrations from Amber's Alchemy Apothecary. The first sixteen pages are a free preview; the full book — the family edition complete and the collected works in full — opens to subscribers and permanent-unlock holders.",
};

// Session + entitlement state is per-request — never static.
export const dynamic = 'force-dynamic';

export default async function GrimoirePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(GRIMOIRE_SESSION_COOKIE)?.value;
  const session = await getValidSession(getSharedOtpStore(), token);
  const entitlement = await resolveGrimoireEntitlement(session?.email ?? null);
  const pages = displayPagesFor(
    buildGrimoirePages(getEditionManifest(), getBookContent()),
    entitlement.entitled,
  );

  return (
    <main id="main-content">
      {/* Accessibility fix (2026-10-30): this page rendered no h1 (pre-
          existing, identical in production). The heading below is
          visually hidden via the global .visually-hidden utility
          (position:absolute, 1×1px, clipped) — it changes no pixels,
          layout, design, or reader behavior; it only gives the page a
          proper top-level heading for assistive technology and SEO. */}
      <h1 className="visually-hidden">
        Living Grimoire of Light &amp; Magic — 333-page edition
      </h1>
      <InterestTracker category="grimoire" signalKey="grimoire" />
      <GrimoireBook
        pages={pages}
        viewerEmail={entitlement.entitled ? entitlement.email : null}
      />
      {!entitlement.entitled && (
        <section aria-label="Member access">
          <GrimoireGate gateTitle="Living Grimoire — 333-page edition" />
          <p>
            No membership yet? The first sixteen pages above are free. See the{' '}
            <a href="/grimoire/subscribe">
              $8.88 permanent unlock and $7.77/month subscription options
            </a>{' '}
            for the full Living Grimoire — 333-page edition.
          </p>
        </section>
      )}
    </main>
  );
}
