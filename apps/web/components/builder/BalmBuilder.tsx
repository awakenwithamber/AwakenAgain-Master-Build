/**
 * "Create Your Own" Custom Balm Builder — owner-approved 2026-10-30.
 * Amber's Alchemy Apothecary.
 *
 * Client island (the page shell stays a Server Component). A SEPARATE
 * component from FormulaBuilder: the capsule/tea builder is untouched,
 * and this builder follows the same architecture and shared primitives
 * (ProgressNav, HerbGrid, SafetyPanel, SummaryList, builder styles).
 *
 * Five choices, in order: Balm Base (wax) → Size → Botanicals →
 * Preferences & Safety → Reveal.
 * - Base: Soy Wax (standard) / Beeswax (soy-free alternative) at
 *   IDENTICAL prices (owner ruling 2026-10-30). Choosing a base
 *   immediately surfaces its allergen disclosure, mirrored from the
 *   balm records' own warnings/allergens wording.
 * - Botanicals: ONLY the grounded list in lib/custom-formula/balm.ts —
 *   featured ingredients of the existing balm/serum records that also
 *   exist in the herb library. No invented ingredients.
 * - Purpose: preference/ritual language ONLY (site copy rule) — never
 *   a remedy/treatment framing, no efficacy claims.
 * - Scent: a signature scent recipe ID from lib/catalog/scents.ts, or
 *   unscented — persisted as an exact ID, never prose.
 * - Live price preview via lib/pricing (CLIENT=PREVIEW, integer
 *   cents): size base (mirrored from the balm records) + canonical
 *   per-botanical add-ons; the wax choice is never priced.
 * - Add to Cart builds the payload via buildFormulaCartItem +
 *   buildOrderConfiguration — exact IDs persisted; the server
 *   recomputes every total authoritatively at checkout.
 */
'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  buildFormulaCartItem,
  buildOrderConfiguration,
} from '../../lib/cart/validation';
import {
  CUSTOM_BALM_HANDLE,
  CUSTOM_BALM_SIZES,
  customFormulaPriceCents,
  formatPrice,
} from '../../lib/pricing/pricing';
import { evaluateFormula, maxSeverity } from '../../lib/custom-formula/safety';
import {
  BALM_BASES,
  BALM_BANNER_TEXT,
  BALM_EXTERNAL_USE_NOTE,
  BALM_PURPOSES,
  BALM_SCENT_UNSENTED,
  balmAllergenNote,
  balmBotanicals,
  getBalmBase,
  getBalmPurpose,
  type BalmBaseId,
} from '../../lib/custom-formula/balm';
import { SIGNATURE_SCENTS, getScentRecipe } from '../../lib/catalog/scents';
import {
  MAX_FORMULA_HERBS,
  defaultFormulaSelections,
  formulaCustomizationOf,
  formulaMakerNotes,
  toggleFormulaHerb,
  type FormulaSelections,
} from '../../lib/custom-formula/formula';
import { useCart } from '../checkout/cart-store';
import { QuizPromo } from '../custom-formula/QuizPromo';
import { BalmBanner } from '../shop/ProductJourney';
import { FORMULA_BUILDER_CSS } from './shared/builder-styles';
import { ProgressNav } from './shared/ProgressNav';
import { SummaryList } from './shared/SummaryList';
import { HerbGrid } from './shared/HerbGrid';
import { SafetyPanel } from './shared/SafetyPanel';

type BalmStepKey = 'base' | 'size' | 'botanicals' | 'preferences' | 'reveal';

const BALM_STEPS: readonly BalmStepKey[] = [
  'base',
  'size',
  'botanicals',
  'preferences',
  'reveal',
];

const BALM_STEP_LABELS: Record<BalmStepKey, string> = {
  base: 'Balm Base',
  size: 'Size',
  botanicals: 'Botanicals',
  preferences: 'Preferences & Safety',
  reveal: 'Reveal',
};

const BALM_STEP_HEADLINES: Record<BalmStepKey, string> = {
  base: 'Choose Your Balm Base',
  size: 'Choose Your Size',
  botanicals: 'Choose Your Botanicals',
  preferences: 'Preferences & Safety',
  reveal: 'Your Balm Is Complete ✨',
};

const BALM_STEP_SUBS: Record<BalmStepKey, string> = {
  base: 'Soy wax is the standard finish; beeswax is the soy-free alternative — same price, either way.',
  size: 'From a pocket-size jar to a generous apothecary jar.',
  botanicals: 'Botanicals drawn from the apothecary\u2019s own balms and serum.',
  preferences: 'Your scent, your ritual — and the safety notes, read with care.',
  reveal: 'The moment of truth.',
};

const BALM_STEP_HINTS: Record<Exclude<BalmStepKey, 'reveal'>, string> = {
  base: 'Choose a balm base to continue.',
  size: 'Choose a size to continue.',
  botanicals: 'Select at least one botanical to continue.',
  preferences: 'Confirm you have read the safety notice to continue.',
};

export function BalmBuilder() {
  const { addItem } = useCart();

  const [sel, setSel] = useState<FormulaSelections>(defaultFormulaSelections);
  const [baseId, setBaseId] = useState<BalmBaseId | null>(null);
  const [purposeId, setPurposeId] = useState<string | null>(null);
  const [scentId, setScentId] = useState<string>(BALM_SCENT_UNSENTED);
  const [stepKey, setStepKey] = useState<BalmStepKey>('base');
  const [qty, setQty] = useState(1);
  const [result, setResult] = useState<ReturnType<typeof buildOrderConfiguration> | null>(null);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const herbs = useMemo(() => balmBotanicals(), []);
  const safety = useMemo(() => evaluateFormula(sel.herbIds), [sel.herbIds]);
  const previewCents = useMemo(() => {
    if (!sel.sizeId) return null;
    try {
      return customFormulaPriceCents('balm', sel.sizeId, sel.herbIds);
    } catch {
      return null;
    }
  }, [sel.sizeId, sel.herbIds]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [stepKey]);

  const allergenNote = baseId ? balmAllergenNote(baseId) : null;
  const base = baseId ? getBalmBase(baseId) : undefined;
  const sizeName = CUSTOM_BALM_SIZES.find((s) => s.id === sel.sizeId)?.name ?? '';

  /* ---------------- step gating ---------------- */

  const stepComplete = (step: BalmStepKey): boolean => {
    switch (step) {
      case 'base':
        return baseId !== null && !!getBalmBase(baseId);
      case 'size':
        return sel.sizeId !== null && !!CUSTOM_BALM_SIZES.find((s) => s.id === sel.sizeId);
      case 'botanicals': {
        if (sel.herbIds.length < 1 || sel.herbIds.length > MAX_FORMULA_HERBS) return false;
        const selectable = new Set(herbs.map((h) => h.id));
        return sel.herbIds.every((id) => selectable.has(id));
      }
      case 'preferences':
        return sel.safetyAck === true;
      case 'reveal':
        return false; // reveal is a destination, never a gate
    }
  };

  const canReach = (target: BalmStepKey): boolean => {
    const idx = BALM_STEPS.indexOf(target);
    if (idx === -1) return false;
    return BALM_STEPS.slice(0, idx).every((s) => stepComplete(s));
  };

  const goStep = (key: BalmStepKey) => {
    if (!canReach(key)) return;
    setStepKey(key);
    setError(null);
  };

  /* ---------------- selection handlers ---------------- */

  const toggleHerb = (id: string) => {
    setSel((s) => ({ ...s, herbIds: toggleFormulaHerb(s.herbIds, id, 'balm') }));
  };

  const setAck = (v: boolean) => setSel((s) => ({ ...s, safetyAck: v }));
  const setField =
    (field: 'creationName' | 'intention' | 'notes') =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setSel((s) => ({ ...s, [field]: e.target.value }));

  const scentLabel = (id: string): string =>
    id === BALM_SCENT_UNSENTED
      ? 'Unscented — just the botanicals'
      : (getScentRecipe(id)?.name ?? id);

  /* ---------------- add to cart ---------------- */

  const buildFormula = () =>
    formulaCustomizationOf(sel, 'balm', {
      baseId,
      purposeId,
      scentId,
    });

  const addToCart = () => {
    setError(null);
    setResult(null);
    setAdded(false);
    try {
      const formula = buildFormula();
      if (!formula) {
        throw new Error('Your balm is not complete yet.');
      }
      // The shared server-authority recompute: any tampered total is rejected here.
      const item = buildFormulaCartItem(CUSTOM_BALM_HANDLE, formula, qty);
      const order = buildOrderConfiguration([item], undefined, 0);
      const ok = addItem(CUSTOM_BALM_HANDLE, undefined, undefined, qty, formula);
      if (!ok) {
        throw new Error('Could not add your balm to the cart. Please try again.');
      }
      setAdded(true);
      setResult(order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the order payload.');
    }
  };

  const startNew = () => {
    setSel(defaultFormulaSelections());
    setBaseId(null);
    setPurposeId(null);
    setScentId(BALM_SCENT_UNSENTED);
    setStepKey('base');
    setQty(1);
    setResult(null);
    setAdded(false);
    setError(null);
  };

  /* ---------------- step panels ---------------- */

  const renderStepPanel = () => {
    switch (stepKey) {
      case 'base':
        return (
          <div>
            <div className="pick-grid bases">
              {BALM_BASES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="pick"
                  aria-pressed={baseId === b.id}
                  onClick={() => setBaseId(b.id)}
                >
                  <span className="p-name">{b.name}</span>
                  <span className="p-sub">{b.description}</span>
                  <span className="p-price">Same price — no difference</span>
                </button>
              ))}
            </div>
            {allergenNote && (
              <p className="verify-note" role="status">
                <strong>Allergen note:</strong> {allergenNote}
              </p>
            )}
          </div>
        );
      case 'size':
        return (
          <div className="pick-grid bases">
            {CUSTOM_BALM_SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="pick"
                aria-pressed={sel.sizeId === s.id}
                onClick={() => setSel((prev) => ({ ...prev, sizeId: s.id }))}
              >
                <span className="p-name">{s.name}</span>
                <span className="p-sub">{s.unit}</span>
                <span className="p-price">{formatPrice(s.baseCents)} base</span>
                <span className="p-hint">+ botanical add-ons</span>
              </button>
            ))}
          </div>
        );
      case 'botanicals':
        return (
          <HerbGrid
            herbs={herbs}
            selectedIds={sel.herbIds}
            maxHerbs={MAX_FORMULA_HERBS}
            onToggle={toggleHerb}
          />
        );
      case 'preferences':
        return (
          <div>
            <div className="field">
              <label htmlFor="bb-purpose">What is this balm for? (optional)</label>
              <div className="pick-grid bases">
                {BALM_PURPOSES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="pick"
                    aria-pressed={purposeId === p.id}
                    onClick={() => setPurposeId(purposeId === p.id ? null : p.id)}
                  >
                    <span className="p-name">{p.label}</span>
                  </button>
                ))}
              </div>
              <p className="f-hint">
                Preference and ritual language only — your words guide how
                Amber crafts and labels your jar.
              </p>
            </div>
            <div className="field">
              <label htmlFor="bb-scent">Scent preference</label>
              <div className="pick-grid bases">
                <button
                  type="button"
                  className="pick"
                  aria-pressed={scentId === BALM_SCENT_UNSENTED}
                  onClick={() => setScentId(BALM_SCENT_UNSENTED)}
                >
                  <span className="p-name">Unscented</span>
                  <span className="p-sub">Just the botanicals</span>
                </button>
                {SIGNATURE_SCENTS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="pick"
                    aria-pressed={scentId === r.id}
                    onClick={() => setScentId(r.id)}
                  >
                    <span className="p-name">{r.name}</span>
                    <span className="p-sub">{r.profile}</span>
                  </button>
                ))}
              </div>
            </div>
            <SafetyPanel
              flags={safety.flags}
              acknowledged={sel.safetyAck}
              onAcknowledge={setAck}
            />
            <p className="verify-note">{BALM_EXTERNAL_USE_NOTE}</p>
            {allergenNote && (
              <p className="verify-note">
                <strong>Allergen note for your {base?.name} finish:</strong>{' '}
                {allergenNote}
              </p>
            )}
            <div className="field">
              <label htmlFor="bb-name">Name your creation (optional)</label>
              <input
                id="bb-name"
                type="text"
                value={sel.creationName}
                onChange={setField('creationName')}
                maxLength={80}
                placeholder="e.g. Evening Garden Balm"
              />
            </div>
            <div className="field">
              <label htmlFor="bb-intention">Intention (optional)</label>
              <input
                id="bb-intention"
                type="text"
                value={sel.intention}
                onChange={setField('intention')}
                maxLength={120}
                placeholder="The ritual this balm belongs to, in your own words?"
              />
              <p className="f-hint">
                Traditional wellness intentions only — never a disease claim.
              </p>
            </div>
            <div className="field">
              <label htmlFor="bb-notes">Notes for Amber (optional)</label>
              <textarea
                id="bb-notes"
                value={sel.notes}
                onChange={setField('notes')}
                maxLength={500}
                placeholder="Anything she should know while crafting…"
              />
            </div>
          </div>
        );
      case 'reveal':
        return renderReveal();
    }
  };

  const renderReveal = () => {
    const formula = buildFormula();
    if (!formula || previewCents === null || !base) return null;
    const herbNames = formula.herb_ids.map(
      (id) => herbs.find((h) => h.id === id)?.name ?? id,
    );
    const baseCents =
      CUSTOM_BALM_SIZES.find((s) => s.id === formula.size_id)?.baseCents ?? 0;
    const purpose = formula.purpose_id ? getBalmPurpose(formula.purpose_id) : undefined;
    const makerNotes = [
      formulaMakerNotes(
        'balm',
        formula.size_id,
        formula.herb_ids,
        sel.creationName,
        sel.intention,
        sel.notes,
      ),
      `Base: ${base.name}.`,
      purpose ? `Purpose: ${purpose.label}.` : '',
      `Scent: ${scentLabel(formula.scent_id ?? BALM_SCENT_UNSENTED)}.`,
      allergenNote ? `Allergens: ${allergenNote}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <div className="reveal">
        <SummaryList
          label="Your balm summary"
          rows={[
            { term: 'Form', detail: 'Custom Botanical Balm' },
            { term: 'Balm base', detail: base.name },
            { term: 'Allergens', detail: allergenNote ?? '' },
            { term: 'Size', detail: sizeName },
            {
              term: `Botanicals (${herbNames.length})`,
              detail: herbNames.join(', '),
            },
            ...(purpose ? [{ term: 'For', detail: purpose.label }] : []),
            { term: 'Scent', detail: scentLabel(formula.scent_id ?? BALM_SCENT_UNSENTED) },
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
          <div className="pb-row">
            <span>Balm base — {base.name}</span>
            <span>{formatPrice(0)} — same price either finish</span>
          </div>
          {formula.herb_ids.map((id) => {
            const h = herbs.find((x) => x.id === id);
            return (
              <div className="pb-row" key={id}>
                <span>{h?.name ?? id}</span>
                <span>+{formatPrice(h?.priceCents ?? 0)}</span>
              </div>
            );
          })}
          <div className="pb-total">
            <span>Total (preview)</span>
            <span>{formatPrice(previewCents)}</span>
          </div>
        </div>

        <div className="verify-note">
          <strong>Pricing note.</strong> Size prices mirror the
          apothecary&apos;s balm jars exactly, and the wax choice never
          changes the price. Every total is recomputed server-side at
          checkout — the browser never sets the final price.
        </div>

        <p className="hint">
          Crafted to order by Amber in Salt Lake City. Please allow 3–5
          business days for your balm to be crafted before shipping.
        </p>
        <p className="maker-notes">
          <strong>Maker notes:</strong> {makerNotes}
        </p>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        {added && (
          <p role="status" className="cart-confirm">
            ✨ Your balm is in your cart —{' '}
            <Link href="/cart">review your cart</Link> or{' '}
            <Link href="/checkout">head to checkout</Link>.
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
            Start a new balm
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

  const complete = stepKey === 'reveal' ? true : stepComplete(stepKey);
  const stepIndex = BALM_STEPS.indexOf(stepKey);

  return (
    <div className="builder-root">
      <style>{FORMULA_BUILDER_CSS}</style>
      <header className="builder-header">
        <Link className="brand" href="/shop">
          Amber&apos;s Alchemy Apothecary
        </Link>
        <nav className="nav" aria-label="Formula builders">
          <Link href="/custom-formula/capsules">Capsule Builder</Link>
          <Link href="/custom-formula/tea">Tea Builder</Link>
          <Link href="/custom-formula/balm">Balm Builder</Link>
          <Link href="/custom-formula">Choose Your Form</Link>
        </nav>
      </header>

      <QuizPromo />

      <div className="wrap">
        <h1 className="builder-title">Create Your Own Botanical Balm</h1>
        <p className="builder-lede">
          A personalized formula crafted around your preferences — your
          finish, your botanicals, your scent, your ritual — made like
          beauty was made for a thousand years before factories.
        </p>

        <BalmBanner text={BALM_BANNER_TEXT} />

        <ProgressNav
          steps={BALM_STEPS}
          labels={BALM_STEP_LABELS}
          current={stepKey}
          onGo={goStep}
          isComplete={(k) => stepComplete(k)}
        />

        <div className="builder">
          <section className="step-panel" aria-labelledby="step-heading">
            <h2 id="step-heading" ref={headingRef} tabIndex={-1}>
              {BALM_STEP_HEADLINES[stepKey]}
            </h2>
            <p className="sub">{BALM_STEP_SUBS[stepKey]}</p>
            {renderStepPanel()}
            {stepKey !== 'reveal' && (
              <div className="step-nav">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => goStep(BALM_STEPS[stepIndex - 1] as BalmStepKey)}
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
                  onClick={() => goStep(BALM_STEPS[stepIndex + 1] as BalmStepKey)}
                >
                  Continue
                </button>
              </div>
            )}
            {stepKey !== 'reveal' && !complete && (
              <p className="hint">
                {BALM_STEP_HINTS[stepKey as keyof typeof BALM_STEP_HINTS]}
              </p>
            )}
            {stepKey === 'reveal' && stepIndex > 0 && (
              <div className="step-nav">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => goStep(BALM_STEPS[stepIndex - 1] as BalmStepKey)}
                >
                  Back
                </button>
                <span />
              </div>
            )}
          </section>

          <aside className="preview-panel" aria-label="Live balm preview">
            <h3>Live Preview</h3>
            <p className="preview-cap">
              {base ? base.name : 'Choose your balm base to begin.'}
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
              <Link href="/custom-formula/tea">tea builder</Link> or the{' '}
              <Link href="/custom-formula/capsules">capsule builder</Link>.
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
