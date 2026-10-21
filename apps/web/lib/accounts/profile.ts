/**
 * Profile read model + data export — Phase 3 Step 3.
 *
 * Composes what the /account page and the export download show from the
 * authoritative stores, without copying or mutating any of them:
 *
 * - Account state (lib/accounts/accounts.ts fold): name, likes,
 *   searches, saved quiz results, progress.
 * - LINKED quiz leads: quiz_lead records captured for the same email
 *   (lib/leads) are shown as saved results too — linked at read time,
 *   so a result saved before accounts existed appears in the profile
 *   the moment its owner signs in. A lead captured in the same sitting
 *   as a profile save (same concern + form within 10 minutes) is shown
 *   once, as the profile save.
 * - Order history: the orders store, filtered to the account email,
 *   display only. Payment state composes exactly like the public
 *   order-status route — through the ONE shared resolver
 *   (lib/orders/paid-state.ts), which checks BOTH the manual
 *   owner-confirmed ledger and the Stripe webhook ledger for every
 *   order (Stage 1, audit G-5: this module previously joined only
 *   the manual ledger, so Stripe-paid orders showed unpaid here).
 *
 * Export (GET /api/account/export) returns EVERYTHING stored for the
 * account: the folded profile, every lead record for the email, and
 * every order record for the email — the complete file, not a summary.
 * After deletion (tombstone), the export collapses to the tombstone
 * state only; a deleted account cannot sign in to ask for one anyway.
 *
 * SERVER-ONLY.
 */
import {
  loadAccountAsync,
  normalizeAccountEmail,
  type AccountProgress,
  type AccountState,
  type SavedQuizResult,
  type SavedSearch,
} from './accounts';
import { readLeadsForEmailAsync, type LeadRecord } from '../leads/lead-store';
import { defaultOrderStore } from '../stores/order-store';
import {
  resolveOrderPaidState,
  type OrderStatus,
} from '../orders/paid-state';
import { getProductByHandle } from '../catalog/products';
import type { OrderRecord } from '../checkout/order';
import { findLatestSubscriptionRecordAsync } from '../subscriptions/entitlement';
import {
  describeSubscriptionState,
  type SubscriptionStateView,
} from '../subscriptions/subscriptions';

/** Member-facing subscription state for /account (Stage 3). */
export type ProfileSubscriptionView = SubscriptionStateView & {
  /** The member's raw latest-record status, for copy branching. */
  status: SubscriptionStateView['record_status'];
};

export async function getSubscriptionViewAsync(
  emailInput: unknown,
  now: Date = new Date(),
): Promise<ProfileSubscriptionView | null> {
  const email = normalizeAccountEmail(emailInput);
  if (!email) return null;
  try {
    const record = await findLatestSubscriptionRecordAsync(email);
    if (!record) return null;
    const view = describeSubscriptionState(record, now);
    return { ...view, status: view.record_status };
  } catch {
    return null; // fail closed: no subscription surface on unreadable data
  }
}

export interface ProfileOrderSummary {
  order_id: string;
  created_at: string;
  item_count: number;
  total_cents: number;
  status: OrderStatus;
  payment_method: OrderRecord['payment_method'];
}

export interface ProfileView {
  email: string;
  display_name: string | null;
  created_at: string | null;
  likes: { handle: string; title: string }[];
  searches: SavedSearch[];
  quiz_results: SavedQuizResult[];
  progress: AccountProgress | null;
  orders: ProfileOrderSummary[];
  /** Living Grimoire subscription state, or null when none is held. */
  subscription: ProfileSubscriptionView | null;
}

/** Same-sitting window for the lead/profile-save dedupe (see header). */
const LEAD_DEDUPE_WINDOW_MS = 10 * 60_000;

function leadToSavedResult(lead: LeadRecord): SavedQuizResult | null {
  if (lead.kind !== 'quiz_lead' || !lead.quizResult) return null;
  return { result: lead.quizResult, saved_at: lead.capturedAt, via: 'lead' };
}

function isDuplicateOfSaved(
  leadResult: SavedQuizResult,
  saved: readonly SavedQuizResult[],
): boolean {
  const leadTime = Date.parse(leadResult.saved_at);
  if (Number.isNaN(leadTime)) return false;
  return saved.some((s) => {
    if (
      s.result.concernId !== leadResult.result.concernId ||
      s.result.formId !== leadResult.result.formId
    ) {
      return false;
    }
    const savedTime = Date.parse(s.saved_at);
    return (
      !Number.isNaN(savedTime) &&
      Math.abs(savedTime - leadTime) <= LEAD_DEDUPE_WINDOW_MS
    );
  });
}

/** Profile-saved results + linked lead results, oldest first, deduped. */
export function composeQuizResults(
  state: AccountState,
  leads: readonly LeadRecord[],
): SavedQuizResult[] {
  const composed = [...state.quiz_results];
  for (const lead of leads) {
    const linked = leadToSavedResult(lead);
    if (!linked) continue;
    if (isDuplicateOfSaved(linked, state.quiz_results)) continue;
    composed.push(linked);
  }
  composed.sort((a, b) => (a.saved_at < b.saved_at ? -1 : 1));
  return composed;
}

/** Orders for one email from the orders store — newest first, display only. */
export async function listOrdersForEmailAsync(
  emailInput: unknown,
): Promise<ProfileOrderSummary[]> {
  const email = normalizeAccountEmail(emailInput);
  if (!email) return [];
  const orders = await defaultOrderStore().listOrders({ limit: 1000 });
  const mine = orders.filter(
    (order) => normalizeAccountEmail(order.customer?.email) === email,
  );
  const summaries: ProfileOrderSummary[] = [];
  for (const order of mine) {
    const paidState = await resolveOrderPaidState(order);
    summaries.push({
      order_id: order.order_id,
      created_at: order.created_at,
      item_count: order.items.reduce((sum, item) => sum + item.quantity, 0),
      total_cents: order.total_cents,
      status: paidState.status,
      payment_method: order.payment_method,
    });
  }
  return summaries;
}

/** The full profile view for a signed-in account (null when deleted/absent). */
export async function getProfileViewAsync(
  emailInput: unknown,
): Promise<ProfileView | null> {
  const email = normalizeAccountEmail(emailInput);
  if (!email) return null;
  const state = await loadAccountAsync(email);
  if (!state.exists || state.deleted) return null;
  const leads = await readLeadsForEmailAsync(email);
  const orders = await listOrdersForEmailAsync(email);
  const subscription = await getSubscriptionViewAsync(email);
  return {
    email,
    display_name: state.display_name,
    created_at: state.created_at,
    likes: state.likes.map((handle) => ({
      handle,
      title: getProductByHandle(handle)?.title ?? handle,
    })),
    searches: state.searches,
    quiz_results: composeQuizResults(state, leads),
    progress: state.progress,
    orders,
    subscription,
  };
}

/* ------------------------------------------------------------------ */
/* Data export                                                         */
/* ------------------------------------------------------------------ */

export interface AccountExport {
  exported_at: string;
  email: string;
  deleted: boolean;
  account: {
    display_name: string | null;
    created_at: string | null;
    likes: string[];
    searches: SavedSearch[];
    quiz_results: SavedQuizResult[];
    progress: AccountProgress | null;
  } | null;
  leads: LeadRecord[];
  orders: OrderRecord[];
}

/**
 * EVERYTHING stored for the account, assembled from the authoritative
 * stores. Deleted accounts export the tombstone only.
 */
export async function buildAccountExportAsync(
  emailInput: unknown,
): Promise<AccountExport | null> {
  const email = normalizeAccountEmail(emailInput);
  if (!email) return null;
  const state = await loadAccountAsync(email);
  if (!state.exists) return null;
  const exported_at = new Date().toISOString();
  if (state.deleted) {
    return {
      exported_at,
      email,
      deleted: true,
      account: null,
      leads: [],
      orders: [],
    };
  }
  const leads = await readLeadsForEmailAsync(email);
  const allOrders = await defaultOrderStore().listOrders({ limit: 1000 });
  const orders = allOrders.filter(
    (order) => normalizeAccountEmail(order.customer?.email) === email,
  );
  return {
    exported_at,
    email,
    deleted: false,
    account: {
      display_name: state.display_name,
      created_at: state.created_at,
      likes: [...state.likes],
      searches: state.searches,
      quiz_results: composeQuizResults(state, leads),
      progress: state.progress,
    },
    leads,
    orders,
  };
}
