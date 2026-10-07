/**
 * Homepage for Amber's Alchemy Apothecary — Netlify fidelity rebuild.
 *
 * Section order follows the audited live site (see
 * docs/launch-readiness/NETLIFY_SOURCE_OF_TRUTH.md §4):
 * consult banner → hero → welcome video → goal cards → best sellers →
 * how-made → trust stats → reviews → learn → free guide.
 *
 * Shared chrome (skip link, SiteNotice, header, footer) is rendered by
 * app/layout.tsx — do not duplicate it here. Pricing is display-only from
 * the canonical catalog; the server recomputes authoritatively at checkout.
 */
import type { Metadata } from 'next';
import { ConsultBanner } from '../components/home/ConsultBanner';
import { Hero } from '../components/home/Hero';
import { WelcomeVideo } from '../components/home/WelcomeVideo';
import { GoalCards } from '../components/home/GoalCards';
import { BestSellers } from '../components/home/BestSellers';
import { HowMade } from '../components/home/HowMade';
import { TrustStats } from '../components/home/TrustStats';
import { ReviewsSection } from '../components/home/ReviewsSection';
import { LearnSection } from '../components/home/LearnSection';
import { GuideSignup } from '../components/home/GuideSignup';
import { BRAND_NAME } from '../lib/seo/config';

export const metadata: Metadata = {
  title: `${BRAND_NAME} — Handcrafted Botanical Apothecary`,
  description:
    'Discover your personal herbal allies at Amber\u2019s Alchemy Apothecary — small-batch botanical capsules, balms, and soaps, handcrafted in Salt Lake City, Utah.',
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <>
      <ConsultBanner />
      <main id="main-content">
        <Hero />
        <WelcomeVideo />
        <GoalCards />
        <BestSellers />
        <HowMade />
        <TrustStats />
        <ReviewsSection />
        <LearnSection />
        <GuideSignup />
      </main>
    </>
  );
}
