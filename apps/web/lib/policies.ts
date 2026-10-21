/**
 * Policy approval flags (Fix-All Stage 4, audit R-23).
 *
 * A policy page may publish real terms ONLY when the owner has
 * approved those terms. Each policy carries its own flag; a policy
 * whose flag is not approved renders the interim "contact us"
 * statement instead of invented terms.
 *
 * Returns: APPROVED by the owner 2026-10-21 (~09:02 MDT, §13(7)) —
 * unopened items returnable within 30 days of delivery; opened
 * consumables final sale EXCEPT damaged or wrong item sent (remedy
 * regardless of opened state); no restocking or return-shipping
 * charges were approved, so none are stated ("contact us to
 * arrange"). This flag covers the returns policy ONLY.
 */
export interface PolicyConfig {
  /** True only when the owner has approved this policy's real terms. */
  approved: boolean;
}

export const POLICIES = {
  returns: { approved: true },
} as const satisfies Record<string, PolicyConfig>;

export type PolicyId = keyof typeof POLICIES;

/** True when the named policy's owner-approved terms may be published. */
export function isPolicyApproved(id: PolicyId): boolean {
  return POLICIES[id].approved;
}
