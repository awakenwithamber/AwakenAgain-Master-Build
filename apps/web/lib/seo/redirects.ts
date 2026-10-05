/**
 * Typed legacy → Next.js redirect map for Amber's Alchemy Apothecary.
 *
 * SOURCING RULE (binding): a rule exists here only if its legacy source
 * is documented in PRODUCTION_CONTRACT.md or NEXTJS_ARCHITECTURE_REPORT.md.
 * The legacy netlify.toml held ~25 rules, but only a few are named in the
 * contract; the rest (old-anchor 301s, ~9 unnamed SEO product aliases) are
 * NOT invented here. They are flagged NEEDS_VERIFICATION in the ledger —
 * a full netlify.toml inventory from the legacy repo is required before
 * the DNS cutover gate.
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
];

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
