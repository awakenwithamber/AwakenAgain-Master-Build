/**
 * /grimoire — the Living Grimoire book experience (WORKSTREAM D).
 *
 * Renders the leather-bound interactive book. The subscription flow at
 * /grimoire/subscribe is untouched.
 */
import type { Metadata } from 'next';
import { GrimoireBook } from '../../components/grimoire/GrimoireBook';
import { InterestTracker } from '../../components/personalization/InterestTracker';

export const metadata: Metadata = {
  title: 'Living Grimoire of Light & Magic',
  description:
    "Open Living Grimoire of Light & Magic — Amber's family grimoire, a handmade-style book of true magic, healing, recipes, spells, herbal wisdom, and botanical illustrations from Amber's Alchemy Apothecary.",
};

export default function GrimoirePage() {
  return (
    <main id="main-content">
      <InterestTracker category="grimoire" signalKey="grimoire" />
      <GrimoireBook />
    </main>
  );
}
