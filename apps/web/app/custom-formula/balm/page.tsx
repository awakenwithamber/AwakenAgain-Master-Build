/**
 * /custom-formula/balm — Custom Balm Builder ("Create Your Own Botanical
 * Balm"), owner-approved 2026-10-30.
 *
 * Async SERVER component (page shell); the BalmBuilder client island
 * carries the interactive ritual. Same architecture as the capsule and
 * tea builders: five choices — balm base (Soy Wax standard / Beeswax
 * soy-free alternative, identical prices, allergens disclosed both
 * directions), botanicals grounded in the existing balm/serum records,
 * size, scent and purpose preferences — with totals recomputed
 * server-side at checkout.
 */
import type { Metadata } from 'next';
import { BalmBuilder } from '../../../components/builder/BalmBuilder';

export const metadata: Metadata = {
  title: 'Create Your Own Botanical Balm',
  description:
    "Design your own custom botanical balm — choose your finish (soy wax or beeswax, same price), your botanicals, your scent, and your ritual — at Amber's Alchemy Apothecary. Exact selections persisted; totals recomputed server-side.",
};

export default async function CustomBalmPage() {
  return (
    <main>
      <BalmBuilder />
    </main>
  );
}
