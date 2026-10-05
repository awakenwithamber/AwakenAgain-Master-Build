import { formatPrice } from '../../lib/pricing/pricing';

/** Server-first price display. Renders from canonical cents — never hard-coded copy. */
export function PriceDisplay({ cents, className }: { cents: number; className?: string }) {
  return <span className={className}>{formatPrice(cents)}</span>;
}
