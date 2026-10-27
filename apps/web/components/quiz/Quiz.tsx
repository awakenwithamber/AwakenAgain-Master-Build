/**
 * Herbal Allies Quiz — client island on the server quiz page (G6).
 *
 * Multi-step: intro → concern → form → safety screening → results, with
 * optional lead capture (name/email + explicit consent) on the results
 * screen. All question logic lives in lib/quiz/quiz.ts; this component
 * only renders steps.
 *
 * Stage 4 (R-14/R-15): the screening step asks pregnant-or-nursing /
 * prescription-medication / managing-a-condition before results; the
 * answers travel with the lead/profile saves and are stored on the
 * result snapshot. Framing is educational throughout — the quiz
 * explores herbal allies by focus area; it does not assess a body or
 * match a personalized formula to a person.
 *
 * Analytics: quiz_started / quiz_step_completed / quiz_completed via
 * trackContent (client-owned). The lead submission is POSTed to
 * /api/quiz-lead, which records quiz_lead_captured server-side.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  QUIZ_CONCERNS,
  QUIZ_FORMS,
  QUIZ_SCREENING_QUESTIONS,
  QUIZ_SAFETY_BANNER,
  QUIZ_STEP_NAMES,
  getQuizResult,
  type QuizScreening,
} from '../../lib/quiz/quiz';
import { FDA_STATEMENT } from '../../lib/safety/product-safety';
import { trackContent, trackContentOnce } from '../../lib/analytics/content-posthog';
import { recordInterestNow } from '../../lib/personalization/client';
import { fetchAccountProfile } from '../../lib/accounts/client';
import { ProfileInvite } from '../personalization/ProfileInvite';
import { PRODUCTS } from '../../lib/catalog/products';
import { BRAND_NAME } from '../../lib/seo/config';

type Phase = 'intro' | 'concern' | 'form' | 'screening' | 'results';

/** Screening answers in progress: null = not answered yet. */
type ScreeningAnswers = Record<keyof QuizScreening, boolean | null>;

const EMPTY_SCREENING_ANSWERS: ScreeningAnswers = {
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
  const [concernId, setConcernId] = useState<string | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [screeningAnswers, setScreeningAnswers] =
    useState<ScreeningAnswers>(EMPTY_SCREENING_ANSWERS);
  const [lead, setLead] = useState<LeadState>({ name: '', email: '', consent: false });
  const [leadStatus, setLeadStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [leadErrors, setLeadErrors] = useState<string[]>([]);
  // Account state for the results screen (Phase 3 Step 3): signed-in
  // visitors save the result straight to their profile instead of the
  // email lead form. undefined = not checked yet, null = signed out.
  const [accountEmail, setAccountEmail] = useState<string | null | undefined>(undefined);
  const [profileSave, setProfileSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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

  const screeningComplete =
    screeningAnswers.pregnantOrNursing !== null &&
    screeningAnswers.takingMedication !== null &&
    screeningAnswers.managingCondition !== null;
  const screening: QuizScreening = {
    pregnantOrNursing: screeningAnswers.pregnantOrNursing === true,
    takingMedication: screeningAnswers.takingMedication === true,
    managingCondition: screeningAnswers.managingCondition === true,
  };

  const saveToProfile = async () => {
    if (!concernId || !formId) return;
    setProfileSave('saving');
    try {
      const res = await fetch('/api/account/quiz-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concernId, formId, screening }),
      });
      const json = await res.json();
      setProfileSave(res.ok && json.ok ? 'saved' : 'error');
    } catch {
      setProfileSave('error');
    }
  };

  const start = () => {
    trackContentOnce('quiz-intro', 'quiz_started', {});
    setPhase('concern');
  };

  const pickConcern = (id: string) => {
    setConcernId(id);
    trackContent('quiz_step_completed', {
      step: 1,
      step_name: QUIZ_STEP_NAMES[0],
      concern_id: id,
    });
    setPhase('form');
  };

  const pickForm = (id: string) => {
    if (!concernId) return;
    setFormId(id);
    trackContent('quiz_step_completed', { step: 2, step_name: QUIZ_STEP_NAMES[1], concern_id: concernId });
    setPhase('screening');
  };

  const submitScreening = () => {
    if (!concernId || !formId || !screeningComplete) return;
    trackContent('quiz_step_completed', { step: 3, step_name: QUIZ_STEP_NAMES[2], concern_id: concernId });
    trackContent('quiz_completed', { concern_id: concernId, form_id: formId });
    // Interest profile (2026-10-14): completing the quiz is a +3 quiz
    // signal. Consent-gated inside recordInterest.
    recordInterestNow('quiz', 3);
    setPhase('results');
  };

  const restart = () => {
    setPhase('intro');
    setConcernId(null);
    setFormId(null);
    setScreeningAnswers(EMPTY_SCREENING_ANSWERS);
    setLead({ name: '', email: '', consent: false });
    setLeadStatus('idle');
    setLeadErrors([]);
    setProfileSave('idle');
  };

  const submitLead = async () => {
    if (!concernId || !formId) return;
    setLeadStatus('sending');
    setLeadErrors([]);
    try {
      const res = await fetch('/api/quiz-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lead.name,
          email: lead.email,
          consent: lead.consent,
          concernId,
          formId,
          screening,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setLeadErrors(json.errors ?? ['Something went wrong — please try again.']);
        setLeadStatus('error');
        return;
      }
      setLeadStatus('done');
    } catch {
      setLeadErrors(['Something went wrong — please try again.']);
      setLeadStatus('error');
    }
  };

  const result =
    concernId && formId ? getQuizResult(concernId, formId, screening) : null;

  return (
    <section className="quiz" aria-label={`${BRAND_NAME} Herbal Allies Quiz`}>
      {phase === 'intro' && (
        <div className="quiz-intro">
          <h2>✦ Explore Herbal Allies by Focus Area ✦</h2>
          <p>
            Not sure where to begin? Choose a focus area and a form you
            enjoy, answer a few safety questions, and explore herbal
            allies that are traditionally used to support that area.
          </p>
          <button className="btn-primary" onClick={start}>
            Start the Quiz ✦
          </button>
        </div>
      )}

      {phase === 'concern' && (
        <div className="quiz-step">
          <p className="quiz-progress">Step 1 of 3</p>
          <h2>Which focus area would you like to explore?</h2>
          <div className="quiz-options">
            {QUIZ_CONCERNS.map((c) => (
              <button
                key={c.id}
                className="quiz-opt"
                onClick={() => pickConcern(c.id)}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'form' && (
        <div className="quiz-step">
          <p className="quiz-progress">Step 2 of 3</p>
          <h2>Which form would you like to explore?</h2>
          <div className="quiz-options">
            {QUIZ_FORMS.map((f) => (
              <button key={f.id} className="quiz-opt" onClick={() => pickForm(f.id)}>
                {f.icon} {f.label}
              </button>
            ))}
          </div>
          <button className="btn-secondary" onClick={() => setPhase('concern')}>
            ← Back
          </button>
        </div>
      )}

      {phase === 'screening' && (
        <div className="quiz-step quiz-screening">
          <p className="quiz-progress">Step 3 of 3</p>
          <h2>A few safety questions first</h2>
          <p>
            Herbs are not right for everyone. Your answers shape which
            product suggestions we show, and they are saved with your
            results only if you choose to save them.
          </p>
          {QUIZ_SCREENING_QUESTIONS.map((q) => (
            <fieldset key={q.key} className="quiz-screening-question">
              <legend>{q.question}</legend>
              <div className="quiz-options">
                <button
                  type="button"
                  className="quiz-opt"
                  aria-pressed={screeningAnswers[q.key] === true}
                  onClick={() =>
                    setScreeningAnswers({ ...screeningAnswers, [q.key]: true })
                  }
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="quiz-opt"
                  aria-pressed={screeningAnswers[q.key] === false}
                  onClick={() =>
                    setScreeningAnswers({ ...screeningAnswers, [q.key]: false })
                  }
                >
                  No
                </button>
              </div>
            </fieldset>
          ))}
          <button
            className="btn-primary"
            onClick={submitScreening}
            disabled={!screeningComplete}
          >
            See My Results
          </button>
          <button className="btn-secondary" onClick={() => setPhase('form')}>
            ← Back
          </button>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="quiz-step quiz-results">
          <h2>✦ Your Herbal Allies ✦</h2>
          <p className="quiz-reason">{result.productReason}</p>

          {result.hasSafetyFlags && (
            <div className="quiz-safety-banner" role="alert">
              <p>{QUIZ_SAFETY_BANNER}</p>
              {result.withheld.length > 0 && (
                <p>
                  Some product suggestions were withheld based on your
                  answers — the botanicals below remain yours to explore
                  and discuss with your clinician or pharmacist.
                </p>
              )}
            </div>
          )}

          <h3>Botanicals to explore</h3>
          <ul className="quiz-allies">
            {result.allies.map((ally) => (
              <li key={ally.name}>
                <strong>{ally.name}</strong>{' '}
                <em>({ally.latin})</em>
                <p>{ally.note}</p>
              </li>
            ))}
          </ul>

          <h3>From the apothecary</h3>
          <ul className="quiz-products">
            {result.productHandles.map((handle) => (
              <li key={handle}>
                <Link href={`/shop/${handle}`}>{productTitle(handle)}</Link>
              </li>
            ))}
          </ul>

          {accountEmail && (
            <div className="quiz-lead">
              <h3>Save to your profile</h3>
              {profileSave === 'saved' ? (
                <p className="quiz-lead-done">
                  ✦ Saved to your profile — find your allies any time at{' '}
                  <Link href="/account">My Account</Link>.
                </p>
              ) : (
                <>
                  <p>
                    You&apos;re signed in as {accountEmail}. Keep these
                    allies in your profile, with your likes and searches.
                  </p>
                  <button
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

          <div className="quiz-lead">
            {/* Honesty (audit 2026-10-15 BROKEN-1): no email provider is
                bound yet, so this copy promises only what happens today —
                results are SAVED with the apothecary; the email is sent
                when delivery opens. Never "on their way" until then. */}
            <h3>Keep your results</h3>
            {leadStatus === 'done' ? (
              <p className="quiz-lead-done">
                ✨ Saved — welcome to the apothecary circle. Your results are
                saved with us, and we&apos;ll email them to you as soon as
                email delivery opens.
              </p>
            ) : (
              <>
                <p>
                  Your allies live on this page. Share your email and
                  we&apos;ll save your results under your name — when email
                  delivery opens, your results will be sent to you. Or{' '}
                  <Link href="/account">create a free profile</Link> to
                  keep them with your likes and searches.
                </p>
                <label>
                  Name
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
                  Yes — save my results, email them to me when delivery
                  opens, and send occasional apothecary notes. I can
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
                  className="btn-primary"
                  onClick={submitLead}
                  disabled={leadStatus === 'sending'}
                >
                  {leadStatus === 'sending' ? 'Saving…' : 'Save My Results'}
                </button>
              </>
            )}
          </div>

          <ProfileInvite moment="quiz-results" />

          <p className="quiz-disclaimer">
            Educational only — these suggestions are not medical advice and are
            not intended to diagnose, treat, cure, or prevent any disease.{' '}
            {FDA_STATEMENT}
          </p>
          <div className="quiz-actions">
            <Link href="/custom-formula" className="btn-primary">
              Build My Custom Blend ⚗️
            </Link>
            <button className="btn-secondary" onClick={restart}>
              Start Over
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
