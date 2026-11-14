/**
 * SEO HYGIENE regression suite — 2026-11-08 perfection audit.
 *
 * Guards the three defects the audit found live:
 *  1. Canonical collapse: the root layout set `canonical: '/'`, which
 *     Next.js metadata inheritance applied to every page that did not set
 *     its own — 16 of 18 sampled live pages canonicalised to the HOMEPAGE.
 *     Rule: the layout carries NO canonical; every page (static metadata
 *     or generateMetadata) self-canonicals to its own route.
 *  2. '/herbal-wisdom' (a permanent redirect to '/herb-index') was in the
 *     sitemap registry and linked from navigation. Rule: it appears in
 *     neither CANONICAL_ROUTES nor the nav/footer/sitemap-page link lists.
 *  3. The homepage Best Sellers card for the Alchemy Soap Collection
 *     pointed at /images/products/soap-style-collection-5.webp (404)
 *     because components/home/product-cards.ts ignored the registered
 *     product image. Rule: every Best Sellers card image resolves to a
 *     file that exists under public/.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CANONICAL_ROUTES } from '../lib/seo/routes';
import { BEST_SELLER_HANDLES } from '../components/home/data';
import { toCardModel } from '../components/home/product-cards';
import { getProductByHandle } from '../lib/catalog/products';

const APP_DIR = join(process.cwd(), 'app');
const ROOT = process.cwd();

function pageFiles(dir: string, base = ''): { file: string; route: string }[] {
  const out: { file: string; route: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      out.push(...pageFiles(join(dir, entry.name), `${base}/${entry.name}`));
    } else if (entry.name === 'page.tsx') {
      out.push({ file: join(dir, entry.name), route: base || '/' });
    }
  }
  return out;
}

describe('canonical hygiene (audit Critical #1)', () => {
  it('root layout sets NO canonical (a layout canonical inherits site-wide)', () => {
    const layout = readFileSync(join(APP_DIR, 'layout.tsx'), 'utf8')
      // Strip comments — the layout documents this very rule in a comment.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(layout).not.toMatch(/canonical\s*:/);
  });

  it('every static page self-canonicals to its own route', () => {
    for (const { file, route } of pageFiles(APP_DIR)) {
      if (route.includes('[')) continue; // dynamic routes: next test
      const src = readFileSync(file, 'utf8');
      expect(src, `${route} must self-canonical`).toContain(
        `canonical: '${route}'`,
      );
    }
  });

  it('every dynamic page sets a canonical from its own slug', () => {
    for (const { file, route } of pageFiles(APP_DIR)) {
      if (!route.includes('[')) continue;
      const src = readFileSync(file, 'utf8');
      expect(src, `${route} must set alternates.canonical`).toMatch(
        /alternates:\s*\{\s*canonical:/,
      );
    }
  });
});

describe('single-H1 contexts (audit Fail #27)', () => {
  it('the standalone quiz page promotes its intro heading to H1; the homepage embed does not', () => {
    const quizPage = readFileSync(join(APP_DIR, 'quiz/page.tsx'), 'utf8');
    expect(quizPage).toContain('introHeadingAs="h1"');
    const invite = readFileSync(
      join(ROOT, 'components/home/QuizInvite.tsx'),
      'utf8',
    );
    expect(invite).not.toContain('introHeadingAs="h1"');
  });

  it('/soap-shop demotes the embedded builder title to H2', () => {
    const soapShop = readFileSync(join(APP_DIR, 'soap-shop/page.tsx'), 'utf8');
    expect(soapShop).toContain('titleAs="h2"');
  });
});

describe('redirect hygiene (audit Critical #2)', () => {
  it('/herbal-wisdom is not a registered canonical route', () => {
    expect(CANONICAL_ROUTES.map((r) => r.path)).not.toContain('/herbal-wisdom');
    expect(CANONICAL_ROUTES.map((r) => r.path)).toContain('/herb-index');
  });

  it('navigation, footer, and the sitemap page never link /herbal-wisdom', () => {
    for (const rel of [
      'lib/nav.ts',
      'components/layout/Footer.tsx',
      'app/sitemap/page.tsx',
    ]) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      expect(src, `${rel} must not link a redirect`).not.toContain(
        "href: '/herbal-wisdom'",
      );
      expect(src, `${rel} must not link a redirect`).not.toContain(
        'href="/herbal-wisdom"',
      );
    }
  });
});

describe('homepage card images (audit Fail #12)', () => {
  it('every Best Sellers card image exists under public/', () => {
    for (const handle of BEST_SELLER_HANDLES) {
      const product = getProductByHandle(handle);
      expect(product, `catalog record for ${handle}`).toBeDefined();
      const model = toCardModel(product!);
      expect(model, `card model for ${handle}`).not.toBeNull();
      expect(
        existsSync(join(ROOT, 'public', model!.imageSrc)),
        `${handle} card image ${model!.imageSrc} must exist`,
      ).toBe(true);
    }
  });

  it('the Alchemy Soap Collection card uses its registered lineup image', () => {
    const model = toCardModel(getProductByHandle('soap-style-collection-5')!);
    expect(model!.imageSrc).toBe('/images/soap/soap-lineup-5.png');
  });
});
