# Checkpoint Metrics — Amber's Alchemy Apothecary Migration (evidence-based)

**Checkpoint date:** 2026-10-05 ~17:25 MDT · **Compiled by:** analytics/ownership subagent (parent orchestrator task)
**Rule:** every metric carries a definition, an evidence source, and a current value. Values not yet computable are marked **PENDING** with the exact computation method. No invented numbers.

---

## 1. converted CURRENT / total CURRENT

**Definition:** A feature counts as CURRENT if it appears in `CONVERSION_MAP.md` and is NOT classified SUPERSEDED (SUPERSEDED items must never convert). It counts as *converted* if a Next.js implementation is present — scaffolded, IN PROGRESS, or implemented — in `nextjs-app/`.

| Value | Status | Evidence |
|---|---|---|
| Total mapped | **125** | `docs/migration/CONVERSION_MAP.md` — "Features mapped: 125 (entries 1–125)" |
| SUPERSEDED-classified (must not convert) | **12** (marker scan; ~9 dual/edge-classified entries need judgment) | Marker scan of entries 1–125 (`→ **SUPERSEDED**`); cf. 26-item superseded list (b) |
| Total CURRENT (candidate) | **≈113** | 125 − 12; PENDING exact per-entry review for the 9 dual/edge cases (e.g. #21 mixed PRESERVE/SUPERSEDED) |
| Converted CURRENT | **PENDING exact count** | Interim (audit-reported, not computed): ~35% independent of static (Summary 3); ~20 scaffolded with tests passing; ~28 IN PROGRESS. **Computation method:** per-entry review of entries 1–125 — count each non-SUPERSEDED entry whose NEW IMPLEMENTATION is scaffolded, IN PROGRESS, or implemented (GAP/PROPOSED do not count). |

## 2. verified CURRENT / total CURRENT

**Definition:** A converted feature counts as *verified* when its TEST exists and passes against the new implementation (recorded VERIFIED: yes in the map, excluding SUPERSEDED classifications).

| Value | Status | Evidence |
|---|---|---|
| Verified CURRENT | **PENDING exact count** | Interim: no CURRENT (non-superseded) entry is recorded VERIFIED: yes yet; the only VERIFIED: yes entries are supersede-confirmations (37, 38, 98, 110–113). Suite-wide, 226 tests pass. **Computation method:** per-entry review — count non-SUPERSEDED entries with VERIFIED: yes on the new implementation. |

## 3. legacy-dependent CURRENT remaining

**Definition:** CURRENT functionality with no usable Next.js destination — either gap-listed (G1–G17) or named in the map's "Still dependent on legacy" summary.

| Value | Evidence |
|---|---|
| **17 gaps (G1–G17)** | CONVERSION_MAP §(a) — no Next.js destination built |
| **6 dependency classes** | CONVERSION_MAP Summary (2): Netlify Blobs data (quiz leads, reviews, review queue); Zapier webhook values (Netlify dashboard only); Resend/email flows (legacy logic only); Grimoire content (4 approvals pending); live production site (legacy static); legacy code kept as read-only reference |
| **~65% of CURRENT functionality still static-only** | CONVERSION_MAP Summary (3), audit-reported |

## 4. static PostHog events verified / expected

**Definition:** verified = event receipt observed in PostHog Live Events for the static implementation; expected = the static 19-event taxonomy (`POSTHOG_EVENTS.md` v2).

| Value | Evidence |
|---|---|
| **0 / 19** | No `phc_` key exists — receipt is impossible; static status is WIRED only (inert snippet), never IMPLEMENTED. Named events verified against `soap-shop-build/assets/posthog-tracking.js`. |

## 5. Next.js PostHog events verified / expected

**Definition:** verified = event receipt observed in PostHog Live Events with `implementation_source: 'nextjs'`; expected = the 22-event typed taxonomy (`lib/analytics/events.ts`).

| Value | Evidence |
|---|---|
| **0 / 22** | No `phc_` key exists — receipt BLOCKED; all events WIRED (code exists, tests green). `OWNERSHIP_STAGES`: none beyond `feature_tested`. |

## 6. tests passed / skipped / failed

**Definition:** fresh `npm test` (vitest) run in `nextjs-app/`.

| Value | Evidence |
|---|---|
| **238 passed / 3 skipped / 0 failed** (20 test files, all green) | `npm test` 2026-10-05 ~17:25 MDT — includes the 12 new `ownership-transfer.test.ts` tests added this task. Skips: Wave Rectangle preview module, full checkout flow (pending), and the conditional stage-gate skip when a key is configured. |

## 7. MISSING_ASSET count

**Definition:** catalog product records honestly flagged as having no real product photo (`IMAGE_INTEGRITY_REPORT.md` verdict table).

| Value | Evidence |
|---|---|
| **39** (of 45 records: 4 MATCH / 2 MISMATCH / 39 MISSING_ASSET) | `docs/migration/IMAGE_INTEGRITY_REPORT.md` verdict counts. 10 app-level staged assets exist and are consistent (not product records). |

## 8. NEEDS_VERIFICATION count

**Definition:** conversion-map entries classified NEEDS VERIFICATION (insufficient evidence to decide; owner or further audit decides).

| Value | Evidence |
|---|---|
| **12** | CONVERSION_MAP "Counts" section: entries 5, 14, 20, 46, 62/97-provider, 67, 75, 77, 117, 123 + service prices (§52). |

## 9. BLOCKED count

**Definition:** items blocked on the owner or an external action (key, binding, approvals, rates, decisions).

| Value | Evidence |
|---|---|
| **12 named blockers** | CONVERSION_MAP "Counts": PostHog `phc_` key (event receipt); Supabase project binding (Blobs migration, RLS); 13 scent approvals; $35.77 bundle + staged experience approval; 12 catalog unresolved items; 4 Grimoire approvals; custom-soap price ruling; tax/shipping rates; AI provider choice; ambient-audio keep/drop; soap-menu keep/drop; Privacy/Terms existence. |

## 10. production-readiness gates remaining

**Definition:** the deployment gate from the owner's 2026-10-05 ~16:46 directive — DEPLOYMENT MUST NOT OUTRUN APPLICATION. Six gates; a gate passes only on verified evidence, never on conversion alone.

| Gate | Status |
|---|---|
| Conversion complete: 100% of CURRENT features converted, parity verified | PENDING |
| Money path verified: Cash App $AmberPatten347 + Venmo @AwakenwithAmber checkout rock solid, server-authoritative totals, end-to-end test orders | PENDING |
| PostHog receipt verified: key installed, events received + verified, funnels A+B built | BLOCKED (key) |
| SEO / a11y / security / regression verified | PENDING |
| Deployment provider decided (UNDECIDED) + preview verified | PENDING |
| DNS cutover explicitly approved by owner | PENDING |
| **Remaining** | **6 of 6 (0 passed)** |

## 11. regressions found

**Definition:** regressions surfaced at this checkpoint — failing regression tests or newly discovered broken behavior in converted features.

| Value | Evidence |
|---|---|
| **0** | Full suite green (226 passed). Historical regressions fixed during conversion (not current): two-cart lost-sales bug, $13.99 flat builder charge, `#`-fragment sitemap URLs, stale $55 bundle wording, 25.3%→25.2% savings. **Computation method:** failing tests tagged REGRESSION + code-review findings per checkpoint. |

## 12. auto-corrections applied

**Definition:** corrections the migration applied without owner involvement because a newer verified directive superseded the old value.

| Value | Evidence |
|---|---|
| **10** (2026-10-05 ~12:50 conversion checkpoint, owner-reported) | Stale $55 variant price; 25.3%→25.2%; pricing→lib/pricing/; checkout handler exports; bundle-mode shape step; #bundle→?bundle=1; EVENT_OWNERSHIP; Pumpkin Spice recipe link; sitemap tests; missing homepage created. |
| **3** (this task, 2026-10-05 ~17:25 — analytics-layer terminology/parity) | `order_created` authority language corrected in `events.ts` + map ("records the fact; the ledger is the authority"); `cart_updated` Next.js extensions (`remove`, `product_handle`) documented as deliberate; static `cap()` source-stamp gap documented (flagged for parent — static build out of scope). |

## 13. genuine owner decisions unresolvable from the Master Source of Truth

**Definition:** items where the Master Source of Truth (owner directives in MEMORY.md + verified docs) contains no answer — only the owner can decide.

| # | Decision | Status |
|---|---|---|
| 1 | 13 signature scent recipes — approve revised set | BLOCKED (draft pending) |
| 2 | 9-bar $99.99 collection → $35.77 Alchemy Soap Collection supersede — confirm | BLOCKED (pending confirmation) |
| 3 | 12 catalog unresolved items (`UNRESOLVED_ITEMS_v3.md`) | BLOCKED |
| 4 | 4 Grimoire content approvals | BLOCKED |
| 5 | Custom-soap price ruling | BLOCKED |
| 6 | Tax / shipping rates (8% tax, $6.99 shipping unverified) | BLOCKED |
| 7 | AI provider choice (Lunna) | BLOCKED |
| 8 | Ambient audio keep / drop | BLOCKED |
| 9 | Soap-menu page keep / drop | BLOCKED |
| 10 | Privacy / Terms pages existence | BLOCKED |
| **Total** | **10** | |

---

## How to recompute at the next checkpoint

1. `npm test` in `nextjs-app/` → tests passed/skipped/failed.
2. Per-entry review of CONVERSION_MAP.md entries 1–125 → converted / verified / legacy-dependent / NEEDS_VERIFICATION / SUPERSEDED-excluded totals.
3. `IMAGE_INTEGRITY_REPORT.md` verdict table → MISSING_ASSET.
4. With a `phc_` key installed: PostHog Live Events → static events verified/19, Next.js events verified/22 (filter `implementation_source`); then advance `OWNERSHIP_STAGES` per the lifecycle and re-run the stage-gate test.
5. Production gates: flip only on verified evidence per the gate definitions above — never on conversion alone.
