/**
 * Individual soap customizer for product detail pages (Soaps category).
 * 6-step ritual: Base → Shape → Scent (two paths) → Botanical → Color → Reveal.
 * Natural/Clear stays restricted to translucent bases — the restriction is
 * enforced from DATA (ColorOption.requiresTranslucentBase ×
 * SoapBase.translucent); the UI mirrors the same data.
 */
'use client';

import { useMemo, useState } from 'react';
import { BOTANICALS, SOAP_BASES, SOAP_COLORS } from '../../lib/catalog/oils';
import { SOAP_SHAPES, getShape } from '../../lib/catalog/shapes';
import { getScentRecipe } from '../../lib/cart/validation';
import { formatPrice } from '../../lib/pricing/pricing';
import { track } from '../../lib/analytics/posthog';
import { ANALYTICS_EVENT_NAMES } from '../../lib/analytics/events';
import { useCart } from '../checkout/cart-store';
import { ScentPathPicker } from './ScentPathPicker';
import type { Customization, Product, ScentSelection } from '../../types';

interface Props {
  product: Product;
}

/** Resolve the shapes this soap product actually offers (from its variants). */
function productShapeIds(product: Product): string[] {
  const fromVariants = (product.variants ?? [])
    .map((v) => {
      const label = String(v.shape ?? v.name ?? '').toLowerCase();
      return SOAP_SHAPES.find(
        (s) =>
          s.name.toLowerCase() === label ||
          String(v.variant_id ?? '').includes(s.id),
      )?.id;
    })
    .filter((id): id is string => !!id);
  return fromVariants.length > 0 ? [...new Set(fromVariants)] : SOAP_SHAPES.map((s) => s.id);
}

export function SoapCustomizer({ product }: Props) {
  const { addItem } = useCart();
  const shapeIds = useMemo(() => productShapeIds(product), [product]);

  const [base, setBase] = useState<Customization['base']>('double-layer');
  const [shape, setShape] = useState<string>(shapeIds[0] ?? 'wave-rectangle');
  const [scent, setScent] = useState<ScentSelection>({
    type: 'signature',
    recipe_id: 'SCENT_RECIPE_01',
  });
  const [botanical, setBotanical] = useState<string | null>(null);
  const [color, setColor] = useState<string>('amber-gold');
  const [customHex, setCustomHex] = useState('#c9932b');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBase = SOAP_BASES.find((b) => b.id === base)!;
  const selectedShape = getShape(shape);

  const availableColors = useMemo(
    () =>
      SOAP_COLORS.filter(
        (c) => !c.requiresTranslucentBase || selectedBase.translucent,
      ),
    [selectedBase],
  );

  // Owner-approved custom colors (`custom#RRGGBB`) are valid on any base.
  const isCustomColorId = (id: string) => id.startsWith('custom#');
  const effectiveColor =
    isCustomColorId(color) || availableColors.some((c) => c.id === color)
      ? color
      : 'amber-gold';
  const colorDisplayName = isCustomColorId(effectiveColor)
    ? `Custom (#${effectiveColor.slice(7)})`
    : (SOAP_COLORS.find((c) => c.id === effectiveColor)?.name ?? effectiveColor);

  const selectColor = (id: string, hex: string, custom: boolean) => {
    setColor(id);
    track(ANALYTICS_EVENT_NAMES.colorSelected, {
      color_name: custom ? 'Custom' : (SOAP_COLORS.find((c) => c.id === id)?.name ?? id),
      color_hex: hex,
      custom,
    });
  };

  const previewCents = selectedShape ? selectedShape.priceCents : 0;
  const recipe =
    scent.type === 'signature' ? getScentRecipe(scent.recipe_id) : null;

  const handleAdd = () => {
    setError(null);
    const customization: Customization = {
      base,
      shape,
      scent,
      botanical,
      color: effectiveColor,
    };
    const ok = addItem(product.handle, undefined, customization, quantity);
    if (!ok) {
      setError('Could not add to cart — the selection did not validate. Please check your choices.');
      return;
    }
    setAdded(true);
    track(ANALYTICS_EVENT_NAMES.soapAddedToCart, {
      base,
      shape,
      scent,
      botanical,
      color: effectiveColor,
      bundle_mode: false,
    });
  };

  return (
    <div>
      <h2>Customize your soap</h2>

      <fieldset>
        <legend>Step 1 — Base</legend>
        {SOAP_BASES.map((b) => (
          <label key={b.id}>
            <input
              type="radio"
              name="soap-base"
              checked={base === b.id}
              onChange={() => {
                setBase(b.id);
                track(ANALYTICS_EVENT_NAMES.baseSelected, { base: b.id });
              }}
            />
            <strong>{b.name}</strong> — {b.description}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Step 2 — Shape</legend>
        {shapeIds.map((id) => {
          const s = getShape(id)!;
          return (
            <label key={id}>
              <input
                type="radio"
                name="soap-shape"
                checked={shape === id}
                onChange={() => {
                  setShape(id);
                  track(ANALYTICS_EVENT_NAMES.shapeSelected, { shape: id });
                }}
              />
              <strong>{s.name}</strong> — {s.weightOz} oz — {formatPrice(s.priceCents)}
            </label>
          );
        })}
      </fieldset>

      <div>
        <h3>Step 3 — Scent</h3>
        <ScentPathPicker value={scent} onChange={setScent} idPrefix={product.handle} />
        {recipe ? (
          <p>
            <small>
              Chosen: {recipe.name}. {recipe.safety}
            </small>
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend>Step 4 — Botanical (one per soap)</legend>
        <label>
          <input
            type="radio"
            name="soap-botanical"
            checked={botanical === null}
            onChange={() => setBotanical(null)}
          />
          None
        </label>
        {BOTANICALS.map((b) => (
          <label key={b.id}>
            <input
              type="radio"
              name="soap-botanical"
              checked={botanical === b.id}
              onChange={() => {
                setBotanical(b.id);
                track(ANALYTICS_EVENT_NAMES.botanicalSelected, { botanical: b.id });
              }}
            />
            {b.name} <small>— {b.role}</small>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Step 5 — Color</legend>
        <p>
          <small>
            Natural / Clear is only offered on translucent bases (Botanical Glycerin
            + Castor Oil). Food-derived dyes.
          </small>
        </p>
        {availableColors.map((c) => (
          <label key={c.id}>
            <input
              type="radio"
              name="soap-color"
              checked={effectiveColor === c.id}
              onChange={() => selectColor(c.id, c.hex, false)}
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
            name="soap-color"
            checked={isCustomColorId(effectiveColor)}
            onChange={() => selectColor(`custom#${customHex.slice(1)}`, customHex, true)}
          />
          Custom color{' '}
          <input
            type="color"
            aria-label="Custom color picker"
            value={customHex}
            onChange={(e) => {
              setCustomHex(e.target.value);
              selectColor(`custom#${e.target.value.slice(1)}`, e.target.value, true);
            }}
          />
          <small> food-derived dye, valid on any base</small>
        </label>
      </fieldset>

      <div>
        <h3>Your Alchemy Is Complete ✨</h3>
        <ul>
          <li>Base: {selectedBase.name}</li>
          <li>
            Shape: {selectedShape?.name} ({selectedShape?.weightOz} oz)
          </li>
          <li>
            Scent:{' '}
            {scent.type === 'signature'
              ? recipe?.name
              : `Custom blend: ${scent.oils.join(' + ')}`}
          </li>
          <li>
            Botanical: {botanical ? BOTANICALS.find((b) => b.id === botanical)?.name : 'None'}
          </li>
          <li>Color: {colorDisplayName}</li>
          <li>
            Price per bar (preview): <strong>{formatPrice(previewCents)}</strong>
          </li>
        </ul>
        <label>
          Quantity
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <button type="button" onClick={handleAdd}>
          Add to Cart — {formatPrice(previewCents * quantity)} (preview)
        </button>
        {error ? <p role="alert">{error}</p> : null}
        {added ? (
          <p>
            Added to your cart. <a href="/cart">Review cart</a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
