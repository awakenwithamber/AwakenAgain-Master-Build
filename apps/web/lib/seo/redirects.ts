/**
 * Typed legacy → Next.js redirect map for Amber's Alchemy Apothecary.
 *
 * SOURCING RULE (binding): a rule exists here only if its legacy source
 * is documented in PRODUCTION_CONTRACT.md, NEXTJS_ARCHITECTURE_REPORT.md,
 * or CONVERSION_MAP.md §8 row 105 (dead legacy targets → real routes).
 * The legacy netlify.toml held ~25 rules, but only a few are named in the
 * contract; the rest (unnamed SEO product aliases) are NOT invented here.
 * They are flagged NEEDS_VERIFICATION in the ledger — a full netlify.toml
 * inventory from the legacy repo is required before the DNS cutover gate.
 *
 * ANCHORS: browsers never send '#fragment' to the server, so legacy SPA
 * anchors (/#shop, /#soaps, /#checkout …) can never be server redirects.
 * They are mapped in LEGACY_ANCHOR_MAP (below) with resolveLegacyAnchor(),
 * applied client-side by components/seo/LegacyAnchorRedirect.tsx.
 * The anchor inventory is documented in NEXTJS_ARCHITECTURE_REPORT.md §57
 * and CONVERSION_MAP.md §1 (the SPA shell's section list). Only anchors
 * whose Next.js destination page EXISTS are mapped; content routes not yet
 * built (G7) are listed in LEGACY_ANCHORS_UNMAPPED — never pointed at a
 * page that does not exist.
 *
 * Provider-neutral: this map is consumed by the standard Next.js
 * middleware (middleware.ts). No provider SDKs, no edge-only APIs —
 * pure NextResponse.redirect, which runs on any Next.js host.
 *
 * Report deviation (logged): NEXTJS_ARCHITECTURE_REPORT.md §15 Phase 1
 * suggested next.config redirects(); this task implemented the typed map
 * in middleware.ts so the rules stay unit-testable (see redirects.test.ts
 * and the §19 regression suite). Either mechanism is provider-neutral;
 * consolidation into next.config redirects() remains an option at Phase 5.
 */

export type RedirectStatus = 301 | 302 | 307 | 308;

export interface RedirectRule {
  /** Legacy path as it appeared in netlify.toml / sitemap. */
  source: string;
  /** Canonical Next.js destination path. Internal only — never a '#' fragment. */
  destination: string;
  status: RedirectStatus;
  /** Where the legacy source is documented — never "assumed". */
  sourceRef: string;
  /** Why the rule exists. */
  reason: string;
}

export const REDIRECT_RULES: RedirectRule[] = [
  {
    source: '/grimior.html',
    destination: '/grimoire',
    status: 301,
    sourceRef:
      'PRODUCTION_CONTRACT.md §2 + NEXTJS_ARCHITECTURE_REPORT.md §2 (standalone legacy page); owner directive: keep /grimoir.html as alias with correct "Grimoire" spelling canonical',
    reason: 'Misspelled legacy alias → canonical Grimoire route (permanent).',
  },
  {
    source: '/dream-ease-capsules',
    destination: '/shop/dreamease-capsules',
    status: 301,
    sourceRef:
      'PRODUCTION_CONTRACT.md §2 (legacy SEO alias → /#dreamease, 200 rewrite); canonical handle "dreamease-capsules" from products.canonical.v3.json; product route shape /shop/[handle] from NEXTJS_ARCHITECTURE_REPORT.md §14',
    reason:
      'Legacy SEO product alias → canonical product page. Fragment target replaced with a real route (legacy sitemap fragment defect must not be recreated).',
  },
  {
    source: '/contact.html',
    destination: '/contact',
    status: 301,
    sourceRef:
      'PRODUCTION_CONTRACT.md §2 (contact.html committed bf00bcb, never deployed); /contact is a clean legacy sitemap URL and the canonical contact route',
    reason: 'Legacy committed contact page → canonical /contact (permanent).',
  },
  {
    source: '/herbal-index.html',
    destination: '/herb-index',
    status: 301,
    sourceRef:
      'CONVERSION_MAP.md §8 row 105 (dead legacy target "/herbal-index.html" MISSING → remapped to a real route); /herb-index is a clean legacy sitemap URL and the canonical herb-index route',
    reason: 'Dead legacy target → closest real route (permanent).',
  },
  {
    source: '/create-remedy.html',
    destination: '/custom-formula',
    status: 301,
    sourceRef:
      'CONVERSION_MAP.md §8 row 105 (dead legacy target "/create-remedy.html" MISSING → remapped to a real route); the custom-formula builder is the live remedy-creation surface',
    reason: 'Dead legacy target → closest real route (permanent).',
  },
  {
    source: '/articles.html',
    destination: '/journal',
    status: 301,
    sourceRef:
      'CONVERSION_MAP.md §8 row 105 (dead legacy target "/articles.html" MISSING → remapped to a real route); /journal is the canonical articles destination per CONVERSION_MAP §1',
    reason: 'Dead legacy target → closest real route (permanent).',
  },
  {
    source: '/admin.html',
    destination: '/admin',
    status: 301,
    sourceRef:
      'NEXTJS_ARCHITECTURE_REPORT.md §60 (admin.html standalone legacy page); CONVERSION_MAP §11 rows 99–101 (admin.html → app/admin/* REBUILD); G12 lands the read-only admin first',
    reason: 'Legacy standalone admin page → Next.js admin section (permanent).',
  },
];

/* ------------------------------------------------------------------ */
/* Legacy SPA anchors — client-side only (fragments never reach the    */
/* server). Applied by components/seo/LegacyAnchorRedirect.tsx.        */
/* ------------------------------------------------------------------ */

/**
 * Legacy anchor → Next.js route. Source: NEXTJS_ARCHITECTURE_REPORT.md §57
 * ("SPA root index.html serves all /#section anchors") + CONVERSION_MAP.md
 * §1 (the SPA shell's section inventory). Only anchors whose destination
 * page EXISTS in this app are mapped — see LEGACY_ANCHORS_UNMAPPED.
 */
export const LEGACY_ANCHOR_MAP: Record<string, string> = {
  '#home': '/',
  '#shop': '/shop',
  '#soaps': '/soap-shop',
  '#about': '/about',
  '#checkout': '/checkout',
  '#bundle': '/soap-builder',
};

/**
 * Legacy anchors with NO destination yet — content routes not yet built
 * (G7: herbal-wisdom, herbal-library, herb-index, journal, faqs, services,
 * custom-formula, contact; G6 quiz). resolveLegacyAnchor() returns undefined
 * for these: the client leaves the user where they are instead of inventing
 * a destination.
 */
export const LEGACY_ANCHORS_UNMAPPED: readonly string[] = [
  '#herb-index',
  '#journal',
  '#custom-formula',
  '#services',
  '#herbal-wisdom',
  '#herbal-library',
  '#faqs',
  '#contact',
  '#quiz',
];

/**
 * Resolve a legacy SPA anchor to its Next.js route, or undefined when the
 * anchor is unknown or its destination is not built yet. Accepts the hash
 * with or without the leading '#'; matching is case-insensitive.
 */
export function resolveLegacyAnchor(hash: string): string | undefined {
  const normalized = (hash.startsWith('#') ? hash : `#${hash}`).toLowerCase();
  return LEGACY_ANCHOR_MAP[normalized];
}

const RULE_INDEX = new Map<string, RedirectRule>(
  REDIRECT_RULES.map((r) => [r.source, r]),
);

/** Exact-path lookup. Callers pass request.nextUrl.pathname (no query, no hash). */
export function findRedirect(pathname: string): RedirectRule | undefined {
  return RULE_INDEX.get(pathname);
}

/**
 * Structural validation of the map. Returns a list of problems; empty means
 * the map is clean. Rules enforced:
 * - unique sources, sources start with '/'
 * - no self-loops, no chained redirects (destination must not be another source)
 * - destinations are internal paths with NO '#' fragments
 */
export function validateRedirectMap(rules: RedirectRule[] = REDIRECT_RULES): string[] {
  const problems: string[] = [];
  const sources = new Set<string>();
  for (const r of rules) {
    if (!r.source.startsWith('/')) problems.push(`source must start with '/': ${r.source}`);
    if (sources.has(r.source)) problems.push(`duplicate source: ${r.source}`);
    sources.add(r.source);
    if (r.source === r.destination) problems.push(`self-loop: ${r.source}`);
    if (!r.destination.startsWith('/')) {
      problems.push(`destination must be an internal path: ${r.destination}`);
    }
    if (r.destination.includes('#')) {
      problems.push(`destination contains a fragment (legacy defect): ${r.destination}`);
    }
    if (!r.sourceRef || r.sourceRef.trim().length === 0) {
      problems.push(`missing sourceRef (unsourced rule is not allowed): ${r.source}`);
    }
  }
  for (const r of rules) {
    if (sources.has(r.destination)) {
      problems.push(`redirect chain: ${r.source} → ${r.destination} is itself a source`);
    }
  }
  return problems;
}
