/**
 * Soap Shop — proof-of-concept SERVER component.
 * Proves server-side data flow: shapes, bundle pricing, and savings all render
 * from the canonical catalog modules. No client JavaScript on this page.
 */
import { SOAP_SHAPES } from '../../lib/catalog/shapes';
import {
  BUNDLE_NAME,
  BUNDLE_PRICE_CENTS,
  bundleComponentSumCents,
} from '../../lib/pricing/pricing';
import { PriceDisplay } from '../../components/catalog/PriceDisplay';
import { SavingsDisplay } from '../../components/catalog/SavingsDisplay';

export const metadata = {
  title: 'The Soap Shop',
  description:
    "Handcrafted botanical soaps from Amber's Alchemy Apothecary — five signature shapes, thirteen signature scents, and the Alchemy Soap Collection.",
};

export default function SoapShopPage() {
  const componentSum = bundleComponentSumCents();
  return (
    <main id="main-content">
      <h1>The Soap Shop</h1>
      <p>Handcrafted botanical soaps from Amber&apos;s Alchemy Apothecary.</p>

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
