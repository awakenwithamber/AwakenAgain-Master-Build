/**
 * Quiz session persistence — Results First (owner decision 2026-11-08).
 *
 * The audit's root-cause finding #3 was volatility: quiz answers lived
 * only in React state, so a refresh, a navigation away, or a browser
 * restart anywhere in the flow — including ON the results — reset the
 * visitor to the intro and the finished results were unrecoverable.
 *
 * This module persists the in-progress answers, the safety-screening
 * answers, and the current phase to sessionStorage (the audit's §1
 * package: sessionStorage is the sanctioned store for this). The
 * results themselves are a pure function of the answers (see
 * computeAdvisorSynthesis in lib/quiz/advisor.ts), so restoring the
 * answers + screening on the results phase restores the exact results
 * the visitor saw — no email, account, or server round-trip involved.
 *
 * Pure over a Storage-like interface so the round-trip is unit-testable
 * without a DOM. Every function swallows storage errors (private-mode
 * quotas, disabled storage): persistence must never break the quiz.
 */
import {
  EMPTY_ADVISOR_ANSWERS,
  normalizeAdvisorAnswers,
  type AdvisorAnswers,
} from './advisor';

export const QUIZ_SESSION_KEY = 'aaa-herbal-quiz-v1';

/** The phases the quiz island can be in (the lead/email phase is gone —
 *  Results First removed it; see loadQuizSession's legacy mapping). */
export type QuizPhase =
  | 'intro'
  | 'foundation'
  | 'shape'
  | 'whole'
  | 'nuance'
  | 'screening'
  | 'results';

const QUIZ_PHASES: readonly string[] = [
  'intro',
  'foundation',
  'shape',
  'whole',
  'nuance',
  'screening',
  'results',
];

/** Screening answers mid-flow: each question is unanswered (null) until
 *  the visitor picks Yes/No. Mirrors the component's ScreeningAnswers. */
export interface QuizScreeningAnswers {
  pregnantOrNursing: boolean | null;
  takingMedication: boolean | null;
  managingCondition: boolean | null;
}

export const EMPTY_QUIZ_SCREENING_ANSWERS: QuizScreeningAnswers = {
  pregnantOrNursing: null,
  takingMedication: null,
  managingCondition: null,
};

export interface SavedQuizSession {
  phase: QuizPhase;
  answers: AdvisorAnswers;
  screening: QuizScreeningAnswers;
}

/** The slice of the Web Storage API this module needs. */
export interface QuizStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function saveQuizSession(storage: QuizStorage, session: SavedQuizSession): void {
  try {
    storage.setItem(QUIZ_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable/full — the quiz keeps working in-memory.
  }
}

function cleanScreening(value: unknown): QuizScreeningAnswers {
  const r = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  const pick = (v: unknown): boolean | null =>
    v === true ? true : v === false ? false : null;
  return {
    pregnantOrNursing: pick(r.pregnantOrNursing),
    takingMedication: pick(r.takingMedication),
    managingCondition: pick(r.managingCondition),
  };
}

/**
 * Load and validate a saved session. Returns null when nothing usable
 * is stored (absent, corrupt, or not an object). Answers pass through
 * normalizeAdvisorAnswers, so unknown ids from an older build are
 * dropped rather than trusted. A session saved by the pre-Results-First
 * build could sit on the removed 'lead' phase — it restores to
 * 'results' (the answers are complete by then; the email step no
 * longer exists). Any phase past Foundation with no goals chosen is
 * inconsistent and restores to the intro.
 */
export function loadQuizSession(storage: QuizStorage): SavedQuizSession | null {
  let raw: string | null;
  try {
    raw = storage.getItem(QUIZ_SESSION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const answers = normalizeAdvisorAnswers(record.answers) ?? EMPTY_ADVISOR_ANSWERS;

  let phase = typeof record.phase === 'string' ? record.phase : 'intro';
  if (phase === 'lead') phase = 'results';
  if (!QUIZ_PHASES.includes(phase)) phase = 'intro';
  if (
    answers.symptoms.length === 0 &&
    phase !== 'intro' &&
    phase !== 'foundation'
  ) {
    phase = 'intro';
  }
  return {
    phase: phase as QuizPhase,
    answers,
    screening: cleanScreening(record.screening),
  };
}

/** Start Over: the saved session goes away with the in-memory one. */
export function clearQuizSession(storage: QuizStorage): void {
  try {
    storage.removeItem(QUIZ_SESSION_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
