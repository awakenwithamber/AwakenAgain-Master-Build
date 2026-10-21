/**
 * Herbal Index card (owner directive 2026-10-21) — public store surface,
 * fully separate from the Grimoire.
 *
 * Owner's standing card design (2026-10-19): parchment card, display-serif
 * (blackletter-style) herb name in the site's existing display face,
 * botanical illustration slot, "Properties:" folkloric list, and the
 * record's own 2–3 sentence note. Properties and note arrive VERBATIM
 * from the catalog record via the lib/herbal-index view-model — this
 * component writes no herbal content of its own.
 *
 * Server component: no client JS, no entitlement or gating imports.
 *
 * Written with React.createElement (no JSX): this repo's vitest
 * transform cannot parse JSX in .tsx imports (see MIGRATION_LEDGER and
 * components/seo/JsonLd.tsx). createElement keeps the component
 * unit-testable and behaves identically under Next.js.
 */
import { createElement } from 'react';
import Link from 'next/link';
import type { HerbalCard } from '../../lib/herbal-index/cards';

/**
 * The defined illustration slot (contract: lib/herbal-index
 * ILLUSTRATION_SLOT — 4:3, future local art at
 * public/images/herbs/<slug>.jpg, 800×600). Renders a real <img> only
 * when the card's reference is renderable today (local/verified);
 * otherwise the elegant monogram slot — never fake imagery, never a
 * known-dead hotlink.
 */
export function HerbalIllustrationSlot({
  card,
  large = false,
}: {
  card: HerbalCard;
  large?: boolean;
}) {
  const sizeClass = large ? ' aa-herbal-media--large' : '';
  if (card.illustrationRenderable && card.illustrationUrl) {
    return createElement(
      'div',
      { className: `aa-herbal-media${sizeClass}` },
      createElement('img', {
        src: card.illustrationUrl,
        alt: `Botanical illustration of ${card.name}`,
        width: 800,
        height: 600,
        loading: 'lazy',
      }),
    );
  }
  return createElement(
    'div',
    {
      className: `aa-herbal-media aa-herbal-media--monogram${sizeClass}`,
      role: 'img',
      'aria-label': `Botanical illustration of ${card.name} is in preparation`,
    },
    createElement(
      'span',
      { className: 'aa-herbal-monogram', 'aria-hidden': true },
      card.monogram,
    ),
    createElement(
      'span',
      { className: 'aa-herbal-art-note' },
      'Botanical illustration in preparation',
    ),
  );
}

export function HerbalIndexCardView({ card }: { card: HerbalCard }) {
  return createElement(
    'article',
    {
      className: 'aa-herbal-card',
      'data-kind': card.kind,
      'data-benefits-incomplete': card.benefitsIncomplete || undefined,
    },
    createElement(HerbalIllustrationSlot, { card }),
    createElement(
      'div',
      { className: 'aa-herbal-body' },
      createElement(
        'h3',
        { className: 'aa-herbal-name' },
        createElement(Link, { href: card.detailHref }, card.name),
      ),
      createElement(
        'p',
        { className: 'aa-herbal-latin' },
        createElement('em', null, card.latin),
      ),
      card.categoryLabels.length > 0
        ? createElement(
            'p',
            { className: 'aa-herbal-cats' },
            card.categoryLabels.join(' · '),
          )
        : null,
      createElement('h4', { className: 'aa-herbal-props-title' }, 'Properties:'),
      createElement(
        'p',
        { className: 'aa-herbal-framing' },
        'Traditional & folkloric uses, as recorded in the apothecary archive:',
      ),
      card.properties.length > 0
        ? createElement(
            'ul',
            { className: 'aa-herbal-props' },
            card.properties.map((p) => createElement('li', { key: p }, p)),
          )
        : createElement(
            'p',
            { className: 'aa-herbal-props-empty' },
            'No properties recorded yet.',
          ),
      card.benefitsIncomplete
        ? createElement(
            'p',
            { className: 'aa-herbal-incomplete' },
            `Archive entry in progress — ${card.benefitsListed} of 5 properties recorded so far.`,
          )
        : null,
      createElement('p', { className: 'aa-herbal-note' }, card.note),
      card.caution
        ? createElement(
            'p',
            { className: 'aa-herbal-caution' },
            createElement('strong', null, 'Caution:'),
            ' ',
            card.caution,
          )
        : null,
      createElement(
        Link,
        { href: card.detailHref, className: 'aa-herbal-detail-link' },
        'View the full library entry →',
      ),
    ),
  );
}
