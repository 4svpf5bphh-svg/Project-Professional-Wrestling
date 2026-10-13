# PPW — Show Results Broadcast Highlight Reel (Visual Wave 1)
13 October 2026. Draft stacked above #72. No merge, production preview, migration, contract work or World reset.

## The goal

**The result is the payoff.** Booking should feel like producing an actual wrestling show, not reading a list of plain grey records. But dramatic presentation must never invent events, outcomes, crowd changes, crowd consensus, match finishes, wrestler appearances, a new winner, injuries, or a real championship change.

Wave 1 changes **presentation only**, on both the private promotion history and public World Results.

- A responsive broadcast replay stage with marquee crowd response, real best-bout stars and average, and a graphic (clamped) crowd meter. Values come from completed events, not a new model.
- Up to three fact-checked key moments at the top of an open show. Each is a clickable anchor to that precise completed slot: title change, in-person debut/return/surprise, injury, real face/heel turn, the actual best-rated match, or a recorded HOT crowd reaction to an angle.
- Factual consequences can each be shown even when they happened during the same match (a title change, an injury and a standout star rating are genuinely different facts). Highlights are deterministically ordered by significance and actual slot chronology.
- Distinct dark wrestling-broadcast accents: championship gold; injury rose; live arrivals and hot angles violet; main events gold; ordinary matches teal. Real segment types have compact visual glyphs, and match rating receives a legible star medallion.
- Works on narrow-screen / iPhone: the 3-card highlight reel collapses to one column, no hover-only interaction, keyboard-focusable links, reduced-motion handling, large numerical scores.
- **No private rival information** is brought into World Results; both views use their existing public/private projections and identical pure deterministic presentation logic.
- A cancelled arrival produces no `SHOW_SEGMENT_COMPLETED` live segment, therefore it is NEVER celebrated as a performed debut or return. A match with no declared winner does not invent one. No new fictitious headlines, fabricated feuds, changes to scores, contracts, injuries or match outcomes.

## Four dependency questions

1. **Depends on:** immutable completed match/event results, title contests, actual injuries, real live-arrival segment ledger, resolved crowd bands and World Results privacy projection.
2. **What later depends on this:** dramatic match-finish panels, showcase full-screen immediate post-show experience, graphed crowd reaction across running order, original wrestling-language recap headlines and curated press, reusable recap components for Pulse/News, and visual polish of all game areas.
3. **Simulation vs presentation:** source data, crowd rating, finish, winner, title and injury are authority-side; highlight rank, glyph, CSS, colour and optional navigation are presentation only.
4. **Smallest complete first pass:** two screens share a broadcast headline reel; recognisable match/angle hierarchy; actual-time deep links; semantic accessibility; regressions for factual priority and owner/world parity; full CI. Do not redesign simulator, rewrite historic schemas, or make up a commentator quote.

## Design limitations / next carefully scoped waves

- **Finished match type and outcome/actual finish**: the Results views show winner, style delivery and injuries, but do not currently project every actually performed finish method (pin, submission, injury stoppage, etc.). Do NOT claim these in recap copy until match-result authority is audited. A separate next slice should map actual authoritative finishes into safe, rich match-finish storytelling.
- **Immediate post-show payoff**: the current Results & History screen remains a collapsible history view; avoid modal collisions or hijacking Advance Week until a dedicated immediate-results flow is explicitly designed and tested.
- **Public info boundary**: World Results cannot surface rival ticket revenue, budget, private injury/condition, planned goals, creative consent, booking drafts or backstage messages. Only actually performed/public wrestling history.
- **No new generic repeated AI reviews or fictional narrative engine**. If later headlines are generated, they must be strictly grounded in frozen results and anti-repeat logic.

## Verification

Application regression tests cover actual title change, injury, correct top-rated winner, owner/public parity, no guessed winner, actual performed debut and no cancelled-debut headline. The entire application, web, HTTP, PostgreSQL, World Lock and 10-year simulation CI must pass on this exact draft, then restore the stacked base above #72.

No deployment or reset.
