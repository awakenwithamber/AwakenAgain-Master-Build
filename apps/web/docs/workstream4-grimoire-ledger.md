# Workstream 4 Ledger — Grimoire / Subscription gaps (G1, G8, G9, G13, G17)

**Date:** 2026-10-05 · **Status: DRAFT — merge into MIGRATION_LEDGER.md by coordinator**

Governing truth honored throughout: brand exactly "Amber's Alchemy Apothecary";
Cash App `$AmberPatten347` + Venmo `@AwakenwithAmber` ONLY (payment-purity guard
test green — no `stripe`/`shopify`/`paypal`/`square` anywhere in new code,
including comments); CLIENT=PREVIEW / SERVER=AUTHORITY, integer cents;
`grimoireMonthlyCents: 777` read from `lib/pricing/pricing.ts`, never hard-coded.

## Gap ledger deltas

Format: OLD STATIC → CLASSIFICATION → NEXT.JS REPLACEMENT → POSTHOG EVENT MIGRATION → FEATURE TEST → ANALYTICS TEST → VERIFIED → SAFE TO REMOVE

### G1 — Grimoire subscription purchase flow
- **OLD STATIC:** `nml-checkout.js` iframe flow (BROKEN — endpoints absent) AND superseded legacy payment rails → never carried. Nothing in the old flow is revived.
- **CLASSIFICATION:** REBUILD (was GAP).
- **NEXT.JS REPLACEMENT:**
  - `lib/subscriptions/subscriptions.ts` — GRIMOIRE_PLAN (price from canonical table), `validateAndBuildSubscription()` (server-authoritative, client-supplied prices ignored), `confirmSubscription()` (owner-only pending_payment→active), `cancelSubscription()`; NEEDS VERIFICATION constant `RECURRING_BILLING_MECHANIC_STATUS` (stage-gated by test).
  - `app/api/subscriptions/route.ts` — POST: validate → build → persist to `.subscriptions-ledger.jsonl` → emit `subscription_created` → return Cash App/Venmo first-month instructions.
  - `app/grimoire/subscribe/page.tsx` + `components/grimoire/SubscribeForm.tsx` — single $7.77/mo plan with 10% storewide discount explained; customer details; success state shows Cash App/Venmo handles + subscription reference for the payment note.
- **POSTHOG EVENT MIGRATION:** `grimoire_subscribe_started` (client) + `subscription_created` (server) — see traceability table below. Status: WIRED (code emits), receipt BLOCKED (no phc_ key) — NOT implemented.
- **FEATURE TEST:** `lib/subscriptions/subscriptions.test.ts` — 10 tests (plan price == 777, discount copy, record building, client-price ignored, owner confirm/cancel, NEEDS VERIFICATION gate).
- **ANALYTICS TEST:** `lib/analytics/grimoire-events.test.ts` (contracts for all 5 events).
- **VERIFIED:** no (no PostHog receipt; no production database).
- **SAFE TO REMOVE:** legacy `nml-checkout.js` — yes as reference now (BROKEN + superseded; CONVERSION_MAP §72 already allows).

### G8 — Grimoire OTP gating
- **OLD STATIC:** `auth-check.js` stub (always access:false) → SUPERSEDED, dropped (OTP is the real gate).
- **CLASSIFICATION:** REBUILD.
- **NEXT.JS REPLACEMENT:**
  - `lib/grimoire/otp.ts` — provider-neutral contract: `requestOtp` (6-digit, 10-min TTL, codes hashed scrypt+salt, single use, 5-attempt burn) → `verifyOtp` → 24h session → `getValidSession`. `OtpStore` interface with `InMemoryOtpStore` bound now (dev/preview). `createSupabaseOtpStore()` refuses to run — Supabase table/RLS design NEEDS VERIFICATION, kept behind the interface.
  - `app/api/grimoire-otp/route.ts` — POST request/verify, GET session check; codes logged server-side only in preview (delivery provider UNDECIDED), never in responses or analytics; server events `otp_requested` / `otp_verified`.
  - `components/grimoire/GrimoireGate.tsx` — client gate: email → code → verified renders children; session held in React state only (no session-persistence design invented).
- **POSTHOG EVENT MIGRATION:** `otp_requested` + `otp_verified` (server) — traceability below. WIRED / receipt BLOCKED.
- **FEATURE TEST:** `lib/grimoire/otp.test.ts` — 11 tests (hashing, single use, attempt burn, expiry, session prune, Supabase refusal).
- **ANALYTICS TEST:** `lib/analytics/grimoire-events.test.ts`.
- **VERIFIED:** no.
- **SAFE TO REMOVE:** `auth-check.js` stub — yes after OTP flow live (CONVERSION_MAP §74).

### G9 — Email jobs
- **OLD STATIC:** none working (Zapier form-relay era) → no legacy carried.
- **CLASSIFICATION:** NEW contract (was GAP).
- **NEXT.JS REPLACEMENT:** `lib/jobs/email.ts` — job contract `{id,to,template,data,queued_at,status}`; templates `purchase_confirmation`, `weekly_promo`, `unsubscribe_confirmation`, `review_reminder`; `EmailProvider` interface with `LoggingEmailProvider` bound (NO REAL SENDS); `InMemorySuppressionList`; `handleUnsubscribe()`; promos/reminders refuse suppressed addresses.
- **POSTHOG EVENT MIGRATION:** `email_job_queued` (server, job_id/template only). WIRED / receipt BLOCKED.
- **FEATURE TEST:** `lib/jobs/email.test.ts` — 8 tests (validation, logging provider, unsubscribe, suppression enforcement).
- **ANALYTICS TEST:** `lib/analytics/grimoire-events.test.ts`.
- **VERIFIED:** no (no provider bound; nothing sent).
- **SAFE TO REMOVE:** n/a.

### G13 — Scheduled review-reminder job
- **OLD STATIC:** none → no legacy carried.
- **CLASSIFICATION:** NEW contract (was GAP).
- **NEXT.JS REPLACEMENT:** `lib/jobs/review-reminders.ts` — pure `runReviewReminderPass(orders, reviewUrl, now)`: due at 21 days post-fulfillment, skip too_soon/already_reminded/invalid_email/invalid_fulfilled_at with reasons; exports NO scheduler — trigger binding lives in `/infrastructure`, never in app code (structural invariant asserted by test).
- **POSTHOG EVENT MIGRATION:** reuses `email_job_queued` with template `review_reminder` (job contract carries template).
- **FEATURE TEST:** `lib/jobs/review-reminders.test.ts` — 8 tests (cadence, no double-remind, skip reasons, purity/determinism, no-scheduler invariant).
- **ANALYTICS TEST:** via `email_job_queued` contract test.
- **VERIFIED:** no.
- **SAFE TO REMOVE:** n/a.

### G17 — Grimoire herb explorer + botanical sales
- **NOT BUILT — owner decision required first.** Recorded as NEEDS VERIFICATION. No code written.

## PostHog event traceability (new events 23–27)

Owner directive 2026-10-05 ~17:45: every taxonomy addition needs
name → reason → legacy equivalent → owner → purpose.

| # | Event name | Reason | Legacy equivalent | Owner | Purpose |
|---|-----------|--------|-------------------|-------|---------|
| 23 | `grimoire_subscribe_started` | New funnel: Living Grimoire signup begins (revenue path G1) | None (old flow BROKEN — no baseline) | client | Observe subscribe-form engagement / drop-off |
| 24 | `subscription_created` | Record the authoritative signup as an observed fact | Legacy `nml:payment-complete` postMessage (SUPERSEDED, dead) | server | Canonical observed subscription count; ledger is the authority |
| 25 | `otp_requested` | Measure gate friction on subscriber content | `auth-check.js` stub (SUPERSEDED — always false, no events) | server | Observe OTP issuance volume vs verification completion |
| 26 | `otp_verified` | Record successful gate passage as an observed fact | None (no working gate existed) | server | Canonical observed gate-pass count; session store is the authority |
| 27 | `email_job_queued` | Observe email-queue activity before a provider is bound | None (Zapier form-relay era, superseded) | server | Queue volume by template; no sends yet |

All five carry `implementation_source: 'nextjs'`. Payloads contain no PII,
payment details, OTP codes, or secrets (runtime-scanned in tests). Events
live in `lib/analytics/grimoire-events.ts` (names/properties/ownership +
client/server capture helpers) — **NOT merged into `lib/analytics/events.ts`**;
coordinator merges. Status: WIRED (code exists), receipt BLOCKED on her
phc_ key — NEVER marked IMPLEMENTED.

## NEEDS VERIFICATION items

1. **G1 recurring-billing mechanics (OWNER DECISION REQUIRED):** Cash App/Venmo have no recurring rail — manual monthly send vs owner-issued request vs other is genuinely undecided. Built: signup + first-payment owner confirmation. Not built (by design): any billing/renewal process. Marker: `RECURRING_BILLING_MECHANIC_STATUS = 'NEEDS_VERIFICATION'` (test-gated).
2. **G8 Supabase OTP binding:** project/table/RLS design not verified. In-memory store is dev/preview only (no durability, no multi-instance fan-out). `createSupabaseOtpStore()` throws until verified.
3. **G9 email provider:** Resend or other UNDECIDED. Logging provider only — no real sends.
4. **G13 trigger binding:** scheduler lives in `/infrastructure` (not created — infrastructure area belongs to the deployment/platform decision).
5. **G17 herb explorer:** not built — owner decision first.
6. **Persistence:** subscription + OTP ledgers are local JSONL/in-memory (reversible) — production database (Supabase project) UNDECIDED per architecture.

## MISSING_ASSET notes

- OTP code delivery provider (email/SMS) — no provider bound; codes logged server-side in preview.
- Grimoire member content itself (the gated pages GrimoireGate protects) — gate exists, content routes not in scope of this workstream.
- Owner confirmation surface for subscriptions (admin action path for `confirmSubscription`) — belongs to G12 admin dashboard (later phase per CONVERSION_MAP §16.8).
- Supabase project binding for durable subscription/OTP/session persistence.

## Owner-decision gates hit

- **G1 recurring-billing mechanics** — her call (see NEEDS VERIFICATION #1).
- **G17 herb explorer** — her call before any build.

## Verification state (2026-10-05 ~18:15 MDT)

- New tests: **46/46 pass** (5 files: subscriptions 10, OTP 11, email 8, review-reminders 8, analytics contracts 8).
- Full suite: **556 passed / 3 skipped / 0 failed** (52 files). `tests/no-forbidden-providers.test.ts` green (one self-found violation — a "Stripe" comment mention — fixed during this workstream; shipped code is provider-clean).
- tsc: **0 errors** across the whole app.
- Build: my routes/pages (`/grimoire/subscribe`, `/api/subscriptions`, `/api/grimoire-otp`) verified compiling via isolated scratch build during a sibling G5 breakage window (ContactForm client/server boundary issue, since resolved by the sibling worker — real tree untouched by me).

## Files created (16)

- `lib/subscriptions/subscriptions.ts`
- `lib/subscriptions/subscriptions.test.ts`
- `app/api/subscriptions/route.ts`
- `app/grimoire/subscribe/page.tsx`
- `components/grimoire/SubscribeForm.tsx`
- `lib/grimoire/otp.ts`
- `lib/grimoire/otp.test.ts`
- `app/api/grimoire-otp/route.ts`
- `components/grimoire/GrimoireGate.tsx`
- `lib/jobs/email.ts`
- `lib/jobs/email.test.ts`
- `lib/jobs/review-reminders.ts`
- `lib/jobs/review-reminders.test.ts`
- `lib/analytics/grimoire-events.ts`
- `lib/analytics/grimoire-events.test.ts`
- `docs/workstream4-grimoire-ledger.md` (this file)

## Files modified (1)

- None in shared code. (One self-fix: removed a "Stripe" comment mention from `lib/subscriptions/subscriptions.ts` to satisfy the payment-purity guard.)

Nothing pushed to GitHub. CONVERSION_MAP.md / CHECKPOINT_METRICS.md untouched. `app/layout.tsx` untouched. Nothing deleted.
