# PostHog Event Migration Map — Amber's Alchemy Apothecary → Next.js

**Status: WIRED** — code exists, regression tests green. **Receipt: BLOCKED** — waiting on the owner's `phc_` project key. Analytics is NEVER marked IMPLEMENTED here (IMPLEMENTED = connected + functioning + tested + verified event receipt).

**Governing rules:** PostHog is observational only — cart, order ledger, and database stay authoritative. NO PII, payment details, secrets, or auth credentials in any event. Order events carry `order_id` / `total_cents` / `item_count` only. Payments: Cash App $AmberPatten347 + Venmo @AwakenwithAmber only. Brand: "Amber's Alchemy Apothecary" (never shortened).

**Hard boundary (owner 2026-10-05):** PostHog = behavioral observation, funnels, migration comparison, experimentation. Server/database = authoritative pricing, orders, customers, membership, fulfillment, business records. A checkout interaction is behavioral; a server-validated accepted order is authoritative business state recorded as an observed fact — modeled and named accordingly, never conflated. Behavioral events read as observations ("customer viewed instructions"); recorded-fact events read as facts ("server accepted order"), never as the authority itself. The ledger (later the database), not any event, is the authority. (Also stated in `lib/analytics/events.ts`.)

**Ownership-transfer lifecycle (owner 2026-10-05 — encode, don't reinterpret).** Ownership transfers ONLY after the Next.js replacement is VERIFIED — never on code conversion alone. Every Next.js event carries an `ownership_stage` (see `OWNERSHIP_STAGES` in `lib/analytics/events.ts`), in this exact order:

LEGACY STATIC ACTIVE → NEXT.JS REPLACEMENT BUILT → FEATURE TESTED → POSTHOG EVENT RECEIVED + VERIFIED → PARITY VERIFIED → NEXT.JS AUTHORITATIVE → LEGACY FEATURE/EVENT SAFE TO RETIRE

Current truth (no `phc_` key exists): **no event sits beyond FEATURE TESTED.** Static counterparts are LEGACY STATIC ACTIVE (feature live) but their PostHog status is WIRED, not IMPLEMENTED (also inert without the key). Both dimensions are recorded per event below — never conflated. A stage-gate regression test (`lib/analytics/ownership-transfer.test.ts`) fails if any event claims receipt/parity/authority while the key is absent.

**Implementation:** `lib/analytics/events.ts` (22-event typed taxonomy) · `lib/analytics/posthog.ts` (client tracker, inert without key) · `lib/analytics/posthog-server.ts` (server capture) · `app/instrumentation-client.ts` (PostHog's Next.js client entry point).

**Source tagging:** every Next.js event carries `implementation_source: 'nextjs'` (client: registered super property + stamped payload via `buildEventPayload()`; server: explicit payload property). The staged static build uses `implementation_source: 'legacy_static'`. This prevents double counting while both surfaces are live and enables static-baseline vs Next.js comparison — see [Comparison queries](#comparison-queries-enabled-by-implementation_source).

**Ownership (§6):** CLIENT = interactions (only the browser observes them). SERVER = authoritative business transitions (only the server can attest them). The client tracker type-refuses server-owned events (`ClientEventName`); the server capturer type-refuses client-owned events (`ServerEventName`). The same action is never emitted from both sides.

---

## 1. Builder / shop / checkout journey

Columns: STATIC EVENT → PURPOSE → NEXT.JS EVENT → OWNER → PROPERTIES → TEST → OWNERSHIP STAGE → POSTHOG STATUS

| Static event (`posthog-tracking.js`) | Purpose | Next.js event | Owner | Properties | Test | Ownership stage | PostHog status |
|---|---|---|---|---|---|---|---|
| — (no product-page event in static) | Discovery → product view: measure which catalog entries attract views | `product_viewed` | client | `product_handle`, `category?` | `analytics-contracts.test.ts` (sample + source stamp); `ProductViewTracker` fires once per mount via `trackOnce` | `feature_tested` | WIRED (receipt BLOCKED) |
| — (`$pageview` automatic) | Shop index / soap-shop landing views | `$pageview` (automatic) | client | url, path (+ source super property) | `posthog.ts` sets `capture_pageview: true` | `feature_tested` | WIRED (receipt BLOCKED) |
| `builder_step_viewed` (`goStep(n)`) | Funnel step progression + drop-off by step | `builder_step_viewed` | client | `step` 1–6, `step_name` | `events.test.ts`; fired only from the `goStep` handler, never render | `feature_tested` | WIRED (receipt BLOCKED) |
| `base_selected` (base card click) | Which base customers choose | `base_selected` | client | `base` | `events.test.ts`; handler-only | `feature_tested` | WIRED (receipt BLOCKED) |
| `shape_selected` (shape card click) | Which shape customers choose | `shape_selected` | client | `shape` | `events.test.ts`; handler-only | `feature_tested` | WIRED (receipt BLOCKED) |
| `scent_selected` (leaving step 3) | Signature-vs-custom path split; top recipes / oils | `scent_selected` | client | `path`: `signature`\|`custom_blend`; `recipe_id` OR `oils[]`, `oil_count`, `profile_tags[]` | `events.test.ts`; `analytics-contracts.test.ts` PII scan | `feature_tested` | WIRED (receipt BLOCKED) |
| `blend_oil_toggled` (oil chip click) | Oil popularity; custom-blend engagement | `blend_oil_toggled` | client | `oil_id`, `selected`, `oil_count`, `slot_index?` | `events.test.ts`; handler-only | `feature_tested` | WIRED (receipt BLOCKED) |
| `blend_completed` (3 oils reached) | "Your Alchemy Blend" readout reached | `blend_completed` | client | `oils[]`, `profile_tags[]`, `oil_count`, `slot_index?` | `events.test.ts`; fires once per completion | `feature_tested` | WIRED (receipt BLOCKED) |
| `botanical_selected` (botanical card click) | Botanical popularity | `botanical_selected` | client | `botanical` | `events.test.ts`; handler-only | `feature_tested` | WIRED (receipt BLOCKED) |
| `color_selected` (swatch / custom) | Color popularity; custom-color usage | `color_selected` | client | `color_name`, `color_hex`, `custom` | `events.test.ts`; handler-only | `feature_tested` | WIRED (receipt BLOCKED) |
| `seasonal_scent_interacted` (seasonal CTA) | Seasonal engagement (Oct 2026 = Pumpkin Spice theme) | `seasonal_scent_interacted` | client | `season_id` (e.g. `pumpkin-spice-oct-2026`) | `events.test.ts` | `feature_tested` | WIRED (receipt BLOCKED) |
| `ritual_completed` (step 6 rendered) | "Your Alchemy Is Complete ✨" reached — ritual completion | `ritual_completed` | client | — | `events.test.ts`; `trackOnce` keyed per mode (StrictMode-safe) | `feature_tested` | WIRED (receipt BLOCKED) |
| `bundle_opened` (builder `?bundle=1`) | Bundle journey entry | `bundle_opened` | client | — | `trackOnce` (effect-safe; was `track` — hardened 2026-10-05) | `feature_tested` | WIRED (receipt BLOCKED) |
| `bundle_slot_configured` (theme apply / slot edit) | Per-slot configuration; theme-vs-manual engagement | `bundle_slot_configured` | client | `via`: `theme_apply`\|`slot_edit`; `slot_index`, `shape`, `base`, `scent_path`, `recipe_id`/`oils[]`+`oil_count`, `botanical`, `color` | `events.test.ts` (slot schema); QA: exactly 5× on theme apply, 1× per slot edit | `feature_tested` | WIRED (receipt BLOCKED) |
| `bundle_added_to_cart` (Add Collection) | Bundle conversion | `bundle_added_to_cart` | client | `bundle_id`, `price_cents: 3577` (computed, never hard-coded), `savings_cents: 1208` (computed), `slot_count`, `slots[]` | `events.test.ts` (3577/1208 contract); `pricing.test.ts` | `feature_tested` | WIRED (receipt BLOCKED) |
| `soap_added_to_cart` (Add to Cart) | Single-soap conversion; bundle_mode distinguishes builder singles | `soap_added_to_cart` | client | `base`, `shape`, `scent` {type, recipe_id\|oils[]}, `botanical`, `color`, `bundle_mode` | `events.test.ts`; handler-only | `feature_tested` | WIRED (receipt BLOCKED) |
| `cart_updated` (qty change) | Cart modification; abandonment signals | `cart_updated` | client | `action`: `qty_change`\|`remove`; `product_handle`; `qty?` — `remove` + `product_handle` are deliberate Next.js extensions (static had no cart UI; see parity table §1a) | `events.test.ts`; handler-only | `feature_tested` | WIRED (receipt BLOCKED) |
| `checkout_initiated` (`AwakenCheckout.begin()` — was NEEDS_VERIFICATION, no checkout UI in static) | Checkout funnel entry | `checkout_initiated` | client | — | `events.test.ts`; fired in `placeOrder` handler after validation | `feature_tested` | WIRED (receipt BLOCKED) |
| — (no static equivalent; instructions were static text) | Cash App / Venmo instructions shown on confirmation | `payment_instructions_viewed` | client | `order_id` | `analytics-contracts.test.ts`; `trackOnce` keyed by order_id | `feature_tested` | WIRED (receipt BLOCKED) |
| `order_completed` (`AwakenCheckout.complete(...)` — was NEEDS_VERIFICATION in static) | Customer saw order confirmation | `order_completed` | client | `order_id`, `total_cents`, `item_count` ONLY | `events.test.ts`; `analytics-contracts.test.ts` (payload-key allowlist) | `feature_tested` | WIRED (receipt BLOCKED) |
| — (did not exist in static) | **Recorded fact: order accepted + persisted** — the canonical observed revenue count (the ledger, not the event, is the authority) | `order_created` | **server** | `order_id`, `total_cents`, `item_count` ONLY | `analytics-contracts.test.ts` (endpoint, payload allowlist, inert-without-key, distinct_id); route fires fire-and-forget after ledger persist | `feature_tested` | WIRED (receipt BLOCKED) |
| `shop_scent_card_clicked` / `shop_bundle_card_clicked` (staged static) | Shop card clicks | `shop_scent_card_clicked` / `shop_bundle_card_clicked` | client | `recipe_id` / `bundle_id` | — (taxonomy names reserved; emission wiring waits for the cards — §2) | `legacy_static_active` (Next.js replacement not built; transfer not started) | WIRED (receipt BLOCKED) |

**`order_completed` vs `order_created` — not duplicates:** the client event answers "the customer saw the confirmation / payment instructions"; the server event answers "the server accepted and persisted the order" — a recorded fact, not the authority itself. Different actions, different owners. **Use `order_created` as the canonical revenue count**; use `order_completed` for confirmation-render / payment-instruction funnel analysis.

### 1a. Parity audit — static 19-event taxonomy → Next.js 22-event taxonomy (2026-10-05)

Method: `posthog-tracking.js` + `POSTHOG_EVENTS.md` (static baseline) audited event-by-event against `lib/analytics/events.ts`. Result: **19 of 19 static event names survive verbatim** in the Next.js taxonomy — zero renames. The three additions are documented below (not silent).

| # | Static event | Next.js event | Verdict | Notes |
|---|---|---|---|---|
| 1 | `builder_step_viewed` | `builder_step_viewed` | ALIGNED | Same name, same core properties |
| 2 | `ritual_completed` | `ritual_completed` | ALIGNED | — |
| 3 | `base_selected` | `base_selected` | ALIGNED | — |
| 4 | `shape_selected` | `shape_selected` | ALIGNED | — |
| 5 | `scent_selected` | `scent_selected` | ALIGNED | Same core properties |
| 6 | `blend_oil_toggled` | `blend_oil_toggled` | ALIGNED | — |
| 7 | `blend_completed` | `blend_completed` | ALIGNED | — |
| 8 | `botanical_selected` | `botanical_selected` | ALIGNED | — |
| 9 | `color_selected` | `color_selected` | ALIGNED | — |
| 10 | `soap_added_to_cart` | `soap_added_to_cart` | ALIGNED | `bundle_mode` boolean kept; static always sent `false` (single-bar mode) |
| 11 | `cart_updated` | `cart_updated` | ALIGNED — documented extension | Static: `action: "qty_change"`, `qty`. Next.js adds `product_handle` and the `remove` action — deliberate: the static build had no cart UI (removal was deliberately NOT an event); the Next.js cart needs both. Same name, same core property. |
| 12 | `bundle_opened` | `bundle_opened` | ALIGNED | — |
| 13 | `bundle_slot_configured` | `bundle_slot_configured` | ALIGNED | Same per-slot property set |
| 14 | `bundle_added_to_cart` | `bundle_added_to_cart` | ALIGNED | 3577/1208 computed contract kept |
| 15 | `shop_scent_card_clicked` | `shop_scent_card_clicked` | ALIGNED (unwired) | Static-active; Next.js name reserved only, wiring pending cards |
| 16 | `shop_bundle_card_clicked` | `shop_bundle_card_clicked` | ALIGNED (unwired) | Same as above |
| 17 | `seasonal_scent_interacted` | `seasonal_scent_interacted` | ALIGNED | — |
| 18 | `checkout_initiated` | `checkout_initiated` | ALIGNED | — |
| 19 | `order_completed` | `order_completed` | ALIGNED | `order_id`/`total_cents`/`item_count` only, both sides |
| 20 | — (no static counterpart) | `product_viewed` | ADDED (documented) | Discovery → product view had no static event (only automatic `$pageview`); needed for the 45 SSG product pages. |
| 21 | — (no static counterpart) | `payment_instructions_viewed` | ADDED (documented) | Cash App / Venmo instructions were static text in the static build; the Next.js confirmation page renders them as an observable money-path step. |
| 22 | — (no static counterpart) | `order_created` | ADDED (documented) | Server-owned recorded fact that the Route Handler accepted + persisted the order. No static equivalent exists. The ledger (not the event) is the authority; the event is the canonical observed revenue count. |

**Open static-side gap (flagged, not fixed — static build is out of scope):** the static `cap()` in `posthog-tracking.js` stamps **no** `implementation_source` — the map's "staged static build uses `implementation_source: 'legacy_static'`" describes the intended migration design, not the current static code. Until the static code stamps it (one-line change to `cap()` when a key is ever installed there), static events arriving in PostHog would carry NO distinguishing property and could not be separated from Next.js events in comparison views. Action for the parent: either stamp `legacy_static` in the static snippet or never install a key on the static build (it is inert without one).

**Deliberately NOT events (carried over from the static taxonomy):**
- Wave Rectangle preview renders — would fire dozens of times per session (noise). Preview interaction is captured implicitly via `base_selected` / `color_selected` / `botanical_selected` / `builder_step_viewed`.
- Per-step "continue" clicks — covered by `builder_step_viewed`.
- Individual oil select/deselect — covered by `blend_oil_toggled.selected`.

---

## 2. Surfaces not yet built — PENDING (not faked)

No events are emitted for these surfaces because the surfaces don't exist yet in the Next.js app. Candidate event names below are PROPOSED — they are NOT in the taxonomy and must go through the deliberate-bump process when the surface is built.

| Surface | Status | Proposed events (PROPOSED, not implemented) |
|---|---|---|
| `shop_scent_card_clicked` / `shop_bundle_card_clicked` | PENDING — no scent-card / bundle-card interactive grid exists yet (current soap-shop page is a server-rendered PoC) | — (taxonomy names reserved; wiring waits for the cards) |
| Herbal Allies Quiz | PENDING — quiz not built | `quiz_started`, `quiz_completed`, `quiz_result_viewed` |
| Services (consultations etc.) | PENDING — services pages not built | `service_viewed`, `service_inquiry_started` |
| Facts / Articles (herbal education) | PENDING — article system not built | `article_viewed`, `article_search` |
| Living Grimoire (content + purchase flow) | PENDING — Grimoire purchase flow is gap G1 | `grimoire_viewed`, `grimoire_subscribe_initiated` |
| Membership / subscription (`subscription_confirmed`) | PENDING — membership verification not built (see CheckoutForm note) | `subscription_confirmed` (reserved in `SERVER_EVENTS_PLANNED`) |
| Reviews | PENDING — review system not built | `review_submitted`, `review_viewed` |
| Contact | PENDING — contact pipeline is gap G5 | `contact_form_started`, `contact_form_submitted` |
| Site navigation / search | PENDING — no site search yet | `site_search`, `nav_link_clicked` |
| `cart_configuration_accepted`, `pricing_validation_passed/failed` | PENDING — reserved server events for the durable order-intake phase | in `SERVER_EVENTS_PLANNED` |

---

## 3. Comparison queries enabled by `implementation_source`

Break down **any** insight, funnel, or retention view by `implementation_source` (`nextjs` vs `legacy_static`):

1. **Funnel conversion parity** — Funnel A (soap purchase) and Funnel B (bundle) below, run once with breakdown by `implementation_source`: does the Next.js build convert at/above the static baseline at each step?
2. **Builder completion** — `ritual_completed` ÷ `builder_step_viewed(step=1)` by source: ritual completion rate, static vs Next.js.
3. **Ritual-to-cart** — `soap_added_to_cart` + `bundle_added_to_cart` ÷ `ritual_completed` by source.
4. **Checkout progression** — `checkout_initiated` → `order_created` by source: where does the money-path leak in each implementation?
5. **Abandonment** — `builder_step_viewed` drop-off by `step_name` × source: which step loses people in which build?
6. **Bundle engagement** — `bundle_slot_configured` (`via`) and `bundle_opened` → `bundle_added_to_cart` by source.
7. **Friction / errors** — `cart_updated(action=remove)` rate and checkout validation failures by source (server `pricing_validation_failed` when wired).
8. **Navigation** — `$pageview` path popularity by source once both surfaces serve traffic.

### Funnels — build in PostHog UI (specs)

**Funnel A: "Soap purchase journey"**
1. `builder_step_viewed` where `step = 1`
2. `builder_step_viewed` where `step = 6` (or `ritual_completed`)
3. `soap_added_to_cart`
4. `checkout_initiated`
5. `order_created` ← canonical revenue step (server-attested)
Breakdown: `scent.path`, then `implementation_source`. Conversion window: 1 day. Add `builder_step_viewed` × steps 2–5 as optional intermediate steps for abandonment analysis.

**Funnel B: "Bundle journey"**
1. `bundle_opened`
2. `bundle_slot_configured` where `via = "theme_apply"`
3. `bundle_added_to_cart`
4. `checkout_initiated`
5. `order_created`
Breakdown: `scent_path`, then `implementation_source`. Track `bundle_slot_configured` where `via = "slot_edit"` as an engagement signal (not a funnel step).

**Dashboard: "Soap Shop health" (spec)** — Funnel A + B conversion rates · `builder_step_viewed` drop-off by `step_name` (bar) · `scent_selected` split by `path` (pie); top `recipe_id` / top `oils[]` (tables) · `blend_oil_toggled` breakdown by `oil_id` · `seasonal_scent_interacted` count · `cart_updated` qty distribution · all broken down by `implementation_source` during migration.

---

## 4. Key handoff

See [POSTHOG_KEY.md](../../POSTHOG_KEY.md): paste the `phc_` key into `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (Vercel/hosting dashboard env vars), then watch PostHog → Live Events.

## 5. PostHog QA checklist (before receipt can be called VERIFIED)

- [ ] Key installed; events arriving in Live Events with `implementation_source: 'nextjs'`
- [ ] No duplicates (esp. `builder_step_viewed` on back-navigation — expected on revisit, not on re-render; `ritual_completed`, `bundle_opened`, `product_viewed`, `payment_instructions_viewed` fire exactly once per key)
- [ ] `bundle_slot_configured` fires exactly 5× on theme apply, 1× per slot edit
- [ ] `blend_completed` fires once per 3-oil completion
- [ ] `order_created` fires exactly once per accepted order; `order_created` totals match the ledger totals (no drift between analytics and order truth)
- [ ] No PII in any property (spot-check 50 events)
- [ ] Dev/test traffic excluded (PostHog toolbar / IP filter) before reporting
- [ ] Funnels A + B built, `implementation_source` breakdown verified
- [ ] `instrumentation-client.ts` initializes on client boot (no console errors without key)

---

## 6. Traceability

| Item | Location |
|---|---|
| Taxonomy (22 events, ownership, ownership stages, planned server events) | `lib/analytics/events.ts` |
| Client tracker (inert without key, source stamping, dedupe) | `lib/analytics/posthog.ts` |
| Server capture (`order_created`) | `lib/analytics/posthog-server.ts` |
| Next.js client entry point | `app/instrumentation-client.ts` |
| Server emission point | `app/api/checkout/route.ts` (fire-and-forget after ledger persist) |
| Client emission points | `components/builder/*`, `components/shop/*`, `components/checkout/*` |
| Contract tests | `lib/analytics/events.test.ts`, `lib/analytics/analytics-contracts.test.ts` |
| Ownership-transfer stage gate + static↔Next.js name parity | `lib/analytics/ownership-transfer.test.ts` |
| Evidence-based checkpoint metrics | `docs/migration/CHECKPOINT_METRICS.md` |
| Static baseline | `../soap-shop-build/assets/POSTHOG_EVENTS.md`, `../soap-shop-build/assets/posthog-tracking.js` |
