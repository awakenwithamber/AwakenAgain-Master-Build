/**
 * Returns policy + footer + sitemap (Stage 4, R-23 + herbal sitemap flag).
 *
 * The returns page is a JSX server page (not importable by vitest —
 * repo constraint), so its approved terms are asserted at source
 * level, the approval flag at module level, and the route/footer/
 * sitemap wiring through the real registries and sitemap output.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import sitemap from '../app/sitemap';
import { CANONICAL_ROUTES } from '../lib/seo/routes';
import { isPolicyApproved, POLICIES } from '../lib/policies';
import { herbalRouteParams } from '../lib/herbal-index/cards';
import { siteUrl } from '../lib/seo/config';

const ROOT = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
/** Page source with JSX whitespace collapsed, so phrase checks read
 *  as the rendered text reads. */
const RETURNS_PAGE = read('app/returns/page.tsx').replace(/\s+/g, ' ');
/** The page body without its header comment (comments explain what is
 *  NOT stated; the no-invention checks govern rendered copy). */
const RETURNS_BODY = RETURNS_PAGE.slice(RETURNS_PAGE.indexOf('export default'));

describe('returns policy flag (Stage 4, R-23)', () => {
  it('the returns policy is APPROVED per the owner decision of 2026-10-21', () => {
    expect(POLICIES.returns.approved).toBe(true);
    expect(isPolicyApproved('returns')).toBe(true);
  });

  it('the page is behind the flag, with an interim contact-us fallback', () => {
    expect(RETURNS_PAGE).toContain("isPolicyApproved('returns')");
    expect(RETURNS_PAGE).toContain('policy is being finalized');
  });
});

describe('returns page — approved terms only', () => {
  it('states the approved terms: 30 days / unopened / damaged-or-wrong exception / contact to arrange', () => {
    expect(RETURNS_PAGE).toContain(
      'Unopened items may be returned within 30 days of delivery',
    );
    expect(RETURNS_PAGE).toContain('Opened consumables are final sale');
    expect(RETURNS_PAGE).toContain('arrives damaged');
    expect(RETURNS_PAGE).toContain('wrong item');
    expect(RETURNS_PAGE).toContain('regardless of whether the item has been opened');
    // The contact address renders from the shared brand constant.
    expect(RETURNS_PAGE).toContain('BRAND_EMAIL');
    expect(read('lib/seo/config.ts')).toContain('awaken@consultant.com');
  });

  it('states the already-approved facts: handmade by Amber, ships in 3–5 business days', () => {
    expect(RETURNS_PAGE).toContain('handmade by Amber');
    expect(RETURNS_PAGE).toContain('ship in 3–5 business days');
  });

  it('cross-references subscriptions and the $8.88 unlock truthfully', () => {
    expect(RETURNS_PAGE).toContain('cancelled anytime');
    expect(RETURNS_PAGE).toContain('account page');
    expect(RETURNS_PAGE).toContain('Customer Portal');
    expect(RETURNS_PAGE).toContain('continues through the end');
    expect(RETURNS_PAGE).toContain('of the paid period');
    expect(RETURNS_PAGE).toContain('$8.88 permanent unlock is not a subscription');
    expect(RETURNS_PAGE).toContain('Cancelling a subscription never affects it');
    expect(RETURNS_PAGE).toContain('refunded');
    expect(RETURNS_PAGE).toContain('unlock is revoked');
  });

  it('invents NO restocking fees, return-shipping charges, or refund timelines', () => {
    expect(RETURNS_BODY).not.toMatch(/restocking/i);
    expect(RETURNS_BODY).not.toMatch(/return shipping (charge|fee|cost)/i);
    expect(RETURNS_BODY).not.toMatch(/refund (within|in) \d+ (business )?days/i);
    expect(RETURNS_BODY).not.toMatch(/\$\d+(\.\d{2})? (fee|charge)/i);
  });
});

describe('returns route registration + footer link', () => {
  it('/returns is registered in the canonical route registry', () => {
    expect(CANONICAL_ROUTES.map((r) => r.path)).toContain('/returns');
  });

  it('the footer Legal links include Returns & Refunds → /returns', () => {
    // Footer is a JSX component (not vitest-importable); assert the
    // LEGAL_LINKS data it renders from, at source level.
    const footer = read('components/layout/Footer.tsx');
    expect(footer).toContain(
      "{ href: '/returns', label: 'Returns & Refunds' }",
    );
    const legalBlock = footer.slice(
      footer.indexOf('const LEGAL_LINKS'),
      footer.indexOf('];', footer.indexOf('const LEGAL_LINKS')),
    );
    expect(legalBlock).toContain('/returns');
  });
});

describe('sitemap herb routes (Stage 4)', () => {
  it('lists the full Herbal Index route set: 310 herb routes', () => {
    const params = herbalRouteParams();
    expect(params).toHaveLength(310);
    const base = siteUrl();
    const urls = sitemap().map((e) => e.url);
    const herbUrls = urls.filter((u) => u.includes('/herbal-library/'));
    expect(herbUrls).toHaveLength(310);
    for (const p of params) {
      expect(herbUrls).toContain(`${base}/herbal-library/${p.herb}`);
    }
    // The original 29 legacy slugs are all still listed.
    for (const slug of ['ashwagandha', 'valerian-root', 'willow-bark', 'comfrey']) {
      expect(herbUrls).toContain(`${base}/herbal-library/${slug}`);
    }
    // And the returns route joined the sitemap via the registry.
    expect(urls).toContain(`${base}/returns`);
  });
});
