/**
 * Homepage for Amber's Alchemy Apothecary.
 *
 * Server component. Honest content only: no fabricated reviews, ratings,
 * certifications, scarcity, or inventory claims. Availability states live on
 * product pages.
 */
import type { Metadata } from 'next';
import { SiteHeader } from '../components/shop/SiteHeader';
import { SeasonalBanner } from '../components/shop/SeasonalBanner';
import { BRAND_NAME, BRAND_EMAIL, BRAND_PHONE_DISPLAY, BRAND_PHONE_TEL } from '../lib/seo/config';

export const metadata: Metadata = {
  title: `${BRAND_NAME} — Handcrafted Botanical Apothecary`,
  description:
    'Small-batch botanical soaps, capsules, balms, and custom alchemy blends from Amber\u2019s Alchemy Apothecary. Create your own soap or explore the apothecary.',
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section aria-labelledby="hero-heading">
          <h1 id="hero-heading">{BRAND_NAME}</h1>
          <p>
            Small-batch botanical apothecary — handcrafted soaps, capsules,
            balms, and custom alchemy blends.
          </p>
          <ul>
            <li>
              <a href="/shop">Shop the Apothecary</a>
            </li>
            <li>
              <a href="/soap-shop">Soap Shop</a>
            </li>
            <li>
              <a href="/soap-builder">Create Your Own Alchemy Soap</a>
            </li>
            <li>
              <a href="/about">About Amber</a>
            </li>
          </ul>
        </section>
        <SeasonalBanner />
        <section aria-labelledby="how-it-works">
          <h2 id="how-it-works">How ordering works</h2>
          <ol>
            <li>Choose a product or build your own custom soap.</li>
            <li>Check out — every total is recomputed on our server before your order is accepted.</li>
            <li>
              Pay with Cash App (<strong>$AmberPatten347</strong>) or Venmo (
              <strong>@AwakenwithAmber</strong>) using your order ID.
            </li>
          </ol>
          <p>Free shipping on orders $100+ ($75+ for Living Grimoire subscribers).</p>
        </section>
        <section aria-labelledby="contact">
          <h2 id="contact">Contact</h2>
          <address>
            Amber Lynn Patten
            <br />
            <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a>
            <br />
            <a href={BRAND_PHONE_TEL}>{BRAND_PHONE_DISPLAY}</a>
          </address>
        </section>
      </main>
    </>
  );
}
