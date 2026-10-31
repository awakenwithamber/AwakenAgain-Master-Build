/**
 * THE single cart module for Amber's Alchemy Apothecary.
 *
 * INVARIANT: this module is the ONLY place that reads or writes the cart
 * storage key. No other component, page, or module may touch localStorage
 * for cart state. The regression test `tests/cart-single-source.test.ts`
 * enforces this by scanning the tree for the storage-key prefix outside
 * this file. (Legacy bug: two carts coexisted and localStorage-cart items
 * never reached checkout — real lost sales. Never again.)
 *
 * Client state is PREVIEW only: totals shown from this store are display
 * values. The server Route Handler at app/api/checkout recomputes every
 * total from canonical data — browser values never determine order totals.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getShape } from '../../lib/catalog/shapes';
import { getProductByHandle } from '../../lib/catalog/products';
import {
  formulaKindForHandle,
  getFormulaSize,
  toCents,
} from '../../lib/pricing/pricing';
import { priceFormulaCustomization } from '../../lib/cart/validation';
import { CUSTOM_BUILDER_TITLE } from '../../lib/checkout/order';
import type {
  BundleConfiguration,
  CartItem,
  Customization,
  FormulaCustomization,
} from '../../types';

/** Cart storage key — owned exclusively by this module. */
export const CART_STORAGE_KEY = 'aaa-cart-v1';

/**
 * Display title for a cart line. The custom-builder handle
 * ('custom-alchemy-soap') is not in the product catalog, so it gets its
 * customer-facing name here rather than rendering the raw handle.
 */
export function cartItemTitle(
  productHandle: string,
  variantId?: string,
  formula?: FormulaCustomization,
): string {
  if (productHandle === 'custom-alchemy-soap') return CUSTOM_BUILDER_TITLE;
  if (formula) {
    const product = getProductByHandle(productHandle);
    const base = product?.title ?? productHandle;
    const kind = formulaKindForHandle(productHandle);
    const size = kind ? getFormulaSize(kind, formula.size_id) : undefined;
    return size ? `${base} — ${size.name} (your formula)` : `${base} (your formula)`;
  }
  const product = getProductByHandle(productHandle);
  const base = product?.title ?? productHandle;
  if (!variantId) return base;
  const variant = (product?.variants ?? []).find(
    (v) => v.variant_id === variantId || v.name === variantId || v.sku === variantId,
  );
  return variant ? `${base} — ${String(variant.name ?? variant.size ?? variantId)}` : base;
}

export interface StoredBundle {
  bundle_id: string;
  slots: BundleConfiguration['slots'];
}

/** Internal cart state: items + at most ONE bundle configuration. */
export interface CartState {
  items: CartItem[];
  bundle: StoredBundle | null;
}

const EMPTY_CART: CartState = { items: [], bundle: null };

function readCart(): CartState {
  if (typeof window === 'undefined') return EMPTY_CART;
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return EMPTY_CART;
    const parsed = JSON.parse(raw) as CartState;
    if (!Array.isArray(parsed.items)) return EMPTY_CART;
    return { items: parsed.items, bundle: parsed.bundle ?? null };
  } catch {
    return EMPTY_CART;
  }
}

/** Same-tab cart-change notification (cross-tab changes arrive via 'storage'). */
const CART_UPDATED_EVENT = 'aaa-cart-updated';

function writeCart(state: CartState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  // Every useCart() instance holds its own React state; notify them all so
  // chrome like the header badge reflects a change immediately instead of
  // only after the next navigation. The writing instance already has the
  // new state — re-reading the just-written value is equivalent for it.
  try {
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  } catch {
    // Non-fatal: notification is best-effort.
  }
}

let cartIdCounter = 0;
function nextCartId(): string {
  cartIdCounter += 1;
  return `cart_${Date.now().toString(36)}_${cartIdCounter}`;
}

/** Deterministic stringify (sorted object keys) for line-identity checks. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(',')}}`;
}

/**
 * Identity of a cart line for merging: same product, same variant, and a
 * deeply-equal customization / formula. Two lines with the same key are the
 * same purchasable thing and must merge into ONE line with summed quantity;
 * any difference (another variant, another soap configuration, another
 * formula) stays a separate line.
 */
export function cartLineKey(
  item: Pick<CartItem, 'product_handle' | 'variant_id' | 'customization' | 'formula'>,
): string {
  return stableStringify({
    product_handle: item.product_handle,
    variant_id: item.variant_id ?? null,
    customization: item.customization ?? null,
    formula: item.formula ?? null,
  });
}

/** Pure add-with-merge (exported for tests). Never mutates the input list. */
export function addItemToCart(items: CartItem[], item: CartItem): CartItem[] {
  const key = cartLineKey(item);
  const idx = items.findIndex((i) => cartLineKey(i) === key);
  if (idx === -1) return [...items, item];
  return items.map((i, n) =>
    n === idx ? { ...i, quantity: i.quantity + item.quantity } : i,
  );
}

/** Find a variant by variant_id, name, or sku — deterministic, data-driven. */
export function resolveVariantPriceCents(
  productHandle: string,
  variantId?: string,
): number | null {
  const product = getProductByHandle(productHandle);
  if (!product) return null;
  if (variantId) {
    const variant = (product.variants ?? []).find(
      (v) =>
        v.variant_id === variantId ||
        v.name === variantId ||
        (typeof v.sku === 'string' && v.sku === variantId),
    );
    if (!variant || typeof variant.price !== 'number') return null;
    return toCents(variant.price);
  }
  if (typeof product.price !== 'number') return null;
  return toCents(product.price);
}

/**
 * PREVIEW unit price for display. Server recomputes authoritatively.
 * Customized soaps price from the shape table; custom formulas price from
 * the formula size table + per-herb add-ons; plain items from variant or
 * product price.
 */
export function previewUnitPriceCents(
  productHandle: string,
  variantId: string | undefined,
  customization: Customization | undefined,
  formula?: FormulaCustomization,
): number | null {
  if (customization && formula) return null;
  if (formula) {
    try {
      return priceFormulaCustomization(productHandle, formula);
    } catch {
      return null;
    }
  }
  if (customization) {
    const shape = getShape(customization.shape);
    return shape ? shape.priceCents : null;
  }
  return resolveVariantPriceCents(productHandle, variantId);
}

export interface CartStore {
  items: CartItem[];
  bundle: StoredBundle | null;
  loaded: boolean;
  addItem: (
    productHandle: string,
    variantId: string | undefined,
    customization: Customization | undefined,
    quantity: number,
    formula?: FormulaCustomization,
  ) => boolean;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setBundle: (bundle: StoredBundle | null) => void;
  clear: () => void;
  itemCount: number;
}

export function useCart(): CartStore {
  const [state, setState] = useState<CartState>(EMPTY_CART);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sync = () => setState(readCart());
    sync();
    setLoaded(true);
    // Keep every mounted useCart() instance (header badge, product cards,
    // cart view) in step with writes from any other instance or tab.
    window.addEventListener(CART_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const persist = useCallback((next: CartState) => {
    setState(next);
    writeCart(next);
  }, []);

  const addItem = useCallback(
    (
      productHandle: string,
      variantId: string | undefined,
      customization: Customization | undefined,
      quantity: number,
      formula?: FormulaCustomization,
    ): boolean => {
      const unit = previewUnitPriceCents(productHandle, variantId, customization, formula);
      if (unit === null || !Number.isInteger(quantity) || quantity < 1) return false;
      const item: CartItem = {
        id: nextCartId(),
        product_handle: productHandle,
        quantity,
        unit_price_cents: unit,
        ...(variantId ? { variant_id: variantId } : {}),
        ...(customization ? { customization } : {}),
        ...(formula
          ? {
              formula: {
                herb_ids: [...formula.herb_ids],
                size_id: formula.size_id,
                ...(formula.creation_name ? { creation_name: formula.creation_name } : {}),
                ...(formula.intention ? { intention: formula.intention } : {}),
                ...(formula.notes ? { notes: formula.notes } : {}),
                // Balm-only fields (additive): present only on balm
                // formulas — capsule/tea cart lines are unchanged.
                ...(formula.base_id ? { base_id: formula.base_id } : {}),
                ...(formula.purpose_id ? { purpose_id: formula.purpose_id } : {}),
                ...(formula.scent_id ? { scent_id: formula.scent_id } : {}),
              },
            }
          : {}),
      };
      persist({ ...state, items: addItemToCart(state.items, item) });
      return true;
    },
    [state, persist],
  );

  const removeItem = useCallback(
    (id: string) => persist({ ...state, items: state.items.filter((i) => i.id !== id) }),
    [state, persist],
  );

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      if (!Number.isInteger(quantity) || quantity < 1) return;
      persist({
        ...state,
        items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
      });
    },
    [state, persist],
  );

  const setBundle = useCallback(
    (bundle: StoredBundle | null) => persist({ ...state, bundle }),
    [state, persist],
  );

  const clear = useCallback(() => persist(EMPTY_CART), [persist]);

  const itemCount = useMemo(
    () => state.items.reduce((n, i) => n + i.quantity, 0) + (state.bundle ? 5 : 0),
    [state],
  );

  return { items: state.items, bundle: state.bundle, loaded, addItem, removeItem, updateQuantity, setBundle, clear, itemCount };
}
