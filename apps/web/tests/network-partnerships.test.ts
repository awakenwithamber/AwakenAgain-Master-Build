/**
 * Awaken Network pane + Partnerships — build guards (2026-10-15,
 * audit fix #8).
 *
 * What this suite locks in:
 * - Content integrity: exactly the seven owner-documented projects,
 *   each with a one-liner and an honest status; only the apothecary
 *   is live and links anywhere. Exactly the six contribution ways.
 * - Reachability: /network and /partner are in the nav AND in the
 *   canonical route registry (so the sitemap picks them up), the
 *   footer links both, and the homepage carries the invite section.
 * - EXCLUSION GUARD: the name the owner has barred from this site
 *   occurs in NO app/component/lib source file. It is assembled from
 *   fragments below so this test does not trip its own scan.
 * - Honesty guard: none of the new surfaces states or implies
 *   affiliate money terms (no rates, no percentages, no $ amounts,
 *   no guarantees) — the program is forming and copy must say only
 *   that.
 * - Storage: both new lead kinds append through the JSONL store into
 *   their own per-kind files (PG parity lives in
 *   lib/events/postgres-stores.test.ts, gated like the rest).
 */
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NAV_ENTRIES, navHrefs } from '../lib/nav';
import { CANONICAL_ROUTES } from '../lib/seo/routes';
import {
  NETWORK_PROJECTS,
  NETWORK_PROJECT_SLUGS,
} from '../lib/content/network';
import { CONTRIBUTION_TYPES } from '../lib/content/partnerships';
import { JsonlLeadStore } from '../lib/leads/lead-store';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

/** The barred name, assembled so this file never contains it whole. */
const BARRED = ['Josep', 'hine'].join('');

describe('network content (lib/content/network.ts)', () => {
  it('carries exactly the seven documented projects, in order', () => {
    expect(NETWORK_PROJECT_SLUGS).toEqual([
      'ambers-alchemy-apothecary',
      'awaken-network',
      'awaken-mobile',
      'farah-growth-studio',
      'awaken-agents',
      'awaken-eco-villages',
      'brandalchemy',
    ]);
    for (const p of NETWORK_PROJECTS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.oneLiner.length).toBeGreaterThan(0);
      expect(p.statusLabel.length).toBeGreaterThan(0);
    }
  });

  it('only the apothecary is live, and it is the only project with a link', () => {
    const live = NETWORK_PROJECTS.filter((p) => p.status === 'live');
    expect(live.map((p) => p.slug)).toEqual(['ambers-alchemy-apothecary']);
    expect(live[0].href).toBe('/');
    for (const p of NETWORK_PROJECTS) {
      if (p.slug !== 'ambers-alchemy-apothecary') {
        expect(p.status).not.toBe('live');
        expect(p.href).toBeUndefined();
      }
    }
  });

  it('Awaken Mobile is the one project in formation', () => {
    const forming = NETWORK_PROJECTS.filter((p) => p.status === 'in-formation');
    expect(forming.map((p) => p.slug)).toEqual(['awaken-mobile']);
  });
});

describe('partnership content (lib/content/partnerships.ts)', () => {
  it('carries exactly the six contribution ways from the brief', () => {
    expect(CONTRIBUTION_TYPES.map((t) => t.id)).toEqual([
      'idea',
      'skills',
      'supply',
      'invest',
      'community-land',
      'other',
    ]);
    for (const t of CONTRIBUTION_TYPES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.blurb.length).toBeGreaterThan(20);
    }
  });
});

describe('reachability — nav, registry, footer, homepage', () => {
  it('nav links both new routes', () => {
    const hrefs = navHrefs();
    expect(hrefs).toContain('/network');
    expect(hrefs).toContain('/partner');
    const top = NAV_ENTRIES.filter((e) => e.kind === 'link').map((e) =>
      e.kind === 'link' ? e.href : '',
    );
    expect(top).toContain('/network');
  });

  it('both routes are registered for the sitemap', () => {
    const paths = CANONICAL_ROUTES.map((r) => r.path);
    expect(paths).toContain('/network');
    expect(paths).toContain('/partner');
  });

  it('footer links both, and the homepage renders the invite section', () => {
    const footer = read('components/layout/Footer.tsx');
    expect(footer).toContain("href: '/network'");
    expect(footer).toContain("href: '/partner'");
    const home = read('app/page.tsx');
    expect(home).toContain('<NetworkInvite />');
    const invite = read('components/home/NetworkInvite.tsx');
    expect(invite).toContain('href="/network"');
    expect(invite).toContain('href="/partner"');
  });

  it('pages mount their forms and cross-link each other', () => {
    const network = read('app/network/page.tsx');
    expect(network).toContain('<AffiliateInterestForm />');
    expect(network).toContain('href="/partner"');
    const partner = read('app/partner/page.tsx');
    expect(partner).toContain('<PartnerIdeaForm />');
    expect(partner).toContain('href="/network"');
  });
});

describe('exclusion guard — the barred project appears nowhere', () => {
  function* walk(dir: string): Generator<string> {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name);
      if (name.isDirectory()) yield* walk(p);
      else if (/\.tsx?$/.test(name.name) && !/\.test\.tsx?$/.test(name.name)) {
        yield p;
      }
    }
  }

  it('no app/component/lib source mentions the barred name', () => {
    const pattern = new RegExp(BARRED, 'i');
    const offenders: string[] = [];
    for (const dir of ['app', 'components', 'lib']) {
      for (const file of walk(join(root, dir))) {
        if (pattern.test(readFileSync(file, 'utf8'))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('honesty guard — no affiliate money terms on the new surfaces', () => {
  const SURFACES = [
    'lib/content/network.ts',
    'lib/content/partnerships.ts',
    'app/network/page.tsx',
    'app/partner/page.tsx',
    'components/network/ProjectCard.tsx',
    'components/network/AffiliateInterestForm.tsx',
    'components/partner/PartnerIdeaForm.tsx',
    'components/home/NetworkInvite.tsx',
    'app/api/affiliate-interest/route.ts',
    'app/api/partner-idea/route.ts',
  ];
  const FORBIDDEN = [
    /\bcommission/i,
    /\bpayout/i,
    /\bpay\s?out\b/i,
    /\d+(\.\d+)?\s*%/,
    /\$\s?\d/,
    /\bguarantee/i,
    /\bearn(ing)?\s+\$/i,
  ];

  it('no surface states or implies rates, percentages, amounts, or guarantees', () => {
    for (const rel of SURFACES) {
      const src = read(rel);
      for (const pattern of FORBIDDEN) {
        expect(src, `${rel} matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});

describe('lead storage — new kinds (JSONL driver)', () => {
  beforeEach(() => {
    process.env.LEAD_STORE_DIR = mkdtempSync(join(tmpdir(), 'leads-net-'));
  });
  afterEach(() => {
    delete process.env.LEAD_STORE_DIR;
  });

  it('affiliate_interest appends to its own per-kind file, verbatim', async () => {
    const store = new JsonlLeadStore();
    const record = await store.append({
      kind: 'affiliate_interest',
      email: 'ally@example.com',
      name: 'Ally',
      consent: true,
      consentAt: '2026-10-15T00:00:00.000Z',
      metadata: { projects: 'awaken-network', project_count: 1 },
    });
    expect(record.id).toBeTruthy();
    expect(record.source).toBe('nextjs');
    const lines = readFileSync(
      join(process.env.LEAD_STORE_DIR!, 'affiliate_interest.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      kind: 'affiliate_interest',
      email: 'ally@example.com',
      metadata: { projects: 'awaken-network' },
    });
  });

  it('partner_idea appends to its own per-kind file, verbatim', async () => {
    const store = new JsonlLeadStore();
    await store.append({
      kind: 'partner_idea',
      email: 'ally@example.com',
      name: 'Ally',
      consent: true,
      consentAt: '2026-10-15T00:00:00.000Z',
      metadata: { contribution_type: 'idea', idea: 'A seed library.' },
    });
    const lines = readFileSync(
      join(process.env.LEAD_STORE_DIR!, 'partner_idea.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      kind: 'partner_idea',
      metadata: { contribution_type: 'idea' },
    });
  });
});
