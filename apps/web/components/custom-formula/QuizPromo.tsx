/**
 * Herbal Allies Quiz promotion (copy pack 2026-10-25 §2).
 *
 * Rendered on the form-guide landing (/custom-formula) and above both
 * FormulaBuilders. Copy is verbatim from the copy pack. Presentational
 * server-safe component (no hooks) so it can sit in server pages and
 * above the client builder island alike.
 */
import Link from 'next/link';

const wrapStyle: React.CSSProperties = {
  maxWidth: '52rem',
  margin: '2rem auto',
  padding: '1.5rem 1.75rem',
  border: '1px solid var(--aa-gold)',
  borderRadius: '1rem',
  background: 'linear-gradient(160deg, var(--plum-mid), var(--plum-deep))',
  textAlign: 'center',
};

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display, "Cinzel Decorative", serif)',
  color: 'var(--parchment)',
  margin: '0 0 0.75rem',
  fontSize: '1.45rem',
  lineHeight: 1.3,
};

const bodyStyle: React.CSSProperties = {
  color: 'var(--text-body)',
  lineHeight: 1.65,
  margin: '0 auto 1.1rem',
  maxWidth: '42rem',
};

const smallStyle: React.CSSProperties = {
  color: 'var(--aa-cream-dim)',
  fontSize: '0.92rem',
  margin: '0.9rem auto 0',
  maxWidth: '40rem',
};

const ctaStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.65rem 1.4rem',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, var(--brass), var(--brass-lt))',
  color: 'var(--plum-dark)',
  fontWeight: 700,
  textDecoration: 'none',
};

export function QuizPromo() {
  return (
    <section style={wrapStyle} aria-label="Herbal Allies Quiz">
      <h2 style={headingStyle}>Feeling Lost? Let the Quiz Be Your Garden Gate. 🌿</h2>
      <p style={bodyStyle}>
        Choosing herbs without a guide is like picking a book by its cover —
        pretty, but you can&apos;t tell what&apos;s inside. The Herbal Allies Quiz asks a
        few gentle questions about your body, your days, and what you&apos;re hoping
        to feel, then introduces you to the plants most likely to become your
        allies. Two minutes, no knowledge needed, and your results come with a
        plain-language explanation of what each herb does and how to use it.
      </p>
      <Link href="/quiz" style={ctaStyle}>
        Take the Herbal Allies Quiz →
      </Link>
      <p style={smallStyle}>
        Lost or overwhelmed at any point on this site? That&apos;s what the
        quiz — and Gaia, your guide in the corner — are for.
      </p>
    </section>
  );
}
