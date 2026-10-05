/**
 * Typed cart/order payload builders + validation.
 * These functions encode the business rules. The client may mirror them for
 * UX, but the SERVER recomputes every total — browser values never determine
 * order totals. Import pricing only from lib/catalog (integer cents).
 */
import { getShape } from '../catalog/shapes';
import {
  BLENDABLE_OILS,
  BOTANICALS,
  MAX_BLEND_OILS,
  SOAP_BASES,
  SOAP_COLORS,
  getBase,
  getBotanical,
  getColor,
  getOil,
} from '../catalog/oils';
import { getScentRecipe } from '../catalog/scents';
import {
  BUNDLE_ID,
  BUNDLE_PRICE_CENTS,
  BUNDLE_SLOT_SHAPES,
  bundleSavingsCents,
} from '../pricing/pricing';
import type {
  BundleConfiguration,
  BundleSlot,
  CartItem,
  Customization,
  OrderConfiguration,
  ScentSelection,
  ValidationResult,
} from '../../types';

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Owner-approved custom colors (builder "Custom color" picker) are encoded
 * as `custom#RRGGBB`. They represent real food-derived dye choices and are
 * valid on any base. Additive rule: every previously valid value stays valid.
 */
export function customColorHex(id: string): string | null {
  const m = /^custom#([0-9a-fA-F]{6})$/.exec(id);
  return m ? `#${m[1].toLowerCase()}` : null;
}

/** Validate a scent selection: signature IDs must exist; custom blends are
 *  1–3 oils, all from the blendable list, no duplicates. */
export function validateScentSelection(scent: ScentSelection): string[] {
  const errors: string[] = [];
  if (!scent || typeof scent !== 'object') {
    return ['Scent selection must be an object.'];
  }
  if (scent.type === 'signature') {
    if (!getScentRecipe(scent.recipe_id)) {
      errors.push(`Unknown signature scent recipe: ${scent.recipe_id}`);
    }
  } else {
    const oils = scent.oils;
    if (!Array.isArray(oils) || oils.length < 1) {
      errors.push('Custom blend requires at least 1 oil.');
    } else {
      if (oils.length > MAX_BLEND_OILS) {
        errors.push(`Custom blend allows at most ${MAX_BLEND_OILS} oils (got ${oils.length}).`);
      }
      const seen = new Set<string>();
      for (const id of oils) {
        if (seen.has(id)) errors.push(`Duplicate oil in blend: ${id}`);
        seen.add(id);
        if (!getOil(id)) errors.push(`Unknown blendable oil: ${id}`);
      }
    }
  }
  return errors;
}

/**
 * Validate a full customization. Compatibility rules come from DATA:
 * - ColorOption.requiresTranslucentBase × SoapBase.translucent (Natural/Clear rule)
 * - Shape/base/scent/botanical/color IDs must exist in the catalog.
 */
export function validateCustomization(c: Customization): ValidationResult {
  const errors: string[] = [];
  if (!c || typeof c !== 'object') {
    return { valid: false, errors: ['Customization must be an object.'] };
  }

  const shape = getShape(c.shape);
  if (!shape) errors.push(`Unknown shape: ${c.shape}`);

  const base = getBase(c.base);
  if (!base) errors.push(`Unknown base: ${c.base}`);

  errors.push(...validateScentSelection(c.scent));

  if (c.botanical !== null && !BOTANICALS.some((b) => b.id === c.botanical)) {
    errors.push(`Unknown botanical: ${c.botanical}`);
  }

  const color = getColor(c.color);
  const customHex = customColorHex(c.color);
  if (!color && !customHex) {
    errors.push(`Unknown color: ${c.color}`);
  } else if (color?.requiresTranslucentBase && base && !base.translucent) {
    errors.push(
      `Color "${color.name}" requires a translucent base, but base is "${base.name}".`,
    );
  }

  return { valid: errors.length === 0, errors };
}

/** Validate one bundle slot: shape must match its slot, plus full customization rules. */
export function validateBundleSlot(slot: BundleSlot): ValidationResult {
  const errors: string[] = [];
  if (!slot || typeof slot !== 'object') {
    return { valid: false, errors: ['Bundle slot must be an object.'] };
  }
  const expectedShape = BUNDLE_SLOT_SHAPES[slot.slot_index];
  if (expectedShape === undefined) {
    errors.push(`Slot index out of range: ${slot.slot_index}`);
  } else if (slot.shape !== expectedShape) {
    errors.push(
      `Slot ${slot.slot_index} must be shape "${expectedShape}" (got "${slot.shape}").`,
    );
  }
  errors.push(...validateCustomization(slot).errors);
  return { valid: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ */
/* Pricing (server authority)                                          */
/* ------------------------------------------------------------------ */

/** Server-computed unit price for a customized soap: its shape's price. */
export function priceCustomization(c: Customization): number {
  const shape = getShape(c.shape);
  if (!shape) throw new Error(`Cannot price unknown shape: ${c.shape}`);
  return shape.priceCents;
}

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

export function buildCartItem(
  productHandle: string,
  customization: Customization,
  quantity: number,
): CartItem {
  const validation = validateCustomization(customization);
  if (!validation.valid) {
    throw new Error(`Invalid customization: ${validation.errors.join('; ')}`);
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error(`Invalid quantity: ${quantity}`);
  }
  return {
    id: nextId('cart'),
    product_handle: productHandle,
    quantity,
    customization,
    unit_price_cents: priceCustomization(customization),
  };
}

/**
 * Build the bundle payload: exactly 5 slots, one per shape, each validated.
 * Bundle price is the owner-confirmed constant; savings are COMPUTED.
 */
export function buildBundleConfiguration(slots: BundleSlot[]): BundleConfiguration {
  if (!Array.isArray(slots)) {
    throw new Error('Bundle slots must be an array.');
  }  if (slots.length !== BUNDLE_SLOT_SHAPES.length) {
    throw new Error(`Bundle requires ${BUNDLE_SLOT_SHAPES.length} slots (got ${slots.length}).`);
  }
  const errors: string[] = [];
  slots.forEach((slot, i) => {
    if (slot.slot_index !== i) {
      errors.push(`Slot at position ${i} has slot_index ${slot.slot_index}.`);
    }
    errors.push(...validateBundleSlot(slot).errors);
  });
  if (errors.length > 0) {
    throw new Error(`Invalid bundle slots: ${errors.join('; ')}`);
  }
  return {
    bundle_id: BUNDLE_ID,
    slots,
    price_cents: BUNDLE_PRICE_CENTS,
    savings_cents: bundleSavingsCents(),
  };
}

import { getProductByHandle } from '../catalog/products';

/**
 * Assemble the authoritative order payload. Totals are recomputed here —
 * never trusted from client input.
 */
export function buildOrderConfiguration(
  items: CartItem[],
  bundle: BundleConfiguration | undefined,
  shippingCents: number,
): OrderConfiguration {
  if (!Array.isArray(items)) {
    throw new Error('Order items must be an array.');
  }
  if (!Number.isSafeInteger(shippingCents) || shippingCents < 0) {
    throw new Error(`Invalid shipping total: ${String(shippingCents)}.`);
  }
  const itemsTotal = items.reduce((sum, item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Order item must be an object.');
    }
    let unit: number;
    if (item.customization) {
      unit = priceCustomization(item.customization);
    } else {
      const product = getProductByHandle(item.product_handle);
      if (product?.price == null) {
        throw new Error(`Cannot price item ${item.id}: unknown product ${item.product_handle}.`);
      }
      unit = Math.round(product.price * 100);
    }
    if (unit !== item.unit_price_cents) {
      throw new Error(
        `Price mismatch for item ${item.id}: client said ${item.unit_price_cents}, server computes ${unit}.`,
      );
    }
    return sum + unit * item.quantity;
  }, 0);
  const bundleTotal = bundle ? BUNDLE_PRICE_CENTS : 0;
  const subtotal = itemsTotal + bundleTotal;
  return {
    items,
    bundle,
    subtotal_cents: subtotal,
    shipping_cents: shippingCents,
    total_cents: subtotal + shippingCents,
    computed_at: new Date().toISOString(),
    computed_by: 'server',
  };
}

/* Re-export catalog lookups used by UI layers (single import surface). */
export { BLENDABLE_OILS, BOTANICALS, MAX_BLEND_OILS, SOAP_BASES, SOAP_COLORS };
export { getScentRecipe };
