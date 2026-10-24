/**
 * Herbal Index card — smoke render (repo pattern: renderToStaticMarkup,
 * React.createElement — this repo's vitest transform does not parse JSX
 * in test files).
 *
 * Asserts the owner's card design renders from the view-model only:
 * parchment card, "Properties:" list with verbatim record benefits,
 * verbatim note, honest incomplete flag, monogram slot instead of any
 * fake/dead image, and the caution slot rendering only when a record
 * carries caution data.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getHerbalCard, type HerbalCard } from '../../lib/herbal-index/cards';
import { getHerb } from '../../lib/catalog/herbs';
import { HerbalIndexCardView } from './HerbalIndexCard';

describe('HerbalIndexCardView', () => {
  const lavender = getHerbalCard('lavender')!;
  const html = renderToStaticMarkup(
    createElement(HerbalIndexCardView, { card: lavender }),
  );

  it('renders the parchment card with name, latin, and detail link', () => {
    expect(html).toContain('aa-herbal-card');
    expect(html).toContain('Lavender');
    expect(html).toContain('Lavandula angustifolia');
    expect(html).toContain('href="/herbal-library/lavender"');
  });

  it('renders "Properties:" with the record benefits verbatim', () => {
    expect(html).toContain('Properties:');
    for (const b of getHerb('lavender')!.traditionalBenefits) {
      expect(html).toContain(b);
    }
  });

  it('renders the record note verbatim', () => {
    expect(html).toContain(getHerb('lavender')!.traditionalNote);
  });

  it('flags the incomplete benefits honestly on a record still at 3 of 5', () => {
    const oregano = getHerbalCard('oregano')!;
    const out = renderToStaticMarkup(
      createElement(HerbalIndexCardView, { card: oregano }),
    );
    expect(out).toContain('3 of 5 properties recorded so far');
  });

  it('shows no incomplete flag on a Phase 1-completed record (lavender, 5 of 5)', () => {
    expect(html).not.toContain('properties recorded so far');
    expect(html).toContain('Traditionally used in baths to support functional circulation');
  });

  it('renders the monogram slot, not an image, for a dead-CDN reference', () => {
    expect(html).not.toContain('<img');
    expect(html).toContain('aa-herbal-monogram');
    expect(html).toContain('>L<');
    expect(html).toContain('Botanical illustration in preparation');
  });

  it('renders no caution block when the record carries no caution data', () => {
    expect(html).not.toContain('Caution:');
  });

  it('renders the caution slot and a real image when the model carries them', () => {
    const synthetic: HerbalCard = {
      ...lavender,
      caution: 'Test caution text from the record.',
      illustrationUrl: '/images/herbs/lavender.jpg',
      illustrationRenderable: true,
    };
    const out = renderToStaticMarkup(
      createElement(HerbalIndexCardView, { card: synthetic }),
    );
    expect(out).toContain('Caution:');
    expect(out).toContain('Test caution text from the record.');
    expect(out).toContain('<img');
    expect(out).toContain('src="/images/herbs/lavender.jpg"');
  });
});
