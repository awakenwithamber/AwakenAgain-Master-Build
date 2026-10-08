/**
 * Site-wide renewal notice — Amber's Alchemy Apothecary.
 *
 * Rendered in app/layout.tsx so every route gets it. Conveys an honest
 * status: the storefront is being lovingly renewed, while the shop, soap
 * builder, and checkout are fully working. Deliberately calm styling
 * (dark purple + gold) — never alarming.
 *
 * Client component only because it is dismissible; the notice itself
 * renders on the server so it is present even without JavaScript.
 *
 * Written with React.createElement (no JSX): this repo's vitest transform
 * cannot parse JSX in .tsx imports (see components/seo/JsonLd.tsx).
 */
'use client';

import { createElement, useEffect, useState } from 'react';
import { BRAND_NAME } from '../../lib/seo/config';

const DISMISS_KEY = 'aa-renewal-notice-dismissed';

const STYLES = `
.aa-site-notice {
  background: linear-gradient(180deg, #1d1335 0%, #2a1a40 100%);
  border-top: 1px solid rgba(217, 169, 60, 0.6);
  border-bottom: 1px solid rgba(217, 169, 60, 0.6);
  color: #f4e8d0;
  padding: 0.6rem 1.25rem;
}
.aa-site-notice__inner {
  max-width: 72rem;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  flex-wrap: wrap;
  text-align: center;
}
.aa-site-notice__flourish {
  width: 0.5rem;
  height: 0.5rem;
  flex: 0 0 auto;
  background: var(--aa-gold);
  transform: rotate(45deg);
  border-radius: 1px;
}
.aa-site-notice__text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
}
.aa-site-notice__brand {
  color: #e6c766;
  font-weight: 700;
}
.aa-site-notice__dismiss {
  background: transparent;
  border: 1px solid rgba(217, 169, 60, 0.7);
  color: #e6c766;
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.3rem 0.85rem;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
}
.aa-site-notice__dismiss:hover {
  background: rgba(217, 169, 60, 0.15);
}
`;

export function SiteNotice() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
    } catch {
      // Storage unavailable (private mode, etc.) — keep the notice visible.
    }
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage unavailable — dismiss for this page view only.
    }
    setDismissed(true);
  };

  return createElement(
    'div',
    null,
    createElement('style', null, STYLES),
    createElement(
      'div',
      { className: 'aa-site-notice', role: 'note', 'aria-label': 'Site renewal notice' },
      createElement(
        'div',
        { className: 'aa-site-notice__inner' },
        createElement('span', {
          className: 'aa-site-notice__flourish',
          'aria-hidden': 'true',
        }),
        createElement(
          'p',
          { className: 'aa-site-notice__text' },
          createElement(
            'strong',
            { className: 'aa-site-notice__brand' },
            BRAND_NAME,
          ),
          ' is being lovingly rebuilt \u2014 some pages are still getting a ' +
            'fresh coat of paint, but the shop, soap builder, and checkout ' +
            'are fully working.',
        ),
        createElement('span', {
          className: 'aa-site-notice__flourish',
          'aria-hidden': 'true',
        }),
        createElement(
          'button',
          {
            type: 'button',
            className: 'aa-site-notice__dismiss',
            'aria-label': 'Dismiss site renewal notice',
            onClick: dismiss,
          },
          'Dismiss',
        ),
      ),
    ),
  );
}
