# ALPHA-1A — Web Week Loop

This slice extends the first Alpha web vertical slice from **claim a promotion** to **claim → inspect readiness → finish one server-authoritative PPW week → inspect the persisted result**.

## What is now player-facing

After claiming an Independent, the Alpha dashboard exposes:

- current World phase and revision;
- the promotion's current mandatory-show readiness (`NOT_REQUIRED`, `SHOW_REQUIRED`, `CARD_REQUIRED`, `READY`);
- whether finishing the week will require Routine Continuity staff help;
- the latest resolved PPW week;
- the promotion's latest completed show from that resolved week, including attendance, gate, show net result, average/best match rating and crowd response.

## Alpha week-resolution harness

`POST /api/advance-week` is deliberately an **ALPHA-1A server harness**, not a permanent multiplayer player command.

The browser supplies only the World revision it currently sees. Player identity still comes from the server's Alpha configuration; the client cannot nominate another player or promotion.

When the World is `OPEN`, the server:

1. revalidates/materializes any due current-week reservations;
2. durably locks the World;
3. resolves the locked week through the existing deterministic World worker path;
4. materializes reservations that become due in the new week;
5. returns the fresh player-safe read model.

If unresolved show/card work exists, the existing Routine Continuity rules decide what staff complete at the lock. The web layer does not invent a separate booking fallback.

## Retry and recovery safety

The week endpoint is intentionally not represented as a normal player mutation command because long-term multiplayer World progression belongs to the server scheduler/worker.

Safety comes from the runtime/repository boundary:

- an `OPEN` request requires the exact expected World revision;
- once a week has completed, retrying the old revision is rejected and cannot advance a second week;
- if a process dies after the durable `LOCKING` checkpoint but before resolution commits, a later Alpha request detects `LOCKING` and resumes that same locked week;
- PostgreSQL transactions continue to protect resolution from partial commits.

This is sufficient for the single-seat Alpha test harness without prematurely designing the final real-time multiplayer deadline service.

## Deliberately not added

This slice does **not** add:

- timed real-world weekly deadlines;
- permission for a player to control the clock in multiplayer;
- the complete show planner/card UI;
- contract-market UI;
- result/news feeds beyond the latest promotion show summary;
- background scheduling infrastructure.

Those remain later Alpha application slices. The important result here is that the production browser/server/database path can now move a real persisted PPW World through one full weekly resolution safely.
