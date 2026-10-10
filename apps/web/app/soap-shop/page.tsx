/**
 * Soap Shop — with the Create Your Own Alchemy Soap builder at the top
 * (owner directive 2026-10-10: builder first, then 5 featured soaps).
 */
import { SOAP_SHAPES } from '../../lib/catalog/shapes';
import {
  BUNDLE_NAME,
  BUNDLE_PRICE_CENTS,
  bundleComponentSumCents,
} from '../../lib/pricing/pricing';
import { PriceDisplay } from '../../components/catalog/PriceDisplay';
import { SavingsDisplay } from '../../components/catalog/SavingsDisplay';
import { SoapBuilder } from '../../components/builder/SoapBuilder';

export const metadata = {
  title: 'The Soap Shop — Create Your Own Alchemy Soap',
  description:
    "Handcrafted botanical soaps from Amber's Alchemy Apothecary — design your own with the Alchemy Soap Builder, or choose from five featured signature soaps. Five shapes, thirteen scents, real botanicals.",
  keywords: [
    'handmade soap', 'artisan soap', 'natural soap', 'botanical soap',
    'custom soap', 'soap builder', 'goat milk soap', 'glycerin soap',
  ],
};

const FEATURED_SOUPS = [
  {
    name: "Gaia's Rose Soap",
    description:
      'Romantic rose petals with a gentle, loving scent — handcrafted with real botanicals.',
    image: '/images/products/gaias-rose-soap.webp',
    href: '/shop/gaias-rose-soap',
  },
  {
    name: 'Lavender Fairy Dream Soap',
    description:
      'Calming lavender to soothe the soul and ease you into restful sleep.',
    image: '/images/products/lavender-fairy-dream-soap.webp',
    href: '/shop/lavender-fairy-dream-soap',
  },
  {
    name: 'Citrus Goddess Glow Soap',
    description:
      'Bright, energizing citrus to awaken your senses and illuminate your skin.',
    image: '/images/products/citrus-goddess-glow-soap.webp',
    href: '/shop/citrus-goddess-glow-soap',
  },
  {
    name: 'Eucalyptus Mint Spa Renewal Soap',
    description:
      'Invigorating eucalyptus and mint for a spa-like renewal experience.',
    image: '/images/products/eucalyptus-mint-spa-renewal-soap.webp',
    href: '/shop/eucalyptus-mint-spa-renewal-soap',
  },
  {
    name: 'Sacred Forest Ritual Soap',
    description:
      'Grounding woodland botanicals for sacred cleansing and protection.',
    image: '/images/products/sacred-forest-ritual-soap.webp',
    href: '/shop/sacred-forest-ritual-soap',
  },
];

export default function SoapShopPage() {
  const componentSum = bundleComponentSumCents();
  return (
    <main id="main-content">
      <h1>The Soap Shop</h1>
      <p>
        Handcrafted botanical soaps from Amber&apos;s Alchemy Apothecary —
        blended from real essential oils, made by Amber herself.
      </p>

      {/* Builder at the top — owner directive 2026-10-10 */}
      <section aria-label="Create your own alchemy soap">
        <h2>Create Your Own Alchemy Soap</h2>
        <p>
          Choose your base, shape, scent, botanical, and color — then reveal
          your personal alchemy.
        </p>
        <SoapBuilder mode="single" />
      </section>

      {/* 5 featured soaps */}
      <section aria-label="Featured soaps">
        <h2>Five Featured Soaps</h2>
        <p>Amber&apos;s most loved signature creations.</p>
        <ul>
          {FEATURED_SOUPS.map((soap) => (
            <li key={soap.name}>
              <a href={soap.href}>
                <img
                  src={soap.image}
                  alt={soap.name}
                  loading="lazy"
                  width={400}
                  height={400}
                />
                <h3>{soap.name}</h3>
                <p>{soap.description}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Soap shapes">
        <h2>Five Signature Shapes</h2>
        <ul>
          {SOAP_SHAPES.map((shape) => (
            <li key={shape.id}>
              <h3>{shape.name}</h3>
              <p>
                {shape.weightOz} oz — <PriceDisplay cents={shape.priceCents} />
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Bundle">
        <h2>{BUNDLE_NAME}</h2>
        <p>
          One of each design — <PriceDisplay cents={BUNDLE_PRICE_CENTS} />
        </p>
        <SavingsDisplay componentSumCents={componentSum} />
      </section>
    </main>
  );
}
