/**
 * Form-guide data laws (2026-10-25):
 * - The five forms appear in Amber's FIXED order: tea, balm, tincture,
 *   serum, capsules.
 * - Every CTA link resolves to a real route (an app page file exists)
 *   or a real catalog product handle — no invented destinations.
 * - Tincture is educational only (quiz + contact): there is no tincture
 *   product/builder on this site, and its card carries the standing
 *   Botanical Oil Infusion line.
 */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  BUILDER_INTRO_LINES,
  FORM_GUIDE,
  TINCTURE_VS_SERUM,
} from './forms-guide';
import { getProductByHandle } from '../catalog/products';

const APP_DIR = join(__dirname, '..', '..', 'app');

function routeFileExists(href: string): boolean {
  const path = href === '/' ? '' : href.replace(/^\//, '');
  return (
    existsSync(join(APP_DIR, path, 'page.tsx')) ||
    existsSync(join(APP_DIR, path, 'page.ts'))
  );
}

describe('form guide order + content', () => {
  it('lists exactly five forms in the fixed order tea, balm, tincture, serum, capsules', () => {
    expect(FORM_GUIDE.map((f) => f.id)).toEqual([
      'tea',
      'balm',
      'tincture',
      'serum',
      'capsules',
    ]);
  });

  it('every form carries tagline, what-it-is, and Body/Mind/Soul lines', () => {
    for (const form of FORM_GUIDE) {
      expect(form.tagline.length).toBeGreaterThan(0);
      expect(form.whatItIs.length).toBeGreaterThan(0);
      expect(form.body.length).toBeGreaterThan(0);
      expect(form.mind.length).toBeGreaterThan(0);
      expect(form.soul.length).toBeGreaterThan(0);
      expect(form.actions.length).toBeGreaterThan(0);
    }
  });

  it('tea is first and capsules last (familiar → unfamiliar)', () => {
    expect(FORM_GUIDE[0].id).toBe('tea');
    expect(FORM_GUIDE[FORM_GUIDE.length - 1].id).toBe('capsules');
  });
});

describe('form guide CTA targets', () => {
  it('every link CTA resolves to a real route or a real product handle', () => {
    for (const form of FORM_GUIDE) {
      for (const action of form.actions) {
        if (action.type !== 'link') continue;
        if (action.href.startsWith('/shop/')) {
          const handle = action.href.slice('/shop/'.length);
          expect(
            getProductByHandle(handle),
            `${form.id} CTA ${action.href} should be a real product`,
          ).toBeDefined();
        } else {
          expect(
            routeFileExists(action.href),
            `${form.id} CTA ${action.href} should be a real route`,
          ).toBe(true);
        }
      }
    }
  });

  it('tea CTA opens the tea builder; capsules CTA opens the capsule builder route', () => {
    const tea = FORM_GUIDE.find((f) => f.id === 'tea')!;
    expect(tea.actions).toContainEqual({
      type: 'link',
      label: 'Build your tea',
      href: '/custom-formula/tea',
    });
    const capsules = FORM_GUIDE.find((f) => f.id === 'capsules')!;
    expect(capsules.actions).toContainEqual({
      type: 'link',
      label: 'Build your capsules',
      href: '/custom-formula/capsules',
    });
    expect(routeFileExists('/custom-formula/capsules')).toBe(true);
  });

  it('serum CTA points at the verified serum product', () => {
    const serum = FORM_GUIDE.find((f) => f.id === 'serum')!;
    const link = serum.actions.find((a) => a.type === 'link');
    expect(link).toMatchObject({ href: '/shop/root-scalp-revival-serum' });
    expect(getProductByHandle('root-scalp-revival-serum')).toBeDefined();
  });
});

describe('tincture handled educationally (site convention)', () => {
  it('carries the Botanical Oil Infusion standing line', () => {
    const tincture = FORM_GUIDE.find((f) => f.id === 'tincture')!;
    expect(tincture.note).toContain('Botanical Oil Infusion');
    expect(tincture.note).toContain('rather than an alcohol tincture');
  });

  it('offers no shop/product CTA — only the quiz and Message Amber', () => {
    const tincture = FORM_GUIDE.find((f) => f.id === 'tincture')!;
    for (const action of tincture.actions) {
      if (action.type === 'link') {
        expect(action.href).not.toContain('/shop');
        expect(action.href).toBe('/quiz');
      }
    }
    expect(tincture.actions.some((a) => a.type === 'contact')).toBe(true);
  });

  it('the explainer keeps its copy-pack heading and mouth-or-skin line', () => {
    expect(TINCTURE_VS_SERUM.heading).toBe(
      "Tincture or Serum? Here's the Simple Difference.",
    );
    expect(TINCTURE_VS_SERUM.body).toContain("'mouth or skin?'");
    expect(TINCTURE_VS_SERUM.body).toContain('never swallowed');
  });
});

describe('builder intro lines', () => {
  it('has a metaphor line for each builder kind', () => {
    expect(BUILDER_INTRO_LINES.tea).toContain('soup recipe');
    expect(BUILDER_INTRO_LINES.capsule).toContain('like a team');
  });
});
