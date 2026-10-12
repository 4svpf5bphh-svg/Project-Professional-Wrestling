# PPW daily schedule and creative card World Lock audit — 11 October 2026

**Protected CI branch only.** No merge, live cron change, deploy, preview, or World reset.

## Calendar authority

Two separate axes must not be conflated:
- **Real time:** One UTC calendar day (including Saturday and Sunday) opens/resolves exactly one PPW week. A cron on every day at `0 6 * * *` locks this week's show logistics; a second daily cron `0 8 * * *` runs final World Lock/resolution. Both derive their real-cycle identity from one UTC date utility, shared with player-activity tracking.
- **PPW simulation:** A week contains **seven distinct show dates, days 1–7 (Monday through Sunday)**. Shows can book any of those seven days; one daily World resolution processes the week's events, then resets the next PPW week to day 1. One PPW year remains 52 weeks.

No changes to deployed cron times or cadence in this wave.

## UK timezone display

Cron is explicitly UTC rather than local Europe/London time. For UK players:
- During BST, 06:00 and 08:00 UTC = **07:00** and **09:00 UK time**.
- During GMT, those same UTC hours = **06:00** and **08:00 UK time**.
- Tests span the 25 October 2026 fall-back and the March 2027 clock-forward, plus UTC midnight and leap-day boundaries.
- A future UI countdown must display the user's local offset explicitly. Do **not** call these 06:00/08:00 UK throughout the year.

## Creative amendment versus incomplete show

An already materialized show with a previously committed card **must not receive a Routine Continuity staff takeover** just because a *newly proposed amendment* has not obtained contractual approval.

- Unapproved materialized amendments never replace the live card. Manual advancement does not block on this isolated proposal when a complete committed show exists.
- At the 06:00 logistics lock, discard any such proposal, restore exactly the previous committed draft and its valid approvals, preserve live scheduled match IDs/results/finishes and issue a distinct audit ledger event.
- An amendment submitted **after** the logistics lock (while card edits are still allowed) is reconciled at the final 08:00 World Lock. The earlier daily logistics check is not the last safety boundary.
- Player Attention after resolution states the **original committed card ran**; it does not claim the show was cancelled or staff booked it.
- *Genuinely unmaterialized reserved shows* awaiting approval retain the earlier reserved-show staff fallback. World advancement remains fair and nonblocking across promotions.
- Lock cleanup does not apply a pending unapproved proposal merely because its contractual requirements subsequently changed; applying a new card still requires the explicit normal save/approval flow.

## Regression gates

- Seven consecutive real UTC days Monday to Sunday and Monday rollover: one PPW week each, duplicate delivery no double advance, and cycle keys synchronized between logistics and World resolution.
- 52-week PPW year rollover from Sunday to Monday and valid show-day 1–7 domain.
- Vercel cron schedule string matches the declared UTC lock and resolution hours on **all seven days**, including weekend runs.
- Leap date, UTC day rollover and UK DST shifts.
- A proposed creative-protected materialized card does not overwrite an already committed show before lock, after lock, or on manual advance; the correct attention is surfaced after resolution.

## Deferred / explicitly not fixed in this wave

- Production cron delivery itself is managed by Vercel and should be monitored separately; configuration alone cannot prove that each job fired precisely on time.
- **Missed whole-day deliveries:** the existing scheduler resolves the latest received daily cycle and does not replay every missed day automatically. Multi-day catch-up and monitoring should be a separate multiplayer-safe design decision (avoid unfair pile-on of world weeks after downtime).
- If the desired product rule is **fixed 06:00/08:00 local UK wall-clock time all year**, a DST-aware scheduler would need separate implementation and approval. The current canonical rule is fixed UTC.
- Programme standing approvals, creative contract economics, final AI capacity parity, merged PR consolidation, fresh test World reset and deployment remain deferred.
