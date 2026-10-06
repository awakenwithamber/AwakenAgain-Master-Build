/**
 * /custom-formula — G2 custom capsule builder ("Create Your Own").
 * Async SERVER component (page shell); the FormulaBuilder client island
 * carries the interactive ritual. All catalog/pricing truth is read from
 * the canonical lib modules; the client island only previews.
 */
import type { Metadata } from 'next';
import { FormulaBuilder } from '../../components/builder/FormulaBuilder';

export const metadata: Metadata = {
  title: 'Create Your Own Herbal Capsules',
  description:
    "Design your own custom capsule formula in a four-step ritual — size, botanicals, safety & intention — at Amber's Alchemy Apothecary. Exact botanicals persisted; totals recomputed server-side.",
};

export default async function CustomFormulaPage() {
  return (
    <main>
      <FormulaBuilder kind="capsule" />
    </main>
  );
}
