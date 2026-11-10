/**
 * Phase 2, Workstream 2 — cleanup pins.
 *
 *  - Stripe must not appear in CUSTOMER-FACING copy on the privacy,
 *    subscribe, and account surfaces. Comments are stripped before
 *    scanning (parked-code comments are honest engineering notes, not
 *    customer copy), and code identifiers (stripe_card_embedded) are
 *    not words. The ONE deliberate exception is the privacy page's
 *    historical sentence documenting earlier-2026 card transactions
 *    (decision-packet wording, flagged for the owner) — this test pins
 *    it to exactly that one sentence so it can never quietly grow.
 *  - /herbal-library redirects to /herb-index (bare path only, so the
 *    [herb] detail routes keep working).
 *  - The nav carries exactly ONE /herb-index entry, labeled
 *    'Herb Encyclopedia' (the destination's own H1); the footer keeps
 *    its link.
 *  - Scent recipe IDs never render for customers: both former leak
 *    sites compose through scentSelectionLabel, which resolves
 *    SCENT_RECIPE_01 to 'Moonlit Lavender'.
 *  - GrimoireGate states the true rule: 16 free pages, 17 onward locked.
 *  - Gaia's panel carries the profile CTA linking /account.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NAV_ENTRIES } from '../lib/nav';
import { scentSelectionLabel } from '../lib/catalog/scents';

const ROOT = resolve(__dirname, '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry))
      yield full;
  }
}

/** Strip block + line comments so only code and copy remain. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function stripeWordHits(rel: string): string[] {
  const stripped = stripComments(read(rel));
  return stripped.match(/\bstripe\b/gi) ?? [];
}

describe('Stripe-free customer copy (WS2a)', () => {
  const scannedDirs = [
    'app/privacy',
    'app/grimoire/subscribe',
    'app/account',
    'components/account',
    'components/grimoire',
  ];

  it('the only Stripe word left on those surfaces is the one pinned historical sentence in /privacy', () => {
    const hits: Record<string, number> = {};
    for (const dir of scannedDirs) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = file.slice(ROOT.length + 1);
        const found = stripeWordHits(rel);
        if (found.length > 0) hits[rel] = found.length;
      }
    }
    expect(hits).toEqual({ 'app/privacy/page.tsx': 1 });
    const privacyText = stripComments(read('app/privacy/page.tsx')).replace(
      /\s+/g,
      ' ',
    );
    expect(privacyText).toContain('earlier in 2026 were processed by Stripe');
    expect(privacyText).toContain('not offered today');
  });

  it('the subscribe page describes the manual flow (invoice / Venmo / Cash App) for the subscription rail', () => {
    const subscribe = stripComments(read('app/grimoire/subscribe/page.tsx'));
    const form = stripComments(read('components/grimoire/SubscribeForm.tsx'));
    // $8.88 ABOLITION (2026-11-09): the unlock panel that carried the
    // second rail's copy is deleted; the subscription rail's manual
    // flow description stands on the page itself.
    expect(subscribe).toContain('Venmo');
    expect(subscribe).toContain('Cash App');
    expect(subscribe).not.toContain('$8.88');
    expect(form).toContain('Amber confirms');
    expect(subscribe).toContain('Amber confirms');
  });
});

describe('/herbal-library redirect (WS2b)', () => {
  it('next.config redirects the bare path to /herb-index, permanently, without a wildcard', () => {
    const config = read('next.config.mjs');
    expect(config).toMatch(
      /source:\s*'\/herbal-library',\s*destination:\s*'\/herb-index',\s*permanent:\s*true/,
    );
    expect(config).not.toContain('/herbal-library/:path*');
    expect(config).not.toContain("/herbal-library/'");
  });
});

describe('nav consolidation (WS2c)', () => {
  it('exactly one /herb-index entry across all nav groups, labeled Herb Encyclopedia', () => {
    const all = NAV_ENTRIES.flatMap((e) =>
      e.kind === 'link' ? [{ href: e.href, label: e.label }] : e.links,
    );
    const herbLinks = all.filter((l) => l.href === '/herb-index');
    expect(herbLinks).toEqual([{ href: '/herb-index', label: 'Herb Encyclopedia' }]);
    expect(all.some((l) => l.label === 'Articles & Guides')).toBe(false);
  });

  it('the footer site map still links /herb-index', () => {
    const footer = read('components/layout/Footer.tsx');
    expect(footer).toContain("href: '/herb-index'");
  });
});

describe('scent-name regression (WS2d)', () => {
  it('a signature scent line shows the recipe NAME, never the ID', () => {
    const label = scentSelectionLabel({
      type: 'signature',
      recipe_id: 'SCENT_RECIPE_01',
    });
    expect(label).toBe('Signature: Moonlit Lavender');
    expect(label).not.toContain('SCENT_RECIPE');
  });

  it('an unknown recipe ID falls back without leaking the ID', () => {
    const label = scentSelectionLabel({
      type: 'signature',
      recipe_id: 'SCENT_RECIPE_99',
    });
    expect(label).not.toContain('SCENT_RECIPE');
    expect(label).toContain('Signature');
  });

  it('custom blends still list their oils', () => {
    expect(
      scentSelectionLabel({ type: 'custom_blend', oils: ['lavender', 'sage'] }),
    ).toBe('Custom blend: lavender + sage');
  });

  it('both former leak sites compose through the shared label helper', () => {
    for (const rel of [
      'components/checkout/CartView.tsx',
      'components/shop/BundleBuilder.tsx',
    ]) {
      const src = read(rel);
      expect(src, rel).toContain('scentSelectionLabel');
      expect(src, rel).not.toMatch(/Signature[^`\n]*\$\{[^}]*recipe_id/);
    }
  });
});

describe('GrimoireGate copy (WS2e)', () => {
  it('states the true rule: first 17 pages free, page 18 onward locked', () => {
    const src = read('components/grimoire/GrimoireGate.tsx');
    expect(src).toContain('first 17 pages are free');
    expect(src).toContain('From page 18, the book opens to');
    expect(src).toContain('awaken a subscription and all 1,051 pages are yours');
    expect(src).not.toContain('Permanent-unlock holders');
    expect(src).not.toContain('Pages 14 and onward');
  });
});

describe('Gaia profile CTA (WS2f)', () => {
  it("the chat panel carries a prominent 'Create your free profile' link to /account", () => {
    const src = read('components/chat/HerbalChat.tsx');
    expect(src).toContain('Create your free profile');
    expect(src).toContain('href="/account"');
    expect(src).toContain('herbal-chat-profile-cta');
  });
});
