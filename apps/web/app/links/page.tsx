/**
 * /links — link-in-bio hub (owner request 2026-10-28).
 *
 * One canonical landing page for every social profile bio: the shop, the
 * free herb quiz, the Living Grimoire, the custom soap builder, services,
 * and the official social profiles. Social URLs are the owner-confirmed
 * profiles only — never invent a handle (same rule as app/sitemap/page.tsx).
 *
 * Booking canon (awakenagain-rules): every booking call to action points
 * at /contact until /book is live and verified — /book is NOT linked here.
 *
 * Wording gate: no product or service is presented as a remedy or a
 * treatment anywhere on this page; spiritual services carry the site's
 * entertainment / spiritual / reflective framing.
 *
 * Portrait: no portrait photo of Amber exists in this repo, so the header
 * uses the same styled monogram convention as app/about/page.tsx (never
 * hotlink or substitute generated imagery for her photo).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './links.module.css';
import {
  BRAND_NAME,
  BRAND_EMAIL,
  BRAND_PHONE_DISPLAY,
  BRAND_PHONE_TEL,
} from '../../lib/seo/config';

const PAGE_TITLE = 'Links — Handmade Herbal Soap & Botanical Goods in Salt Lake City';
const PAGE_DESCRIPTION = `Handmade herbal soap, botanical blends, and customized products from ${BRAND_NAME} in Salt Lake City, Utah — shop the apothecary, take the free herb quiz, build a custom soap, open the Living Grimoire, and connect with Amber Lynn Patten of Awaken With Amber LLC.`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: `${PAGE_TITLE} — ${BRAND_NAME}`,
    description: PAGE_DESCRIPTION,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PAGE_TITLE} — ${BRAND_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

interface HubLink {
  href: string;
  label: string;
  note: string;
  external?: boolean;
}

/** On-site destinations, in the owner's requested order. Every href is an
 * app-router page that exists in this repo (app/shop, app/quiz,
 * app/grimoire, app/soap-builder, app/services, app/contact). */
const SITE_LINKS: HubLink[] = [
  {
    href: '/shop',
    label: `Shop ${BRAND_NAME}`,
    note: 'Handcrafted soaps, balms, capsules, and tea blends — made by hand in small batches.',
  },
  {
    href: '/quiz',
    label: 'Free Herb Quiz — Find My Formula',
    note: 'A short guided conversation that gathers your herbal allies and one personalized formula.',
  },
  {
    href: '/grimoire',
    label: 'The Living Grimoire',
    note: 'The Living Grimoire of Light & Magic — read the opening pages and join the membership.',
  },
  {
    href: '/soap-builder',
    label: 'Custom Soap Builder',
    note: 'Design your own bar: choose your botanicals, scent, and shape.',
  },
  {
    href: '/services',
    label: 'Spiritual Services & Readings',
    note: 'Readings and consultations, offered for entertainment, spiritual, and reflective purposes only.',
  },
  {
    href: '/contact',
    label: 'Book a Consultation',
    note: 'Appointments are booked through the contact page — tell Amber what you are looking for.',
  },
];

/** Official social profiles, owner-confirmed (same set as /sitemap). */
const SOCIAL_LINKS: HubLink[] = [
  {
    href: 'https://www.instagram.com/awakenwithamber',
    label: 'Instagram — @awakenwithamber',
    note: 'Behind the bench: small batches, botanicals, and new creations.',
    external: true,
  },
  {
    href: 'https://www.facebook.com/profile.php?id=1125112937358042',
    label: 'Facebook — Awaken With Amber LLC',
    note: 'Our official Facebook Page: shop news, events, and community posts.',
    external: true,
  },
  {
    href: 'https://www.threads.net/@awakenwithamber',
    label: 'Threads — @awakenwithamber',
    note: 'Day-to-day notes and conversation with the community.',
    external: true,
  },
  {
    href: 'https://www.tiktok.com/@awakenwithamber',
    label: 'TikTok — @awakenwithamber',
    note: 'Short videos from the apothecary bench.',
    external: true,
  },
  {
    href: 'https://www.linkedin.com/in/awakenwithamber',
    label: 'LinkedIn — Amber Lynn Patten',
    note: 'Business services, partnerships, and professional updates.',
    external: true,
  },
];

function HubCard({ link }: { link: HubLink }) {
  const content = (
    <>
      <span className={styles.cardLabel}>{link.label}</span>
      <span className={styles.cardNote}>{link.note}</span>
    </>
  );
  return (
    <li>
      {link.external ? (
        <a
          className={styles.card}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          aria-label={`${link.label} (opens in a new tab)`}
        >
          {content}
        </a>
      ) : (
        <Link className={styles.card} href={link.href}>
          {content}
        </Link>
      )}
    </li>
  );
}

export default function LinksPage() {
  return (
    <main id="main-content" className={styles.linksMain}>
      <div className={styles.portraitWrap}>
        <div
          className={styles.portrait}
          role="img"
          aria-label="Portrait of Amber Lynn Patten (placeholder monogram)"
        >
          A
        </div>
      </div>

      <h1 className={styles.name}>Amber Lynn Patten</h1>
      <p className={styles.company}>Awaken With Amber LLC</p>
      <p className={styles.location}>Salt Lake City, Utah</p>
      <p className={styles.intro}>
        Founder of {BRAND_NAME} — handcrafted botanical soaps, teas, and
        customized products, made in small batches. Everything Amber offers
        lives behind the links below.
      </p>

      <nav aria-label="Shop, quiz, Grimoire, and services">
        <ul className={styles.cardList}>
          {SITE_LINKS.map((l) => (
            <HubCard key={l.href} link={l} />
          ))}
        </ul>
      </nav>

      <h2 className={styles.sectionTitle}>Follow Along</h2>
      <nav aria-label="Social profiles">
        <ul className={styles.cardList}>
          {SOCIAL_LINKS.map((l) => (
            <HubCard key={l.href} link={l} />
          ))}
        </ul>
      </nav>

      <h2 className={styles.sectionTitle}>Contact</h2>
      <ul className={styles.cardList}>
        <li>
          <a className={styles.card} href={`mailto:${BRAND_EMAIL}`}>
            <span className={styles.cardLabel}>Email Amber</span>
            <span className={styles.cardNote}>{BRAND_EMAIL}</span>
          </a>
        </li>
        <li>
          <a className={styles.card} href={BRAND_PHONE_TEL}>
            <span className={styles.cardLabel}>Call or Text</span>
            <span className={styles.cardNote}>{BRAND_PHONE_DISPLAY}</span>
          </a>
        </li>
      </ul>

      <p className={styles.framing}>
        Spiritual guidance, readings, and consultations are offered for
        entertainment, spiritual, and reflective purposes only.
      </p>
    </main>
  );
}
