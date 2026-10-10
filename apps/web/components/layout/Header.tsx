/**
 * Site header — WORKSTREAM A owns this file (design system + atmosphere).
 *
 * Nav per spec §4: brand block ("AWAKEN WITH AMBER LLC" over
 * "Amber's Alchemy Apothecary") · Home · Shop Remedies · Create Remedy ·
 * Learn ▾ (Articles & Guides / Herb Encyclopedia / Ingredient Library) ·
 * Soaps · Services · About Amber · FAQs · Contact · "Find My Remedy" accent
 * button → /quiz · Checkout (visible only while the cart has items) ·
 * music-controls slot (workstream B) · 🛒 Cart with count · hamburger ≤768px.
 *
 * Client component: cart count, Checkout visibility, and the hamburger /
 * Learn dropdown need client state (reads the single cart store).
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Search from '../ui/Search';
import { MusicControls } from '../music/MusicControls';
import { useCart } from '../checkout/cart-store';
import { BRAND_NAME } from '../../lib/seo/config';

const LEARN_LINKS = [
  { href: '/herbal-library', label: 'Articles & Guides' },
  { href: '/herb-index', label: 'Herb Encyclopedia' },
];

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop Remedies' },
  { href: '/custom-formula', label: 'Create Remedy' },
  { href: '/soap-shop', label: 'Soaps' },
  { href: '/grimoire', label: 'Living Grimoire of Light & Magic' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About Amber' },
  { href: '/support', label: 'Support' },
  { href: '/faqs', label: 'FAQs' },
  { href: '/contact', label: 'Contact' },
];

export default function Header() {
  const { items, bundle, loaded } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [mobileLearnOpen, setMobileLearnOpen] = useState(false);

  const cartCount = items.length + (bundle ? 1 : 0);
  const hasItems = cartCount > 0;

  const learnDrop = (mobile: boolean) => (
    <>
      <button
        type="button"
        className="nav-drop-btn"
        aria-expanded={mobile ? mobileLearnOpen : learnOpen}
        aria-haspopup="true"
        onClick={() =>
          mobile ? setMobileLearnOpen((v) => !v) : setLearnOpen((v) => !v)
        }
      >
        Learn ▾
      </button>
      {(mobile ? mobileLearnOpen : learnOpen) && (
        <ul
          className={mobile ? 'nav-sub' : 'nav-drop-menu'}
          aria-label="Learn submenu"
        >
          {LEARN_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => {
                  setLearnOpen(false);
                  setMobileLearnOpen(false);
                  setMenuOpen(false);
                }}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link
          href="/"
          className="site-brand"
          aria-label={`${BRAND_NAME} — home`}
          onClick={() => setMenuOpen(false)}
        >
          <span className="site-brand-eyebrow">AWAKEN WITH AMBER LLC</span>
          <span className="site-brand-name">{BRAND_NAME}</span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          <ul>
            {NAV_LINKS.slice(0, 3).map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
            <li className="nav-drop">{learnDrop(false)}</li>
            {NAV_LINKS.slice(3).map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <Link
            href="/quiz"
            className="nav-accent-btn"
            aria-label="Find my remedy — take the herbal allies quiz"
          >
            Find My Remedy
          </Link>

          {hasItems && (
            <Link href="/checkout" className="nav-checkout">
              Checkout
            </Link>
          )}

          {/* Music controls (workstream B): toggle + volume slider. */}
          <MusicControls />

          <Link
            href="/cart"
            className="nav-cart"
            aria-label={loaded ? `Cart, ${cartCount} items` : 'Cart'}
          >
            🛒
            {loaded && cartCount > 0 && (
              <span className="nav-cart-count" aria-hidden="true">
                {cartCount}
              </span>
            )}
          </Link>

          <span className="header-search">
            <Search />
          </span>

          <button
            type="button"
            className="hamburger"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
      </div>

      <nav
        id="mobile-nav"
        className={`mobile-nav-panel${menuOpen ? ' open' : ''}`}
        aria-label="Mobile"
      >
        <ul>
          {NAV_LINKS.slice(0, 3).map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={() => setMenuOpen(false)}>
                {l.label}
              </Link>
            </li>
          ))}
          <li>{learnDrop(true)}</li>
          {NAV_LINKS.slice(3).map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={() => setMenuOpen(false)}>
                {l.label}
              </Link>
            </li>
          ))}
          {hasItems && (
            <li>
              <Link href="/checkout" onClick={() => setMenuOpen(false)}>
                Checkout
              </Link>
            </li>
          )}
          <li>
            <Link
              href="/quiz"
              className="nav-accent-btn"
              onClick={() => setMenuOpen(false)}
            >
              Find My Remedy
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
