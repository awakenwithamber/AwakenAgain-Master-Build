import type { Metadata } from 'next';
import { SubscribeForm } from '../../../components/grimoire/SubscribeForm';
import { BRAND_NAME } from '../../../lib/seo/config';

export const metadata: Metadata = {
  title: `Living Grimoire of Light & Magic — ${BRAND_NAME}`,
  description:
    'Get full access to Living Grimoire of Light & Magic for $8.88, or join for $7.77/month with new chapters every other month: 10% storewide discount, monthly articles and rituals, exclusive recipes, and early access.',
};

/**
 * Living Grimoire subscribe page (G1) — server component.
 * The interactive signup lives in components/grimoire/SubscribeForm.tsx.
 */
export default function GrimoireSubscribePage() {
  return (
    <>
      <main id="main-content">
        <h1>Living Grimoire of Light & Magic</h1>
        <p>
          <strong>Amber&apos;s Family Grimoire</strong> — a book, handmade by the women
          in my family, passed down from mother to daughter through generations.
          A book of true magic, healing, recipes, spells, and more.
        </p>
        <p>
          <strong>Full access: $8.88</strong> — or join the subscription for{' '}
          <strong>$7.77/month</strong> with new chapters every other month, plus
          10% off storewide, monthly articles and rituals, and exclusive recipes.
        </p>
        <SubscribeForm />
      </main>
    </>
  );
}
