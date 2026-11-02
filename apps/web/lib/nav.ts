/**
 * Unified site navigation — ONE header, grouped (Phase 2, 2026-10-14).
 *
 * This module is the single source of truth for the header's link
 * structure. components/layout/Header.tsx renders it twice (desktop
 * bar + mobile panel) from the same data, and the nav tests assert
 * route coverage against lib/seo/routes.ts (CANONICAL_ROUTES) so no
 * registered page can be orphaned by a nav edit.
 *
 * Grouping (derived from the real route inventory, 2026-10-14):
 * - Home, Services & Readings, Quiz, Journal are single destinations.
 * - Get-involved destinations (2026-10-15): /network is a top-level
 *   link (The Awaken Network pane); /partner lives in About & Support.
 * - Shop / Herb Library / The Living Grimoire / About & Support are
 *   groups — every other customer-facing route lives in exactly one.
 * Transactional routes (/cart, /checkout) sit at the end of Shop:
 * they belong to the buying journey, and the header actions (cart
 * icon, conditional Checkout) mirror them as before.
 */

export interface NavLinkItem {
  href: string;
  label: string;
}

export type NavEntry =
  | { kind: 'link'; href: string; label: string }
  | { kind: 'group'; id: string; label: string; links: NavLinkItem[] };

export const NAV_ENTRIES: NavEntry[] = [
  { kind: 'link', href: '/', label: 'Home' },
  {
    kind: 'group',
    id: 'shop',
    label: 'Shop',
    // Order (combined build 2026-11-02): the shop page stays first
    // (owner punch list), then the custom builders are promoted
    // directly under it — visitors who "don't know what they need"
    // meet the builders and the Quiz before the catalog shelves.
    // Labels are unchanged (renames are a separate owner decision).
    links: [
      { href: '/shop', label: 'Remedies' },
      { href: '/custom-formula', label: 'Create Remedy' },
      { href: '/soap-builder', label: 'Soap Builder' },
      { href: '/soap-shop', label: 'Soap Shop' },
      { href: '/custom-formula/tea', label: 'Tea Builder' },
      { href: '/cart', label: 'Cart' },
      { href: '/checkout', label: 'Checkout' },
    ],
  },
  {
    kind: 'group',
    id: 'herb-library',
    label: 'Herb Library',
    links: [
      { href: '/herb-index', label: 'Herb Encyclopedia' },
      { href: '/herbal-wisdom', label: 'Herbal Wisdom' },
    ],
  },
  {
    kind: 'group',
    id: 'grimoire',
    label: 'Living Grimoire of Light & Magic',
    links: [
      { href: '/grimoire', label: 'Enter the Living Grimoire of Light & Magic' },
      { href: '/grimoire/subscribe', label: 'Subscribe' },
    ],
  },
  { kind: 'link', href: '/services', label: 'Services & Readings' },
  { kind: 'link', href: '/quiz', label: 'Quiz' },
  { kind: 'link', href: '/journal', label: 'Journal' },
  { kind: 'link', href: '/network', label: 'The Awaken Network' },
  {
    kind: 'group',
    id: 'about-support',
    label: 'About & Support',
    links: [
      { href: '/about', label: 'About Amber' },
      { href: '/account', label: 'My Profile' },
      { href: '/partner', label: 'Partner With Us' },
      { href: '/support', label: 'Support' },
      { href: '/order-status', label: 'Order Status' },
      { href: '/faqs', label: 'FAQs' },
      { href: '/contact', label: 'Contact' },
      { href: '/legal', label: 'Legal' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/returns', label: 'Returns & Refunds' },
      { href: '/sitemap', label: 'Site Map' },
      { href: '/links', label: 'All Links' },
    ],
  },
];

/** Every href the unified header links to, in nav order, de-duplicated. */
export function navHrefs(): string[] {
  const seen = new Set<string>();
  for (const entry of NAV_ENTRIES) {
    if (entry.kind === 'link') {
      seen.add(entry.href);
    } else {
      for (const link of entry.links) seen.add(link.href);
    }
  }
  return [...seen];
}
