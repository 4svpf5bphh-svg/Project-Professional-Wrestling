# PPW branch retirement queue

Purpose: keep a small, verified list of branches to delete from GitHub on desktop. This file is separate from the historical branch cleanup lists. **Listing a branch here never authorises deletion on its own.**

## Status meanings
- **ACTIVE** — work in progress; do not delete.
- **AWAITING VERIFICATION** — merged or superseded, but integration, CI, production deployment or recovery checks remain.
- **DELETE — SAFE** — branch changes confirmed integrated; required release and recovery checks passed; branch can be deleted manually on desktop.
- **KEEP** — default/protected, recovery, or other deliberately retained branch.

## Current queue

| Branch | PR | Status | Condition before marking DELETE — SAFE |
| --- | --- | --- | --- |
| `work/roadmap-1-contracts-talent` | [#98](https://github.com/4svpf5bphh-svg/Project-Professional-Wrestling/pull/98) | **ACTIVE** | Merge after green validation, verify grouped production release and preserve World/recovery state. |

## Desktop deletion workflow
1. Open this queue on GitHub and use the PR/branch links to identify exact names.
2. Delete **only** rows marked **DELETE — SAFE**; do not delete ACTIVE, AWAITING VERIFICATION or KEEP.
3. For a merged PR, use GitHub's **Delete branch** action on the PR if available; otherwise go to repository **Branches**, find the exact branch and use its delete control.
4. Remove deleted rows from this queue (or record them as deleted) in a follow-up documentation commit.

## Standing safeguards
- Never mark `main`, `alpha-1a`, World recovery, or necessary backup branches for deletion.
- A PR being merged is not by itself proof that production has been deployed or that the branch is safe to retire.
- Do not delete Neon database branches or Vercel environments under this GitHub branch queue; those require separate checks.
- Keep the existing historical cleanup list `docs/FINAL-GITHUB-BRANCH-DELETE-LISTS-2026-10-14.md` for the already-approved backlog.
