import type { Metadata } from 'next';
import { SiteHeader } from '../../../components/shop/SiteHeader';
import { SubscribeForm } from '../../../components/grimoire/SubscribeForm';
import { BRAND_NAME } from '../../../lib/seo/config';

export const metadata: Metadata = {
  title: `Join the Living Grimoire — ${BRAND_NAME}`,
  description:
    'Join the Living Grimoire for $7.77/month: 10% storewide discount, monthly articles and rituals, exclusive recipes, and early access. Pay with Cash App or Venmo.',
};

/**
 * Living Grimoire subscribe page (G1) — server component.
 * The interactive signup lives in components/grimoire/SubscribeForm.tsx.
 */
export default function GrimoireSubscribePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <h1>Living Grimoire Subscription</h1>
        <p>
          <strong>Amber&apos;s Alchemy Apothecary</strong> — the Living Grimoire is the
          membership heart of the apothecary: botanical knowledge, rituals, recipes, and a
          10% subscriber discount on every order.
        </p>
        <SubscribeForm />
      </main>
    </>
  );
}
