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
 *
 * Visuals (owner request 2026-10-28, "pictures for everything"): every
 * card carries a real repo image, and the page background is the original
 * Netlify apothecary-shelf photograph — the old site's styles.css named
 * it apothecary-shelf-abundance-stockcake-1095398323.jpg, and its bytes
 * are identical to this repo's public/images/textures/apothecary-shelf.jpg
 * (same git blob), served under the same plum overlay the Netlify panes
 * used (rgba(30, 17, 40, 0.78)). No generated imagery anywhere.
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
  /** Real owner/repo artwork only — every src is a file that exists
   * under public/images in this repo. */
  image: { src: string; alt: string };
}

/** On-site destinations, in the owner's requested order. Every href is an
 * app-router page that exists in this repo (app/shop, app/quiz,
 * app/grimoire, app/soap-builder, app/services, app/contact). */
const SITE_LINKS: HubLink[] = [
  {
    href: '/shop',
    label: `Shop ${BRAND_NAME}`,
    note: 'Handcrafted soaps, balms, capsules, and tea blends — made by hand in small batches.',
    image: {
      src: '/images/products/full-soap-collection.webp',
      alt: "Handcrafted herbal soap collection on the apothecary bench, Amber's Alchemy Apothecary",
    },
  },
  {
    href: '/quiz',
    label: 'Free Herb Quiz — Find My Formula',
    note: 'A short guided conversation that gathers your herbal allies and one personalized formula.',
    image: {
      src: '/images/brand/herbal-library-header.jpg',
      alt: "Botanical herbs and apothecary jars from the herbal library, Amber's Alchemy Apothecary",
    },
  },
  {
    href: '/grimoire',
    label: 'The Living Grimoire',
    note: 'The Living Grimoire of Light & Magic — read the opening pages and join the membership.',
    image: {
      src: '/images/brand/living-grimoire-cover.jpg',
      alt: "The Living Grimoire cover art, Amber's Alchemy Apothecary",
    },
  },
  {
    href: '/soap-builder',
    label: 'Custom Soap Builder',
    note: 'Design your own bar: choose your botanicals, scent, and shape.',
    image: {
      src: '/images/shapes/shape-medium-rose.png',
      alt: "Rose-shaped handcrafted soap bar from the custom soap builder, Amber's Alchemy Apothecary",
    },
  },
  {
    href: '/services',
    label: 'Spiritual Services & Readings',
    note: 'Readings and consultations, offered for entertainment, spiritual, and reflective purposes only.',
    image: {
      src: '/images/products/tarot-readings.webp',
      alt: "Tarot cards and candlelight for spiritual readings, Amber's Alchemy Apothecary",
    },
  },
  {
    href: '/contact',
    label: 'Book a Consultation',
    note: 'Appointments are booked through the contact page — tell Amber what you are looking for.',
    image: {
      src: '/images/products/personalized-botanical-consultation.webp',
      alt: "Botanical consultation setting with herbs and apothecary bottles, Amber's Alchemy Apothecary",
    },
  },
];

/** Official social profiles, owner-confirmed (same set as /sitemap). */
const SOCIAL_LINKS: HubLink[] = [
  {
    href: 'https://www.instagram.com/awakenwithamber',
    label: 'Instagram — @awakenwithamber',
    note: 'Behind the bench: small batches, botanicals, and new creations.',
    external: true,
    image: {
      src: '/images/banners/apothecary-bottles.jpg',
      alt: "Glass apothecary bottles with botanicals on a shelf, Amber's Alchemy Apothecary",
    },
  },
  {
    href: 'https://www.facebook.com/profile.php?id=1125112937358042',
    label: 'Facebook — Awaken With Amber LLC',
    note: 'Our official Facebook Page: shop news, events, and community posts.',
    external: true,
    image: {
      src: '/images/banners/brand-banner.jpg',
      alt: "Gold botanical brand banner artwork, Amber's Alchemy Apothecary",
    },
  },
  {
    href: 'https://www.threads.net/@awakenwithamber',
    label: 'Threads — @awakenwithamber',
    note: 'Day-to-day notes and conversation with the community.',
    external: true,
    image: {
      src: '/images/banners/alchemy-symbols.jpg',
      alt: "Gold alchemy symbols on a deep plum background, Amber's Alchemy Apothecary",
    },
  },
  {
    href: 'https://www.tiktok.com/@awakenwithamber',
    label: 'TikTok — @awakenwithamber',
    note: 'Short videos from the apothecary bench.',
    external: true,
    image: {
      src: '/images/products/gaias-rose-soap.webp',
      alt: "Rose botanical handcrafted soap bar, Amber's Alchemy Apothecary",
    },
  },
  {
    href: 'https://www.linkedin.com/in/awakenwithamber',
    label: 'LinkedIn — Amber Lynn Patten',
    note: 'Business services, partnerships, and professional updates.',
    external: true,
    image: {
      src: '/images/brand/social-preview-og.jpg',
      alt: "Branded artwork with gold botanical details on deep plum, Amber's Alchemy Apothecary",
    },
  },
];

function HubCard({ link }: { link: HubLink }) {
  const content = (
    <>
      {/* Plain <img> matches the codebase-wide image pattern (shop,
          services, and herb pages all render repo artwork this way). */}
      <img
        className={styles.cardImage}
        src={link.image.src}
        alt={link.image.alt}
        loading="lazy"
        decoding="async"
      />
      <span className={styles.cardText}>
        <span className={styles.cardLabel}>{link.label}</span>
        <span className={styles.cardNote}>{link.note}</span>
      </span>
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
    <main id="main-content" className={styles.pageBg}>
      <div className={styles.linksMain}>
      <img
        className={styles.headerBanner}
        src="/images/brand/brand-banner.jpg"
        alt="Amber's Alchemy Apothecary banner with gold botanical artwork on deep plum, Amber's Alchemy Apothecary"
        width={2048}
        height={434}
        decoding="async"
      />
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
            <img
              className={styles.cardImage}
              src="/images/banners/ritual-bowl.jpg"
              alt="Ceremonial ritual bowl with botanicals and candlelight, Amber's Alchemy Apothecary"
              loading="lazy"
              decoding="async"
            />
            <span className={styles.cardText}>
              <span className={styles.cardLabel}>Email Amber</span>
              <span className={styles.cardNote}>{BRAND_EMAIL}</span>
            </span>
          </a>
        </li>
        <li>
          <a className={styles.card} href={BRAND_PHONE_TEL}>
            <img
              className={styles.cardImage}
              src="/images/products/alchemy-tea-blend.webp"
              alt="Dried botanical tea blend in an apothecary jar, Amber's Alchemy Apothecary"
              loading="lazy"
              decoding="async"
            />
            <span className={styles.cardText}>
              <span className={styles.cardLabel}>Call or Text</span>
              <span className={styles.cardNote}>{BRAND_PHONE_DISPLAY}</span>
            </span>
          </a>
        </li>
      </ul>

      <p className={styles.framing}>
        Spiritual guidance, readings, and consultations are offered for
        entertainment, spiritual, and reflective purposes only.
      </p>
      </div>
    </main>
  );
}
