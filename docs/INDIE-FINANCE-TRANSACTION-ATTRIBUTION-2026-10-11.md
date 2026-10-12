# PPW Indie Finance: Transaction & Event Attribution
**Date:** 11 October 2026
**Status:** protected draft stacked after PR #39 / green CI #937. No preview, merge, deployment, or saved World reset.

## Purpose

The existing seven-World indie audit found **12 of 31 starting independent promotions unable to fund one plausible 13-week four-date recruitment** by Week 52, despite a sizable technical supply of wrestlers. This may arise from recurring operating deficits, unprofitable show economics, one-off signing/payout expenses, or some combination. We cannot responsibly tune wages, initial cash, sponsor income or ticket pricing without distinguishing the causes.

## Accounting method — no production simulation changes

This extends the existing `npm run audit:indie-market` script, using exactly the same **four generated** plus **three real-roster** Worlds, 52 canonical PPW weeks and four checkpoints (Genesis/13/26/52).

For every original player-eligible indie, record Genesis cash **after creation**, then aggregate every financial transaction posted after that Genesis snapshot through each checkpoint. Split into:
- **Recurring operating**: media and sponsor income, fixed overhead, contracted weekly guarantees.
- **Show operating**: ticket gate, venue hire, production, travel, paid appearances.
- **Other obligations**: signing bonuses, buyouts and restructuring settlements.

Two independent reconciliation tests apply at every checkpoint and every original indie (including distressed/dormant):  
1. `current cash - Genesis cash == sum(post-Genesis financial transactions)`  
2. `sum(show-related transactions) == sum(completed event netResults)`

A material discrepancy is an **accounting integrity release blocker**, unlike a negative profit figure, which remains a **non-fatal balance diagnostic**. No extra spending, contracts, show scheduling or RNG calls occur in the audit.

For the cohort, print **non-overlapping incremental periods** 1–13, 14–26 and 27–52. Show category-level totals and subtotals of recurring and show activity, completed and cancelled event counts, average contribution per completed event, and the three least cash-rich promoters at each checkpoint. Keep the full JSON snapshot and artifact for review.

## Initial observations from PR #39

| At 52 PPW weeks | Generated indie businesses (16) | Real-roster indie businesses (15) |
|---|---:|---:|
| Median closing cash (across every indie) | $436k | $2.27m |
| Median weekly signed guarantee payroll | $41k | $61k |
| Median weekly recurring deficit before shows | $24k | $45k |
| Cash <= 0 | 7 | 2 |
| Unable to fund one plausible, complete 13-week non-exclusive deal | 8 | 4 |

All 31 had at least one viable complete offer at Genesis. This reinforces the need to diagnose cashflow, **not** simply make recruitment cheaper by fiat. Simulation currency is **USD**.

## Decision boundaries

- Do not confuse a calendar-weekly operating deficit with the full net result including gate revenue. Likewise, a financially positive show does not guarantee the promotion covers full-time payroll.
- Do not treat AI-managed starting indies as proof that a human player's first 20–30 authored weeks are playable. After income/cost attribution, run a **distinct real human-controlled, completed-show booking experiment** using current application commands/World Lock.
- No production pay, contract restrictions, staff behaviour, survival restructuring, cash, venue-price or attendance changes in this PR.
- Do not merge/deploy or reset the user's active test World; changes stay stacked as independent protected drafts.

## Dependencies

Depends on canonical financial transaction ledger, event netResult and existing seven-World Genesis-to-Week-52 simulation. Future affordability tuning, cash runway, venue advice, player business dashboards and human indie onboarding depend on causal accounting. The smallest complete version is pure reporting plus exact ledger reconciliation. No new sim power or online-timing advantage.
