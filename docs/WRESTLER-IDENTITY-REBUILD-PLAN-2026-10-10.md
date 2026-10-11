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

## Researched move repertoire, verified wave 2 (11 October 2026)

Add 13 **exact roster-matched** character entries with source URLs and
an auditable named-move repertoire, extending the initial curated batch.
First publisher evidence includes [WWE's Kevin Owens profile](https://www.wwe.com/superstars/kevin-owens),
[Sami Zayn's profile](https://www.wwe.com/superstars/sami-zayn),
[Penta's profile](https://www.wwe.com/superstars/penta), and
[AEW's Konosuke Takeshita profile](https://www.allelitewrestling.com/mens-roster/konosuke-takeshita)
plus match reports for complementary moves. The batch also covers
Bron Breakker, LA Knight, Chad Gable, Ilja Dragunov, Joe Hendry, Oba Femi,
Adam Cole, Jay White and Christian Cage.

The public portable-identity read model now displays **multiple** verified
signatures and finishers (two distinct signatures for Takeshita). The legacy
promotion editor still stores one of each, without overwriting the larger
canonical repertoire or previous player edits. A single documented finisher
does not cause an invented signature to appear; incomplete records are
explicitly indicated. A move's "signature" or "finisher" role in PPW is
editorial metadata, not a statement about every historical usage or about
match outcomes. New source entries are presentation data, not a world reset
and not an automatic new identity record.

Remaining research: all other real wrestler names, historical/alternate eras,
rename aliases and revised move sets, with evidence citations. Continue batch
by batch rather than backfilling speculation.

## Verified historical/alternate personas, wave 1 (11 October 2026)

This research-only catalogue distinguishes three evidence types:
- **Former ring name:** e.g. Adam Copeland / Edge, Matt Cardona / Zack Ryder, Nic Nemeth / Dolph Ziggler.
- **Historical character:** e.g. Cody Rhodes / Stardust, Jack Perry / Jungle Boy, Luchasaurus / Killswitch.
- **Recurring alternate persona:** e.g. Finn Bálor / The Demon, Matt Hardy / Broken Matt Hardy, Chris Jericho / The Painmaker.

Each entry uses the actual roster identity as a strict lookup key and keeps its
authoritative WWE or AEW source URL. Examples:
[WWE's account of Cody/Stardust](https://www.wwe.com/shows/raw/2015-02-16/dusty-rhodes-family-retrospective),
[WWE's Demon Bálor results](https://www.wwe.com/shows/raw/2016-08-15),
[AEW on Jungle Boy and the Scapegoat](https://www.allelitewrestling.com/post/aew-collision-preview-for-september-14-2024),
[AEW's Broken Matt Hardy report](https://www.allelitewrestling.com/post/aew-dynamite-results-for-june-24-2020),
and [WWE's Matt Cardona / Zack Ryder bio](https://www.wwe.com/superstars/matt-cardona).

**Do not confuse history categories:** a renamed performer is not necessarily
a new gimmick; a wrestler's occasional Demon/Painmaker/Broken appearance is not
proof they are that character every week. WWE's references to Finn's Demon
are intentionally preserved as *alternate* rather than the seed default.
No real-world date is converted into a PPW calendar week. No historical entry
becomes a PPW career-era record, consent, move-set change, contract
advantage, automatically selectable persona, or player-authored show.

The wrestler profile now shows these references in a collapsible source-backed
section, separate from the authoritative, immutable-on-read PPW identity
and the booker's existing promotion-local presentation. A future creative-change
negotiation is required before an alternate becomes a new active PPW persona.

Other wrestler characters, era dates, changing publisher portrayals and
historical move variations remain research backlog. The master roster contains
hundreds of names; this is a sample of well-sourced cases, not full coverage.

## Roster-wide identity coverage, phase 1 (11 October 2026)

**Policy locked:** No initial wrestler or newly generated prospect may enter
the World without a defined persona, gimmick archetype, primary and secondary
style, at least two named signatures and a named finisher. An undefined
secondary style is allowed only for specifically curated workers.

**Provenance matters.** The current small verified real-wrestler catalogue
retains sourced gimmicks and moves. A deterministic, variety-weighted
PPW-authored generator covers every other wrestler and any missing named move.
This is an **in-game approximation**, NOT an unsupported claim that an actual
person uses the invented move, believes in the gimmick or has a certain
temperament. Each move carries VERlFIED or PPW_AUTHORED provenance
(the literal machine tag is VERIFIED, with an uppercase I).

The generator uses person ID, display name and seeded wrestling skill profile
to choose a plausible, style-coherent archetype and repertoire. It consumes
no game RNG, gives no simulation advantage and is deterministic across
multiplayer replay. On World creation it establishes one person-owned identity
record per wrestler. The World-locked career generator adds a complete,
persisted identity whenever a new prospect debuts. The Alpha bootstrap overlays
researched real-world identities on those default identities **only before
any gameplay**. Migrated existing Worlds get missing records only, never a
new persona forced on a wrestler who already has a saved identity.

Existing owner-specific character edits and historical agreements remain
independent; the backfill never promotes local edits into global consent.
Public identity profiles label PPW-created moves. Versioned history,
consent-aware repackaging, roster editing and deep real-world curation remain
separate work. This policy covers the existing real-roster pool and simulated
newcomers but does not imply that hundreds of approximate records have been
individually researched.

No merge to main, Vercel deployment or live save reset authorised.

## High-recognition women's roster curation, wave 3 (11 October 2026)

This increment replaces approximate **new-World** default characters for
19 additional exact-name women's-roster wrestlers with documented official
WWE and AEW gimmick/style contexts and **30 named move entries**. It is not
a catalogue of their off-screen identities, and move assignment to a
"signature" versus "finisher" role remains gameplay/editorial metadata.

WWE: Asuka, IYO SKY, Liv Morgan, Jade Cargill, Tiffany Stratton, Nia Jax,
Bayley, Kairi Sane, Chelsea Green, Stephanie Vaquer, Giulia, Sol Ruca,
Roxanne Perez and Alexa Bliss.

AEW/ROH: Mercedes Moné, Kris Statlander, Athena, Jamie Hayter and
Willow Nightingale.

Sources are stored per curated row, with WWE superstar profiles or
match results and AEW roster/match reports. Examples include
[WWE's Asuka Lock](https://www.wwe.com/superstars/asuka),
[WWE's Over the Moonsault](https://www.wwe.com/superstars/iyo-sky),
[WWE's Stephanie Vaquer move profile](https://www.wwe.com/superstars/stephanie-vaquer),
[AEW's 2026 Moné/Nightingale title match](https://www.allelitewrestling.com/post/aew-all-in-london-results-august-30-2026),
and [AEW's Night Fever listing](https://www.allelitewrestling.com/womens-roster/kris-statlander).

Source coverage is intentionally mixed: when we have one supported move,
we do not invent a *verified* secondary move. The global complete-identity
generator still supplies any other required move with the explicit
PPW_AUTHORED provenance. The full curation catalogue now contains 58
wrestlers (26 original, 13 second wave, 19 third wave); all others still
have complete PPW-authored initial characters.

Crucial compatibility boundary: **curation only replaces untouched
generated defaults during new-World bootstrap**. Existing active World
identity records, local promotions' edits and negotiated personas are not
silently rewritten by later research. Additional player-facing ways to
propose an updated identity belong to the negotiation/editor workstream,
not automatic data upgrade.

Tests assert exact roster matching, unique entries, publisher evidence,
signature/finisher classification consistency, new-World seed correctness,
PPW-authored provenance on missing moves and protection of existing
negotiated characters. No live deployment.

## Full real-roster character guide (11 October 2026)

**643 total seed names**: 440 men's pool + 203 women's pool, covering
WWE/NXT, AEW/ROH, NJPW/NOAH/STARDOM, TNA, CMLL/AAA and independent circuits.
A new `full-real-roster-identity-guide.ts` contains **one explicit entry per
real name**, each with a non-generic gimmick archetype, primary/secondary
wrestling style, TWO signature move names and at least one finisher.

This is a **tiered editorial system**, not 643 independently verified
biographies. **138** higher-familiarity wrestlers have hand-targeted
archetypes and recognisable candidate moves (e.g. Zack Sabre Jr. as a
submission specialist, Danhausen as an eccentric comedy character,
Maki Itoh as a cult favourite, and Hechicero as a lucha technician).
The **other 505** have roster-context/style-cohort approximations, with
individualized named moves based on their ring names. These are playable
PPW FICTIONAL presentation details where independent research is absent.

The **58 fully sourced** wrestler entries from the separate official-source
catalogue ALWAYS override the editorial guide for newly created Worlds.
Other move candidates remain tagged `PPW_AUTHORED`, including familiar move
names not independently verified in the sourced catalogue. Never promote
those names to `VERIFIED` merely because they sound recognisable.
Gimmick/editorial provenance is `ROSTER_APPROXIMATION` until independently
curated.

Integration:
- New real-roster Worlds replace the initial generated baseline for every
  exact named worker using the 643-row roster guide; sourced profiles win.
- Existing Worlds backfill **missing person identities only**; already
  persisted persona records, negotiated changes, previous PPW history and
  promotion-local edits remain unchanged, even when the guide improves.
- The directory read fallback and promotion creative defaults use the same
  exact-name guide, not a second random presentation.
- Future procedurally generated fictional prospects still receive their
  complete consistent identities from sim-core, with no randomised future
  lookup of real-wrestler names.
- Tests require one-to-one coverage, varied archetypes/styles, nonempty and
  provenance-labelled moves, correct targeted reference examples and
  data isolation across Worlds.

The next quality step is **reviewing the 505 cohort-based approximations** by
prominence, region and user-reported inaccuracies, not just declaring
"643 historically researched." Then continue author-controlled promotion
character negotiations and Roster editor. No production deployment.

## Complete individual roster editorial review — waves 5–7 (11 October 2026)

The broad *cohort/random archetype* pass was useful for filling gaps but
produced implausible real-name defaults. A follow-up roster audit found
**446 remaining unreviewed records** once the publisher-sourced profiles
were excluded. All 446 now have an **individual review row**, partitioned:

- Wave 5: **171** WWE/NXT, AEW/ROH and associated women wrestlers.
- Wave 6: **126** NJPW, NOAH, STARDOM, Japanese guests, AAA/CMLL and luchadoras.
- Wave 7: **149** TNA, British/global indies, developmental and independent women.

Each entry explicitly selects a plausible wrestler-specific gimmick,
primary style and named finisher. The previous automatically invented names
such as `[surname] Breaker` have been replaced with realistic wrestling
manoeuvres and known move-name candidates. Two secondary signatures are
chosen consistently from a **style-appropriate real wrestling-move
vocabulary**, not fabricated historical signature claims.

**Editorial tier meanings:**
- `CURATED`: independently publisher-sourced data with `VERIFIED` moves
  (the current separate researched catalogue, 59 distinct names).
- `TARGETED`: existing individually name-targeted editorials (138 names).
- `REVIEWED`: this audited set of 446 wrestler-specific editorials.
- `COHORT`: *none left outside the independently publisher-curated pool*.

**Do not misrepresent the result:** this achieves 643/643 individually
specified and reasonable starting profiles. It does NOT assert that all
643 finishers have been independently verified, nor that obscure wrestler
personas exactly match the real-world current day. Reviewed moves are
intentionally `PPW_AUTHORED`. Genuine real signature/finisher correctness
continues to improve through source-driven editorial corrections; some
character versions evolve with wrestling history. The user's accepted
standard allows plausible approximate moves for little-known names.

Fixed archetypes **Lone Wolf** and **Viking Warrior** were added to the
shared catalogue for characters where other labels were inappropriate.
All profile data is still wrestler-owned, not promotion-owned. A player's
saved negotiated identity remains untouched by subsequent editorial waves.
Future generated fictional wrestlers are still given complete self-contained
characters by the sim-core prospect generator, with no real-roster alias
reuse. These editorial upgrades apply to new Worlds only, or to missing
identity records during controlled legacy backfill.

Tests require exact individual review match for all 446 records,
no unreviewed generic record except one independently curated, complete
signature/finisher repertoires, world creation, no mutation leakage, and
player-negotiated override protection. No live deployment.

## Finishing the 643-person audit: targeted signatures and verified Japan specialties

The remaining **138 existing individually targeted** wrestler profiles were
checked for auto-concatenated pseudo-signature labels, e.g. a surname
arbitrarily combined with "Cutter", "Lariat" or "Springboard Crossbody".
Preserve genuinely wrestler-specific named candidate moves; replace those
mechanical labels with TWO genuine wrestling manoeuvre types, coherently
matched to each worker's style and still tagged `PPW_AUTHORED`. Danhausen's
"Very Nice, Very Evil" is a character catchphrase, NOT a signature move;
use plausible recognised move labels, while keeping his finisher name.

Separate source research wave 8 upgrades **14 wrestlers** using official
NJPW / STARDOM profiles and match reports. The publisher-source catalogue
now covers **73 distinct names** (up from 59), while the remaining 570
are still individually reviewed editorial starting identities rather
than blank placeholders. Distinctive publisher-backed examples:

- [Yota Tsuji: Gene Blaster, Marlowe Crash, Curb Stomp](https://www.njpw1972.com/profile/139488).
- [El Desperado: Pinche Loco and Guitarra Del Angel](https://www.njpw1972.com/profile/732).
- [Saya Kamitani: Phenex Queen / Star Crusher](https://wwr-stardom.com/en/fighters/kamitani/).
- [Starlight Kid: Star Suplex Hold / Black Tiger Leg Kill](https://wwr-stardom.com/en/fighters/starlight-kid/).
- [AZM: AZM Sushi and high-speed moves](https://wwr-stardom.com/en/fighters/azm-mg7r5zbd/).
- [Maika: Michinoku Driver II](https://wwr-stardom.com/en/fighters/maika/).
- [Momo Watanabe: Peach Thunder](https://wwr-stardom.com/en/fighters/watanabe/).
- [Hazuki: vertical drop brainbuster and Face Wash](https://wwr-stardom.com/en/fighters/hazuki/).
- [Hanan: Backdrop Hold](https://wwr-stardom.com/en/fighters/hanan/).
- [Natsuko Tora: Cannonball and Swanton](https://wwr-stardom.com/en/fighters/toura/).
- [Rina: Hydrangea and Jackknife Hold](https://wwr-stardom.com/en/fighters/rina/).
- [NJPW Oct. 7 2026 official results](https://www.njpw1972.com/tornament/result/654878)
  support Shota Umino's Death Rider, Robbie Eagles' Ron Miller Special,
  and YOH's Direct Drive.

"Signature" versus "finisher" is PPW game classification; a promotion
calling a move a "specialty" doesn't guarantee exclusive historical finisher
use. The sourced catalogue establishes identity and move **names**, and the
game's slot is an editorial interpretation. All other selected moves remain
labelled PPW-authored, never falsely marked as verified.

**Completion gate:** 643/643 worker-name matches, one initial persona per
worker, valid gimmick and style, two non-duplicated signature manoeuvres and
a finisher, appropriate source provenance, distinct published-versus-edited
characters, no cohort-only uncurated assignment, new generated wrestler
coverage, and no mutation of saved or negotiated character state.
No character editor or gimmick-negotiation feature starts before these
checks are green and the user is satisfied with the roster data.
