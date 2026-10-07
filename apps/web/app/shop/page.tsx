/**
 * Shop index — "The Apothecary Shop" (workstream G).
 *
 * Server component: metadata + SiteHeader, with the interactive shop
 * (ritual bundles → Shop by Goal → filter pills → product grid) in the
 * ShopClient island. Brand: "Amber's Alchemy Apothecary" exact everywhere.
 */
import type { Metadata } from 'next';
import { SiteHeader } from '../../components/shop/SiteHeader';
import { ShopClient } from '../../components/shop/ShopClient';

export const metadata: Metadata = {
  title: 'Shop',
  description:
    "The Apothecary Shop — ritual bundles, handcrafted botanical soaps, capsules, balms, teas, and the Living Grimoire from Amber's Alchemy Apothecary.",
};

export default function ShopPage() {
  return (
    <>
      <SiteHeader />
      <ShopClient />
    </>
  );
}
