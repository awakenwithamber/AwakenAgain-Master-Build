/**
 * Checkout page. Metadata here; interactivity in CheckoutForm (client).
 */
import type { Metadata } from 'next';
import { CheckoutForm } from '../../components/checkout/CheckoutForm';

export const metadata: Metadata = {
  title: 'Checkout',
  description:
    "Check out at Amber's Alchemy Apothecary — payment by Cash App or Venmo.",
};

export default function CheckoutPage() {
  return <CheckoutForm />;
}
