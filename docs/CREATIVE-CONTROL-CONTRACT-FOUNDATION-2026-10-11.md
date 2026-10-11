# PPW Creative Control — contractual foundation and delivery gates

Status: **first coding wave on a protected work branch; NOT YET PLAYER-SELECTABLE OR ENFORCED AT WORLD LOCK.** No deploy, reset or live-World migration.

## Why the contract model matters

Creative control is a bargained contractual right with a real utility premium to the wrestler. It should be an attractive concession when a player wants to save salary, recruit a strong name or retain an established star—but it has to cost the promoter real control later. Do not offer a choice in the public editor until the simulator enforces the corresponding promises.

The World is server-authoritative, single wrestler identity, multi-promotion where non-exclusive. A creative-control clause belongs to an individual *promotion–wrestler contract*, not the global wrestler profile. A wrestler carries their own gimmick regardless of which promotion employs them; a contract can grant broader veto rights in one promotion without automatically doing so elsewhere. Legacy contracts with no field mean `NONE`.

## Four levels; same underlying mechanics for AI and humans

| Level | Initial negotiated utility premium | What player promises |
| --- | --- | --- |
| NONE | None | Normal trust and gimmick resistance still apply |
| CONSULTATION | Moderate | Seek wrestler input on consequential planned losses / repackaging; not a veto |
| PROTECTED_FINISHES | Strong | Clean/submission losses require prior consent; protected losses can be planned without a finish veto |
| FULL_APPROVAL | Very strong | Match assignment/finish and significant repackaging require prior consent |

The deterministic `creativeBookingReview` checks the planned script; it **does not decide the script or change outcomes**. When a wrestler is concerned, the player must be shown the exact issue and can revise the match/finish, ask for agreement/waiver, or postpone. A refusal should never rewrite a finish, automatically turn the wrestler or force an undesired loss. Do not block an existing signed World until the explicit decision and approval workflow is implemented.

The scoring function considers fictional in-game schedule/role priorities, not presumed personality or biographical claims about real wrestlers. Consultation shouldn't fire on every ordinary show and overload the Desk.

## First complete implementation depends on

1. **Offer and signed-contract state**: optional `creativeControl` enum, copied from offer into signed agreement and into private owned-roster read models; legacy data left unmodified.
2. **Financial acceptance**: bounded deterministic utility benefit to the wrestler when offered consultation, protected finishes or full approval. Money and dates are not silently changed.
3. **New World/auditing**: no global wrestler character change; AI negotiations must use exactly the same scorer and resistances.
4. **Booking candidate review**: compare each proposed match's winner, finish and participants with each wrestler's contract rights, and compare proposed gimmick changes with their wrestler-owned identity.
5. **Player-facing consent workflow**: consent-request state scoped to the booked show/contract/plan version; player can alter finish or request waiver; deterministic wrestler decision with grounded relationship/role/workload context. Persist decision before canonical World Lock, with idempotency and stale-plan rejection. Human and AI rivals use the same rules without granting human online-time power.
6. **Clear failsafe**: an unresolved required approval prevents committing that *specific affected draft*, not arbitrary week progression or editing unrelated cards. Routine Continuity should distinguish a valid fully prepared show from work with unresolved creative permissions.
7. **Player UX**: ONLY after approval workflow is tested, expose clause choices in an expandable contract offer section with clear cash guidance and risk text. Do not duplicate big sections or explain the entire system on every wrestler profile.
8. **Regressions**: offer utility order, persisted rights, old save defaults, both direct and parent promotion booking, no accidental auto-finish rewrite, consent idempotency, AI fairness, short and ten-year sim determinism, live World reset only on user approval.

## Economic checkpoint

Prior AI term generation produces exclusive weekly guarantees of approximately 1.0–1.25× market base before promoter generosity and 3–8 weeks' market value as a signing bonus; typical non-exclusive contracts pay about 0.12–0.26× market as weekly guarantee plus a variable fee per appearance, with fewer purchased dates. Thus there is already a substantial expected cost premium for exclusivity, which now includes unlimited contractual rights subject to workload. Do not increase both costs and booking power again without an AI cash/runway/regression review.

## Smallest safe wave delivered

Contract enum, optional stored clause, stable default for legacy World, utility premium, pure booking review, private owned-roster/pending-offer projection, and regressions. No player-activated contractual veto, no changes to match scripts, no extra forced notifications, no Vercel deployment.

Follow-up coding: **consent/waiver state and booking enforcement**, then optional UI for offering creative control, then economic and multiplayer validation, followed by one later user-approved consolidated release and fresh test World.
