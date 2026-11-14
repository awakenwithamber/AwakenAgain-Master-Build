import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { OrganizationJsonLd } from '../components/seo/JsonLd';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { FooterBanner } from '../components/layout/FooterBanner';
import { BRAND_NAME, siteUrl, SITE_KEYWORDS } from '../lib/seo/config';
import { LegacyAnchorRedirect } from '../components/seo/LegacyAnchorRedirect';
import { MusicGate } from '../components/music/MusicGate';
import { EntryAuthGate } from '../components/auth/EntryAuthGate';
import { BotanicalCardHost } from '../components/herbs/BotanicalCardHost';
import { GaiaWidget } from '../components/chat/GaiaWidget';
import { GaiaNudge } from '../components/chat/GaiaNudge';
import { ContactPopup } from '../components/contact/ContactPopup';
import { ConsentBar } from '../components/privacy/ConsentBar';
import { MetaPixelTracker } from '../components/analytics/MetaPixelTracker';
import { SpeedInsights } from '@vercel/speed-insights/next';

// CSP nonce (Aikido 845087258): pages must render per-request so Next.js
// can stamp the middleware nonce onto its inline scripts. Static prerender
// HTML carries no nonce and its inline scripts would be blocked by the CSP.
export const dynamic = 'force-dynamic';

const base = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: {
    default: BRAND_NAME,
    template: `%s — ${BRAND_NAME}`,
  },
  description:
    "Amber's Alchemy Apothecary — handcrafted botanical soaps, capsules, balms, and the Living Grimoire of Light & Magic. AwakenAgain.com.",
  keywords: [...SITE_KEYWORDS],
  // SEO HYGIENE (2026-11-08 audit, Critical #1): NO layout-level canonical.
  // A canonical here is inherited by every child page that does not set
  // its own — the previous `canonical: '/'` made /shop, /quiz, /grimoire,
  // every herb page, etc. canonicalise to the HOMEPAGE in live HTML.
  // Every page MUST set its own `alternates: { canonical: '<its path>' }`
  // (the pattern /network always used); the canonical test suite enforces it.
  openGraph: {
    type: 'website',
    // NO openGraph.url here: it would be inherited by every page as the
    // HOMEPAGE url (same inheritance trap as the old layout canonical).
    // The per-page og:url is emitted by RootLayout below from the
    // middleware-stamped x-pathname header.
    siteName: BRAND_NAME,
    images: [
      {
        url: '/images/brand/empress-og-1200x630.jpg',
        width: 1200,
        height: 630,
        alt: "Amber's Alchemy Apothecary — The Empress banner: handcrafted herbal products & botanical wellness at AwakenAgain.com",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/images/brand/empress-og-1200x630.jpg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#150b26',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-page og:url (SEO package 2026-11-13): emitted here from the
  // middleware-stamped pathname rather than via metadata openGraph.url —
  // a layout-level openGraph.url is inherited as the HOMEPAGE url by every
  // page, and any page-level openGraph object replaces the layout's
  // wholesale (dropping og:image/og:type). This tag is the single og:url
  // on every page: no page sets openGraph.url in its metadata.
  const pathname = (await headers()).get('x-pathname') ?? '/';
  const ogUrl = pathname === '/' ? base : `${base}${pathname}`;
  return (
    // data-scroll-behavior="smooth" (Experience Package 1, 2026-11-08):
    // Next.js forces instant scroll behavior during route transitions
    // when this attribute is present, so new pages open at the TOP and
    // back navigation restores the previous position, while the CSS in
    // globals.css keeps in-page anchor clicks smooth. Without it, the
    // global smooth rule animated the router's scroll-to-top and pages
    // visibly opened halfway down.
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <meta property="og:url" content={ogUrl} />
        {/* Google Fonts — spec §3: Cinzel Decorative (display), Cinzel,
            EB Garamond (body), Cormorant Garamond (accent). Single link. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;500;700&family=Cinzel:wght@400;500;600&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Layered background (2026-10-30): royal purple + apothecary
            image at 44% opacity, fixed behind all content site-wide. */}
        <div className="aa-bg-layer" aria-hidden="true" />
        {/* Entry order (2026-10-31): auth gate first, then the music
            choice modal. EntryAuthGate offers sign in / create account
            (existing /account email-code flow) or guest browsing, once
            per session; MusicGate waits for its dismissal. */}
        <EntryAuthGate />
        <MusicGate />
        {/* Skip link target: every page template must render <main id="main-content">. */}
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {/* Shared chrome — workstream 2 (customer content) owns nav/footer. */}
        <Header />
        {children}
        <FooterBanner />
        <Footer />
        {/* Botanical index-card modal host (workstream E) — listens for aa:open-botanical-card. */}
        <BotanicalCardHost />
        {/* Gaia chatbot — popup intro + lower-right button (owner directive 2026-10-10). */}
        <GaiaWidget />
        {/* Gaia nudge card — non-blocking suggestions above the Gaia FAB (2026-10-25). */}
        <GaiaNudge />
        {/* Contact popup — global "Message Amber" modal, opened via the
            'aa:open-contact' event or <ContactPopupTrigger> (2026-10-25). */}
        <ContactPopup />
        {/* Analytics consent bar (2026-10-14) — calm bottom bar, shows only until the visitor chooses. */}
        <ConsentBar />
        {/* Meta pixel route tracker (ported 2026-11-02 from the Oct 28
            staged build) — inert unless NEXT_PUBLIC_META_PIXEL_ID is
            set AND analytics consent is accepted; see
            lib/analytics/meta-pixel.ts. Renders nothing. */}
        <MetaPixelTracker />
        {/* Legacy SPA anchor → route bridge (client-side; fragments never reach the server). */}
        <LegacyAnchorRedirect />
        <OrganizationJsonLd />
        {/* Vercel Speed Insights — real-user Core Web Vitals (free tier). */}
        <SpeedInsights />
      </body>
    </html>
  );
}
