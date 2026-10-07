/**
 * /grimoire — the Living Grimoire book experience (WORKSTREAM D).
 *
 * Renders the leather-bound interactive book. The subscription flow at
 * /grimoire/subscribe is untouched.
 */
import type { Metadata } from 'next';
import { GrimoireBook } from '../../components/grimoire/GrimoireBook';

export const metadata: Metadata = {
  title: 'The Living Grimoire of Herbs',
  description:
    "Open the Living Grimoire — a handmade-style book of herbal wisdom, traditional uses, and botanical illustrations from Amber's Alchemy Apothecary.",
};

export default function GrimoirePage() {
  return (
    <main id="main-content">
      <GrimoireBook />
    </main>
  );
}
