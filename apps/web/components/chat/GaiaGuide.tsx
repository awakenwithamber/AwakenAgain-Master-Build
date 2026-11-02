/**
 * Gaia beginner guide — the short questionnaire inside the Gaia panel
 * (combined build 2026-11-02).
 *
 * Shows Amber's exact beginner wording, asks at most two questions,
 * and ends on a recommendation card that links to the section Gaia
 * picked (lib/chat/gaia-guide — pure, page-aware routing). It never
 * blocks or limits the chat itself: the free-text box stays available
 * the whole time, and there is deliberately NO message-count gate
 * here (that is a separate, later owner decision).
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GAIA_BEGINNER_WORDING,
  GAIA_GOAL_OPTIONS,
  GAIA_GOAL_QUESTION,
  GAIA_INTEREST_OPTIONS,
  GAIA_INTEREST_QUESTION,
  gaiaRecommendation,
  goalNeedsInterest,
  type GaiaGoal,
  type GaiaInterest,
} from '../../lib/chat/gaia-guide';

export function GaiaGuide() {
  const pathname = usePathname() ?? '/';
  const [started, setStarted] = useState(false);
  const [goal, setGoal] = useState<GaiaGoal | null>(null);
  const [interest, setInterest] = useState<GaiaInterest | null>(null);

  const done =
    goal !== null && (!goalNeedsInterest(goal) || interest !== null);
  const recommendation = done
    ? gaiaRecommendation(goal, interest, pathname)
    : null;

  function restart() {
    setStarted(true);
    setGoal(null);
    setInterest(null);
  }

  return (
    <div className="gaia-guide">
      <p className="gaia-guide-wording">{GAIA_BEGINNER_WORDING}</p>

      {!started && (
        <button type="button" className="gaia-guide-start" onClick={restart}>
          Start the short questionnaire
        </button>
      )}

      {started && goal === null && (
        <fieldset className="gaia-guide-step">
          <legend>{GAIA_GOAL_QUESTION}</legend>
          {GAIA_GOAL_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className="gaia-guide-option"
              onClick={() => setGoal(o.value)}
            >
              {o.label}
            </button>
          ))}
        </fieldset>
      )}

      {started && goal !== null && goalNeedsInterest(goal) && interest === null && (
        <fieldset className="gaia-guide-step">
          <legend>{GAIA_INTEREST_QUESTION}</legend>
          {GAIA_INTEREST_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className="gaia-guide-option"
              onClick={() => setInterest(o.value)}
            >
              {o.label}
            </button>
          ))}
        </fieldset>
      )}

      {recommendation && (
        <div className="gaia-guide-result">
          <p>{recommendation.blurb}</p>
          <p className="gaia-guide-actions">
            <Link
              className="gaia-guide-go"
              href={recommendation.href}
            >
              {recommendation.label} →
            </Link>{' '}
            <button
              type="button"
              className="gaia-guide-again"
              onClick={restart}
            >
              Start over
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
