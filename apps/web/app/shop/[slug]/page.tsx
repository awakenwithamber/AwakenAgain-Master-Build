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
import { isSupersededProduct } from '../../../lib/catalog/status';
import { PriceDisplay } from '../../../components/catalog/PriceDisplay';
import { SavingsDisplay } from '../../../components/catalog/SavingsDisplay';
import { LikeButton } from '../../../components/shop/LikeButton';
import { SoapCustomizer } from '../../../components/shop/SoapCustomizer';
import { BundleBuilder } from '../../../components/shop/BundleBuilder';
import { VariantAddToCart } from '../../../components/shop/VariantAddToCart';
import { ProductViewTracker } from '../../../components/shop/ProductViewTracker';
import {
  BUNDLE_NAME,
  bundleComponentSumCents,
} from '../../../lib/pricing/pricing';
import {
  getProductDisplayImage,
  type ProductDisplayImage,
} from '../../../lib/media/product-image';
import type { Product } from '../../../types';
import Link from 'next/link';

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

const ALCHEMY_BUNDLE_HANDLE = 'soap-style-collection-5';

function provenanceNote(
  product: Product,
  displayImage: ProductDisplayImage | null,
): string {
  // A verified documentary photo of the actual product is rendered above;
  // say exactly that (only DreamEase qualifies as of the 2026-10-13 audit).
  if (displayImage?.documentaryPhoto) {
    return "Product photography: the maker's own photo of this product, shown above.";
  }
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
        or <a href="tel:+18018196795">(801) 819-6795</a>.
      </p>
    );
  }
  return (
    <p>
      Price: <PriceDisplay cents={Math.round(product.price * 100)} />
      {typeof product.subscriber_price === 'number' ? (
        <span>
          {' '}
          · Living Grimoire of Light & Magic subscriber{' '}
          <PriceDisplay cents={Math.round(product.subscriber_price * 100)} />
        </span>
      ) : null}
    </p>
  );
}

function PurchaseSection({ product }: { product: Product }) {
  if (isSupersededProduct(product)) {
    // Kept for direct visits that arrive without the next.config redirect
    // (and for any future superseded products): honest reference-only
    // notice, no purchase path. The replacement link comes from the
    // record's own superseded_by field; the Alchemy collection is the
    // fallback only when the record names none.
    const replacementHandle = product.superseded_by ?? ALCHEMY_BUNDLE_HANDLE;
    const replacement = getProductByHandle(replacementHandle);
    return (
      <section aria-label="Availability notice">
        <h2>Superseded</h2>
        <p>
          This product has been superseded by{' '}
          <Link href={`/shop/${replacementHandle}`}>
            {replacement?.title ?? BUNDLE_NAME}
          </Link>
          . This listing is kept for reference and is not available for
          purchase.
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
  // Renders only when the image registry and the product record agree on a
  // deployed image for this product (see lib/media/product-image.ts);
  // generated/styled artwork carries an honest representation caption.
  const displayImage = getProductDisplayImage(product);

  return (
    <>
      <main>
        <ProductViewTracker
          productHandle={product.handle}
          category={product.category}
        />
        <p>
          <Link href="/shop">← Back to the shop</Link>
        </p>
        <h1>{product.title}</h1>
        <p>{product.category}</p>
        {/* Superseded products show NO price at all — a reference listing
            must not display a purchasable-looking price above its notice. */}
        {isSupersededProduct(product) ? null : (
          <PriceBlock product={product} />
        )}
        {/* Like (Phase 3 Step 3): explicit tap, kept on-device and in
            the signed-in profile. Superseded listings are reference
            only — no like affordance, like no price. */}
        {isSupersededProduct(product) ? null : (
          <p>
            <LikeButton handle={product.handle} />
          </p>
        )}
        {product.handle === ALCHEMY_BUNDLE_HANDLE ? (
          <SavingsDisplay componentSumCents={bundleComponentSumCents()} />
        ) : null}

        {displayImage ? (
          <figure>
            <img src={displayImage.src} alt={displayImage.alt} />
            {displayImage.caption ? (
              <figcaption>
                <small>{displayImage.caption}</small>
              </figcaption>
            ) : null}
          </figure>
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
            <small>{provenanceNote(product, displayImage)}</small>
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
