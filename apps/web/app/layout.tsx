import type { Metadata } from 'next';
import './globals.css';
import { OrganizationJsonLd } from '../components/seo/JsonLd';
import { SiteNotice } from '../components/layout/SiteNotice';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { BRAND_NAME, siteUrl } from '../lib/seo/config';
import { LegacyAnchorRedirect } from '../components/seo/LegacyAnchorRedirect';

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Skip link target: every page template must render <main id="main-content">. */}
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {/* Site-wide renewal notice — present on every route. */}
        <SiteNotice />
        {/* Shared chrome — workstream 2 (customer content) owns nav/footer. */}
        <Header />
        {children}
        <Footer />
        {/* Legacy SPA anchor → route bridge (client-side; fragments never reach the server). */}
        <LegacyAnchorRedirect />
        <OrganizationJsonLd />
      </body>
    </html>
  );
}
