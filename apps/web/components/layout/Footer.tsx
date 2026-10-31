/**
 * Site footer — shared chrome (workstream 2 owns layout chrome).
 *
 * Columns: shop, learn, services, legal, contact. Newsletter signup (G15)
 * embedded. Contact identity per owner verification: Amber@awakenagain.com,
 * (801) 819-6795. Payments: emailed invoice (ACH bank transfer,
 * Venmo, or Cash App) or Cash App / Venmo directly — stated plainly
 * (owner directive 2026-10-24; no card payment is offered).
 */
import Link from 'next/link';
import NewsletterSignup from './NewsletterSignup';
import { MessageAmber } from './MessageAmber';
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

const INVOLVED_LINKS = [
  { href: '/network', label: 'The Awaken Network' },
  { href: '/partner', label: 'Partner With Us' },
];

/**
 * Verified social profiles (owner request 2026-10-26) — one shared set
 * for Awaken With Amber LLC, Amber's Alchemy Apothecary, and The Awaken
 * Network. TikTok @awakenwithamber confirmed by the owner 2026-10-26
 * (profile screenshot); the older @alchemizingwithamber /
 * @ambersapothecary1985 candidates were not hers to link.
 */
const SOCIAL_LINKS = [
  {
    href: 'https://www.facebook.com/profile.php?id=1125112937358042',
    label: 'Facebook — Awaken With Amber LLC',
  },
  {
    href: 'https://www.instagram.com/awakenwithamber',
    label: 'Instagram — @awakenwithamber',
  },
  {
    href: 'https://www.linkedin.com/in/awakenwithamber',
    label: 'LinkedIn — Amber Lynn Patten',
  },
  {
    href: 'https://www.tiktok.com/@awakenwithamber',
    label: 'TikTok — @awakenwithamber',
  },
];

/**
 * The full site map (owner directive 2026-10-30): every public page on
 * the site, grouped and linked, printed above the legal disclaimers so
 * a visitor at the very bottom of any page can still step directly to
 * any other. Transactional sub-pages (checkout success/cancel/return)
 * and admin routes are deliberately not listed — they are reached in
 * flow, not wandered to.
 */
const SITEMAP_GROUPS = [
  {
    heading: 'The Apothecary Shelf',
    links: [
      { href: '/', label: 'Home — the Apothecary Door' },
      { href: '/shop', label: 'Shop All Products' },
      { href: '/soap-shop', label: 'The Soap Shop' },
      { href: '/soap-builder', label: 'Custom Soap Builder' },
      { href: '/custom-formula', label: 'Create Your Own Formula' },
      { href: '/custom-formula/capsules', label: 'Custom Capsules' },
      { href: '/custom-formula/tea', label: 'Custom Tea Blend' },
      { href: '/cart', label: 'Your Cart' },
      { href: '/checkout', label: 'Checkout' },
      { href: '/order-status', label: 'Order Status' },
    ],
  },
  {
    heading: 'The Living Grimoire',
    links: [
      { href: '/grimoire', label: 'The Living Grimoire of Light & Magic' },
      { href: '/grimoire/subscribe', label: 'Living Grimoire Membership' },
    ],
  },
  {
    heading: 'Learn & Wander',
    links: [
      { href: '/quiz', label: 'Herbal Allies Quiz' },
      { href: '/herb-index', label: 'The Herbal Library' },
      { href: '/herb-index', label: 'Herb Index' },
      { href: '/herbal-wisdom', label: 'Herbal Wisdom' },
      { href: '/journal', label: 'Apothecary Journal' },
      { href: '/faqs', label: 'Questions & Answers' },
      { href: '/links', label: 'Links & Friends of the Apothecary' },
    ],
  },
  {
    heading: 'Services & Readings',
    links: [{ href: '/services', label: 'Services & Readings' }],
  },
  {
    heading: 'The House & Its People',
    links: [
      { href: '/about', label: 'About Amber' },
      { href: '/network', label: 'The Awaken Network' },
      { href: '/partner', label: 'Partner With Us' },
      { href: '/contact', label: 'Contact the Apothecary' },
      { href: '/support', label: 'Support' },
      { href: '/account', label: 'Your Account' },
      { href: '/sitemap', label: 'Full Site Map Page' },
    ],
  },
  {
    heading: 'The Fine Print',
    links: [
      { href: '/legal', label: 'Disclaimers' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
      { href: '/returns', label: 'Returns & Refunds' },
    ],
  },
];

const LEGAL_LINKS = [
  { href: '/legal', label: 'Disclaimers' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/privacy#privacy-choices', label: 'Privacy Choices' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/returns', label: 'Returns & Refunds' },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-col">
          <h3>{BRAND_NAME}</h3>
          <p>
            Handcrafted botanical soaps, capsules, balms, and the Living
            Grimoire of Light &amp; Magic — made in small batches in Salt Lake
            City, Utah.
          </p>
          <p className="footer-payments">
            Payments: pay by emailed invoice (ACH bank transfer, Venmo,
            or Cash App) · Cash App <strong>$AmberPatten347</strong> ·
            Venmo <strong>@AwakenwithAmber</strong>
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
        <nav className="footer-col" aria-label="Get involved">
          <h3>Get Involved</h3>
          <ul>
            {INVOLVED_LINKS.map((l) => (
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
            <br />
            <a href="tel:+18014148984">(801) 414-8984</a>
          </p>
        </div>
        <div className="footer-col footer-newsletter" id="newsletter-signup">
          <h3>Stay in the Circle</h3>
          <NewsletterSignup placement="footer" />
        </div>
        <div className="footer-col footer-message">
          <MessageAmber />
        </div>
      </div>
      <div className="site-footer-base">
        <nav className="footer-sitemap" aria-label="Site map and social links">
          <p>
            <strong>Site Map</strong> — every path through the apothecary,
            gathered in one place so you can wander straight to what calls
            you. The same paths live in the menu above, of course.
          </p>
          <div className="footer-sitemap-groups">
            {SITEMAP_GROUPS.map((group) => (
              <div className="footer-sitemap-group" key={group.heading}>
                <h4>{group.heading}</h4>
                <ul>
                  {group.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href}>{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="footer-sitemap-links">
            {SOCIAL_LINKS.map((s, i) => (
              <span key={s.href}>
                {i > 0 ? ' · ' : ''}
                <a href={s.href} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </span>
            ))}
          </p>
        </nav>
        <div className="footer-disclaimer">
          <p>
            <strong>Legal Disclaimer</strong>
          </p>
          <p>
            The products and content offered by {BRAND_NAME}, operated by
            Awaken With Amber LLC, are handcrafted botanical goods and
            educational, spiritual, and reflective materials. These
            statements have not been evaluated by the Food and Drug
            Administration. Our products are not intended to diagnose,
            treat, cure, or prevent any disease, and nothing on this site
            constitutes medical, legal, or financial advice. Always consult
            a qualified healthcare provider before beginning any herbal
            regimen — especially if you are pregnant, nursing, taking
            medication, or managing a health condition.
          </p>
          <p>
            Spiritual guidance, hypnotherapy, consultations, tarot, rune,
            and energy-work services are provided for entertainment,
            spiritual, and reflective purposes only. They are not medical,
            mental-health, or licensed therapy services, and outcomes are
            not guaranteed. By using this site, you acknowledge and accept
            these terms.{' '}
            <Link href="/legal">Read the full disclaimers.</Link>
          </p>
        </div>
        <p>
          © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
