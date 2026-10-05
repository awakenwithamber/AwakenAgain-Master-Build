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

const BUILDER_CSS = `
.builder-root{--bg:#140b26;--bg2:#1c1133;--surface:#221741;--surface2:#2a1c4e;--gold:#c9a24b;--gold-soft:#e3c87e;--gold-dim:#8a6f35;--cream:#f5eedc;--cream-dim:#d9cdb2;--muted:#b3a3d6;--radius:14px;background:var(--bg);color:var(--cream);font-family:"Segoe UI",system-ui,-apple-system,sans-serif;line-height:1.6;min-height:100vh}
.builder-root h1,.builder-root h2,.builder-root h3,.builder-root h4{font-family:Georgia,serif;font-weight:600;line-height:1.3}
.builder-root .wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.builder-header{position:sticky;top:0;z-index:50;background:rgba(20,11,38,.94);backdrop-filter:blur(8px);border-bottom:1px solid rgba(201,162,75,.25)}
.builder-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px}
.builder-root .brand{font-family:Georgia,serif;font-size:1.2rem;color:var(--gold-soft);text-decoration:none}
.builder-root .nav{display:flex;gap:16px}
.builder-root .nav a{color:var(--cream-dim);text-decoration:none;font-size:.92rem}
.progress{padding:22px 0 6px}
.progress ol{display:flex;list-style:none;justify-content:center;gap:4px;flex-wrap:wrap;padding:0}
.progress li{display:flex;align-items:center;font-size:.82rem;color:var(--muted);padding:8px 10px;border-radius:999px;border:1px solid transparent}
.progress .n{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--gold-dim);display:inline-flex;align-items:center;justify-content:center;font-size:.78rem;margin-right:8px;flex:none}
.progress li.done{color:var(--cream-dim)}
.progress li.done .n{background:var(--gold);border-color:var(--gold);color:#1c1133;font-weight:700}
.progress li.now{color:var(--gold-soft);border-color:rgba(201,162,75,.5);background:rgba(201,162,75,.08)}
.progress li.now .n{border-color:var(--gold-soft);box-shadow:0 0 10px rgba(201,162,75,.6)}
.progress-btn{background:none;border:none;color:inherit;font:inherit;cursor:pointer;display:flex;align-items:center;padding:0}
.progress-btn:focus-visible,.builder-root button:focus-visible,.builder-root input:focus-visible,.builder-root select:focus-visible,.builder-root a:focus-visible{outline:2px solid var(--gold-soft);outline-offset:2px}
.bundle-banner{background:linear-gradient(135deg,rgba(201,162,75,.18),rgba(201,162,75,.05));border:1.5px solid var(--gold);border-radius:var(--radius);padding:16px;margin-bottom:20px;text-align:center}
.builder{display:grid;gap:26px;grid-template-columns:1fr;padding:26px 0 60px}
@media(min-width:960px){.builder{grid-template-columns:1.35fr .9fr;align-items:start}}
.step-panel{background:var(--surface);border:1px solid rgba(201,162,75,.22);border-radius:18px;padding:28px;min-height:420px}
.step-panel h2{font-size:clamp(1.4rem,3.5vw,1.9rem);color:var(--gold-soft);margin-bottom:6px}
.step-panel h2:focus{outline:none}
.step-panel .sub{color:var(--muted);font-size:.95rem;margin-bottom:20px}
.preview-panel{position:sticky;top:86px;background:var(--bg2);border:1px solid rgba(201,162,75,.25);border-radius:18px;padding:22px;text-align:center}
@media(max-width:959px){.preview-panel{position:static;order:-1}}
.preview-panel h3{color:var(--gold-soft);margin-bottom:8px;font-size:1.05rem}
.preview-panel svg{width:100%;max-width:340px;margin:0 auto;display:block}
.preview-cap{font-size:.82rem;color:var(--muted);margin-top:10px}
.scent-caption{margin-top:10px;font-size:.95rem;color:var(--gold-soft);font-family:Georgia,serif;font-style:italic;min-height:1.6em}
.pick-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.pick-grid.bases{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}
.pick-grid.compact{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}
.pick{position:relative;background:var(--surface2);border:2px solid rgba(201,162,75,.2);border-radius:var(--radius);padding:16px 12px;cursor:pointer;text-align:center;color:var(--cream);font-family:inherit;font-size:.92rem;transition:border-color .15s,transform .15s;display:flex;flex-direction:column;gap:6px;min-height:44px}
.pick:hover{border-color:rgba(201,162,75,.6);transform:translateY(-2px)}
.pick[aria-pressed="true"]{border-color:var(--gold-soft);box-shadow:0 0 0 2px rgba(227,200,126,.35),0 6px 18px rgba(0,0,0,.4)}
.pick:disabled{opacity:.45;cursor:not-allowed;transform:none}
.pick .p-name{font-weight:700;color:var(--cream)}
.pick .p-sub{font-size:.8rem;color:var(--muted)}
.pick .p-hint{font-size:.8rem;color:var(--gold-soft)}
.pick .p-price{color:var(--gold-soft);font-weight:700;margin-top:4px}
.pick.scent{text-align:left;padding:14px}
.pick.scent .p-sens{font-size:.82rem;color:var(--cream-dim);font-style:italic}
.pick.scent .p-safety{font-size:.78rem;color:#e3a87e}
.swatch-mini{height:34px;border-radius:8px;margin-bottom:8px;border:1px solid rgba(255,255,255,.15);display:block}
.tabs{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
.tab{background:transparent;border:1.5px solid var(--gold-dim);color:var(--cream-dim);border-radius:999px;padding:10px 20px;font-size:.95rem;cursor:pointer;font-family:inherit;min-height:44px}
.tab[aria-selected="true"]{background:rgba(201,162,75,.15);border-color:var(--gold-soft);color:var(--gold-soft);font-weight:700}
.seasonal-card{display:block;width:100%;text-align:left;background:linear-gradient(135deg,rgba(201,162,75,.22),rgba(201,162,75,.06));border:1.5px solid var(--gold);border-radius:var(--radius);padding:16px;margin-bottom:20px;cursor:pointer;color:var(--cream);font-family:inherit}
.seasonal-card .seasonal-badge{display:inline-block;background:var(--gold);color:#1c1133;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;border-radius:999px;padding:3px 10px;margin-bottom:8px}
.seasonal-card .p-name{display:block;font-weight:700;font-size:1.05rem;color:var(--gold-soft)}
.seasonal-card .p-sub{display:block;font-size:.9rem;color:var(--cream-dim);margin-top:4px}
.honesty-note{display:block;font-size:.8rem;color:var(--muted);margin-top:10px;font-style:italic}
.proposed-note{border-left:3px solid var(--gold);padding-left:12px}
.blend-display{background:var(--bg2);border:1px solid rgba(201,162,75,.3);border-radius:var(--radius);padding:16px;margin:16px 0;min-height:90px}
.blend-display h4{color:var(--gold-soft);font-size:1.05rem;margin-bottom:4px}
.blend-display .oils{font-weight:700}
.blend-display .tags{color:var(--muted);font-size:.9rem;margin-top:4px}
.blend-hint{font-size:.85rem;color:var(--muted)}
.blend-hint .gold,.gold{color:var(--gold-soft)}
.oil-chip{display:inline-flex;align-items:center;gap:8px;margin:5px;padding:9px 14px 9px 9px;border-radius:999px;border:1.5px solid rgba(201,162,75,.3);background:var(--surface2);color:var(--cream);cursor:pointer;font-size:.9rem;font-family:inherit;min-height:44px}
.oil-chip .dot{width:24px;height:24px;border-radius:50%;flex:none;border:1px solid rgba(255,255,255,.25);background:radial-gradient(circle at 35% 35%,var(--gold-soft),var(--gold-dim))}
.oil-chip[aria-pressed="true"]{border-color:var(--gold-soft);background:rgba(201,162,75,.15)}
.oil-chip:disabled{opacity:.4;cursor:not-allowed}
.color-grid{display:flex;flex-wrap:wrap;gap:12px}
.color-btn{width:56px;height:56px;border-radius:50%;border:3px solid transparent;cursor:pointer;position:relative;padding:0;min-width:56px;min-height:56px}
.color-btn[aria-pressed="true"]{border-color:var(--gold-soft);box-shadow:0 0 0 3px rgba(227,200,126,.35)}
.color-btn.custom{background:conic-gradient(#B0303C,#E8C95C,#2E7D5B,#3B6EA5,#A78BDA,#B0303C);overflow:hidden}
.color-btn.custom input{opacity:0;width:100%;height:100%;cursor:pointer}
.color-name{text-align:center;margin-top:14px;color:var(--gold-soft);font-weight:700;min-height:1.6em}
.color-note{font-size:.85rem;color:var(--muted);margin-top:10px;text-align:center}
.step-nav{display:flex;justify-content:space-between;gap:12px;margin-top:26px}
.btn{display:inline-block;background:linear-gradient(135deg,var(--gold),#a8823a);color:#1c1133;font-weight:700;text-decoration:none;padding:13px 30px;border-radius:999px;border:none;cursor:pointer;font-size:1rem;font-family:inherit;min-height:44px}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn.ghost{background:transparent;color:var(--gold-soft);border:1.5px solid var(--gold)}
.hint{font-size:.85rem;color:var(--muted);margin-top:10px;text-align:center}
.reveal{text-align:center}
.summary-title{color:var(--gold-soft);margin:18px 0 6px}
.summary{background:var(--bg2);border:1px solid rgba(201,162,75,.3);border-radius:var(--radius);padding:20px;text-align:left;margin:20px 0;font-size:.98rem}
.summary dt{color:var(--gold);font-size:.78rem;text-transform:uppercase;letter-spacing:.12em;margin-top:12px}
.summary dd{margin:2px 0 0;color:var(--cream)}
.summary dd.price{font-size:1.4rem;color:var(--gold-soft);font-weight:800}
.safety-note{color:#e3a87e;font-size:.9rem}
.maker-notes{font-size:.85rem;color:var(--muted);text-align:left;background:rgba(201,162,75,.06);border-radius:10px;padding:12px 16px;margin:16px 0}
.cart-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px;align-items:center}
.qty-label{display:flex;align-items:center;gap:8px;color:var(--cream-dim)}
.qty-label input{width:64px;padding:8px;border-radius:8px;background:var(--surface2);color:var(--cream);border:1px solid var(--gold-dim);font-size:1rem}
details.payload{margin:18px 0;text-align:left}
details.payload summary{cursor:pointer;color:var(--gold-soft)}
details.payload pre{background:#0d0718;border-radius:10px;padding:16px;overflow:auto;font-size:.78rem;color:#cfe3cf;margin-top:10px}
.form-error{color:#e3a87e;font-size:.9rem;margin-top:12px}
.bundle-config h3{color:var(--gold-soft);margin:18px 0 6px}
.bundle-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:14px 0;align-items:center}
.slot-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));margin:16px 0}
.slot{background:var(--bg2);border:1px solid rgba(201,162,75,.25);border-radius:var(--radius);padding:14px;font-size:.88rem;text-align:left}
.slot h4{color:var(--gold-soft);font-size:.95rem;margin-bottom:6px}
.slot p{margin:4px 0}
.slot .tags{color:var(--muted);font-size:.82rem}
.slot button{background:none;border:1px solid var(--gold-dim);color:var(--gold-soft);border-radius:999px;padding:8px 16px;cursor:pointer;font-size:.82rem;margin-top:8px;font-family:inherit;min-height:44px}
.slot-editor label{display:block;font-size:.8rem;color:var(--muted);margin-top:10px}
.slot-editor select{width:100%;margin:4px 0 8px;padding:10px;border-radius:8px;background:var(--surface2);color:var(--cream);border:1px solid var(--gold-dim);font-size:.9rem;min-height:44px}
.slot-editor .pick-grid{margin-top:8px}
.custom-color-row{display:flex!important;align-items:center;gap:10px}
.custom-color-row input{width:44px;height:44px;padding:0;border:none;background:none;cursor:pointer}
.bundle-totals{margin:18px 0}
.price-row{display:flex;justify-content:center;align-items:baseline;gap:14px;margin:14px 0;flex-wrap:wrap}
.price-row .struck{text-decoration:line-through;color:var(--muted)}
.bundle-price{font-size:2rem;font-weight:800;color:var(--gold-soft)}
.save-badge{background:#2E7D5B;color:#fff;font-size:.8rem;font-weight:700;padding:5px 12px;border-radius:999px}
.builder-footer{border-top:1px solid rgba(201,162,75,.25);padding:26px 0;text-align:center;color:var(--muted);font-size:.88rem}
@media(prefers-reduced-motion:reduce){.builder-root *{transition:none!important;animation:none!important}}
`;
