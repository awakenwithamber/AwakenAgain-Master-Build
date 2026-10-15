/**
 * Site header — THE single site header (Phase 2 unified nav, 2026-10-14).
 *
 * History: pages used to render a second mini header
 * (components/shop/SiteHeader) under this one — the "double nav".
 * That component is deleted; this header is the only chrome, and it
 * renders on every route from app/layout.tsx.
 *
 * Structure (data: lib/nav.ts — grouped, ~7 top-level entries):
 * brand block ("AWAKEN WITH AMBER LLC" over "Amber's Alchemy
 * Apothecary") · grouped primary nav (desktop dropdowns) ·
 * "Find My Remedy" accent button → /quiz · Checkout (only while the
 * cart has items) · music controls · 🛒 cart with count · search ·
 * hamburger ≤1100px opening the mobile panel (same groups,
 * expandable). Menus close on Escape, outside click, and navigation.
 *
 * Client component: cart count, Checkout visibility, and the menu /
 * dropdown state need client state (reads the single cart store).
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Search from '../ui/Search';
import { MusicControls } from '../music/MusicControls';
import { useCart } from '../checkout/cart-store';
import { BRAND_NAME } from '../../lib/seo/config';
import { NAV_ENTRIES, type NavEntry } from '../../lib/nav';

export default function Header() {
  const { items, bundle, loaded } = useCart();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopGroup, setDesktopGroup] = useState<string | null>(null);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const groupToggleRefs = useRef(new Map<string, HTMLButtonElement>());

  const cartCount = items.length + (bundle ? 1 : 0);
  const hasItems = cartCount > 0;

  // Close on navigation (link clicks also close via onClick; this
  // covers back/forward and programmatic route changes).
  useEffect(() => {
    setMenuOpen(false);
    setDesktopGroup(null);
    setMobileGroup(null);
  }, [pathname]);

  // Escape closes the open menu and returns focus to its toggle;
  // a click anywhere outside the header closes the desktop dropdown.
  useEffect(() => {
    if (!menuOpen && !desktopGroup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (desktopGroup) {
        groupToggleRefs.current.get(desktopGroup)?.focus();
      } else if (menuOpen) {
        hamburgerRef.current?.focus();
      }
      setMenuOpen(false);
      setDesktopGroup(null);
      setMobileGroup(null);
    };
    const onPointer = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setDesktopGroup(null);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [menuOpen, desktopGroup]);

  const current = (href: string) =>
    pathname === href ? ({ 'aria-current': 'page' } as const) : {};

  const desktopEntry = (entry: NavEntry) => {
    if (entry.kind === 'link') {
      return (
        <li key={entry.href}>
          <Link href={entry.href} {...current(entry.href)}>
            {entry.label}
          </Link>
        </li>
      );
    }
    const open = desktopGroup === entry.id;
    const menuId = `nav-menu-${entry.id}`;
    return (
      <li key={entry.id} className="nav-drop">
        <button
          type="button"
          className="nav-drop-btn"
          aria-expanded={open}
          aria-haspopup="true"
          aria-controls={menuId}
          ref={(el) => {
            if (el) groupToggleRefs.current.set(entry.id, el);
            else groupToggleRefs.current.delete(entry.id);
          }}
          onClick={() => setDesktopGroup(open ? null : entry.id)}
        >
          {entry.label}
          <span className="nav-caret" aria-hidden="true">
            ▾
          </span>
        </button>
        <ul
          className="nav-drop-menu"
          id={menuId}
          aria-label={`${entry.label} submenu`}
          hidden={!open}
        >
          {entry.links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                {...current(l.href)}
                onClick={() => setDesktopGroup(null)}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </li>
    );
  };

  const mobileEntry = (entry: NavEntry) => {
    if (entry.kind === 'link') {
      return (
        <li key={entry.href}>
          <Link
            href={entry.href}
            {...current(entry.href)}
            onClick={() => setMenuOpen(false)}
          >
            {entry.label}
          </Link>
        </li>
      );
    }
    const open = mobileGroup === entry.id;
    const menuId = `mobile-nav-menu-${entry.id}`;
    return (
      <li key={entry.id}>
        <button
          type="button"
          className="nav-drop-btn"
          aria-expanded={open}
          aria-haspopup="true"
          aria-controls={menuId}
          onClick={() => setMobileGroup(open ? null : entry.id)}
        >
          {entry.label}
          <span className="nav-caret" aria-hidden="true">
            ▾
          </span>
        </button>
        <ul
          className="nav-sub"
          id={menuId}
          aria-label={`${entry.label} submenu`}
          hidden={!open}
        >
          {entry.links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                {...current(l.href)}
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </li>
    );
  };

  return (
    <header className="site-header" ref={headerRef}>
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
          <ul>{NAV_ENTRIES.map(desktopEntry)}</ul>
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
            ref={hamburgerRef}
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
          {NAV_ENTRIES.map(mobileEntry)}
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
