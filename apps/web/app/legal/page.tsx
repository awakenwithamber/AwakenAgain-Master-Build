/**
 * /legal — apothecary disclaimers (G7 LEGAL).
 *
 * Honest, standard apothecary disclaimers. Not legal advice. Anything
 * requiring attorney review is marked NEEDS VERIFICATION.
 */
import type { Metadata } from 'next';
import { BRAND_EMAIL, BRAND_NAME, BRAND_PHONE_DISPLAY } from '../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Disclaimers',
  description: `Health and product disclaimers for ${BRAND_NAME}.`,
};

export default function LegalPage() {
  return (
    <main id="main-content" className="page content-page">
      <h1>Disclaimers</h1>

      <h2>Health disclaimer</h2>
      <p>
        The products sold by {BRAND_NAME} are handcrafted botanical goods
        for personal ritual and enjoyment. These products are{' '}
        <strong>
          not intended to diagnose, treat, cure, or prevent any disease
        </strong>
        . Nothing on this site — including product descriptions, the Herbal
        Allies Quiz, journal articles, herb library entries, and FAQs —
        should be read as medical advice.
      </p>
      <p>
        Always consult your healthcare provider before starting any herbal
        regimen — especially if you are pregnant, nursing, taking medication,
        or managing a health condition. If you experience an adverse reaction,
        discontinue use and seek qualified care.
      </p>

      <h2>Evidence language</h2>
      <p>
        Where we describe traditional uses of botanicals, we distinguish
        between traditional use, laboratory research, and human studies. These
        contexts are never collapsed into claims of proven efficacy.
      </p>

      <h2>Product variation</h2>
      <p>
        All products are handmade in small batches. Natural variation in
        color, scent, texture, and botanical content is normal and expected —
        it is the mark of a handcrafted good, not a defect.
      </p>

      <h2>Allergens & safety</h2>
      <p>
        Our products may contain common allergens (e.g., tree nuts via shea
        butter, coconut derivatives, essential oils). Patch-test topical
        products before full use. Keep all products out of reach of children
        and pets.
      </p>

      <h2>Services & readings</h2>
      <p>
        Tarot, rune, energy work, and guided explorations are offered for
        spiritual, reflective, and entertainment purposes only — not as
        professional medical, legal, or financial advice. Outcomes are not
        guaranteed; no predictive powers are claimed.
      </p>

      <p className="legal-nv">
        ⚠ NEEDS VERIFICATION — this page is standard apothecary disclaimer
        language, not legal advice. Owner attorney review required before
        treating it as final.
      </p>

      <p>
        Questions? <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a> ·{' '}
        {BRAND_PHONE_DISPLAY}
      </p>
    </main>
  );
}
