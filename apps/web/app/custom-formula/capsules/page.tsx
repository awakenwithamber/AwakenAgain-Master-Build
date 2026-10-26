/**
 * /custom-formula/capsules — G2 custom capsule builder ("Create Your Own").
 *
 * Moved here 2026-10-25: /custom-formula is now the "Choose your form"
 * consultation landing, and the capsule builder lives at this explicit
 * URL. Same FormulaBuilder client island, same catalog/pricing truth —
 * only the route changed.
 */
import type { Metadata } from 'next';
import { FormulaBuilder } from '../../../components/builder/FormulaBuilder';

export const metadata: Metadata = {
  title: 'Create Your Own Herbal Capsules',
  description:
    "Design your own custom capsule formula in a four-step ritual — size, botanicals, safety & intention — at Amber's Alchemy Apothecary. Exact botanicals persisted; totals recomputed server-side.",
};

export default async function CustomCapsuleFormulaPage() {
  return (
    <main>
      <FormulaBuilder kind="capsule" />
    </main>
  );
}
