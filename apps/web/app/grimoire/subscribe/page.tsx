import type { Metadata } from 'next';
import { SubscribeForm } from '../../../components/grimoire/SubscribeForm';
import { UnlockPurchase } from '../../../components/grimoire/UnlockPurchase';
import { BRAND_NAME } from '../../../lib/seo/config';
import {
  getEditionManifest,
  publishableBooks,
} from '../../../lib/grimoire/manifest';
import {
  ANCESTOR_PULL_QUOTE,
  ANCESTOR_PULL_QUOTE_ATTRIBUTION,
  GRIMOIRE_OVERVIEW_CLOSING,
  GRIMOIRE_OVERVIEW_ITEMS,
  GRIMOIRE_OVERVIEW_PARAGRAPHS,
  GRIMOIRE_TEASER_HEADING,
  GRIMOIRE_TEASER_PARAGRAPHS,
} from '../../../components/grimoire/grimoireContent';

export const metadata: Metadata = {
  title: `The Living Grimoire — 1,051 pages of preserved works — ${BRAND_NAME}`,
  description:
    'The Living Grimoire is a preservation of the collective works of generations — spells, rituals, and lost knowledge, found book by book and digitized to hold their magic and history for generations to come. A $7.77/month membership opens the full compilation; an $8.88 activation fee is charged only once. Plus 10% off storewide, exclusive articles and rituals, and more.',
};

/**
 * One-line contents description per collected work, keyed by the
 * manifest's book id. Grounded in the manifest's own attribution and
 * index lines (lib/grimoire/manifest.ts) — nothing invented.
 */
const WORK_DESCRIPTIONS: Record<string, string> = {
  'pow-wows-long-lost-friend':
    'Arts and remedies for man and animals — charms, cures, and protections, closing with the book’s own printed index.',
  'sepher-sephiroth':
    'The Qabalistic dictionary proper — Hebrew words arranged by numerical value (gematria), shown in facsimile with its text.',
  'book-of-ceremonial-magic-waite-1913':
    'Part I surveys the literature of ceremonial magic — the Key of Solomon, Abramelin, the Grimorium Verum and more; Part II is the Complete Grimoire of ritual texts.',
  'irish-witchcraft-and-demonology':
    'Nine chapters on Irish witchcraft trials, fairy-faith, and demonology, from the 1324 Kilkenny proceedings forward.',
  'book-of-forbidden-knowledge':
    'An item-numbered compendium — charms and spells, fortune-telling, physiognomy, natal astrology, and dream lore.',
};

/** Edition / year / translator facts per work, from the manifest. */
const WORK_EDITIONS: Record<string, string> = {
  'pow-wows-long-lost-friend':
    'John George Hohman, first published in the U.S. in 1820.',
  'sepher-sephiroth':
    'Aleister Crowley and Allan Bennett, The Equinox Vol. I No. 8 (1912).',
  'book-of-ceremonial-magic-waite-1913':
    'Arthur Edward Waite, London, 1913 (first edition 1898).',
  'irish-witchcraft-and-demonology':
    'St. John D. Seymour, 1913; this file is Project Gutenberg eBook #43651.',
  'book-of-forbidden-knowledge':
    'Early-20th-century U.S. compendium in the Johnson Smith & Co. tradition.',
};

/** Placeholder the owner fills with how each book came to her.
 *  Muse never invents a book's finding story. */
const STORY_PLACEHOLDER = '[STORY]';

/**
 * Living Grimoire subscribe page — server component.
 *
 * Copy corrected 2026-11-08 (owner, with a screenshot of the live
 * page): the old "333-page edition" headline and the "Amber's Family
 * Grimoire — handmade by the women in my family, passed down from
 * mother to daughter" claim were untrue and are gone. The honest
 * story is the owner's: the books were found, each in its own way;
 * the Living Grimoire is a preservation of the collective works of
 * generations. The works list renders from the edition manifest —
 * the same data the book itself is composed from — so it cannot
 * drift from what is actually in the volume. The held Elverum entry
 * is named for honesty and marked not-readable; rights-held material
 * is never marketed as readable content.
 *
 * Removal (owner decision 2026-11-08 21:50 MST): the four editions
 * whose files carried unresolved rights conflicts (Emerald Tablet,
 * Book of Raziel, Albertus Magnus — Egyptian Secrets, Grimorium
 * Verum) were removed from the compilation and the volume recounted
 * — 1,051 pages. They appear nowhere on this page.
 *
 * Offers: the $8.88 unlock and the $7.77/month membership are the
 * two separate offers they are, presented after the owner's own
 * membership framing. Both run on the manual payment rail — no card
 * checkout is offered or described here. Owner copy (Overview +
 * ancestor pull-quote + framing teaser) is VERBATIM from the
 * 2026-10-21 owner files.
 */
export default function GrimoireSubscribePage() {
  const manifest = getEditionManifest();
  const works = publishableBooks(manifest);
  const held = manifest.collectionBooks.filter((b) => b.held);
  return (
    <>
      <main id="main-content">
        <h1>The Living Grimoire — 1,051 Pages of Preserved Works</h1>
        <p>
          These books weren&apos;t handed down to me. I found them, each in
          its own way: a strange little bookstore, a random garage sale.
          Every one arrived like a blessing. The Living Grimoire preserves
          them: generations of spells, rituals, and lost knowledge,
          carefully digitized to protect the integrity of the magic and its
          history for generations to come.
        </p>

        <section aria-labelledby="grimoire-profile-cta-heading">
          <h2 id="grimoire-profile-cta-heading">Begin with your profile</h2>
          <p>Start here — your profile is your home at the Apothecary.</p>
          <p>
            <a href="/account">Create your profile</a>
          </p>
        </section>

        <section aria-labelledby="grimoire-works-heading">
          <h2 id="grimoire-works-heading">The works preserved in this volume</h2>
          <p>
            Counted exactly: 1,051 pages — The Grimoire of Remembered Light
            complete, an original sigil-making lesson, and five collected
            works in full.
          </p>
          <ul>
            <li>
              <strong>The Grimoire of Remembered Light</strong> — the
              333-page volume at the heart of the compilation: foundations,
              the wheel of the year, herbal allies, the five elements,
              rituals and reflections, recipes, and the apothecary, opened
              by the Ancestor&apos;s Note of T.H. Arthur.
              <br />
              Edition: the volume itself, complete in its 333 pages, with
              the Ancestor&apos;s Note by T.H. Arthur.
              <br />
              {STORY_PLACEHOLDER}
            </li>
            {works.map((book) => (
              <li key={book.id}>
                <strong>{book.title}</strong> —{' '}
                {WORK_DESCRIPTIONS[book.id] ?? book.indexLine}
                <br />
                Edition: {WORK_EDITIONS[book.id] ?? book.attribution}
                <br />
                {STORY_PLACEHOLDER}
              </li>
            ))}
            <li>
              <strong>An original sigil-making lesson</strong> — written for
              this volume, one page.
            </li>
            {held.map((book) => (
              <li key={book.id}>
                <strong>{book.title}</strong> — two Norwegian black books of
                the Cyprianus tradition. © 1999 Mary S. Rustad.{' '}
                <em>
                  Rights pending — catalogued here for honesty; its pages
                  are not yet readable.
                </em>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="grimoire-about-heading">
          <h2 id="grimoire-about-heading">About this book</h2>
          {GRIMOIRE_OVERVIEW_PARAGRAPHS.map((p) => (
            <p key={p.slice(0, 32)}>{p}</p>
          ))}
          <ul>
            {GRIMOIRE_OVERVIEW_ITEMS.map((item) => (
              <li key={item.slice(0, 32)}>{item}</li>
            ))}
          </ul>
          <p>{GRIMOIRE_OVERVIEW_CLOSING}</p>
          <blockquote>
            <p>“{ANCESTOR_PULL_QUOTE}”</p>
            <footer>{ANCESTOR_PULL_QUOTE_ATTRIBUTION}</footer>
          </blockquote>
        </section>

        <section aria-labelledby="grimoire-framing-heading">
          <h2 id="grimoire-framing-heading">{GRIMOIRE_TEASER_HEADING}</h2>
          {GRIMOIRE_TEASER_PARAGRAPHS.map((p) => (
            <p key={p.slice(0, 32)}>{p}</p>
          ))}
        </section>

        <section aria-labelledby="grimoire-membership-heading">
          <h2 id="grimoire-membership-heading">
            Become a keeper of the Living Grimoire
          </h2>
          <p>
            Your small $7.77/month membership allows you to unlock the full
            world of light magic. Joining carries a one-time $8.88
            activation fee — charged once, when you first join, never
            again. Plus more:
          </p>
          <ul>
            <li>📖 The Living Grimoire</li>
            <li>✨ 10% off storewide</li>
            <li>🌿 Exclusive articles &amp; rituals</li>
            <li>🎁 Subscriber-only gifts and offers</li>
            <li>🔮 Early access to new releases</li>
            <li>💌 Personalized recommendations</li>
          </ul>
          <p>
            Already hold the permanent unlock from before this membership
            model? What you bought stays yours — your access does not
            change.
          </p>
        </section>

        <UnlockPurchase />

        <section aria-labelledby="grimoire-subscription-heading">
          <h2 id="grimoire-subscription-heading">
            Subscription — $7.77/month
          </h2>
          <p>
            Membership works like this: $7.77/month while your
            subscription is active, with new
            chapters every other month, plus 10% off storewide, monthly
            articles and rituals, and exclusive recipes. Membership runs
            on the manual rail: you join with Cash App or Venmo (or an
            emailed invoice), Amber confirms your membership personally,
            and you send each month&apos;s payment to stay active — there
            is no automatic card charge. To cancel, just contact Amber;
            access continues through the paid period. If your
            subscription ends, subscription access ends with it — a
            permanent unlock bought before this membership model, if you
            hold one, is never removed by subscribing or cancelling.
          </p>
          <SubscribeForm />
        </section>
      </main>
    </>
  );
}
