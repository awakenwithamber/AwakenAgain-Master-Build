/**
 * Cart page. 'use client' lives in CartView; this page keeps the metadata
 * export (pages with use client cannot export metadata).
 */
import type { Metadata } from 'next';
import { CartView } from '../../components/checkout/CartView';

export const metadata: Metadata = {
  title: 'Your Cart',
  description: "Review your cart at Amber's Alchemy Apothecary.",
};

export default function CartPage() {
  return <CartView />;
}
