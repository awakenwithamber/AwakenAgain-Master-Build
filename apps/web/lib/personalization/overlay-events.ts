/**
 * Cross-component overlay events (client-only contract constants).
 *
 * The contact popup, the Gaia chat, and the Gaia nudge card are separate
 * client islands mounted in app/layout.tsx; they coordinate through
 * these window CustomEvents instead of shared React state:
 *
 * - 'aa:open-contact'    — anyone may ask the contact popup to open.
 * - 'aa:contact-open'    — the contact popup announces it is open.
 * - 'aa:contact-closed'  — the contact popup announces it closed.
 * - 'aa:gaia-chat-open'  — GaiaWidget announces its chat panel opened.
 * - 'aa:gaia-chat-closed'— GaiaWidget announces its chat panel closed.
 *
 * Pattern follows the existing 'aa:open-botanical-card' contract
 * (components/herbs/BotanicalCardHost.tsx).
 */
export const OPEN_CONTACT_EVENT = 'aa:open-contact';
export const CONTACT_OPEN_EVENT = 'aa:contact-open';
export const CONTACT_CLOSED_EVENT = 'aa:contact-closed';
export const GAIA_CHAT_OPEN_EVENT = 'aa:gaia-chat-open';
export const GAIA_CHAT_CLOSED_EVENT = 'aa:gaia-chat-closed';
