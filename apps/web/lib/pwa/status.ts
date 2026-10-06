/**
 * Honest PWA capability status (G14).
 *
 * G14 lands installability metadata (app/manifest.ts, app/icon.tsx).
 * What is NOT claimed:
 * - No service worker is registered: adding one requires mounting a
 *   registration in the root layout, which is outside this workstream's
 *   scope (app/layout.tsx edits are coordinator-owned). The legacy sw.js
 *   (precache, never cache payment/sensitive requests, offline fallback)
 *   is classified IMPROVE — its privacy rules (never cache payment or
 *   sensitive requests) are recorded here as requirements for the future SW.
 * - No offline fallback page exists yet.
 *
 * This module is the single place any code or doc checks PWA capability —
 * consumers must read these flags instead of assuming offline support.
 */

export type PwaCapability = 'wired' | 'not_wired';

export interface PwaStatus {
  /** app/manifest.ts — brand-exact name, dark purple + gold. */
  manifest: PwaCapability;
  /** app/icon.tsx — generated brand mark (any + maskable). */
  icons: PwaCapability;
  /**
   * Service worker — NOT wired. Requirements when it lands (from legacy
   * sw.js, CONVERSION_MAP §12 row 109): precache app shell; NEVER cache
   * payment/sensitive requests; offline fallback page.
   */
  service_worker: PwaCapability;
  /** Offline fallback page — NOT wired (needs the SW + a registered route). */
  offline_fallback: PwaCapability;
}

export const PWA_STATUS: PwaStatus = {
  manifest: 'wired',
  icons: 'wired',
  service_worker: 'not_wired',
  offline_fallback: 'not_wired',
};

/** True only when every PWA capability is wired. Honest by construction. */
export function isPwaComplete(status: PwaStatus = PWA_STATUS): boolean {
  return (
    status.manifest === 'wired' &&
    status.icons === 'wired' &&
    status.service_worker === 'wired' &&
    status.offline_fallback === 'wired'
  );
}
