/**
 * REGRESSION SUITE — §19: image manifest + product-image integrity guards.
 *
 * Laws under test:
 * - (a) Every soap shape the builder references has a real manifest entry.
 * - (b) No catalog record references a nonexistent image file.
 * - (c) The string "$55" / "55.00" never appears as a PRICE in
 *       products.canonical.v3.json price fields or lib/pricing — historical
 *       prose mentioning "was $55" is allowed and the test distinguishes it.
 * - (d) Every manifest entry uses only the 8-term provenance vocabulary.
 *
 * Audit basis: docs/migration/IMAGE_INTEGRITY_REPORT.md (2026-10-05).
 * Brand: Amber's Alchemy Apothecary.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  IMAGE_MANIFEST,
  PROVENANCE_VOCABULARY,
  getAssetsForShape,
  isRenderable,
} from './image-manifest';
import { SOAP_SHAPES } from '../catalog/shapes';
import { BUNDLE_SLOT_SHAPES } from '../pricing/pricing';
import { PRODUCTS } from '../catalog/products';

const V3_JSON = new URL(
  '../../../catalog-enrichment/products.canonical.v3.json',
  import.meta.url,
);

function resolveStaged(p: string): string {
  return p.startsWith('~/') ? homedir() + p.slice(1) : p;
}

describe('provenance vocabulary', () => {
  it('(d) the vocabulary is exactly the 8 canonical terms', () => {
    expect([...PROVENANCE_VOCABULARY].sort()).toEqual(
      [
        'AI_ENHANCED_PRODUCT_IMAGE',
        'GENERATED_PRODUCT_REPRESENTATION',
        'ICON',
        'ILLUSTRATION',
        'LICENSED_STOCK',
        'MISSING_ASSET',
        'OWNER_UPLOADED',
        'REAL_PRODUCT_PHOTO',
      ].sort(),
    );
  });

  it('(d) every manifest entry uses only the allowed vocabulary', () => {
    const allowed = new Set(PROVENANCE_VOCABULARY);
    const bad = IMAGE_MANIFEST.filter((e) => !allowed.has(e.provenance));
    expect(bad.map((e) => `${e.id}:${e.provenance}`)).toEqual([]);
  });

  it('(d) generated/styled assets are flagged "not a documentary photo"', () => {
    for (const e of IMAGE_MANIFEST) {
      if (
        e.provenance === 'GENERATED_PRODUCT_REPRESENTATION' ||
        e.provenance === 'AI_ENHANCED_PRODUCT_IMAGE'
      ) {
        expect(
          e.notDocumentaryPhoto,
          `${e.id} must carry the not-a-documentary-photo flag`,
        ).toBe(true);
      }
    }
  });

  it('MISSING_ASSET entries are honest and renderable (label + slot)', () => {
    for (const e of IMAGE_MANIFEST) {
      if (e.provenance === 'MISSING_ASSET') {
        expect(e.label, `${e.id} needs a label`).toBeTruthy();
        expect(e.slot, `${e.id} needs a slot`).toBeTruthy();
        expect(isRenderable(e)).toBe(true);
      }
    }
  });

  it('manifest ids are unique', () => {
    const ids = IMAGE_MANIFEST.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('shape coverage', () => {
  it('(a) every shape in SOAP_SHAPES has a real (non-MISSING_ASSET) manifest entry', () => {
    for (const shape of SOAP_SHAPES) {
      const entries = getAssetsForShape(shape.id).filter(
        (e) => e.provenance !== 'MISSING_ASSET',
      );
      expect(
        entries.length,
        `shape ${shape.id} has no real manifest entry`,
      ).toBeGreaterThan(0);
    }
  });

  it('(a) every bundle slot shape has a real manifest entry', () => {
    for (const shapeId of BUNDLE_SLOT_SHAPES) {
      const entries = getAssetsForShape(shapeId).filter(
        (e) => e.provenance !== 'MISSING_ASSET',
      );
      expect(
        entries.length,
        `bundle slot shape ${shapeId} has no real manifest entry`,
      ).toBeGreaterThan(0);
    }
  });

  it('(a) staged real assets resolve to files that exist on disk', () => {
    const missing: string[] = [];
    for (const e of IMAGE_MANIFEST) {
      if (e.provenance === 'MISSING_ASSET' || !e.stagedFrom) continue;
      if (!existsSync(resolveStaged(e.stagedFrom))) {
        missing.push(`${e.id} -> ${e.stagedFrom}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('catalog image references', () => {
  // The ported catalog is sharded (lib/catalog/products/rec-*.ts); scan every shard.
  const productsDir = new URL('../catalog/products/', import.meta.url);
  let productsSrc = '';
  for (const f of readdirSync(productsDir)) {
    if (!f.endsWith('.ts')) continue;
    productsSrc += readFileSync(new URL(f, productsDir), 'utf8');
  }

  it('(b) every /images/* path in the ported catalog is covered by the manifest', () => {
    const paths = new Set<string>();
    for (const m of productsSrc.matchAll(/"(\/images\/[^"]+)"/g)) {
      paths.add(m[1]);
    }
    expect(paths.size).toBeGreaterThan(0);
    const uncovered: string[] = [];
    for (const p of paths) {
      const exact = IMAGE_MANIFEST.some((e) => e.path === p);
      if (exact) continue;
      // /images/products/<handle>.png fallbacks share the handle's webp slot.
      const mProd = p.match(/^\/images\/products\/([^/]+)\.(webp|png)$/);
      if (mProd && IMAGE_MANIFEST.some((e) => e.slotKey === mProd[1])) continue;
      uncovered.push(p);
    }
    expect(uncovered).toEqual([]);
  });

  it('(b) every ~/workspace image reference in the ported catalog exists on disk', () => {
    const refs = new Set<string>();
    for (const m of productsSrc.matchAll(/"(~\/workspace\/[^"]+)"/g)) {
      refs.add(m[1]);
    }
    const missing = [...refs].filter((r) => !existsSync(resolveStaged(r)));
    expect(missing).toEqual([]);
  });
});

describe('stale $55 bundle price — price fields only', () => {
  it('(c) no price field in products.canonical.v3.json equals $55', () => {
    const v3 = JSON.parse(readFileSync(V3_JSON, 'utf8'));
    const priceKeys = new Set(['price', 'subscriber_price', 'compare_at_price']);
    const hits: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${path}[${i}]`));
        return;
      }
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          const p = path ? `${path}.${k}` : k;
          if (priceKeys.has(k)) {
            const s = String(v).trim();
            if (v === 55 || v === 55.0 || s === '55' || s === '55.00' || s === '$55') {
              hits.push(`${p} = ${JSON.stringify(v)}`);
            }
          }
          walk(v, p);
        }
      }
    };
    walk(v3, '');
    expect(hits).toEqual([]);
  });

  it('(c) no price field in the ported PRODUCTS module equals $55', () => {
    const hits: string[] = [];
    for (const p of PRODUCTS) {
      for (const key of ['price', 'compare_at_price', 'subscriber_price'] as const) {
        const v = (p as Record<string, unknown>)[key];
        if (v === 55 || v === 55.0) hits.push(`${p.handle}.${key}`);
      }
      for (const v of (p as { variants?: Array<{ variant_id?: string; price?: number }> }).variants ?? []) {
        if (v.price === 55 || v.price === 55.0) {
          hits.push(`${p.handle}/${v.variant_id ?? '?'}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('(c) lib/pricing carries no $55 price — the historical "(was $55)" note is allowed', () => {
    const src = readFileSync(new URL('../pricing/pricing.ts', import.meta.url), 'utf8');
    // Historical prose is explicitly allowed; strip it before the price scan.
    const withoutHistory = src.replace(/\(was \$55\)/g, '');
    expect(withoutHistory).not.toMatch(/\$55\b/);
    expect(withoutHistory).not.toMatch(/\b55\.00\b/);
    // No standalone numeric literal 55 anywhere in the module source.
    expect(withoutHistory).not.toMatch(/(?<![\d.])55(?![\d.])/);
    // Sanity: the allowed historical note really is present and documented.
    expect(src).toContain('(was $55)');
  });
});
