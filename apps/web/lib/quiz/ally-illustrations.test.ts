/**
 * Verified ally illustrations — the gate's pins (2026-11-08).
 *
 * The owner asked for botanical illustrations on quiz ally cards
 * where authentic assets exist. The 2026-11-08 inventory found the
 * site's illustration map (lib/herbs/illustrations.ts) is mostly
 * references to files that do not resolve: 276 of 316 entries point
 * at manuscdn/cloudfront hotlinks that 403'd for every sampled URL,
 * 8 point at local soap files absent from public/, and
 * public/images/herbs/ holds only a "coming soon" placeholder.
 * Only the 17 Wikimedia Commons entries the 2026-10-29 correction
 * pass species-verified (ILLUSTRATION_CREDITS) are authentic,
 * renderable assets. These tests pin that verification chain so a
 * dead hotlink, a wrong-species variant, a placeholder, or a
 * CSP-blocked origin can never reach an ally card:
 *
 * - every registered illustration is the map's verbatim Commons URL
 *   for its slug and carries the audit's credit record;
 * - CC BY / CC BY-SA entries expose the attribution line the license
 *   requires; public-domain / CC0 entries expose none;
 * - any local (same-origin) path ever registered must exist as a
 *   real file under public/ — a reference is not an asset;
 * - every registered origin is allowlisted in the built CSP img-src,
 *   so a wired image can actually render;
 * - coverage over the advisor's reachable herbs is EXACTLY the
 *   inventoried set (pattern allies: ginkgo; pool-only: andrographis,
 *   boswellia, white willow) — growth is welcome, but only by a new
 *   asset passing the same chain, which will fail this pin loudly
 *   until the inventory is updated with it;
 * - the results component renders an image only through the gate.
 */
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  VERIFIED_ILLUSTRATION_SLUGS,
  allyIllustrationFor,
} from './ally-illustrations';
import {
  BOTANICAL_ILLUSTRATIONS,
  ILLUSTRATION_CREDITS,
} from '../herbs/illustrations';
import {
  ADVISOR_HERB_ID_ALIASES,
  ADVISOR_HERB_RECOMMENDATIONS,
  ADVISOR_PATTERNS,
} from './advisor';
import { buildContentSecurityPolicy } from '../security/csp';

const PLACEHOLDER = 'botanical-coming-soon';

function catalogId(raw: string): string {
  return ADVISOR_HERB_ID_ALIASES[raw] ?? raw;
}

function reachableHerbs(): { patternAllies: Set<string>; pool: Set<string> } {
  const patternAllies = new Set<string>();
  for (const pattern of Object.values(ADVISOR_PATTERNS)) {
    for (const ally of pattern.allies) patternAllies.add(catalogId(ally.id));
  }
  const pool = new Set<string>();
  for (const ids of Object.values(ADVISOR_HERB_RECOMMENDATIONS)) {
    for (const raw of ids) pool.add(catalogId(raw));
  }
  return { patternAllies, pool };
}

describe('the verification chain', () => {
  it('registers only Commons-hosted, audit-credited map entries, verbatim', () => {
    expect(VERIFIED_ILLUSTRATION_SLUGS.length).toBeGreaterThan(0);
    for (const slug of VERIFIED_ILLUSTRATION_SLUGS) {
      const illustration = allyIllustrationFor(slug);
      expect(illustration, slug).toBeDefined();
      // Verbatim from the canonical map — never a rewritten URL.
      expect(illustration!.src).toBe(BOTANICAL_ILLUSTRATIONS[slug]);
      expect(illustration!.src).toMatch(
        /^https:\/\/(upload|thumb)\.wikimedia\.org\//,
      );
      // The correction audit's record is the species/license evidence.
      const credit = ILLUSTRATION_CREDITS[slug];
      expect(credit, slug).toBeDefined();
      expect(illustration!.license).toBe(credit.license);
      expect(illustration!.sourceUrl).toBe(credit.sourceUrl);
    }
  });

  it('never registers a dead hotlink, a placeholder, or a missing local file', () => {
    for (const slug of VERIFIED_ILLUSTRATION_SLUGS) {
      const { src } = allyIllustrationFor(slug)!;
      expect(src).not.toContain('manuscdn.com');
      expect(src).not.toContain('cloudfront.net');
      expect(src).not.toContain(PLACEHOLDER);
      if (src.startsWith('/')) {
        // A same-origin path counts only if the file is really there.
        expect(existsSync(join(process.cwd(), 'public', src)), src).toBe(true);
      }
    }
  });

  it('exposes the attribution line exactly when the license requires it', () => {
    for (const slug of VERIFIED_ILLUSTRATION_SLUGS) {
      const illustration = allyIllustrationFor(slug)!;
      if (illustration.license.startsWith('CC BY')) {
        expect(illustration.credit, slug).toBe(
          ILLUSTRATION_CREDITS[slug].attribution,
        );
      } else {
        expect(illustration.credit, slug).toBeUndefined();
      }
    }
    // The one wired pattern ally today: CC BY 3.0 — credit mandatory.
    expect(allyIllustrationFor('ginkgo')!.credit).toContain('CC BY 3.0');
    // Public-domain plate (pool-only herb) — no line required.
    expect(allyIllustrationFor('white-willow')!.credit).toBeUndefined();
  });

  it('every registered origin is allowlisted in the built CSP img-src', () => {
    const csp = buildContentSecurityPolicy('test-nonce');
    const imgSrc = csp.split('; ').find((d) => d.startsWith('img-src')) ?? '';
    for (const slug of VERIFIED_ILLUSTRATION_SLUGS) {
      const origin = new URL(allyIllustrationFor(slug)!.src).origin;
      expect(imgSrc, `${slug} → ${origin}`).toContain(origin);
    }
  });
});

describe('the resolver', () => {
  it('resolves the verified ginkgo illustration', () => {
    const illustration = allyIllustrationFor('ginkgo');
    expect(illustration).toBeDefined();
    expect(illustration!.src).toContain('Ginkgo_biloba');
    expect(illustration!.license).toBe('CC BY 3.0');
  });

  it('returns undefined for herbs whose only reference is a dead hotlink', () => {
    for (const id of [
      'lavender',
      'ashwagandha',
      'arnica',
      'chamomile',
      'vitex',
      'passionflower',
      'turmeric',
    ]) {
      expect(allyIllustrationFor(id), id).toBeUndefined();
    }
  });

  it('returns undefined for unknown ids and wrong-species variant slugs used as ids', () => {
    expect(allyIllustrationFor('not-a-herb')).toBeUndefined();
    // 'holy-basil-2' depicts lemon verbena, not holy basil; it is not
    // a catalog id and no reachable herb may resolve through it.
    const { patternAllies, pool } = reachableHerbs();
    for (const id of [...patternAllies, ...pool]) {
      const illustration = allyIllustrationFor(id);
      if (illustration) {
        expect(illustration.src).not.toBe(BOTANICAL_ILLUSTRATIONS['holy-basil-2']);
        expect(illustration.src).not.toBe(BOTANICAL_ILLUSTRATIONS['cats-claw-2']);
      }
    }
  });
});

describe('coverage over the advisor’s reachable herbs (2026-11-08 inventory)', () => {
  it('pattern allies: exactly ginkgo carries a verified illustration', () => {
    const { patternAllies } = reachableHerbs();
    const covered = [...patternAllies]
      .filter((id) => allyIllustrationFor(id))
      .sort();
    expect(covered).toEqual(['ginkgo']);
  });

  it('per-goal pools: exactly four herbs carry one (three are pool-only)', () => {
    const { pool } = reachableHerbs();
    const covered = [...pool].filter((id) => allyIllustrationFor(id)).sort();
    expect(covered).toEqual([
      'andrographis',
      'boswellia',
      'ginkgo',
      'white-willow',
    ]);
  });
});

describe('the results component seam', () => {
  const quizSource = readFileSync(
    new URL('../../components/quiz/Quiz.tsx', import.meta.url),
    'utf8',
  );

  it('renders an ally image only through the verified gate, alt = herb name', () => {
    expect(quizSource).toContain(
      "from '../../lib/quiz/ally-illustrations'",
    );
    expect(quizSource).toContain('allyIllustrationFor(ally.id)');
    expect(quizSource).toContain('{illustration && (');
    expect(quizSource).toContain('alt={ally.name}');
    expect(quizSource).toContain('quiz-ally-credit');
  });

  it('never references the placeholder or a dead host from the component', () => {
    expect(quizSource).not.toContain(PLACEHOLDER);
    expect(quizSource).not.toContain('manuscdn.com');
    expect(quizSource).not.toContain('cloudfront.net');
  });
});
