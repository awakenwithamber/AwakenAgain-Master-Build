'use client';

/**
 * Workstream E — "View botanical card" trigger for herbal-library pages.
 *
 * Dispatches the shared 'aa:open-botanical-card' contract event so the
 * global <BotanicalCardHost/> renders the index-card modal for the herb.
 */
import { HerbChip } from './HerbChip';
import { OPEN_BOTANICAL_CARD_EVENT } from './BotanicalCardHost';

export function ViewBotanicalCardButton({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  return (
    <button
      type="button"
      className="aa-explorer-button"
      style={{ marginTop: '0.5rem' }}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(OPEN_BOTANICAL_CARD_EVENT, { detail: { herb: slug } }),
        )
      }
      aria-label={`View the botanical index card for ${name}`}
    >
      🌿 View botanical card
    </button>
  );
}

/** Re-export so library pages can pair the button with a herb chip. */
export { HerbChip };
