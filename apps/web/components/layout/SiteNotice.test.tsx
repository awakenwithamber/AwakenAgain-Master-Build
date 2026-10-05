/**
 * REGRESSION — site-wide renewal notice.
 *
 * The notice must use the exact business name ("Amber's Alchemy
 * Apothecary" — never shortened), convey that the site is under renewal
 * while shopping works, carry an accessible note role, and contain no
 * emoji.
 *
 * Note: written with React.createElement (no JSX) because this repo's
 * vitest transform does not parse JSX in .tsx test files.
 */
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteNotice } from './SiteNotice';
import { BRAND_NAME } from '../../lib/seo/config';

const SHORTENED = /Amber's Alchemy(?! Apothecary)/;

// No emoji anywhere in the notice UI.
const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

function decodeEntities(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

describe('SiteNotice', () => {
  const html = decodeEntities(renderToStaticMarkup(createElement(SiteNotice)));

  it('renders the exact canonical brand name', () => {
    expect(BRAND_NAME).toBe("Amber's Alchemy Apothecary");
    expect(html).toContain(BRAND_NAME);
  });

  it('never shortens the brand name', () => {
    expect(html).not.toMatch(SHORTENED);
  });

  it('is announced as a note landmark', () => {
    expect(html).toContain('role="note"');
    expect(html).toContain('aria-label="Site renewal notice"');
  });

  it('conveys renewal without sounding broken', () => {
    expect(html).toMatch(/rebuilt|renewal|updates/i);
    expect(html).not.toMatch(/broken|down for maintenance|unavailable|error/i);
  });

  it('confirms shopping is working', () => {
    expect(html).toMatch(/checkout.*fully working|fully working/i);
  });

  it('contains no emoji', () => {
    expect(html).not.toMatch(EMOJI);
  });

  it('offers a dismiss control', () => {
    expect(html).toContain('Dismiss');
    expect(html).toContain('aria-label="Dismiss site renewal notice"');
  });
});
