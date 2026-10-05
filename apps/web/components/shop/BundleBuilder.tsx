/**
 * The Alchemy Soap Collection — 5-slot bundle configurator.
 * One of each style; the customer picks scent/color/herbs/botanical per
 * soap. Each slot is independent (slot A's choices never overwrite slot B's)
 * and each slot's shape is FIXED by the bundle definition.
 *
 * Price is the owner-confirmed constant; savings are COMPUTED from actual
 * current per-shape prices. Order record stores every slot's exact
 * customization (base, shape, scent recipe/oils, botanical, color).
 */
'use client';

import { useState } from 'react';
import { BOTANICALS, SOAP_BASES, SOAP_COLORS } from '../../lib/catalog/oils';
import { getShape } from '../../lib/catalog/shapes';
import {
  BUNDLE_ID,
  BUNDLE_NAME,
  BUNDLE_PRICE_CENTS,
  BUNDLE_SLOT_SHAPES,
  bundleComponentSumCents,
  bundleSavingsCents,
  formatPrice,
} from '../../lib/pricing/pricing';
import { track } from '../../lib/analytics/posthog';
import { ANALYTICS_EVENT_NAMES } from '../../lib/analytics/events';
import { useCart } from '../checkout/cart-store';
import { ScentPathPicker } from './ScentPathPicker';
import type { BundleSlot, Customization, ScentSelection } from '../../types';

function defaultScent(): ScentSelection {
  return { type: 'signature', recipe_id: 'SCENT_RECIPE_01' };
}

function defaultSlot(slotIndex: number): BundleSlot {
  return {
    slot_index: slotIndex,
    shape: BUNDLE_SLOT_SHAPES[slotIndex],
    base: 'double-layer',
    scent: defaultScent(),
    botanical: null,
    color: 'amber-gold',
  };
}

function scentLabel(scent: ScentSelection): string {
  return scent.type === 'signature'
    ? `Signature: ${scent.recipe_id}`
    : `Custom blend: ${scent.oils.join(' + ')}`;
}

export function BundleBuilder() {
  const { setBundle } = useCart();
  const [slots, setSlots] = useState<BundleSlot[]>(() =>
    BUNDLE_SLOT_SHAPES.map((_, i) => defaultSlot(i)),
  );
  const [customHex, setCustomHex] = useState('#c9932b');
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSlot = (index: number, patch: Partial<BundleSlot>) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  /** Apply one soap's theme (scent + base + color + botanical) to all 5 slots. */
  const applyThemeToAll = (fromIndex: number) => {
    const { scent, base, color, botanical } = slots[fromIndex];
    setSlots((prev) =>
      prev.map((s, i) =>
        i === fromIndex ? s : { ...s, scent, base, color, botanical },
      ),
    );
    track(ANALYTICS_EVENT_NAMES.bundleSlotConfigured, {
      via: 'theme_apply',
      slot_index: fromIndex,
      shape: slots[fromIndex].shape,
      base: slots[fromIndex].base,
      scent_path: slots[fromIndex].scent.type,
      botanical: slots[fromIndex].botanical,
      color: slots[fromIndex].color,
    });
  };

  const handleAddBundle = () => {
    setError(null);
    // Natural/Clear on a non-translucent base cannot be submitted:
    // validation happens server-side; mirror the guard here for UX.
    const badSlot = slots.find((s) => {
      const color = SOAP_COLORS.find((c) => c.id === s.color);
      const base = SOAP_BASES.find((b) => b.id === s.base);
      return color?.requiresTranslucentBase && base && !base.translucent;
    });
    if (badSlot) {
      setError(
        `Slot ${badSlot.slot_index + 1}: Natural / Clear requires a translucent base (Botanical Glycerin + Castor Oil).`,
      );
      return;
    }
    setBundle({ bundle_id: BUNDLE_ID, slots });
    setAdded(true);
    track(ANALYTICS_EVENT_NAMES.bundleAddedToCart, {
      bundle_id: BUNDLE_ID,
      price_cents: BUNDLE_PRICE_CENTS,
      savings_cents: bundleSavingsCents(),
      slot_count: slots.length,
      slots: slots.map((s) => ({
        slot_index: s.slot_index,
        shape: s.shape,
        base: s.base,
        scent_path: s.scent.type,
        ...(s.scent.type === 'signature'
          ? { recipe_id: s.scent.recipe_id }
          : { oils: s.scent.oils, oil_count: s.scent.oils.length }),
        botanical: s.botanical,
        color: s.color,
      })),
    });
  };

  const componentSum = bundleComponentSumCents();
  const savings = bundleSavingsCents();

  return (
    <div>
      <h2>Configure all five soaps</h2>
      <p>
        {BUNDLE_NAME} — <strong>{formatPrice(BUNDLE_PRICE_CENTS)}</strong>{' '}
        (individual value {formatPrice(componentSum)} — you save {formatPrice(savings)})
      </p>
      <p>
        <small>
          Signature scents are proposed and pending final approval. Every
          customization is preserved in your cart and order record.
        </small>
      </p>

      {slots.map((slot, i) => {
        const shape = getShape(slot.shape)!;
        const base = SOAP_BASES.find((b) => b.id === slot.base)!;
        const availableColors = SOAP_COLORS.filter(
          (c) => !c.requiresTranslucentBase || base.translucent,
        );
        // Owner-approved custom colors (`custom#RRGGBB`) are valid on any base.
        const isCustom = slot.color.startsWith('custom#');
        const effectiveColor =
          isCustom || availableColors.some((c) => c.id === slot.color)
            ? slot.color
            : 'amber-gold';
        const colorName = isCustom
          ? `Custom (#${effectiveColor.slice(7)})`
          : (SOAP_COLORS.find((c) => c.id === effectiveColor)?.name ?? effectiveColor);
        return (
          <section key={i} aria-label={`Slot ${i + 1}: ${shape.name}`}>
            <h3>
              Soap {i + 1} of 5 — {shape.name} ({shape.weightOz} oz,{' '}
              {formatPrice(shape.priceCents)} individually)
            </h3>

            <fieldset>
              <legend>Base</legend>
              {SOAP_BASES.map((b) => (
                <label key={b.id}>
                  <input
                    type="radio"
                    name={`bundle-${i}-base`}
                    checked={slot.base === b.id}
                    onChange={() =>
                      updateSlot(i, { base: b.id as Customization['base'] })
                    }
                  />
                  {b.name}
                </label>
              ))}
            </fieldset>

            <ScentPathPicker
              value={slot.scent}
              onChange={(scent) => updateSlot(i, { scent })}
              slotIndex={i}
              idPrefix={`bundle-${i}`}
            />

            <fieldset>
              <legend>Botanical</legend>
              <label>
                <input
                  type="radio"
                  name={`bundle-${i}-botanical`}
                  checked={slot.botanical === null}
                  onChange={() => updateSlot(i, { botanical: null })}
                />
                None
              </label>
              {BOTANICALS.map((b) => (
                <label key={b.id}>
                  <input
                    type="radio"
                    name={`bundle-${i}-botanical`}
                    checked={slot.botanical === b.id}
                    onChange={() => updateSlot(i, { botanical: b.id })}
                  />
                  {b.name}
                </label>
              ))}
            </fieldset>

            <fieldset>
              <legend>Color</legend>
              {availableColors.map((c) => (
                <label key={c.id}>
                  <input
                    type="radio"
                    name={`bundle-${i}-color`}
                    checked={effectiveColor === c.id}
                    onChange={() => updateSlot(i, { color: c.id })}
                  />
                  <span
                    style={{
                      display: 'inline-block',
                      width: '1em',
                      height: '1em',
                      backgroundColor: c.hex,
                      border: '1px solid #999',
                    }}
                    aria-hidden="true"
                  />{' '}
                  {c.name}
                </label>
              ))}
              <label>
                <input
                  type="radio"
                  name={`bundle-${i}-color`}
                  checked={isCustom}
                  onChange={() => updateSlot(i, { color: `custom#${customHex.slice(1)}` })}
                />
                Custom color{' '}
                <input
                  type="color"
                  aria-label={`Custom color picker for slot ${i + 1}`}
                  value={isCustom ? `#${effectiveColor.slice(7)}` : customHex}
                  onChange={(e) => {
                    setCustomHex(e.target.value);
                    updateSlot(i, { color: `custom#${e.target.value.slice(1)}` });
                  }}
                />
              </label>
            </fieldset>

            <p>
              <small>
                Slot {i + 1} readout: {base.name} · {scentLabel(slot.scent)} ·{' '}
                {slot.botanical
                  ? BOTANICALS.find((b) => b.id === slot.botanical)?.name
                  : 'no botanical'}{' '}
                · {colorName}
              </small>
            </p>
            <button type="button" onClick={() => applyThemeToAll(i)}>
              Apply this theme to all 5
            </button>
          </section>
        );
      })}

      <div>
        <h3>Bundle summary</h3>
        <p>
          5 soaps, individually {formatPrice(componentSum)} — bundle{' '}
          <strong>{formatPrice(BUNDLE_PRICE_CENTS)}</strong> (preview). Savings:{' '}
          {formatPrice(savings)}.
        </p>
        <button type="button" onClick={handleAddBundle}>
          Add {BUNDLE_NAME} to Cart
        </button>
        {error ? <p role="alert">{error}</p> : null}
        {added ? (
          <p>
            Bundle added to your cart. <a href="/cart">Review cart</a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
