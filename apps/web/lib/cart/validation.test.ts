/**
 * REGRESSION SUITE — §19: cart/order validation and business rules.
 *
 * Laws under test:
 * - Custom blends are EXACTLY 1–3 oils from the blendable list (max 3 enforced).
 * - Order records store EXACT oil IDs (custom) or recipe IDs (signature) —
 *   never the string "custom scent".
 * - Natural/Clear is restricted to translucent bases — enforced FROM DATA
 *   (ColorOption.requiresTranslucentBase × SoapBase.translucent), not
 *   hard-coded conditionals.
 * - Bundle slots are independent: slot A's choices never overwrite slot B's.
 * - SERVER PRICE = AUTHORITY: buildOrderConfiguration recomputes every
 *   total and throws on manipulated client values.
 */
import { describe, expect, it } from 'vitest';
import {
  buildBundleConfiguration,
  buildCartItem,
  buildOrderConfiguration,
  priceCustomization,
  validateBundleSlot,
  validateCustomization,
  validateScentSelection,
} from './validation';
import { BUNDLE_PRICE_CENTS, bundleSavingsCents } from '../pricing/pricing';
import { BLENDABLE_OILS, MAX_BLEND_OILS } from '../catalog/oils';
import { getScentRecipe } from '../catalog/scents';
import type { BundleSlot, CartItem, Customization, ScentSelection } from '../../types';

function signatureCustomization(overrides: Partial<Customization> = {}): Customization {
  return {
    base: 'glycerin-castor',
    shape: 'wave-rectangle',
    scent: { type: 'signature', recipe_id: 'SCENT_RECIPE_01' },
    botanical: 'lavender',
    color: 'amber-gold',
    ...overrides,
  };
}

function customBlend(oils: string[]): ScentSelection {
  return { type: 'custom_blend', oils };
}

describe('1–3 oil blend limit', () => {
  it('MAX_BLEND_OILS is 3', () => {
    expect(MAX_BLEND_OILS).toBe(3);
  });

  it('accepts 1, 2, and 3 oils', () => {
    expect(validateScentSelection(customBlend(['lavender']))).toEqual([]);
    expect(validateScentSelection(customBlend(['lavender', 'lemon']))).toEqual([]);
    expect(validateScentSelection(customBlend(['lavender', 'lemon', 'peppermint']))).toEqual([]);
  });

  it('rejects 0 oils', () => {
    const errors = validateScentSelection(customBlend([]));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a 4th oil', () => {
    const errors = validateScentSelection(
      customBlend(['lavender', 'lemon', 'peppermint', 'tea-tree']),
    );
    expect(errors.some((e) => e.includes('at most 3'))).toBe(true);
  });

  it('rejects duplicate oils', () => {
    const errors = validateScentSelection(customBlend(['lavender', 'lavender']));
    expect(errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('rejects oils outside the blendable list (incl. excluded inventory)', () => {
    // Oregano, DigestZen, and finished blends are excluded from the soap builder.
    for (const id of ['oregano', 'digestzen', 'on-guard', 'deep-blue', 'breathe']) {
      const errors = validateScentSelection(customBlend([id]));
      expect(errors.some((e) => e.includes('Unknown blendable oil'))).toBe(true);
    }
  });

  it('the blendable list is exactly the 12 soap-appropriate oils', () => {
    const ids = BLENDABLE_OILS.map((o) => o.id).sort();
    expect(ids).toEqual(
      [
        'cedarwood',
        'coconut',
        'frankincense',
        'geranium',
        'jasmine',
        'lavender',
        'lemon',
        'patchouli',
        'peppermint',
        'rose',
        'tea-tree',
        'vanilla-mimic',
      ].sort(),
    );
  });
});

describe('Signature vs Custom scent paths', () => {
  it('signature path validates against the 13 known recipes', () => {
    expect(validateScentSelection({ type: 'signature', recipe_id: 'SCENT_RECIPE_01' })).toEqual([]);
    expect(getScentRecipe('SCENT_RECIPE_01')?.name).toBe('Moonlit Lavender');
  });

  it('signature path rejects unknown recipe IDs', () => {
    const errors = validateScentSelection({ type: 'signature', recipe_id: 'SCENT_RECIPE_99' });
    expect(errors.some((e) => e.includes('Unknown signature scent recipe'))).toBe(true);
  });

  it('custom blends persist EXACT oil IDs — never prose', () => {
    const item = buildCartItem(
      'custom-soap',
      signatureCustomization({ scent: customBlend(['lavender', 'rose', 'vanilla-mimic']) }),
      1,
    );
    const scent = item.customization!.scent;
    expect(scent.type).toBe('custom_blend');
    if (scent.type === 'custom_blend') {
      expect(scent.oils).toEqual(['lavender', 'rose', 'vanilla-mimic']);
    }
    // The forbidden lossy value must never appear in a payload.
    expect(JSON.stringify(item)).not.toContain('custom scent');
  });

  it('signature selections persist the recipe ID', () => {
    const item = buildCartItem('custom-soap', signatureCustomization(), 1);
    const scent = item.customization!.scent;
    expect(scent.type).toBe('signature');
    if (scent.type === 'signature') {
      expect(scent.recipe_id).toBe('SCENT_RECIPE_01');
    }
  });
});

describe('Natural/Clear compatibility — from data, not conditionals', () => {
  it('rejects Natural/Clear on the non-translucent double-layer base', () => {
    const result = validateCustomization(
      signatureCustomization({ base: 'double-layer', color: 'natural-clear' }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('translucent'))).toBe(true);
  });

  it('rejects Natural/Clear on the non-translucent goat-milk base', () => {
    const result = validateCustomization(
      signatureCustomization({ base: 'goat-milk-shea', color: 'natural-clear' }),
    );
    expect(result.valid).toBe(false);
  });

  it('accepts Natural/Clear on the translucent glycerin-castor base', () => {
    const result = validateCustomization(
      signatureCustomization({ base: 'glycerin-castor', color: 'natural-clear' }),
    );
    expect(result.valid).toBe(true);
  });

  it('accepts opaque colors on any base', () => {
    for (const base of ['double-layer', 'goat-milk-shea', 'glycerin-castor'] as const) {
      const result = validateCustomization(
        signatureCustomization({ base, color: 'amber-gold' }),
      );
      expect(result.valid).toBe(true);
    }
  });
});

describe('customization validation', () => {
  it('rejects unknown shape / base / botanical / color IDs', () => {
    expect(validateCustomization(signatureCustomization({ shape: 'nope' })).valid).toBe(false);
    expect(validateCustomization(signatureCustomization({ base: 'nope' as never })).valid).toBe(
      false,
    );
    expect(validateCustomization(signatureCustomization({ botanical: 'nope' })).valid).toBe(false);
    expect(validateCustomization(signatureCustomization({ color: 'nope' })).valid).toBe(false);
  });

  it('allows null botanical (no botanical selected)', () => {
    expect(validateCustomization(signatureCustomization({ botanical: null })).valid).toBe(true);
  });

  it('prices a customization from its shape — the server price authority', () => {
    expect(priceCustomization(signatureCustomization({ shape: 'small-rose' }))).toBe(577);
    expect(priceCustomization(signatureCustomization({ shape: 'wave-rectangle' }))).toBe(1177);
  });
});

describe('bundle slots — independent, per-slot fidelity', () => {
  const slotShapes = [
    'small-rose',
    'medium-rose',
    'plain-rectangle',
    'wave-rectangle',
    'floral-round',
  ];

  function slot(index: number, scent: ScentSelection, color = 'amber-gold'): BundleSlot {
    return {
      slot_index: index,
      base: 'glycerin-castor',
      shape: slotShapes[index],
      scent,
      botanical: 'lavender',
      color,
    };
  }

  it('builds a 5-slot bundle with mixed signature + custom paths', () => {
    const slots = [
      slot(0, { type: 'signature', recipe_id: 'SCENT_RECIPE_01' }),
      slot(1, customBlend(['lavender', 'lemon'])),
      slot(2, { type: 'signature', recipe_id: 'SCENT_RECIPE_08' }, 'sage'),
      slot(3, customBlend(['frankincense', 'patchouli', 'cedarwood'])),
      slot(4, customBlend(['coconut'])),
    ];
    const bundle = buildBundleConfiguration(slots);
    expect(bundle.bundle_id).toBe('soap-style-collection-5');
    expect(bundle.price_cents).toBe(BUNDLE_PRICE_CENTS);
    expect(bundle.savings_cents).toBe(bundleSavingsCents());
    // Per-slot fidelity: each slot's exact configuration survives.
    expect(bundle.slots[1].scent).toEqual({ type: 'custom_blend', oils: ['lavender', 'lemon'] });
    expect(bundle.slots[2].color).toBe('sage');
    expect(bundle.slots[3].scent).toEqual({
      type: 'custom_blend',
      oils: ['frankincense', 'patchouli', 'cedarwood'],
    });
  });

  it("one slot's choices never overwrite another's", () => {
    const slots = [
      slot(0, customBlend(['lavender'])),
      slot(1, customBlend(['rose'])),
      slot(2, customBlend(['cedarwood'])),
      slot(3, customBlend(['jasmine'])),
      slot(4, customBlend(['coconut'])),
    ];
    const bundle = buildBundleConfiguration(slots);
    const oilSets = bundle.slots.map((s) =>
      s.scent.type === 'custom_blend' ? s.scent.oils : [],
    );
    expect(oilSets).toEqual([['lavender'], ['rose'], ['cedarwood'], ['jasmine'], ['coconut']]);
  });

  it('rejects a slot whose shape does not match its index', () => {
    const bad = slot(0, { type: 'signature', recipe_id: 'SCENT_RECIPE_01' });
    bad.shape = 'floral-round';
    expect(validateBundleSlot(bad).valid).toBe(false);
  });

  it('rejects bundles that are not exactly 5 slots', () => {
    const four = [0, 1, 2, 3].map((i) =>
      slot(i, { type: 'signature', recipe_id: 'SCENT_RECIPE_01' }),
    );
    expect(() => buildBundleConfiguration(four)).toThrow();
  });

  it('rejects a slot with an invalid custom blend', () => {
    const slots = [0, 1, 2, 3, 4].map((i) =>
      slot(i, { type: 'signature', recipe_id: 'SCENT_RECIPE_01' }),
    );
    slots[2] = slot(2, customBlend(['lavender', 'lemon', 'peppermint', 'tea-tree']));
    expect(() => buildBundleConfiguration(slots)).toThrow(/at most 3/);
  });
});

describe('server recompute — the browser never dictates totals', () => {
  it('accepts an order whose client totals match the server recompute', () => {
    const item = buildCartItem('custom-soap', signatureCustomization({ shape: 'small-rose' }), 2);
    const order = buildOrderConfiguration([item], undefined, 0);
    expect(order.subtotal_cents).toBe(577 * 2);
    expect(order.total_cents).toBe(577 * 2);
    expect(order.computed_by).toBe('server');
  });

  it('REJECTS a manipulated client unit price', () => {
    const item = buildCartItem('custom-soap', signatureCustomization({ shape: 'small-rose' }), 1);
    item.unit_price_cents = 1; // tampered preview total
    expect(() => buildOrderConfiguration([item], undefined, 0)).toThrow(/Price mismatch/);
  });

  it('REJECTS a manipulated client price even when everything else is valid', () => {
    const item = buildCartItem(
      'custom-soap',
      signatureCustomization({
        shape: 'floral-round',
        scent: customBlend(['rose', 'jasmine']),
      }),
      3,
    );
    item.unit_price_cents = 999; // tampered
    expect(() => buildOrderConfiguration([item], undefined, 500)).toThrow(
      /client said 999, server computes 1177/,
    );
  });

  it('bundle price comes from the server constant, not client input', () => {
    const slots = [0, 1, 2, 3, 4].map((i) =>
      ({
        slot_index: i,
        base: 'glycerin-castor',
        shape: ['small-rose', 'medium-rose', 'plain-rectangle', 'wave-rectangle', 'floral-round'][i],
        scent: { type: 'signature', recipe_id: 'SCENT_RECIPE_01' },
        botanical: null,
        color: 'amber-gold',
      }) as BundleSlot,
    );
    const bundle = buildBundleConfiguration(slots);
    const order = buildOrderConfiguration([], bundle, 0);
    expect(order.subtotal_cents).toBe(BUNDLE_PRICE_CENTS);
    expect(order.total_cents).toBe(BUNDLE_PRICE_CENTS);
  });
});

describe('cart payload structure', () => {
  it('cart items carry the order-record schema (ids, not prose)', () => {
    const item = buildCartItem(
      'custom-soap',
      signatureCustomization({ scent: customBlend(['tea-tree', 'lavender']) }),
      2,
    );
    expect(item).toMatchObject({
      product_handle: 'custom-soap',
      quantity: 2,
      unit_price_cents: 1177,
    });
    expect(typeof item.id).toBe('string');
    expect(item.customization?.shape).toBe('wave-rectangle');
  });

  it('rejects non-positive or non-integer quantities', () => {
    expect(() => buildCartItem('custom-soap', signatureCustomization(), 0)).toThrow();
    expect(() => buildCartItem('custom-soap', signatureCustomization(), 1.5)).toThrow();
  });
});

describe('malformed input robustness (API hardening)', () => {
  const asCustomization = (v: unknown) => v as unknown as Customization;
  const asScent = (v: unknown) => v as unknown as ScentSelection;

  it('validateScentSelection returns errors (never throws) on garbage', () => {
    for (const bad of [null, undefined, 42, 'lavender', [], true]) {
      expect(validateScentSelection(asScent(bad)).length).toBeGreaterThan(0);
    }
    // Wrong shape: missing type discriminator.
    expect(validateScentSelection(asScent({})).length).toBeGreaterThan(0);
    expect(
      validateScentSelection(asScent({ type: 'custom_blend', oils: 'lavender' })).length,
    ).toBeGreaterThan(0);
    expect(
      validateScentSelection(asScent({ type: 'mystery', oils: [] })).length,
    ).toBeGreaterThan(0);
  });

  it('validateCustomization returns invalid (never throws) on garbage', () => {
    for (const bad of [null, undefined, 42, 'soap', [], true]) {
      const r = validateCustomization(asCustomization(bad));
      expect(r.valid).toBe(false);
      expect(r.errors.length).toBeGreaterThan(0);
    }
    const r = validateCustomization(asCustomization({}));
    expect(r.valid).toBe(false);
  });

  it('validateBundleSlot returns invalid (never throws) on garbage', () => {
    for (const bad of [null, undefined, 42, 'slot', []]) {
      const r = validateBundleSlot(bad as unknown as BundleSlot);
      expect(r.valid).toBe(false);
    }
  });

  it('builders throw with messages (never TypeError) on garbage', () => {
    expect(() => buildBundleConfiguration(null as unknown as BundleSlot[])).toThrow(
      'must be an array',
    );
    expect(() =>
      buildOrderConfiguration(null as unknown as CartItem[], undefined, 0),
    ).toThrow('must be an array');
    expect(() => buildOrderConfiguration([], undefined, -1)).toThrow('Invalid shipping');
    expect(() => buildOrderConfiguration([], undefined, 1.5)).toThrow('Invalid shipping');
    expect(() => buildOrderConfiguration([], undefined, NaN)).toThrow('Invalid shipping');
    expect(() =>
      buildOrderConfiguration([null as unknown as CartItem], undefined, 0),
    ).toThrow('must be an object');
    expect(() =>
      buildCartItem('custom-soap', signatureCustomization(), '2' as unknown as number),
    ).toThrow('Invalid quantity');
  });
});
