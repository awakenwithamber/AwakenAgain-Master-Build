import type { Metadata, Viewport } from 'next';
import './globals.css';
import { OrganizationJsonLd } from '../components/seo/JsonLd';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { FooterBanner } from '../components/layout/FooterBanner';
import { BRAND_NAME, siteUrl, SITE_KEYWORDS } from '../lib/seo/config';
import { LegacyAnchorRedirect } from '../components/seo/LegacyAnchorRedirect';
import { MusicGate } from '../components/music/MusicGate';
import { BotanicalCardHost } from '../components/herbs/BotanicalCardHost';
import { GaiaWidget } from '../components/chat/GaiaWidget';
import { GaiaNudge } from '../components/chat/GaiaNudge';
import { ContactPopup } from '../components/contact/ContactPopup';
import { ConsentBar } from '../components/privacy/ConsentBar';

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
  alternates: {
    canonical: '/',
  },
  openGraph: {
    images: [
      {
        url: '/images/brand/ambers-alchemy-emblem-og.jpg',
        width: 1200,
        height: 1200,
        alt: "Amber's Alchemy Apothecary circular emblem — Amber@awakenagain.com",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/images/brand/ambers-alchemy-emblem-og.jpg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#150b26',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
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
        {/* Entry-gate: music choice modal on every load (workstream B). */}
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
        {/* Legacy SPA anchor → route bridge (client-side; fragments never reach the server). */}
        <LegacyAnchorRedirect />
        <OrganizationJsonLd />
      </body>
    </html>
  );
}
