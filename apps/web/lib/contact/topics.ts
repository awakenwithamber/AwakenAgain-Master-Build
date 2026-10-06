/**
 * Contact topics + honeypot field name (G5).
 *
 * CLIENT-SAFE: this module has zero Node-only imports, so the contact
 * form client component can import the topic list and honeypot field name
 * without dragging server-side store code into the browser bundle.
 * The server-side validation module (lib/contact/contact.ts) re-exports
 * everything here as its single source of truth.
 */

/** Topics the contact form offers — server-side whitelist, single source. */
export const CONTACT_TOPICS = [
  { id: 'order-question', label: 'A question about my order' },
  { id: 'custom-product', label: 'Custom soap / product question' },
  { id: 'grimoire', label: 'Living Grimoire membership' },
  { id: 'wholesale', label: 'Wholesale / collaboration' },
  { id: 'something-else', label: 'Something else' },
] as const;

export type ContactTopicId = (typeof CONTACT_TOPICS)[number]['id'];

export function contactTopicLabel(topicId: string): string | null {
  return CONTACT_TOPICS.find((t) => t.id === topicId)?.label ?? null;
}

/** Honeypot field name — bots fill it, humans never see it. */
export const CONTACT_HONEYPOT_FIELD = 'website' as const;
