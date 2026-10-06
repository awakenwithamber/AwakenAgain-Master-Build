/**
 * Site header — shared chrome (workstream 2 owns layout chrome).
 *
 * Server component: nav links + client-side catalog search. New routes
 * register in lib/seo/routes.ts; nav mirrors the registry.
 */
import Link from 'next/link';
import Search from '../ui/Search';
import { BRAND_NAME } from '../../lib/seo/config';

const NAV_LINKS = [
  { href: '/shop', label: 'Shop' },
  { href: '/soap-shop', label: 'Soaps' },
  { href: '/soap-builder', label: 'Custom Soap' },
  { href: '/quiz', label: 'Find Your Remedy' },
  { href: '/journal', label: 'Journal' },
  { href: '/herbal-wisdom', label: 'Herbal Wisdom' },
  { href: '/faqs', label: 'FAQs' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand" aria-label={`${BRAND_NAME} — home`}>
          🌿 {BRAND_NAME}
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <ul>
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <Search />
      </div>
    </header>
  );
}
