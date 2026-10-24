/**
 * Checkout page. Metadata here; interactivity in CheckoutForm (client).
 */
import type { Metadata } from 'next';
import { CheckoutForm } from '../../components/checkout/CheckoutForm';

export const metadata: Metadata = {
  title: 'Secure Checkout',
  description:
    "Secure checkout at Amber's Alchemy Apothecary — pay by emailed invoice (ACH bank transfer, Venmo, or Cash App), or with Cash App or Venmo directly.",
};

export default function CheckoutPage() {
  return <CheckoutForm />;
}
