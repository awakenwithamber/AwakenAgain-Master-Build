# AwakenAgain Repo Audit Checklist

**Status:** PROPOSED — requires Amber's approval before execution (per the constitution: PROPOSED never becomes CURRENT without her approval).
**Target:** `awakenwithamber/ambers-alchemy-apothecary` (frozen reference) + 4 duplicate repos, before anything migrates into `AwakenAgain-Master-Build`.
**Authority:** AWAKEN_PLATFORM_ARCHITECTURE.md §34 (STARTUP PROCEDURE), §3 (NEVER PERFORM A BLIND MIGRATION), §30 (AGENT CHANGE CONTROL), §31 (SELF-HEALING LOOP), §36 (DEFINITION OF DONE).
**Change-control level:** LEVEL 0 — READ ONLY. No production changes, no deploys, no secret writes. Findings only.

---

## Phase 0 — Ground rules

1. The old repo is the **frozen reference**. Nothing is copied into the new repo until this audit classifies it.
2. Every finding gets two labels:
   - Requirement status: `CURRENT` / `SUPERSEDED` / `NEEDS VERIFICATION` / `PROPOSED` / `IMPLEMENTED` / `BROKEN` / `BLOCKED`
   - Implementation state: `IDEA` / `DOCUMENTED` / `GENERATED` / `IN DEVELOPMENT` / `BUILT` / `CONNECTED` / `TESTED` / `STAGED` / `DEPLOYED` / `VERIFIED`
3. Architecture ≠ implementation. The Aug 24 consolidation audit is **DOCUMENTED, not VERIFIED** — it claimed "Netlify-connected, Production" while git history shows a Netlify → Vercel migration on Aug 17. Treat all inherited AI claims as untrusted.
4. Secrets scan reports **presence only** — never paste secret values into findings.

---

## Phase 1 — Repository inventory (checklist)

For each item: verify, record the finding, and classify it. Leave nothing as "assumed".

| # | Check | How to verify | Pre-known (from 2026-10-04 GitHub API read — re-confirm, don't re-trust) |
|---|---|---|---|
| 1 | Branches | List all branches; identify default, stale, and unmerged branches | — |
| 2 | Framework | Identify framework/build system | Vanilla HTML/CSS/JS, no framework |
| 3 | **What actually serves awakenagain.com** | DNS records + response headers + deploy hooks — the single most consequential UNKNOWN | Aug 24 audit said Netlify; git history shows Netlify → Vercel on Aug 17. Repo cannot be trusted on this. |
| 4 | Database | Identify live database binding, project, schema state, RLS policies | Supabase worked on; exact live binding UNKNOWN |
| 5 | Authentication | How `grimoire-auth` works; who can access what; session handling | Function exists in `api/`; behavior UNKNOWN |
| 6 | API/functions inventory | For each function: purpose, triggers, required secrets, live-or-dead | `api/` contains: Stripe, Stripe webhook, email, form-submit, quiz-lead, reviews, grimoire-auth, AI, admin |
| 7 | Dependencies | List and version; flag abandoned/unmaintained | Supabase, Stripe, Resend, Vercel AI Gateway |
| 8 | Product/catalog sources | Where does product data live — files, DB, hardcoded? Single source or many? | Content exists across prior builds; canonical dataset status UNKNOWN |
| 9 | Content sources | Articles, herb library, Grimoire content — locations and formats | Concepts/content exist in stages; authoritative source UNKNOWN |
| 10 | Checkout flow | End-to-end: cart → checkout → payment → order record → confirmation | Commerce built around Stripe/Shopify — see payment-direction note below |
| 11 | Customer accounts | Registration, login, password reset, sessions, deletion/export | State UNKNOWN |
| 12 | Customer dashboard | What exists vs. the My Awaken spec (§15) | Spec is PROPOSED; implementation UNKNOWN |
| 13 | Membership logic | Any Living Grimoire ($7.77/mo) implementation | Intended benefits CURRENT; implementation UNKNOWN |
| 14 | Herbal Allies Quiz | Implementation state, mobile behavior | Existed in dev/build form; current state UNKNOWN |
| 15 | Builders | Remedy builder and soap builder state | Concepts exist; current state UNKNOWN |
| 16 | Lunna | Any implementation | PLANNED / IN DEVELOPMENT — verify |
| 17 | Farah / FLOW / automations | Any existing automation or agent wiring | Design targets only; running state UNKNOWN |
| 18 | Analytics | What exists and where data goes | UNKNOWN |
| 19 | SEO | Sitemap, robots, canonical URLs, structured data, meta, alt text | UNKNOWN |
| 20 | Environment-variable references | List every required secret/config **by name only** | — |
| 21 | Secrets scan | Any committed secrets, keys, tokens in history | Report presence only; do not expose |
| 22 | Tests | Run existing test suite; record pass/fail | — |
| 23 | Build | Does the project build; record the build command and result | Last pushed Sept 28 |
| 24 | Duplicate repos | Inventory the 4 duplicates — which contain unique content worth preserving? | `Amber-s-Alchemy-Apothecary-`, `Ambers-Appthecary`, `Website-build`, `Awaken-Again-2` |
| 25 | Git hygiene | Large files, committed binaries | ~122MB, mostly committed MP3s |
| 26 | Phone numbers | Audit all public content for outdated numbers | CURRENT: 801-414-8984 |
| 27 | Design system | Check against dark purple + gold, accessibility baselines | CURRENT per constitution |

### Payment-direction note (binding for the audit)

CURRENT payment direction is **Cash App + Venmo only** (Cash App: $AmberPatten347 · Venmo: @AwakenwithAmber — both verified CURRENT 2026-10-04). The repo's Stripe / Stripe-webhook / Shopify integrations are **SUPERSEDED**. Do not "fix" the Stripe checkout — classify the commerce layer as needing rebuild, and record exactly what the old checkout did so the rebuild can preserve order-record behavior.

---

## Phase 2 — Audit report (required sections)

File the completed audit using these exact sections (§34):

1. CURRENT ARCHITECTURE
2. VERIFIED IMPLEMENTATION
3. IMPLEMENTED REQUIREMENTS
4. MISSING REQUIREMENTS
5. BROKEN REQUIREMENTS
6. CONFLICTING IMPLEMENTATIONS
7. UNKNOWN SYSTEMS
8. SECURITY RISKS
9. SEO RISKS
10. DATA RISKS
11. CUSTOMER ACCOUNT RISKS
12. COMMERCE RISKS
13. TECHNICAL DEBT
14. SAFE IMMEDIATE FIXES
15. REQUIRES AMBER'S DECISION
16. PROPOSED IMPLEMENTATION ORDER

**Definition of audit-done:** every check in Phase 1 has a finding and both classification labels; no UNKNOWN remains without a named verification path; section 15 lists every decision Amber must make before migration begins.

---

## Phase 3 — After the audit (not part of this checklist)

Per §3, migration follows only after: MAP → BACKUP → TEST → PREVIEW → VALIDATE → APPROVE (Amber) → DEPLOY → VERIFY → MONITOR. Platform evaluation is criteria-scored against the 15 zero-vendor-loyalty criteria — no stack is locked before this audit completes.
