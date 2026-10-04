# CURRENT_PLATFORM_COSTS.md

_Verified 2026-10-04 from primary sources (official pricing/docs pages). Refresh before any major hosting decision. Legend: VERIFIED = read on provider's official page today · UNCLEAR = official source ambiguous · UNVERIFIED = no primary source fetched._

## Cloudflare — VERIFIED (developers.cloudflare.com, 2026-10-04)

| Item | Plan | Limit / Price | Source |
|---|---|---|---|
| Workers requests | Free | 100,000 requests/day (hard daily cap; over-limit invocations fail) | https://developers.cloudflare.com/workers/platform/pricing/ |
| Workers CPU | Free | 10 ms CPU time per invocation | same |
| Workers static assets | Free | Requests to static assets free and unlimited | same |
| Workers egress | All plans | $0 — no data transfer/egress charges | same |
| Workers | Paid (Standard) | $5/mo minimum; 10M requests/mo included + $0.30 per additional million; 30M CPU ms/mo included + $0.02 per additional million CPU ms | same |
| Pages builds | Free | 500 builds/mo, 1 concurrent build | https://developers.cloudflare.com/pages/platform/limits/ |
| Pages files | Free | 20,000 files/site; 25 MiB max single file; 100 custom domains/project | same |
| Pages Functions | Free | Requests count toward the Workers 100K/day quota | same |
| R2 storage | Free tier | 10 GB-month/mo; 1M Class A + 10M Class B ops/mo free; egress $0 always | https://developers.cloudflare.com/r2/pricing/ |
| R2 | Paid | $0.015/GB-mo storage; Class A $4.50/M; Class B $0.36/M | same |
| D1 rows | Free | 5M rows read/day; 100K rows written/day; 5 GB storage total | https://developers.cloudflare.com/workers/platform/pricing/ |
| D1 | Paid | 25B rows read/mo + $0.001/M; 50M rows written/mo + $1.00/M; 5 GB + $0.75/GB-mo | same |
| KV | Free | 100K reads/day; 1K writes/deletes/lists per day; 1 GB stored | same |

Gotchas: 10 ms CPU/invocation free cap is the sneakiest wall (auth, SSR, payload parsing can exceed it); free caps are hard daily limits (fail, don't bill — good cost control, bad if unmonitored); **D1 is SQLite-based, not Postgres** — relevant to the portability requirement; no pausing, no sleep, no non-commercial clause found on Free.

## Supabase — VERIFIED (supabase.com/pricing, 2026-10-04)

| Item | Plan | Limit / Price | Source |
|---|---|---|---|
| Base / MAU / DB / egress / storage / functions / realtime | Free | $0/mo; 50,000 MAU; 500 MB database (shared CPU); 5 GB egress; 1 GB file storage; 500K Edge Function invocations/mo; 200 concurrent realtime connections, 2M messages/mo; unlimited API requests; 1-day log retention | https://supabase.com/pricing |
| Project pause | Free | **Paused after 1 week of inactivity**; 2 active projects max | same |
| Base | Pro | $25/mo | same |
| MAU / disk / egress / storage | Pro | 100K MAU included then $0.00325/MAU; 8 GB disk included then $0.125/GB; 250 GB egress included then $0.09/GB; 100 GB storage included then $0.0213/GB | same |
| Backups / logs | Pro | Daily backups, 7-day retention; 7-day logs; email support | same |
| Compute | Pro | $10/mo compute credits included (covers one Micro); spend cap ON by default; add-ons Micro $10/mo → 16XL $3,730/mo | same |

Gotchas: free-project pausing is a production deal-breaker for a shop; real Pro bills typically $35–75+/mo once compute exceeds the $10 credit; egress overage at $0.09/GB is the classic trap; 500 MB free DB is small for catalog + orders.

## Netlify — VERIFIED (netlify.com/pricing/, docs.netlify.com, 2026-10-04)

| Item | Plan | Limit / Price | Source |
|---|---|---|---|
| Credits | Free | $0; **300 credits/month, hard limit** — no overage billing, no recharge | https://www.netlify.com/pricing/ |
| Credit costs | All | 15 credits per production deploy; 10 credits per GB-hour compute; 20 credits per GB bandwidth; 2 credits per 10K web requests | same |
| Exhaustion | Free | **All projects pause until the next billing cycle** when credits hit zero | https://www.netlify.com/pricing/pro-vs-free/ |
| Personal / Pro | Paid | $9/mo (1,000 credits) / $20/mo (3,000 credits) | https://www.netlify.com/pricing/ |

Gotchas: 300 credits ≈ 15 GB bandwidth OR ~1.5M requests OR ~20 production deploys/month — a real shop with deploys + traffic can exhaust this; pause-until-next-cycle means the store goes dark mid-month with no pay-to-restore on Free.

## Vercel — VERIFIED (vercel.com/pricing.md, 2026-10-04)

| Item | Plan | Limit / Price | Source |
|---|---|---|---|
| Base | Hobby | $0/mo; 1M CDN requests/mo; 100 GB transfer/mo; 1M function invocations/mo; 4 hrs fluid CPU/mo | https://vercel.com/pricing.md |
| Extra usage | Hobby | **Cannot be purchased** — hard caps | same |
| Commercial use | Hobby | **"Our Hobby plan is for personal, non-commercial use."** (pricing page FAQ, verbatim) | same |
| Base | Pro | $20/seat/mo; 10M CDN requests + $2/M; 1 TB transfer + $0.15/GB | same |

Gotchas: the non-commercial clause is decisive — a revenue-generating store cannot run on Hobby; Pro starts at $20/seat/mo before usage.

## Railway — VERIFIED (blog.railway.com, docs.railway.com, 2026-10-04)

| Item | Plan | Limit / Price | Source |
|---|---|---|---|
| Base | Free | $0/mo; **$1 of resource usage per month** (no rollover); up to 1 vCPU / 0.5 GB RAM per service, 1 replica | https://blog.railway.com/p/usage-based-vs-fixed-pricing-2026 |
| Trial | New users | One-time $5 credit, up to 30 days; then Free | https://docs.railway.com/pricing/free-trial |

Gotchas: $1/mo cannot sustain always-on web + DB for a month — free is for measurement/prototyping, not production. Hobby/Pro seat prices UNCLEAR (primary page not fetched).

## Render — VERIFIED (render.com/docs/free, 2026-10-04)

| Item | Plan | Limit / Price | Source |
|---|---|---|---|
| Web services | Free | $0; **spins down after 15 min idle**; 750 free instance hours/workspace/mo; all free services suspended when exhausted | https://render.com/docs/free |
| Postgres | Free | 1 GB; **expires 30 days after creation**, 14-day grace then **deleted with all data**; no backups | same |
| Production suitability | Free | **"Do not use them for production applications."** (verbatim) | same |
| Filesystem / SMTP | Free | Ephemeral filesystem; no outbound SMTP (ports 25/465/587) | same |

Gotchas: cold starts on every idle period; free Postgres is a data-loss risk, not just downtime. Cheapest paid compute UNVERIFIED from primary source.

## Coolify — partially VERIFIED (coolify.io, 2026-10-04)

| Item | Plan | Limit / Price | Source | Tier |
|---|---|---|---|---|
| Self-hosted license | Self-hosted | **$0 — "Open source and free forever"** (verbatim); you pay only for your own server | https://coolify.io | VERIFIED |
| Cloud pricing | Coolify Cloud | No pricing page reachable in this pass | — | UNVERIFIED (strong secondary consensus ~$5/mo base, +$3/mo per extra server) |

Gotchas: you own the server — patching, backups, monitoring are yours; panel needs ~2 vCPU / 2 GB RAM minimum; backup/restore must be designed (S3-compatible targets supported).

## Resend — VERIFIED (resend.com/pricing, 2026-10-04)

| Item | Plan | Limit / Price | Source |
|---|---|---|---|
| Transactional email | Free | $0/mo; 3,000 emails/mo; **100 emails/day hard cap**; 3 domains; 1 webhook endpoint; 30-day data retention | https://resend.com/pricing |
| Transactional email | Pro | $20/mo; 50,000 emails/mo; **$0.90 per additional 1,000**; no daily limit; 10 domains; 5 webhook endpoints | same |
| Transactional email | Scale | $90/mo; 100,000 emails/mo; $0.90 per additional 1,000; 1,000 domains; 10 webhook endpoints | same |
| Overage billing | Paid plans | Billed in 1,000-email buckets at the plan's overage rate; pay-as-you-go must be enabled in team settings or over-limit sends trigger upgrade notice | same |
| Billing terms | All | Monthly only — no annual discount, no non-profit/education pricing | same |

Gotchas: free tier's 100/day cap is a hard wall for order confirmations + notifications on a busy day; overage is $0.90/1K — cheap at small volume; transactional vs broadcast quotas are separate (broadcasts sent via /broadcasts don't count against the transactional quota). Note: already a dependency in the old repo's `api/` layer — the audit should verify which functions actually call it and whether keys are bound to a live domain.

## Cross-provider production-floor summary (2026-10-04)

| Provider free tier | Production-viable for a revenue shop? |
|---|---|
| Cloudflare Free | Yes, with caps — no sleep/pause/non-commercial clause; hard daily caps fail safe |
| Supabase Free | No — pauses after 1 week inactivity; floor is Pro (~$25–75/mo realistic) |
| Netlify Free | No — 300-credit hard cap pauses all projects mid-cycle |
| Vercel Hobby | No — non-commercial clause (verified) |
| Railway Free | No — $1/mo credit |
| Render Free | No — sleeps, Postgres expires in 30 days, explicit not-for-production |
| Coolify self-hosted | Viable later — $0 license, but you own ops |
| Resend Free (email) | Borderline — 3,000/mo with 100/day hard cap; fine for dev/staging, risky for production order volume; floor is Pro ($20/mo) |

_Next refresh due before any hosting contract or migration decision._
