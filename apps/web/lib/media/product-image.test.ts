/**
 * REGRESSION SUITE — product display-image resolution honesty guards.
 *
 * Laws under test (image-coverage truth table, audit-2026-10-13):
 * - An image renders for a product ONLY when the image registry and the
 *   catalog record agree on a deployed file for that product.
 * - Generated / AI-styled assets are never framed as documentary photos:
 *   they carry the illustrated-representation caption and alt text that
 *   describes the artwork as artwork.
 * - Images with known wrong baked-in content (flagged for an owner
 *   regenerate/replace decision) are not newly wired onto product pages.
 * - Products with no genuine imagery resolve to null (honest placeholder /
 *   text-only state) — never a guessed or borrowed image.
 */
import { describe, expect, it } from 'vitest';
import {
  PENDING_OWNER_DECISION_HANDLES,
  REPRESENTATION_CAPTION,
  getProductDisplayImage,
} from './product-image';
import { PRODUCTS, getProductByHandle } from '../catalog/products';
import type { Product } from '../../types';

function must(handle: string): Product {
  const p = getProductByHandle(handle);
  if (!p) throw new Error(`catalog product missing: ${handle}`);
  return p;
}

describe('documentary product photography', () => {
  it('DreamEase resolves to its verified owner product photo, presented plainly', () => {
    const img = getProductDisplayImage(must('dreamease-capsules'));
    expect(img).not.toBeNull();
    expect(img!.src).toBe('/images/products/dreamease-capsules.webp');
    expect(img!.documentaryPhoto).toBe(true);
    expect(img!.caption).toBeNull();
    expect(img!.provenance).toBe('OWNER_UPLOADED');
  });
});

describe('generated / styled artwork — honest framing', () => {
  it('a generated capsule graphic resolves WITH the representation caption', () => {
    const img = getProductDisplayImage(must('chill-pill-capsules'));
    expect(img).not.toBeNull();
    expect(img!.src).toBe('/images/products/chill-pill-capsules.webp');
    expect(img!.documentaryPhoto).toBe(false);
    expect(img!.caption).toBe(REPRESENTATION_CAPTION);
    // Alt text describes the asset as a generated graphic — never as a photo.
    expect(img!.alt).toMatch(/AI-generated/i);
  });

  it('the Alchemy Soap Collection resolves to the deployed five-bar lineup', () => {
    const img = getProductDisplayImage(must('soap-style-collection-5'));
    expect(img).not.toBeNull();
    expect(img!.src).toBe('/images/soap/soap-lineup-5.png');
    expect(img!.documentaryPhoto).toBe(false);
    expect(img!.caption).toBe(REPRESENTATION_CAPTION);
    expect(img!.provenance).toBe('GENERATED_PRODUCT_REPRESENTATION');
  });

  it('owner-supplied soap artwork resolves as non-documentary', () => {
    for (const handle of [
      'gaias-rose-soap',
      'lavender-fairy-dream-soap',
      'eucalyptus-mint-spa-renewal-soap',
    ]) {
      const img = getProductDisplayImage(must(handle));
      expect(img, handle).not.toBeNull();
      expect(img!.documentaryPhoto, handle).toBe(false);
      expect(img!.caption, handle).toBe(REPRESENTATION_CAPTION);
    }
  });

  it('owner-supplied service artwork resolves as non-documentary (assignments of 2026-10-23)', () => {
    // These six service slots were MISSING_ASSET / UNVERIFIED-legacy until
    // the owner supplied on-topic artwork for each (mapping report
    // 2026-10-22, owner approval 2026-10-23). They now resolve — framed as
    // artwork, never as documentary photos.
    for (const handle of [
      'energy-work',
      'home-aura-space-cleansing',
      'personalized-botanical-consultation',
      'custom-remedy-consultation',
      'tarot-readings',
      'tarot-rune-reading',
    ]) {
      const img = getProductDisplayImage(must(handle));
      expect(img, handle).not.toBeNull();
      expect(img!.src, handle).toBe(`/images/products/${handle}.webp`);
      expect(img!.documentaryPhoto, handle).toBe(false);
      expect(img!.caption, handle).toBe(REPRESENTATION_CAPTION);
      expect(img!.provenance, handle).toBe('OWNER_UPLOADED');
    }
  });
});

describe('regenerated graphics — owner decision executed 2026-10-13', () => {
  it('no handles are currently blocklisted', () => {
    expect(PENDING_OWNER_DECISION_HANDLES.size).toBe(0);
  });

  it('the three regenerated capsule graphics resolve as non-documentary', () => {
    for (const handle of [
      'sacred-balance-capsules',
      'immune-at-ease-capsules',
      'vital-vitality-capsules',
    ]) {
      const img = getProductDisplayImage(must(handle));
      expect(img, handle).not.toBeNull();
      expect(img!.documentaryPhoto, handle).toBe(false);
      expect(img!.caption, handle).toBe(REPRESENTATION_CAPTION);
    }
  });

  it('the superseded 9-bar collection does not resolve its 5-bar lineup (record still marks it placeholder)', () => {
    expect(getProductDisplayImage(must('full-soap-collection'))).toBeNull();
  });
});

describe('products with no genuine imagery resolve to null', () => {
  it('placeholder and no-file products render no product image', () => {
    for (const handle of [
      'radiance-renewal-balm', // MISSING_ASSET, no file
      'citrus-goddess-glow-soap', // placeholder-card file only
      'environmental-wellness-support', // record marks MISSING_ASSET
      'wild-caught-omega-3-fish-oil', // no stock substitution allowed
      'root-scalp-revival-serum', // only an ART_DIRECTION_ONLY candidate exists
      'custom-botanical-soap', // v3 file list must not render
      'custom-herbal-capsules', // images: [] — no registered imagery
    ]) {
      expect(getProductDisplayImage(must(handle)), handle).toBeNull();
    }
  });
});

describe('catalog-wide resolution census', () => {
  it('exactly the 20 honestly-registered products resolve an image', () => {
    const resolved = PRODUCTS.filter(
      (p) => getProductDisplayImage(p) !== null,
    ).map((p) => p.handle);
    expect(resolved.sort()).toEqual(
      [
        'alchemy-tea-blend',
        'chill-pill-capsules',
        'custom-remedy-consultation',
        'dreamease-capsules',
        'energy-work',
        'eucalyptus-mint-spa-renewal-soap',
        'gaias-rose-soap',
        'grimoire-subscription',
        'happy-pill-capsules',
        'home-aura-space-cleansing',
        'immune-at-ease-capsules',
        'lavender-fairy-dream-soap',
        'personalized-botanical-consultation',
        'sacred-balance-capsules',
        'soap-style-collection-5',
        'tarot-readings',
        'tarot-rune-reading',
        'vital-connect-capsules',
        'vital-flow-capsules',
        'vital-vitality-capsules',
      ].sort(),
    );
  });

  it('every resolved image is either a documentary photo or carries the representation caption', () => {
    for (const p of PRODUCTS) {
      const img = getProductDisplayImage(p);
      if (!img) continue;
      if (img.documentaryPhoto) {
        expect(img.caption, p.handle).toBeNull();
      } else {
        expect(img.caption, p.handle).toBe(REPRESENTATION_CAPTION);
      }
    }
  });
});
