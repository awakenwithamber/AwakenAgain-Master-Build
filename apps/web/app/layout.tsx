import type { Metadata } from 'next';
import './globals.css';
import { OrganizationJsonLd } from '../components/seo/JsonLd';
import { SiteNotice } from '../components/layout/SiteNotice';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { FooterBanner } from '../components/layout/FooterBanner';
import { BRAND_NAME, siteUrl } from '../lib/seo/config';
import { LegacyAnchorRedirect } from '../components/seo/LegacyAnchorRedirect';
import { MusicGate } from '../components/music/MusicGate';
import { BotanicalCardHost } from '../components/herbs/BotanicalCardHost';

const base = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: {
    default: BRAND_NAME,
    template: `%s — ${BRAND_NAME}`,
  },
  description:
    "Amber's Alchemy Apothecary — handcrafted botanical soaps, capsules, balms, and the Living Grimoire. AwakenAgain.com.",
  alternates: {
    canonical: '/',
  },
  openGraph: {
    images: [
      {
        url: '/images/brand/social-preview-og.jpg',
        width: 1200,
        height: 630,
        alt: "Amber's Alchemy Apothecary — AwakenAgain.com",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/images/brand/social-preview-og.jpg'],
  },
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
        {/* Entry-gate: music choice modal on every load (workstream B). */}
        <MusicGate />
        {/* Skip link target: every page template must render <main id="main-content">. */}
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {/* Site-wide renewal notice — present on every route. */}
        <SiteNotice />
        {/* Shared chrome — workstream 2 (customer content) owns nav/footer. */}
        <Header />
        {children}
        <FooterBanner />
        <Footer />
        {/* Botanical index-card modal host (workstream E) — listens for aa:open-botanical-card. */}
        <BotanicalCardHost />
        {/* Legacy SPA anchor → route bridge (client-side; fragments never reach the server). */}
        <LegacyAnchorRedirect />
        <OrganizationJsonLd />
      </body>
    </html>
  );
}
