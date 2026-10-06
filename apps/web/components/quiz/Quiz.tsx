/**
 * Herbal Allies Quiz — client island on the server quiz page (G6).
 *
 * Multi-step: intro → concern → form → results, with optional lead capture
 * (name/email + explicit consent) on the results screen. All question logic
 * lives in lib/quiz/quiz.ts; this component only renders steps.
 *
 * Analytics: quiz_started / quiz_step_completed / quiz_completed via
 * trackContent (client-owned). The lead submission is POSTed to
 * /api/quiz-lead, which records quiz_lead_captured server-side.
 */
'use client';

import { useState } from 'react';
import {
  QUIZ_CONCERNS,
  QUIZ_FORMS,
  QUIZ_STEP_NAMES,
  getQuizResult,
} from '../../lib/quiz/quiz';
import { trackContent, trackContentOnce } from '../../lib/analytics/content-posthog';
import { PRODUCTS } from '../../lib/catalog/products';
import { BRAND_NAME } from '../../lib/seo/config';

type Phase = 'intro' | 'concern' | 'form' | 'results';

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
  const [lead, setLead] = useState<LeadState>({ name: '', email: '', consent: false });
  const [leadStatus, setLeadStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [leadErrors, setLeadErrors] = useState<string[]>([]);

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
    trackContent('quiz_completed', { concern_id: concernId, form_id: id });
    setPhase('results');
  };

  const restart = () => {
    setPhase('intro');
    setConcernId(null);
    setFormId(null);
    setLead({ name: '', email: '', consent: false });
    setLeadStatus('idle');
    setLeadErrors([]);
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

  const result = concernId && formId ? getQuizResult(concernId, formId) : null;

  return (
    <section className="quiz" aria-label={`${BRAND_NAME} Herbal Allies Quiz`}>
      {phase === 'intro' && (
        <div className="quiz-intro">
          <h2>🌿 Find Your Herbal Allies</h2>
          <p>
            Not sure where to begin? Answer two questions and discover the
            herbal allies best suited to your body right now.
          </p>
          <button className="btn-primary" onClick={start}>
            Start My Quiz ✦
          </button>
        </div>
      )}

      {phase === 'concern' && (
        <div className="quiz-step">
          <p className="quiz-progress">Step 1 of 2</p>
          <h2>What is your primary concern right now?</h2>
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
          <p className="quiz-progress">Step 2 of 2</p>
          <h2>How would you prefer to take your remedy?</h2>
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

      {phase === 'results' && result && (
        <div className="quiz-step quiz-results">
          <h2>✦ Your Herbal Allies ✦</h2>
          <p className="quiz-reason">{result.productReason}</p>

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
                <a href={`/shop/${handle}`}>{productTitle(handle)}</a>
              </li>
            ))}
          </ul>

          <div className="quiz-lead">
            <h3>Want your results by email?</h3>
            {leadStatus === 'done' ? (
              <p className="quiz-lead-done">
                ✨ Received — welcome to the apothecary circle. Your results are on their way.
              </p>
            ) : (
              <>
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
                  Yes — send my results and occasional apothecary notes. I can
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
                  {leadStatus === 'sending' ? 'Sending…' : 'Send My Results'}
                </button>
              </>
            )}
          </div>

          <p className="quiz-disclaimer">
            Educational only — these suggestions are not medical advice and are
            not intended to diagnose, treat, cure, or prevent any disease.
          </p>
          <button className="btn-secondary" onClick={restart}>
            Start Over
          </button>
        </div>
      )}
    </section>
  );
}
