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
import { toCents } from '../../lib/pricing/pricing';
import { CUSTOM_BUILDER_TITLE } from '../../lib/checkout/order';
import type { BundleConfiguration, CartItem, Customization } from '../../types';

/** Cart storage key — owned exclusively by this module. */
export const CART_STORAGE_KEY = 'aaa-cart-v1';

/**
 * Display title for a cart line. The custom-builder handle
 * ('custom-alchemy-soap') is not in the product catalog, so it gets its
 * customer-facing name here rather than rendering the raw handle.
 */
export function cartItemTitle(productHandle: string, variantId?: string): string {
  if (productHandle === 'custom-alchemy-soap') return CUSTOM_BUILDER_TITLE;
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

function writeCart(state: CartState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
}

let cartIdCounter = 0;
function nextCartId(): string {
  cartIdCounter += 1;
  return `cart_${Date.now().toString(36)}_${cartIdCounter}`;
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
 * Customized soaps price from the shape table; plain items from variant or
 * product price.
 */
export function previewUnitPriceCents(
  productHandle: string,
  variantId: string | undefined,
  customization: Customization | undefined,
): number | null {
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
    setState(readCart());
    setLoaded(true);
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
    ): boolean => {
      const unit = previewUnitPriceCents(productHandle, variantId, customization);
      if (unit === null || !Number.isInteger(quantity) || quantity < 1) return false;
      const item: CartItem = {
        id: nextCartId(),
        product_handle: productHandle,
        quantity,
        unit_price_cents: unit,
        ...(variantId ? { variant_id: variantId } : {}),
        ...(customization ? { customization } : {}),
      };
      persist({ ...state, items: [...state.items, item] });
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
