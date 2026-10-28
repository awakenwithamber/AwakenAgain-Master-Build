/**
 * POST /api/quiz-results-pdf — download the quiz results as a PDF.
 *
 * Owner directive 2026-10-22: after the quiz, the visitor can download
 * a real PDF listing the botanicals their answers point to and why.
 * Body: { advisor: AdvisorAnswers, screening?: QuizScreening, name? }.
 * The synthesis is recomputed server-side from the answers (the
 * client's rendered result is never trusted as the document), then
 * rendered by lib/quiz/results-pdf.ts.
 */
import { NextResponse } from 'next/server';
import { normalizeQuizScreening } from '../../../lib/quiz/quiz';
import {
  computeAdvisorSynthesis,
  normalizeAdvisorAnswers,
  toAdvisorResultSnapshot,
} from '../../../lib/quiz/advisor';
import { buildQuizResultsPdf } from '../../../lib/quiz/results-pdf';
import { enforceRateLimit } from '../../../lib/security/rate-limit';

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, 'quiz-results-pdf');
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, errors: ['Request body must be valid JSON.'] },
      { status: 400 },
    );
  }

  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const answers = normalizeAdvisorAnswers(record.advisor);
  if (!answers || answers.symptoms.length === 0) {
    return NextResponse.json(
      { ok: false, errors: ['Your quiz answers could not be read — please retake the quiz.'] },
      { status: 422 },
    );
  }
  const name =
    typeof record.name === 'string' && record.name.trim().length > 0
      ? record.name.trim().slice(0, 120)
      : null;

  const synthesis = computeAdvisorSynthesis(
    answers,
    normalizeQuizScreening(record.screening),
  );
  const snapshot = toAdvisorResultSnapshot(synthesis);
  const pdf = buildQuizResultsPdf({
    snapshot,
    name,
    dateStr: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  });

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="my-herbal-allies.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}
