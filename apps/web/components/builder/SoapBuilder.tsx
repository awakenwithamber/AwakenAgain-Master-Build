'use client';
/**
 * "Create Your Own Alchemy Soap" — the six-step creation ritual.
 *
 * Client island (the page shell stays a Server Component). Implements:
 *  - Step 1 Choose Base → 2 Choose Shape → 3 Choose Scent → 4 Add Botanical
 *    → 5 Choose Color → 6 Reveal "Your Alchemy Is Complete ✨" + summary
 *    before Add to Cart.
 *  - Step 3 = two paths: Amber's Signature Scents (13 PROPOSED recipes) and
 *    Create Your Own Blend (1–3 oils, exact oil IDs in the order record).
 *  - Collection mode (?bundle=1): the shape step is skipped (each slot fixes
 *    its own shape); the completed ritual becomes the theme for the
 *    Alchemy Soap Collection's five slots.
 *
 * Prices shown are PREVIEW (formatPrice). Add to Cart builds the payload via
 * buildCartItem + buildOrderConfiguration — the shared server-authority
 * recompute rejects tampered totals.
 *
 * Analytics: client-owned interaction events from the canonical 19-event
 * contract only, via the typed tracker (inert without a PostHog token).
 * PostHog stays observational — never marked IMPLEMENTED.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCartItem,
  buildOrderConfiguration,
} from '../../lib/cart/validation';
import {
  BOTANICALS,
  SOAP_BASES,
  SOAP_COLORS,
  getBase,
  getBotanical,
  getColor,
} from '../../lib/catalog/oils';
import { SIGNATURE_SCENTS, getScentRecipe } from '../../lib/catalog/scents';
import { SOAP_SHAPES, getShape } from '../../lib/catalog/shapes';
import { getSeasonalFeature } from '../../lib/catalog/seasonal';
import { formatPrice } from '../../lib/pricing/pricing';
import { track, trackOnce } from '../../lib/analytics/posthog';
import { ANALYTICS_EVENT_NAMES } from '../../lib/analytics/events';
import type {
  Customization,
  OrderConfiguration,
  SoapBaseId,
} from '../../types';
import { WavePreview } from './WavePreview';
import { ScentStep } from './ScentStep';
import { BundleConfigurator } from './BundleConfigurator';
import { BUILDER_CSS } from './shared/builder-styles';
import { useCart } from '../checkout/cart-store';
import {
  BASE_HINTS,
  BUNDLE_MODE_STEPS,
  SINGLE_MODE_STEPS,
  STEP_HEADLINES,
  STEP_HINTS,
  STEP_LABELS,
  STEP_SUBS,
  blendReadout,
  canReachStep,
  colorAllowedForBase,
  colorLabel,
  defaultSelections,
  encodeCustomColor,
  isCustomColorId,
  makerNotes,
  scentLabel,
  scentSelectionOf,
  stepComplete,
  suggestedBotanicalForRecipe,
  themeFromSelections,
  toggleBlendOil,
  type BuilderMode,
  type BuilderSelections,
  type RitualStepKey,
  type ScentPath,
} from './state';

export interface SoapBuilderProps {
  mode: BuilderMode;
}

function isMeaningfulSafety(safety: string): boolean {
  return !!safety && !/no major flags/i.test(safety);
}

export function SoapBuilder({ mode }: SoapBuilderProps) {
  const steps = mode === 'bundle' ? BUNDLE_MODE_STEPS : SINGLE_MODE_STEPS;
  const { addItem } = useCart();
  const [sel, setSel] = useState<BuilderSelections>(defaultSelections);
  const [stepKey, setStepKey] = useState<RitualStepKey>(steps[0] ?? 'base');
  const [qty, setQty] = useState(1);
  const [customHex, setCustomHex] = useState('#8a5a9e');
  const [result, setResult] = useState<OrderConfiguration | null>(null);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const seasonal = useMemo(() => {
    const d = new Date();
    return getSeasonalFeature(d.getMonth() + 1, d.getFullYear()) ?? null;
  }, []);

  // Focus the step heading on navigation (screen-reader + keyboard users).
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepKey]);

  useEffect(() => {
    if (mode === 'bundle') {
      // trackOnce, not track: effects re-run under StrictMode (dev) and on
      // remount — bundle_opened must fire exactly once per builder session.
      trackOnce(`bundle_opened_${mode}`, ANALYTICS_EVENT_NAMES.bundleOpened, {});
    }
  }, [mode]);

  const goStep = (key: RitualStepKey) => {
    if (!canReachStep(key, sel, mode)) return;
    setStepKey(key);
    setError(null);
    const idx = steps.indexOf(key);
    track(ANALYTICS_EVENT_NAMES.builderStepViewed, {
      step: idx + 1,
      step_name: key,
    });
    if (key === 'reveal') {
      trackOnce(`ritual_completed_${mode}`, ANALYTICS_EVENT_NAMES.ritualCompleted, {});
    }
  };

  /* ---------------- selection handlers (analytics fire here, never in render) ---------------- */

  const selectBase = (id: SoapBaseId) => {
    setSel((s) => {
      let color = s.color;
      if (color && !colorAllowedForBase(id, color)) color = null;
      return { ...s, base: id, color };
    });
    track(ANALYTICS_EVENT_NAMES.baseSelected, { base: id });
  };

  const selectShape = (id: string) => {
    setSel((s) => ({ ...s, shape: id }));
    track(ANALYTICS_EVENT_NAMES.shapeSelected, { shape: id });
  };

  const changeScentPath = (path: ScentPath) =>
    setSel((s) => ({ ...s, scentPath: path }));

  const selectSignature = (id: string) => {
    const recipe = getScentRecipe(id);
    if (!recipe) return;
    setSel((s) => ({ ...s, signatureId: id }));
    track(ANALYTICS_EVENT_NAMES.scentSelected, {
      path: 'signature',
      recipe_id: id,
    });
  };

  const selectSeasonal = () => {
    if (!seasonal) return;
    track(ANALYTICS_EVENT_NAMES.seasonalScentInteracted, {
      season_id: seasonal.id,
    });
  };

  const toggleOil = (id: string) => {
    setSel((s) => ({ ...s, blendOils: toggleBlendOil(s.blendOils, id) }));
  };

  const selectBotanical = (id: string) => {
    setSel((s) => ({ ...s, botanical: id }));
    track(ANALYTICS_EVENT_NAMES.botanicalSelected, { botanical: id });
  };

  const selectColor = (id: string) => {
    setSel((s) => ({ ...s, color: id }));
    const custom = isCustomColorId(id);
    track(ANALYTICS_EVENT_NAMES.colorSelected, {
      color_name: custom ? `Custom color ${id.slice('custom#'.length).toUpperCase()}` : (getColor(id)?.name ?? id),
      color_hex: custom ? `#${id.slice('custom#'.length)}` : (getColor(id)?.hex ?? ''),
      custom,
    });
  };

  const applyCustomColor = (hex: string) => {
    setCustomHex(hex);
    try {
      selectColor(encodeCustomColor(hex));
    } catch {
      /* invalid hex from the native picker — ignore */
    }
  };

  /* ---------------- derived display state ---------------- */

  const scentCaption = useMemo(() => {
    const scent = scentSelectionOf(sel);
    if (!scent) return '';
    if (scent.type === 'signature') {
      const r = getScentRecipe(scent.recipe_id);
      return r ? `Scented with ${r.name} — ${r.oils.join(', ').toLowerCase()}` : '';
    }
    const names = blendReadout(scent.oils).names;
    return names.length > 0 ? `Your Alchemy Blend — ${names.join(' + ')}` : '';
  }, [sel]);

  const suggestedBotanical =
    sel.scentPath === 'signature' && sel.signatureId
      ? suggestedBotanicalForRecipe(sel.signatureId)
      : null;

  const visibleColors = useMemo(
    () =>
      SOAP_COLORS.filter(
        (c) => sel.base === null || colorAllowedForBase(sel.base, c.id),
      ),
    [sel.base],
  );
  const naturalClearHidden =
    sel.base !== null && !colorAllowedForBase(sel.base, 'natural-clear');

  /* ---------------- add to cart ---------------- */

  const addToCart = () => {
    setError(null);
    setResult(null);
    setAdded(false);
    try {
      const scent = scentSelectionOf(sel);
      if (!sel.base || !sel.shape || !scent || !sel.color) {
        throw new Error('Your ritual is not complete yet.');
      }
      const customization: Customization = {
        base: sel.base,
        shape: sel.shape,
        scent,
        botanical: sel.botanical,
        color: sel.color,
      };
      const item = buildCartItem('custom-alchemy-soap', customization, qty);
      // The shared server-authority recompute: any tampered total is rejected here.
      const order = buildOrderConfiguration([item], undefined, 0);
      // THE cart store is the single cart source — this is what actually
      // puts the creation in the customer's cart (legacy bug: builder
      // payloads never reached checkout). The server reprices authoritatively.
      const added = addItem('custom-alchemy-soap', undefined, customization, qty);
      if (!added) {
        throw new Error('Could not add your creation to the cart. Please try again.');
      }
      setAdded(true);
      setResult(order);
      track(ANALYTICS_EVENT_NAMES.soapAddedToCart, {
        base: sel.base,
        shape: sel.shape,
        scent,
        botanical: sel.botanical,
        color: sel.color,
        bundle_mode: mode === 'bundle',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the order payload.');
    }
  };

  const startNew = () => {
    setSel(defaultSelections());
    setStepKey(steps[0] ?? 'base');
    setQty(1);
    setResult(null);
    setAdded(false);
    setError(null);
  };

  /* ---------------- step panels ---------------- */

  const theme = themeFromSelections(sel);
  const themeKey = theme ? JSON.stringify(theme) : 'none';

  const renderStepPanel = () => {
    switch (stepKey) {
      case 'base':
        return (
          <div className="pick-grid bases">
            {SOAP_BASES.map((b) => (
              <button
                key={b.id}
                type="button"
                className="pick"
                aria-pressed={sel.base === b.id}
                onClick={() => selectBase(b.id)}
              >
                <span className="p-name">{b.name}</span>
                <span className="p-sub">{b.description}</span>
                <span className="p-hint">{BASE_HINTS[b.id]}</span>
              </button>
            ))}
          </div>
        );
      case 'shape':
        return (
          <div>
            <p className="blend-hint">
              Shapes render small → large, true to size: the Medium Rose is
              visibly larger than the Small Rose and smaller than the large bars.
            </p>
            <div className="pick-grid">
              {SOAP_SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="pick"
                  aria-pressed={sel.shape === s.id}
                  onClick={() => selectShape(s.id)}
                >
                  <span className="p-name">{s.name}</span>
                  <span className="p-sub">{s.weightOz} oz</span>
                  <span className="p-price">{formatPrice(s.priceCents)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 'scent':
        return (
          <ScentStep
            scentPath={sel.scentPath}
            signatureId={sel.signatureId}
            blendOils={sel.blendOils}
            seasonal={seasonal}
            onPathChange={changeScentPath}
            onSignatureSelect={selectSignature}
            onToggleOil={toggleOil}
            onSeasonalSelect={selectSeasonal}
          />
        );
      case 'botanical':
        return (
          <div>
            {suggestedBotanical && (
              <p className="blend-hint">
                Pairs beautifully with your scent:{' '}
                <strong className="gold">
                  {getBotanical(suggestedBotanical)?.name}
                </strong>{' '}
                — or follow your own nose.
              </p>
            )}
            <div className="pick-grid">
              {BOTANICALS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="pick"
                  aria-pressed={sel.botanical === b.id}
                  onClick={() => selectBotanical(b.id)}
                >
                  <span className="p-name">{b.name}</span>
                  <span className="p-sub">{b.role}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 'color':
        return (
          <div>
            {naturalClearHidden && (
              <p className="blend-hint">
                <strong className="gold">Natural / Clear</strong> needs a
                translucent bar to read as clear — it only appears with the
                Botanical Glycerin + Castor Oil base.
              </p>
            )}
            <div
              className="color-grid"
              role="group"
              aria-label="Color swatches"
            >
              {visibleColors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="color-btn"
                  aria-pressed={sel.color === c.id}
                  aria-label={c.name}
                  title={c.name}
                  onClick={() => selectColor(c.id)}
                  style={{ background: c.hex }}
                />
              ))}
              <label
                className="color-btn custom"
                title="Custom color"
                aria-label="Choose a custom color"
              >
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => applyCustomColor(e.target.value)}
                  aria-label="Choose a custom color"
                />
              </label>
            </div>
            <p className="color-name" aria-live="polite">
              {sel.color ? colorLabel(sel.color) : 'No color chosen yet'}
            </p>
            <p className="color-note">
              Colored with food-derived dyes — safe, vibrant, and kind to skin.
              {sel.base === 'double-layer' &&
                ' Color tints the clear top layer; the goat-milk bottom stays creamy white.'}
            </p>
          </div>
        );
      case 'reveal':
        return renderReveal();
    }
  };

  const renderReveal = () => {
    if (mode === 'bundle') {
      if (!theme) return null;
      const scent = theme.scent;
      return (
        <div className="reveal">
          <h3 className="summary-title">Your theme</h3>
          <dl className="summary">
            <dt>Base</dt>
            <dd>{getBase(theme.base)?.name}</dd>
            <dt>Scent</dt>
            <dd>{scentLabel(scent)}</dd>
            <dt>Botanical</dt>
            <dd>{getBotanical(theme.botanical)?.name}</dd>
            <dt>Color</dt>
            <dd>{colorLabel(theme.color)}</dd>
          </dl>
          <BundleConfigurator key={themeKey} theme={theme} seasonal={seasonal} />
          <p>
            <button type="button" className="btn ghost" onClick={startNew}>
              Start a new creation
            </button>
          </p>
        </div>
      );
    }

    const shape = sel.shape ? getShape(sel.shape) : undefined;
    const base = sel.base ? getBase(sel.base) : undefined;
    const scent = scentSelectionOf(sel);
    const recipe =
      scent?.type === 'signature' ? getScentRecipe(scent.recipe_id) : undefined;
    const safety = recipe?.safety;
    if (!shape || !base || !scent || !sel.color) return null;

    return (
      <div className="reveal">
        <dl className="summary" role="status" aria-label="Your creation summary">
          <dt>Base</dt>
          <dd>{base.name}</dd>
          <dt>Shape</dt>
          <dd>
            {shape.name} — {shape.weightOz} oz
          </dd>
          <dt>Scent</dt>
          <dd>{scentLabel(scent)}</dd>
          <dt>Botanical</dt>
          <dd>{sel.botanical ? getBotanical(sel.botanical)?.name : '—'}</dd>
          <dt>Color</dt>
          <dd>{colorLabel(sel.color)}</dd>
          <dt>Price (preview)</dt>
          <dd className="price">{formatPrice(shape.priceCents)}</dd>
        </dl>
        {safety && isMeaningfulSafety(safety) && (
          <p className="safety-note">Note: {safety}</p>
        )}
        <p className="hint">
          Hand-poured to order by Amber in Salt Lake City. Please allow 3–5
          business days for your soap to be crafted and cured before shipping.
        </p>
        <p className="maker-notes">
          <strong>Maker notes:</strong>{' '}
          {makerNotes({
            base: sel.base as SoapBaseId,
            shape: sel.shape as string,
            scent,
            botanical: sel.botanical,
            color: sel.color as string,
          })}
        </p>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        {added && (
          <p role="status" className="cart-confirm">
            ✨ Your creation is in your cart —{' '}
            <a href="/cart">review your cart</a> or{' '}
            <a href="/checkout">head to checkout</a>.
          </p>
        )}

        <div className="cart-row">
          <label className="qty-label">
            Qty{' '}
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) =>
                setQty(Math.max(1, parseInt(e.target.value, 10) || 1))
              }
              aria-label="Quantity"
            />
          </label>
          <button type="button" className="btn" onClick={addToCart}>
            Add to Cart — {formatPrice(shape.priceCents)}
          </button>
        </div>
        <p>
          <button type="button" className="btn ghost" onClick={startNew}>
            Start a new creation
          </button>
        </p>

        {result && (
          <details className="payload">
            <summary>Order payload (what the maker receives)</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
            <p className="hint">
              Totals are recomputed server-side at checkout — the browser never
              sets the final price.
            </p>
          </details>
        )}
      </div>
    );
  };

  const complete = stepKey === 'reveal' ? true : stepComplete(stepKey, sel);
  const stepIndex = steps.indexOf(stepKey);

  return (
    <div className="builder-root">
      <style>{BUILDER_CSS}</style>
      <header className="builder-header">
        <a className="brand" href="/soap-shop">
          Amber's Alchemy Apothecary
        </a>
        <nav className="nav" aria-label="Soap builder">
          <a href="/soap-shop">Soap Shop</a>
          <a href="/soap-builder?bundle=1">Collection</a>
        </nav>
      </header>

      <div className="wrap">
        <nav className="progress" aria-label="Creation ritual progress">
          <ol>
            {steps.map((key, i) => {
              const done = i < stepIndex;
              const now = key === stepKey;
              return (
                <li key={key} className={done ? 'done' : now ? 'now' : ''}>
                  {done ? (
                    <button
                      type="button"
                      className="progress-btn"
                      onClick={() => goStep(key)}
                      aria-label={`Go back to ${STEP_LABELS[key]}`}
                    >
                      <span className="n" aria-hidden="true">
                        ✓
                      </span>
                      <span>{STEP_LABELS[key]}</span>
                    </button>
                  ) : (
                    <span aria-current={now ? 'step' : undefined}>
                      <span className="n" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span>{STEP_LABELS[key]}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {mode === 'bundle' && (
          <div className="bundle-banner" role="note">
            <strong>Collection mode</strong> — design one theme through the
            ritual; it will be applied to all five bars, and you can edit each
            bar individually before adding the collection to your cart.
          </div>
        )}

        <div className="builder">
          <section className="step-panel" aria-labelledby="step-heading">
            <h2 id="step-heading" ref={headingRef} tabIndex={-1}>
              {STEP_HEADLINES[stepKey]}
            </h2>
            <p className="sub">{STEP_SUBS[stepKey]}</p>
            {renderStepPanel()}
            {stepKey !== 'reveal' && (
              <div className="step-nav">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => goStep(steps[stepIndex - 1] as RitualStepKey)}
                  >
                    Back
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="btn"
                  disabled={!complete}
                  onClick={() => goStep(steps[stepIndex + 1] as RitualStepKey)}
                >
                  Continue
                </button>
              </div>
            )}
            {stepKey !== 'reveal' && !complete && (
              <p className="hint">{STEP_HINTS[stepKey as keyof typeof STEP_HINTS]}</p>
            )}
            {stepKey === 'reveal' && stepIndex > 0 && mode === 'single' && (
              <div className="step-nav">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => goStep(steps[stepIndex - 1] as RitualStepKey)}
                >
                  Back
                </button>
                <span />
              </div>
            )}
          </section>

          <aside className="preview-panel" aria-label="Live soap preview">
            <h3>Live Preview</h3>
            <WavePreview
              base={sel.base}
              colorId={sel.color}
              botanicalId={sel.botanical}
              scentCaption={scentCaption}
            />
          </aside>
        </div>

        <footer className="builder-footer">
          <p>
            Prices are displayed for convenience — all order totals are
            recomputed server-side at checkout.
          </p>
        </footer>
      </div>
    </div>
  );
}
