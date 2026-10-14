# PPW development roadmap — locked 2026-10-14

Status: agreed baseline. Do not reorder or expand the roadmap without a demonstrated blocker, regression, or explicit player decision. Preserve existing World saves and recovery branches.

## Non-negotiable engineering rules
- Server-authoritative shared World; World Lock canonical; asynchronous fairness. Being online grants choice, never extra simulation power.
- Wrestling outcomes are player-authored. Simulation evaluates delivery and consequences, not scripted winners, attacks, turns or reconciliations.
- TEW simulation depth underneath, EWR accessibility on top; mobile-first.
- For each major feature: dependencies in, dependencies out, simulation/application state versus presentation, smallest complete first version.
- Kayfabe Points are non-competitive, earned account-level collection/progression only; never buy simulation advantages.
- **No automatic production release for each development PR.** Keep work on feature branches, validate with GitHub CI, batch release after integration, regression and mobile checks, and verify Vercel rolling 24-hour deployment allowance. Exception only for a genuine production/data-integrity blocker with approval.
- Never reset a live World or delete Neon recovery/preview branches as an optimisation without explicit approval.

## Ordered work
0. **Stability / Neon:** consumption and read-cost investigation; deployment discipline; data-integrity and lock regression tests.
1. **Contracts & Talent:** consolidate Contracts and Offers; current terms and extra-date cost clarity; mobile input sizing; remove redundant roster links; working deep links; bounded Talent Manager delegation; renewal, expiry and exclusivity tests.
2. **Booking / Creative:** mobile card builder; richer non-repetitive segment purposes, participants and outcomes; programmes, relationships, gimmicks, teams, stables, calendar/A-B shows and consequences.
3. **Results / Staff:** distinctive Results broadcast presentation; richer deterministic fallback; AI prose only for human-controlled promotions; Road Agent/Doctor and staff paragraph critiques instead of raw context tables.
4. **Living World / Backstage:** phone-style talent messages, proposals, morale, disputes, injuries, career development and organic teams.
5. **Business:** broadcasting, streaming, sponsorship, finances, venues, promotion growth and AI strategy.
6. **Multiplayer validation:** two human promotions, simultaneous offers, conflicts, privacy, deadlines and fair resolution; architecture remains multiplayer-first throughout.
7. **Polish / Progression:** full UI/UX audit, world news and fan reactions, awards, achievements, history, Kayfabe Points and collections.

## Release gate
No merge to production main until an intentionally grouped release passes application, persistence, HTTP, World Lock, multiplayer and mobile-flow checks. Verify deployment READY; do not assume merge means live. Track Neon compute/transfer before and after optimisation; do not claim savings without measurement.

## Latest user playtest findings
- Results lack wrestling personality and distinct green/broadcast identity; staff critiques should replace raw context tables later.
- Contracts/Offers overlap; extra-date amendment UI is oversized and misleading about extra payment versus existing weekly guarantee and appearance fee.
- Talent Manager should eventually handle routine amendments under player-approved limits.
- Remove 'manage contract' and 'talent manager' redundant roster links; preserve working Home deep links.
