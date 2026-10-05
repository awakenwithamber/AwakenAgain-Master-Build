/**
 * Shop index — server component. All 45 catalog records, grouped by
 * category, plus the seasonal feature banner. Brand: "Amber's Alchemy
 * Apothecary" exact everywhere.
 */
import type { Metadata } from 'next';
import { PRODUCTS } from '../../lib/catalog/products';
import { SiteHeader } from '../../components/shop/SiteHeader';
import { ProductCard } from '../../components/shop/ProductCard';
import { SeasonalBanner } from '../../components/shop/SeasonalBanner';

export const metadata: Metadata = {
  title: 'Shop',
  description:
    "Shop Amber's Alchemy Apothecary — handcrafted botanical soaps, capsules, balms, teas, the Living Grimoire, and the Alchemy Soap Collection.",
};

const CATEGORY_ORDER = [
  'Soaps',
  'Bundles',
  'Capsules',
  'Balms & Skincare',
  'Teas',
  'Grimoire & Digital',
  'Custom & Consultations',
  'Services',
];

export default function ShopPage() {
  const categories = CATEGORY_ORDER.filter((c) =>
    PRODUCTS.some((p) => p.category === c),
  );
  return (
    <>
      <SiteHeader />
      <main>
        <h1>Shop Amber&apos;s Alchemy Apothecary</h1>
        <p>
          Handcrafted botanical goods — made by Amber in small batches, never
          mass-produced.
        </p>
        <SeasonalBanner />
        {categories.map((category) => (
          <section key={category} aria-label={category}>
            <h2>{category}</h2>
            {PRODUCTS.filter((p) => p.category === category).map((product) => (
              <ProductCard key={product.handle} product={product} />
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
