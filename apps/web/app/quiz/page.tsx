/**
 * /quiz — Herbal Allies Quiz (G6, restored 2026-10-22).
 *
 * Server page (metadata) with the quiz as a client island. The island
 * is the restored Guided Wellness Quiz — the Synthesis conversation
 * from the legacy site — on the engine in lib/quiz/advisor.ts, with the
 * Stage 4 safety screening kept. Stage 4 (R-15) framing still applies:
 * educational orientation, never a diagnosis or a prescription.
 */
import type { Metadata } from 'next';
import Quiz from '../../components/quiz/Quiz';
import { BRAND_NAME } from '../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Herbal Allies Quiz — Your Guided Wellness Quiz',
  description: `A quiet, guided conversation that listens for the pattern beneath what you are feeling — then gathers the herbal allies, gentle rituals, and one personalized formula that fits. ${BRAND_NAME}.`,
};

export default function QuizPage() {
  return (
    <main id="main-content" className="page quiz-page">
      <Quiz />
    </main>
  );
}
