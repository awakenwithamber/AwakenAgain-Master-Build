/**
 * PERMANENT REGRESSION — DO NOT WEAKEN OR REMOVE.
 *
 * Builder flows must write COMPLETE, VALIDATED configurations to THE single
 * cart store (components/checkout/cart-store).
 *
 * Two original bugs (both real lost sales):
 *
 * 1. THE BUILDER NEVER WROTE TO THE CART. The "Create Your Own Alchemy Soap"
 *    builder's "Add to Cart" and the collection configurator's "Add
 *    Collection to Cart" built preview payloads (order-configuration
 *    objects for display) but never called the cart store — customers
 *    configured products, clicked the button, and nothing reached checkout.
 *    Fixed by wiring both flows through the single cart module: SoapBuilder
 *    calls addItem, BundleConfigurator calls setBundle.
 *
 * 2. THE LEGACY TWO-CART BUG. Two carts coexisted and localStorage-cart
 *    items never reached checkout. Fixed by the single-cart invariant:
 *    cart-store.ts is the ONLY module that reads/writes the cart storage
 *    key (enforced by tests/cart-single-source.test.ts).
 *
 * This suite goes one step further than "the button calls the store": it
 * proves the configuration PERSISTED is the COMPLETE VALIDATED
 * configuration — every required field present (base, shape, scent path
 * with exact recipe_id or exact oil IDs, botanical, color), validated
 * through lib/cart/validation.ts BEFORE the write, so no partial write can
 * ever become a cart line. If a future change lets an incomplete
 * customization reach the cart store, these tests fail. That is intentional.
 *
 * Original task directive: "MONEY-PATH REGRESSIONS ARE PERMANENT."
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  buildBundleConfiguration,
  buildCartItem,
  buildOrderConfiguration,
  validateBundleSlot,
} from '../lib/cart/validation';
import { BUNDLE_SLOT_SHAPES } from '../lib/pricing/pricing';
import { getShape } from '../lib/catalog/shapes';
import {
  canReachStep,
  defaultSelections,
  scentSelectionOf,
  slotsFromTheme,
  slotToBundleSlot,
  type BuilderSelections,
  type SlotTheme,
} from '../components/builder/state';
import type { Customization, SoapBaseId } from '../types';

const ROOT = resolve(__dirname, '..');

function src(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/* ------------------------------------------------------------------ */
/* Helpers that mirror the builders' addToCart logic exactly            */
/* ------------------------------------------------------------------ */

/** A complete single-soap ritual, driven through the builder's own state helpers. */
function completeRitualSelections(): BuilderSelections {
  return {
    ...defaultSelections(),
    base: 'double-layer',
    shape: 'wave-rectangle',
    scentPath: 'blend',
    blendOils: ['lavender', 'frankincense'],
    botanical: 'mint',
    color: 'emerald',
  };
}

/**
 * Replicates SoapBuilder.addToCart's construction + guards verbatim:
 * the same scentSelectionOf call, the same completeness throw, the same
 * customization literal. If the builder's logic drifts from this helper,
 * the structural scans below catch it.
 */
function buildCustomizationLikeBuilder(sel: BuilderSelections): Customization {
  const scent = scentSelectionOf(sel);
  if (!sel.base || !sel.shape || !scent || !sel.color) {
    throw new Error('Your ritual is not complete yet.');
  }
  return {
    base: sel.base as SoapBaseId,
    shape: sel.shape,
    scent,
    botanical: sel.botanical,
    color: sel.color,
  };
}

function completeTheme(): SlotTheme {
  return {
    base: 'double-layer',
    scent: { type: 'custom_blend', oils: ['lavender', 'frankincense'] },
    botanical: 'mint',
    color: 'emerald',
  };
}

/* ------------------------------------------------------------------ */
/* Original source-scan guards (kept verbatim — still the base layer)   */
/* ------------------------------------------------------------------ */

describe('builder flows write to the single cart store', () => {
  it('SoapBuilder "Add to Cart" calls the cart store addItem', () => {
    const code = src('components/builder/SoapBuilder.tsx');
    expect(code).toMatch(/from '\.\.\/checkout\/cart-store'/);
    expect(code).toMatch(/const \{ addItem \} = useCart\(\)/);
    expect(code).toMatch(/addItem\('custom-alchemy-soap', undefined, customization, qty\)/);
  });

  it('BundleConfigurator "Add Collection to Cart" calls the cart store setBundle', () => {
    const code = src('components/builder/BundleConfigurator.tsx');
    expect(code).toMatch(/from '\.\.\/checkout\/cart-store'/);
    expect(code).toMatch(/const \{ setBundle \} = useCart\(\)/);
    expect(code).toMatch(/setBundle\(\{ bundle_id: bundle\.bundle_id, slots: bundle\.slots \}\)/);
  });

  it('the collection configurator offers no bundle quantity (one collection per order)', () => {
    // The cart store and the server price exactly ONE collection per order
    // (no bundle quantity field). A qty input here would promise something
    // the money path cannot fulfill.
    const code = src('components/builder/BundleConfigurator.tsx');
    expect(code).not.toMatch(/Collection quantity/);
  });

  it('custom-builder cart lines render a customer-facing title, not a handle', () => {
    const store = src('components/checkout/cart-store.ts');
    expect(store).toMatch(/CUSTOM_BUILDER_TITLE/);
    const cart = src('components/checkout/CartView.tsx');
    expect(cart).toMatch(/cartItemTitle\(/);
    const form = src('components/checkout/CheckoutForm.tsx');
    expect(form).toMatch(/cartItemTitle\(/);
  });
});

/* ------------------------------------------------------------------ */
/* Structural: validation MUST precede the cart-store write, and the    */
/* persisted object MUST be the validated one (same identifier).        */
/* ------------------------------------------------------------------ */

describe('PERMANENT REGRESSION — validate-before-persist ordering in builder source', () => {
  it('SoapBuilder validates via buildCartItem BEFORE addItem, with the same customization object', () => {
    const code = src('components/builder/SoapBuilder.tsx');
    const validateCall = "buildCartItem('custom-alchemy-soap', customization, qty)";
    const persistCall = "addItem('custom-alchemy-soap', undefined, customization, qty)";
    const validateIdx = code.indexOf(validateCall);
    const persistIdx = code.indexOf(persistCall);
    expect(validateIdx, 'buildCartItem validation call missing').toBeGreaterThan(-1);
    expect(persistIdx, 'addItem persist call missing').toBeGreaterThan(-1);
    // The SAME `customization` identifier is validated and persisted —
    // a different object (or a rebuilt partial) must never reach the store.
    expect(
      validateIdx,
      'buildCartItem must run BEFORE addItem so a partial config can never be persisted',
    ).toBeLessThan(persistIdx);
  });

  it('SoapBuilder runs the server-authority recompute (buildOrderConfiguration) in the add-to-cart path', () => {
    const code = src('components/builder/SoapBuilder.tsx');
    expect(code).toMatch(/const order = buildOrderConfiguration\(\[item\], undefined, 0\);/);
  });

  it('SoapBuilder constructs the customization literal with ALL required fields', () => {
    const code = src('components/builder/SoapBuilder.tsx');
    expect(code).toMatch(
      /const customization: Customization = \{\s*base: sel\.base,\s*shape: sel\.shape,\s*scent,\s*botanical: sel\.botanical,\s*color: sel\.color,\s*\};/,
    );
  });

  it('BundleConfigurator builds the validated bundle BEFORE setBundle, and persists the validated slots', () => {
    const code = src('components/builder/BundleConfigurator.tsx');
    const validateCall = 'const bundle = buildBundleConfiguration(bundleSlots);';
    const persistCall = 'setBundle({ bundle_id: bundle.bundle_id, slots: bundle.slots });';
    const validateIdx = code.indexOf(validateCall);
    const persistIdx = code.indexOf(persistCall);
    expect(validateIdx, 'buildBundleConfiguration call missing').toBeGreaterThan(-1);
    expect(persistIdx, 'setBundle persist call missing').toBeGreaterThan(-1);
    expect(
      validateIdx,
      'buildBundleConfiguration must run BEFORE setBundle so partial slots can never be persisted',
    ).toBeLessThan(persistIdx);
    // setBundle persists bundle.slots — the VALIDATED slots — never the raw
    // unvalidated slot editor state.
    expect(code.indexOf('setBundle({ bundle_id:'), 'raw slots must not be persisted').toBe(persistIdx);
  });

  it('BundleConfigurator gates every slot individually before the bundle build', () => {
    const code = src('components/builder/BundleConfigurator.tsx');
    expect(code).toMatch(/validateBundleSlot\(slotToBundleSlot\(slot\)\)/);
    expect(code).toMatch(/still needs a complete configuration/);
  });
});

/* ------------------------------------------------------------------ */
/* Functional: the persisted single-soap configuration is complete      */
/* ------------------------------------------------------------------ */

describe('PERMANENT REGRESSION — persisted single-soap configuration is complete and validated', () => {
  it('a complete ritual produces a customization with every required field, and it validates end-to-end', () => {
    const sel = completeRitualSelections();
    // The ritual gate itself: reveal (and therefore Add to Cart) is
    // unreachable until every step is complete.
    expect(canReachStep('reveal', sel, 'single')).toBe(true);

    const customization = buildCustomizationLikeBuilder(sel);
    expect(customization.base).toBe('double-layer');
    expect(customization.shape).toBe('wave-rectangle');
    expect(customization.scent).toEqual({
      type: 'custom_blend',
      oils: ['lavender', 'frankincense'],
    });
    expect(customization.botanical).toBe('mint');
    expect(customization.color).toBe('emerald');

    // The exact object the builder hands to addItem validates through the
    // order-configuration schema — no partial write possible.
    const item = buildCartItem('custom-alchemy-soap', customization, 1);
    expect(item.product_handle).toBe('custom-alchemy-soap');
    expect(item.customization).toEqual(customization);
    // Server-authoritative unit price: the shape table, never a client value.
    expect(item.unit_price_cents).toBe(getShape('wave-rectangle')?.priceCents);
    expect(item.unit_price_cents).toBe(1177);

    const order = buildOrderConfiguration([item], undefined, 0);
    expect(order.subtotal_cents).toBe(1177);
    expect(order.total_cents).toBe(1177);
    expect(order.computed_by).toBe('server');
  });

  it('the signature scent path persists the exact recipe_id — never prose', () => {
    const sel: BuilderSelections = {
      ...completeRitualSelections(),
      scentPath: 'signature',
      signatureId: 'SCENT_RECIPE_01',
      blendOils: [],
    };
    const customization = buildCustomizationLikeBuilder(sel);
    expect(customization.scent).toEqual({ type: 'signature', recipe_id: 'SCENT_RECIPE_01' });
    const item = buildCartItem('custom-alchemy-soap', customization, 2);
    expect(item.customization?.scent).toEqual({
      type: 'signature',
      recipe_id: 'SCENT_RECIPE_01',
    });
    expect(item.quantity).toBe(2);
  });

  it.each<[string, Partial<BuilderSelections>]>([
    ['base', { base: null }],
    ['shape', { shape: null }],
    ['scent', { scentPath: 'signature', signatureId: null, blendOils: [] }],
    ['color', { color: null }],
  ])(
    'no partial writes: a ritual missing %s can never reach Add to Cart and never validates',
    (_field, patch) => {
      const sel: BuilderSelections = { ...completeRitualSelections(), ...patch };
      // The UI gate: reveal is unreachable.
      expect(canReachStep('reveal', sel, 'single')).toBe(false);
      // The builder's own guard throws before any payload is built.
      expect(() => buildCustomizationLikeBuilder(sel)).toThrow();
      // Defense in depth: even a hand-built partial object is rejected by
      // the order-configuration schema.
      const scent = scentSelectionOf(sel);
      const partial = {
        base: sel.base,
        shape: sel.shape,
        scent,
        botanical: sel.botanical,
        color: sel.color,
      } as unknown as Customization;
      expect(() => buildCartItem('custom-alchemy-soap', partial, 1)).toThrow();
    },
  );

  it('botanical: the ritual gate requires it, and the schema documents its nullability', () => {
    // The complete ritual always carries a botanical — the step gate
    // enforces it, so Add to Cart is unreachable without one.
    const sel: BuilderSelections = { ...completeRitualSelections(), botanical: null };
    expect(canReachStep('reveal', sel, 'single')).toBe(false);
    // The order schema types botanical as `string | null` ("or null for
    // none"), so a null botanical validates at the schema layer — the
    // no-partial-write guarantee for botanical lives in the ritual gate,
    // not in buildCartItem. This test documents that contract exactly.
    const withNull: Customization = {
      ...buildCustomizationLikeBuilder(completeRitualSelections()),
      botanical: null,
    };
    expect(() => buildCartItem('custom-alchemy-soap', withNull, 1)).not.toThrow();
  });

  it('a tampered unit price on a builder cart line is rejected by the server recompute', () => {
    const customization = buildCustomizationLikeBuilder(completeRitualSelections());
    const item = buildCartItem('custom-alchemy-soap', customization, 1);
    const tampered = { ...item, unit_price_cents: 577 };
    expect(() => buildOrderConfiguration([tampered], undefined, 0)).toThrow(
      /Price mismatch/,
    );
  });
});

/* ------------------------------------------------------------------ */
/* Functional: the persisted bundle configuration is complete           */
/* ------------------------------------------------------------------ */

describe('PERMANENT REGRESSION — persisted bundle configuration is complete and validated', () => {
  it('a complete theme produces all 5 slots with complete per-slot configs, and the bundle validates', () => {
    const bundleSlots = slotsFromTheme(completeTheme()).map(slotToBundleSlot);
    expect(bundleSlots).toHaveLength(5);

    const bundle = buildBundleConfiguration(bundleSlots);

    // The exact payload the configurator persists to the cart store.
    const persisted = { bundle_id: bundle.bundle_id, slots: bundle.slots };
    expect(persisted.slots).toHaveLength(5);
    persisted.slots.forEach((slot, i) => {
      expect(slot.slot_index).toBe(i);
      // One of each of the 5 styles, fixed per slot index.
      expect(slot.shape).toBe(BUNDLE_SLOT_SHAPES[i]);
      expect(slot.base).toBe('double-layer');
      // Scent path with EXACT oil IDs — never prose.
      expect(slot.scent).toEqual({
        type: 'custom_blend',
        oils: ['lavender', 'frankincense'],
      });
      expect(slot.botanical).toBe('mint');
      expect(slot.color).toBe('emerald');
      // Every persisted slot independently validates.
      expect(validateBundleSlot(slot).valid).toBe(true);
    });
  });

  it('no partial writes: a 4-slot bundle is rejected', () => {
    const four = slotsFromTheme(completeTheme()).map(slotToBundleSlot).slice(0, 4);
    expect(() => buildBundleConfiguration(four)).toThrow(/5 slots/);
  });

  it('no partial writes: a slot missing its scent is rejected', () => {
    const slots = slotsFromTheme(completeTheme()).map(slotToBundleSlot);
    const broken = {
      ...slots[2],
      scent: { type: 'custom_blend', oils: [] },
    } as (typeof slots)[number];
    expect(validateBundleSlot(broken).valid).toBe(false);
    expect(() =>
      buildBundleConfiguration(slots.map((s, i) => (i === 2 ? broken : s))),
    ).toThrow();
  });

  it('no partial writes: a slot with the wrong shape for its index is rejected', () => {
    const slots = slotsFromTheme(completeTheme()).map(slotToBundleSlot);
    const swapped = slots.map((s, i) =>
      i === 0 ? { ...s, shape: BUNDLE_SLOT_SHAPES[1] as string } : s,
    );
    expect(() => buildBundleConfiguration(swapped)).toThrow(/must be shape/);
  });
});
