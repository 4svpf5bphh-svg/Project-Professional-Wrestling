# PR #50 — Consolidated release readiness / controlled Alpha cutover
**12 October 2026 · Protected stacked draft · No merge, Vercel preview, production deployment, cron edit or saved-World reset authorised.**

## Scope and exact ancestry
- Working baseline: `main` at `07d5fee4334550fc7b0304168032ecfe98676cfb` when reviewed.
- Drafts #46 `ce122566`, #47 `f392c231`, #48 `55ed93f5`, #49 `fee54809` form a **linear ancestor chain**; every pair was GitHub-compared ahead-only / behind 0. The original long-standing stacked base through #45 is included in #46; #46 was 267 commits ahead of `main` at this audit. Do **not** merge each branch independently as if changes are disjoint, or cherry-pick their full GitHub PR diffs blindly.
- The release candidate should be the **single tested stack tip**, retargeted/merged with an explicit review of actual `main..head` commits/files and a final CI at the exact release head. Draft branches should be closed/recorded as incorporated *after* confirming the final merge, never before.
- Repo default branch may be `alpha-1a`; the stacked work and PRs currently target **`main`**. Verify the Vercel Git production branch, domain, database and relevant preview protection separately; do not infer a deploy merely from a green GitHub workflow.

## Verified automated coverage
- Prior CI: #958 (Show Card day availability), #960 (user authorises same-terms renewals), #979 (hire/delegate/release/staff outcome), #981 (26-week manager economics, Insight advice, authoritative renewal terms).
- PR #50 adds `test:release-readiness`: v9→v10 migration with contracts/cash intact; seed-separated new playtest World without destructive reset; one connected player journey including event card reservations, manual recruitment, manager hire and approved same-terms renewal, and next World Lock outcome. All old suites remain active: Backstage, human bookings, game economy, HTTP, PostgreSQL, long-horizon simulations.
- The v9→v10 migration **adds a neutral staff pool and zero employees**. It deliberately does **not** upgrade the economic/legal meaning of existing contracts, compensate old roster terms or rewrite historical dates.

## Deployment and fresh-World runbook — executable only after separate owner approval
1. **Freeze and record:** stop authoring changes on the eventual release head, confirm CI hash and current `main` hash; check for unrelated `main` changes since the ancestry audit. Check Vercel deployment protection and quota before performing any deployment.
2. **Back up and audit** the persistent PostgreSQL World row(s) and associated ownership/runtime/planning/engagement/commands **at a consistent database snapshot**, plus relevant Vercel production environment configuration. Record original World ID, seed, PPW date, schema versions, revision, cash and roster counts. Have a tested restore route. Do not delete/recreate the database.
3. **Crons**: `vercel.json` schedules commitment lock at **06:00 UTC daily** and World resolution at **08:00 UTC daily**, seven days per week, with `CRON_SECRET` authentication. For cutover avoid conflicting cron traffic. The scheduler remains the single canonical World Lock; a second deployment/preview must never double-resolve or mutate production.
4. **Choose new seed and retain archive**: `PPW_ALPHA_WORLD_SEED` selects `world-<seed>`; changing it points the server to a **different**, initially absent World row. The old World is not deleted. Use a unique, explicitly agreed numeric seed and a separate playtest name. Note that the server caches the initial bootstrap in-process, so a seed change requires a controlled new runtime, not a hot-reload assumption.
5. **Player identity**: `PPW_ALPHA_PLAYER_ID` is a fixed configured server player in current Alpha. New World's controller starts as unclaimed and player claims the chosen Indie through the UI. Do not accidentally reuse another person's identity or claim. Preserve `DATABASE_URL` and `CRON_SECRET` correctly.
6. **Deploy just once after approval**, from the reviewed release ref, avoiding the disabled `work/**` preview branches. Verify deployed commit hash, database connectivity, first bootstrap, World ID/year/week, staff vacancies, roster/contract terms and new booking rights **before** the next scheduled resolution.
7. **Smoke-test** the actual app via iPhone/PWA if desired: take over Indie, inspect Talent roster and availability, book a full Show Card, offer a new free-agent contract manually, hire/release staff, authorise one same-terms renewal, check pending offer, advance at canonical lock, verify result/financial transaction and save/reopen. The regular player's experience must remain easy to understand without staff.
8. **Rollback** by reverting the deployed commit/config to the previous verified release and selecting the archived World ID/seed if needed, **only after verifying schema backward compatibility**. Do not assume old code can read v10 snapshots; restoring backed-up data may be required. Do not treat a Vercel rollback alone as a database rollback.

## Release gates and honest limitations
- Current web Alpha starts a **single** human membership/seat and retrieves one configured `PPW_ALPHA_PLAYER_ID` on the server. There is extensive multi-controller/shared-world *simulation* testing, but genuine two-player login, seats, authentication and joining the same deployed World have **not** been delivered. This cutover is a single-user Alpha playtest, not a live multiplayer test.
- `work/**` Git deployment is disabled in `vercel.json`. A GitHub green run does not establish production deploy health, correct environment variables, or PWA behaviour on device.
- Talent Manager results currently accept/reject; no formal wrestler counter-offer or manager standing instructions. Do not imply counters can be accepted.
- A fresh World is preferred for playtest fairness following contract changes; old World remains available for backup/audit but its prior contracts are **not automatically normalised** by migration.
- No player action can override 7-day availability, other promotions' commitments, World Lock, service capacity, contract creative consent, or shared-World staff uniqueness.

## Four design mantra questions
1. **Dependencies:** full stacked baseline, schema v10 and persisted application schema v2, World Lock and cron, authenticated/player-scoped commands, seven-day booking/financial ledger.
2. **Future dependants:** actual many-player sign-in/join fairness, live staff employment between human-controlled promotions, doctors and agents, counteroffer workflow, archive/rollback tooling.
3. **State vs presentation:** saved Worlds, command receipts, pending offers, calendars, company cash and runtime are authoritative; staff advice and UI labels are projections; configuration changes select Worlds but do not themselves resolve game weeks.
4. **Smallest complete first version:** prove ancestry, snapshots and one real player journey, document a **non-destructive** fresh-World cutover and test key flows. No premature staff systems or auto-deploy.
