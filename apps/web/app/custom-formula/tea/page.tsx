/**
 * /custom-formula/tea — G10 tea builder ("Create Your Own Tea Blend").
 * Async SERVER component (page shell); the FormulaBuilder client island
 * carries the interactive ritual. Same architecture as the G2 capsule
 * builder, tea-blend specific.
 */
import type { Metadata } from 'next';
import { FormulaBuilder } from '../../../components/builder/FormulaBuilder';

export const metadata: Metadata = {
  title: 'Create Your Own Tea Blend',
  description:
    "Design your own custom tea blend in a four-step ritual — format, botanicals, safety & intention — at Amber's Alchemy Apothecary. Exact botanicals persisted; totals recomputed server-side.",
};

export default async function CustomTeaPage() {
  return (
    <main>
      <FormulaBuilder kind="tea" />
    </main>
  );
}
