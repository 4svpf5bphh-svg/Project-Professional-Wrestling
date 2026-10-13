# Celebration Segment: Reality, Kayfabe and Booked Endings
13 October 2026 — draft only, stacked on #66. Do not merge, deploy or reset a World.

## Player choices

One existing CELEBRATION type, not sixteen near-duplicate angles.

**Occasion**:
- **Fan appreciation** — wrestler thanks or acknowledges the crowd; no fabricated achievement.
- **Self-coronation** — explicitly a kayfabe claim/boast; never creates a championship or real historical win.
- **Rivalry taunt** — draws on Programme heat where genuinely linked, but can be booked cold.
- **Victory lap** — a real completed recent win in this promotion, not a scripted future winner.

**Ending**: salute the crowd, strike a pose, taunt rivals, or walk off. These are exact promoter-authored on-screen decisions. No random brawl, championship award, injury or feud switch is invented.

The compact Card exposes occasion and ending. Existing legacy celebrations with neither field remain valid without rewriting old shows or introducing fictional historic finishes.

## Evidence and multiplayer rules

The shared server-side evidence helper in `packages/application/src/celebration-evidence.ts` is used at BOTH the app planning layer and the Card service boundary. For VICTORY_LAP:
- Resolve real **completed matches on completed shows**; verify the **actual** winner side and wrestler results.
- Require **every featured wrestler** to have won on the same real completed match. Losers and unaccompanied guests cannot be counted as victors.
- Use only prior event dates (including earlier day in same PPW week), a six PPW week lookback, and the promotion whose show is being booked.
- Disregard current scheduled shows, intended winners, unfinished matches, another promotion's results and old victories.
- At show resolution, the evidence consists of immutable prior history, so an already-completed victory cannot disappear because of a later title transfer.
- Neither being online nor booking sooner grants a performance bonus or additional simulation power.

We deliberately **do not offer title-specific celebration occasions yet**. Truthful championship ceremonies need authoritative reign/contest evidence and careful handling of a champion losing the belt between advance booking and World Lock. A player's kayfabe self-coronation must never implicitly make them champion.

## Reception and repetition

Celebration occasion and scripted ending feed a modest deterministic reception modifier (alignment and feud context). Exact same performer+occasion+ending repeated in the same promotion in the prior six PPW weeks gets a capped penalty. Only **actual completed segment ledger** contributes; other performers, promotions, different endings/occasions, pending drafts and old history do not. The simulation scores reception without rewriting intent.

Private and public factual Show Results show the originally scripted and actually performed ending. No new title data or injury records are created.

## Four dependency questions

1. **Depends on:** typed Show Card segments, match and event completion, actual winner ledger/state, wrestler alignment, Programme links.
2. **Later depends on this:** title ceremonies with proven title history, story variety and anti-repeat memory, larger theatrical Show Results redesign.
3. **Authority versus UI:** server-side occasion, ending and completed-win proof are authoritative; labels, card buttons, prose and styling are presentation.
4. **Smallest complete first pass:** four occasions, four actual endings, hard proof for victory laps, compatible legacy read, frozen Results, scoped capped repeat penalty, and regression checks. No changes to contract semantics, state schema or World scheduler.

## Tests and follow-ups

Application regressions: win proof rejects intended-only, unfinished, defeated, unrelated and old history; allows real prior completed winner. Celebration preserves authored text and avoids creating a title reign, with no duplicates; repeated same outcome is penalized only when earned. Web Card regression: save/reload and false win rejection leave existing script untouched. Results regression: private and public views agree on performed ceremony.

Next: **Confrontations and aftermath segments**, beginning with clearly scripted non-overlapping endings and a short audit of where existing Attack/Interruption/Rescue semantics already suffice. Keep the full Results visual overhaul separately after segment logic is robust.

CI must run on this draft's actual latest head; green parent #66 CI #1013 does not verify this branch.
