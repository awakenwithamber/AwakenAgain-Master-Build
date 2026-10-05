/**
 * Shared structured-data component for Amber's Alchemy Apothecary.
 *
 * - OrganizationJsonLd — Organization + WebSite graph. Render once in
 *   the root layout. Brand name is the EXACT canonical name, never shortened.
 * - ProductJsonLd — Product + Offer graph for product pages. Accepts product
 *   data as props; the product-page worker wires it to /shop/[handle]
 *   (see lib/seo/routes.ts registry).
 *
 * All identity values come from lib/seo/config — never retyped here.
 *
 * Written with React.createElement (no JSX): this repo's vitest transform
 * cannot parse JSX in .tsx imports (rolldown ssrTransform limitation —
 * see MIGRATION_LEDGER). createElement keeps the component unit-testable
 * and behaves identically under Next.js.
 */
import { createElement } from 'react';
import {
  BRAND_EMAIL,
  BRAND_NAME,
  BRAND_PHONE_JSONLD,
  siteUrl,
} from '../../lib/seo/config';

function JsonLdScript({ id, data }: { id: string; data: Record<string, unknown> }) {
  return createElement('script', {
    id,
    type: 'application/ld+json',
    dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
  });
}

/** Organization + WebSite structured data. Render once in app/layout.tsx. */
export function OrganizationJsonLd() {
  const base = siteUrl();
  return JsonLdScript({
    id: 'jsonld-organization',
    data: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${base}/#organization`,
          name: BRAND_NAME,
          url: base,
          email: BRAND_EMAIL,
          telephone: BRAND_PHONE_JSONLD,
        },
        {
          '@type': 'WebSite',
          '@id': `${base}/#website`,
          url: base,
          name: BRAND_NAME,
          publisher: { '@id': `${base}/#organization` },
        },
      ],
    },
  });
}

export interface ProductJsonLdProps {
  product: {
    /** Canonical product title. */
    name: string;
    /** Compliant short description. */
    description?: string;
    /** Absolute image URLs (product images with provenance). */
    images?: string[];
    /** SKU or canonical product ID. */
    sku?: string;
    /** Server-authoritative price in integer cents. Converted here — never hard-coded. */
    priceCents: number;
    currency?: string;
    /** Schema.org availability, e.g. 'InStock'. */
    availability?: string;
    /** Canonical product page path, e.g. '/shop/dreamease-capsules'. */
    path: string;
  };
}

/**
 * Product + Offer structured data hook for product pages.
 * The product-page worker renders this inside /shop/[handle] with the
 * canonical product record as props.
 */
export function ProductJsonLd({ product }: ProductJsonLdProps) {
  const base = siteUrl();
  const url = `${base}${product.path}`;
  return JsonLdScript({
    id: `jsonld-product-${product.path.replace(/[^a-z0-9]+/gi, '-')}`,
    data: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${url}#product`,
      name: product.name,
      ...(product.description ? { description: product.description } : {}),
      ...(product.images && product.images.length > 0 ? { image: product.images } : {}),
      ...(product.sku ? { sku: product.sku } : {}),
      brand: { '@type': 'Brand', name: BRAND_NAME },
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: product.currency ?? 'USD',
        /** Integer cents → decimal dollars, derived from canonical data. */
        price: (product.priceCents / 100).toFixed(2),
        availability: `https://schema.org/${product.availability ?? 'InStock'}`,
        seller: { '@id': `${base}/#organization` },
      },
    },
  });
}
