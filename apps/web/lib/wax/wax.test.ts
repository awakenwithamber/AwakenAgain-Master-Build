/**
 * Wax finish module — owner directive 2026-11-13.
 *
 * Proves: the owner's exact option labels + sensitivity note; finish
 * resolution from the structured field before the historical name
 * encoding; ingredient text follows the SELECTED finish using only
 * the replacement the balm records themselves document; order-line
 * display titles carry the selected finish for the confirmation
 * email / status view / production list; and the wax choice stays
 * price-neutral on the premade records (identical twin prices).
 */
import { describe, expect, it } from 'vitest';
import {
  WAX_OPTIONS,
  WAX_SENSITIVITY_NOTE,
  ingredientsForWaxFinish,
  orderLineDisplayTitle,
  productHasWaxChoice,
  variantWaxFinish,
  waxVariantDisplayName,
} from './wax';
import { RECORD as RADIANCE } from '../catalog/products/rec-radiance-renewal-balm';
import { RECORD as SOOTHE } from '../catalog/products/rec-soothe-restore-botanical-balm';
import { RECORD as CUSTOM_BALM } from '../catalog/products/rec-custom-botanical-balm';
import { RECORD as SERUM } from '../catalog/products/rec-root-scalp-revival-serum';
import { validateAndBuildOrder, type OrderLine } from '../checkout/order';
import { buildOrderConfirmationJob } from '../jobs/order-confirmation';
import { priceFormulaCustomization } from '../cart/validation';
import { CUSTOM_BALM_HANDLE } from '../pricing/pricing';
import type { Product } from '../../types';

describe('owner wording (directive 2026-11-13)', () => {
  it('option labels are the owner’s exact labels', () => {
    expect(WAX_OPTIONS.map((o) => o.label)).toEqual([
      'Soy Wax — Standard Formula',
      'Beeswax — Soy-Free Wax Alternative',
    ]);
  });

  it('sensitivity note is the owner’s exact text', () => {
    expect(WAX_SENSITIVITY_NOTE).toBe(
      'Sensitive or allergic to soy? Select our beeswax alternative where available. Each formula is handcrafted with your selected wax.',
    );
  });

  it('variant display names upgrade to owner wording without changing identity', () => {
    expect(
      waxVariantDisplayName('2 oz — Beeswax (soy-free alternative)'),
    ).toBe('2 oz — Beeswax — Soy-Free Wax Alternative');
    expect(waxVariantDisplayName('1 oz pocket size — Soy Wax (standard)')).toBe(
      '1 oz pocket size — Soy Wax — Standard Formula',
    );
    expect(waxVariantDisplayName('Large Wave')).toBe('Large Wave');
  });
});

describe('variantWaxFinish', () => {
  it('prefers the structured wax_finish field', () => {
    expect(variantWaxFinish({ wax_finish: 'beeswax', name: 'anything' })).toBe(
      'beeswax',
    );
    expect(variantWaxFinish({ wax_finish: 'soy-wax' })).toBe('soy-wax');
  });

  it('falls back to the historical name encoding', () => {
    expect(
      variantWaxFinish({ name: '3 oz — Beeswax (soy-free alternative)' }),
    ).toBe('beeswax');
    expect(variantWaxFinish({ name: '3 oz — Soy Wax (standard)' })).toBe(
      'soy-wax',
    );
  });

  it('returns null for wax-free variants and empty input', () => {
    expect(variantWaxFinish({ name: 'Small Rose' })).toBeNull();
    expect(variantWaxFinish(undefined)).toBeNull();
    expect(variantWaxFinish(null)).toBeNull();
  });
});

describe('productHasWaxChoice — selector only where wax is in the formula', () => {
  it('true for the three balm records', () => {
    for (const rec of [RADIANCE, SOOTHE, CUSTOM_BALM]) {
      expect(productHasWaxChoice(rec as unknown as Product)).toBe(true);
    }
  });

  it('false for the wax-free serum record', () => {
    expect(productHasWaxChoice(SERUM as unknown as Product)).toBe(false);
  });
});

describe('ingredientsForWaxFinish — ingredients stay synced to the selected formula', () => {
  const radiance = String(
    (RADIANCE as unknown as Product).complete_ingredients,
  );

  it('soy finish returns the record text unchanged (the standard formula)', () => {
    expect(ingredientsForWaxFinish(radiance, 'soy-wax')).toBe(radiance);
  });

  it('beeswax finish performs exactly the replacement the record documents', () => {
    const out = ingredientsForWaxFinish(radiance, 'beeswax');
    expect(out.startsWith('Coconut oil, beeswax, vitamin E,')).toBe(true);
    // The ingredient list itself carries no soy wax; the words survive
    // only inside the explanatory finish note.
    expect(out.split(' (Beeswax finish')[0]).not.toContain('soy');
    expect(out).toContain(
      '(Beeswax finish — selected in place of the standard soy wax finish.)',
    );
    // Every non-wax ingredient survives untouched and in order.
    const strip = (s: string) =>
      s
        .replace(/soy wax|beeswax/gi, 'WAX')
        .replace(/\s*\([^)]*finish[^)]*\)/, '');
    expect(strip(out)).toBe(strip(radiance));
  });

  it('never rewrites the Custom Balm framework text (it presents the choice itself)', () => {
    const custom = String(
      (CUSTOM_BALM as unknown as Product).complete_ingredients,
    );
    expect(ingredientsForWaxFinish(custom, 'beeswax')).toBe(custom);
  });

  it('leaves wax-free text untouched', () => {
    const serum = String((SERUM as unknown as Product).complete_ingredients);
    expect(ingredientsForWaxFinish(serum, 'beeswax')).toBe(serum);
  });
});

describe('orderLineDisplayTitle — the selected finish reaches confirmation + production', () => {
  const base: OrderLine = {
    product_handle: 'radiance-renewal-balm',
    title: 'Radiance Renewal Botanical Balm',
    quantity: 1,
    unit_price_cents: 2354,
  };

  it('premade beeswax line names the finish', () => {
    expect(
      orderLineDisplayTitle({
        ...base,
        variant_name: '2 oz — Beeswax (soy-free alternative)',
      }),
    ).toBe(
      'Radiance Renewal Botanical Balm — 2 oz — Beeswax — Soy-Free Wax Alternative',
    );
  });

  it('premade soy line names the standard finish', () => {
    expect(
      orderLineDisplayTitle({
        ...base,
        variant_name: '2 oz — Soy Wax (standard)',
      }),
    ).toBe('Radiance Renewal Botanical Balm — 2 oz — Soy Wax — Standard Formula');
  });

  it('builder line resolves the finish from the persisted base_id', () => {
    expect(
      orderLineDisplayTitle({
        ...base,
        product_handle: 'custom-botanical-balm',
        title: 'Custom Botanical Balm — 1 oz (your formula)',
        formula: {
          kind: 'balm',
          size_id: 'balm-1oz',
          herb_ids: ['rose'],
          base_id: 'beeswax',
        } as OrderLine['formula'],
      }),
    ).toBe(
      'Custom Botanical Balm — 1 oz — Beeswax (soy-free alternative) (your formula)',
    );
  });

  it('wax-free lines pass through unchanged', () => {
    expect(
      orderLineDisplayTitle({
        product_handle: 'gaias-rose-soap',
        title: "Gaia's Rose Soap",
        variant_name: 'Small Rose',
        quantity: 2,
        unit_price_cents: 577,
      }),
    ).toBe("Gaia's Rose Soap — Small Rose");
  });
});

describe('end-to-end: selection → order record → confirmation (directive test)', () => {
  const CUSTOMER = { name: 'Test Customer', email: 'test@example.com' };
  const SHIPPING_ADDRESS = {
    name: 'Test Customer',
    street: '239 S 1200 W',
    city: 'Salt Lake City',
    state: 'UT',
    postal_code: '84104',
    country: 'US',
  };

  function premadeOrder(finish: 'soy-wax' | 'beeswax') {
    const variants = (RADIANCE as unknown as Product).variants ?? [];
    const v = variants.find(
      (x) => variantWaxFinish(x) === finish && String(x.name).startsWith('2 oz'),
    )!;
    const unit = Math.round(Number(v.price) * 100);
    return validateAndBuildOrder({
      items: [
        {
          product_handle: 'radiance-renewal-balm',
          variant_id: String(v.name),
          quantity: 1,
          unit_price_cents: unit,
        },
      ],
      customer: CUSTOMER,
      shipping_address: SHIPPING_ADDRESS,
      client_total_cents: unit + 595,
    });
  }

  it('premade beeswax order: record + confirmation name the finish, price identical to soy', () => {
    const soy = premadeOrder('soy-wax');
    const bee = premadeOrder('beeswax');
    expect(bee.total_cents).toBe(soy.total_cents);
    // The order record itself keeps the recorded variant name.
    expect(bee.items[0]?.variant_name).toContain('Beeswax');
    const data = buildOrderConfirmationJob(bee).data as {
      items: { title: string }[];
      item_summary: string;
    };
    expect(data.items[0]?.title).toBe(
      'Radiance Renewal Botanical Balm — 2 oz — Beeswax — Soy-Free Wax Alternative',
    );
    expect(data.item_summary).toContain('Beeswax — Soy-Free Wax Alternative');
    const soyData = buildOrderConfirmationJob(soy).data as {
      items: { title: string }[];
    };
    expect(soyData.items[0]?.title).toContain('Soy Wax — Standard Formula');
  });

  it('builder beeswax order: base_id persists on the record and reaches the confirmation', () => {
    const formula = {
      kind: 'balm',
      size_id: 'balm-1oz',
      herb_ids: ['rose', 'lavender'],
      base_id: 'beeswax',
      purpose_id: 'evening-unwind-ritual',
      scent_id: 'unscented',
    } as unknown as NonNullable<OrderLine['formula']>;
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
      shipping_address: SHIPPING_ADDRESS,
      client_total_cents: unit + 595,
    });
    expect(order.items[0]?.formula?.base_id).toBe('beeswax');
    const data = buildOrderConfirmationJob(order).data as {
      items: { title: string }[];
      item_summary: string;
    };
    expect(data.items[0]?.title).toContain(
      'Beeswax (soy-free alternative) (your formula)',
    );
    expect(data.item_summary).toContain('Beeswax (soy-free alternative)');
  });
});

describe('price neutrality on the premade records (owner ruling)', () => {
  it('every size’s soy and beeswax twins carry the identical price — and a wax_finish each', () => {
    for (const rec of [RADIANCE, SOOTHE, CUSTOM_BALM]) {
      const variants = (rec as unknown as Product).variants ?? [];
      expect(variants.length).toBe(8);
      const bySize = new Map<string, Map<string, number | null | undefined>>();
      for (const v of variants) {
        const finish = variantWaxFinish(v);
        expect(finish).not.toBeNull();
        const sizeKey = String(v.name).split(' — ')[0] ?? '';
        if (!bySize.has(sizeKey)) bySize.set(sizeKey, new Map());
        bySize.get(sizeKey)!.set(finish!, v.price);
      }
      for (const [, finishes] of bySize) {
        expect(finishes.get('soy-wax')).toBe(finishes.get('beeswax'));
      }
    }
  });
});
