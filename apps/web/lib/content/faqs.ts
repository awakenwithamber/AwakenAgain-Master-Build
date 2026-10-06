/**
 * FAQs (G7 — /faqs).
 *
 * Answers are grounded in owner-verified facts (pricing canon, contact
 * identity, shipping policy, payment policy). Where a detail is not yet
 * published, the answer says so honestly with a NEEDS_VERIFICATION marker
 * instead of inventing one. No cure/treatment claims.
 *
 * Dynamic values (bundle savings) are computed from the canonical pricing
 * table — never hard-coded — except the owner-set $35.77 bundle price
 * itself, which lives in lib/pricing/pricing.ts.
 */
import {
  BUNDLE_PRICE_CENTS,
  bundleSavingsCents,
  formatPrice,
} from '../pricing/pricing';
import {
  BRAND_EMAIL,
  BRAND_NAME,
  BRAND_PHONE_DISPLAY,
  BRAND_PHONE_TEL,
} from '../seo/config';

export interface Faq {
  question: string;
  answer: string[];
  source: 'owner-verified' | 'needs-verification';
}

export const FAQS: Faq[] = [
  {
    question: 'How do I pay for my order?',
    answer: [
      'We accept Cash App ($AmberPatten347) and Venmo (@AwakenwithAmber) only. At checkout you will see the exact payment instructions, send your payment, and we confirm your order once it arrives.',
      'We never ask for card details on this site.',
    ],
    source: 'owner-verified',
  },
  {
    question: 'What are the shipping terms?',
    answer: [
      'Shipping is free on orders over $100, and free on orders over $75 for Living Grimoire subscribers. Orders are handcrafted and typically ship within 3–5 business days where operationally accurate.',
    ],
    source: 'owner-verified',
  },
  {
    question: 'What is in the Alchemy Soap Collection, and what do I save?',
    answer: [
      `The Alchemy Soap Collection includes one of each of our 5 soap styles — Small Rose (2oz), Medium Rose (3oz), Large Plain Rectangle (4oz), Large Wave Rectangle (4.5oz), and Large Floral Round (4.5oz) — each individually customizable with your choice of scent, color, and botanical. It is ${formatPrice(BUNDLE_PRICE_CENTS)}, with ${formatPrice(bundleSavingsCents())} of genuine savings versus buying the five styles individually.`,
    ],
    source: 'owner-verified',
  },
  {
    question: 'How does the custom soap builder work?',
    answer: [
      'Create Your Own Alchemy Soap is a 6-step ritual: choose a base, shape, scent, botanical, and color, then reveal your creation and add it to your cart. Every customization you pick is recorded with your order.',
      'Our bases are a Signature Double Layer (translucent vegetable glycerin + castor oil over goat milk + shea butter), Goat Milk + Shea Butter, or Botanical Glycerin + Castor Oil. Scents use doTERRA essential oils — one signature recipe or a custom blend of 1–3 oils.',
    ],
    source: 'owner-verified',
  },
  {
    question: 'What is the Living Grimoire membership?',
    answer: [
      'The Living Grimoire is our membership at $7.77/month: 10% off storewide, monthly articles and rituals, exclusive recipes, early access to new releases, personalized recommendations, and subscriber gifts. Safety information is never paywalled.',
    ],
    source: 'owner-verified',
  },
  {
    question: 'Why do you say "Botanical Oil Infusion" instead of "tincture"?',
    answer: [
      'Our concentrated liquid botanical preparations are oil-based infusions, so we name them accurately: Botanical Oil Infusion (or Herbal Oil Infusion). "Tincture" properly describes an alcohol extraction, which ours are not.',
    ],
    source: 'owner-verified',
  },
  {
    question: 'Are these products medicine? Will they cure my condition?',
    answer: [
      'No. Our products are handcrafted botanical goods for personal ritual and enjoyment. They are not intended to diagnose, treat, cure, or prevent any disease, and nothing on this site should be read as medical advice.',
      'Always consult your healthcare provider before starting any herbal regimen — especially if you are pregnant, nursing, taking medication, or managing a health condition.',
    ],
    source: 'owner-verified',
  },
  {
    question: 'What is the Herbal Allies Quiz?',
    answer: [
      'Our quiz helps you discover the herbal allies that fit your current focus — sleep, energy, immunity, skin, digestion, and more — and the remedy form you prefer. You can optionally share your name and email to receive your results and a welcome note from the apothecary. We never sell or share your information.',
    ],
    source: 'owner-verified',
  },
  {
    question: 'How do I book a service or reading?',
    answer: [
      'Service booking details are still being confirmed. NEEDS VERIFICATION — the owner is finalizing booking flow, delivery format, and turnaround for readings, energy work, and consultations.',
      `In the meantime, reach us at ${BRAND_EMAIL} or ${BRAND_PHONE_DISPLAY} and we will arrange it personally.`,
    ],
    source: 'needs-verification',
  },
  {
    question: 'How can I contact you?',
    answer: [
      `${BRAND_NAME} — email ${BRAND_EMAIL}, or call ${BRAND_PHONE_DISPLAY}. We read every message.`,
    ],
    source: 'owner-verified',
  },
];

export const CONTACT_PHONE_TEL = BRAND_PHONE_TEL;
