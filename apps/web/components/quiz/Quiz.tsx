/**
 * Herbal Allies Quiz — client island on the server quiz page.
 *
 * RESTORED 2026-10-22 (owner directive): the Guided Wellness Quiz —
 * "The Synthesis" — from the legacy site, rebuilt as a React island on
 * the shared engine in lib/quiz/advisor.ts. A calm, mystical
 * conversation in phases: intro → Foundation (multi-select goals) →
 * Shape → Whole Human → Nuance → safety screening → lead capture →
 * the Synthesis (patterns, personal allies, rituals, one personalized formula).
 *
 * The Stage 4 safety screening stays (owner-kept): its answers gate
 * product suggestions exactly as before (lib/quiz/quiz.ts rules, applied
 * inside computeAdvisorSynthesis), and the result snapshot stores them.
 *
 * Results (owner directives 2026-10-15 + 2026-10-22): sharing an email
 * saves the lead AND sends the full results to that email through the
 * Resend-bound provider; a signed-in visitor can save to their profile;
 * the results can be downloaded as a real PDF; and the path onward —
 * build a custom formula, or book a call / Zoom / text Amber — is
 * woven into the Synthesis itself.
 *
 * Styles live in ./quiz.css — imported here. (The pre-restore island
 * shipped with NO stylesheet at all, which is why its buttons rendered
 * as bare browser defaults and showed no selected state.)
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ADVISOR_DIGESTION,
  ADVISOR_DURATION,
  ADVISOR_EMOTIONAL,
  ADVISOR_FORMATS,
  ADVISOR_FREQUENCY,
  ADVISOR_GOALS,
  ADVISOR_INTENSITY,
  ADVISOR_MAX_SYMPTOMS,
  ADVISOR_REASSURANCE,
  ADVISOR_SENSITIVITY,
  ADVISOR_SLEEP,
  ADVISOR_STRESS,
  ADVISOR_TIME_OF_DAY,
  ADVISOR_TRIGGERS,
  ADVISOR_WHY_ALLIES_HEADING,
  ADVISOR_WHY_ALLIES_PARAGRAPHS,
  ADVISOR_SPECIALTIES_LINE,
  CAPSULE_EXPLAINER,
  EMPTY_ADVISOR_ANSWERS,
  advisorLegacyIds,
  computeAdvisorSynthesis,
  type AdvisorAnswers,
  type AdvisorOption,
} from '../../lib/quiz/advisor';
import {
  QUIZ_SAFETY_BANNER,
  QUIZ_SCREENING_QUESTIONS,
  type QuizScreening,
} from '../../lib/quiz/quiz';
import { FDA_STATEMENT } from '../../lib/safety/product-safety';
import { trackContent, trackContentOnce } from '../../lib/analytics/content-posthog';
import { recordInterestNow } from '../../lib/personalization/client';
import { fetchAccountProfile } from '../../lib/accounts/client';
import { ProfileInvite } from '../personalization/ProfileInvite';
import { PRODUCTS } from '../../lib/catalog/products';
import { BRAND_NAME, BRAND_PHONE_DISPLAY, BRAND_PHONE_TEL } from '../../lib/seo/config';
import './quiz.css';

type Phase =
  | 'intro'
  | 'foundation'
  | 'shape'
  | 'whole'
  | 'nuance'
  | 'screening'
  | 'lead'
  | 'results';

/** Question phases in order, for the progress label (lead = step 6). */
const PHASE_STEP: Partial<Record<Phase, number>> = {
  foundation: 1,
  shape: 2,
  whole: 3,
  nuance: 4,
  screening: 5,
  lead: 6,
};

type ScreeningAnswers = Record<keyof QuizScreening, boolean | null>;

const EMPTY_SCREENING: ScreeningAnswers = {
  pregnantOrNursing: null,
  takingMedication: null,
  managingCondition: null,
};

interface LeadState {
  name: string;
  email: string;
  consent: boolean;
}

function productTitle(handle: string): string {
  return PRODUCTS.find((p) => p.handle === handle)?.title ?? handle;
}

export default function Quiz() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [answers, setAnswers] = useState<AdvisorAnswers>(EMPTY_ADVISOR_ANSWERS);
  const [screeningAnswers, setScreeningAnswers] = useState<ScreeningAnswers>(EMPTY_SCREENING);
  const [capFlash, setCapFlash] = useState(false);
  const [lead, setLead] = useState<LeadState>({ name: '', email: '', consent: false });
  const [leadStatus, setLeadStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [leadErrors, setLeadErrors] = useState<string[]>([]);
  const [accountEmail, setAccountEmail] = useState<string | null | undefined>(undefined);
  const [profileSave, setProfileSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'working' | 'error'>('idle');

  const screeningComplete =
    screeningAnswers.pregnantOrNursing !== null &&
    screeningAnswers.takingMedication !== null &&
    screeningAnswers.managingCondition !== null;
  const screening: QuizScreening = {
    pregnantOrNursing: screeningAnswers.pregnantOrNursing === true,
    takingMedication: screeningAnswers.takingMedication === true,
    managingCondition: screeningAnswers.managingCondition === true,
  };

  const synthesis = useMemo(
    () =>
      answers.symptoms.length > 0
        ? computeAdvisorSynthesis(answers, screening)
        : null,
    [answers, screening],
  );

  useEffect(() => {
    if (phase !== 'results') return;
    let cancelled = false;
    void fetchAccountProfile().then((profile) => {
      if (!cancelled) setAccountEmail(profile?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  /* ------------------------------ selections ------------------------------ */

  const toggleSymptom = (id: string) => {
    setAnswers((a) => {
      if (a.symptoms.includes(id)) {
        return { ...a, symptoms: a.symptoms.filter((s) => s !== id) };
      }
      if (a.symptoms.length >= ADVISOR_MAX_SYMPTOMS) {
        setCapFlash(true);
        window.setTimeout(() => setCapFlash(false), 900);
        return a;
      }
      return { ...a, symptoms: [...a.symptoms, id] };
    });
  };

  const toggleTrigger = (id: string) => {
    setAnswers((a) => {
      if (id === 'none') {
        return { ...a, triggers: a.triggers.includes('none') ? [] : ['none'] };
      }
      const withoutNone = a.triggers.filter((t) => t !== 'none');
      return {
        ...a,
        triggers: withoutNone.includes(id)
          ? withoutNone.filter((t) => t !== id)
          : [...withoutNone, id],
      };
    });
  };

  const toggleTimeOfDay = (id: string) => {
    setAnswers((a) => ({
      ...a,
      timeOfDay: a.timeOfDay.includes(id)
        ? a.timeOfDay.filter((t) => t !== id)
        : [...a.timeOfDay, id],
    }));
  };

  const setSingle = (field: keyof AdvisorAnswers, value: string) => {
    setAnswers((a) => ({ ...a, [field]: value }));
  };

  /* ------------------------------ navigation ------------------------------ */

  const goTo = (next: Phase, stepName: string) => {
    trackContent('quiz_step_completed', {
      step: PHASE_STEP[phase] ?? 0,
      step_name: stepName,
    });
    setPhase(next);
  };

  const start = () => {
    trackContentOnce('quiz-intro', 'quiz_started', {});
    setPhase('foundation');
  };

  const completeScreening = () => {
    if (!screeningComplete || !synthesis) return;
    const legacy = advisorLegacyIds(synthesis);
    trackContent('quiz_completed', {
      concern_id: legacy.concernId,
      form_id: legacy.formId,
    });
    // Interest profile (2026-10-14): completing the quiz is a +3 signal.
    recordInterestNow('quiz', 3);
    setPhase('lead');
  };

  const restart = () => {
    setPhase('intro');
    setAnswers(EMPTY_ADVISOR_ANSWERS);
    setScreeningAnswers(EMPTY_SCREENING);
    setLead({ name: '', email: '', consent: false });
    setLeadStatus('idle');
    setLeadErrors([]);
    setProfileSave('idle');
    setPdfStatus('idle');
  };

  /* ------------------------------ lead / saves ---------------------------- */

  const submitLead = async () => {
    if (!synthesis) return;
    setLeadStatus('sending');
    setLeadErrors([]);
    const legacy = advisorLegacyIds(synthesis);
    try {
      const res = await fetch('/api/quiz-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lead.name,
          email: lead.email,
          consent: lead.consent,
          concernId: legacy.concernId,
          formId: legacy.formId,
          screening,
          advisor: answers,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setLeadErrors(json.errors ?? ['Something went wrong — please try again.']);
        setLeadStatus('error');
        return;
      }
      setLeadStatus('done');
      // quiz_lead_captured is server-owned — the route fires it.
      setPhase('results');
    } catch {
      setLeadErrors(['Something went wrong — please try again.']);
      setLeadStatus('error');
    }
  };

  const saveToProfile = async () => {
    if (!synthesis) return;
    setProfileSave('saving');
    const legacy = advisorLegacyIds(synthesis);
    try {
      const res = await fetch('/api/account/quiz-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concernId: legacy.concernId,
          formId: legacy.formId,
          screening,
          advisor: answers,
        }),
      });
      const json = await res.json();
      setProfileSave(res.ok && json.ok ? 'saved' : 'error');
    } catch {
      setProfileSave('error');
    }
  };

  const downloadPdf = async () => {
    setPdfStatus('working');
    try {
      const res = await fetch('/api/quiz-results-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advisor: answers,
          screening,
          name: lead.name || null,
        }),
      });
      if (!res.ok) throw new Error('pdf failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-herbal-allies.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPdfStatus('idle');
    } catch {
      setPdfStatus('error');
    }
  };

  /* ------------------------------ render helpers -------------------------- */

  const stepHeader = (reassuranceKey: string) => (
    <>
      {PHASE_STEP[phase] && (
        <p className="quiz-progress">Step {PHASE_STEP[phase]} of 6</p>
      )}
      {ADVISOR_REASSURANCE[reassuranceKey] && (
        <p className="quiz-reassurance">✦ {ADVISOR_REASSURANCE[reassuranceKey]}</p>
      )}
    </>
  );

  const optionCards = (
    options: readonly AdvisorOption[],
    field: keyof AdvisorAnswers,
  ) => (
    <div className="quiz-options-col">
      {options.map((o) => {
        const selected = answers[field] === o.id;
        return (
          <button
            key={o.id}
            type="button"
            className={`quiz-card${selected ? ' selected' : ''}`}
            aria-pressed={selected}
            onClick={() => setSingle(field, o.id)}
          >
            <span className="quiz-card-label">{o.label}</span>
            {o.desc && <span className="quiz-card-desc">{o.desc}</span>}
          </button>
        );
      })}
    </div>
  );

  const pillRow = (options: readonly AdvisorOption[], field: keyof AdvisorAnswers) => (
    <div className="quiz-pills">
      {options.map((o) => {
        const selected = answers[field] === o.id;
        return (
          <button
            key={o.id}
            type="button"
            className={`quiz-pill${selected ? ' selected' : ''}`}
            aria-pressed={selected}
            onClick={() => setSingle(field, o.id)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );

  const actions = (back: Phase | null, next: (() => void) | null, nextLabel: string, nextDisabled = false) => (
    <div className="quiz-actions">
      {back ? (
        <button type="button" className="btn-secondary" onClick={() => setPhase(back)}>
          ← Back
        </button>
      ) : (
        <span />
      )}
      {next && (
        <button type="button" className="btn-primary" onClick={next} disabled={nextDisabled}>
          {nextLabel}
        </button>
      )}
    </div>
  );

  const builderHref = synthesis
    ? `${synthesis.formKey === 'loose-tea' ? '/custom-formula/tea' : '/custom-formula'}?herbs=${synthesis.allies
        .map((a) => a.id)
        .join(',')}`
    : '/custom-formula';

  /* --------------------------------- phases -------------------------------- */

  return (
    <section className="quiz" aria-label={`${BRAND_NAME} Herbal Allies Quiz`}>
      {phase === 'intro' && (
        <div className="quiz-intro">
          <p className="quiz-eyebrow">🌿 Your Guided Wellness Quiz</p>
          <h2>A quiet conversation — not a checklist.</h2>
          <p>
            Share what&apos;s asking for support, and we&apos;ll listen for
            the pattern beneath it — then gather the herbal allies that
            nourish that pattern, and the one personalized formula crafted around you.
            There are no wrong answers here, only listening.
          </p>
          <button type="button" className="btn-primary" onClick={start}>
            Begin the Quiz ✦
          </button>
        </div>
      )}

      {phase === 'foundation' && (
        <div className="quiz-step">
          {stepHeader('foundation')}
          <h2>What is asking for support right now?</h2>
          <p className="quiz-step-desc">
            This is the beginning of a conversation, not a checklist. You
            can pick more than one.
          </p>
          <div className="quiz-goal-grid">
            {ADVISOR_GOALS.map((g) => {
              const selected = answers.symptoms.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`quiz-goal${selected ? ' selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => toggleSymptom(g.id)}
                >
                  <span className="quiz-goal-check" aria-hidden="true">✓</span>
                  <span className="quiz-goal-icon">{g.icon}</span>
                  <span className="quiz-goal-label">{g.label}</span>
                  <span className="quiz-goal-desc">{g.desc}</span>
                </button>
              );
            })}
          </div>
          <p className={`quiz-hint${capFlash ? ' flash' : ''}`} role="status">
            {answers.symptoms.length === 0
              ? '✦ Choose whatever resonates — pick as many as feel true, up to five.'
              : `✦ You've chosen ${answers.symptoms.length}. Add more if they belong, or continue when you're ready.`}
          </p>
          {actions(null, () => goTo('shape', 'foundation'), 'Continue →', answers.symptoms.length === 0)}
        </div>
      )}

      {phase === 'shape' && (
        <div className="quiz-step">
          {stepHeader('shape')}
          <h2>Help us understand the shape of it.</h2>
          <p className="quiz-step-desc">
            These three questions help us hear the difference between a
            passing season and a deeper pattern.
          </p>
          <div className="quiz-question">
            <p className="quiz-q-text">How intense does it feel?</p>
            {optionCards(ADVISOR_INTENSITY, 'intensity')}
          </div>
          <div className="quiz-question">
            <p className="quiz-q-text">How often does it show up?</p>
            {optionCards(ADVISOR_FREQUENCY, 'frequency')}
          </div>
          <div className="quiz-question">
            <p className="quiz-q-text">How long has this been with you?</p>
            {optionCards(ADVISOR_DURATION, 'duration')}
          </div>
          {actions(
            'foundation',
            () => goTo('whole', 'shape'),
            'Continue →',
            !answers.intensity || !answers.frequency || !answers.duration,
          )}
        </div>
      )}

      {phase === 'whole' && (
        <div className="quiz-step">
          {stepHeader('wholeHuman')}
          <h2>The whole human, not just the symptom.</h2>
          <p className="quiz-step-desc">
            How you sleep, stress, digest, and feel — these shape which
            plants will actually meet you where you are.
          </p>
          <div className="quiz-question">
            <p className="quiz-q-text">How has your sleep been?</p>
            {pillRow(ADVISOR_SLEEP, 'sleep')}
          </div>
          <div className="quiz-question">
            <p className="quiz-q-text">How would you describe your stress level?</p>
            {pillRow(ADVISOR_STRESS, 'stressLevel')}
          </div>
          <div className="quiz-question">
            <p className="quiz-q-text">How is digestion feeling?</p>
            {pillRow(ADVISOR_DIGESTION, 'digestion')}
          </div>
          <div className="quiz-question">
            <p className="quiz-q-text">And emotionally?</p>
            {pillRow(ADVISOR_EMOTIONAL, 'emotional')}
          </div>
          <div className="quiz-question">
            <p className="quiz-q-text">
              What else might be adding to the load?{' '}
              <span className="quiz-q-sub">(optional — pick any)</span>
            </p>
            <div className="quiz-trigger-grid">
              {ADVISOR_TRIGGERS.map((t) => {
                const selected = answers.triggers.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`quiz-trigger${selected ? ' selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => toggleTrigger(t.id)}
                  >
                    <span className="quiz-trigger-check" aria-hidden="true">✓</span>
                    <span className="quiz-trigger-icon">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="quiz-hint">
              {answers.triggers.length === 0
                ? '✦ Optional — pick any that feel true right now.'
                : `✦ ${answers.triggers.length} selected. Add more if they belong.`}
            </p>
          </div>
          {actions(
            'shape',
            () => goTo('nuance', 'whole-human'),
            'Continue →',
            !answers.sleep || !answers.stressLevel || !answers.digestion || !answers.emotional,
          )}
        </div>
      )}

      {phase === 'nuance' && (
        <div className="quiz-step">
          {stepHeader('nuance')}
          <h2>A few final details.</h2>
          <p className="quiz-step-desc">
            Timing, sensitivity, and form — the nuances that make a formula
            truly yours.
          </p>
          <div className="quiz-question">
            <p className="quiz-q-text">
              When is this most present?{' '}
              <span className="quiz-q-sub">(pick one or more)</span>
            </p>
            <div className="quiz-options-col">
              {ADVISOR_TIME_OF_DAY.map((o) => {
                const selected = answers.timeOfDay.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`quiz-card${selected ? ' selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => toggleTimeOfDay(o.id)}
                  >
                    <span className="quiz-card-check" aria-hidden="true">✓</span>
                    <span className="quiz-card-label">
                      {o.icon} {o.label}
                    </span>
                    <span className="quiz-card-desc">{o.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="quiz-question">
            <p className="quiz-q-text">Which kind of support tends to suit you?</p>
            {optionCards(ADVISOR_SENSITIVITY, 'sensitivity')}
          </div>
          <div className="quiz-question">
            <p className="quiz-q-text">Is there a form you prefer?</p>
            <div className="quiz-options-col">
              {ADVISOR_FORMATS.map((o) => {
                const selected = answers.preferredFormat === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`quiz-card${selected ? ' selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => setSingle('preferredFormat', o.id)}
                  >
                    <span className="quiz-card-label">
                      {o.icon} {o.label}
                    </span>
                    <span className="quiz-card-desc">{o.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {actions(
            'whole',
            () => goTo('screening', 'nuance'),
            'Continue →',
            answers.timeOfDay.length === 0 || !answers.sensitivity || !answers.preferredFormat,
          )}
        </div>
      )}

      {phase === 'screening' && (
        <div className="quiz-step quiz-screening">
          {stepHeader('safety')}
          <h2>A few safety questions first</h2>
          <p className="quiz-step-desc">
            Herbs are not right for everyone. Your answers shape which
            product suggestions we show, and they are saved with your
            results only if you choose to save them.
          </p>
          {QUIZ_SCREENING_QUESTIONS.map((q) => (
            <fieldset key={q.key} className="quiz-screening-question">
              <legend>{q.question}</legend>
              <div className="quiz-pills">
                {([true, false] as const).map((value) => {
                  const selected = screeningAnswers[q.key] === value;
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      className={`quiz-pill quiz-yesno${selected ? ' selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() =>
                        setScreeningAnswers({ ...screeningAnswers, [q.key]: value })
                      }
                    >
                      {value ? 'Yes' : 'No'}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          {actions('nuance', completeScreening, 'See My Results', !screeningComplete)}
        </div>
      )}

      {phase === 'lead' && synthesis && (
        <div className="quiz-step quiz-lead-step">
          {stepHeader('lead')}
          <div className="quiz-lead-hero">
            <div className="quiz-lead-icon">✨</div>
            <h2>Your report is ready.</h2>
            <p>
              We&apos;ve matched your answers to a pattern and chosen your
              herbal allies. Enter your email to unlock it — and we&apos;ll
              send a copy you can return to.
            </p>
            <p className="quiz-focus-badge">
              Focus:{' '}
              {answers.symptoms
                .map((id) => ADVISOR_GOALS.find((g) => g.id === id)?.label ?? id)
                .slice(0, 3)
                .join(' · ')}
            </p>
          </div>
          <ul className="quiz-lead-benefits">
            <li>✦ Your personal herbal allies, matched to your pattern</li>
            <li>✦ Gentle wellness tips for your pattern</li>
            <li>✦ First look at seasonal creations</li>
            <li>✦ A refill reminder when you&apos;re near the end</li>
          </ul>
          <div className="quiz-lead">
            <label>
              First name
              <input
                type="text"
                value={lead.name}
                onChange={(e) => setLead({ ...lead, name: e.target.value })}
                maxLength={120}
                autoComplete="given-name"
                placeholder="Your first name"
              />
            </label>
            <label>
              Email address
              <input
                type="email"
                value={lead.email}
                onChange={(e) => setLead({ ...lead, email: e.target.value })}
                maxLength={254}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label className="quiz-consent">
              <input
                type="checkbox"
                checked={lead.consent}
                onChange={(e) => setLead({ ...lead, consent: e.target.checked })}
              />
              Yes — email my full results to me, save them with the
              apothecary, and send occasional apothecary notes. I can
              unsubscribe anytime. We never sell or share your information.
            </label>
            {leadErrors.length > 0 && (
              <ul className="quiz-errors" role="alert">
                {leadErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="quiz-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPhase('screening')}
              >
                ← Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={submitLead}
                disabled={leadStatus === 'sending'}
              >
                {leadStatus === 'sending' ? 'Unlocking…' : 'Unlock My Results →'}
              </button>
            </div>
            <button
              type="button"
              className="quiz-ghost"
              onClick={() => setPhase('results')}
            >
              Skip — just show me
            </button>
          </div>
        </div>
      )}

      {phase === 'results' && synthesis && (
        <div className="quiz-step quiz-results">
          <p className="quiz-reassurance">✦ {ADVISOR_REASSURANCE.results}</p>
          <h2>{lead.name ? `It's yours, ${lead.name}. We hear you.` : 'We hear you.'}</h2>
          {synthesis.summaryLines.map((line, i) => (
            <p key={i} className="quiz-summary-line">{line}</p>
          ))}

          {synthesis.patterns[1] || synthesis.patterns[0] ? (
            <div className="quiz-patterns">
              {synthesis.patterns.map((entry, idx) => (
                <div
                  key={entry.pattern.id}
                  className={`quiz-pattern-panel${idx === 0 ? ' primary' : ''}`}
                >
                  <p className="quiz-pattern-label">
                    {idx === 0 ? 'Primary Pattern' : 'Also Present'}
                  </p>
                  <h3>{entry.pattern.name}</h3>
                  <p>
                    <strong>Root support:</strong> {entry.pattern.rootSupport}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {(screening.pregnantOrNursing || screening.takingMedication || screening.managingCondition) && (
            <div className="quiz-safety-banner" role="alert">
              <p>{QUIZ_SAFETY_BANNER}</p>
              {synthesis.withheld.length > 0 && (
                <p>
                  Some product suggestions were withheld based on your
                  answers — the botanicals below remain yours to explore
                  and discuss with your clinician or pharmacist.
                </p>
              )}
            </div>
          )}

          <h3>Your Personal Herbal Allies</h3>
          <p className="quiz-section-sub">
            Each plant below was chosen for a specific reason — tied to
            what you shared. Traditionally used, gently prepared, and
            blended into one formula for you.
          </p>
          <div className="quiz-allies">
            {synthesis.allies.map((ally) => (
              <article key={ally.id} className="quiz-ally-card">
                <h4>
                  {ally.emoji} {ally.name}
                </h4>
                {ally.latin && <p className="quiz-ally-latin">{ally.latin}</p>}
                <p>
                  <strong>Primary benefit:</strong> {ally.benefit}
                </p>
                <p>
                  <strong>Chosen for you because:</strong> {ally.whyLine.replace('Chosen because of ', '').replace(/\.$/, '')}
                </p>
                {ally.traditionalNote && (
                  <p>
                    <strong>Traditional use:</strong> {ally.traditionalNote}
                  </p>
                )}
                <p>
                  <strong>Why it may help now:</strong> {ally.primaryBenefit}
                </p>
              </article>
            ))}
          </div>
          <div className="quiz-download-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={downloadPdf}
              disabled={pdfStatus === 'working'}
            >
              {pdfStatus === 'working'
                ? 'Preparing your PDF…'
                : pdfStatus === 'error'
                  ? 'Download didn’t land — try again'
                  : '⬇ Download My Results (PDF)'}
            </button>
          </div>

          <div className="quiz-why">
            <h3>{ADVISOR_WHY_ALLIES_HEADING}</h3>
            {ADVISOR_WHY_ALLIES_PARAGRAPHS.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p className="quiz-specialties">{ADVISOR_SPECIALTIES_LINE}</p>
            <div className="quiz-cta-row">
              <Link href="/contact" className="btn-primary">
                Book a Call or Zoom with Amber
              </Link>
              <a href={BRAND_PHONE_TEL.replace('tel:', 'sms:')} className="btn-secondary">
                Text Amber — {BRAND_PHONE_DISPLAY}
              </a>
              <a href={BRAND_PHONE_TEL} className="btn-secondary">
                Call {BRAND_PHONE_DISPLAY}
              </a>
            </div>
          </div>

          {synthesis.rituals.length > 0 && (
            <>
              <h3>Gentle Rituals for Your Pattern</h3>
              <p className="quiz-section-sub">
                Small, non-product practices that pair beautifully with
                your personalized formula.
              </p>
              <div className="quiz-rituals">
                {synthesis.rituals.map((r) => (
                  <div key={r.title} className="quiz-ritual">
                    <h4>{r.title}</h4>
                    <p>{r.desc}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="quiz-remedy">
            <p className="quiz-pattern-label">✦ Your One Personalized Formula</p>
            <h3>Your Custom {synthesis.formLabel}</h3>
            <p>
              A one-of-one blend, hand-prepared for{' '}
              <em>{synthesis.patterns[0]?.pattern.name ?? 'your personal pattern'}</em>,
              tuned to a <em>{answers.sensitivity ?? 'balanced'}</em> level
              of support.
            </p>
            <ul className="quiz-remedy-features">
              <li>✦ {synthesis.allies.length} plant allies, chosen from your answers</li>
              <li>✦ Prepared as {synthesis.formLabel.toLowerCase()}</li>
              <li>✦ Hand-blended in small batches, shipped promptly</li>
            </ul>
            {synthesis.formKey === 'capsule' && (
              <p className="quiz-capsule-note">{CAPSULE_EXPLAINER}</p>
            )}
            <div className="quiz-cta-row">
              <Link href={builderHref} className="btn-primary">
                Build My Custom Formula ⚗️
              </Link>
            </div>
          </div>

          {synthesis.productHandles.length > 0 && (
            <>
              <h3>From the apothecary</h3>
              <ul className="quiz-products">
                {synthesis.productHandles.map((handle) => (
                  <li key={handle}>
                    <Link href={`/shop/${handle}`}>{productTitle(handle)}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {accountEmail && (
            <div className="quiz-lead">
              <h3>Save to your profile</h3>
              {profileSave === 'saved' ? (
                <p className="quiz-lead-done">
                  ✦ Saved to your profile — find your allies any time at{' '}
                  <Link href="/account">My Profile</Link>.
                </p>
              ) : (
                <>
                  <p>
                    You&apos;re signed in as {accountEmail}. Keep these
                    allies in your profile, with your likes and searches.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={saveToProfile}
                    disabled={profileSave === 'saving'}
                  >
                    {profileSave === 'saving'
                      ? 'Saving…'
                      : profileSave === 'error'
                        ? 'Save didn’t land — try again'
                        : 'Save to My Profile'}
                  </button>
                </>
              )}
            </div>
          )}

          {leadStatus !== 'done' && !accountEmail && (
            <div className="quiz-lead">
              <h3>Want these in your inbox?</h3>
              <p>
                Share your email and we&apos;ll send your full results —
                your patterns, your allies, and why each was chosen — and
                save them under your name. Or{' '}
                <Link href="/account">create a free profile</Link> to keep
                them with your likes and searches.
              </p>
              <label>
                First name
                <input
                  type="text"
                  value={lead.name}
                  onChange={(e) => setLead({ ...lead, name: e.target.value })}
                  maxLength={120}
                  autoComplete="given-name"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={lead.email}
                  onChange={(e) => setLead({ ...lead, email: e.target.value })}
                  maxLength={254}
                  autoComplete="email"
                />
              </label>
              <label className="quiz-consent">
                <input
                  type="checkbox"
                  checked={lead.consent}
                  onChange={(e) => setLead({ ...lead, consent: e.target.checked })}
                />
                Yes — email my full results to me, save them with the
                apothecary, and send occasional apothecary notes. I can
                unsubscribe anytime. We never sell or share your information.
              </label>
              {leadErrors.length > 0 && (
                <ul className="quiz-errors" role="alert">
                  {leadErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={submitLead}
                disabled={leadStatus === 'sending'}
              >
                {leadStatus === 'sending' ? 'Sending…' : 'Send My Full Results ✨'}
              </button>
            </div>
          )}

          {leadStatus === 'done' && (
            <div className="quiz-lead">
              <p className="quiz-lead-done">
                ✨ Your full results are on their way to {lead.email} —
                please check your inbox (and your spam folder, just in
                case). They&apos;re also saved with the apothecary under
                your name.
              </p>
            </div>
          )}

          <ProfileInvite moment="quiz-results" />

          <p className="quiz-disclaimer">
            These botanical recommendations are crafted to support general
            wellness and self-care. They are not intended to diagnose,
            treat, cure, or prevent any disease. If you are pregnant,
            nursing, taking medications, or navigating a medical
            condition, please consult a qualified healthcare professional
            before use. {FDA_STATEMENT}
          </p>
          <div className="quiz-actions">
            <span />
            <button type="button" className="btn-secondary" onClick={restart}>
              Start Over
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
