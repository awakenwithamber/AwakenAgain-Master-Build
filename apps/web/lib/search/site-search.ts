/**
 * Site-wide search (owner directive 2026-11-10: "Add a search bar to
 * the menu so people can find anything in the website").
 *
 * One index over EVERYTHING a visitor can look for — products, services
 * (both the bookable catalog services and the in-depth service landing
 * pages), the site's content pages, and the journal articles — built at
 * module load from the same typed registries the pages themselves
 * render from, so a result can never drift from the page it names:
 *
 * - Products ......... lib/catalog/products (PRODUCTS), minus retired
 *                      (superseded) records and minus the service
 *                      records, which are indexed as services.
 * - Services ......... lib/content/services (SERVICES — the bookable
 *                      catalog services, linked to their /shop page)
 *                      and lib/content/service-pages (SERVICE_PAGES —
 *                      the /services/<slug> landing pages).
 * - Pages ............ PAGE_INDEX below: the canonical content routes
 *                      (lib/seo/routes) with hand-written titles,
 *                      blurbs, and keywords. Transactional/utility
 *                      states (/cart, /checkout, /account, /sitemap)
 *                      are deliberately not indexed — they are places
 *                      you arrive at, not things you look for.
 * - Journal .......... lib/content/journal (JOURNAL_ARTICLES).
 * - Herbs ............ every individual herb page (/herbal-library/<slug>),
 *                      via lib/search/herb-search-data.ts — a compact
 *                      GENERATED data file (scripts/generate-herb-search-
 *                      data.mjs) derived from the exact registries the
 *                      herb pages render from (lib/herbal-index/cards:
 *                      herbalRouteParams + getHerbalCard, and
 *                      lib/content/herbs: HERB_INDEX). The full herbal
 *                      registries are NOT imported here: this module
 *                      runs in the browser, and the registries plus
 *                      their references/illustration overlays would
 *                      bloat every page's first-load bundle. The
 *                      generated file is guarded by
 *                      lib/search/herb-search-data.test.ts, which
 *                      re-derives every record from the source
 *                      registries and fails on any drift.
 *
 * Scoring mirrors the catalog search (lib/search/search.ts):
 * field-weighted substring matching over lowercase tokens, title first,
 * deterministic ordering. Two query-level boosts sit on top (owner
 * ranking correction 2026-11-10): a result whose title IS the query
 * wins outright, and a result whose title contains every query token
 * is strongly preferred — so searching an herb's name ("lavender")
 * returns that herb's own page first, ahead of products that merely
 * contain the herb, while a generic query like "products" still leads
 * with the shop and product results (herb records carry no such words:
 * their searchable text is the record's own name, Latin name,
 * categories, and recorded properties). No network, no external
 * service — the registries ARE the index. UI lives in
 * components/ui/Search.tsx (header dropdown) and app/search/page.tsx
 * (full results page).
 */
import { PRODUCTS } from '../catalog/products';
import { getProductByHandle } from '../catalog/products';
import { isSupersededProduct } from '../catalog/status';
import { SERVICES } from '../content/services';
import { SERVICE_PAGES, servicePagePath } from '../content/service-pages';
import { JOURNAL_ARTICLES } from '../content/journal';
import { HERB_SEARCH_DATA } from './herb-search-data';

export type SiteSearchKind = 'product' | 'service' | 'page' | 'article' | 'herb';

export const SITE_SEARCH_KIND_LABELS: Record<SiteSearchKind, string> = {
  product: 'Product',
  service: 'Service',
  page: 'Page',
  article: 'Journal',
  herb: 'Herb',
};

export interface SiteSearchEntry {
  kind: SiteSearchKind;
  title: string;
  href: string;
  /** One-line description shown under the title in results. */
  blurb: string;
  /** Extra searchable words: category, tags, ingredients, keywords. */
  keywords: string;
  /** Longer searchable text (descriptions, excerpts) — never displayed. */
  body: string;
  /** Dollar price when the record publishes one, else null. */
  price: number | null;
}

export interface SiteSearchResult extends SiteSearchEntry {
  score: number;
}

interface PageIndexEntry {
  title: string;
  href: string;
  blurb: string;
  keywords: string;
}

/**
 * The site's content pages, in the words a visitor would use to look
 * for them. Hrefs are the canonical routes (lib/seo/routes.ts) plus
 * the custom-formula pages the nav links. Copy follows the wording
 * canon: botanical-goods language, no remedy/treatment claims.
 */
const PAGE_INDEX: PageIndexEntry[] = [
  {
    title: "Amber's Alchemy Apothecary — Home",
    href: '/',
    blurb: 'Botanical soaps, teas, capsules, services, and the Living Grimoire.',
    keywords: 'home start welcome apothecary awaken with amber',
  },
  {
    title: 'Shop All',
    href: '/shop',
    blurb: 'Every product in the apothecary — soaps, teas, balms, capsules, and more.',
    keywords: 'shop all products buy browse catalog store everything',
  },
  {
    title: 'Soap Shop',
    href: '/soap-shop',
    blurb: 'Handmade botanical soaps, from signature bars to the custom soap builder.',
    keywords: 'soap shop bars handmade goat milk shea',
  },
  {
    title: 'Custom Soap Builder',
    href: '/soap-builder',
    blurb: 'Build your own bar — choose the base, scents, colors, and botanicals.',
    keywords: 'custom soap builder build your own bar personalized make your own',
  },
  {
    title: 'Custom Formulas',
    href: '/custom-formula',
    blurb: 'Personalized botanical formulas — capsules, teas, and balms made for you.',
    keywords: 'custom formula personalized builder capsules tea balm',
  },
  {
    title: 'Custom Tea Blends',
    href: '/custom-formula/tea',
    blurb: 'Blend your own loose-leaf tea from the apothecary’s herbs.',
    keywords: 'custom tea blend builder loose leaf herbs',
  },
  {
    title: 'The Living Grimoire',
    href: '/grimoire',
    blurb:
      'The Living Grimoire — the collective works of light magic & lost knowledge. The first 17 pages are free to read; the full book opens while your subscription is active.',
    keywords: 'living grimoire book read pages subscribe subscription membership spells rituals',
  },
  {
    title: 'Subscribe to the Living Grimoire',
    href: '/grimoire/subscribe',
    blurb:
      'Join for $7.77/month — the full Living Grimoire, 10% off storewide, exclusive articles & rituals, and early access to new releases.',
    keywords: 'subscribe subscription membership join grimoire monthly benefits discount',
  },
  {
    title: 'Herbal Allies Quiz — Find My Formula',
    href: '/quiz',
    blurb: 'Answer a few questions and meet the herbal allies matched to you.',
    keywords: 'quiz herbal allies find my formula discover recommendations which herb',
  },
  {
    title: 'Services & Readings',
    href: '/services',
    blurb: 'Consultations, readings, energy work, and guided sessions with Amber.',
    keywords: 'services readings bookings sessions spiritual guidance book',
  },
  {
    title: 'Apothecary Journal',
    href: '/journal',
    blurb: 'Stories, plant lore, and notes from the apothecary bench.',
    keywords: 'journal articles blog stories reading plant lore',
  },
  {
    title: 'Herbal Wisdom',
    href: '/herbal-wisdom',
    blurb: 'Learn the apothecary’s approach to herbs, rituals, and seasonal living.',
    keywords: 'herbal wisdom learn education guides how to',
  },
  {
    title: 'Herb Encyclopedia',
    href: '/herb-index',
    blurb: 'Browse the herbs of the apothecary, one plant at a time.',
    keywords: 'herb encyclopedia index plants lavender chamomile mugwort valerian lemon balm',
  },
  {
    title: 'FAQs',
    href: '/faqs',
    blurb: 'Answers about ordering, shipping, subscriptions, and more.',
    keywords: 'questions answers faq help shipping delivery returns subscription',
  },
  {
    title: 'About Amber',
    href: '/about',
    blurb: 'The story of Amber and Awaken With Amber LLC.',
    keywords: 'about amber story who is awaken with amber llc',
  },
  {
    title: 'Contact Amber — Book a Free Consultation',
    href: '/contact',
    blurb:
      'Questions, custom work, or a free consultation — write to arrange a time. Every message is read personally by Amber.',
    keywords: 'free consultation consultation book appointment talk email message contact help',
  },
  {
    title: 'Support',
    href: '/support',
    blurb: 'Help with an order, a subscription, or your account.',
    keywords: 'support help order problem issue customer care',
  },
  {
    title: 'Order Status',
    href: '/order-status',
    blurb: 'Track an order you have placed with the apothecary.',
    keywords: 'track order status where is my order delivery tracking',
  },
  {
    title: 'Returns & Exchanges',
    href: '/returns',
    blurb: 'The returns policy — unopened items within 30 days of delivery.',
    keywords: 'returns exchanges refund policy send back',
  },
  {
    title: 'Awaken Network',
    href: '/network',
    blurb: 'The wider Awaken ecosystem — community, platforms, and projects.',
    keywords: 'network community awaken ecosystem projects',
  },
  {
    title: 'Partner With Us',
    href: '/partner',
    blurb: 'Wholesale, collaboration, and partnership inquiries.',
    keywords: 'partner partnership wholesale collaborate business',
  },
  {
    title: 'Links',
    href: '/links',
    blurb: 'Everywhere to find Amber — social profiles and sister sites.',
    keywords: 'links social follow instagram facebook everywhere',
  },
  {
    title: 'Terms of Service',
    href: '/terms',
    blurb: 'The terms that govern shopping and services at the apothecary.',
    keywords: 'terms service agreement rules legal',
  },
  {
    title: 'Privacy Policy',
    href: '/privacy',
    blurb: 'How the apothecary handles your information.',
    keywords: 'privacy policy data information legal',
  },
  {
    title: 'Legal',
    href: '/legal',
    blurb: 'Legal notices for Awaken With Amber LLC.',
    keywords: 'legal notices disclaimer llc',
  },
];

function buildIndex(): SiteSearchEntry[] {
  const entries: SiteSearchEntry[] = [];
  const serviceHandles = new Set(SERVICES.map((s) => s.handle));

  // Products — the physical catalog. Service records are indexed as
  // services below, so the same record never appears twice.
  for (const p of PRODUCTS) {
    if (isSupersededProduct(p)) continue;
    if (serviceHandles.has(p.handle)) continue;
    const tags = Array.isArray(p.tags) ? p.tags.join(' ') : '';
    const ingredients = Array.isArray(p.featured_ingredients)
      ? p.featured_ingredients.join(' ')
      : '';
    entries.push({
      kind: 'product',
      title: p.title ?? p.handle,
      href: `/shop/${p.handle}`,
      blurb: p.short_description ?? '',
      keywords: `${p.category ?? ''} ${p.subcategory ?? ''} ${tags} ${ingredients}`,
      body: `${p.short_description ?? ''} ${p.extended_description ?? ''}`,
      price: typeof p.price === 'number' ? p.price : null,
    });
  }

  // Bookable services (catalog service records). A service whose
  // underlying record has been retired is never surfaced.
  for (const s of SERVICES) {
    const record = getProductByHandle(s.handle);
    if (record && isSupersededProduct(record)) continue;
    entries.push({
      kind: 'service',
      title: s.title,
      href: `/shop/${s.handle}`,
      blurb: s.shortDescription ?? '',
      keywords: `${s.category} service book session`,
      body: s.shortDescription ?? '',
      price: s.price,
    });
  }

  // Service landing pages (/services/<slug>).
  for (const sp of SERVICE_PAGES) {
    entries.push({
      kind: 'service',
      title: sp.title,
      href: servicePagePath(sp.slug),
      blurb: sp.deliveryNote,
      keywords: `${sp.eyebrow} service session`,
      body: `${sp.metaDescription} ${sp.intro[0] ?? ''}`,
      price: null,
    });
  }

  // Content pages.
  for (const page of PAGE_INDEX) {
    entries.push({
      kind: 'page',
      title: page.title,
      href: page.href,
      blurb: page.blurb,
      keywords: page.keywords,
      body: page.blurb,
      price: null,
    });
  }

  // Herbs — every individual herb page, one entry per route the
  // herbal library actually serves (lib/herbal-index/cards'
  // herbalRouteParams: every catalog record plus the canonical alias
  // routes). Fields are the record's own values via the compact
  // generated data (see herb-search-data.ts): the title and Latin
  // name as displayed, the category labels as keywords, and the
  // record's recorded properties (its "Properties:" folkloric list)
  // as search-only body text — displayed nowhere in search results.
  for (const h of HERB_SEARCH_DATA) {
    entries.push({
      kind: 'herb',
      title: h.name,
      href: `/herbal-library/${h.slug}`,
      blurb: h.latin
        ? `${h.latin}${h.labels.length ? ` · ${h.labels.join(' · ')}` : ''}`
        : h.labels.join(' · '),
      keywords: `${h.latin} ${h.aka ?? ''} ${h.labels.join(' ')} herb herbal encyclopedia`,
      body: h.props.join(' '),
      price: null,
    });
  }

  // Journal articles.
  for (const a of JOURNAL_ARTICLES) {
    entries.push({
      kind: 'article',
      title: a.title,
      href: `/journal/${a.slug}`,
      blurb: a.excerpt,
      keywords: `${a.tag} journal article ${a.keyHerbs.join(' ')}`,
      body: `${a.excerpt} ${a.paragraphs[0] ?? ''}`,
      price: null,
    });
  }

  return entries;
}

/** The full site index, built once from the live registries. */
export const SITE_SEARCH_INDEX: readonly SiteSearchEntry[] = buildIndex();

const DEFAULT_LIMIT = 10;

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

function scoreEntry(tokens: string[], e: SiteSearchEntry): number {
  const title = e.title.toLowerCase();
  const slug = e.href.replace(/[^a-z0-9]+/g, ' ');
  const keywords = e.keywords.toLowerCase();
  const blurb = e.blurb.toLowerCase();
  const body = e.body.toLowerCase();
  let score = 0;
  for (const tok of tokens) {
    if (title.includes(tok)) score += 10;
    if (slug.includes(tok)) score += 8;
    if (keywords.includes(tok)) score += 5;
    if (blurb.includes(tok)) score += 3;
    if (body.includes(tok)) score += 2;
  }
  // Query-level title boosts (owner ranking correction 2026-11-10):
  // the page the query NAMES beats pages that merely mention it. An
  // exact title match ("lavender" → the Lavender herb page) wins
  // outright over products containing the word; a title covering
  // every query token ("free consultation" → the contact page whose
  // title carries the phrase) is strongly preferred. This is general
  // scoring, not a per-word special case.
  const query = tokens.join(' ');
  if (query.length >= 2 && title === query) score += 40;
  else if (tokens.every((tok) => title.includes(tok))) score += 12;
  return score;
}

/**
 * Ranked site-wide search across products, services, pages, journal
 * articles, and herbs. Empty/short queries (no token of 2+ characters)
 * return []. Deterministic — ties break by title, then href.
 */
export function searchSite(query: string, limit: number = DEFAULT_LIMIT): SiteSearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const scored: SiteSearchResult[] = [];
  for (const entry of SITE_SEARCH_INDEX) {
    const score = scoreEntry(tokens, entry);
    if (score > 0) scored.push({ ...entry, score });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.title.localeCompare(b.title) ||
      a.href.localeCompare(b.href),
  );
  return scored.slice(0, Math.max(0, limit));
}
