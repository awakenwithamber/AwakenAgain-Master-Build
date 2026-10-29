/**
 * Homepage for Amber's Alchemy Apothecary — Netlify fidelity rebuild.
 *
 * Section order follows the audited live site (see
 * docs/launch-readiness/NETLIFY_SOURCE_OF_TRUTH.md §4):
 * consult banner → hero → welcome video → goal cards → best sellers →
 * how-made → trust stats → reviews → learn → free guide.
 *
 * Owner amendment 2026-10-29: the quiz invite ("Not Sure Where to
 * Begin?", with the full quiz island embedded) sits directly after the
 * hero, before the welcome video — the quiz is a first-class homepage
 * section, never rearranged by personalization.
 *
 * Personalization (owner spec 2026-10-14): the server renders exactly
 * that default order for everyone. Only after mount, and only for
 * visitors who accepted analytics consent with a clear on-device top
 * interest, PersonalizedSections rearranges the content sections and
 * PickedForYou appears (lib/personalization rules, unit-tested). The
 * Grimoire promotion is never demoted.
 *
 * Shared chrome (skip link, header, footer) is rendered by
 * app/layout.tsx — do not duplicate it here. Pricing is display-only from
 * the canonical catalog; the server recomputes authoritatively at checkout.
 */
import type { Metadata } from 'next';
import { ConsultBanner } from '../components/home/ConsultBanner';
import { Hero } from '../components/home/Hero';
import { QuizInvite } from '../components/home/QuizInvite';
import { WelcomeVideo } from '../components/home/WelcomeVideo';
import { GoalCards } from '../components/home/GoalCards';
import { BestSellers } from '../components/home/BestSellers';
import { HowMade } from '../components/home/HowMade';
import { TrustStats } from '../components/home/TrustStats';
import { ReviewsSection } from '../components/home/ReviewsSection';
import { LearnSection } from '../components/home/LearnSection';
import { GrimoirePromo } from '../components/home/GrimoirePromo';
import { GuideSignup } from '../components/home/GuideSignup';
import { NetworkInvite } from '../components/home/NetworkInvite';
import { PersonalizedSections } from '../components/home/PersonalizedSections';
import { PickedForYou, type ArticlePick } from '../components/home/PickedForYou';
import { toCardModel, type HomeProductCardModel } from '../components/home/product-cards';
import { getProductByHandle, PRODUCTS } from '../lib/catalog/products';
import { JOURNAL_ARTICLES } from '../lib/content/journal';
import { pickHandlesForInterest } from '../lib/personalization/home-personalization';
import { INTEREST_CATEGORIES, type InterestCategory } from '../lib/personalization/interests';
import { BRAND_NAME } from '../lib/seo/config';

export const metadata: Metadata = {
  title: `${BRAND_NAME} — Handcrafted Botanical Apothecary`,
  description:
    'Discover your personal herbal allies at Amber\u2019s Alchemy Apothecary — small-batch botanical capsules, balms, and soaps, handcrafted in Salt Lake City, Utah.',
  alternates: { canonical: '/' },
};

/**
 * "Picked for you" candidate models for every interest — computed on the
 * server from the canonical catalog. The client row selects at most one
 * interest's models; the visitor's profile never leaves their device.
 */
function buildPicksByInterest(): Partial<
  Record<InterestCategory, HomeProductCardModel[]>
> {
  const picks: Partial<Record<InterestCategory, HomeProductCardModel[]>> = {};
  for (const category of INTEREST_CATEGORIES) {
    const models: HomeProductCardModel[] = [];
    for (const handle of pickHandlesForInterest(category, PRODUCTS)) {
      const product = getProductByHandle(handle);
      if (!product) continue;
      const model = toCardModel(product);
      if (model) models.push(model);
    }
    if (models.length > 0) picks[category] = models;
  }
  return picks;
}

const ARTICLE_PICKS: ArticlePick[] = JOURNAL_ARTICLES.slice(0, 3).map((a) => ({
  slug: a.slug,
  title: a.title,
  excerpt: a.excerpt,
}));

export default function HomePage() {
  return (
    <>
      <ConsultBanner />
      <main id="main-content">
        <Hero />
        <QuizInvite />
        <WelcomeVideo />
        <PersonalizedSections
          pickedForYou={
            <PickedForYou
              picksByInterest={buildPicksByInterest()}
              articlePicks={ARTICLE_PICKS}
            />
          }
          sections={{
            'goal-cards': <GoalCards />,
            'best-sellers': <BestSellers />,
            'how-made': <HowMade />,
            'trust-stats': <TrustStats />,
            reviews: <ReviewsSection />,
            learn: <LearnSection />,
          }}
          grimoirePromo={<GrimoirePromo />}
          afterSections={<GuideSignup />}
        />
        <NetworkInvite />
      </main>
    </>
  );
}
