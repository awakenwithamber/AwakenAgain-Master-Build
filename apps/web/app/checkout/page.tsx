/**
 * Checkout page. Metadata here; interactivity in CheckoutForm (client).
 */
import type { Metadata } from 'next';
import { CheckoutForm } from '../../components/checkout/CheckoutForm';

export const metadata: Metadata = {
  title: 'Secure Checkout',
  description:
    "Secure checkout at Amber's Alchemy Apothecary — payment by Cash App or Venmo.",
};

export default function CheckoutPage() {
  return <CheckoutForm />;
}
