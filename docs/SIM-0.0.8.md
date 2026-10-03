# SIM-0.0.8 — Championships and Persistent Tag Teams

SIM-0.0.8 gives the wrestling World persistent competitive history rather than treating titles and tag pairings as disposable show-level details.

## Delivered

- Each operating promotion owns one persistent singles championship and one persistent tag championship.
- Championships maintain current holders, historical reigns, defenses, title changes, coronations and lineage state.
- Championship contests are linked to real completed matches rather than simulated as detached bookkeeping.
- Major events are guaranteed meaningful title activity when legal champions and challengers are available.
- Persistent `Team` and `TeamMembership` entities allow tag-team identity and history to survive individual events.
- A tag pairing becomes an established team after 20 matches together.
- Each wrestler can belong to at most one active primary tag team at a time; forming a replacement primary team retires the displaced one while preserving its history.
- Team and championship state participate in deterministic World diagnostics and invariant validation.

## Why this matters

The previous match engine could create tag matches and track chemistry, but the World did not remember a tag team as a wrestling entity and titles had no lineage. SIM-0.0.8 establishes the minimum persistent competitive structure needed for booking history, career achievements and future narrative systems.

## Decade validation

Standard and dedicated booking/competition tests established that a decade can support all 18 active championships across nine promotions, produce genuine defenses and title changes, and maintain a meaningful tag-team ecosystem without assigning the whole wrestler population to permanent teams.

## Known limitation carried into SIM-0.0.9

Persistence alone did not make the AI book like a wrestling promotion. Established teams could still churn too readily, title challengers could be selected without enough continuity, and ordinary matches had little memory of previous opponents or emerging pushes. SIM-0.0.9 therefore focuses on booking continuity rather than adding more championship types or deeper faction mechanics.
