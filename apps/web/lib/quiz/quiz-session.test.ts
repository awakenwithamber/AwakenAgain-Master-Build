/**
 * Quiz session persistence (Results First, owner decision 2026-11-08).
 *
 * The audit's root cause #3: answers lived only in React state, so a
 * refresh lost the quiz — and the finished results with it. These
 * tests pin the storage round-trip the component relies on: save →
 * "remount" (a fresh load) → the same phase, answers, and screening
 * come back, and the synthesis recomputed from them is the same
 * results the visitor saw. Start Over clears the saved session.
 */
import { describe, expect, it } from 'vitest';
import {
  QUIZ_SESSION_KEY,
  clearQuizSession,
  loadQuizSession,
  saveQuizSession,
  type QuizStorage,
  type SavedQuizSession,
} from './quiz-session';
import {
  computeAdvisorSynthesis,
  type AdvisorAnswers,
} from './advisor';

function memoryStorage(): QuizStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

const ANSWERS: AdvisorAnswers = {
  symptoms: ['beauty'],
  intensity: 'moderate',
  frequency: 'frequent',
  duration: 'weeks',
  sleep: 'restful',
  stressLevel: 'calm',
  digestion: 'smooth',
  emotional: 'steady',
  triggers: ['seasonal'],
  timeOfDay: ['morning'],
  sensitivity: 'gentle',
  preferredFormat: 'serum',
};

const SESSION: SavedQuizSession = {
  phase: 'results',
  answers: ANSWERS,
  screening: {
    pregnantOrNursing: false,
    takingMedication: true,
    managingCondition: null,
  },
};

describe('quiz session persistence', () => {
  it('round-trips phase, answers, and screening through storage', () => {
    const storage = memoryStorage();
    saveQuizSession(storage, SESSION);
    // A fresh load is the simulated remount after a refresh.
    const restored = loadQuizSession(storage);
    expect(restored).not.toBeNull();
    expect(restored!.phase).toBe('results');
    expect(restored!.answers).toEqual(ANSWERS);
    expect(restored!.screening).toEqual(SESSION.screening);
  });

  it('restores the RESULTS themselves: the recomputed synthesis is identical', () => {
    const storage = memoryStorage();
    saveQuizSession(storage, SESSION);
    const restored = loadQuizSession(storage)!;
    const toScreening = (s: typeof SESSION.screening) => ({
      pregnantOrNursing: s.pregnantOrNursing === true,
      takingMedication: s.takingMedication === true,
      managingCondition: s.managingCondition === true,
    });
    const before = computeAdvisorSynthesis(ANSWERS, toScreening(SESSION.screening));
    const after = computeAdvisorSynthesis(restored.answers, toScreening(restored.screening));
    expect(after.patterns.map((p) => p.pattern.id)).toEqual(
      before.patterns.map((p) => p.pattern.id),
    );
    expect(after.allies.map((a) => a.id)).toEqual(
      before.allies.map((a) => a.id),
    );
  });

  it('restores an in-progress session mid-flow', () => {
    const storage = memoryStorage();
    saveQuizSession(storage, { ...SESSION, phase: 'whole' });
    expect(loadQuizSession(storage)!.phase).toBe('whole');
  });

  it('Start Over clears the saved session', () => {
    const storage = memoryStorage();
    saveQuizSession(storage, SESSION);
    clearQuizSession(storage);
    expect(storage.map.has(QUIZ_SESSION_KEY)).toBe(false);
    expect(loadQuizSession(storage)).toBeNull();
  });

  it('maps a legacy saved "lead" phase to results (the gate is gone)', () => {
    const storage = memoryStorage();
    storage.setItem(
      QUIZ_SESSION_KEY,
      JSON.stringify({ ...SESSION, phase: 'lead' }),
    );
    expect(loadQuizSession(storage)!.phase).toBe('results');
  });

  it('returns null for absent, corrupt, or inconsistent saves', () => {
    const storage = memoryStorage();
    expect(loadQuizSession(storage)).toBeNull();
    storage.setItem(QUIZ_SESSION_KEY, '{not json');
    expect(loadQuizSession(storage)).toBeNull();
    storage.setItem(QUIZ_SESSION_KEY, '"just a string"');
    expect(loadQuizSession(storage)).toBeNull();
    // Results phase with no goals chosen is inconsistent → intro.
    storage.setItem(
      QUIZ_SESSION_KEY,
      JSON.stringify({
        phase: 'results',
        answers: { ...ANSWERS, symptoms: [] },
        screening: SESSION.screening,
      }),
    );
    expect(loadQuizSession(storage)!.phase).toBe('intro');
  });

  it('never throws on a broken storage backend', () => {
    const broken: QuizStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => saveQuizSession(broken, SESSION)).not.toThrow();
    expect(() => clearQuizSession(broken)).not.toThrow();
    expect(loadQuizSession(broken)).toBeNull();
  });
});
