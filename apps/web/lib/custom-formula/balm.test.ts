/**
 * Custom Balm Builder tests (owner-approved 2026-10-30).
 *
 * Laws under test:
 * - PRICING IS GROUNDED, NEVER INVENTED: the balm size bases mirror the
 *   two balm records' variant prices exactly (1–4 oz), and the catalog
 *   record for the custom balm carries the same mirrored points.
 * - WAX IS PRICE-NEUTRAL (owner ruling 2026-10-30): Soy Wax (standard)
 *   and Beeswax (soy-free alternative) price identically, everywhere.
 * - ALLERGENS DISCLOSED BOTH DIRECTIONS: soy wax surfaces the soy note;
 *   beeswax surfaces the bee-product note — wording mirrored from the
 *   balm records' own allergens text.
 * - BOTANICALS ARE GROUNDED: every selectable botanical is a featured
 *   ingredient of the existing balm/serum records AND a herb-library
 *   entry — and every such featured ingredient is selectable (no
 *   omissions, no inventions, in either direction).
 * - SERVER = AUTHORITY: the checkout gate reprices balm formulas from
 *   canonical data, persists the exact IDs (base/purpose/scent), and
 *   rejects invalid botanicals, invalid bases, cross-product formulas,
 *   and tampered prices.
 * - COPY RULE: purpose options are preference/ritual language only.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CUSTOM_BALM_HANDLE,
  CUSTOM_BALM_SIZES,
  customFormulaPriceCents,
  formulaKindForHandle,
  getFormulaSize,
} from '../pricing/pricing';
import { getHerb, herbPriceCents } from '../catalog/herbs';
import { getProductByHandle } from '../catalog/products';
import { RECORD as RADIANCE_BALM } from '../catalog/products/rec-radiance-renewal-balm';
import { RECORD as SOOTHE_BALM } from '../catalog/products/rec-soothe-restore-botanical-balm';
import {
  buildFormulaCartItem,
  buildOrderConfiguration,
  priceFormulaCustomization,
  validateFormulaCustomization,
} from '../cart/validation';
import { isFormulaProduct, validateAndBuildOrder } from '../checkout/order';
import { formulaCustomizationOf } from './formula';
import { FORM_GUIDE } from './forms-guide';
import {
  BALM_BASES,
  BALM_BOTANICAL_IDS,
  BALM_BOTANICAL_SOURCES,
  BALM_PURPOSES,
  BALM_SOURCE_RECORDS,
  balmAllergenNote,
  balmBotanicals,
  getBalmPurpose,
} from './balm';
import type { FormulaCustomization, Product } from '../../types';

const CUSTOMER = { name: 'Test Customer', email: 'test@example.com' };

function balmFormula(
  overrides: Partial<FormulaCustomization> = {},
): FormulaCustomization {
  return {
    herb_ids: ['lavender'],
    size_id: 'balm-1oz',
    base_id: 'soy-wax',
    ...overrides,
  };
}

/** Variant price on a balm record for a size + finish, or undefined. */
function balmRecordPrice(
  record: Product,
  size: string,
  finish: 'Soy Wax' | 'Beeswax',
): number | undefined {
  return (record.variants ?? []).find(
    (v) => v.size === size && String(v.name).includes(finish),
  )?.price as number | undefined;
}

describe('pricing grounding — balm sizes mirror the balm records exactly', () => {
  it('formulaKindForHandle maps the custom balm handle, and only it, to balm', () => {
    expect(formulaKindForHandle(CUSTOM_BALM_HANDLE)).toBe('balm');
    expect(formulaKindForHandle('radiance-renewal-balm')).toBeNull();
    expect(formulaKindForHandle('soothe-restore-botanical-balm')).toBeNull();
    // Existing kinds are unchanged.
    expect(formulaKindForHandle('custom-herbal-capsules')).toBe('capsule');
    expect(formulaKindForHandle('custom-tea-blends')).toBe('tea');
  });

  it('every balm size base equals BOTH balm records\u2019 variant prices, both finishes', () => {
    expect(CUSTOM_BALM_SIZES).toHaveLength(4);
    for (const size of CUSTOM_BALM_SIZES) {
      const oz = size.unit; // '1 oz' … '4 oz'
      for (const record of [RADIANCE_BALM, SOOTHE_BALM]) {
        for (const finish of ['Soy Wax', 'Beeswax'] as const) {
          const dollars = balmRecordPrice(record, oz, finish);
          expect(dollars, `${record.handle} ${oz} ${finish}`).toBeDefined();
          expect(size.baseCents).toBe(Math.round((dollars as number) * 100));
        }
      }
    }
    // The mirrored points, pinned: $11.77 / $23.54 / $35.31 / $47.08.
    expect(CUSTOM_BALM_SIZES.map((s) => s.baseCents)).toEqual([
      1177, 2354, 3531, 4708,
    ]);
  });

  it('balm sizes are kind-scoped: no cross-kind lookup', () => {
    expect(getFormulaSize('balm', 'balm-1oz')?.baseCents).toBe(1177);
    expect(getFormulaSize('capsule', 'balm-1oz')).toBeUndefined();
    expect(getFormulaSize('tea', 'balm-1oz')).toBeUndefined();
    expect(getFormulaSize('balm', 'capsule-28')).toBeUndefined();
    expect(getFormulaSize('balm', 'tea-loose-1oz')).toBeUndefined();
  });

  it('the custom balm catalog record carries the same mirrored points', () => {
    const product = getProductByHandle(CUSTOM_BALM_HANDLE);
    expect(product).toBeDefined();
    expect(product!.price).toBe(11.77);
    expect(product!.subscriber_price).toBe(10.59);
    expect(product!.variants).toHaveLength(8);
    for (const size of CUSTOM_BALM_SIZES) {
      for (const finish of ['Soy Wax', 'Beeswax'] as const) {
        expect(balmRecordPrice(product!, size.unit, finish)).toBe(
          size.baseCents / 100,
        );
      }
    }
  });
});

describe('wax choice is price-neutral (owner ruling 2026-10-30)', () => {
  it('both bases declare a $0 price delta', () => {
    expect(BALM_BASES.map((b) => b.id)).toEqual(['soy-wax', 'beeswax']);
    for (const base of BALM_BASES) {
      expect(base.priceDeltaCents).toBe(0);
    }
  });

  it('server price is identical for soy wax and beeswax, every size', () => {
    for (const size of CUSTOM_BALM_SIZES) {
      const soy = priceFormulaCustomization(
        CUSTOM_BALM_HANDLE,
        balmFormula({ size_id: size.id, base_id: 'soy-wax' }),
      );
      const beeswax = priceFormulaCustomization(
        CUSTOM_BALM_HANDLE,
        balmFormula({ size_id: size.id, base_id: 'beeswax' }),
      );
      expect(beeswax).toBe(soy);
    }
  });

  it('a full checkout order totals identically for either finish', () => {
    const totals = (['soy-wax', 'beeswax'] as const).map((base_id) => {
      const formula = balmFormula({
        herb_ids: ['lavender', 'rose'],
        size_id: 'balm-2oz',
        base_id,
      });
      const unit = priceFormulaCustomization(CUSTOM_BALM_HANDLE, formula);
      const order = validateAndBuildOrder({
        items: [
          {
            product_handle: CUSTOM_BALM_HANDLE,
            quantity: 1,
            formula,
            unit_price_cents: unit,
          },
        ],
        customer: CUSTOMER,
        client_total_cents: unit + 595, // below the $45 free-shipping threshold
      });
      return order.total_cents;
    });
    expect(totals[0]).toBe(totals[1]);
  });
});

describe('allergen disclosure mapping — both directions', () => {
  it('soy wax surfaces the soy note; beeswax surfaces the bee-product note', () => {
    expect(balmAllergenNote('soy-wax')).toContain('soy wax (soy)');
    expect(balmAllergenNote('soy-wax')).toContain('beeswax finish instead');
    expect(balmAllergenNote('beeswax')).toContain('beeswax (a bee product)');
    expect(balmAllergenNote('beeswax')).toContain('soy-wax finish instead');
    // Both finishes also disclose the coconut-oil infusion base.
    expect(balmAllergenNote('soy-wax')).toContain('coconut oil');
    expect(balmAllergenNote('beeswax')).toContain('coconut oil');
  });

  it('the notes mirror the balm records\u2019 own allergens wording', () => {
    for (const record of [RADIANCE_BALM, SOOTHE_BALM]) {
      expect(String(record.allergens)).toContain('soy wax (soy)');
      expect(String(record.allergens)).toContain('bee product');
      expect(String(record.allergens)).toContain('coconut oil');
    }
  });

  it('an unknown base has no allergen note (fail closed)', () => {
    expect(balmAllergenNote('coconut-oil')).toBeNull();
    expect(balmAllergenNote('')).toBeNull();
  });
});

describe('botanical groundedness — balm/serum records ∩ herb library', () => {
  it('every selectable botanical exists in the herb library', () => {
    expect(balmBotanicals()).toHaveLength(BALM_BOTANICAL_IDS.length);
    for (const id of BALM_BOTANICAL_IDS) {
      expect(getHerb(id), id).toBeDefined();
    }
  });

  it('every selectable botanical is a featured ingredient of a source record', () => {
    for (const [id, source] of Object.entries(BALM_BOTANICAL_SOURCES)) {
      for (const handle of source.sourceHandles) {
        const record = BALM_SOURCE_RECORDS.find((r) => r.handle === handle)!;
        const featured = (
          record.featured_ingredients as { name: string }[]
        ).map((f) => f.name);
        expect(featured, `${id} in ${handle}`).toContain(source.featuredName);
      }
    }
  });

  it('every featured ingredient of the three records is selectable — no omissions, no inventions', () => {
    const featuredNames = new Set<string>();
    for (const record of BALM_SOURCE_RECORDS) {
      for (const f of record.featured_ingredients as { name: string }[]) {
        featuredNames.add(f.name);
      }
    }
    const selectableNames = new Set(
      Object.values(BALM_BOTANICAL_SOURCES).map((s) => s.featuredName),
    );
    expect(selectableNames).toEqual(featuredNames);
    expect(BALM_BOTANICAL_IDS).toHaveLength(featuredNames.size);
  });
});

describe('server price recompute for balm configurations', () => {
  it('sample: 1 oz + lavender = 1177 + 29 = 1206¢, preview = server', () => {
    const formula = balmFormula({ herb_ids: ['lavender'], size_id: 'balm-1oz' });
    expect(herbPriceCents('lavender')).toBe(29);
    expect(customFormulaPriceCents('balm', 'balm-1oz', ['lavender'])).toBe(1206);
    expect(priceFormulaCustomization(CUSTOM_BALM_HANDLE, formula)).toBe(1206);
  });

  it('sample: 4 oz + gotu kola + vitamin E = 4708 + 23 + 23 = 4754¢', () => {
    const formula = balmFormula({
      herb_ids: ['gotu-kola', 'vitamin-e'],
      size_id: 'balm-4oz',
      base_id: 'beeswax',
    });
    expect(priceFormulaCustomization(CUSTOM_BALM_HANDLE, formula)).toBe(4754);
    expect(
      customFormulaPriceCents('balm', 'balm-4oz', ['gotu-kola', 'vitamin-e']),
    ).toBe(4754);
  });

  it('grounded botanicals without a \u2018balm\u2019 Herb.use still validate for balm', () => {
    // Groundedness for balm comes from the source records, not Herb.uses:
    // gotu kola, nettle, and fenugreek are featured ingredients with no
    // 'balm' entry in their uses — they must still be selectable.
    for (const id of ['gotu-kola', 'nettle', 'fenugreek']) {
      expect(getHerb(id)!.uses).not.toContain('balm');
      expect(
        validateFormulaCustomization(CUSTOM_BALM_HANDLE, balmFormula({ herb_ids: [id] }))
          .valid,
        id,
      ).toBe(true);
    }
  });

  it('cart + order configuration recompute the balm total server-side', () => {
    const formula = balmFormula({
      herb_ids: ['arnica', 'ginger'],
      size_id: 'balm-3oz',
      purpose_id: 'massage-ritual',
      scent_id: 'SCENT_RECIPE_01',
    });
    const item = buildFormulaCartItem(CUSTOM_BALM_HANDLE, formula, 2);
    expect(item.unit_price_cents).toBe(3531 + 29 + 29);
    expect(item.formula).toMatchObject({
      base_id: 'soy-wax',
      purpose_id: 'massage-ritual',
      scent_id: 'SCENT_RECIPE_01',
    });
    const order = buildOrderConfiguration([item], undefined, 0);
    expect(order.subtotal_cents).toBe((3531 + 29 + 29) * 2);
    expect(order.computed_by).toBe('server');
  });

  it('checkout gate accepts a valid balm order and persists the exact IDs', () => {
    expect(isFormulaProduct(CUSTOM_BALM_HANDLE)).toBe(true);
    const formula = balmFormula({
      herb_ids: ['lavender'],
      size_id: 'balm-1oz',
      base_id: 'beeswax',
      purpose_id: 'evening-unwind-ritual',
      scent_id: 'unscented',
    });
    const unit = priceFormulaCustomization(CUSTOM_BALM_HANDLE, formula);
    const order = validateAndBuildOrder({
      items: [
        {
          product_handle: CUSTOM_BALM_HANDLE,
          quantity: 1,
          formula,
          unit_price_cents: unit,
        },
      ],
      customer: CUSTOMER,
      client_total_cents: unit + 595,
    });
    expect(order.items[0].formula).toMatchObject({
      herb_ids: ['lavender'],
      size_id: 'balm-1oz',
      base_id: 'beeswax',
      purpose_id: 'evening-unwind-ritual',
      scent_id: 'unscented',
    });
    expect(order.items[0].title).toContain('Custom Botanical Balm');
    expect(order.total_cents).toBe(unit + 595);
  });
});

describe('rejection of invalid balm configurations', () => {
  it('rejects a real herb that is not a grounded balm botanical', () => {
    const result = validateFormulaCustomization(
      CUSTOM_BALM_HANDLE,
      balmFormula({ herb_ids: ['ashwagandha'] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('not a grounded balm botanical'))).toBe(
      true,
    );
    expect(() =>
      priceFormulaCustomization(CUSTOM_BALM_HANDLE, balmFormula({ herb_ids: ['ashwagandha'] })),
    ).toThrow(/not a grounded balm botanical/);
  });

  it('rejects an unknown botanical id', () => {
    const result = validateFormulaCustomization(
      CUSTOM_BALM_HANDLE,
      balmFormula({ herb_ids: ['not-a-plant'] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Unknown herb'))).toBe(true);
  });

  it('rejects an invalid or missing balm base', () => {
    for (const bad of ['coconut-oil', 'paraffin', '']) {
      const result = validateFormulaCustomization(
        CUSTOM_BALM_HANDLE,
        balmFormula({ base_id: bad }),
      );
      expect(result.valid, bad).toBe(false);
      expect(result.errors.some((e) => e.includes('Unknown balm base'))).toBe(true);
    }
    const missing = balmFormula();
    delete missing.base_id;
    expect(
      validateFormulaCustomization(CUSTOM_BALM_HANDLE, missing).valid,
    ).toBe(false);
  });

  it('rejects unknown purpose / scent preference IDs; accepts known ones', () => {
    expect(
      validateFormulaCustomization(
        CUSTOM_BALM_HANDLE,
        balmFormula({ purpose_id: 'cure-everything' }),
      ).valid,
    ).toBe(false);
    expect(
      validateFormulaCustomization(
        CUSTOM_BALM_HANDLE,
        balmFormula({ scent_id: 'SCENT_RECIPE_99' }),
      ).valid,
    ).toBe(false);
    expect(
      validateFormulaCustomization(
        CUSTOM_BALM_HANDLE,
        balmFormula({ purpose_id: 'gift-for-someone', scent_id: 'SCENT_RECIPE_07' }),
      ).valid,
    ).toBe(true);
  });

  it('rejects balm fields on capsule/tea formulas (existing kinds unchanged)', () => {
    for (const handle of ['custom-herbal-capsules', 'custom-tea-blends']) {
      const size_id = handle === 'custom-herbal-capsules' ? 'capsule-28' : 'tea-loose-1oz';
      const result = validateFormulaCustomization(handle, {
        herb_ids: ['lavender'],
        size_id,
        base_id: 'soy-wax',
      });
      expect(result.valid, handle).toBe(false);
      expect(result.errors.some((e) => e.includes('custom balms only'))).toBe(true);
    }
  });

  it('checkout gate rejects a balm formula on a non-formula product and a tampered price', () => {
    const formula = balmFormula();
    expect(isFormulaProduct('radiance-renewal-balm')).toBe(false);
    expect(() =>
      validateAndBuildOrder({
        items: [
          {
            product_handle: 'radiance-renewal-balm',
            quantity: 1,
            formula,
            unit_price_cents: 1206,
          },
        ],
        customer: CUSTOMER,
        client_total_cents: 1206 + 595,
      }),
    ).toThrow(/not a custom-formula product/);
    expect(() =>
      validateAndBuildOrder({
        items: [
          {
            product_handle: CUSTOM_BALM_HANDLE,
            quantity: 1,
            formula,
            unit_price_cents: 1, // tampered
          },
        ],
        customer: CUSTOMER,
        client_total_cents: 1 + 595,
      }),
    ).toThrow(/Price mismatch/);
  });

  it('formulaCustomizationOf requires a base for balm and leaves capsule output unchanged', () => {
    const sel = {
      sizeId: 'balm-1oz',
      herbIds: ['lavender'],
      creationName: '',
      intention: '',
      notes: '',
      safetyAck: true,
    };
    expect(formulaCustomizationOf(sel, 'balm')).toBeNull();
    expect(
      formulaCustomizationOf(sel, 'balm', { baseId: 'beeswax' }),
    ).toMatchObject({ base_id: 'beeswax', size_id: 'balm-1oz' });
    const capsule = formulaCustomizationOf(
      { ...sel, sizeId: 'capsule-28', herbIds: ['ashwagandha'] },
      'capsule',
    );
    expect(capsule).not.toBeNull();
    expect(capsule).not.toHaveProperty('base_id');
  });
});

describe('purpose language — copy rule (preference/ritual only)', () => {
  it('every purpose resolves and uses no remedy/treatment/efficacy wording', () => {
    expect(BALM_PURPOSES.length).toBeGreaterThan(0);
    for (const purpose of BALM_PURPOSES) {
      expect(getBalmPurpose(purpose.id)?.label).toBe(purpose.label);
      expect(purpose.label).not.toMatch(/remed|treat|cure|heal|relief|diagnos/i);
    }
  });
});

describe('guide + route wiring', () => {
  it('the form guide balm card links to the balm builder route, which exists', () => {
    const balm = FORM_GUIDE.find((f) => f.id === 'balm')!;
    expect(balm.actions).toContainEqual({
      type: 'link',
      label: 'Build your balm',
      href: '/custom-formula/balm',
    });
    const routeFile = join(
      __dirname,
      '..',
      '..',
      'app',
      'custom-formula',
      'balm',
      'page.tsx',
    );
    expect(existsSync(routeFile)).toBe(true);
  });
});
