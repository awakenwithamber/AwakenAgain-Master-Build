/**
 * /grimoire — the Living Grimoire book experience (WORKSTREAM D).
 *
 * Renders the leather-bound interactive book. The subscription flow at
 * /grimoire/subscribe is untouched.
 */
import type { Metadata } from 'next';
import { GrimoireBook } from '../../components/grimoire/GrimoireBook';

export const metadata: Metadata = {
  title: 'The Living Grimoire - Book of Light',
  description:
    "Open The Living Grimoire - Book of Light — Amber's family grimoire, a handmade-style book of true magic, healing, recipes, spells, herbal wisdom, and botanical illustrations from Amber's Alchemy Apothecary.",
};

export default function GrimoirePage() {
  return (
    <main id="main-content">
      <GrimoireBook />
    </main>
  );
}
