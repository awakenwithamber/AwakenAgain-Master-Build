/**
 * /support — Support the Apothecary (donations).
 *
 * A donation option for supporters of this founder-led small business.
 * Payments via Cash App / Venmo only (no Stripe). Donations to a
 * for-profit LLC are NOT tax-deductible — stated clearly.
 */
import type { Metadata } from 'next';
import { SiteHeader } from '../../components/shop/SiteHeader';
import { BRAND_NAME } from '../../lib/seo/config';
import styles from './support.module.css';

export const metadata: Metadata = {
  title: 'Support the Apothecary',
  description: `Support ${BRAND_NAME} — a founder-led small business where Amber creates every product by hand. Donations via Cash App or Venmo.`,
};

const SUGGESTED_AMOUNTS = ['$5', '$11', '$22', '$33', '$77'];

export default function SupportPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className={styles.supportMain}>
        <div className={styles.supportHero}>
          <p className="section-ornament" aria-hidden="true">
            ✦
          </p>
          <h1>Support the Apothecary</h1>
          <p className={styles.supportIntro}>
            {BRAND_NAME} is a founder-led small business. Amber Lynn Patten
            operates it, owns it, and creates each and every product by hand
            — every soap, balm, capsule formula, and tea blend, made in small
            batches in Salt Lake City, Utah.
          </p>
          <p className={styles.supportIntro}>
            If this work has helped you and you&apos;d like to help it grow,
            a donation of any size goes directly toward ingredients, supplies,
            and keeping the apothecary running.
          </p>
        </div>

        <section
          className={styles.donateCard}
          aria-labelledby="donate-heading"
        >
          <h2 id="donate-heading">Make a Donation</h2>
          <p>
            Choose an amount that feels right — or send any amount you
            like. Every contribution is received with gratitude.
          </p>

          <div className={styles.amountRow} role="group" aria-label="Suggested donation amounts">
            {SUGGESTED_AMOUNTS.map((amount) => (
              <span key={amount} className={styles.amountChip}>
                {amount}
              </span>
            ))}
          </div>

          <div className={styles.payMethods}>
            <a
              href="https://cash.app/$AmberPatten347"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.payButton}
            >
              Donate via Cash App
              <span className={styles.payHandle}>$AmberPatten347</span>
            </a>
            <a
              href="https://venmo.com/AwakenwithAmber"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.payButton}
            >
              Donate via Venmo
              <span className={styles.payHandle}>@AwakenwithAmber</span>
            </a>
          </div>

          <p className={styles.disclaimer}>
            Donations support Awaken With Amber LLC, a for-profit small
            business. Contributions are <strong>not tax-deductible</strong> as
            charitable donations. Thank you for supporting independent,
            handcrafted work.
          </p>
        </section>

        <section
          className={styles.otherWays}
          aria-labelledby="other-ways-heading"
        >
          <h2 id="other-ways-heading">Other Ways to Help</h2>
          <ul>
            <li>
              <strong>Shop the apothecary</strong> — every purchase directly
              supports the business. <a href="/shop">Browse products</a>
            </li>
            <li>
              <strong>Join the Living Grimoire</strong> — $7.77/month
              membership with 10% off storewide. <a href="/grimoire">Learn more</a>
            </li>
            <li>
              <strong>Share with a friend</strong> — word of mouth is the
              most powerful support a small business can receive.
            </li>
            <li>
              <strong>Work with Amber</strong> — explore her professional
              services in AI, technology, and botanical consulting.{' '}
              <a href="/about#professional-services">Learn more</a>
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
