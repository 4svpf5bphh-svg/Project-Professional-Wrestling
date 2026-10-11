# PPW — Creative permissions and World Lock fairness (11 October 2026)

Status: protected CI development only; no merge, preview deployment, reset or production change.

## Locked design from this wave

- **A human controlling a promotion who presses Advance Week gets an actionable error** if a show they have already reserved or materialized for the current PPW week still has protected-booking permissions outstanding. The check runs before materialization and again within the authoritative lock transaction. Other human and AI promotions do not inherit that player's veto.
- **Scheduled shared-World progression is never blocked by someone being offline or refusing to settle a booking.** The existing commitment lock releases the unapproved reservation, logs its specific creative reason and hands routine show preparation to staff. No unapproved player-authored card is silently materialized.
- The outcome is auditable. A `PLANNED_SHOW_CREATIVE_STAFF_FALLBACK` ledger entry creates an IMPORTANT post-resolution Attention item for the controlling player.
- Unattached or incomplete drafts cannot block the World; only reserved or already-materialized due shows are considered.
- The existing card is still not rewritten, and the earlier scoped consent prevents rerolling a declined permission.

## Remaining risk before creative clauses become selectable

1. **Respect protected booking in staff-generated match outcomes**, not just in user-authored cards. Staff fallback must avoid breaching the very same contractual protections. This requires sim-core compatibility for both AI promotions and caretaker booking.
2. When a *materialized show* has an unapproved proposed amendment, implement explicit `Restore last committed card` / `Withdraw changes` (or equivalent) so manual advance cannot trap a promoter in repeated negotiation; the original committed card must remain authoritative.
3. At a scheduled lock, send a distinct `unapproved amendment ignored; original card ran` ledger/Attention notice rather than describing this as show cancellation.
4. Consider **standing approvals per Programme arc** for FULL_APPROVAL only when match-up, overall finish direction and agreed scope stay within a defined storyline. No global indefinite waivers. Changes of opponent, stipulation or protected loss require new review. The simpler first UI remains match-scoped; standing Programme terms are deferred until Programme structure supports explicit creative ranges.
5. Run multiplayer parity, Postgres retry/determinism and economic balancing before offering creative clauses in public contract negotiations.

Do not enable new vetoes until the refusal-resolution loop is complete and humans/AI/staff honor the same rights. Scheduled lock fairness cannot become a way to bypass agreements.
