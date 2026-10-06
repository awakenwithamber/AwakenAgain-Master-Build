/**
 * Web app manifest for Amber's Alchemy Apothecary (G14).
 *
 * Brand-exact name ("Amber's Alchemy Apothecary" — never shortened) and the
 * design-system colors: dark purple background (#17102b) + gold accents
 * (#d9a93c) per app/globals.css.
 *
 * HONEST PWA STATUS: this manifest + app/icon.tsx provide installability
 * metadata. A service worker and offline fallback page are NOT wired yet —
 * see lib/pwa/status.ts (OFFLINE_NOT_WIRED) and the G14 ledger entry.
 * No offline capability is claimed.
 */
import type { MetadataRoute } from 'next';
import { BRAND_NAME } from '../lib/seo/config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: 'Alchemy Apothecary',
    description:
      'Handcrafted botanical soaps, capsules, balms, and teas from Amber\u2019s Alchemy Apothecary — small-batch apothecary goods made by hand.',
    start_url: '/',
    display: 'standalone',
    background_color: '#17102b',
    theme_color: '#17102b',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
