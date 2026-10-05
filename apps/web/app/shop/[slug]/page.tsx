/**
 * Product detail page — server component.
 * generateStaticParams from the 45-record canonical catalog; full per-product
 * metadata; honest availability/provenance states. Soap products (category
 * 'Soaps') get the two-path scent selector; the Alchemy Soap Collection
 * bundle gets the 5-slot configurator; the superseded 9-bar collection is
 * shown as superseded (reference only, not for sale).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PRODUCTS, getProductByHandle } from '../../../lib/catalog/products';
import { PriceDisplay } from '../../../components/catalog/PriceDisplay';
import { SavingsDisplay } from '../../../components/catalog/SavingsDisplay';
import { SiteHeader } from '../../../components/shop/SiteHeader';
import { SoapCustomizer } from '../../../components/shop/SoapCustomizer';
import { BundleBuilder } from '../../../components/shop/BundleBuilder';
import { VariantAddToCart } from '../../../components/shop/VariantAddToCart';
import { ProductViewTracker } from '../../../components/shop/ProductViewTracker';
import {
  BUNDLE_NAME,
  bundleComponentSumCents,
} from '../../../lib/pricing/pricing';
import type { Product } from '../../../types';

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.handle }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductByHandle(slug);
  if (!product) return { title: 'Product not found' };
  const description =
    product.short_description ??
    `${product.title} — Amber's Alchemy Apothecary handcrafted botanicals.`;
  return {
    title: product.title,
    description,
    openGraph: {
      title: `${product.title} — Amber's Alchemy Apothecary`,
      description,
      type: 'website',
    },
  };
}

const SUPERSEDED_BUNDLE_HANDLE = 'full-soap-collection';
const ALCHEMY_BUNDLE_HANDLE = 'soap-style-collection-5';

function provenanceNote(product: Product): string {
  const images = (product.images ?? []) as Array<Record<string, unknown>>;
  if (images.length === 0) return 'Product photography in progress.';
  const hasPlaceholder = images.some(
    (img) => img.status === 'placeholder' || img.asset_status === 'MISSING_ASSET',
  );
  if (hasPlaceholder) return 'Product photography in progress — imagery shown is a placeholder.';
  const mapped = images.some((img) => img.status === 'mapped_photo');
  return mapped
    ? 'Catalog-reference photography on file; formula-specific photography pending.'
    : 'Product photography in progress.';
}

function PriceBlock({ product }: { product: Product }) {
  if (typeof product.price !== 'number') {
    return (
      <p>
        <strong>Pricing not yet established.</strong> Please contact Amber for
        current pricing: <a href="mailto:awaken@consultant.com">awaken@consultant.com</a>{' '}
        or <a href="tel:+18014148984">(801) 414-8984</a>.
      </p>
    );
  }
  return (
    <p>
      Price: <PriceDisplay cents={Math.round(product.price * 100)} />
      {typeof product.subscriber_price === 'number' ? (
        <span>
          {' '}
          · Living Grimoire subscriber{' '}
          <PriceDisplay cents={Math.round(product.subscriber_price * 100)} />
        </span>
      ) : null}
    </p>
  );
}

function PurchaseSection({ product }: { product: Product }) {
  if (product.handle === SUPERSEDED_BUNDLE_HANDLE) {
    return (
      <section aria-label="Availability notice">
        <h2>Superseded</h2>
        <p>
          This 9-bar collection has been superseded by{' '}
          <a href={`/shop/${ALCHEMY_BUNDLE_HANDLE}`}>{BUNDLE_NAME}</a> ($35.77 for
          five individually customizable soaps). This listing is kept for
          reference and is not available for purchase.
        </p>
      </section>
    );
  }
  if (product.handle === ALCHEMY_BUNDLE_HANDLE) {
    return <BundleBuilder />;
  }
  if (product.category === 'Soaps') {
    return <SoapCustomizer product={product} />;
  }
  if (typeof product.price === 'number') {
    return <VariantAddToCart product={product} />;
  }
  return null;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductByHandle(slug);
  if (!product) notFound();

  const featuredIngredients = (product.featured_ingredients ?? []) as Array<
    Record<string, unknown>
  >;
  const warnings = product.warnings as unknown;

  return (
    <>
      <SiteHeader />
      <main>
        <ProductViewTracker
          productHandle={product.handle}
          category={product.category}
        />
        <p>
          <a href="/shop">← Back to the shop</a>
        </p>
        <h1>{product.title}</h1>
        <p>{product.category}</p>
        <PriceBlock product={product} />
        {product.handle === ALCHEMY_BUNDLE_HANDLE ? (
          <SavingsDisplay componentSumCents={bundleComponentSumCents()} />
        ) : null}

        {product.extended_description ?? product.short_description ? (
          <section aria-label="Description">
            <p>{product.extended_description ?? product.short_description}</p>
          </section>
        ) : null}

        <PurchaseSection product={product} />

        <section aria-label="Availability">
          <h2>Availability</h2>
          <p>
            Availability is being confirmed across the catalog — we&apos;ll
            confirm your order personally before fulfillment. Small batches,
            made by hand.
          </p>
          <p>
            <small>{provenanceNote(product)}</small>
          </p>
        </section>

        {featuredIngredients.length > 0 ? (
          <section aria-label="Featured ingredients">
            <h2>Featured ingredients</h2>
            <ul>
              {featuredIngredients.map((fi, i) => (
                <li key={i}>
                  <strong>{String(fi.name)}</strong>
                  {fi.botanical_name ? (
                    <span> ({String(fi.botanical_name)})</span>
                  ) : null}
                  {fi.traditional_use ? (
                    <p>
                      <small>Traditional context: {String(fi.traditional_use)}</small>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            <p>
              <small>
                Evidence context is distinguished per ingredient — traditional
                use is not presented as clinical proof.
              </small>
            </p>
          </section>
        ) : null}

        {product.directions ? (
          <section aria-label="Directions">
            <h2>Directions</h2>
            <p>{String(product.directions)}</p>
          </section>
        ) : null}

        {warnings ? (
          <section aria-label="Safety">
            <h2>Safety</h2>
            <p>
              {Array.isArray(warnings)
                ? warnings.map((w) => String(w)).join(' ')
                : String(warnings)}
            </p>
          </section>
        ) : null}

        {product.disclaimer ? (
          <p>
            <small>{String(product.disclaimer)}</small>
          </p>
        ) : null}
      </main>
    </>
  );
}
