import { bundleSavingsCents, bundleSavingsPct, formatPrice } from '../../lib/pricing/pricing';

/**
 * Savings display. Values are COMPUTED from the canonical shape table at
 * render time — if component prices change, this updates automatically.
 */
export function SavingsDisplay({ componentSumCents }: { componentSumCents: number }) {
  const savings = bundleSavingsCents();
  const pct = bundleSavingsPct();
  return (
    <p>
      Priced separately: {formatPrice(componentSumCents)} · Collection:{' '}
      {formatPrice(componentSumCents - savings)} — you save {formatPrice(savings)} ({pct}%).
    </p>
  );
}
