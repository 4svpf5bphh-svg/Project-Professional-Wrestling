# SIM-0.0.5 Match Engine, Workload & Injuries

This milestone turns live events into actual wrestling cards and begins persistent physical/career consequences.

## Included
- Real match entities inside completed events.
- Singles and tag matches using side-based MatchParticipant records.
- AI booking intent, planned length and intended winner.
- Match intents: competitive, showcase, dominant, technical, high-risk, story, protective and epic.
- Separate execution quality, visible star rating and crowd response outputs.
- Booked finishes remain authoritative except when a serious in-match injury forces a change.
- Persistent singles/tag working chemistry with hidden compatibility and growing familiarity.
- Match fatigue and long-term Wear.
- Weekly fatigue recovery driven partly by stamina.
- Injury incidents with minor, moderate, major and severe severity bands.
- Accelerated PPW recovery windows; injured wrestlers become unavailable until cleared.
- Earlier-week injuries can invalidate later-week scheduled appearances.
- Match results feed momentum, with very small popularity movement for exceptional crowd reactions.
- Event summaries now store match count, average rating, best-match rating and crowd response.
- Wrestling quality has a modest effect on market strength after the show.
- Ledger history for matches, injuries and returns.
- Ledger ID allocation fixed so multiple subsystems can safely append during one event resolution.
- Validator indexing prevents historical integrity checks from becoming O(history²).

## Standard-seed decade diagnostic
Seed `20261002`, 520 PPW weeks:

- 3,119 completed events.
- 16,594 completed matches.
- 13,298 singles matches.
- 3,296 tag matches.
- 3.27★ average match rating.
- 1,201 matches rated 4★ or above (~7.2%).
- 120 matches rated 4.75★ or above (~0.7%).
- 158 injuries across roughly 40,000 wrestler appearances.
- 101 minor, 40 moderate, 16 major and 1 severe injury.
- 9 booked finishes changed because the intended winning side suffered a major/severe in-match injury.
- 3,327 persistent chemistry records discovered through actual matches.
- 0 invariant failures.
- Roughly 4.5 seconds for the full 520-week resolution plus validation in the current test environment.

## Deliberate limitations
- Tag matches currently create temporary sides; persistent named tag-team entities arrive with the team/title layer.
- There are no championships yet, so match stakes are based on event importance and wrestler state rather than title context.
- No full storyline heat or promo/segment engine yet.
- No wrestler skill development or age-related decline yet; Wear is accumulating now so those systems can consume real history later.
- Medical spending, doctors/surgeons and recovery-risk choices remain deferred.
- AI chooses simple intended winners rather than managing long-term pushes/programmes.

## Balance note
The initial implementation produced too many 4★ matches. The rating curve was deliberately tightened so 4★ means something across the whole World rather than functioning as the default for competent wrestling.
