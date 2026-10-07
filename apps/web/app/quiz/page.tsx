/**
 * /quiz — Herbal Allies Quiz (G6).
 *
 * Server page (metadata) with the quiz as a client island.
 */
import type { Metadata } from 'next';
import Quiz from '../../components/quiz/Quiz';
import { BRAND_NAME } from '../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Find My Remedy',
  description: `Find My Remedy — answer two questions and discover the herbal allies suited to you. ${BRAND_NAME}.`,
};

export default function QuizPage() {
  return (
    <main id="main-content" className="page quiz-page">
      <Quiz />
    </main>
  );
}
