# PPW — Contractual creative control and booking approval rights
Design checkpoint: 11 October 2026. **Deferred until after the full wrestler identity audit and relevant contract/Backstage integration.** This is a specification, NOT a gameplay feature or release permission.

## Player-facing principle
Creative control is a real, negotiable part of a wrestler's offer, renewal or contract variation. A wrestler may value it very highly, particularly established/high-recognition talent, but granting it transfers a measurable portion of booking discretion from the promotion. It should not be a universal free substitute for wages, dates or signing bonuses.

Wrestling is scripted. The **booker chooses the intended card, match winner, finish, interference, character changes and segment outcomes**. The simulation may represent an independently motivated wrestler objecting to that proposal under their contract; **it may never secretly rebook, rewrite a finish, or decide a replacement outcome for the human**. Any unresolved veto is surfaced before World Lock, with specific actionable choices.

## Contract offer fields (future, not yet implemented)
- `creativeControl`: explicit one-of scope `NONE | CONSULTATION | PROTECTED_FINISHES | FULL_APPROVAL`.
- `protectedTopics`: e.g. decisive singles losses, clean pin/submission losses, title losses, squash/humiliation, gimmick/repackaging, losing-streak threshold, high-risk stunt, severe physical angle, program/match participation. Topic set constrained by scope: consultation never confers veto; full approval must not become a blanket ban on ordinary booked appearances.
- `protectedTerm`: duration bounded by that specific contract; expiry, renewal and non-exclusive appearance terms follow the active agreement rather than globally redefining the wrestler's persona.
- `bookingApproval`: explicit approval/request state for material booking changes only, with event ID, participant, proposal fingerprint, scope, requested response and expiration at booking lock. Avoid generating repeated objections against an unchanged card.
- `compensationTradeOff`: negotiated promise may affect acceptable wages, per-appearance fees and willingness to sign, but diminishing returns and a wrestler-specific preference floor prevent exploitation.
- First-release UI should use clearly worded card choices and a single risk/approval preview, not a dense array of grey dropdowns.

## Meaningful acceptance and downside
Acceptance is an offer-evaluation factor, not a guaranteed toggle. Creative-control preference can depend on career stage, current persona attachment, recognition, status, recent usage, trust with this promotion, exclusivity and the worker's PPW-fictional preferences. A young wrestler may prize exposure instead; a top star may demand approval regardless of cash. AI rival companies use the **same** evaluation and budgets, and private rival terms remain private.

Risk is concrete, not merely a morale number:
1. **Consultation:** flagged booking requires a timely conversation; player can retain creative authority. Ignoring consultation may cost trust, morale, future renewals, and relationships.
2. **Protected finishes:** an in-scope booker's planned loss/finish triggers a specific approval request. The worker can consent or withhold approval after negotiation; no veto on unrelated normal matches. Refusal is a genuine pre-lock constraint until the booker revises the finish, secures consent or removes/rebooks the match.
3. **Full approval:** covers a stronger defined set of high-stakes booking proposals (major losses, title changes, gimmick upheaval, humiliating angles), but ordinary match participation remains viable; otherwise the talent is too easy to warehouse or abuse with perpetual vetoes.
4. Explicit negotiated accommodations can include protected-loss exceptions, title-change consent, creative-use limits, promises about opponent/programme and one-off waivers. Past approval does not imply global permanent consent.

Approval/rejection is **not** decided by AI prose. The authoritative, deterministic contract/Backstage rule produces a proposed response grounded in scope, preference, recent conduct and prior promises; the booker sees reasons and counteroffer choices. No extra simulation power for being online. Stable offer IDs, idempotency, timeouts and World Lock snapshots prevent last-second multiplayer inconsistencies.

## Card-building / play loop
- When a user books a match, result or segment, the planner immediately explains a prospective conflict: e.g. “Creative protection: this clean singles loss requires approval from Wrestler X.” It identifies affected contract clause and finish, not just a generic alert.
- A **Request approval** / **Discuss finish** action can lead to accepted exception, alternate finish, future protection or a binding booking compromise. The player authors any revised script.
- An unresolved hard veto should block **only the affected executable booking**, with a direct link and clear reason, never silently flip its winner or automatically convert a loss into a DQ. Remove/revise/re-negotiate it before lock.
- If the player is absent, prepared eligible cards remain valid. Routine Continuity/stewardship can resolve unbooked ordinary duties within existing authority; neither can violate a protected finish nor grant new concessions on a player's behalf.
- In non-exclusive/limited-date contracts, rights are scoped to **the promotion/event under contract**. One promotion's creative concession cannot block an unrelated promotion's show or change the wrestler's shared canonical identity.
- When the wrestler has an agreed identity/persona and the booker proposes a repackaging, the future wrestler-owned identity negotiation must also respect the creative-control level and any parallel booking rights.

## Multiplayer, simulation, privacy and fairness
- Shared server-authoritative contracts, event/finish proposals and per-promoter rights; commands are validated by actor ownership and contract state.
- No ability for one controller to veto another controller's booking merely because the wrestler is shared across non-exclusive arrangements.
- Never expose private salary/contract clauses or negotiation responses to rival promoters unless the clauses become public via legitimate fictional-world news.
- Historical creative promises persist in save/reload, migration, histories and future renewals. A contract's expiration does not erase past identity agreements, only the associated current booking veto rights.
- Do not allow “full approval” to make a wrestler unbookable forever, effectively hoard talent, block ordinary work or bypass inactivity consequences.
- Repeated objections need fatigue/proportionality. A failure to approve an exact unchanged proposal should not be infinitely retriggerable for morale damage or negotiation exploit.
- Give strong workers meaningful leverage without forcing a human booker to play every day. Pre-approved scripts and timely delegated routine booking must remain playable.

## Dependency/mantra review
1. **Depends on:** offer/contract term engine, compensation valuation, wrestler preferences and trust, existing Backstage negotiations, participant permissions, segment attacker/victim roles, match finish authoring, card planner and World Lock.
2. **Future consumers:** roster creative editor, portable gimmick negotiations, title booking, protected-loss conditions, AI rival offers, storyline trust, public news and history.
3. **State vs presentation:** contract clauses and one-off consents are durable server state; offer comparison cards, warnings and dialogue are views. Final match outcomes remain human-authored commands. AI can word a rationale but never decide the booking.
4. **Smallest complete first version:** `NONE`, `CONSULTATION`, `PROTECTED_FINISHES` in new offers/renewals; acceptance valuation and visible risk; block/approve on clean singles defeat and title-loss conflicts; one-off waiver; rebooking workflow; persistence, two-controller permissions and regression test. Add `FULL_APPROVAL`, complex segments, stunts, multi-person finishes and advanced relationship reactions only when the first version has proven predictable.

## Required testing and balance
- Offer attractiveness changes for differently established wrestlers and does not replace infinite pay.
- Contract contains/does not contain enforceable rights as advertised; match booking warns early; exact refusal never auto-rewrites match.
- Prior written approval, single-use waiver, withdrawal and unchanged-proposal idempotency; no veto leakage when wrestler changes promotions.
- Multi-promotion appearances, human-v-human information privacy, expired terms, incomplete cards, absence stewardship, World Lock and history snapshots.
- Long-run AI acceptance to ensure strong creative clauses do not make title changes impossible or stars unbookable.
- No source-backed assertion about real wrestlers' actual contract clauses or personality; behaviour is fictional PPW simulation.

**Do not implement until roster identity coverage/canonical move review is complete. No deploy/main merge authorised by this document.**
