/**
 * Site footer — shared chrome (workstream 2 owns layout chrome).
 *
 * Columns: shop, learn, services, legal, contact. Newsletter signup (G15)
 * embedded. Contact identity per owner verification: awaken@consultant.com,
 * (801) 414-8984. Payments: Cash App + Venmo only — stated plainly.
 */
import Link from 'next/link';
import NewsletterSignup from './NewsletterSignup';
import {
  BRAND_EMAIL,
  BRAND_NAME,
  BRAND_PHONE_DISPLAY,
  BRAND_PHONE_TEL,
} from '../../lib/seo/config';

const LEARN_LINKS = [
  { href: '/quiz', label: 'Herbal Allies Quiz' },
  { href: '/journal', label: 'Apothecary Journal' },
  { href: '/herbal-wisdom', label: 'Herbal Wisdom' },
  { href: '/herb-index', label: 'Herb Index' },
  { href: '/faqs', label: 'FAQs' },
];

const SHOP_LINKS = [
  { href: '/shop', label: 'All Products' },
  { href: '/soap-shop', label: 'Soap Shop' },
  { href: '/soap-builder', label: 'Custom Soap Builder' },
  { href: '/services', label: 'Services & Readings' },
];

const LEGAL_LINKS = [
  { href: '/legal', label: 'Disclaimers' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-col">
          <h3>{BRAND_NAME}</h3>
          <p>
            Handcrafted botanical soaps, capsules, balms, and the Living
            Grimoire — made in small batches in Salt Lake City, Utah.
          </p>
          <p className="footer-payments">
            Payments: Cash App <strong>$AmberPatten347</strong> · Venmo{' '}
            <strong>@AwakenwithAmber</strong>
          </p>
        </div>
        <nav className="footer-col" aria-label="Shop">
          <h3>Shop</h3>
          <ul>
            {SHOP_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav className="footer-col" aria-label="Learn">
          <h3>Learn</h3>
          <ul>
            {LEARN_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav className="footer-col" aria-label="Legal">
          <h3>Legal</h3>
          <ul>
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="footer-col">
          <h3>Contact</h3>
          <p>
            <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a>
            <br />
            <a href={BRAND_PHONE_TEL}>{BRAND_PHONE_DISPLAY}</a>
          </p>
        </div>
        <div className="footer-col footer-newsletter">
          <h3>Stay in the Circle</h3>
          <NewsletterSignup placement="footer" />
        </div>
      </div>
      <div className="site-footer-base">
        <p>
          © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
        </p>
        <p className="footer-disclaimer-mini">
          Products are not intended to diagnose, treat, cure, or prevent any
          disease. <Link href="/legal">Read our disclaimers.</Link>
        </p>
      </div>
    </footer>
  );
}
