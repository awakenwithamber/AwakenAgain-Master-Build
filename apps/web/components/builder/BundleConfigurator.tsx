'use client';
/**
 * The Alchemy Soap Collection — 5 individually customizable slots.
 *
 * One slot per shape (fixed per BUNDLE_SLOT_SHAPES): Small Rose, Medium Rose,
 * Large Plain Rectangle, Large Wave Rectangle, Large Floral Round. Each slot
 * carries the full two-path scent configuration with a per-slot blend
 * readout and exact-oil persistence.
 *
 * "Apply this theme to all 5" copies the full theme configuration into five
 * INDEPENDENT slot states — one slot can never overwrite another.
 *
 * Bundle price and savings are DERIVED from lib/pricing — never hard-coded.
 * On "Add Collection to Cart" the payload is validated via
 * buildBundleConfiguration and the collection is written to THE single cart
 * store (components/checkout/cart-store) — builder payloads that never reach
 * the cart were a legacy lost-sales bug. The server reprices authoritatively
 * at checkout. One collection per order (no bundle quantity).
 */
import { useState } from 'react';
import {
  buildBundleConfiguration,
  buildOrderConfiguration,
  validateBundleSlot,
} from '../../lib/cart/validation';
import {
  BOTANICALS,
  SOAP_BASES,
  SOAP_COLORS,
  getBase,
  getBotanical,
} from '../../lib/catalog/oils';
import { SIGNATURE_SCENTS } from '../../lib/catalog/scents';
import { getShape } from '../../lib/catalog/shapes';
import {
  BUNDLE_ID,
  BUNDLE_PRICE_CENTS,
  BUNDLE_SLOT_SHAPES,
  bundleComponentSumCents,
  bundleSavingsCents,
  bundleSavingsPct,
  formatPrice,
} from '../../lib/pricing/pricing';
import { track } from '../../lib/analytics/posthog';
import { ANALYTICS_EVENT_NAMES } from '../../lib/analytics/events';
import { useCart } from '../checkout/cart-store';
import type {
  BundleConfiguration,
  OrderConfiguration,
  SeasonalFeature,
  SoapBaseId,
} from '../../types';
import { ScentStep } from './ScentStep';
import {
  applyThemeToAll,
  blendReadout,
  colorAllowedForBase,
  colorLabel,
  encodeCustomColor,
  isCustomColorId,
  scentLabel,
  scentSelectionOf,
  slotToBundleSlot,
  slotsFromTheme,
  toggleBlendOil,
  updateSlot,
  type ScentPath,
  type SlotState,
  type SlotTheme,
} from './state';
import styles from './SoapBuilderModal.module.css';

export interface BundleConfiguratorProps {
  /** Theme from the completed ritual — applied to all 5 slots on mount. */
  theme: SlotTheme;
  /** Seasonal feature as configurable data (surfaced in each slot's scent editor). */
  seasonal: SeasonalFeature | null;
}

function slotEventProps(slot: SlotState, via: 'theme_apply' | 'slot_edit') {
  const scent = slot.scent;
  return {
    via,
    slot_index: slot.slot_index,
    shape: BUNDLE_SLOT_SHAPES[slot.slot_index] as string,
    base: slot.base,
    scent_path: (scent.type === 'signature' ? 'signature' : 'custom_blend') as
      | 'signature'
      | 'custom_blend',
    ...(scent.type === 'signature'
      ? { recipe_id: scent.recipe_id }
      : { oils: scent.oils, oil_count: scent.oils.length }),
    botanical: slot.botanical,
    color: slot.color,
  };
}

export function BundleConfigurator({ theme, seasonal }: BundleConfiguratorProps) {
  const [slots, setSlots] = useState<SlotState[]>(() => slotsFromTheme(theme));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { setBundle } = useCart();
  const [added, setAdded] = useState(false);
  const [customHex, setCustomHex] = useState('#8a5a9e');
  const [result, setResult] = useState<{
    bundle: BundleConfiguration;
    order: OrderConfiguration;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derived pricing — never hard-coded.
  const componentSum = bundleComponentSumCents();
  const bundlePrice = BUNDLE_PRICE_CENTS;
  const savings = bundleSavingsCents();
  const savingsPct = bundleSavingsPct();

  const applyTheme = () => {
    const next = applyThemeToAll(slots, theme);
    setSlots(next);
    setEditingIndex(null);
    setError(null);
    for (const slot of next) {
      track(ANALYTICS_EVENT_NAMES.bundleSlotConfigured, slotEventProps(slot, 'theme_apply'));
    }
  };

  const updateScentPath = (index: number, path: ScentPath) => {
    const slot = slots[index];
    if (!slot) return;
    const nextScent =
      path === 'signature'
        ? { type: 'signature' as const, recipe_id: 'SCENT_RECIPE_01' }
        : { type: 'custom_blend' as const, oils: [] as string[] };
    // Keep the current selection when switching back to the same path.
    const preserved =
      slot.scent.type === 'signature' && path === 'signature'
        ? slot.scent
        : slot.scent.type === 'custom_blend' && path === 'blend'
          ? slot.scent
          : nextScent;
    setSlots(updateSlot(slots, index, { scent: preserved }));
  };

  const selectSignature = (index: number, recipeId: string) => {
    const recipe = SIGNATURE_SCENTS.find((r) => r.id === recipeId);
    if (!recipe) return;
    setSlots(
      updateSlot(slots, index, {
        scent: { type: 'signature', recipe_id: recipeId },
      }),
    );
    track(ANALYTICS_EVENT_NAMES.scentSelected, {
      path: 'signature',
      recipe_id: recipeId,
    });
  };

  const toggleOil = (index: number, oilId: string) => {
    const slot = slots[index];
    if (!slot || slot.scent.type !== 'custom_blend') return;
    setSlots(
      updateSlot(slots, index, {
        scent: { type: 'custom_blend', oils: toggleBlendOil(slot.scent.oils, oilId) },
      }),
    );
  };

  const doneEditing = (index: number) => {
    const slot = slots[index];
    if (!slot) return;
    const validation = validateBundleSlot(slotToBundleSlot(slot));
    if (!validation.valid) {
      setError(
        `Slot ${index + 1} still needs work: ${validation.errors.join('; ')}`,
      );
      return;
    }
    setError(null);
    setEditingIndex(null);
    track(ANALYTICS_EVENT_NAMES.bundleSlotConfigured, slotEventProps(slot, 'slot_edit'));
  };

  const addToCart = () => {
    setError(null);
    setResult(null);
    setAdded(false);
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot) continue;
      const scentOk = scentSelectionOf({
        scentPath: slot.scent.type === 'signature' ? 'signature' : 'blend',
        signatureId: slot.scent.type === 'signature' ? slot.scent.recipe_id : null,
        blendOils: slot.scent.type === 'custom_blend' ? slot.scent.oils : [],
      });
      const validation = validateBundleSlot(slotToBundleSlot(slot));
      if (!scentOk || !validation.valid) {
        setEditingIndex(i);
        setError(
          `Bar ${i + 1} still needs a complete configuration — please finish it before adding the collection.`,
        );
        return;
      }
    }
    try {
      const bundleSlots = slots.map(slotToBundleSlot);
      const bundle = buildBundleConfiguration(bundleSlots);
      const order = buildOrderConfiguration([], bundle, 0);
      // THE cart store is the single cart source — this is what actually
      // puts the collection in the customer's cart (legacy bug: builder
      // payloads never reached checkout). One collection per order; the
      // server reprices authoritatively from canonical data.
      setBundle({ bundle_id: bundle.bundle_id, slots: bundle.slots });
      setAdded(true);
      setResult({ bundle, order });
      track(ANALYTICS_EVENT_NAMES.bundleAddedToCart, {
        bundle_id: BUNDLE_ID,
        price_cents: bundle.price_cents,
        savings_cents: bundle.savings_cents,
        slot_count: bundle.slots.length,
        slots: bundle.slots.map((s) =>
          slotEventProps(
            { ...s, slot_index: s.slot_index } as SlotState,
            'slot_edit',
          ),
        ),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the bundle payload.');
    }
  };

  return (
    <section aria-label="Alchemy Soap Collection configurator" className={styles.bundleConfig}>
      <h3 className={styles.summaryTitle}>Your Collection — one of each design</h3>
      <p className={styles.blendHint}>
        The theme from your ritual was applied to all five bars. Edit any bar
        individually — each one is uniquely yours.
      </p>
      <div className={styles.bundleActions}>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={applyTheme}>
          Apply this theme to all 5
        </button>
      </div>

      <div className={styles.slotGrid}>
        {slots.map((slot, i) => {
          const shape = getShape(BUNDLE_SLOT_SHAPES[slot.slot_index] ?? '');
          const isEditing = editingIndex === i;
          const readout =
            slot.scent.type === 'custom_blend'
              ? blendReadout(slot.scent.oils)
              : null;
          return (
            <article key={slot.slot_index} className={styles.slot} aria-label={`Bar ${i + 1}: ${shape?.name ?? ''}`}>
              <h4>
                Bar {i + 1} — {shape?.name} · {shape?.weightOz} oz
              </h4>
              {!isEditing ? (
                <div>
                  <p>
                    <strong>Base:</strong> {getBase(slot.base)?.name}
                  </p>
                  <p>
                    <strong>Scent:</strong> {scentLabel(slot.scent)}
                    {readout && readout.tags.length > 0 && (
                      <span className={styles.tags}> · {readout.tags.join(' • ')}</span>
                    )}
                  </p>
                  <p>
                    <strong>Botanical:</strong>{' '}
                    {getBotanical(slot.botanical)?.name ?? slot.botanical}
                  </p>
                  <p>
                    <strong>Color:</strong> {colorLabel(slot.color)}
                  </p>
                  <button type="button" className={styles.slotBtn} onClick={() => setEditingIndex(i)}>
                    Edit this bar
                  </button>
                </div>
              ) : (
                <div className={styles.slotEditor}>
                  <label>
                    Base
                    <select
                      value={slot.base}
                      onChange={(e) => {
                        const base = e.target.value as SoapBaseId;
                        let color = slot.color;
                        if (!colorAllowedForBase(base, color)) color = 'creamy-white';
                        setSlots(updateSlot(slots, i, { base, color }));
                      }}
                    >
                      {SOAP_BASES.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <ScentStep
                    compact
                    slotIndex={i}
                    scentPath={slot.scent.type === 'signature' ? 'signature' : 'blend'}
                    signatureId={
                      slot.scent.type === 'signature' ? slot.scent.recipe_id : null
                    }
                    blendOils={
                      slot.scent.type === 'custom_blend' ? slot.scent.oils : []
                    }
                    seasonal={seasonal}
                    onPathChange={(p) => updateScentPath(i, p)}
                    onSignatureSelect={(id) => selectSignature(i, id)}
                    onToggleOil={(id) => toggleOil(i, id)}
                    onSeasonalSelect={() =>
                      seasonal &&
                      track(ANALYTICS_EVENT_NAMES.seasonalScentInteracted, {
                        season_id: seasonal.id,
                      })
                    }
                  />

                  <label>
                    Botanical
                    <select
                      value={slot.botanical}
                      onChange={(e) =>
                        setSlots(updateSlot(slots, i, { botanical: e.target.value }))
                      }
                    >
                      {BOTANICALS.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Color
                    <select
                      value={isCustomColorId(slot.color) ? '__custom__' : slot.color}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setSlots(
                            updateSlot(slots, i, { color: encodeCustomColor(customHex) }),
                          );
                        } else {
                          setSlots(updateSlot(slots, i, { color: e.target.value }));
                        }
                      }}
                      aria-label={`Color for bar ${i + 1}`}
                    >
                      {SOAP_COLORS.filter((c) =>
                        colorAllowedForBase(slot.base, c.id),
                      ).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                      <option value="__custom__">Custom color…</option>
                    </select>
                  </label>
                  <label className={styles.customColorRow}>
                    <input
                      type="color"
                      value={customHex}
                      onChange={(e) => {
                        setCustomHex(e.target.value);
                        setSlots(
                          updateSlot(slots, i, {
                            color: encodeCustomColor(e.target.value),
                          }),
                        );
                      }}
                      aria-label={`Custom color picker for bar ${i + 1}`}
                    />
                    <span>Custom dye {customHex.toUpperCase()}</span>
                  </label>
                  {!colorAllowedForBase(slot.base, 'natural-clear') && (
                    <p className={styles.blendHint}>
                      Natural / Clear is hidden for this bar — it needs the
                      translucent glycerin base.
                    </p>
                  )}

                  <button type="button" className={styles.slotBtn} onClick={() => doneEditing(i)}>
                    Done
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {error && (
        <p role="alert" className={styles.formError}>
          {error}
        </p>
      )}

      <div className={styles.bundleTotals} aria-live="polite">
        <p className={styles.priceRow}>
          <span className={styles.struck}>{formatPrice(componentSum)}</span>{' '}
          <strong className={styles.bundlePrice}>{formatPrice(bundlePrice)}</strong>{' '}
          <span className={styles.saveBadge}>
            Save {formatPrice(savings)} ({savingsPct}%)
          </span>
        </p>
        <p className={styles.blendHint}>
          Priced separately {formatPrice(componentSum)} · Collection{' '}
          {formatPrice(bundlePrice)} — genuine savings, computed from current
          prices.
        </p>
      </div>

      <div className={styles.bundleActions}>
        <button type="button" className={styles.btn} onClick={addToCart}>
          Add Collection to Cart
        </button>
      </div>

      {added && (
        <p role="status" className={styles.addedNote}>
          ✨ Your collection is in your cart —{' '}
          <a href="/cart">review your cart</a> or{' '}
          <a href="/checkout">head to checkout</a>.
        </p>
      )}

      {result && (
        <details className={styles.payload}>
          <summary>Order payload (what the maker receives)</summary>
          <pre>{JSON.stringify(result.order, null, 2)}</pre>
          <p className={styles.hint}>
            Totals are recomputed server-side at checkout — the browser never
            sets the final price.
          </p>
        </details>
      )}
    </section>
  );
}
