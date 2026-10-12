# PPW Indie Affordability & Talent Liquidity — audit baseline
**Date:** 11 October 2026  
**Status:** Protected draft stacked on green PR #38 / CI #936. No merge, deployment, preview, or playable World reset.

## Why this audit exists

The rebuilt EXCLUSIVE, LIMITED_NON_EXCLUSIVE and ONE_OFF rules now establish credible pay, bookable paid weeks and remaining-date capacity. These are *correct contract mechanics*, not evidence that small promotions can afford enough wrestlers or that the shared market remains interesting after months of simulation.

A prior seven-seed creative audit measures whether indies can theoretically approach talent. It does **not** audit true payroll, signed recurring liabilities, promotion cash/runway or a complete credible offer's cost.

## Reproducible diagnostic

Command: `npm run build && npm run audit:indie-market`. CI runs it separately after the paired creative audit and saves `artifacts/indie-affordability-market-audit.json`. It leaves all production code and balance unchanged.

Cohorts: **four** procedurally generated Worlds (seeds 94101–94104) and **three** real-promotion / real-roster Worlds (94105–94107). Each is simulated normally for 52 PPW weeks; checkpoints at 0, 13, 26 and 52. The launch-eligible independent promotions identified at Genesis remain in every cohort's denominator even if a promotion later goes dormant. This avoids misleading survivor-only numbers.

**Finance indicators, per promotion:** remaining cash and debt, actual last-week net, reported cash runway, baseline media/sponsor receipts, overhead, signed active weekly guarantees, net recurring *before* events and expense-generating shows, static recurring-deficit runway, active contracted people, exclusive contracts, completed shows, status (active, distressed, dormant, etc.). An earnings-positive snapshot is a static baseline, not evidence of overall profitability.

**Market indicators, per promotion:** currently active wrestlers not already signed there, technical service-capacity eligibility for a standard four-date/13-week LIMITED_NON_EXCLUSIVE proposal, recognisable candidates (recognition 60+), hypothetical acceptance utility at/above normal acceptance threshold, and candidates the promotion could cover for the **full** 13-week incremental cash exposure (13 weekly guarantees + 4 appearance fees + signing bonus), without optimistic gate receipts or future borrowing. Also report cheapest such offer. A positive score only means *plausible* willingness: no actual offer is filed, no competing bid or last-minute condition is assumed and wrestler acceptance is **not** guaranteed.

**World-market indicators:** actually uncontracted active workers, employed non-exclusive, employed exclusive and wrestlers with two or more concurrently active promotion relationships. Distress, dormancy and inability to afford even one plausible offer appear as explicit watchlists rather than hidden in means.

## Fairness checks

- Simulation is the actual server-authoritative `resolveWorldWeek` path. No artificial online/player bonus, no synthetic cash injection, no new signed commitments and no salary rewrite.
- Eligibility uses the same `canAcceptContractTerms` and `evaluateContractOffer` models used by human and AI recruiters.
- Report separates available, plausibly interested and affordably hireable candidates. A market with 200 nominal workers may still have few viable options.
- Every World must pass the invariant checks and retain four complete snapshots, or the audit fails CI. **Economic warning flags do not fail CI**; they trigger review and decision-making rather than an untested global policy change.
- The baseline here reflects *AI-managed indie businesses plus their normal ecosystem*, not an actual simulated human's 20–30-week decision sequence. We must test player onboarding economics independently before treating these numbers as a final balance verdict.

## Decisions held until the report has evidence

1. Do not change start cash, sponsor or media income, wrestlers' market salaries, minimum exclusive pay, loan rules, AI roster targets or show guarantees on intuition.
2. First inspect extremes per seed as well as median: an Indie game must remain credible without making scarce name talent trivial to acquire.
3. If the main weakness is recurring deficits, isolate income/overhead/roster-size scenarios; if the weakness is affordability of individual offers, isolate signing/appearance fees and term length; if interest falls to zero, isolate accessibility and wrestler decision utility.
4. Compare 20–30 week **player-operated** runway using an actual authored show calendar and controlled roster as a distinct acceptance gate.
5. Track World generation cadence (1 real day = 1 PPW week) only where scheduling matters; this audit measures PPW weeks and does not change the canonical seven-day clock or World Lock.

## System dependencies

- Depends on current roster contracts, finance settlement, free agent/admission rules, AI scheduling and deterministic PPW year arithmetic.
- Future indie starts, recruitment guidance, staff and promotions' solvency depend on genuine market liquidity.
- Production World state is unchanged; report and its sampled projections are observation/presentation only.
- Smallest complete first implementation: a repeatable, two-cohort seven-seed audit with four checkpoints, explicit full-contract cash exposure and CI report retention.
