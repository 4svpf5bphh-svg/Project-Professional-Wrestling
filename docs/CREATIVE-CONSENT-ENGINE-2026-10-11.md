# PPW creative consent engine — protected development wave

Status: **draft PR / CI only; not player-facing, not a release.** Builds on the creative-control contractual foundation.

## Scope delivered
- World planning snapshots may persist match-scoped `creativeConsents`; old snapshots normalize to an empty collection.
- Auditing distinguishes non-blocking consultation from contractual approval obligations.
- Protected finishes require consent for the losing wrestler's clean pin or submission. Full approval applies to every match assignment, win or loss.
- A decision is tied to promotion, show ID, match ID, person, contract, target date, opponents, finish, match intent, style, length and interference.
- The exact request is deterministic and idempotent; the requester must control the promotion, pass the current World/plan guards and act before World Lock. A declined proposal cannot simply be rerolled by resubmitting it.
- Changed finishes or opponents break the old signature and require a fresh decision. Removing a draft clears its approvals.
- Agreement/refusal never changes a result, finish, gimmick or booking.
- Dedicated regressions cover normal/default agreements, consultation, protected and full rights, consent scope, refusal, stale-plan resistance and older save shape.

## Deliberately not active
- **No public contract editor control** for creative rights yet.
- **No World Lock blocking** or current-week materialized-card blocking yet. This avoids disrupting existing shows while the user-facing resolution actions are absent.
- **No UI or web API** for requesting a waiver. The command is a server-authoritative primitive for the next integration wave.
- **No real-person personality inference:** decisions use fictional current game-state factors only.
- No new weekly background decisions, hidden rewrites, online-time bonuses or extra guaranteed simulation power.

## Next dependencies
1. Integrate the same audit into *both* future reservation materialization and already-materialized card replacement.
2. Surface clear, concise pre-lock concern and waiver actions. The promoter may request agreement, revise the authored booking, or postpone. Never rewrite the result automatically.
3. Consider approvals when routines / staff handle absent players; unresolved rights should affect only the impacted planned show, not blanket time progression.
4. Validate two-controller and AI parity, persistence/idempotency across PostgreSQL, approval economics and extended simulation before enabling creative-rights selections in offers.
5. Later, with explicit permission, bundle and deploy with a fresh test World reset.
