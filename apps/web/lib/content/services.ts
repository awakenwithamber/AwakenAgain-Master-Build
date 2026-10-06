/**
 * Services data (G7 — /services).
 *
 * Built from the generated catalog (canonical product/service records),
 * so titles and prices never drift from the shop. Each service carries an
 * explicit booking-status marker:
 *
 * - 'confirmed' — booking flow + delivery + turnaround are published.
 * - 'to_be_confirmed' — source does not publish booking mechanics;
 *   rendered with an honest NEEDS_VERIFICATION marker, never invented.
 *
 * IMPORTANT: booking details (how the service is scheduled, delivered, and
 * turned around) are NEEDS_VERIFICATION for all services below — the owner
 * must confirm before checkout flows advertise them.
 */
import { PRODUCTS } from '../catalog/products';

export type BookingStatus = 'confirmed' | 'to_be_confirmed';

export interface ServiceEntry {
  handle: string;
  title: string;
  category: string;
  price: number | null;
  shortDescription: string | null;
  bookingStatus: BookingStatus;
  bookingNote: string;
}

const BOOKING_NEEDS_VERIFICATION: BookingStatus = 'to_be_confirmed';
const BOOKING_NOTE =
  'NEEDS VERIFICATION — booking flow, delivery format, and turnaround are not yet published. Owner confirmation required before this service advertises them.';

const SERVICE_HANDLES = [
  'custom-remedy-consultation',
  'personalized-herbal-protocols',
  'personalized-botanical-consultation',
  'tarot-readings',
  'tarot-rune-reading',
  'rune-readings',
  'energy-work',
  'hypnotherapy-guided-relaxation',
  'past-life-inspired-guided-exploration',
  'home-aura-space-cleansing',
  'seasonal-gut-reset',
  'grimoire-subscription',
];

export const SERVICES: ServiceEntry[] = SERVICE_HANDLES.map((handle) => {
  const p = PRODUCTS.find((x) => x.handle === handle);
  return {
    handle,
    title: p?.title ?? handle,
    category: p?.category ?? 'Services',
    price: typeof p?.price === 'number' ? p.price : null,
    shortDescription: (p?.short_description as string | null) ?? null,
    bookingStatus: BOOKING_NEEDS_VERIFICATION,
    bookingNote: BOOKING_NOTE,
  };
});
