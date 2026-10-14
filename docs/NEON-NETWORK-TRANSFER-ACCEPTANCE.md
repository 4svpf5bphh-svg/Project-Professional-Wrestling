# PPW Neon Network-Transfer Acceptance Gate

## Two-player budget
- Goal: under 5 GB Neon network transfer in any 30-day month, with **2.5 GB headroom target**.
- 5 GB is about 167 MB/day. The 2.5 GB target is about 83 MB/day, all app activity combined.
- Record Neon data_transfer_bytes before and after realistic play: navigate on two phones, save cards, negotiate contracts, and resolve a World week. Count actions, elapsed time and other traffic.
- Leave the app open idle for a separate session. Idle countdowns and passive pages must not generate repeated database transfers.
- Repeat against real deployment with multiple fresh server instances; unit tests are not proof of Neon billing.
- If extrapolated monthly usage exceeds 2.5 GB, Priority 0 stays open.

## Automated regression checks
- Full World gzip payload <=35% of JSONB text snapshot for fixture Worlds.
- Cold read from a new server after first legacy backfill transfers <=35% of the original raw snapshot.
- Unchanged World reads use tiny version probes, with no full read.
- Another player's update invalidates the warm snapshot; activity updates cannot validate stale data.
- JSONB-only recovery or older-server edits must clear gzip and update the version marker.
- Normal World transactions atomically preserve authoritative JSONB and gzip.
- Log tag [ppw-db-transfer] measures World-field payload only; it is **not** Neon's full billed network transfer.

## Shipping gate
1. Full CI green at the exact PR head.
2. Controlled deployment preserving the live World.
3. Repeat Neon Launch measurements with two users; evaluate running cost before resuming feature work.
4. Keep PR #99 and its performance branch active until production is measured. PR #98 stays paused.