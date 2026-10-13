# PPW Results Wave 3C — Player-authored story direction in Card

13 October 2026. Draft stacked directly on PR #77. No merge, deploy or World reset.

## Existing system audit
- PR #77 stores optional owner-authored choices in application planning state, not simulation state; Results and Programmes already display them.
- Card already has explicit Programme selectors for matches and segments, but did not display these choices while a player decides what to book.
- Card's own stable-story continuity hints and segment story-goal menu are already advisory. This uses the same approach, not a rival booking workflow.
- No reason to create new Programme heat, contract reservations, talent booking, match outcomes or mandatory decisions. The authoritative World remains multiplayer-first and advances without login-based bonuses.

## First complete Wave 3C slice
- Decorate **owner-only active Programme Card projections** with their latest post-show direction and provenance from planning state.
- Alongside a *manually selected* Programme in match/segment editors, show meaningful contextual advice:
  - Pursue rematch: reconsider the original opponent, actual availability and consent; optionally use a challenge/confrontation. A scripted acceptance does not create a match.
  - Plan retaliation: optionally book an attack, confrontation or promo, including explicit performer/target/outcome choices. This is not pre-filled.
  - Let stand: nothing is required; the feud does not end automatically.
- A newer **completed** Programme MATCH or SEGMENT after the note changes the banner to **Earlier story direction** rather than claiming that the note was fulfilled. Same-day activity cannot inadvertently satisfy a note just written after a show.
- Programme management links to the existing Card editor. No auto-inserted match, segment, contract, venue booking, advance-week, reminder deadline or forced pop-up.
- Reads strictly from the controlling promotion's saved notes. Other promotions' private planning information cannot appear.
- A pure derived adapter includes unit regression tests for latest choice, cross-promotion isolation, contextual wording, later completed beat and no mutation.

## PPW four questions
1. **Depends on:** PR #77 post-show planning notes, active Programme projection, Card's existing match/segment selectors, completed Programme activities.
2. **Later depends on:** a player-optional explicit "use this as inspiration" action, reminders in Home/Desk (only if chosen), continuity-aware recap and social commentary.
3. **Authority vs presentation:** authoritative notes remain in the persistent World; Card simply projects advice. Authoring matches/segments and scripted outcomes is always the existing manual workflow.
4. **Smallest complete first version:** contextual hints where the user books, plus navigation, sensible stale-note handling and tests. No new persistence or simulator edits.

## Verification gate
Full CI on exact branch head: tests, Programme/Show Flow regressions, web build, HTTP, PostgreSQL, long simulations. Leave as draft stacked on #77, no release.

**Verification trigger:** The PR briefly targets main solely to launch the existing full GitHub CI; restore stacked parent #77 after the check starts. No merging or deployment.
