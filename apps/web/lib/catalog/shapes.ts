/**
 * Canonical soap shape table — OWNER-CONFIRMED 2026-10-19.
 * This module is the price authority for the soap line. Prices in integer
 * cents. UI components consume this; they never hard-code soap prices.
 *
 * Canon per-shape prices are the 2026-10-05 directive prices
 * ($5.77/$8.77/$9.77/$11.77), CONFIRMED by the owner on 2026-10-19
 * ("the higher pricing wins"). A brief same-day change to lower
 * listing prices ($5.00/$7.00/$9.00) was reverted the same day.
 */
import type { SoapShape } from '../../types';

function subscriber(priceCents: number): number {
  // 10% Grimoire subscriber discount, rounded to the cent.
  return Math.round(priceCents * 0.9);
}

function shape(
  id: string,
  name: string,
  weightOz: number,
  priceCents: number,
): SoapShape {
  return { id, name, weightOz, priceCents, subscriberPriceCents: subscriber(priceCents) };
}

export const SOAP_SHAPES: readonly SoapShape[] = [
  shape('small-rose', 'Small Rose', 2, 577),
  shape('medium-rose', 'Medium Rose', 3, 877),
  shape('plain-rectangle', 'Large Plain Rectangle', 4, 977),
  shape('wave-rectangle', 'Large Wave Rectangle', 4.5, 1177),
  shape('floral-round', 'Large Floral Round', 4.5, 1177),
];

/** Proportion rule: Small Rose < Medium Rose < large designs. Enforced in UI. */
export const SHAPE_SIZE_ORDER: readonly string[] = [
  'small-rose',
  'medium-rose',
  'plain-rectangle',
  'wave-rectangle',
  'floral-round',
];

export function getShape(id: string): SoapShape | undefined {
  return SOAP_SHAPES.find((s) => s.id === id);
}
