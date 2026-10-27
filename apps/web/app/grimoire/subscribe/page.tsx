import type { Metadata } from 'next';
import { SubscribeForm } from '../../../components/grimoire/SubscribeForm';
import { UnlockPurchase } from '../../../components/grimoire/UnlockPurchase';
import { BRAND_NAME } from '../../../lib/seo/config';
import { grimoireUnlockCheckoutAvailable } from '../../../lib/grimoire/unlock-checkout';
import { grimoireSubscriptionCheckoutAvailable } from '../../../lib/subscriptions/subscription-checkout';
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
  title: `Living Grimoire — 333-page edition — ${BRAND_NAME}`,
  description:
    'Two ways into the Living Grimoire — 333-page edition: a one-time $8.88 permanent unlock (this edition plus all future chapters of it), or the $7.77/month subscription with 10% off storewide, monthly articles and rituals, and exclusive recipes.',
};

/**
 * Living Grimoire subscribe page — server component (Stage 2 rewrite
 * for truthfulness): the $8.88 PERMANENT_UNLOCK and the $7.77/month
 * subscription are presented as the two SEPARATE offers they are —
 * the old "Full access: $8.88 — or join…" framing conflated them.
 * Owner copy (Overview + ancestor pull-quote + framing teaser) is
 * VERBATIM from the 2026-10-21 owner files, Overview first, then the
 * framing teaser. No imagery is added (owner heirloom pictures are
 * pending; generated substitutes are never used).
 */
export default function GrimoireSubscribePage() {
  const unlockAvailable = grimoireUnlockCheckoutAvailable();
  const subscriptionCardAvailable = grimoireSubscriptionCheckoutAvailable();
  return (
    <>
      <main id="main-content">
        <h1>Living Grimoire — 333-page edition</h1>
        <p>
          <strong>Amber&apos;s Family Grimoire</strong> — a book, handmade by the women
          in my family, passed down from mother to daughter through generations.
          A book of true magic, recipes, spells, herbal wisdom, and more.
        </p>

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

        <UnlockPurchase available={unlockAvailable} />

        <section aria-labelledby="grimoire-subscription-heading">
          <h2 id="grimoire-subscription-heading">
            Subscription — $7.77/month (Living Grimoire — 333-page edition)
          </h2>
          <p>
            The subscription is a separate offer from the permanent unlock
            above: $7.77/month while your subscription is active, with new
            chapters every other month, plus 10% off storewide, monthly
            articles and rituals, and exclusive recipes. By card it
            auto-renews monthly by card; you can cancel anytime from your
            account page or the Stripe Customer Portal, and access
            continues through the paid period on cancellation. If your
            subscription ends, subscription access ends with it — a
            permanent unlock, if you hold one, is never removed by
            subscribing or cancelling, and the separate $8.88 unlock is
            unaffected by subscription cancellation. The manual Cash App /
            Venmo option remains available too — Amber confirms those
            memberships personally.
          </p>
          <SubscribeForm stripeAvailable={subscriptionCardAvailable} />
        </section>
      </main>
    </>
  );
}
