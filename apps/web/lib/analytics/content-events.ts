/**
 * Customer-content PostHog event taxonomy (G4, G6, G7, G15, G16).
 *
 * Lives in its own module — the coordinator merges it into
 * lib/analytics/events.ts; this file is NEVER merged by hand-editing
 * events.ts directly from this workstream.
 *
 * Conventions carried from the main taxonomy:
 * - snake_case names, past-tense verbs, one event per user action.
 * - Every payload carries implementation_source='nextjs' (stamped by the
 *   single choke point here; legacy static used 'legacy_static').
 * - NO PII, payment data, or secrets in any property. Names/emails/rating
 *   text never enter a payload — quiz_lead_captured carries concern+form
 *   ids only; review_submitted carries product_handle+rating only.
 * - Client/server ownership per the hard boundary: the browser observes
 *   interactions; the server records accepted business transitions
 *   (quiz_lead_captured, newsletter_subscribed are server-owned).
 * - PostHog is observational; lead/review stores are authoritative.
 * - Status vocabulary: WIRED (code exists) / BLOCKED (waiting on owner's
 *   phc_ key). Analytics is NEVER marked IMPLEMENTED here.
 */
import { ANALYTICS_SOURCE, SOURCE_PROPERTY } from './events';

export const CONTENT_ANALYTICS_EVENT_NAMES = {
  /** Client: customer opened the Herbal Allies Quiz. */
  quizStarted: 'quiz_started',
  /** Client: customer completed one quiz step. */
  quizStepCompleted: 'quiz_step_completed',
  /** Client: customer reached the results screen. */
  quizCompleted: 'quiz_completed',
  /** Server: quiz lead validated, consent confirmed, record stored. */
  quizLeadCaptured: 'quiz_lead_captured',
  /** Client: customer viewed the review list for a product. */
  reviewListViewed: 'review_list_viewed',
  /** Client: customer submitted a review (enters moderation as pending). */
  reviewSubmitted: 'review_submitted',
  /** Client: newsletter form rendered (placement attribution). */
  newsletterFormViewed: 'newsletter_form_viewed',
  /** Server: newsletter signup validated, consent confirmed, record stored. */
  newsletterSubscribed: 'newsletter_subscribed',
  /** Client: journal article page rendered. */
  articleViewed: 'article_viewed',
  /** Client: a catalog search executed (lengths, never the raw query). */
  searchPerformed: 'search_performed',
  /** Client: an education/content route rendered. */
  contentPageViewed: 'content_page_viewed',
} as const;

export type ContentAnalyticsEventName =
  (typeof CONTENT_ANALYTICS_EVENT_NAMES)[keyof typeof CONTENT_ANALYTICS_EVENT_NAMES];

export type ContentEventOwner = 'client' | 'server';

export const CONTENT_EVENT_OWNERSHIP = {
  quiz_started: 'client',
  quiz_step_completed: 'client',
  quiz_completed: 'client',
  quiz_lead_captured: 'server',
  review_list_viewed: 'client',
  review_submitted: 'client',
  newsletter_form_viewed: 'client',
  newsletter_subscribed: 'server',
  article_viewed: 'client',
  search_performed: 'client',
  content_page_viewed: 'client',
} as const satisfies Record<ContentAnalyticsEventName, ContentEventOwner>;

/** Property schema per event. Invalid payloads fail at compile time. */
export interface ContentAnalyticsEventProperties {
  quiz_started: Record<string, never>;
  quiz_step_completed: { step: number; step_name: string; concern_id?: string };
  quiz_completed: { concern_id: string; form_id: string };
  quiz_lead_captured: { concern_id: string; form_id: string };
  review_list_viewed: { product_handle: string; approved_review_count: number };
  review_submitted: { product_handle: string; rating: number };
  newsletter_form_viewed: { placement: string };
  newsletter_subscribed: { placement: string };
  article_viewed: { slug: string; section: string };
  search_performed: { query_length: number; result_count: number };
  content_page_viewed: { path: string };
}

/** Client events only — the browser can never attest an accepted lead/signup. */
export type ContentClientEventName = {
  [K in ContentAnalyticsEventName]: (typeof CONTENT_EVENT_OWNERSHIP)[K] extends 'client'
    ? K
    : never;
}[ContentAnalyticsEventName];

/** Server events only — for the server capturer. */
export type ContentServerEventName = {
  [K in ContentAnalyticsEventName]: (typeof CONTENT_EVENT_OWNERSHIP)[K] extends 'server'
    ? K
    : never;
}[ContentAnalyticsEventName];

/**
 * Single choke point for content event payloads: stamps the migration
 * source property on EVERY event, so no caller can forget it.
 */
export function buildContentEventPayload<E extends ContentAnalyticsEventName>(
  props: ContentAnalyticsEventProperties[E],
): ContentAnalyticsEventProperties[E] & { implementation_source: 'nextjs' } {
  return { ...props, [SOURCE_PROPERTY]: ANALYTICS_SOURCE };
}
