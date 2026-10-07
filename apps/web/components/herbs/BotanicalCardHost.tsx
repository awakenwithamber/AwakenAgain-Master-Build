'use client';

/**
 * Workstream E — global botanical index-card host.
 *
 * Listens for the shared contract event dispatched by <HerbChip/> (and any
 * other herb name/chip site-wide):
 *
 *   window.dispatchEvent(
 *     new CustomEvent('aa:open-botanical-card', { detail: { herb: '<slug>' } }),
 *   );
 *
 * Renders <BotanicalCard/> for the requested slug. Unknown slugs are ignored
 * silently (the host must never crash a page that dispatches a bad slug).
 *
 * COORDINATOR MOUNT SNIPPET — add to app/layout.tsx inside <body>:
 *
 *   import { BotanicalCardHost } from '../components/herbs/BotanicalCardHost';
 *   …
 *   <body>
 *     …
 *     <BotanicalCardHost />
 *   </body>
 *
 * This file also imports ./herbs.css so the .aa-herb-chip pill styles and
 * modal styles load site-wide wherever the host is mounted.
 */
import { useCallback, useEffect, useState } from 'react';
import './herbs.css';
import { getHerbRecord } from '../../lib/herbs/herb-data';
import { BotanicalCard } from './BotanicalCard';

export const OPEN_BOTANICAL_CARD_EVENT = 'aa:open-botanical-card';

export function BotanicalCardHost() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { herb?: string } | undefined;
      const slug = detail?.herb;
      if (typeof slug !== 'string' || slug.length === 0) return;
      const record = getHerbRecord(slug);
      if (!record) return; // unknown slug — ignore, never crash the page
      setOpenSlug(record.slug);
    };
    window.addEventListener(OPEN_BOTANICAL_CARD_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_BOTANICAL_CARD_EVENT, onOpen);
  }, []);

  const close = useCallback(() => setOpenSlug(null), []);

  if (!openSlug) return null;
  const herb = getHerbRecord(openSlug);
  if (!herb) return null;

  return <BotanicalCard herb={herb} onClose={close} />;
}
