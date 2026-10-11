# PPW missed scheduled-day fairness — first complete safety wave

**Status:** CI-only draft based on PR #23; do not merge, deploy, reset or change cron schedules.

## Four PPW dependency checks

1. **Depends on:** shared UTC daily cycle keys, World Lock idempotency, activity and Stewardship timers, PostgreSQL World aggregate.
2. **Enables later:** reliable outage monitoring, operational notifications, fair compensation/resumption policy, multi-world operational tooling.
3. **Simulation versus presentation:** this is server-authoritative downtime accounting, not a calendar UI setting or a way to skip match simulation for a scheduled show.
4. **Smallest complete version:** a persisted span of *missed real scheduler dates*; one PPW-week resolution on recovery, without burst catch-up; excluded dates from inactivity, Stewardship exit and rival-buyout notice thresholds.

## What the new code guarantees

- If the previous resolved real-cycle key is **2026-10-01**, and the next successful scheduled resolver is **2026-10-12**, the skipped dates **October 2–11** are recorded once. October 12 is a real delivered cycle and counts normally.
- The shared World advances **one PPW week**, not eleven. A duplicate delivery or recovered persisted lock never duplicates pause credit, results or week advancement.
- Paused dates are excluded from human inactivity transitions (7-day warning, 14-day Stewardship) and from **already stewarded** promotion early-exit eligibility, voluntary/rival buyout notice periods, automatic release grace, and AI rival-buyout availability. A real owner returning to play does not lose earlier activity evidence, and a no-longer-Stewarded owner still closes exit routes normally.
- Existing World's engagement snapshot format is backwards-compatible: missing pause spans are treated as an empty collection. No synthetic logins or fake PPW weeks are introduced.
- A `SCHEDULER_MISSED_CYCLES_PROTECTED` World ledger event records the dates, number of skipped real days, and zero replayed weeks. A short player-facing World News notice explains the recovery.
- The clock is based on **UTC calendar days**, so GMT/BST changes do not create 23-/25-hour inactivity anomalies.

## Policy boundaries and known limitations

- A **new World with no earlier resolved real-cycle key** does not infer a pre-Genesis outage. It starts counting daily cycles once the first scheduled resolution exists.
- Only a **scheduled successful resolution** establishes missing-day history. Manual Advance Week is not a replacement for the real scheduler, and should not claim that a Vercel cron actually fired.
- This protects simulation-level inactivity/stewardship **from recorded gaps**; it does not guarantee Vercel calls arrive at their configured times or handle pauses occurring before the first ever scheduled resolution.
- No automatic multiweek catch-up. Real PPW events that never resolved are not conjured into history.
- Further operational monitoring could alert the operator after a missed day, and future game design may choose whether to offer explicit catch-up with warnings/fair participation; neither is enabled here.
- Contract rights, protected booking, Programme agreements, UI contract selections, merged release and fresh-world reset remain governed by their own rollout gates.

## Regressions added

A fixture World with a genuinely player-controlled promotion validates recovery after ten missed calendar days; one-week advancement; persisted/deduplicated pause spans; honest ledger record; no immediate Stewardship escalation; subsequent active-day count; grace/eligibility of established Stewardship contracts; and UTC/BST boundary accounting.

No production scheduler or cron changes are part of this PR.
