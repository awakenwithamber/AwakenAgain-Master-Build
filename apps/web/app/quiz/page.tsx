/**
 * /quiz — Herbal Allies Quiz (G6).
 *
 * Server page (metadata) with the quiz as a client island.
 * Stage 4 (R-15): the surface is framed educationally — explore
 * herbal allies by focus area — not as a personal formula match.
 */
import type { Metadata } from 'next';
import Quiz from '../../components/quiz/Quiz';
import { BRAND_NAME } from '../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Explore Herbal Allies by Focus Area',
  description: `Explore herbal allies by focus area — choose a focus and a form, answer a few safety questions, and discover botanicals traditionally used to support that area. ${BRAND_NAME}.`,
};

export default function QuizPage() {
  return (
    <main id="main-content" className="page quiz-page">
      <Quiz />
    </main>
  );
}
