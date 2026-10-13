# PPW Show Results — Wave 4A: Broadcast-first & Mobile Presentation Audit

13 October 2026. Draft stacked on PR #78. **No merge, release, Vercel deploy or World reset.**

## Audit findings
- Prior visual work supplies a factual show highlight reel, ratings, named cheating culprit, genuine match finishes, positive/negative crowd context and fully scripted segment outcomes. The underlying sim depth is already substantial.
- Yet the latest private show **led with net earnings**, then a large finance/stat grid and crowded contextual factors ahead of the match rundown. The opening read more like an operating report than the payoff for the user's week of booking.
- Three highlights received **equally weighted cards**, so championship changes, injuries and a minor spotlight looked visually alike. Generic `<segment type> caught fire` also made different on-screen moments sound repetitive.
- Match execution and Crowd Flow factors are valuable in a management game, but shouldn't compete visually with actual winners, named finishes or real title/injury consequences. Mobile has especially limited vertical space.
- A cryptic VIDEO_PACKAGE must not reveal its concealed subject in a highlight, and a cancelled live debut must never be represented as an actual debut. Preserve existing authoritative/public boundaries.

## Smallest complete presentation pass
1. **One headline of the night.** The highest-priority *factual existing* `showResultHighlights` candidate becomes a prominent lead moment with a jump to its actual slot. The remaining moments remain as compact cards. No extra narrative model, made-up action or changed ranking.
2. **Wrestling first, accounting on demand.** Private show list headline surfaces final crowd reaction rather than net profit. Financials, average rating, execution statistics, show crowd factor diagnostics remain accessible behind a summary labelled **Show analysis & economics**. Public shows can expand ratings/attendance diagnostics without exposing rival economics.
3. **Match outcomes stay visible.** Participants, winner, verified actual finish, post-show Programme choice, title retention/change and injuries remain in the main card. Technical match-style metrics and frozen crowd factor details sit behind **Match breakdown**, including the precise match crowd and duration in the summary.
4. **Exception visibility.** Cancelled debuts and returns remain visible immediately below the broadcast/analysis disclosure rather than hidden among optional metrics.
5. **Mobile ergonomics.** A single-column secondary reel on smaller screens, prominent typographic lead, 44px summary targets and semantic HTML `details` work without introducing auto-play or animations.
6. **Varied but truthful editorial.** Different HOT segment types get varied short wrestling headlines, grounded only by `outcomeBand=HOT`. Do not duplicate a real debut/turn with a generic 'hot angle'. A cryptic video is identified as mystery footage, not by the concealed performer.

## Four-question check
- **Depends on:** results/read-only projections, factual performance ledger, recent ShowBroadcast, existing `showResultHighlights` ranking, private and public Results.
- **Downstream:** subsequent crowd/fan Pulse text, future match reviews, TV-style framing and full mobile polish.
- **Simulation vs presentation:** zero simulation, popularity, Programme, contract, injury, rating, world clock or booking changes; all changes are presentation and pure highlight copy.
- **Smallest complete first version:** one compelling lead, compact secondary moments, optional analysis, exposed important warnings, headline variety/privacy and tests. No unsafe wholesale component rewrite.

## Regression / release gate
Existing owner/public fact parity, title/finish/injury/arrival rules, show history and crowd Story tests. New tests for category-distinct HOT headings, cryptic-video identity protection, no duplicate debut highlights. Full application, web build, HTTP/Postgres and long simulation CI on exact head. Leave PR stacked, unmerged and undeployed.

## Deliberately future work
- A true filmed show review or dynamic vernacular commentary, only if factual data supports it and repetition can be controlled.
- More varied on-screen snapshots and subtle effects after controlled mobile visual playtesting (avoiding excessive popups or tap fatigue).
- World timeline deeper filters/roundup; no new stateful UI service introduced in this pass.
