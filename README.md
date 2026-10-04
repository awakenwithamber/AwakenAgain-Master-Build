# AwakenAgain-Master-Build

Canonical technical source of truth for **AwakenAgain.com** — Amber's Alchemy Apothecary, Living Grimoire, and the AWAKEN digital ecosystem.

**Status: MIGRATION 0 — freeze truth. No production changes.** This repository is being built as the clean canonical home. The previous repository (`awakenwithamber/ambers-alchemy-apothecary`) remains the frozen reference until verified pieces are migrated here.

## Structure

| Path | Purpose |
|---|---|
| `apps/web` | Canonical frontend application (to be determined by audit) |
| `database` | Postgres schemas, migrations, RLS policies, functions, seeds |
| `docs` | Versioned documentation: requirements, architecture, audit output |
| `docs/infrastructure` | Hosting economics, deployment docs (verified, dated) |
| `infrastructure` | DNS, CDN/edge, environment and deployment configuration |
| `tests` | Unit, integration, end-to-end, accessibility, security tests |

Additional top-level directories (`agents`, `services`, `packages`, `monitoring`, `integrations`) are added only when real implementation requires them — not for appearance.

## Canonical homes

- **Code:** this repository (GitHub)
- **Structured data:** Postgres (Supabase where operationally useful, behind portable interfaces)
- **Product truth:** one canonical product dataset (to be established; exports generated, never maintained)
- **Documents/assets:** Google Drive (workspace, not truth — newest verified requirements win)
- **Runtime truth:** the deployment environment · **DNS truth:** the DNS provider

## Rules

- Statuses: IDEA / DOCUMENTED / GENERATED / IN DEVELOPMENT / BUILT / CONNECTED / TESTED / STAGED / DEPLOYED / VERIFIED. Never upgrade without evidence.
- Requirements: CURRENT / SUPERSEDED / NEEDS VERIFICATION / PROPOSED / IMPLEMENTED / BROKEN / BLOCKED. Never PROPOSED → CURRENT without Amber's approval.
- No blind migrations: AUDIT → MAP → BACKUP → TEST → PREVIEW → VALIDATE → APPROVE → DEPLOY → VERIFY → MONITOR.
- Secrets never live in this repository. See `.gitignore` and platform secret stores.

## Current phase

See `docs/AUDIT_CHECKLIST.md` — the 15-question audit that must complete before any migration or rebuild begins.
