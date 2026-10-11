# PPW one-off contract — first genuinely bookable week (11 October 2026)

Status: **protected draft; stacked after PR #32, no merge, preview, deployment or World reset**.

## Bug traced

A new human one-off offer was created as a 1-week agreement beginning **in the submission week**. Offers resolve during the canonical World tick, after the human player's Show Card is committed. The World then advances to the next PPW week. Even a successful one-off acceptance could therefore immediately become unbookable.

The defect applies to **human-player new one-off offers**, and also to one-off replacements submitted against exhausted purchased dates. It is not an argument to make all contracts longer, increase wrestler power, or turn one-offs into unlimited appearances.

## Narrow correction

- For human ONE_OFF offers whose computed start falls in the submission week, start **the following PPW week** (the first week the player can prepare after offer resolution). The one-off's calendar validity spans **day 1 through day 7 of that exact week**, because reservations use exact PPW show days. This is *not* seven purchased dates: entitlement remains **one**.
- A renewal whose existing agreement ends later **still starts in the first full week after that agreement ends**; no overlapping rights or acceleration.
- Keep the existing one-date entitlement and no weekly guarantee. Preserve normal pay, willingness, capacity, overlap and one-player-one-promotion rules.
- Preserve deterministic contract offer resolution, World Lock, idempotent retries, server-authoritative booked participants and creative-control terms.
- AI-generated one-off agreements, already-signed legacy contracts, date addenda and standard multiweek offer timing are **unchanged** in this bounded correction.
- UI describes the real timing before sending the offer, including the exhausted-date renewal variant.

## New regression gates

1. A new one-off offer is pending for the next PPW week, not the current committed week. It cannot be booked before acceptance.
2. After World resolution and acceptance, the signed one-off is active with a single appearance and dates valid day 1–7; player roster and show planning expose it.
3. A real current-week show reservation, saved authored match and next World resolution can use and consume that one appearance.
4. An exhausted-source renewal to ONE_OFF does not terminate the original agreement on offer submission; acceptance replaces it with a genuinely live next-week agreement.
5. Existing PR #32 exclusive retries, creative-control acceptance, multiworld / HTTP / PostgreSQL / 7-seed creative audit and 10-year smoke remain regression-gated.

## Explicitly out of scope

Rewriting ordinary 13/26/52-week offers to start later, changes to AI one-off terms, special attraction windows, purchase/expiry refund policy, price calibration and UI-wide rework. Any additional timing concerns should receive their own evidence-led audit.

The game owner has chosen a fresh World reset **only immediately before the future explicitly authorised bundled release** because the broader contract-model changes invalidate the previous playtesting baseline. This PR does not reset anything.
