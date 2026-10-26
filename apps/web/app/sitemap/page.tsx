/**
 * /sitemap — human-readable site map (owner request 2026-10-26).
 *
 * Every public corner of the site, plus the official social profiles
 * shared by Awaken With Amber LLC, Amber's Alchemy Apothecary, and
 * The Awaken Network. (The machine-readable XML sitemap for search
 * engines lives at /sitemap.xml and is generated separately.)
 *
 * Social URLs are the owner-confirmed profiles only — never invent a
 * handle. Facebook Page: Awaken With Amber LLC (page id 1125112937358042,
 * verified via the connected Facebook account 2026-10-26). Instagram and
 * Threads: @awakenwithamber. LinkedIn: /in/awakenwithamber.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND_NAME } from '../../lib/seo/config';

export const metadata: Metadata = {
  title: 'Site Map',
  description: `Every page of ${BRAND_NAME}, and where to connect with Awaken With Amber LLC, Amber's Alchemy Apothecary, and The Awaken Network on social media.`,
};

const SHOP_LINKS = [
  { href: '/shop', label: 'All Products' },
  { href: '/soap-shop', label: 'Soap Shop' },
  { href: '/soap-builder', label: 'Custom Soap Builder' },
  { href: '/custom-formula', label: 'Create Your Own Formula' },
  { href: '/custom-formula/capsules', label: 'Custom Capsules' },
  { href: '/custom-formula/tea', label: 'Custom Tea Blend' },
  { href: '/cart', label: 'Cart' },
  { href: '/order-status', label: 'Order Status' },
];

const GRIMOIRE_LINKS = [
  { href: '/grimoire', label: 'The Living Grimoire of Light & Magic' },
  { href: '/grimoire/subscribe', label: 'Living Grimoire Membership' },
];

const LEARN_LINKS = [
  { href: '/quiz', label: 'Herbal Allies Quiz' },
  { href: '/herb-index', label: 'Herb Index' },
  { href: '/herbal-wisdom', label: 'Herbal Wisdom' },
  { href: '/journal', label: 'Apothecary Journal' },
  { href: '/faqs', label: 'FAQs' },
];

const SERVICE_LINKS = [{ href: '/services', label: 'Services & Readings' }];

const COMPANY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/support', label: 'Support' },
  { href: '/partner', label: 'Partner With Us' },
  { href: '/account', label: 'Your Account' },
];

const NETWORK_LINKS = [
  { href: '/network', label: 'The Awaken Network' },
];

const LEGAL_LINKS = [
  { href: '/legal', label: 'Disclaimers' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/returns', label: 'Returns & Refunds' },
];

const SOCIAL_LINKS = [
  {
    href: 'https://www.facebook.com/profile.php?id=1125112937358042',
    label: 'Facebook — Awaken With Amber LLC',
    note: 'Our official Facebook Page: shop news, events, and community posts.',
  },
  {
    href: 'https://www.instagram.com/awakenwithamber',
    label: 'Instagram — @awakenwithamber',
    note: 'Behind the bench: small batches, botanicals, and new creations.',
  },
  {
    href: 'https://www.threads.net/@awakenwithamber',
    label: 'Threads — @awakenwithamber',
    note: 'Day-to-day notes and conversation with the community.',
  },
  {
    href: 'https://www.linkedin.com/in/awakenwithamber',
    label: 'LinkedIn — Amber Lynn Patten',
    note: 'Business services, partnerships, and professional updates.',
  },
];

function LinkSection({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <section>
      <h2>{title}</h2>
      <ul>
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SitemapPage() {
  return (
    <main id="main-content" className="page content-page">
      <h1>Site Map</h1>
      <p>
        Every page of {BRAND_NAME} in one place — and every official way to
        connect with us beyond this site.
      </p>

      <LinkSection title="Shop" links={SHOP_LINKS} />
      <LinkSection title="The Living Grimoire" links={GRIMOIRE_LINKS} />
      <LinkSection title="Learn" links={LEARN_LINKS} />
      <LinkSection title="Services" links={SERVICE_LINKS} />
      <LinkSection title="Company" links={COMPANY_LINKS} />
      <LinkSection title="Legal" links={LEGAL_LINKS} />

      <section>
        <h2>Our Brands</h2>
        <ul>
          <li>
            <strong>Awaken With Amber LLC</strong> — the parent company
            behind everything here, based in Salt Lake City, Utah.
          </li>
          <li>
            <strong>Amber&apos;s Alchemy Apothecary</strong> — this shop:
            handcrafted botanical soaps, capsules, balms, custom formulas,
            and the Living Grimoire.
          </li>
          <li>
            <Link href="/network">
              <strong>The Awaken Network</strong>
            </Link>{' '}
            — our growing community for learning, wellness, and conscious
            business.
          </li>
        </ul>
      </section>

      <section>
        <h2>Connect With Us</h2>
        <p>
          Awaken With Amber LLC, Amber&apos;s Alchemy Apothecary, and The
          Awaken Network share one set of official social profiles. Follow
          along, say hello, and be part of the circle:
        </p>
        <ul>
          {SOCIAL_LINKS.map((s) => (
            <li key={s.href}>
              <a href={s.href} target="_blank" rel="noreferrer">
                {s.label}
              </a>{' '}
              — {s.note}
            </li>
          ))}
        </ul>
        <p>
          Looking for something else? <Link href="/contact">Contact us</Link>{' '}
          and we&apos;ll point you the right way.
        </p>
      </section>
    </main>
  );
}
