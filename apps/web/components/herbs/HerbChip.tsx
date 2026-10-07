'use client';

/**
 * SHARED CONTRACT — HerbChip
 * Owner: workstream E (Herb system). Do not change the props interface
 * without coordinating with workstreams C and G.
 *
 * Renders a clickable herb chip (dark-purple/gold per the apothecary design
 * system) that opens the botanical index-card modal for the given herb.
 *
 * Props:
 * - herb: canonical herb slug, e.g. "lavender", "lemon-balm", "ashwagandha"
 * - label: optional display override (defaults to a humanized herb name)
 * - size: "sm" | "md" (default "sm")
 */
export interface HerbChipProps {
  herb: string;
  label?: string;
  size?: 'sm' | 'md';
}

function humanize(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function HerbChip({ herb, label, size = 'sm' }: HerbChipProps) {
  const display = label ?? humanize(herb);
  return (
    <button
      type="button"
      className={`aa-herb-chip aa-herb-chip--${size}`}
      data-herb={herb}
      onClick={() => {
        // Workstream E wires this to the botanical index-card modal.
        // Contract event: any listener on 'aa:open-botanical-card' receives
        // { herb } in event.detail.
        window.dispatchEvent(
          new CustomEvent('aa:open-botanical-card', { detail: { herb } }),
        );
      }}
      aria-label={`Learn about ${display}`}
    >
      {display}
    </button>
  );
}
