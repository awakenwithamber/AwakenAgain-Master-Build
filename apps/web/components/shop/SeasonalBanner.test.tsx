/**
 * Seasonal banner — the honesty line derives from the SERVED entry.
 *
 * Pin style: source-shape + data derivation, the pattern this repo
 * uses for JSX components (cf. tests/gaia-fab-size.test.ts). The
 * vitest transform cannot import a JSX component (tsconfig jsx:
 * preserve — the render-tested components here are the createElement
 * ones), so the derivation is pinned in two halves that compose:
 * (1) the component renders the served entry's copyRule and contains
 * no hard-coded month sentence; (2) each month's served entry carries
 * the rule named below. The rendered-output proof on the real serving
 * path is the production-build banner capture in the stage record
 * (~/workspace/november-pecan-pie-stage-2026-11-09/REPORT.md §9).
 *
 * Laws under test (owner decision 2026-11-09: "Ship Pecan Pie with
 * the banner line fixed too"):
 * - November's render shows the pecan/butter/brown-sugar rule and
 *   never the pumpkin line; October's render still shows the pumpkin
 *   rule; December's render shows December's own line.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getSeasonalFeature } from '../../lib/catalog/seasonal';

const here = dirname(fileURLToPath(import.meta.url));
const bannerSource = readFileSync(join(here, 'SeasonalBanner.tsx'), 'utf8');

describe('SeasonalBanner honesty line — derived from the served entry', () => {
  it("renders the served entry's own copyRule, with no hard-coded month sentence", () => {
    // The italic honesty line is exactly the served entry's data field.
    expect(bannerSource).toContain('<em>{feature.copyRule}</em>');
    // The pre-fix October sentence (hard-coded under every month) is gone.
    expect(bannerSource).not.toContain('pumpkin is not an ingredient in this soap');
    // No month-specific honesty text is baked into the component at all:
    // the only 'pumpkin' left is the history note in the header comment,
    // never inside the rendered JSX (nothing after the imports mentions it).
    const jsx = bannerSource.slice(bannerSource.indexOf('export function SeasonalBanner'));
    expect(jsx.toLowerCase()).not.toContain('pumpkin');
    expect(jsx).not.toContain('is not an ingredient');
  });

  it("November's served rule is the pecan rule (and names no pumpkin)", () => {
    const served = getSeasonalFeature(11, 2026)!;
    expect(served.id).toBe('pecan-pie-nov-2026');
    expect(served.copyRule).toBe(
      'Scent-theme naming only — NEVER state or imply pecan, butter, or brown sugar is an ingredient. None is in the formula.',
    );
    expect(served.copyRule.toLowerCase()).not.toContain('pumpkin');
  });

  it("October's served rule is the pumpkin rule; December's is its own line", () => {
    const october = getSeasonalFeature(10, 2026)!;
    expect(october.id).toBe('pumpkin-spice-oct-2026');
    expect(october.copyRule).toBe(
      'Scent-theme naming only — NEVER state or imply pumpkin is an ingredient. It is not in the formula.',
    );
    const december = getSeasonalFeature(12, 2026)!;
    expect(december.id).toBe('alpine-frost-dec-2026');
    expect(december.copyRule).toBe('Theme naming only.');
    expect(december.copyRule.toLowerCase()).not.toContain('pumpkin');
  });
});
