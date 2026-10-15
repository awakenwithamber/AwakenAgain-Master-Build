/**
 * Homepage section personalization wrapper (owner spec 2026-10-14).
 *
 * The server renders the sections in DEFAULT order — byte-identical for
 * every visitor. After mount, IF the visitor accepted analytics consent
 * and has a clear top interest, the reorderable content sections are
 * rearranged by the unit-tested rules in
 * lib/personalization/home-personalization.ts (matching section first,
 * the rest keep their relative order). The hero and welcome video are
 * NOT part of this wrapper, so they can never shift.
 *
 * The Grimoire promotion is outside the reorderable set: it is never
 * demoted. A grimoire top interest only adds a gold emphasis treatment
 * to it (the .aa-grimoire-emphasis rule in app/globals.css).
 */
'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import {
  CONSENT_CHANGED_EVENT,
  topInterestNow,
} from '../../lib/personalization/client';
import {
  DEFAULT_HOME_ORDER,
  emphasizeGrimoire,
  orderHomeSections,
  type HomeSectionKey,
} from '../../lib/personalization/home-personalization';

const GRIMOIRE_SECTION_SELECTOR = '[aria-labelledby="grimoire-promo-heading"]';
const EMPHASIS_CLASS = 'aa-grimoire-emphasis';

export function PersonalizedSections({
  sections,
  pickedForYou,
  grimoirePromo,
  afterSections,
}: {
  sections: Record<HomeSectionKey, ReactNode>;
  pickedForYou: ReactNode;
  grimoirePromo: ReactNode;
  afterSections: ReactNode;
}) {
  const [order, setOrder] = useState<readonly HomeSectionKey[]>(DEFAULT_HOME_ORDER);

  useEffect(() => {
    const apply = () => {
      const top = topInterestNow();
      setOrder(orderHomeSections(top));
      const promo = document.querySelector(GRIMOIRE_SECTION_SELECTOR);
      if (promo) {
        promo.classList.toggle(EMPHASIS_CLASS, emphasizeGrimoire(top));
      }
    };
    apply();
    window.addEventListener(CONSENT_CHANGED_EVENT, apply);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, apply);
      document
        .querySelector(GRIMOIRE_SECTION_SELECTOR)
        ?.classList.remove(EMPHASIS_CLASS);
    };
  }, []);

  return (
    <>
      {pickedForYou}
      {order.map((key) => (
        <Fragment key={key}>{sections[key]}</Fragment>
      ))}
      {grimoirePromo}
      {afterSections}
    </>
  );
}
