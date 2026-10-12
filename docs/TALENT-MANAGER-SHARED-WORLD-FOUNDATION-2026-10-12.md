# PPW — Shared-world Talent Manager, stage 1 (PR #48)
**12 October 2026 · Protected stacked draft after CI #960/PR #47. No merge, preview, deployment or saved World reset.**

## Design rule and responsibility
- Players personally choose **all initial wrestler signings**. No employee may recruit a new wrestler for the player.
- The Talent Manager's future retention task is to present a player-authorised same-terms renewal using the **existing** authenticated contract offer, preserving normal wrestler independence. A refusal or material counter returns to the player. No additional staff-driven simulation turns, wrestler power or acceptance multipliers.
- A staff member is a **unique World individual**, separate from wrestler People and from a promotion's UI. One active employment at a time across all promoters. A promotion holds at most one active manager of a role. That guarantee must hold at the authoritative server mutation, not merely in an app picker.
- Staff intelligence affects earlier warnings and administration, **not wrestler consent**. Basic manual contract renewal is always free and available without staff.

## First code slice in this draft
- WorldStaffMember and StaffEmployment definitions with cross-World and duplicate-employment checks.
- Deterministic fictional starter pool of eight globally shared candidates, independent of genesis wrestler RNG.
- v10 World-state persistence and no-hire neutral migration from v9: existing Worlds receive the pool without changing a contract, hiring staff or adding salary cost.
- A salaried ACTIVE employee incurs one itemised `STAFF_SALARY` expense per canonical PPW week; no invisible budget bonuses. The staff pool alone costs nothing.
- Full-suite staff tests cover shared uniqueness, neutral migrations and financial charges.

## Stage 2, before PR #48 can be described as feature-complete
- Authenticated manager hire / release with transactions and idempotency. Financial viability, simultaneous applicants and one-person/one-role constraints checked again during the **server transaction**.
- Player-private staff view and a compact Talent Manager section, with a clear staff salary and current vacancy.
- Explicit "attempt renewal on existing terms" authorisation delegated to a hired active manager: a *single* server-provided default proposal from PR #47; no hidden changed terms or recruitment authority.
- Staff outcomes route through existing PENDING/ACCEPTED/REJECTED wrestler negotiation and normal World Lock. Persist the authorisation provenance; no duplicate offers on retry.
- Optional messages for expiry and refused offers, with the player deciding any substantive counter. No auto-renew standing orders in the smallest first version.

## Four mantra checks
1. **Depends on:** PR #47 standing-terms helper, shared contract offer/resolver, one-controller ownership, World locking, canonical cash ledger.
2. **Future dependants:** Road agents, doctors and staff roles later share unique identity/employment/payroll; Backstage text-message presentation may display renewals.
3. **State versus presentation:** Staff identity, employment, salary and approved commands live in authoritative World/application state; UI is a scoped read-only projection.
4. **Smallest complete first version:** One hireable Talent Manager with explicit authorisation for one same-terms renewal; independent wrestler response; no staff bonuses.

## Release gates
Do not claim implementation complete based on data model alone. Check database round trips, multi-player contention, duplicate employment, full seven-day scheduling, cash attribution, 26-week Indies, and decade World invariants. UI should remain lightweight, legible on mobile and not force manual players to hire staff.
