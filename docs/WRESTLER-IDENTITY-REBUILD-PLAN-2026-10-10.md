# PPW — portable wrestler identities, gimmicks and move libraries
Planning decision (10 October 2026). **Implement only after the current wrestler-relationship/consequences wave is finished and tested.** This document authorises no production release or gameplay changes.

## Why the first pass is insufficient
- Initial gimmick editor has only broad archetypes and an unnecessary free-text description. Every existing wrestler defaults to AUTHENTIC, which loses recognition of real-life characters.
- Signature/finishing moves default blank instead of preserving known real-world names.
- Editing is awkward to reach from *your own Roster*, despite being available through the wrestler directory.
- The first version stores almost everything as a promotion-scoped presentation. Wrestling identities generally follow the wrestler's career across promotions, with rarer deliberate rebrands and aliases—not unrelated simultaneous characters by default.
- Instant unopposed editing ignores character attachment, momentum, creative influence and wrestler response.

## Locked revised design
1. **The wrestler owns the portable identity.** Shared World person record has an active named persona/gimmick, historical personas, primary/secondary in-ring styles, recognised signature move(s) and finisher(s). Each wrestler exists once in the shared World. Their normal look/identity carries between promotions. Neither signing nor changing promotions automatically resets them. Historical era/alternate identities are represented as explicit versions, not simultaneous randomly different personas. Support multiple moves and aliases by era.
2. **A comprehensive curated gimmick catalogue**, with many distinct wrestling-history/current-day-inspired categories and useful variants (hero/heel can coexist with gimmick; alignment is not the gimmick). Each template has a fixed, authored description; **no free-text gimmick description field**. A wrestler also has a named persona such as a particular on-screen identity, not merely an archetype. Avoid arbitrary synonyms or handing one performer's recognisable unique persona to unrelated wrestlers. The player selects from visual cards, searchable/filterable by type and suitable role—not grey dropdowns.
3. **Curate real roster identities and real moves.** Replace uniform AUTHENTIC defaults through wrestler-specific research/citation/provenance. Fill accurate recognised signature and finishing moves, including renamed, alternative, era-specific and multi-finisher variants. Never invent a historical move name to conceal missing research; track incomplete records for audit. Cover the entire roster, not just marquee stars, in verified batches. Where information is genuinely undocumented, flag as needing editorial curation rather than asserting a fake canonical move. Historical lists and active variants require versioning.
4. **Editing from *your own Roster* is essential.** Direct link to a character-focused editor from each owned roster wrestler/profile; wrestler directory remains informational/navigation. Both route to same authoritative edit action when the booker has control. Normal viewing must expose recognisable persona and moves to all permitted viewers without leaking private negotiations.
5. **Major changes are high-stakes creative negotiations.** Player selects/proposes an exact new gimmick. A wrestler's *fictional in-game* attachment to the current character is based on longevity, recognition, demonstrated success, relevant contractual creative control and personality/preferences. The booker can negotiate an accepted switch, abandon it, or deliberately attempt a forced repackaging if contracts permit; consequences can include character disconnect and promotion-scoped trust/morale/relationship costs. No arbitrary automatic switches and no random acceptance that rewrites scripted wrestling. Do not treat simulated personal wishes as factual real-life psychology.
6. **Shared-world portability and multiplayer fairness.** A rebrand agreed under a promotion can create a portable new version of that wrestler's career identity. A short-lived local presentation/alias may stay promotion-scoped when explicitly chosen, but this must be labelled an exception; it must not overwrite the shared person's canonical identity or secretly alter another promotion's shows. Non-exclusive workers require conflict/consent handling; one booker must not unilaterally change another booker's active portrayal. Stable server-side ownership checks, World Lock persistence, history and privacy remain mandatory.
7. **Moves are canonical repertoire before they are booking mechanics.** Signature and finisher names are used later by factual/AI result narration only when consistent with an actual authored match/finish, and are not AI-chosen results. Promotion-specific move aliases and temporary bans may be useful later. Preserve historical versions so old match reports aren't retroactively rewritten.
8. **Style distinction**: baseline wrestling style is a believable wrestler-wide trait, not something automatically rewritten when a gimmick is edited. Presentation can emphasise it but must not confer immediate stat bonuses. Curate against known wrestlers rather than treating a seeded estimate as verified fact.

## Dependency questions
- **Depends on:** Person and promotions; existing promotion-specific creative editor/history; roster pages; Backstage dialogue/pitches; contractual creative preferences/trust; relationship consequences; multi-promotion booking; existing alignment and deterministic match engine.
- **Future consumers:** AI-written result packets, correct named finishes and entrances; gimmick-switch Backstage negotiations, career arcs, crowd identity recognition, promotion news, records and wrestler histories.
- **Simulation vs presentation:** Portable identity/history and a negotiated creative change are authoritative state. Template descriptions, picker cards, filters, public bio text and narrated lines are presentation. Any resistance/confidence impact belongs in separately tested booking/consequence mechanics, never in AI prose.
- **Smallest complete first version:** Catalog with meaningful breadth, curated active identity and at least one verified finisher/signature where sourced per existing wrestler, direct edit from Roster, portable person-level history, consent-aware proposal/response and clear preview of risks, authoritative save/reload, zero unsolicited mutations. Only then expand alternate eras, move-specific animations, advanced psychology, promo voice and AI result usage.

## Delivery order (after relationship wave)
A. Schema audit, migration strategy and preserve existing player edits (promotion-local v1 fields must not vanish).
B. Catalogue and researched canonical roster data, with provenance and completeness audit; no invented moves.
C. Roster/profile navigation and searchable card picker; remove free-text description; show canon vs variant explicitly.
D. Player-authored creative switch request with risk preview, creative attachment and contractual rights, mutually consistent shared-world writes; no sim/scripted outcome powers.
E. Regression and balance: old save restoration, existing changes migration, non-exclusive cross-promotion bookings, stable history, reasonable refusals, repeated actions/idempotency, long-run simulations and actual HTTP editing.
F. One review/play-test batch only when the user explicitly authorises deployment. **Do not merge to main or deploy on development continuation.**

## Deferred, deliberately
Entrance production, elaborate mic scripts, mechanical finisher ratings/counter sequences, AI result prose, production polish beyond direct Roster editor, and commercial-use personality/likeness rights review.

## Development checkpoint — World schema v9, identity foundations

This is the first **non-deployed** coding increment after the relationship
wave. It establishes a validated `wrestlerIdentities` World collection keyed
by person (one active portable persona, explicit historical eras, multiple
named moves and fixed provenance). Older schema versions migrate to an **empty**
global override collection, never an invented career rebrand. Existing
promotion-local character edits and their history remain in engagement.
Uncurated wrestlers retain a clearly marked read-only fallback rather than
invented signature/finisher names. Public wrestler profile responses now
expose `portableIdentity` separately from any private promotion edit.

This checkpoint introduces **no automatic wrestler gimmick changes** and
**no player write command** to the global identity collection: that requires
the future consent/contract and multi-promotion fairness gate. Existing local
creative edits remain editable under the legacy command until that migration.
No main merge, preview/production deploy or live World reset is authorised.
