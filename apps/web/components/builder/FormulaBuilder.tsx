/**
 * "Create Your Own" formula builder — G2 herbal capsules, G10 tea blends.
 * Amber's Alchemy Apothecary.
 *
 * Client island (the page shell stays a Server Component). One component,
 * parameterized by kind — the capsule and tea builders share architecture,
 * differing only in data (herb list, sizes) and copy.
 *
 * Four-step ritual: Size → Botanicals → Safety & Intention → Reveal.
 * - Herb grid from the canonical catalog (lib/catalog/herbs.ts), with
 *   search + category filter.
 * - Typed safety evaluation (lib/custom-formula/safety.ts): conservative —
 *   unknown pairings are flagged NEEDS REVIEW, never silently allowed.
 * - Live price preview via lib/pricing (CLIENT=PREVIEW, integer cents).
 * - Add to Cart builds the payload via buildFormulaCartItem +
 *   buildOrderConfiguration — exact herb IDs persisted, the server
 *   recomputes every total authoritatively.
 *
 * Analytics: builder-scoped events from lib/analytics/builders-events.ts
 * (inert without a PostHog token). PostHog stays observational — never
 * marked IMPLEMENTED.
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildFormulaCartItem,
  buildOrderConfiguration,
} from '../../lib/cart/validation';
import {
  CUSTOM_CAPSULE_HANDLE,
  CUSTOM_CAPSULE_SIZES,
  CUSTOM_TEA_HANDLE,
  CUSTOM_TEA_SIZES,
  customFormulaPriceCents,
  formatPrice,
  type FormulaKind,
} from '../../lib/pricing/pricing';
import {
  evaluateFormula,
  maxSeverity,
} from '../../lib/custom-formula/safety';
import {
  BUILDER_ANALYTICS_EVENT_NAMES as B,
  trackBuilderEvent,
  trackBuilderEventOnce,
} from '../../lib/analytics/builders-events';
import { useCart } from '../checkout/cart-store';
import { FORMULA_BUILDER_CSS } from './shared/builder-styles';
import { ProgressNav } from './shared/ProgressNav';
import { SummaryList } from './shared/SummaryList';
import { HerbGrid } from './shared/HerbGrid';
import { SafetyPanel } from './shared/SafetyPanel';
import type { FormulaCustomization } from '../../types';
import {
  FORMULA_STEP_HEADLINES,
  FORMULA_STEP_HINTS,
  FORMULA_STEP_LABELS,
  FORMULA_STEP_SUBS,
  FORMULA_STEPS,
  MAX_FORMULA_HERBS,
  availableHerbs,
  canReachFormulaStep,
  defaultFormulaSelections,
  formulaCustomizationOf,
  formulaMakerNotes,
  formulaStepComplete,
  toggleFormulaHerb,
  type FormulaSelections,
  type FormulaStepKey,
} from '../../lib/custom-formula/formula';

export interface FormulaBuilderProps {
  kind: FormulaKind;
}

const KIND_HANDLE: Record<FormulaKind, string> = {
  capsule: CUSTOM_CAPSULE_HANDLE,
  tea: CUSTOM_TEA_HANDLE,
};

const KIND_TITLE: Record<FormulaKind, string> = {
  capsule: 'Create Your Own Herbal Capsules',
  tea: 'Create Your Own Tea Blend',
};

export function FormulaBuilder({ kind }: FormulaBuilderProps) {
  const handle = KIND_HANDLE[kind];
  const sizes = kind === 'capsule' ? CUSTOM_CAPSULE_SIZES : CUSTOM_TEA_SIZES;
  const { addItem } = useCart();

  const [sel, setSel] = useState<FormulaSelections>(defaultFormulaSelections);
  const [stepKey, setStepKey] = useState<FormulaStepKey>('size');
  const [qty, setQty] = useState(1);
  const [result, setResult] = useState<ReturnType<typeof buildOrderConfiguration> | null>(null);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const herbs = useMemo(() => availableHerbs(kind), [kind]);
  const safety = useMemo(() => evaluateFormula(sel.herbIds), [sel.herbIds]);
  const previewCents = useMemo(() => {
    if (!sel.sizeId) return null;
    try {
      return customFormulaPriceCents(kind, sel.sizeId, sel.herbIds);
    } catch {
      return null;
    }
  }, [kind, sel.sizeId, sel.herbIds]);

  const EVENTS =
    kind === 'capsule'
      ? {
          started: B.formulaBuilderStarted,
          stepViewed: B.formulaStepViewed,
          herbSelected: B.formulaHerbSelected,
          herbRemoved: B.formulaHerbRemoved,
          safetyShown: B.formulaSafetyFlagShown,
          completed: B.formulaBlendCompleted,
          addedToCart: B.formulaAddedToCart,
        }
      : {
          started: B.teaBuilderStarted,
          stepViewed: B.teaStepViewed,
          herbSelected: B.teaHerbSelected,
          herbRemoved: B.teaHerbRemoved,
          safetyShown: B.teaSafetyFlagShown,
          completed: B.teaBlendCompleted,
          addedToCart: B.teaAddedToCart,
        };

  useEffect(() => {
    trackBuilderEventOnce(`${kind}_builder_started`, EVENTS.started, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // Focus the step heading on navigation (screen-reader + keyboard users).
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepKey]);

  // Safety flags are a core differentiator — observe exposure once per session.
  useEffect(() => {
    if (stepKey === 'safety' && sel.herbIds.length > 0) {
      trackBuilderEventOnce(`${kind}_safety_shown_${sel.herbIds.length}`, EVENTS.safetyShown, {
        flag_count: safety.flags.length,
        max_severity: maxSeverity(safety.flags),
        unknown_pair_count: safety.unknownPairCount,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey, kind]);

  const goStep = (key: FormulaStepKey) => {
    if (!canReachFormulaStep(key, sel, kind)) return;
    setStepKey(key);
    setError(null);
    const idx = FORMULA_STEPS.indexOf(key);
    trackBuilderEvent(EVENTS.stepViewed, { step: idx + 1, step_name: key });
    if (key === 'reveal') {
      trackBuilderEventOnce(
        `${kind}_blend_completed_${sel.herbIds.join(',')}`,
        EVENTS.completed,
        {
          herb_ids: [...sel.herbIds],
          herb_count: sel.herbIds.length,
          size_id: sel.sizeId ?? '',
        },
      );
    }
  };

  /* ---------------- selection handlers ---------------- */

  const selectSize = (id: string) => {
    setSel((s) => ({ ...s, sizeId: id }));
  };

  const toggleHerb = (id: string) => {
    const wasSelected = sel.herbIds.includes(id);
    setSel((s) => ({ ...s, herbIds: toggleFormulaHerb(s.herbIds, id, kind) }));
    const nextCount = wasSelected
      ? sel.herbIds.length - 1
      : Math.min(sel.herbIds.length + 1, MAX_FORMULA_HERBS);
    trackBuilderEvent(wasSelected ? EVENTS.herbRemoved : EVENTS.herbSelected, {
      herb_id: id,
      herb_count: nextCount,
    });
  };

  const setAck = (v: boolean) => setSel((s) => ({ ...s, safetyAck: v }));
  const setField = (field: 'creationName' | 'intention' | 'notes') => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setSel((s) => ({ ...s, [field]: e.target.value }));

  /* ---------------- add to cart ---------------- */

  const addToCart = () => {
    setError(null);
    setResult(null);
    setAdded(false);
    try {
      const formula = formulaCustomizationOf(sel, kind);
      if (!formula) {
        throw new Error('Your formula is not complete yet.');
      }
      // The shared server-authority recompute: any tampered total is rejected here.
      const item = buildFormulaCartItem(handle, formula, qty);
      const order = buildOrderConfiguration([item], undefined, 0);
      // THE cart store is the single cart source — this is what actually
      // puts the creation in the customer's cart. The server reprices
      // authoritatively at checkout.
      const ok = addItem(handle, undefined, undefined, qty, formula);
      if (!ok) {
        throw new Error('Could not add your formula to the cart. Please try again.');
      }
      setAdded(true);
      setResult(order);
      trackBuilderEvent(EVENTS.addedToCart, {
        size_id: formula.size_id,
        herb_ids: [...formula.herb_ids],
        herb_count: formula.herb_ids.length,
        unit_price_cents: item.unit_price_cents,
        quantity: qty,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the order payload.');
    }
  };

  const startNew = () => {
    setSel(defaultFormulaSelections());
    setStepKey('size');
    setQty(1);
    setResult(null);
    setAdded(false);
    setError(null);
  };

  /* ---------------- derived display state ---------------- */

  const herbBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const id of sel.herbIds) {
      const h = herbs.find((x) => x.id === id);
      if (h) map.set(h.name, h.priceCents);
    }
    return [...map.entries()];
  }, [herbs, sel.herbIds]);

  const sizeName = sizes.find((s) => s.id === sel.sizeId)?.name ?? '';

  const renderStepPanel = () => {
    switch (stepKey) {
      case 'size':
        return (
          <div className="pick-grid bases">
            {sizes.map((s) => (
              <button
                key={s.id}
                type="button"
                className="pick"
                aria-pressed={sel.sizeId === s.id}
                onClick={() => selectSize(s.id)}
              >
                <span className="p-name">{s.name}</span>
                <span className="p-sub">{s.unit}</span>
                <span className="p-price">{formatPrice(s.baseCents)} base</span>
                <span className="p-hint">+ botanical add-ons</span>
              </button>
            ))}
          </div>
        );
      case 'herbs':
        return (
          <HerbGrid
            herbs={herbs}
            selectedIds={sel.herbIds}
            maxHerbs={MAX_FORMULA_HERBS}
            onToggle={toggleHerb}
          />
        );
      case 'safety':
        return (
          <div>
            <SafetyPanel
              flags={safety.flags}
              acknowledged={sel.safetyAck}
              onAcknowledge={setAck}
            />
            <div className="verify-note">
              <strong>Conservative by design.</strong> Botanical pairings that
              have not been reviewed together are flagged for review — Amber
              personally reviews every custom formula before blending and will
              contact you if a pairing raises a concern. Curated pair notes
              are pending her herbalist review.
            </div>
            <div className="field">
              <label htmlFor="fb-name">Name your creation (optional)</label>
              <input
                id="fb-name"
                type="text"
                value={sel.creationName}
                onChange={setField('creationName')}
                maxLength={80}
                placeholder={
                  kind === 'capsule' ? 'e.g. Morning Clarity' : 'e.g. Evening Unwind'
                }
              />
            </div>
            <div className="field">
              <label htmlFor="fb-intention">Intention (optional)</label>
              <input
                id="fb-intention"
                type="text"
                value={sel.intention}
                onChange={setField('intention')}
                maxLength={120}
                placeholder="What is this blend for, in your own words?"
              />
              <p className="f-hint">
                Traditional wellness intentions only — never a disease claim.
              </p>
            </div>
            <div className="field">
              <label htmlFor="fb-notes">Notes for Amber (optional)</label>
              <textarea
                id="fb-notes"
                value={sel.notes}
                onChange={setField('notes')}
                maxLength={500}
                placeholder="Anything she should know while blending…"
              />
            </div>
          </div>
        );
      case 'reveal':
        return renderReveal();
    }
  };

  const renderReveal = () => {
    const formula: FormulaCustomization | null = formulaCustomizationOf(sel, kind);
    if (!formula || previewCents === null) return null;
    const herbNames = formula.herb_ids.map(
      (id) => herbs.find((h) => h.id === id)?.name ?? id,
    );
    const baseCents = sizes.find((s) => s.id === formula.size_id)?.baseCents ?? 0;
    return (
      <div className="reveal">
        <SummaryList
          label="Your formula summary"
          rows={[
            { term: 'Form', detail: kind === 'capsule' ? 'Custom Herbal Capsules' : 'Custom Tea Blend' },
            { term: 'Size', detail: sizeName },
            {
              term: `Botanicals (${herbNames.length})`,
              detail: herbNames.join(', '),
            },
            ...(formula.creation_name
              ? [{ term: 'Name', detail: formula.creation_name }]
              : []),
            ...(formula.intention
              ? [{ term: 'Intention', detail: formula.intention }]
              : []),
            {
              term: 'Safety',
              detail: `${safety.flags.length} notice${safety.flags.length === 1 ? '' : 's'} reviewed — highest: ${maxSeverity(safety.flags)}`,
            },
          ]}
        />

        <div className="price-breakdown" aria-label="Price breakdown (preview)">
          <div className="pb-row">
            <span>Base — {sizeName}</span>
            <span>{formatPrice(baseCents)}</span>
          </div>
          {herbBreakdown.map(([name, cents]) => (
            <div className="pb-row" key={name}>
              <span>{name}</span>
              <span>+{formatPrice(cents)}</span>
            </div>
          ))}
          <div className="pb-total">
            <span>Total (preview)</span>
            <span>{formatPrice(previewCents)}</span>
          </div>
        </div>

        <div className="verify-note">
          <strong>Pricing note.</strong> Builder pricing is introductory and
          pending final owner confirmation; every total is recomputed
          server-side at checkout — the browser never sets the final price.
        </div>

        <p className="hint">
          Blended to order by Amber in Salt Lake City. Please allow 3–5
          business days for your formula to be crafted before shipping.
        </p>
        <p className="maker-notes">
          <strong>Maker notes:</strong>{' '}
          {formulaMakerNotes(
            kind,
            formula.size_id,
            formula.herb_ids,
            sel.creationName,
            sel.intention,
            sel.notes,
          )}
        </p>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        {added && (
          <p role="status" className="cart-confirm">
            ✨ Your formula is in your cart —{' '}
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
            Add to Cart — {formatPrice(previewCents)}
          </button>
        </div>
        <p>
          <button type="button" className="btn ghost" onClick={startNew}>
            Start a new formula
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

  const complete = stepKey === 'reveal' ? true : formulaStepComplete(stepKey, sel, kind);
  const stepIndex = FORMULA_STEPS.indexOf(stepKey);
  const otherKind: FormulaKind = kind === 'capsule' ? 'tea' : 'capsule';
  const otherHref = otherKind === 'capsule' ? '/custom-formula' : '/custom-formula/tea';

  return (
    <div className="builder-root">
      <style>{FORMULA_BUILDER_CSS}</style>
      <header className="builder-header">
        <a className="brand" href="/shop">
          Amber's Alchemy Apothecary
        </a>
        <nav className="nav" aria-label="Formula builders">
          <a href="/custom-formula">Capsule Builder</a>
          <a href="/custom-formula/tea">Tea Builder</a>
        </nav>
      </header>

      <div className="wrap">
        <h1 className="builder-title">{KIND_TITLE[kind]}</h1>
        <p className="builder-lede">
          {kind === 'capsule'
            ? 'A personalized capsule blend crafted around your body, goals, and herbal needs — hand-filled in small batches.'
            : 'A personalized tea blend crafted around your taste and ritual — calming, energizing, digestion, glow, or seasonal support.'}
        </p>

        <ProgressNav
          steps={FORMULA_STEPS}
          labels={FORMULA_STEP_LABELS}
          current={stepKey}
          onGo={goStep}
          isComplete={(k) => formulaStepComplete(k, sel, kind)}
        />

        <div className="builder">
          <section className="step-panel" aria-labelledby="step-heading">
            <h2 id="step-heading" ref={headingRef} tabIndex={-1}>
              {FORMULA_STEP_HEADLINES[kind][stepKey]}
            </h2>
            <p className="sub">{FORMULA_STEP_SUBS[kind][stepKey]}</p>
            {renderStepPanel()}
            {stepKey !== 'reveal' && (
              <div className="step-nav">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => goStep(FORMULA_STEPS[stepIndex - 1] as FormulaStepKey)}
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
                  onClick={() => goStep(FORMULA_STEPS[stepIndex + 1] as FormulaStepKey)}
                >
                  Continue
                </button>
              </div>
            )}
            {stepKey !== 'reveal' && !complete && (
              <p className="hint">{FORMULA_STEP_HINTS[stepKey as keyof typeof FORMULA_STEP_HINTS]}</p>
            )}
            {stepKey === 'reveal' && stepIndex > 0 && (
              <div className="step-nav">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => goStep(FORMULA_STEPS[stepIndex - 1] as FormulaStepKey)}
                >
                  Back
                </button>
                <span />
              </div>
            )}
          </section>

          <aside className="preview-panel" aria-label="Live formula preview">
            <h3>Live Preview</h3>
            <p className="preview-cap">
              {sel.herbIds.length === 0
                ? 'Your botanicals will appear here.'
                : `${sel.herbIds.length} botanical${sel.herbIds.length === 1 ? '' : 's'} selected`}
            </p>
            <ul className="preview-herbs">
              {sel.herbIds.map((id) => {
                const h = herbs.find((x) => x.id === id);
                return (
                  <li key={id}>
                    <span aria-hidden="true">{h?.emoji} </span>
                    {h?.name ?? id}
                  </li>
                );
              })}
            </ul>
            {previewCents !== null && (
              <p className="scent-caption">
                Preview total: {formatPrice(previewCents)}
              </p>
            )}
            <p className="preview-cap">
              Also craving a different ritual? Try the{' '}
              <a href={otherHref}>
                {otherKind === 'capsule' ? 'capsule builder' : 'tea builder'}
              </a>
              .
            </p>
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
