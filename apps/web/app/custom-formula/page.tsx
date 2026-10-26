/**
 * /custom-formula — "Choose your form" consultation landing (2026-10-25).
 *
 * Was: the capsule builder rendered directly, so the Free Consultation
 * link dropped newcomers onto the least familiar form (capsules) with
 * no explanation of the alternatives. Now: a guide landing in Amber's
 * fixed order — Tea, Balm, Tincture, Serum, Capsules — each card with
 * its tagline, what-it-is, and Body / Mind / Soul lines (copy pack §1,
 * verbatim), the Tincture-vs-Serum explainer between Serum and
 * Capsules, the Herbal Allies Quiz promo, and a Message Amber trigger.
 * The capsule builder itself moved to /custom-formula/capsules; the tea
 * builder stays at /custom-formula/tea.
 *
 * Server component; the only client islands are the shared contact
 * popup trigger and the quiz promo's link.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FORM_GUIDE,
  FORM_GUIDE_INTRO,
  TINCTURE_VS_SERUM,
  type FormGuideEntry,
} from '../../lib/custom-formula/forms-guide';
import { QuizPromo } from '../../components/custom-formula/QuizPromo';
import { ContactPopupTrigger } from '../../components/contact/ContactPopup';

export const metadata: Metadata = {
  title: 'Choose Your Form — Free Custom Formula Consultation',
  description:
    "Not sure where to start? Compare tea, balm, tincture, serum, and capsules — five doors into the same garden at Amber's Alchemy Apothecary — and pick the form that fits your life.",
};

const mainStyle: React.CSSProperties = {
  maxWidth: '56rem',
  margin: '0 auto',
  padding: '2.5rem 1.25rem 3.5rem',
};

const h1Style: React.CSSProperties = {
  fontFamily: 'var(--font-display, "Cinzel Decorative", serif)',
  color: 'var(--parchment)',
  textAlign: 'center',
  fontSize: '2.1rem',
  lineHeight: 1.25,
  margin: '0 0 1rem',
};

const introStyle: React.CSSProperties = {
  color: 'var(--text-body)',
  lineHeight: 1.7,
  textAlign: 'center',
  maxWidth: '44rem',
  margin: '0 auto 2.5rem',
  fontSize: '1.06rem',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--aa-gold)',
  borderRadius: '1rem',
  background: 'linear-gradient(165deg, var(--plum-mid), var(--plum-deep))',
  padding: '1.6rem 1.7rem',
  margin: '0 auto 1.6rem',
  maxWidth: '46rem',
};

const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display, "Cinzel", serif)',
  color: 'var(--parchment)',
  margin: '0 0 0.25rem',
  fontSize: '1.5rem',
};

const taglineStyle: React.CSSProperties = {
  fontFamily: 'var(--font-accent, "Cormorant Garamond", serif)',
  fontStyle: 'italic',
  color: 'var(--brass-lt)',
  fontSize: '1.15rem',
  margin: '0 0 0.9rem',
};

const bodyLineStyle: React.CSSProperties = {
  color: 'var(--text-body)',
  lineHeight: 1.65,
  margin: '0.45rem 0',
};

const noteStyle: React.CSSProperties = {
  ...bodyLineStyle,
  borderLeft: '3px solid var(--brass)',
  paddingLeft: '0.8rem',
  fontStyle: 'italic',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.6rem',
  flexWrap: 'wrap',
  marginTop: '1.1rem',
};

const ctaLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.6rem 1.3rem',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, var(--brass), var(--brass-lt))',
  color: 'var(--plum-dark)',
  fontWeight: 700,
  textDecoration: 'none',
};

const ctaButtonStyle: React.CSSProperties = {
  padding: '0.6rem 1.3rem',
  borderRadius: '999px',
  background: 'transparent',
  border: '1px solid var(--brass)',
  color: 'var(--parchment)',
  fontWeight: 600,
  cursor: 'pointer',
  font: 'inherit',
};

const explainerStyle: React.CSSProperties = {
  ...cardStyle,
  borderStyle: 'dashed',
  textAlign: 'center' as const,
};

function FormCard({ form }: { form: FormGuideEntry }) {
  return (
    <article style={cardStyle} data-form={form.id} aria-label={form.title}>
      <h2 style={cardTitleStyle}>
        {form.emoji} {form.name} — {form.title}
      </h2>
      <p style={taglineStyle}>{form.tagline}</p>
      <p style={bodyLineStyle}>{form.whatItIs}</p>
      {form.note && <p style={noteStyle}>{form.note}</p>}
      <p style={bodyLineStyle}>
        <strong style={{ color: 'var(--parchment)' }}>Body:</strong> {form.body}
      </p>
      <p style={bodyLineStyle}>
        <strong style={{ color: 'var(--parchment)' }}>Mind:</strong> {form.mind}
      </p>
      <p style={bodyLineStyle}>
        <strong style={{ color: 'var(--parchment)' }}>Soul:</strong> {form.soul}
      </p>
      <div style={actionsStyle}>
        {form.actions.map((action) =>
          action.type === 'link' ? (
            <Link key={action.label} href={action.href} style={ctaLinkStyle}>
              {action.label} →
            </Link>
          ) : (
            <ContactPopupTrigger
              key={action.label}
              label={action.label}
              topic="custom-product"
              style={ctaButtonStyle}
            />
          ),
        )}
      </div>
    </article>
  );
}

export default function CustomFormulaGuidePage() {
  const serumIndex = FORM_GUIDE.findIndex((f) => f.id === 'serum');
  return (
    <main style={mainStyle}>
      <h1 style={h1Style}>{FORM_GUIDE_INTRO.heading}</h1>
      <p style={introStyle}>{FORM_GUIDE_INTRO.body}</p>

      <QuizPromo />

      {FORM_GUIDE.map((form, index) => (
        <div key={form.id}>
          <FormCard form={form} />
          {index === serumIndex && (
            <section style={explainerStyle} aria-label="Tincture or serum">
              <h2 style={cardTitleStyle}>{TINCTURE_VS_SERUM.heading}</h2>
              <p style={bodyLineStyle}>{TINCTURE_VS_SERUM.body}</p>
            </section>
          )}
        </div>
      ))}

      <section
        style={{ ...cardStyle, textAlign: 'center' }}
        aria-label="Message Amber"
      >
        <h2 style={cardTitleStyle}>Still not sure?</h2>
        <p style={bodyLineStyle}>
          Ask anything — an herb, an order, or where to even start. Every
          message is read personally by Amber.
        </p>
        <div style={{ ...actionsStyle, justifyContent: 'center' }}>
          <ContactPopupTrigger label="Message Amber" style={ctaLinkStyle} />
        </div>
      </section>
    </main>
  );
}
