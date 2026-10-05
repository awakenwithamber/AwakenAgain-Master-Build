# PostHog key handoff — Amber's Alchemy Apothecary (Next.js)

**Placement (one line):** paste your `phc_` project key into the `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` environment variable in your hosting dashboard (Vercel → Project → Settings → Environment Variables; add it for Production, Preview, and Development), then redeploy — no code changes needed.

**Verify receipt:** open PostHog → **Live Events**, click through the soap builder on the site, and confirm events arrive with the property `implementation_source: 'nextjs'`.

**Notes:** without the key the tracker is fully inert (no errors, no network calls, no console noise) — the site works identically. Status stays WIRED / BLOCKED until live events are verified; PostHog is observational only and never holds PII or payment details.
