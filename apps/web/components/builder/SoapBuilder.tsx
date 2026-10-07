'use client';
/**
 * "Create Your Own Alchemy Soap" — the six-step creation ritual,
 * presented as a Netlify-style modal.
 *
 * Client island (the page shell stays a Server Component) for
 * Amber's Alchemy Apothecary. Implements:
 *  - Step 1 Choose Base → 2 Choose Shape → 3 Choose Scent → 4 Add Botanical
 *    → 5 Choose Color → 6 Reveal "Your Alchemy Is Complete ✨" + summary
 *    before Add to Cart.
 *  - Step 3 = two paths: Amber's Signature Scents (13 PROPOSED recipes) and
 *    Create Your Own Blend (1–3 oils, exact oil IDs in the order record).
 *  - Collection mode (?bundle=1): the shape step is skipped (each slot fixes
 *    its own shape); the completed ritual becomes the theme for the
 *    Alchemy Soap Collection's five slots.
 *
 * Presentation (Workstream F): full overlay, flex-centered, fade-in 300ms;
 * backdrop click and Escape close (with a confirm when selections exist);
 * numbered progress indicator with active/completed states — completed steps
 * are clickable to revisit without losing selections; rich option cards per
 * step; live preview always on the Large Wave Rectangle canvas; sticky
 * Next/Back bar; the dialog scrolls internally on mobile.
 *
 * Prices shown are PREVIEW (formatPrice). Add to Cart builds the payload via
 * buildCartItem + buildOrderConfiguration — the shared server-authority
 * recompute rejects tampered totals.
 *
 * Analytics: client-owned interaction events from the canonical 19-event
 * contract only, via the typed tracker (inert without a PostHog token).
 * PostHog stays observational — never marked IMPLEMENTED.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { ShapeImage } from './ShapeImage';
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
import styles from './SoapBuilderModal.module.css';

export interface SoapBuilderProps {
  mode: BuilderMode;
}

/** Netlify-style emoji cards for the three bases (presentation only). */
const BASE_ICONS: Record<SoapBaseId, string> = {
  'double-layer': '🌗',
  'goat-milk-shea': '🧈',
  'glycerin-castor': '🫧',
};

/** Netlify-style emoji cards for the nine botanicals (presentation only). */
const BOTANICAL_ICONS: Record<string, string> = {
  'rose-petals': '🌹',
  lavender: '🪻',
  calendula: '🌻',
  chamomile: '🌼',
  hibiscus: '🌺',
  rosemary: '🌿',
  mint: '🍃',
  oatmeal: '🥣',
  cornflower: '💠',
};

function isMeaningfulSafety(safety: string): boolean {
  return !!safety && !/no major flags/i.test(safety);
}

/** True once the customer has made any selection — gates the close confirm. */
function selectionsExist(sel: BuilderSelections): boolean {
  const d = defaultSelections();
  return (
    sel.base !== d.base ||
    sel.shape !== d.shape ||
    sel.scentPath !== d.scentPath ||
    sel.signatureId !== d.signatureId ||
    sel.blendOils.length > 0 ||
    sel.botanical !== d.botanical ||
    sel.color !== d.color
  );
}

export function SoapBuilder({ mode }: SoapBuilderProps) {
  const steps = mode === 'bundle' ? BUNDLE_MODE_STEPS : SINGLE_MODE_STEPS;
  const router = useRouter();
  const { addItem } = useCart();
  const [sel, setSel] = useState<BuilderSelections>(defaultSelections);
  const [stepKey, setStepKey] = useState<RitualStepKey>(steps[0] ?? 'base');
  const [qty, setQty] = useState(1);
  const [customHex, setCustomHex] = useState('#8a5a9e');
  const [result, setResult] = useState<OrderConfiguration | null>(null);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const seasonal = useMemo(() => {
    const d = new Date();
    return getSeasonalFeature(d.getMonth() + 1, d.getFullYear()) ?? null;
  }, []);

  /* ---------------- modal behavior ---------------- */

  const closeBuilder = useCallback(() => {
    router.push('/soap-shop');
  }, [router]);

  const requestClose = useCallback(() => {
    if (
      selectionsExist(sel) &&
      !window.confirm(
        'Leave the soap builder? Your current selections will be lost.',
      )
    ) {
      return;
    }
    closeBuilder();
  }, [sel, closeBuilder]);

  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Backdrop click closes; clicks inside the dialog bubble up with a
    // different target and are ignored.
    if (e.target === e.currentTarget) requestClose();
  };

  /** Escape closes; body scroll is locked while the modal is open. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [requestClose]);

  /** Minimal focus trap: Tab cycles inside the dialog. */
  const onDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled'));
    if (focusables.length === 0) return;
    const first = focusables[0] as HTMLElement;
    const last = focusables[focusables.length - 1] as HTMLElement;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

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
          <div className={`${styles.cardGrid} ${styles.cardGridBases}`}>
            {SOAP_BASES.map((b) => (
              <button
                key={b.id}
                type="button"
                className={styles.card}
                aria-pressed={sel.base === b.id}
                onClick={() => selectBase(b.id)}
              >
                <span className={styles.cardIcon} aria-hidden="true">
                  {BASE_ICONS[b.id]}
                </span>
                <span className={styles.cardName}>{b.name}</span>
                <span className={styles.cardDesc}>{b.description}</span>
                <span className={styles.cardHint}>{BASE_HINTS[b.id]}</span>
                <span className={styles.checkBadge} aria-hidden="true">
                  ✓
                </span>
              </button>
            ))}
          </div>
        );
      case 'shape':
        return (
          <div>
            <p className={styles.sizeNote}>
              Shapes render small → large, true to size: the Medium Rose is
              visibly larger than the Small Rose and smaller than the large bars.
            </p>
            <div className={styles.cardGrid}>
              {SOAP_SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={styles.card}
                  aria-pressed={sel.shape === s.id}
                  onClick={() => selectShape(s.id)}
                >
                  <ShapeImage shapeId={s.id} alt={`${s.name} soap mold`} />
                  <span className={styles.cardName}>{s.name}</span>
                  <span className={styles.cardDesc}>{s.weightOz} oz</span>
                  <span className={styles.cardPrice}>{formatPrice(s.priceCents)}</span>
                  <span className={styles.checkBadge} aria-hidden="true">
                    ✓
                  </span>
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
              <p className={styles.blendHint}>
                Pairs beautifully with your scent:{' '}
                <strong className={styles.gold}>
                  {getBotanical(suggestedBotanical)?.name}
                </strong>{' '}
                — or follow your own nose.
              </p>
            )}
            <div className={styles.cardGrid}>
              {BOTANICALS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={styles.card}
                  aria-pressed={sel.botanical === b.id}
                  onClick={() => selectBotanical(b.id)}
                >
                  <span className={styles.cardIcon} aria-hidden="true">
                    {BOTANICAL_ICONS[b.id] ?? '🌿'}
                  </span>
                  <span className={styles.cardName}>{b.name}</span>
                  <span className={styles.cardDesc}>{b.role}</span>
                  <span className={styles.checkBadge} aria-hidden="true">
                    ✓
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      case 'color':
        return (
          <div>
            {naturalClearHidden && (
              <p className={styles.blendHint}>
                <strong className={styles.gold}>Natural / Clear</strong> needs a
                translucent bar to read as clear — it only appears with the
                Botanical Glycerin + Castor Oil base.
              </p>
            )}
            <div
              className={styles.colorGrid}
              role="group"
              aria-label="Color swatches"
            >
              {visibleColors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={styles.colorSwatch}
                  aria-pressed={sel.color === c.id}
                  aria-label={c.name}
                  title={c.name}
                  onClick={() => selectColor(c.id)}
                  style={{ background: c.hex }}
                />
              ))}
              <label
                className={`${styles.colorSwatch} ${styles.customSwatch}`}
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
            <p className={styles.colorName} aria-live="polite">
              {sel.color ? colorLabel(sel.color) : 'No color chosen yet'}
            </p>
            <p className={styles.colorNote}>
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
        <div className={styles.reveal}>
          <h3 className={styles.summaryTitle}>Your theme</h3>
          <dl className={styles.summary}>
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
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={startNew}>
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
      <div className={styles.reveal}>
        <dl className={styles.summary} role="status" aria-label="Your creation summary">
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
          <dd className={styles.price}>{formatPrice(shape.priceCents)}</dd>
        </dl>
        {safety && isMeaningfulSafety(safety) && (
          <p className={styles.safetyNote}>Note: {safety}</p>
        )}
        <p className={styles.hint}>
          Hand-poured to order by Amber in Salt Lake City. Please allow 3–5
          business days for your soap to be crafted and cured before shipping.
        </p>
        <p className={styles.makerNotes}>
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
          <p role="alert" className={styles.formError}>
            {error}
          </p>
        )}

        {added && (
          <p role="status" className={styles.addedNote}>
            ✨ Your creation is in your cart —{' '}
            <a href="/cart">review your cart</a> or{' '}
            <a href="/checkout">head to checkout</a>.
          </p>
        )}

        <div className={styles.cartRow}>
          <label className={styles.qtyLabel}>
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
          <button type="button" className={styles.btn} onClick={addToCart}>
            Add to Cart — {formatPrice(shape.priceCents)}
          </button>
        </div>
        <p>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={startNew}>
            Start a new creation
          </button>
        </p>

        {result && (
          <details className={styles.payload}>
            <summary>Order payload (what the maker receives)</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
            <p className={styles.hint}>
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

  const bottomHint =
    stepKey === 'reveal'
      ? 'Your alchemy is complete — review it above, then add it to your cart.'
      : complete
        ? 'Looking good — continue your ritual.'
        : STEP_HINTS[stepKey as keyof typeof STEP_HINTS];

  return (
    <div className={styles.overlay} onClick={onOverlayClick}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="soap-builder-title"
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
      >
        {/* Shared builder primitives (formula builders use the same sheet) —
            the modal's own presentation lives in the CSS module. */}
        <style>{BUILDER_CSS}</style>
        <div className={styles.dialogHeader}>
          <div>
            <p className={styles.eyebrow}>Amber's Alchemy Apothecary</p>
            <h1 id="soap-builder-title" className={styles.dialogTitle}>
              {mode === 'bundle'
                ? 'The Alchemy Soap Collection'
                : 'Create Your Own Alchemy Soap'}
            </h1>
            {mode === 'bundle' && (
              <span className={styles.modeBadge}>Collection mode</span>
            )}
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={requestClose}
            aria-label="Close the soap builder"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <nav className={styles.progressNav} aria-label="Creation ritual progress">
          <p className={styles.stepStatus} aria-live="polite">
            Step <strong>{stepIndex + 1} of {steps.length}</strong> —{' '}
            {STEP_LABELS[stepKey]}
          </p>
          <ol className={styles.progress}>
            {steps.map((key, i) => {
              const done = i < stepIndex;
              const now = key === stepKey;
              const revisit = canReachStep(key, sel, mode) && !now;
              const itemClass = `${styles.step}${done ? ` ${styles.stepDone}` : ''}${now ? ` ${styles.stepNow}` : ''}`;
              return (
                <li key={key} className={itemClass}>
                  {revisit ? (
                    <button
                      type="button"
                      className={styles.stepBtn}
                      onClick={() => goStep(key)}
                      aria-label={`Revisit ${STEP_LABELS[key]}${done ? ' (completed)' : ''}`}
                    >
                      <span className={styles.stepNum} aria-hidden="true">
                        {done ? '✓' : i + 1}
                      </span>
                      <span>{STEP_LABELS[key]}</span>
                    </button>
                  ) : (
                    <span aria-current={now ? 'step' : undefined}>
                      <span className={styles.stepNum} aria-hidden="true">
                        {done ? '✓' : i + 1}
                      </span>
                      <span>{STEP_LABELS[key]}</span>
                      {done && (
                        <span className={styles.srOnly}> (completed)</span>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {mode === 'bundle' && (
          <div className={styles.bundleBanner} role="note">
            <strong>Collection mode</strong> — design one theme through the
            ritual; it will be applied to all five bars, and you can edit each
            bar individually before adding the collection to your cart.
          </div>
        )}

        <div className={styles.body}>
          <section className={styles.stepPanel} aria-labelledby="step-heading">
            <h2 id="step-heading" ref={headingRef} tabIndex={-1} className={styles.stepHeading}>
              {STEP_HEADLINES[stepKey]}
            </h2>
            <p className={styles.stepSub}>{STEP_SUBS[stepKey]}</p>
            {renderStepPanel()}
          </section>

          <aside className={styles.previewPanel} aria-label="Live soap preview">
            <h3>Live Preview</h3>
            <WavePreview
              base={sel.base}
              colorId={sel.color}
              botanicalId={sel.botanical}
              scentCaption={scentCaption}
              className={styles.previewFigure}
            />
          </aside>
        </div>

        <div className={styles.bottomBar}>
          <p className={styles.bottomHint}>{bottomHint}</p>
          <div className={styles.bottomActions}>
            {stepIndex > 0 && (stepKey !== 'reveal' || mode === 'single') && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => goStep(steps[stepIndex - 1] as RitualStepKey)}
              >
                Back
              </button>
            )}
            {stepKey !== 'reveal' && (
              <button
                type="button"
                className={styles.btn}
                disabled={!complete}
                onClick={() => goStep(steps[stepIndex + 1] as RitualStepKey)}
              >
                Continue
              </button>
            )}
          </div>
        </div>

        <footer className={styles.builderFooter}>
          <p>
            Prices are displayed for convenience — all order totals are
            recomputed server-side at checkout.
          </p>
        </footer>
      </div>
    </div>
  );
}
