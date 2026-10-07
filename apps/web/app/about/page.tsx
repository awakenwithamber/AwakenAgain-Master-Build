/**
 * About Amber — founder story / handmade positioning (workstream G).
 *
 * Spec §7: circular portrait (200px, 3px brass border, glow) — a styled
 * monogram placeholder "A" stands in where no portrait photo exists in the
 * repo (never hotlink random images); name "Amber Lynn Patten"; the exact
 * title line; bio sourced from the previous about page (kept, restyled);
 * pull-quote with a brass left border. No fabricated claims: no reviews,
 * certifications, timelines, or inventory statements.
 */
import type { Metadata } from 'next';
import { SiteHeader } from '../../components/shop/SiteHeader';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: 'About Amber',
  description:
    "Meet Amber Lynn Patten, founder of Amber's Alchemy Apothecary — handcrafted botanical goods, made by hand in small batches, never mass-produced.",
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className={styles.aboutMain}>
        <div className={styles.portraitWrap}>
          <div
            className={styles.portrait}
            role="img"
            aria-label="Portrait of Amber Lynn Patten (placeholder monogram)"
          >
            A
          </div>
        </div>
        <h1 className={styles.aboutName}>Amber Lynn Patten</h1>
        <p className={styles.aboutTitles}>
          Herbalist · Spiritual Healer · Botanical Alchemist · Founder of
          Awaken With Amber LLC
        </p>

        <div className={styles.aboutBody}>
          <section aria-label="Founder story">
            <h2>The hands behind the apothecary</h2>
            <p>
              Amber&apos;s Alchemy Apothecary is the work of Amber Lynn Patten
              — founder of Awaken With Amber LLC, based in Salt Lake City,
              Utah. Every soap, balm, capsule formula, and tea blend in this
              shop is made by Amber herself, in small batches, with real
              botanicals and honest ingredients.
            </p>
            <p>
              Amber connects things others keep separate — technology and
              nature, craft and systems, old herbal traditions and modern
              tools. This apothecary is one of those connections: the care of
              a handmade practice, organized so you can actually find it,
              customize it, and order it with ease.
            </p>
          </section>

          <blockquote className={styles.pullQuote}>
            “Technology makes ordering magical — the product stays
            handcrafted. Nothing here is mass-produced.”
          </blockquote>

          <section aria-label="Handcrafted positioning">
            <h2>Made by hand, ordered with magic</h2>
            <p>
              The technology here exists to make ordering magical — designing
              your own alchemy soap, blending your own scent, putting together
              a collection that&apos;s yours. It never exists to make the
              product anything other than handcrafted. Nothing on this site is
              mass-produced; the site just makes a small, human practice easy
              to reach.
            </p>
            <p>
              What that means in practice: your soap is poured, cut, and
              wrapped by Amber. Your scent is blended from real essential oils
              — doTERRA oils from her own inventory. Your order is confirmed
              personally before anything ships.
            </p>
          </section>

          <section aria-label="How ordering works">
            <h2>How ordering works</h2>
            <ul>
              <li>
                Browse the shop, customize what you love, and check out —
                payment is by <strong>Cash App ($AmberPatten347)</strong> or{' '}
                <strong>Venmo (@AwakenwithAmber)</strong>.
              </li>
              <li>
                Every order gets a unique order ID — include it in your payment
                note so we can match it.
              </li>
              <li>
                Amber confirms every order personally before fulfillment. Free
                shipping on orders over $100 ($75 for Living Grimoire
                subscribers); below that, shipping is confirmed with you before
                anything ships.
              </li>
            </ul>
          </section>

          <section aria-label="Contact">
            <h2>Contact</h2>
            <address>
              <p>
                <strong>Amber Lynn Patten</strong>
                <br />
                Amber&apos;s Alchemy Apothecary
                <br />
                Awaken With Amber LLC
              </p>
              <p>
                Email:{' '}
                <a href="mailto:awaken@consultant.com">
                  awaken@consultant.com
                </a>
                <br />
                Phone: <a href="tel:+18014148984">(801) 414-8984</a>
              </p>
            </address>
            <p>
              Questions about an order, a custom formula, or a scent idea —
              write or call. You&apos;ll reach Amber.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
