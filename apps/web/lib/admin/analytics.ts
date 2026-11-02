/**
 * Admin analytics summary — REAL STATE ONLY (staged build, 2026-10-31).
 *
 * Composes the /admin/analytics view from records this app actually
 * holds (order ledger, subscription ledger, broadcast ledger, and the
 * PendingBinding store bindings) plus two honestly-labelled statuses:
 *
 * - Payment rail (current canon, owner decisions through 2026-10-30):
 *   Bluevine runs STRIPE-FREE — free invoicing with customers paying
 *   by standard ACH transfer or check (plus Venmo / Cash App handles
 *   on the invoice), manual mark-paid reconciliation. There is NO
 *   live card rail today. This module never claims card checkout
 *   is live.
 * - PostHog: WIRED in code, but receipt is KNOWN only when the
 *   project token is configured on this server. Without
 *   NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN the tracker is inert, so live
 *   events/funnels are UNKNOWN here and must be read in PostHog
 *   itself (linked, never fabricated or mirrored).
 *
 * Nothing here invents a metric: a store that is not bound reports
 * UNKNOWN, and no PII or payment data is read into, or emitted from,
 * this summary (counts and statuses only).
 */

export type KnownStatus = 'KNOWN' | 'UNKNOWN';

export interface AdminAnalyticsSummary {
  orders: { status: KnownStatus; count: number | null; parseIssues: number | null };
  subscriptions: { status: KnownStatus; memberCount: number | null };
  leads: { status: KnownStatus; detail: string };
  reviews: { status: KnownStatus; detail: string };
  submissions: { status: KnownStatus; detail: string };
  subscribersStore: { status: KnownStatus; detail: string };
  broadcasts: {
    status: KnownStatus;
    recordedCount: number | null;
    deliveryStatus: string;
  };
  paymentRail: {
    status: KnownStatus;
    live: string;
    cardRail: string;
  };
  posthog: {
    status: KnownStatus;
    configured: boolean;
    detail: string;
    dashboardUrl: string;
  };
}

/** PostHog project host used for the outbound dashboard link. */
export function posthogDashboardUrl(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.posthog.com';
}

/**
 * True only when a usable project token is present in this server's
 * environment. A placeholder value does not count — the client
 * tracker treats placeholders as unconfigured too.
 */
export function posthogConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const token = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  return Boolean(
    token && token !== 'POSTHOG_KEY_PLACEHOLDER' && !token.startsWith('REPLACE_'),
  );
}

/** The payment-rail statement, exactly as current canon states it. */
export const PAYMENT_RAIL_LIVE =
  'Bluevine invoicing (Stripe-free): free invoices paid by standard ACH transfer or check, plus Venmo / Cash App handles on the invoice; orders are marked paid manually after reconciliation.';
export const PAYMENT_RAIL_CARD = 'No live card rail — card checkout is not live.';

export interface AnalyticsInputs {
  ordersCount: number | null;
  orderParseIssues: number | null;
  subscriptionMemberCount: number | null;
  broadcastRecordedCount: number | null;
  leadsBindingDetail: string;
  reviewsBindingDetail: string;
  submissionsBindingDetail: string;
  subscribersBindingDetail: string;
  posthogConfigured: boolean;
}

/**
 * Pure summary builder — every input is either a real count read from
 * a store, or null (unreadable/unbound), which renders as UNKNOWN.
 */
export function buildAdminAnalyticsSummary(input: AnalyticsInputs): AdminAnalyticsSummary {
  const bound = (detail: string): { status: KnownStatus; detail: string } => ({
    // PendingBinding stores are by definition not bound: never KNOWN.
    status: 'UNKNOWN',
    detail,
  });
  return {
    orders:
      input.ordersCount === null
        ? { status: 'UNKNOWN', count: null, parseIssues: null }
        : {
            status: 'KNOWN',
            count: input.ordersCount,
            parseIssues: input.orderParseIssues,
          },
    subscriptions:
      input.subscriptionMemberCount === null
        ? { status: 'UNKNOWN', memberCount: null }
        : { status: 'KNOWN', memberCount: input.subscriptionMemberCount },
    leads: bound(input.leadsBindingDetail),
    reviews: bound(input.reviewsBindingDetail),
    submissions: bound(input.submissionsBindingDetail),
    subscribersStore: bound(input.subscribersBindingDetail),
    broadcasts:
      input.broadcastRecordedCount === null
        ? { status: 'UNKNOWN', recordedCount: null, deliveryStatus: 'recorded_not_sent' }
        : {
            status: 'KNOWN',
            recordedCount: input.broadcastRecordedCount,
            deliveryStatus: 'recorded_not_sent',
          },
    paymentRail: {
      status: 'KNOWN',
      live: PAYMENT_RAIL_LIVE,
      cardRail: PAYMENT_RAIL_CARD,
    },
    posthog: {
      status: input.posthogConfigured ? 'KNOWN' : 'UNKNOWN',
      configured: input.posthogConfigured,
      detail: input.posthogConfigured
        ? 'Project token is configured on this server; live events and funnels are read in PostHog, not mirrored here.'
        : 'UNKNOWN — no usable NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN on this server, so the wired tracker is inert and no live events can be confirmed from here.',
      dashboardUrl: posthogDashboardUrl(),
    },
  };
}
