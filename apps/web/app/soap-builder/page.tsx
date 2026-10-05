/**
 * /soap-builder — async SERVER component (page shell).
 *
 * Renders the <SoapBuilder/> client island. All catalog/pricing truth is
 * read from the canonical lib modules; the client island only previews.
 * `?bundle=1` opens Collection mode (the Alchemy Soap Collection's 5 slots).
 */
import type { Metadata } from 'next';
import { SoapBuilder } from '../../components/builder/SoapBuilder';

export const metadata: Metadata = {
  title: 'Create Your Own Alchemy Soap',
  description:
    "Design your own hand-poured botanical soap in a six-step ritual — base, shape, scent, botanical, color — at Amber's Alchemy Apothecary.",
};

export default async function SoapBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ bundle?: string }>;
}) {
  const params = await searchParams;
  const bundle = params.bundle === '1' || params.bundle === 'true';
  return (
    <main>
      <SoapBuilder mode={bundle ? 'bundle' : 'single'} />
    </main>
  );
}
