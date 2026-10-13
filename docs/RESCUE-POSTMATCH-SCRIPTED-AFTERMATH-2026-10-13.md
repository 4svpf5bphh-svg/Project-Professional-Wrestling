# Scripted Rescues & Post-match Aftermath — 13 October 2026

Draft development only, stacked on #68. No merges, Vercel deployments, migrations, production writes or World reset.

## Why this slice

Existing RESCUE correctly identifies aggressor, victim and rescuer, while POST_MATCH_ASSAULT is correctly attached immediately after a source match and checks that the intended victim competed. Neither fully captures the *scripted physical outcome*. Rescue Results previously claimed a successful save even when there was no outcome state. This is not appropriate for a booker-authored wrestling game.

## The actual player choices

**RESCUE** — three participating wrestlers retain their existing roles. Add one player-scripted result:
- Rescuer stands tall and drives off the attacker.
- The victim is saved but attacker escapes.
- Attempt fails: attacker overwhelms the rescuer.

The third option is intentionally a *rescue attempt*, not a historical "successful save"; Results must never claim otherwise. No auto-match, surprise turn, new roster affiliation, friendship, contract, injury or Programme transfer is created. Historic unscripted rescues remain unscripted, with a neutral factual description.

**POST_MATCH_ASSAULT** — a physically different context from ATTACK, not a second generic Attack segment. It can only occur immediately after a real completed source match, targeted at someone who actually competed. Keep the existing link and role validation. Add:
- **Format:** blindsided attack, beatdown or pull-apart brawl, reusing existing Attack formats.
- **Intended effect:** generate heat, build sympathy or escalate the rivalry, reusing existing Attack objectives. This is tucked into Advanced Booking to keep the quick path short.
- **On-screen ending:** attacker stands tall, victim fights back, or officials separate them.

This final beat is authored, never rolled by the simulation. A victim who won the match can still be beaten down or can fight back after the bell; their **match win remains intact**. Actual wrestling injuries remain only from legitimate injury logic, not invented because a scripted attack happened.

New post-match angles require all three detailed choices or none for legacy unscripted bookings. Legacy segments remain compatible without rewriting old shows.

## Scoring / variety without spam

Wrestler alignment, presentation, source-match result and actual programme heat influence **crowd response**, not whether the booked angle happened. Both segment types have a modest, capped repeat penalty (up to 3.5 angle-fit points), looking back six PPW weeks through actual completed `SHOW_SEGMENT_COMPLETED` records. RESCUE requires exactly the same attacker, victim, rescuer and outcome in the same promotion; post-match aftermath requires the same attacker, victim, format, goal and ending. Old/future shows, draft reservations, rival promotions and different scripts never count. No RNG rewriting or paid simulation advantages.

Completion writes exact authored details to authoritative show history; owner/private and public factual Results show the performed result. Unperformed segments do not appear as successful incidents.

## The four dependency questions

1. **Depends on:** detailed Show Card, dated talent reservations, source-match validation and adjacency, a real completed match result, alignment, Programme links, World Lock and the frozen segment ledger.
2. **Later dependencies:** feud escalation feedback, talent consequences, richer show Results, more varied wrestling-language commentary and rule-consistent Backstage reactions. This slice does not assume those future decisions.
3. **Simulation vs presentation:** `rescueOutcome`, `attackPresentation`, `attackObjective`, `postMatchAssaultEnding`, real source match and performer IDs are authority-side state. Results narration, booking option labels and button layouts are presentation; feedback remains deterministic and frozen.
4. **Smallest complete first implementation:** the above choices on existing segment types, exact Card save/reload, validation/legacy support, scoped recent repetition, immutable private/public Results, and regressions for no fake injury, no result reversal, correct roles and no duplicate ledger events.

## Verification gate / next segment wave

CI must run and pass **on this exact draft head**, including web, application, HTTP, PostgreSQL and sustained World simulation checks. A green parent #68 does not prove these changes. If CI fails, stop and fix this branch before expanding further.

After this pass, audit remaining 16-type segment matrix to distinguish meaningful unfinished behaviours from superficial new options, then conduct a **cross-segment anti-repetition / narrative clarity** review before the theatrical Show Results overhaul. A stale booker script cannot be silently changed by the sim.
